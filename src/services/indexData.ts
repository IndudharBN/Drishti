import { Candle, IndexKey } from '../types';
import { average, rateOfChange, round2, sma } from '../lib/indicators';
import { clamp } from '../lib/format';

type YahooChartResult = {
  meta: {
    symbol: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    longName?: string;
    shortName?: string;
    regularMarketVolume?: number;
    currentTradingPeriod?: {
      pre?: { start: number; end: number };
      regular?: { start: number; end: number };
      post?: { start: number; end: number };
    };
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

type Constituent = {
  symbol: string;
  company: string;
  sector: string;
  marketCap: number;
};

export type IndexSummary = {
  key: IndexKey;
  name: string;
  proxySymbol: string;
  price: number;
  todayChangePercent: number;
  fiveDayChangePercent: number;
  twentyDayChangePercent: number;
  marketWindow: string;
  priceSession: string;
  priceTimestamp: string;
  lastUpdated: string;
};

export type IndexDriverRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  priceSession: string;
  priceTimestamp: string;
  previousClose: number;
  previousCloseChangePercent: number;
  marketCap: number;
  todayChangePercent: number;
  fiveDayChangePercent: number;
  twentyDayChangePercent: number;
  volumeRatio: number;
  dollarVolume: number;
  estimatedContribution: number;
  swingScore: number;
  driverScore: number;
  setup: 'Momentum Leader' | 'Early Reclaim' | 'Pullback Watch' | 'Avoid Chase';
  reason: string;
};

export type IndexLeadershipData = {
  refreshedAt: string;
  summaries: Record<IndexKey, IndexSummary>;
  rows: Record<IndexKey, IndexDriverRow[]>;
};

const requestJson = async (url: string, headers?: HeadersInit) => {
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.json();
};

const requestText = async (url: string, headers?: HeadersInit) => {
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.text();
};

const marketDataFunction = (params: URLSearchParams) => `/.netlify/functions/market-data?${params.toString()}`;
const yahooSymbol = (symbol: string) => symbol.replace('.', '-');

const parseMoney = (value?: string | number) => {
  if (typeof value === 'number') return value;
  const raw = String(value || '').trim().toUpperCase();
  const multiplier = raw.endsWith('B') ? 1_000_000_000 : raw.endsWith('M') ? 1_000_000 : raw.endsWith('K') ? 1_000 : 1;
  const normalized = raw.replace(/[$,%\s,]/g, '').replace(/[BMK]$/, '');
  return (Number(normalized) || 0) * multiplier;
};

const fetchYahooChart = async (symbol: string, cacheBust: string): Promise<YahooChartResult> => {
  const params = new URLSearchParams({ source: 'yahoo-chart', symbol: yahooSymbol(symbol), range: '3mo', interval: '1d', t: cacheBust });
  const proxyUrl = `/yahoo/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=3mo&interval=1d&t=${cacheBust}`;
  let payload: any;
  try {
    payload = await requestJson(marketDataFunction(params));
  } catch {
    payload = await requestJson(proxyUrl);
  }
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo chart data for ${symbol}`);
  return result as YahooChartResult;
};

const fetchYahooIntradayChart = async (symbol: string, cacheBust: string): Promise<YahooChartResult> => {
  const params = new URLSearchParams({ source: 'yahoo-chart-intraday', symbol: yahooSymbol(symbol), t: cacheBust });
  const proxyUrl = `/yahoo/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=1d&interval=1m&includePrePost=true&t=${cacheBust}`;
  let payload: any;
  try {
    payload = await requestJson(marketDataFunction(params));
  } catch {
    payload = await requestJson(proxyUrl);
  }
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo intraday chart data for ${symbol}`);
  return result as YahooChartResult;
};

const sessionInfo = (chart: YahooChartResult, timestamp?: number) => {
  const periods = chart.meta.currentTradingPeriod;
  const now = Math.floor(Date.now() / 1000);
  const priceTime = timestamp || chart.meta.regularMarketTime || 0;
  const regular = periods?.regular;
  const pre = periods?.pre;
  const post = periods?.post;
  const marketWindow = pre && now >= pre.start && now < pre.end
    ? 'Pre-market window'
    : regular && now >= regular.start && now < regular.end
      ? 'Regular session'
      : post && now >= post.start && now < post.end
        ? 'After-hours window'
        : 'Market closed';
  const priceSession = pre && priceTime >= pre.start && priceTime <= pre.end
    ? 'Pre-market price'
    : regular && priceTime >= regular.start && priceTime <= regular.end
      ? 'Regular session price'
      : post && priceTime >= post.start && priceTime <= post.end
        ? 'After-hours price'
        : 'Previous regular close';
  return {
    marketWindow,
    priceSession,
    priceTimestamp: priceTime ? new Date(priceTime * 1000).toLocaleString() : 'Time unavailable'
  };
};

const currentPriceInfo = (intradayChart: YahooChartResult, dailyChart: YahooChartResult) => {
  const intradayCandles = chartToCandles(intradayChart);
  const latestIntraday = intradayCandles.at(-1);
  const latestTimestamp = intradayChart.timestamp?.at(-1);
  const dailyCandles = chartToCandles(dailyChart);
  const latestDaily = dailyCandles.at(-1);
  const price = latestIntraday?.close ?? dailyChart.meta.regularMarketPrice ?? latestDaily?.close ?? 0;
  const session = sessionInfo(latestIntraday ? intradayChart : dailyChart, latestTimestamp);
  return {
    price,
    priceSession: session.priceSession,
    priceTimestamp: session.priceTimestamp,
    marketWindow: session.marketWindow
  };
};

const chartToCandles = (chart: YahooChartResult): Candle[] => {
  const timestamps = chart.timestamp || [];
  const quote = chart.indicators?.quote?.[0];
  if (!quote) return [];
  return timestamps.map((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if ([open, high, low, close].some((value) => value === null || value === undefined)) return null;
    return {
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: Number(Number(open).toFixed(2)),
      high: Number(Number(high).toFixed(2)),
      low: Number(Number(low).toFixed(2)),
      close: Number(Number(close).toFixed(2)),
      volume: Number(volume || 0)
    };
  }).filter((item): item is Candle => Boolean(item));
};

const parseSp500Html = (html: string): Constituent[] => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const table = document.querySelector('#constituents');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tbody tr')).map((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
    return {
      symbol: yahooSymbol(cells[0] || ''),
      company: cells[1] || cells[0] || '',
      sector: cells[2] || 'Unknown',
      marketCap: 0
    };
  }).filter((item) => item.symbol);
};

const fetchSp500Constituents = async (cacheBust: string): Promise<Constituent[]> => {
  const params = new URLSearchParams({ source: 'sp500-constituents', t: cacheBust });
  try {
    const payload = await requestJson(marketDataFunction(params));
    const rows = payload?.rows as Constituent[] | undefined;
    if (rows?.length) return rows.map((row) => ({ ...row, symbol: yahooSymbol(row.symbol) }));
  } catch {
    // Use the Vite proxy in local development.
  }
  const html = await requestText(`/wikipedia/wiki/List_of_S%26P_500_companies?t=${cacheBust}`);
  return parseSp500Html(html);
};

const fetchNasdaq100Constituents = async (cacheBust: string): Promise<Constituent[]> => {
  const params = new URLSearchParams({ source: 'nasdaq100', t: cacheBust });
  const proxyUrl = `/nasdaq/api/quote/list-type/nasdaq100?t=${cacheBust}`;
  let payload: any;
  try {
    payload = await requestJson(marketDataFunction(params));
  } catch {
    payload = await requestJson(proxyUrl, { Accept: 'application/json' });
  }
  const rows = payload?.data?.data?.rows || payload?.data?.rows || [];
  return rows.map((row: any) => ({
    symbol: yahooSymbol(row.symbol || ''),
    company: row.companyName || row.name || row.symbol || '',
    sector: row.sector || 'Unknown',
    marketCap: parseMoney(row.marketCap)
  })).filter((item: Constituent) => item.symbol);
};

const makeSummary = (key: IndexKey, name: string, proxySymbol: string, chart: YahooChartResult, intradayChart: YahooChartResult): IndexSummary => {
  const candles = chartToCandles(chart);
  const closes = candles.map((candle) => candle.close);
  const latest = candles.at(-1);
  const current = currentPriceInfo(intradayChart, chart);
  const previousClose = intradayChart.meta.previousClose || intradayChart.meta.chartPreviousClose || latest?.close || 0;
  const price = current.price;
  const todayChangePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
  return {
    key,
    name,
    proxySymbol,
    price: round2(price),
    todayChangePercent: round2(todayChangePercent),
    fiveDayChangePercent: round2(rateOfChange([...closes.slice(0, -1), price], 5)),
    twentyDayChangePercent: round2(rateOfChange([...closes.slice(0, -1), price], 20)),
    marketWindow: current.marketWindow,
    priceSession: current.priceSession,
    priceTimestamp: current.priceTimestamp,
    lastUpdated: chart.meta.regularMarketTime ? new Date(chart.meta.regularMarketTime * 1000).toISOString() : latest?.date || 'unknown'
  };
};

const makeDriverRow = (constituent: Constituent, chart: YahooChartResult, intradayChart: YahooChartResult): IndexDriverRow | null => {
  const candles = chartToCandles(chart);
  if (candles.length < 35) return null;
  const latest = candles.at(-1)!;
  const priorToPrevious = candles.at(-2);
  if (!priorToPrevious) return null;
  const closes = candles.map((candle) => candle.close);
  const current = currentPriceInfo(intradayChart, chart);
  const price = current.price;
  const previousClose = intradayChart.meta.previousClose || intradayChart.meta.chartPreviousClose || latest.close;
  const previousCloseChangePercent = ((previousClose - priorToPrevious.close) / priorToPrevious.close) * 100;
  const todayChangePercent = ((price - previousClose) / previousClose) * 100;
  const fiveDayChangePercent = rateOfChange([...closes.slice(0, -1), price], 5);
  const twentyDayChangePercent = rateOfChange([...closes.slice(0, -1), price], 20);
  const avgVolume20 = average(candles.slice(-21, -1).map((candle) => candle.volume));
  const currentVolume = chart.meta.regularMarketVolume || latest.volume;
  const volumeRatio = currentVolume / Math.max(avgVolume20, 1);
  const dollarVolume = price * currentVolume;
  const sma20Value = sma([...closes.slice(0, -1), price], 20).at(-1) ?? price;
  const tenDayHigh = Math.max(...candles.slice(-11, -1).map((candle) => candle.high));
  const marketCap = constituent.marketCap || dollarVolume * 20;
  const estimatedContribution = marketCap * todayChangePercent;
  const reclaiming = price > sma20Value && previousClose <= sma20Value;
  const trendOk = price >= sma20Value * 0.98 && twentyDayChangePercent > -8;
  const notTooExtended = fiveDayChangePercent < 12 && twentyDayChangePercent < 25;
  const nearBreakout = price >= tenDayHigh * 0.985;
  const swingScore = Math.round(clamp(
    (todayChangePercent > 0 ? 18 : 0) +
    (fiveDayChangePercent > 0 ? 14 : 0) +
    (trendOk ? 18 : 0) +
    (volumeRatio >= 1.2 ? 16 : volumeRatio >= 0.8 ? 8 : 0) +
    (nearBreakout ? 14 : 0) +
    (notTooExtended ? 14 : -12) +
    (marketCap >= 10_000_000_000 ? 6 : 0),
    0,
    100
  ));
  const setup: IndexDriverRow['setup'] = swingScore >= 76 && todayChangePercent > 0
    ? 'Momentum Leader'
    : reclaiming && swingScore >= 62
      ? 'Early Reclaim'
      : swingScore >= 55 && notTooExtended
        ? 'Pullback Watch'
        : 'Avoid Chase';
  const driverScore = Math.round(clamp(swingScore + Math.max(0, todayChangePercent) * 4 + Math.min(20, Math.log10(Math.max(marketCap, 1)) - 8), 0, 130));

  return {
    symbol: constituent.symbol,
    company: chart.meta.longName || chart.meta.shortName || constituent.company,
    sector: constituent.sector,
    price: round2(price),
    priceSession: current.priceSession,
    priceTimestamp: current.priceTimestamp,
    previousClose: round2(previousClose),
    previousCloseChangePercent: round2(previousCloseChangePercent),
    marketCap,
    todayChangePercent: round2(todayChangePercent),
    fiveDayChangePercent: round2(fiveDayChangePercent),
    twentyDayChangePercent: round2(twentyDayChangePercent),
    volumeRatio: round2(volumeRatio),
    dollarVolume,
    estimatedContribution,
    swingScore,
    driverScore,
    setup,
    reason: `${constituent.symbol} is ${todayChangePercent.toFixed(2)}% today, ${fiveDayChangePercent.toFixed(2)}% over 5 sessions, with ${volumeRatio.toFixed(2)}x volume. ${setup === 'Avoid Chase' ? 'It is not a clean short-duration swing setup right now.' : 'It is helping drive the index and has a cleaner 5-10% swing profile than weaker constituents.'}`
  };
};

const fetchRows = async (constituents: Constituent[], cacheBust: string): Promise<IndexDriverRow[]> => {
  const rows: IndexDriverRow[] = [];
  const limited = [...constituents]
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
    .slice(0, constituents.length > 150 ? 260 : constituents.length);
  await mapWithConcurrency(limited, 10, async (constituent) => {
    try {
      const [chart, intradayChart] = await Promise.all([
        fetchYahooChart(constituent.symbol, cacheBust),
        fetchYahooIntradayChart(constituent.symbol, cacheBust)
      ]);
      const row = makeDriverRow(constituent, chart, intradayChart);
      if (row) rows.push(row);
    } catch {
      // Skip symbols Yahoo cannot chart.
    }
  });
  return rows.sort((a, b) =>
    b.driverScore - a.driverScore ||
    Math.abs(b.estimatedContribution) - Math.abs(a.estimatedContribution)
  );
};

export const fetchIndexLeadership = async (): Promise<IndexLeadershipData> => {
  const cacheBust = String(Date.now());
  const [sp500Constituents, nasdaqConstituents, spyChart, qqqChart, spyIntradayChart, qqqIntradayChart] = await Promise.all([
    fetchSp500Constituents(cacheBust),
    fetchNasdaq100Constituents(cacheBust),
    fetchYahooChart('SPY', cacheBust),
    fetchYahooChart('QQQ', cacheBust),
    fetchYahooIntradayChart('SPY', cacheBust),
    fetchYahooIntradayChart('QQQ', cacheBust)
  ]);

  const [sp500Rows, nasdaqRows] = await Promise.all([
    fetchRows(sp500Constituents, cacheBust),
    fetchRows(nasdaqConstituents, cacheBust)
  ]);

  return {
    refreshedAt: new Date().toISOString(),
    summaries: {
      sp500: makeSummary('sp500', 'S&P 500', 'SPY', spyChart, spyIntradayChart),
      nasdaq100: makeSummary('nasdaq100', 'Nasdaq 100', 'QQQ', qqqChart, qqqIntradayChart)
    },
    rows: {
      sp500: sp500Rows,
      nasdaq100: nasdaqRows
    }
  };
};

const mapWithConcurrency = async <T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) => {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
};
