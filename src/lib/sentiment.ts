import { RankedStock, StrategyId } from '../types';
import { clamp } from './format';
import { rateOfChange } from './indicators';

type SentimentTone = 'Bullish' | 'Positive' | 'Neutral' | 'Cautious' | 'Bearish';

export type SentimentDetail = {
  label: string;
  value: string;
  impact: 'Positive' | 'Neutral' | 'Negative';
};

export type SentimentAnalysis = {
  tone: SentimentTone;
  index: number;
  score: number;
  summary: string;
  details: SentimentDetail[];
};

const impactFor = (value: number, positiveThreshold: number, negativeThreshold: number): SentimentDetail['impact'] => {
  if (value >= positiveThreshold) return 'Positive';
  if (value <= negativeThreshold) return 'Negative';
  return 'Neutral';
};

const toneForIndex = (index: number): SentimentTone => {
  if (index >= 78) return 'Bullish';
  if (index >= 62) return 'Positive';
  if (index >= 45) return 'Neutral';
  if (index >= 30) return 'Cautious';
  return 'Bearish';
};

const strategyScoreFor = (stock: RankedStock, activeStrategy: StrategyId | 'all') => {
  if (activeStrategy === 'all') return stock.bestResult.score;
  return stock.results.find((item) => item.strategyId === activeStrategy)?.score ?? stock.bestResult.score;
};

export const analyzeSentiment = (stock: RankedStock, activeStrategy: StrategyId | 'all'): SentimentAnalysis => {
  const closes = stock.series.candles.map((candle) => candle.close);
  const volumes = stock.series.candles.map((candle) => candle.volume);
  const latestVolume = volumes.at(-1) ?? 0;
  const avgVolume20 = volumes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(volumes.slice(-20).length, 1);
  const volumeRatio = latestVolume / Math.max(avgVolume20, 1);
  const return5 = rateOfChange(closes, 5);
  const return20 = rateOfChange(closes, 20);
  const strategyScore = strategyScoreFor(stock, activeStrategy);

  const momentumComponent = clamp(50 + return20 * 2.2 + return5 * 1.2, 0, 100);
  const relativeComponent = clamp(50 + stock.series.spyRelative20 * 2.5 + stock.series.sectorRelative20 * 1.8, 0, 100);
  const volumeComponent = clamp(50 + (volumeRatio - 1) * 35, 0, 100);
  const setupComponent = clamp(strategyScore + stock.confluence * 3, 0, 100);
  const sectorComponent = clamp(50 + (stock.series.sectorReturn20 - stock.series.spyReturn20) * 2.4, 0, 100);

  const index = Math.round(
    momentumComponent * 0.26 +
    relativeComponent * 0.24 +
    volumeComponent * 0.16 +
    setupComponent * 0.22 +
    sectorComponent * 0.12
  );
  const score = Math.round((index - 50) * 2);
  const tone = toneForIndex(index);

  return {
    tone,
    index,
    score,
    summary: `${tone} sentiment from price momentum, relative strength, volume confirmation, sector support, and setup quality.`,
    details: [
      {
        label: 'Price momentum',
        value: `5d ${return5.toFixed(2)}%, 20d ${return20.toFixed(2)}%`,
        impact: impactFor(return20, 3, -3)
      },
      {
        label: 'Relative strength',
        value: `SPY ${stock.series.spyRelative20.toFixed(2)}%, sector ${stock.series.sectorRelative20.toFixed(2)}%`,
        impact: impactFor(stock.series.spyRelative20 + stock.series.sectorRelative20, 2, -2)
      },
      {
        label: 'Volume confirmation',
        value: `${volumeRatio.toFixed(2)}x 20-day average`,
        impact: impactFor(volumeRatio, 1.1, 0.8)
      },
      {
        label: 'Sector support',
        value: `${stock.series.sectorReturn20.toFixed(2)}% vs SPY ${stock.series.spyReturn20.toFixed(2)}%`,
        impact: impactFor(stock.series.sectorReturn20 - stock.series.spyReturn20, 1, -1)
      },
      {
        label: 'Setup quality',
        value: `${strategyScore}/100 score, ${stock.confluence} confirmations`,
        impact: impactFor(strategyScore, 70, 45)
      }
    ]
  };
};
