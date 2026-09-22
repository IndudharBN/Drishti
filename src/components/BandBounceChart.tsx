import { useEffect, useMemo, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries } from 'lightweight-charts';
import { ExternalLink } from 'lucide-react';
import { MarketSeries } from '../types';
import { average, ema, standardDeviation } from '../lib/indicators';
import { BandBounceRow } from '../lib/bandBounceScanner';

type Props = {
  row: BandBounceRow;
  series?: MarketSeries;
};

const wma = (values: number[], period: number) => values.map((_, index) => {
  if (index + 1 < period) return null;
  const slice = values.slice(index + 1 - period, index + 1);
  const divisor = (period * (period + 1)) / 2;
  return slice.reduce((sum, value, itemIndex) => sum + value * (itemIndex + 1), 0) / divisor;
});

const bands = (values: number[], period = 20) => values.map((_, index) => {
  if (index + 1 < period) return null;
  const slice = values.slice(index + 1 - period, index + 1);
  const middle = average(slice);
  const deviation = standardDeviation(slice) * 2;
  return { lower: middle - deviation, middle, upper: middle + deviation };
});

const lineData = (series: MarketSeries, values: Array<number | null>) => series.candles
  .map((candle, index) => values[index] === null ? null : { time: candle.date, value: Number(values[index]!.toFixed(2)) })
  .filter((item): item is { time: string; value: number } => Boolean(item));

const bandLineData = (series: MarketSeries, values: Array<{ lower: number; middle: number; upper: number } | null>, key: 'lower' | 'middle' | 'upper') => series.candles
  .map((candle, index) => values[index] === null ? null : { time: candle.date, value: Number(values[index]![key].toFixed(2)) })
  .filter((item): item is { time: string; value: number } => Boolean(item));

const tradingViewUrl = (series: MarketSeries | undefined, symbol: string) => {
  const exchangeSymbol = series?.profile.tradingViewExchange ? `${series.profile.tradingViewExchange}:${symbol}` : symbol;
  return `/tradingview-band-chart.html?symbol=${encodeURIComponent(exchangeSymbol)}`;
};

export const BandBounceChart = ({ row, series }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => {
    if (!series) return null;
    const closes = series.candles.map((candle) => candle.close);
    return { bands: bands(closes), ema: ema(closes, 9), wma: wma(closes, 9) };
  }, [series]);

  useEffect(() => {
    if (!containerRef.current || !series || !chartData) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 360,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#334155' },
      grid: { vertLines: { color: '#edf2f7' }, horzLines: { color: '#edf2f7' } },
      rightPriceScale: { borderColor: '#d8dee8' },
      timeScale: { borderColor: '#d8dee8' }
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#168a57', downColor: '#c2413c', borderVisible: false, wickUpColor: '#168a57', wickDownColor: '#c2413c'
    });
    candles.setData(series.candles.map((candle) => ({ time: candle.date, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    volume.setData(series.candles.map((candle) => ({
      time: candle.date,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(22, 138, 87, 0.28)' : 'rgba(194, 65, 60, 0.28)'
    })));
    [
      { color: '#2563eb', data: bandLineData(series, chartData.bands, 'upper') },
      { color: '#64748b', data: bandLineData(series, chartData.bands, 'middle') },
      { color: '#2563eb', data: bandLineData(series, chartData.bands, 'lower') },
      { color: '#168a57', data: lineData(series, chartData.ema) },
      { color: '#b7791f', data: lineData(series, chartData.wma) }
    ].forEach((line) => {
      const lineSeries = chart.addSeries(LineSeries, { color: line.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      lineSeries.setData(line.data);
    });
    [
      { value: row.entry, color: '#172033', title: 'Entry' },
      { value: row.stop, color: '#c2413c', title: 'Stop' },
      { value: row.target1, color: '#64748b', title: 'Target 1' },
      { value: row.target2, color: '#168a57', title: 'Target 2' }
    ].forEach((line) => candles.createPriceLine({ price: line.value, color: line.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: line.title }));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, chartData, row]);

  return (
    <div className="mt-4 rounded-md border border-line bg-white p-3">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-semibold text-ink">{row.symbol} Bollinger Band Chart</h4>
          <p className="text-xs text-slate-500">Candles / Bollinger upper-middle-lower / Bollinger %B {row.bollingerPercentB.toFixed(2)} / BandWidth {row.bollingerBandwidth.toFixed(2)}% / EMA 9 / WMA 9 / volume / scanner trade levels</p>
        </div>
        <a href={tradingViewUrl(series, row.symbol)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
          <ExternalLink className="h-4 w-4" />
          Open TradingView with Indicators
        </a>
      </div>
      {series ? (
        <>
          <div ref={containerRef} className="h-[360px] w-full" />
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="text-blue-700">Bollinger Bands</span>
            <span className="text-slate-600">Middle band</span>
            <span className="text-emerald-700">EMA 9</span>
            <span className="text-amber-700">WMA 9</span>
            <span className="text-violet-700">%B {row.bollingerPercentB.toFixed(2)}</span>
            <span className="text-cyan-700">BandWidth {row.bollingerBandwidth.toFixed(2)}%</span>
          </div>
        </>
      ) : (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">This sample row does not have live candles. Use the TradingView button to open the symbol with Bollinger Bands, EMA, and WMA applied.</p>
      )}
    </div>
  );
};
