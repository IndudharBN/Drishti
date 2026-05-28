import { Candle } from '../types';

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const sma = (values: number[], period: number): Array<number | null> =>
  values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });

export const ema = (values: number[], period: number): Array<number | null> => {
  const k = 2 / (period + 1);
  const result: Array<number | null> = [];
  let previous: number | null = null;
  values.forEach((value, index) => {
    if (index + 1 < period) {
      result.push(null);
      return;
    }
    if (previous === null) {
      previous = values.slice(index + 1 - period, index + 1).reduce((sum, item) => sum + item, 0) / period;
    } else {
      previous = value * k + previous * (1 - k);
    }
    result.push(previous);
  });
  return result;
};

export const atr = (candles: Candle[], period = 14): Array<number | null> => {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  return sma(trueRanges, period);
};

export const rsi = (values: number[], period = 14): Array<number | null> => {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
};

export const macd = (values: number[]) => {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const line = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return fast === null || slow === null ? null : fast - slow;
  });
  const compact = line.map((value) => value ?? 0);
  const signal = ema(compact, 9);
  const histogram = line.map((value, index) => {
    const sig = signal[index];
    return value === null || sig === null ? null : value - sig;
  });
  return { line, signal, histogram };
};

export const rateOfChange = (values: number[], period: number) => {
  if (values.length <= period) return 0;
  const current = values[values.length - 1];
  const past = values[values.length - 1 - period];
  return ((current - past) / past) * 100;
};

export const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export const highest = (values: number[], period: number) => Math.max(...values.slice(-period));

export const lowest = (values: number[], period: number) => Math.min(...values.slice(-period));

export const standardDeviation = (values: number[]) => {
  const avg = average(values);
  return Math.sqrt(average(values.map((value) => (value - avg) ** 2)));
};

export const getSupportResistance = (candles: Candle[]) => {
  const recent = candles.slice(-60);
  const closes = recent.map((candle) => candle.close);
  const support = Math.min(...recent.slice(-20).map((candle) => candle.low));
  const resistance = Math.max(...recent.slice(-40).map((candle) => candle.high));
  return {
    support: round2(support),
    resistance: round2(resistance),
    fiftyTwoWeekHigh: round2(Math.max(...candles.map((candle) => candle.high))),
    fiftyTwoWeekLow: round2(Math.min(...candles.map((candle) => candle.low))),
    recentHigh: round2(Math.max(...recent.map((candle) => candle.high))),
    recentLow: round2(Math.min(...recent.map((candle) => candle.low))),
    closeVolatility: standardDeviation(closes)
  };
};

export const trendSlope = (values: Array<number | null>, lookback = 5) => {
  const recent = values.filter((value): value is number => value !== null).slice(-lookback);
  if (recent.length < 2) return 0;
  return recent[recent.length - 1] - recent[0];
};
