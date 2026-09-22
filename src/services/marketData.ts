import { defaultSectorEtf, fallbackUniverseSymbols, sectorEtfs } from '../data/universe';
import { rateOfChange } from '../lib/indicators';
import { Candle, MarketSeries, SymbolProfile } from '../types';

type NasdaqRow = {
  symbol: string;
  name: string;
  lastsale?: string;
  marketCap: string;
  volume: string;
  sector: string;
  industry: string;
  country: string;
};

type NasdaqEarningsRow = {
  symbol: string;
  time?: string;
};

type YahooChartResult = {
  meta: {
    symbol: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    exchangeName?: string;
    fullExchangeName?: string;
    longName?: string;
    shortName?: string;
    regularMarketVolume?: number;
    instrumentType?: string;
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

const requestJson = async (url: string, headers?: HeadersInit) => {
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.json();
};

const marketDataFunction = (params: URLSearchParams) => `/.netlify/functions/market-data?${params.toString()}`;

const shouldExcludeName = (name: string) => {
  const normalized = name.toLowerCase();
  return [
    'warrant',
    'rights',
    'unit',
    'preferred',
    'depositary share',
    'blank check',
    'acquisition corp',
    'etf',
    'notes due',
    'bond'
  ].some((needle) => normalized.includes(needle));
};

const buildUniverse = (rows: NasdaqRow[]) => {
  const candidates = rows
    .map((row) => {
      const price = parseMoney(row.lastsale);
      const volume = parseMoney(row.volume);
      const marketCap = parseMoney(row.marketCap);
      return {
        row,
        price,
        volume,
        marketCap,
        dollarVolume: price * volume
      };
    })
    .filter((item) =>
      item.row.symbol &&
      /^[A-Z.-]{1,6}$/.test(item.row.symbol) &&
      item.row.country === 'United States' &&
      item.price >= 10 &&
      item.marketCap >= 2_000_000_000 &&
      item.volume >= 1_000_000 &&
      item.dollarVolume >= 25_000_000 &&
      item.row.sector &&
      !shouldExcludeName(item.row.name || '')
    )
    .sort((a, b) => b.dollarVolume - a.dollarVolume)
    .slice(0, 260);

  return {
    symbols: candidates.map((item) => item.row.symbol),
    metadata: new Map(candidates.map((item) => [item.row.symbol, item.row]))
  };
};

const buildPennyUniverse = (rows: NasdaqRow[]) => {
  const candidates = rows
    .map((row) => {
      const price = parseMoney(row.lastsale);
      const volume = parseMoney(row.volume);
      const marketCap = parseMoney(row.marketCap);
      return {
        row,
        price,
        volume,
        marketCap,
        dollarVolume: price * volume
      };
    })
    .filter((item) =>
      item.row.symbol &&
      /^[A-Z.-]{1,6}$/.test(item.row.symbol) &&
      item.row.country === 'United States' &&
      item.price >= 1 &&
      item.price <= 5 &&
      item.marketCap >= 100_000_000 &&
      item.volume >= 750_000 &&
      item.dollarVolume >= 2_000_000 &&
      item.row.sector &&
      !shouldExcludeName(item.row.name || '')
    )
    .sort((a, b) => b.dollarVolume - a.dollarVolume)
    .slice(0, 140);

  return {
    symbols: candidates.map((item) => item.row.symbol),
    metadata: new Map(candidates.map((item) => [item.row.symbol, item.row]))
  };
};

const fetchNasdaqUniverse = async (cacheBust: string): Promise<{ symbols: string[]; metadata: Map<string, NasdaqRow> }> => {
  const params = new URLSearchParams({ source: 'nasdaq' });
  params.set('t', cacheBust);
  const proxyUrl = `/nasdaq/api/screener/stocks?tableonly=true&limit=10000&download=true&t=${cacheBust}`;
  let payload: any;
  try {
    payload = await requestJson(marketDataFunction(params));
  } catch {
    payload = await requestJson(proxyUrl, { Accept: 'application/json' });
  }
  const rows = (payload?.data?.rows || []) as NasdaqRow[];
  const universe = buildUniverse(rows);
  const pennyUniverse = buildPennyUniverse(rows);
  if (universe.symbols.length > 0) {
    return {
      symbols: Array.from(new Set([...universe.symbols, ...pennyUniverse.symbols])),
      metadata: new Map([...universe.metadata, ...pennyUniverse.metadata])
    };
  }
  return {
    symbols: fallbackUniverseSymbols,
    metadata: new Map(rows.filter((row) => fallbackUniverseSymbols.includes(row.symbol)).map((row) => [row.symbol, row]))
  };
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const fetchNasdaqEarnings = async (cacheBust: string): Promise<Map<string, { date: string; timing?: string }>> => {
  const earnings = new Map<string, { date: string; timing?: string }>();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dates = Array.from({ length: 4 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return isoDate(date);
  });
  await mapWithConcurrency(dates, 4, async (date) => {
    const params = new URLSearchParams({ source: 'nasdaq-earnings', date, t: cacheBust });
    const proxyUrl = `/nasdaq/api/calendar/earnings?date=${date}&t=${cacheBust}`;
    let payload: any;
    try {
      payload = await requestJson(marketDataFunction(params));
    } catch {
      payload = await requestJson(proxyUrl, { Accept: 'application/json' });
    }
    const rows = (payload?.data?.rows || []) as NasdaqEarningsRow[];
    rows.forEach((row) => {
      if (row.symbol && !earnings.has(row.symbol)) earnings.set(row.symbol, { date, timing: row.time });
    });
  });
  return earnings;
};

const fetchYahooChart = async (symbol: string, cacheBust: string): Promise<YahooChartResult> => {
  const params = new URLSearchParams({ source: 'yahoo-chart', symbol, t: cacheBust });
  const proxyUrl = `/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&t=${cacheBust}`;
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

const parseMoney = (value?: string) => {
  const raw = String(value || '').trim().toUpperCase();
  const multiplier = raw.endsWith('B') ? 1_000_000_000 : raw.endsWith('M') ? 1_000_000 : raw.endsWith('K') ? 1_000 : 1;
  const normalized = raw.replace(/[$,%\s,]/g, '').replace(/[BMK]$/, '');
  return (Number(normalized) || 0) * multiplier;
};

const toTradingViewExchange = (fullExchangeName?: string, exchangeName?: string) => {
  const value = `${fullExchangeName || ''} ${exchangeName || ''}`.toUpperCase();
  if (value.includes('NASDAQ') || ['NMS', 'NGM', 'NCM', 'NQ'].some((code) => value.includes(code))) return 'NASDAQ';
  if (value.includes('NYSE AMERICAN') || value.includes('AMEX') || value.includes('ASE')) return 'AMEX';
  if (value.includes('NYSEARCA') || value.includes('ARCA') || value.includes('PCX')) return 'AMEX';
  if (value.includes('NYSE') || value.includes('NYQ')) return 'NYSE';
  return undefined;
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

const profileFromSources = (symbol: string, chart: YahooChartResult, row?: NasdaqRow, earnings?: { date: string; timing?: string }): SymbolProfile => {
  const marketCap = parseMoney(row?.marketCap);
  const volume = parseMoney(row?.volume) || chart.meta.regularMarketVolume || 0;
  return {
    symbol,
    company: chart.meta.longName || chart.meta.shortName || row?.name || symbol,
    exchange: chart.meta.fullExchangeName || chart.meta.exchangeName,
    tradingViewExchange: toTradingViewExchange(chart.meta.fullExchangeName, chart.meta.exchangeName),
    sector: row?.sector || 'Unknown',
    industry: row?.industry || 'Unknown',
    marketCap,
    avgVolume: volume,
    nextEarningsDate: earnings?.date,
    nextEarningsTiming: earnings?.timing,
    country: 'US',
    type: chart.meta.instrumentType === 'ETF' ? 'etf' : 'stock'
  };
};

export const fetchLiveMarket = async (): Promise<MarketSeries[]> => {
  const cacheBust = String(Date.now());
  const { symbols: stockSymbols, metadata } = await fetchNasdaqUniverse(cacheBust);
  const upcomingEarnings = await fetchNasdaqEarnings(cacheBust);
  const charts = new Map<string, YahooChartResult>();
  const requiredEtfs = new Set<string>(['SPY']);

  await mapWithConcurrency(stockSymbols, 10, async (symbol) => {
    try {
      const chart = await fetchYahooChart(symbol, cacheBust);
      charts.set(symbol, chart);
      const sector = metadata.get(symbol)?.sector || 'Unknown';
      requiredEtfs.add(sectorEtfs[sector] || defaultSectorEtf);
    } catch {
      // Skip symbols Yahoo cannot chart.
    }
  });

  await mapWithConcurrency(Array.from(requiredEtfs), 4, async (symbol) => {
    if (!charts.has(symbol)) charts.set(symbol, await fetchYahooChart(symbol, cacheBust));
  });

  const spyCandles = chartToCandles(charts.get('SPY')!);
  const spyReturn20 = rateOfChange(spyCandles.map((candle) => candle.close), 20);

  const output: MarketSeries[] = [];
  stockSymbols.forEach((symbol) => {
    const chart = charts.get(symbol);
    if (!chart) return;
    const row = metadata.get(symbol);
    const candles = chartToCandles(chart);
    if (candles.length < 60) return;
    const profile = profileFromSources(symbol, chart, row, upcomingEarnings.get(symbol));
    const sectorEtf = sectorEtfs[profile.sector] || defaultSectorEtf;
    const sectorCandles = chartToCandles(charts.get(sectorEtf) || charts.get('SPY')!);
    const stockReturn20 = rateOfChange(candles.map((candle) => candle.close), 20);
    const sectorReturn20 = rateOfChange(sectorCandles.map((candle) => candle.close), 20);
    output.push({
      profile,
      candles,
      spyReturn20,
      sectorReturn20,
      spyRelative20: stockReturn20 - spyReturn20,
      sectorRelative20: stockReturn20 - sectorReturn20,
      dataSource: 'yahoo' as const,
      lastUpdated: chart.meta.regularMarketTime
        ? new Date(chart.meta.regularMarketTime * 1000).toISOString()
        : candles.at(-1)?.date || 'unknown'
    });
  });
  return output;
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
