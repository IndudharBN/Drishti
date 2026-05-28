import { describe, expect, it } from 'vitest';
import { atr, ema, rsi, sma } from '../lib/indicators';
import { defaultSettings, evaluateStrategies, rankStocks } from './strategyEngine';
import { MarketSeries } from '../types';

const fixtureCandles = Array.from({ length: 130 }, (_, index) => {
  const close = 100 + index * 0.45 + Math.sin(index / 4) * 2;
  return {
    date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    open: close - 0.5,
    high: close + 1.2,
    low: close - 1.4,
    close,
    volume: 2_000_000 + index * 1000
  };
});

const fixtureMarket: MarketSeries[] = [
  {
    profile: {
      symbol: 'TEST',
      company: 'Test Corp',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 10_000_000_000,
      avgVolume: 2_000_000,
      country: 'US',
      type: 'stock'
    },
    candles: fixtureCandles,
    spyRelative20: 4,
    sectorRelative20: 2,
    sectorReturn20: 3,
    spyReturn20: 1,
    dataSource: 'yahoo',
    lastUpdated: '2026-05-05T20:00:00Z'
  }
];

describe('indicators', () => {
  it('calculates SMA and EMA without changing input length', () => {
    const values = [1, 2, 3, 4, 5, 6];
    expect(sma(values, 3)).toHaveLength(values.length);
    expect(sma(values, 3).at(-1)).toBe(5);
    expect(ema(values, 3)).toHaveLength(values.length);
  });

  it('calculates ATR and RSI for candle data', () => {
    const candles = fixtureMarket[0].candles;
    expect(atr(candles, 14).at(-1)).toBeGreaterThan(0);
    expect(rsi(candles.map((candle) => candle.close), 14).at(-1)).toBeGreaterThan(0);
  });
});

describe('strategy engine', () => {
  it('returns all strategy models plus the pro trader model', () => {
    const results = evaluateStrategies(fixtureMarket[0], defaultSettings);
    expect(results).toHaveLength(15);
    expect(results.some((result) => result.strategyId === 'pro-trader')).toBe(true);
    expect(results.some((result) => result.strategyId === 'two-day-five-percent')).toBe(true);
    expect(results.some((result) => result.strategyId === 'bottom-reversal')).toBe(true);
    expect(results.some((result) => result.strategyId === 'support-hold-pullback')).toBe(true);
    expect(results.some((result) => result.strategyId === 'recent-gap-down')).toBe(true);
  });

  it('produces valid 5 percent target and risk values', () => {
    const result = evaluateStrategies(fixtureMarket[0], defaultSettings)[0];
    expect(result.target).toBeGreaterThan(result.entry);
    expect(result.stop).toBeLessThan(result.entry);
    expect(result.rewardRisk).toBeGreaterThan(0);
  });

  it('ranks stocks and preserves pro trader result', () => {
    const ranked = rankStocks(fixtureMarket, defaultSettings);
    expect(ranked.length).toBe(1);
    expect(ranked[0].proResult.strategyId).toBe('pro-trader');
  });
});
