import { MarketSeries } from '../types';
import { average, rateOfChange, round2 } from './indicators';
import { clamp } from './format';

export type RunnerRisk = 'Extreme' | 'Very High';
export type RunnerSetup = 'Live Runner' | 'Pre-Breakout Watch' | 'News/Catalyst Needed';

export type RunnerRadarRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  marketCap: number;
  todayMovePercent: number;
  fiveDayMovePercent: number;
  twentyDayMovePercent: number;
  rangePercent: number;
  volumeRatio: number;
  dollarVolume: number;
  breakoutDistancePercent: number;
  runnerScore: number;
  probabilityBand: string;
  setup: RunnerSetup;
  risk: RunnerRisk;
  trigger: string;
  reason: string;
};

export const scanRunnerRadar = (market: MarketSeries[]): RunnerRadarRow[] => market.flatMap((series) => {
  const candles = series.candles;
  if (candles.length < 35 || series.profile.type !== 'stock') return [];
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  if (!previous) return [];

  const price = current.close;
  const marketCap = series.profile.marketCap;
  const avgVolume20 = average(candles.slice(-21, -1).map((candle) => candle.volume));
  const volumeRatio = current.volume / Math.max(avgVolume20, 1);
  const dollarVolume = price * current.volume;
  const closes = candles.map((candle) => candle.close);
  const todayMovePercent = ((price - previous.close) / previous.close) * 100;
  const fiveDayMovePercent = rateOfChange(closes, 5);
  const twentyDayMovePercent = rateOfChange(closes, 20);
  const rangePercent = ((current.high - current.low) / Math.max(previous.close, 0.01)) * 100;
  const prior20High = Math.max(...candles.slice(-21, -1).map((candle) => candle.high));
  const breakoutDistancePercent = ((price - prior20High) / Math.max(prior20High, 0.01)) * 100;
  const nearBreakout = price >= prior20High * 0.96;
  const smallEnoughToMove = marketCap >= 75_000_000 && marketCap <= 12_000_000_000;
  const tradable = price >= 0.8 && price <= 25 && avgVolume20 >= 500_000 && dollarVolume >= 1_500_000;
  const notDead = price >= 1 || marketCap >= 300_000_000;
  if (!tradable || !smallEnoughToMove || !notDead) return [];

  const runnerScore = Math.round(clamp(
    (todayMovePercent >= 12 ? 28 : todayMovePercent >= 6 ? 18 : todayMovePercent >= 2 ? 8 : 0) +
    (volumeRatio >= 4 ? 24 : volumeRatio >= 2 ? 16 : volumeRatio >= 1.2 ? 8 : 0) +
    (rangePercent >= 12 ? 16 : rangePercent >= 7 ? 10 : rangePercent >= 4 ? 5 : 0) +
    (nearBreakout ? 14 : 0) +
    (fiveDayMovePercent >= 8 ? 8 : fiveDayMovePercent >= 0 ? 4 : 0) +
    (twentyDayMovePercent <= 60 ? 6 : -12) +
    (marketCap <= 2_000_000_000 ? 8 : marketCap <= 6_000_000_000 ? 4 : 0),
    0,
    100
  ));
  if (runnerScore < 58) return [];

  const setup: RunnerSetup = todayMovePercent >= 10 && volumeRatio >= 2 && rangePercent >= 7
    ? 'Live Runner'
    : nearBreakout && volumeRatio >= 1.2
      ? 'Pre-Breakout Watch'
      : 'News/Catalyst Needed';
  const probabilityBand = runnerScore >= 82
    ? 'Highest radar score'
    : runnerScore >= 70
      ? 'Strong radar score'
      : 'Speculative radar score';

  const risk: RunnerRisk = runnerScore >= 82 ? 'Extreme' : 'Very High';

  return [{
    symbol: series.profile.symbol,
    company: series.profile.company,
    sector: series.profile.sector,
    price: round2(price),
    marketCap,
    todayMovePercent: round2(todayMovePercent),
    fiveDayMovePercent: round2(fiveDayMovePercent),
    twentyDayMovePercent: round2(twentyDayMovePercent),
    rangePercent: round2(rangePercent),
    volumeRatio: round2(volumeRatio),
    dollarVolume,
    breakoutDistancePercent: round2(breakoutDistancePercent),
    runnerScore,
    probabilityBand,
    setup,
    risk,
    trigger: setup === 'Live Runner'
      ? `Already moving. Only watch continuation above ${round2(current.high).toFixed(2)} with strict risk controls.`
      : `Watch for a break above ${round2(prior20High).toFixed(2)} with volume staying above ${Math.max(1.5, volumeRatio).toFixed(1)}x average.`,
    reason: `${series.profile.symbol} has ${todayMovePercent.toFixed(2)}% same-day momentum, ${volumeRatio.toFixed(2)}x relative volume, a ${rangePercent.toFixed(2)}% daily range, and is ${breakoutDistancePercent.toFixed(2)}% from its 20-session high. These are the conditions the radar uses for possible 50%+ runner behavior, not a prediction.`
  }];
}).sort((a, b) =>
  b.runnerScore - a.runnerScore ||
  b.todayMovePercent - a.todayMovePercent ||
  b.volumeRatio - a.volumeRatio
).slice(0, 5);
