import { useEffect, useMemo, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries } from 'lightweight-charts';
import { MarketSeries, StrategyResult } from '../types';
import { chartIndicators } from '../engine/strategyEngine';
import { currency } from '../lib/format';

type Props = {
  series: MarketSeries;
  result: StrategyResult;
};

const toLine = (candles: MarketSeries['candles'], values: Array<number | null>, color: string) => ({
  color,
  data: candles
    .map((candle, index) => values[index] === null ? null : { time: candle.date, value: Number(values[index]!.toFixed(2)) })
    .filter((item): item is { time: string; value: number } => Boolean(item))
});

export const TradingChart = ({ series, result }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicators = useMemo(() => chartIndicators(series.candles), [series]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155'
      },
      grid: {
        vertLines: { color: '#edf2f7' },
        horzLines: { color: '#edf2f7' }
      },
      rightPriceScale: { borderColor: '#d8dee8' },
      timeScale: { borderColor: '#d8dee8' }
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#168a57',
      downColor: '#c2413c',
      borderVisible: false,
      wickUpColor: '#168a57',
      wickDownColor: '#c2413c'
    });
    candles.setData(series.candles.map((candle) => ({
      time: candle.date,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    })));

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#94a3b8'
    });
    volume.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 }
    });
    volume.setData(series.candles.map((candle) => ({
      time: candle.date,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(22, 138, 87, 0.35)' : 'rgba(194, 65, 60, 0.35)'
    })));

    [toLine(series.candles, indicators.sma20, '#2563eb'), toLine(series.candles, indicators.sma50, '#b7791f'), toLine(series.candles, indicators.sma200, '#475569')].forEach((line) => {
      const lineSeries = chart.addSeries(LineSeries, { color: line.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      lineSeries.setData(line.data);
    });

    [
      { value: result.entry, color: '#172033', title: 'Entry' },
      { value: result.target, color: '#168a57', title: 'Target +5%' },
      { value: result.stop, color: '#c2413c', title: 'Stop' },
      { value: indicators.supportResistance.resistance, color: '#7c3aed', title: 'Resistance' },
      { value: indicators.supportResistance.support, color: '#64748b', title: 'Support' }
    ].forEach((line) => candles.createPriceLine({
      price: line.value,
      color: line.color,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: line.title
    }));

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, result, indicators]);

  const latest = series.candles.at(-1);
  const tradingViewSymbol = series.profile.tradingViewExchange
    ? `${series.profile.tradingViewExchange}:${series.profile.symbol}`
    : series.profile.symbol;
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`;

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">{series.profile.symbol} Technical Chart</h2>
          <p className="text-sm text-slate-500">
            Latest close {latest ? currency(latest.close) : '-'} / SMA20, SMA50, SMA200, volume, support, resistance, entry, target, stop
          </p>
          <p className="mt-1 text-xs text-slate-500">
            TradingView symbol: {tradingViewSymbol}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Candles loaded from Yahoo Finance delayed daily chart data. Updated {series.lastUpdated}.
          </p>
        </div>
        <a className="inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-slate-50" href={tradingViewUrl} target="_blank" rel="noreferrer">
          Open in TradingView
        </a>
      </div>
      <div ref={containerRef} className="h-[420px] w-full" />
      <p className="mt-3 text-xs text-slate-500">
        Lightweight Charts attribution: TradingView Lightweight Charts is used for the embedded chart. Use the external TradingView link for full platform indicators.
      </p>
    </section>
  );
};
