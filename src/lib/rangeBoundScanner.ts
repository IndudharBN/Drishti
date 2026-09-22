import { MarketSeries } from '../types';
import { average, round2, standardDeviation } from './indicators';
import { clamp } from './format';

export type RangeBoundQuality = 'High' | 'Medium' | 'Watch';
export type RangeBoundPosition = 'At Support' | 'Bottom Zone' | 'Middle' | 'Top Zone' | 'Breaking Support';

export type RangeBoundRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  support: number;
  resistance: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  stop: number;
  target2: number;
  target3: number;
  target4: number;
  rangeUpsidePercent: number;
  distanceFromBottomPercent: number;
  distanceFromSupportPercent: number;
  distanceToTopPercent: number;
  rangeWidthPercent: number;
  rangePositionPercent: number;
  supportTouches: number;
  resistanceTouches: number;
  sidewaysScore: number;
  volumeRatio: number;
  avgVolume20: number;
  dollarVolume: number;
  quality: RangeBoundQuality;
  position: RangeBoundPosition;
  score: number;
  reason: string;
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index] ?? 0;
};

const regressionSlopePercent = (values: number[]) => {
  if (values.length < 2) return 0;
  const xAvg = (values.length - 1) / 2;
  const yAvg = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xAvg) * (value - yAvg);
    denominator += (index - xAvg) ** 2;
  });
  const slope = numerator / Math.max(denominator, 0.01);
  return (slope / Math.max(yAvg, 0.01)) * 100 * values.length;
};

const countTouches = (values: number[], level: number, tolerancePercent: number) =>
  values.filter((value) => Math.abs((value - level) / Math.max(level, 0.01)) * 100 <= tolerancePercent).length;

export const scanRangeBoundStocks = (market: MarketSeries[]): RangeBoundRow[] => market.flatMap((series) => {
  const candles = series.candles;
  if (candles.length < 75) return [];

  const recent = candles.slice(-70);
  const closes = recent.map((candle) => candle.close);
  const lows = recent.map((candle) => candle.low);
  const highs = recent.map((candle) => candle.high);
  const current = candles[candles.length - 1];
  const price = current.close;
  const support = percentile(lows, 0.12);
  const resistance = percentile(highs, 0.88);
  const rangeWidthPercent = ((resistance - support) / Math.max(price, 0.01)) * 100;
  if (support <= 0 || resistance <= support || rangeWidthPercent < 4 || rangeWidthPercent > 18) return [];

  const avgVolume20 = average(candles.slice(-21, -1).map((candle) => candle.volume));
  const volumeRatio = current.volume / Math.max(avgVolume20, 1);
  const dollarVolume = price * current.volume;
  const liquid = series.profile.marketCap >= 2_000_000_000 && avgVolume20 >= 1_000_000 && dollarVolume >= 40_000_000;
  if (!liquid) return [];

  const supportTouches = countTouches(lows, support, 1.4);
  const resistanceTouches = countTouches(highs, resistance, 1.4);
  if (supportTouches < 2 || resistanceTouches < 2) return [];

  const rangePositionPercent = ((price - support) / Math.max(resistance - support, 0.01)) * 100;
  const distanceFromSupportPercent = ((price - support) / Math.max(support, 0.01)) * 100;
  const position: RangeBoundPosition = distanceFromSupportPercent < -0.8
    ? 'Breaking Support'
    : distanceFromSupportPercent <= 1.2
      ? 'At Support'
      : rangePositionPercent <= 30
        ? 'Bottom Zone'
        : rangePositionPercent >= 72
          ? 'Top Zone'
          : 'Middle';
  const slopePercent = Math.abs(regressionSlopePercent(closes));
  const closeVolatilityPercent = (standardDeviation(closes) / Math.max(average(closes), 0.01)) * 100;
  const sidewaysScore = Math.round(clamp(100 - slopePercent * 6 - Math.abs(rangePositionPercent - 50) * 0.25 - Math.max(0, closeVolatilityPercent - 7) * 4, 0, 100));
  if (sidewaysScore < 45) return [];

  const buyZoneLow = support * 0.997;
  const buyZoneHigh = support * 1.018;
  const stop = support * 0.982;
  const target2 = price * 1.02;
  const target3 = price * 1.03;
  const target4 = price * 1.04;
  const rangeUpsidePercent = ((resistance - price) / Math.max(price, 0.01)) * 100;
  const distanceFromBottomPercent = ((price - support) / Math.max(price, 0.01)) * 100;
  const distanceToTopPercent = ((resistance - price) / Math.max(price, 0.01)) * 100;

  const score = Math.round(clamp(
    sidewaysScore * 0.35 +
    Math.min(supportTouches, 5) * 5 +
    Math.min(resistanceTouches, 5) * 5 +
    (position === 'At Support' ? 24 : position === 'Bottom Zone' ? 12 : position === 'Middle' ? 4 : position === 'Breaking Support' ? -22 : -8) +
    (rangeUpsidePercent >= 4 ? 10 : rangeUpsidePercent >= 2 ? 5 : -10) +
    (volumeRatio >= 1 ? 7 : volumeRatio >= 0.7 ? 3 : -5) +
    (series.profile.marketCap >= 10_000_000_000 ? 5 : 0),
    0,
    100
  ));

  const quality: RangeBoundQuality = score >= 78 && position !== 'Top Zone' && position !== 'Breaking Support' && rangeUpsidePercent >= 3
    ? 'High'
    : score >= 62 && rangeUpsidePercent >= 2
      ? 'Medium'
      : 'Watch';

  return [{
    symbol: series.profile.symbol,
    company: series.profile.company,
    sector: series.profile.sector,
    price: round2(price),
    support: round2(support),
    resistance: round2(resistance),
    buyZoneLow: round2(buyZoneLow),
    buyZoneHigh: round2(buyZoneHigh),
    stop: round2(stop),
    target2: round2(Math.min(target2, resistance)),
    target3: round2(Math.min(target3, resistance)),
    target4: round2(Math.min(target4, resistance)),
    rangeUpsidePercent: round2(rangeUpsidePercent),
    distanceFromBottomPercent: round2(distanceFromBottomPercent),
    distanceFromSupportPercent: round2(distanceFromSupportPercent),
    distanceToTopPercent: round2(distanceToTopPercent),
    rangeWidthPercent: round2(rangeWidthPercent),
    rangePositionPercent: round2(rangePositionPercent),
    supportTouches,
    resistanceTouches,
    sidewaysScore,
    volumeRatio: round2(volumeRatio),
    avgVolume20,
    dollarVolume,
    quality,
    position,
    score,
    reason: `${series.profile.symbol} has traded in a ${rangeWidthPercent.toFixed(2)}% range with ${supportTouches} support touches near ${support.toFixed(2)} and ${resistanceTouches} resistance touches near ${resistance.toFixed(2)}. Current price is ${distanceFromSupportPercent.toFixed(2)}% from support and ${distanceToTopPercent.toFixed(2)}% below resistance.`
  }];
}).sort((a, b) =>
  (a.position === 'At Support' ? 0 : 1) - (b.position === 'At Support' ? 0 : 1) ||
  Math.abs(a.distanceFromSupportPercent) - Math.abs(b.distanceFromSupportPercent) ||
  b.score - a.score ||
  b.dollarVolume - a.dollarVolume
);
