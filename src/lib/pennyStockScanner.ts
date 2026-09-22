import { MarketSeries } from '../types';
import { average, highest, lowest, round2, rsi, sma, standardDeviation } from './indicators';
import { clamp } from './format';

export type PennyStockQuality = 'Best Watch' | 'Speculative Watch';
export type PennyStockPosition = 'Bottom Zone' | 'Wait Pullback';
export type PennyStockRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  marketCap: number;
  avgVolume20: number;
  dollarVolume: number;
  support: number;
  resistance: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  target5: number;
  target10: number;
  stop: number;
  upsideToResistancePercent: number;
  distanceFromLowPercent: number;
  drawdownFromHighPercent: number;
  volumeRatio: number;
  rsi: number;
  trendScore: number;
  reversalScore: number;
  score: number;
  quality: PennyStockQuality;
  position: PennyStockPosition;
  riskFlags: string[];
  entryTrigger: string;
  reason: string;
};

const touchesNear = (values: number[], level: number, tolerancePercent: number) =>
  values.filter((value) => Math.abs((value - level) / Math.max(level, 0.01)) * 100 <= tolerancePercent).length;

export const scanPennyStocks = (market: MarketSeries[]): PennyStockRow[] => market.flatMap((series) => {
  const candles = series.candles;
  if (candles.length < 75 || series.profile.type !== 'stock') return [];

  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const price = current.close;
  if (price < 1 || price > 5) return [];

  const closes = candles.map((candle) => candle.close);
  const recent = candles.slice(-70);
  const recentLows = recent.map((candle) => candle.low);
  const recentHighs = recent.map((candle) => candle.high);
  const support = lowest(recentLows, recentLows.length);
  const resistance = highest(recentHighs, recentHighs.length);
  const avgVolume20 = average(candles.slice(-21, -1).map((candle) => candle.volume));
  const dollarVolume = price * current.volume;
  const volumeRatio = current.volume / Math.max(avgVolume20, 1);
  const sma20Value = sma(closes, 20).at(-1) ?? price;
  const sma50Value = sma(closes, 50).at(-1) ?? price;
  const rsiValues = rsi(closes, 14);
  const currentRsi = rsiValues.at(-1) ?? 50;
  const previousRsi = rsiValues.at(-2) ?? currentRsi;
  const return20 = ((price - closes[closes.length - 21]) / Math.max(closes[closes.length - 21], 0.01)) * 100;
  const return60 = ((price - closes[closes.length - 61]) / Math.max(closes[closes.length - 61], 0.01)) * 100;
  const distanceFromLowPercent = ((price - support) / Math.max(price, 0.01)) * 100;
  const upsideToResistancePercent = ((resistance - price) / Math.max(price, 0.01)) * 100;
  const drawdownFromHighPercent = ((resistance - price) / Math.max(resistance, 0.01)) * 100;
  const closeVolatilityPercent = (standardDeviation(recent.map((candle) => candle.close)) / Math.max(price, 0.01)) * 100;
  const supportTouches = touchesNear(recentLows, support, 2.8);
  const bouncedFromSupport = current.close > current.open || current.close > previous.close;
  const rsiTurning = currentRsi > previousRsi && currentRsi >= 28 && currentRsi <= 55;
  const strictBottom = distanceFromLowPercent >= 0 && distanceFromLowPercent <= 12 && price <= support * 1.14;
  const extendedFromBottom = distanceFromLowPercent > 18 || price > support * 1.22;
  const nearBottom = distanceFromLowPercent >= 0 && distanceFromLowPercent <= 24;
  const hasRoom = upsideToResistancePercent >= 5;
  const baseHeld = supportTouches >= 1 && price >= support * 1.005;
  const liquidEnough = series.profile.marketCap >= 100_000_000 && avgVolume20 >= 750_000 && dollarVolume >= 2_000_000;
  const notDistressedTrend = return60 > -70 && price >= sma50Value * 0.62 && current.volume >= avgVolume20 * 0.35;
  const notTooWild = closeVolatilityPercent <= 40;

  if (!liquidEnough || !nearBottom || !hasRoom || !baseHeld || !notDistressedTrend || !notTooWild) return [];

  const trendScore = Math.round(clamp(
    (price >= sma20Value ? 18 : price >= sma20Value * 0.94 ? 10 : 0) +
    (price >= sma50Value * 0.9 ? 16 : 6) +
    (return20 > -12 ? 12 : return20 > -25 ? 6 : 0),
    0,
    46
  ));
  const reversalScore = Math.round(clamp(
    (bouncedFromSupport ? 18 : 0) +
    (rsiTurning ? 16 : 0) +
    (volumeRatio >= 1.2 ? 14 : volumeRatio >= 0.8 ? 7 : 0),
    0,
    48
  ));
  const score = Math.round(clamp(
    trendScore +
    reversalScore +
    (supportTouches >= 3 ? 10 : 5) +
    (upsideToResistancePercent >= 12 ? 10 : 5) +
    (strictBottom ? 12 : extendedFromBottom ? -18 : 0) +
    (series.profile.marketCap >= 300_000_000 ? 8 : 3),
    0,
    100
  ));
  if (score < 48) return [];

  const riskFlags = [
    !strictBottom ? 'Not at the bottom entry zone yet; wait for pullback closer to support.' : '',
    series.profile.marketCap < 300_000_000 ? 'Small market cap; position size should be conservative.' : '',
    avgVolume20 < 1_500_000 ? 'Liquidity is acceptable but not deep.' : '',
    return60 < -35 ? 'Still in a damaged 60-day trend; wait for confirmation.' : '',
    closeVolatilityPercent > 18 ? 'High daily volatility; use strict stops.' : ''
  ].filter(Boolean);
  const quality: PennyStockQuality = score >= 74 && series.profile.marketCap >= 300_000_000 && avgVolume20 >= 1_500_000
    ? 'Best Watch'
    : 'Speculative Watch';
  const position: PennyStockPosition = strictBottom ? 'Bottom Zone' : 'Wait Pullback';

  return [{
    symbol: series.profile.symbol,
    company: series.profile.company,
    sector: series.profile.sector,
    price: round2(price),
    marketCap: series.profile.marketCap,
    avgVolume20,
    dollarVolume,
    support: round2(support),
    resistance: round2(resistance),
    buyZoneLow: round2(support * 1.01),
    buyZoneHigh: round2(support * 1.08),
    target5: round2(Math.min(price * 1.05, resistance)),
    target10: round2(Math.min(price * 1.1, resistance)),
    stop: round2(support * 0.94),
    upsideToResistancePercent: round2(upsideToResistancePercent),
    distanceFromLowPercent: round2(distanceFromLowPercent),
    drawdownFromHighPercent: round2(drawdownFromHighPercent),
    volumeRatio: round2(volumeRatio),
    rsi: round2(currentRsi),
    trendScore,
    reversalScore,
    score,
    quality,
    position,
    riskFlags,
    entryTrigger: strictBottom
      ? `Bottom zone ${round2(support * 1.01).toFixed(2)}-${round2(support * 1.08).toFixed(2)}; enter only after a green candle or reclaim above ${round2(Math.max(current.high, sma20Value)).toFixed(2)} with volume.`
      : `Do not chase. Wait for pullback into ${round2(support * 1.01).toFixed(2)}-${round2(support * 1.08).toFixed(2)} before considering entry.`,
    reason: `${series.profile.symbol} is ${distanceFromLowPercent.toFixed(2)}% above its 70-session low with ${upsideToResistancePercent.toFixed(2)}% room back to resistance. It passes liquidity, market-cap, trend-damage, and volatility filters used to avoid the weakest penny-stock names.`
  }];
}).sort((a, b) =>
  b.score - a.score ||
  a.distanceFromLowPercent - b.distanceFromLowPercent ||
  b.dollarVolume - a.dollarVolume
);
