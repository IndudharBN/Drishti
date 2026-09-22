import { MarketSeries } from '../types';
import { average, rateOfChange, round2 } from './indicators';
import { clamp } from './format';

export type VolatileStockRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  todayMovePercent: number;
  todayRangePercent: number;
  openToClosePercent: number;
  high: number;
  low: number;
  volumeRatio: number;
  dollarVolume: number;
  marketCap: number;
  twoPercentTarget: number;
  suggestedStop: number;
  rewardRisk: number;
  score: number;
  readinessScore: number;
  readiness: 'Entry Setup' | 'Watch' | 'Avoid';
  direction: 'Bullish' | 'Bearish' | 'Two-way';
  quality: 'High' | 'Medium' | 'Speculative';
  setup: 'Momentum' | 'Pullback Reversal';
  pullbackFromHighPercent: number;
  rangePositionPercent: number;
  readinessReasons: string[];
  readinessBlockers: string[];
  entryTrigger: string;
  reason: string;
};

const last = <T>(values: T[]) => values[values.length - 1];
const previous = <T>(values: T[]) => values[values.length - 2];

export const scanVolatileStocks = (market: MarketSeries[]): VolatileStockRow[] => market.flatMap((series) => {
  if (series.candles.length < 25) return [];
  const current = last(series.candles);
  const prior = previous(series.candles);
  const avgVolume20 = average(series.candles.slice(-21, -1).map((candle) => candle.volume));
  const price = current.close;
  const todayMovePercent = ((price - prior.close) / prior.close) * 100;
  const todayRangePercent = ((current.high - current.low) / Math.max(price, 0.01)) * 100;
  const openToClosePercent = ((price - current.open) / Math.max(current.open, 0.01)) * 100;
  const pullbackFromHighPercent = ((current.high - price) / Math.max(current.high, 0.01)) * 100;
  const rangePositionPercent = ((price - current.low) / Math.max(current.high - current.low, 0.01)) * 100;
  const volumeRatio = current.volume / Math.max(avgVolume20, 1);
  const dollarVolume = price * current.volume;
  const twoPercentTarget = price * 1.02;
  const suggestedStop = Math.max(current.low * 0.997, price * 0.987);
  const riskPercent = ((price - suggestedStop) / price) * 100;
  const rewardRisk = 2 / Math.max(riskPercent, 0.1);
  const recentMomentum = rateOfChange(series.candles.map((candle) => candle.close), 5);
  const liquid = series.profile.marketCap >= 2_000_000_000 && series.profile.avgVolume >= 1_000_000 && dollarVolume >= 50_000_000;
  const tradableRange = todayRangePercent >= 2 && todayRangePercent <= 9;
  const notTooStretched = Math.abs(todayMovePercent) <= 6.5;
  const volumeConfirmed = volumeRatio >= 1.1;
  const institutionalLiquidity = series.profile.marketCap >= 10_000_000_000 && series.profile.avgVolume >= 2_000_000 && dollarVolume >= 100_000_000;

  if (!liquid || todayRangePercent < 1.5) return [];

  const direction: VolatileStockRow['direction'] =
    todayMovePercent > 0.75 && openToClosePercent > -0.25 ? 'Bullish' :
      todayMovePercent < -0.75 && openToClosePercent < 0.25 ? 'Bearish' :
        'Two-way';
  const pullbackReversal =
    direction === 'Bullish' &&
    todayRangePercent >= 2 &&
    pullbackFromHighPercent >= 0.8 &&
    pullbackFromHighPercent <= 4.5 &&
    rangePositionPercent >= 42 &&
    rangePositionPercent <= 76 &&
    openToClosePercent >= -0.1;
  const setup: VolatileStockRow['setup'] = pullbackReversal ? 'Pullback Reversal' : 'Momentum';
  const bullishBias = direction === 'Bullish' ? 15 : direction === 'Two-way' ? 3 : -12;
  const score = Math.round(clamp(
    todayRangePercent * 10 +
    Math.min(volumeRatio, 4) * 15 +
    Math.max(0, 20 - Math.abs(todayMovePercent - 2) * 3) +
    (rewardRisk >= 1.5 ? 15 : 0) +
    (series.profile.marketCap >= 10_000_000_000 ? 10 : 0) +
    (notTooStretched ? 10 : -10) +
    (recentMomentum > 0 ? 5 : 0) +
    bullishBias +
    (pullbackReversal ? 8 : 0),
    0,
    100
  ));
  const quality: VolatileStockRow['quality'] = score >= 75 && volumeConfirmed && tradableRange && rewardRisk >= 1.5
    ? 'High'
    : score >= 55
      ? 'Medium'
      : 'Speculative';
  const isConstructive = direction === 'Bullish' && openToClosePercent >= -0.25 && rangePositionPercent >= 45;
  const nearHighButNotChasing = pullbackFromHighPercent >= 0.25 && pullbackFromHighPercent <= 4.5;
  const hasCleanRisk = rewardRisk >= 1.5 && riskPercent <= 1.35;
  const readinessScore = Math.round(clamp(
    (institutionalLiquidity ? 20 : liquid ? 12 : 0) +
    (volumeRatio >= 2 ? 20 : volumeRatio >= 1.5 ? 16 : volumeRatio >= 1.1 ? 10 : 0) +
    (isConstructive ? 18 : direction === 'Two-way' ? 6 : 0) +
    (pullbackReversal ? 15 : nearHighButNotChasing && direction === 'Bullish' ? 10 : 2) +
    (hasCleanRisk ? 15 : rewardRisk >= 1.2 ? 8 : 0) +
    (tradableRange ? 8 : todayRangePercent >= 1.5 && todayRangePercent <= 12 ? 4 : 0) +
    (notTooStretched ? 4 : -8),
    0,
    100
  ));
  const readinessReasons = [
    institutionalLiquidity ? 'Strong liquidity and dollar volume' : liquid ? 'Tradable liquidity passes minimums' : '',
    volumeRatio >= 2 ? 'Volume is at least 2x normal' : volumeConfirmed ? 'Relative volume confirms interest' : '',
    isConstructive ? 'Price action is bullish and holding the upper half of the day range' : '',
    pullbackReversal ? 'Pullback from the high is controlled rather than a straight chase' : nearHighButNotChasing && direction === 'Bullish' ? 'Still near the high with a defined pullback' : '',
    hasCleanRisk ? '2% target has at least 1.5x reward/risk with a tight stop' : rewardRisk >= 1.2 ? 'Reward/risk is acceptable but not ideal' : ''
  ].filter(Boolean);
  const readinessBlockers = [
    direction !== 'Bullish' ? 'Not bullish enough for a long-entry shortlist' : '',
    !volumeConfirmed ? 'Relative volume is below 1.1x' : '',
    !tradableRange ? 'Today range is either too small or too stretched' : '',
    !notTooStretched ? 'Move is already extended beyond the preferred chase zone' : '',
    rewardRisk < 1.5 ? '2% target does not offer 1.5x reward/risk' : '',
    rangePositionPercent < 45 ? 'Price is not holding the upper half of the day range' : ''
  ].filter(Boolean);
  const readiness: VolatileStockRow['readiness'] =
    readinessScore >= 78 && readinessBlockers.length === 0
      ? 'Entry Setup'
      : readinessScore >= 58 && readinessBlockers.length <= 2
        ? 'Watch'
        : 'Avoid';
  const entryTrigger = readiness === 'Entry Setup'
    ? `Consider only on a break above ${round2(Math.min(current.high, price * 1.01)).toFixed(2)} with volume holding above ${volumeRatio.toFixed(2)}x. Stop near ${round2(suggestedStop).toFixed(2)}.`
    : readiness === 'Watch'
      ? `Wait for price to reclaim the upper half of today's range and clear ${round2(current.high).toFixed(2)} on stronger volume.`
      : 'No entry trigger yet; wait for cleaner direction, volume, and reward/risk.';

  return [{
    symbol: series.profile.symbol,
    company: series.profile.company,
    sector: series.profile.sector,
    price: round2(price),
    todayMovePercent: round2(todayMovePercent),
    todayRangePercent: round2(todayRangePercent),
    openToClosePercent: round2(openToClosePercent),
    high: round2(current.high),
    low: round2(current.low),
    volumeRatio: round2(volumeRatio),
    dollarVolume,
    marketCap: series.profile.marketCap,
    twoPercentTarget: round2(twoPercentTarget),
    suggestedStop: round2(suggestedStop),
    rewardRisk: round2(rewardRisk),
    score,
    readinessScore,
    readiness,
    direction,
    quality,
    setup,
    pullbackFromHighPercent: round2(pullbackFromHighPercent),
    rangePositionPercent: round2(rangePositionPercent),
    readinessReasons,
    readinessBlockers,
    entryTrigger,
    reason: `${series.profile.symbol} has a ${todayRangePercent.toFixed(2)}% intraday range, ${volumeRatio.toFixed(2)}x relative volume, and ${rewardRisk.toFixed(2)}x reward/risk to a 2% target. Setup is ${setup.toLowerCase()}: ${pullbackReversal ? `it pulled back ${pullbackFromHighPercent.toFixed(2)}% from the high into the middle of the day's range and remains constructive.` : `direction is ${direction.toLowerCase()} based on today's move and open-to-close action.`}`
  }];
}).sort((a, b) => b.readinessScore - a.readinessScore || b.score - a.score || b.todayRangePercent - a.todayRangePercent);
