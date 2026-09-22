import { MarketSeries } from '../types';
import { average, ema, rsi, round2, standardDeviation } from './indicators';

export type BandBounceSignalType = 'Strong Buy' | '2% Bounce Setup';
export type BandBounceStrength = 'Strong' | 'Medium' | 'Weak';
export type BandBounceTimeframe = '5 min' | '15 min' | '1 hour' | 'Daily';

export type BandBounceRow = {
  symbol: string;
  company: string;
  price: number;
  signalType: BandBounceSignalType;
  strength: BandBounceStrength;
  score: number;
  bandPosition: string;
  emaTrend: 'Turning up' | 'Turning down' | 'Flat';
  wmaTrend: 'Turning up' | 'Turning down' | 'Flat';
  rsi: number;
  volumeStatus: 'High volume' | 'Normal volume' | 'Weak volume';
  volumeRatio: number;
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  rewardRisk: number;
  lastSignalTime: string;
  timeframe: BandBounceTimeframe;
  reason: string;
  lowerBand: number;
  middleBand: number;
  upperBand: number;
  bollingerPercentB: number;
  bollingerBandwidth: number;
  ema: number;
  wma: number;
  isSample?: boolean;
};

const last = <T>(values: T[]) => values[values.length - 1];
const previous = <T>(values: T[]) => values[values.length - 2];

const wma = (values: number[], period: number) => values.map((_, index) => {
  if (index + 1 < period) return null;
  const slice = values.slice(index + 1 - period, index + 1);
  const divisor = (period * (period + 1)) / 2;
  return slice.reduce((sum, value, itemIndex) => sum + value * (itemIndex + 1), 0) / divisor;
});

const direction = (current: number, prior: number): BandBounceRow['emaTrend'] => {
  if (current > prior * 1.001) return 'Turning up';
  if (current < prior * 0.999) return 'Turning down';
  return 'Flat';
};

const strengthFor = (score: number, rewardRisk: number, volumeRatio: number): BandBounceStrength => {
  if (score >= 85 && rewardRisk >= 2 && volumeRatio >= 1.2) return 'Strong';
  if (score >= 60) return 'Medium';
  return 'Weak';
};

export const scanBandBounces = (market: MarketSeries[]): BandBounceRow[] => market.flatMap((series) => {
  const candles = series.candles;
  if (candles.length < 30) return [];
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const current = last(candles);
  const prior = previous(candles);
  const recentCloses = closes.slice(-20);
  const middleBand = average(recentCloses);
  const deviation = standardDeviation(recentCloses);
  const lowerBand = middleBand - deviation * 2;
  const upperBand = middleBand + deviation * 2;
  const bollingerPercentB = (current.close - lowerBand) / Math.max(upperBand - lowerBand, 0.01);
  const bollingerBandwidth = ((upperBand - lowerBand) / Math.max(middleBand, 0.01)) * 100;
  const emaValues = ema(closes, 9).filter((value): value is number => value !== null);
  const wmaValues = wma(closes, 9).filter((value): value is number => value !== null);
  const rsiValue = last(rsi(closes, 14).filter((value): value is number => value !== null)) ?? 50;
  const emaTrend = direction(last(emaValues), previous(emaValues));
  const wmaTrend = direction(last(wmaValues), previous(wmaValues));
  const averageVolume = average(volumes.slice(-21, -1));
  const volumeRatio = current.volume / Math.max(averageVolume, 1);
  const volumeStatus: BandBounceRow['volumeStatus'] = volumeRatio >= 1.2 ? 'High volume' : volumeRatio < 0.8 ? 'Weak volume' : 'Normal volume';
  const lowerTouch = current.low <= lowerBand || prior.low <= lowerBand;
  const closeBackInside = current.close > lowerBand && current.close > current.open;
  const previousRsiValue = last(rsi(closes.slice(0, -1), 14).filter((value): value is number => value !== null)) ?? 50;
  const turningUp = emaTrend === 'Turning up' || wmaTrend === 'Turning up';
  const buyRsi = ((rsiValue >= 30 && rsiValue <= 55) || previousRsiValue < 30) && rsiValue > previousRsiValue;
  const volumeConfirmed = volumeRatio >= 1.1;
  const buy = lowerTouch && current.close > lowerBand && closeBackInside && turningUp && buyRsi;
  if (!buy) return [];

  const score =
    (lowerTouch ? 25 : 0) +
    (closeBackInside ? 25 : 0) +
    (turningUp ? 20 : 0) +
    (buyRsi ? 15 : 0) +
    (volumeConfirmed ? 15 : 0);
  const recentSwingLow = Math.min(...candles.slice(-10).map((candle) => candle.low));
  const entry = current.close;
  const stop = Math.min(recentSwingLow, lowerBand) * 0.995;
  const target1 = entry * 1.02;
  const target2 = upperBand;
  const risk = entry - stop;
  const rewardRisk = (target1 - entry) / Math.max(risk, 0.01);
  const hasTwoPercentRoom = target2 >= target1 && middleBand > entry * 1.005;
  const riskAcceptable = risk > 0 && rewardRisk >= 1.5;
  const qualifiedEntry = score >= 75 && hasTwoPercentRoom && riskAcceptable;
  if (!qualifiedEntry) return [];
  const signalType: BandBounceSignalType = score >= 85 && rewardRisk >= 2 && volumeRatio >= 1.2 ? 'Strong Buy' : '2% Bounce Setup';
  const bandPosition = `${current.low.toFixed(2)} touched lower band ${lowerBand.toFixed(2)}`;

  return [{
    symbol: series.profile.symbol,
    company: series.profile.company,
    price: round2(current.close),
    signalType,
    strength: strengthFor(score, rewardRisk, volumeRatio),
    score,
    bandPosition,
    emaTrend,
    wmaTrend,
    rsi: round2(rsiValue),
    volumeStatus,
    volumeRatio: round2(volumeRatio),
    entry: round2(entry),
    stop: round2(stop),
    target1: round2(target1),
    target2: round2(target2),
    rewardRisk: round2(rewardRisk),
    lastSignalTime: `${current.date} close`,
    timeframe: 'Daily' as const,
    reason: `2% Bollinger bounce entry: price touched the lower Bollinger Band and closed back inside it with a green confirmation candle. ${emaTrend === 'Turning up' ? 'EMA' : 'WMA'} is turning upward, RSI improved from ${previousRsiValue.toFixed(1)} to ${rsiValue.toFixed(1)}, volume is ${volumeRatio.toFixed(2)}x average, and the 2% target offers ${rewardRisk.toFixed(2)}x reward/risk.`,
    lowerBand: round2(lowerBand),
    middleBand: round2(middleBand),
    upperBand: round2(upperBand),
    bollingerPercentB: round2(bollingerPercentB),
    bollingerBandwidth: round2(bollingerBandwidth),
    ema: round2(last(emaValues)),
    wma: round2(last(wmaValues))
  }];
}).sort((a, b) => b.score - a.score || b.rewardRisk - a.rewardRisk);

export const sampleBandBounceRows: BandBounceRow[] = [
  {
    symbol: 'MSFT', company: 'Microsoft Corporation', price: 472.18, signalType: 'Strong Buy', strength: 'Strong', score: 90,
    bandPosition: '468.50 touched lower band 469.12', emaTrend: 'Turning up', wmaTrend: 'Turning up', rsi: 42.6,
    volumeStatus: 'High volume', volumeRatio: 1.46, entry: 472.18, stop: 467.79, target1: 481.62, target2: 491.8,
    rewardRisk: 2.15, lastSignalTime: 'Sample daily close', timeframe: 'Daily', reason: 'Sample row: price reclaimed the lower band with EMA/WMA confirmation, above-average volume, and enough room for a 2% target.',
    lowerBand: 469.12, middleBand: 480.2, upperBand: 491.8, bollingerPercentB: 0.13, bollingerBandwidth: 4.72, ema: 471.84, wma: 472.02, isSample: true
  },
  {
    symbol: 'AMD', company: 'Advanced Micro Devices, Inc.', price: 164.3, signalType: '2% Bounce Setup', strength: 'Medium', score: 75,
    bandPosition: '161.20 touched lower band 162.05', emaTrend: 'Flat', wmaTrend: 'Turning up', rsi: 38.4,
    volumeStatus: 'High volume', volumeRatio: 1.31, entry: 164.3, stop: 162.05, target1: 168.6, target2: 175.2,
    rewardRisk: 1.91, lastSignalTime: 'Sample daily close', timeframe: 'Daily', reason: 'Sample row: lower-band reclaim is present and WMA is improving; the first target has acceptable reward/risk but the setup is not strong.',
    lowerBand: 162.05, middleBand: 168.6, upperBand: 175.2, bollingerPercentB: 0.17, bollingerBandwidth: 7.8, ema: 164.22, wma: 164.44, isSample: true
  }
];
