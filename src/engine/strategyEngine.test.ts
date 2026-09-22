import { describe, expect, it } from 'vitest';
import { atr, ema, rsi, sma } from '../lib/indicators';
import { defaultSettings, evaluateStrategies, rankStocks } from './strategyEngine';
import { Candle, MarketSeries } from '../types';
import { scanVolatileStocks } from '../lib/volatileStocks';
import { scanRangeBoundStocks } from '../lib/rangeBoundScanner';
import { scanPennyStocks } from '../lib/pennyStockScanner';
import { scanRunnerRadar } from '../lib/runnerRadar';

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

const marketFromCandles = (candles: Candle[], overrides: Partial<MarketSeries['profile']> = {}): MarketSeries => ({
  ...fixtureMarket[0],
  profile: {
    ...fixtureMarket[0].profile,
    symbol: overrides.symbol ?? 'CASE',
    company: overrides.company ?? 'Case Corp',
    marketCap: overrides.marketCap ?? 20_000_000_000,
    avgVolume: overrides.avgVolume ?? 2_500_000,
    nextEarningsDate: overrides.nextEarningsDate,
    nextEarningsTiming: overrides.nextEarningsTiming
  },
  candles,
  spyRelative20: -4,
  sectorRelative20: -4,
  sectorReturn20: -2,
  spyReturn20: 1
});

const datedCandles = (count: number, price = 100): Candle[] => Array.from({ length: count }, (_, index) => ({
  date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
  open: price - 0.3,
  high: price + 1,
  low: price - 1,
  close: price,
  volume: 1_000_000
}));

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
    expect(results).toHaveLength(23);
    expect(results.some((result) => result.strategyId === 'pro-trader')).toBe(true);
    expect(results.some((result) => result.strategyId === 'two-percent-vwap-momentum')).toBe(true);
    expect(results.some((result) => result.strategyId === 'two-day-five-percent')).toBe(true);
    expect(results.some((result) => result.strategyId === 'results-gap-down-recovery')).toBe(true);
    expect(results.some((result) => result.strategyId === 'today-fifteen-percent-down')).toBe(true);
    expect(results.some((result) => result.strategyId === 'today-five-percent-down')).toBe(true);
    expect(results.some((result) => result.strategyId === 'today-ten-percent-down')).toBe(true);
    expect(results.some((result) => result.strategyId === 'today-twenty-percent-down')).toBe(true);
    expect(results.some((result) => result.strategyId === 'earnings-next-three-days')).toBe(true);
    expect(results.some((result) => result.strategyId === 'bottom-reversal')).toBe(true);
    expect(results.some((result) => result.strategyId === 'support-hold-pullback')).toBe(true);
    expect(results.some((result) => result.strategyId === 'sideways-base-ready')).toBe(true);
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

  it('flags stocks reporting earnings within the next three days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const marketWithEarnings: MarketSeries = {
      ...fixtureMarket[0],
      profile: {
        ...fixtureMarket[0].profile,
        nextEarningsDate: today,
        nextEarningsTiming: 'time-after-hours'
      }
    };
    const result = evaluateStrategies(marketWithEarnings, defaultSettings)
      .find((item) => item.strategyId === 'earnings-next-three-days');
    expect(result?.eventDate).toBe(today);
    expect(result?.eventDaysAgo).toBe(0);
  });

  it('does not let past earnings dates block normal strategies', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const marketWithPastEarnings: MarketSeries = {
      ...fixtureMarket[0],
      profile: {
        ...fixtureMarket[0].profile,
        nextEarningsDate: yesterday,
        nextEarningsTiming: 'time-after-hours'
      }
    };

    const blockers = evaluateStrategies(marketWithPastEarnings, defaultSettings)
      .flatMap((result) => result.blockers);

    expect(blockers).not.toContain('Earnings are too close for non-earnings setups.');
  });

  it('applies today-down thresholds to only the latest daily move', () => {
    const candles = datedCandles(130, 100);
    candles[candles.length - 2] = {
      date: '2026-04-17',
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1_000_000
    };
    candles[candles.length - 1] = {
      date: '2026-04-18',
      open: 84,
      high: 86,
      low: 80,
      close: 85.1,
      volume: 4_000_000
    };

    const firstResults = evaluateStrategies(marketFromCandles(candles), defaultSettings);
    expect(firstResults.find((result) => result.strategyId === 'today-ten-percent-down')?.blockers).not.toContain('Required gate failed: stock is not down more than 10% today.');
    expect(firstResults.find((result) => result.strategyId === 'today-fifteen-percent-down')?.blockers).toContain('Required gate failed: stock is not down more than 15% today.');

    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      close: 84.9
    };

    const secondResults = evaluateStrategies(marketFromCandles(candles), defaultSettings);
    expect(secondResults.find((result) => result.strategyId === 'today-fifteen-percent-down')?.blockers).not.toContain('Required gate failed: stock is not down more than 15% today.');
    expect(secondResults.find((result) => result.strategyId === 'today-twenty-percent-down')?.blockers).toContain('Required gate failed: stock is not down more than 20% today.');
  });

  it('requires results gap-down recovery candidates to reclaim the gap-day open', () => {
    const candles = datedCandles(130, 100);
    const gapIndex = candles.length - 6;
    candles[gapIndex - 1] = {
      ...candles[gapIndex - 1],
      close: 100,
      volume: 1_000_000
    };
    candles[gapIndex] = {
      date: '2026-04-13',
      open: 88,
      high: 90,
      low: 85,
      close: 86,
      volume: 3_000_000
    };
    for (let index = gapIndex + 1; index < candles.length; index += 1) {
      candles[index] = {
        date: `2026-04-${String(13 + index - gapIndex).padStart(2, '0')}`,
        open: 86.5,
        high: 88,
        low: 85.5,
        close: 87,
        volume: 1_500_000
      };
    }

    const unreclaimed = evaluateStrategies(marketFromCandles(candles), defaultSettings)
      .find((result) => result.strategyId === 'results-gap-down-recovery');
    expect(unreclaimed?.blockers).toContain('Required gate failed: stock has not reclaimed the gap-day open yet.');

    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      high: 91,
      close: 89
    };

    const reclaimed = evaluateStrategies(marketFromCandles(candles), defaultSettings)
      .find((result) => result.strategyId === 'results-gap-down-recovery');
    expect(reclaimed?.blockers).not.toContain('Required gate failed: stock has not reclaimed the gap-day open yet.');
  });
});

describe('most volatile readiness scanner', () => {
  it('marks liquid bullish pullbacks as entry setups', () => {
    const candles = Array.from({ length: 30 }, (_, index) => {
      const close = 95 + index * 0.1;
      return {
        date: `2026-02-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.2,
        high: close + 0.8,
        low: close - 0.8,
        close,
        volume: 1_000_000
      };
    });
    candles[candles.length - 2] = {
      date: '2026-02-27',
      open: 98,
      high: 100,
      low: 97,
      close: 100,
      volume: 1_000_000
    };
    candles[candles.length - 1] = {
      date: '2026-02-28',
      open: 101,
      high: 104,
      low: 100,
      close: 102.8,
      volume: 2_400_000
    };
    const rows = scanVolatileStocks([{
      ...fixtureMarket[0],
      candles,
      profile: {
        ...fixtureMarket[0].profile,
        symbol: 'READY',
        avgVolume: 2_500_000,
        marketCap: 25_000_000_000
      }
    }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].readiness).toBe('Entry Setup');
    expect(rows[0].readinessScore).toBeGreaterThanOrEqual(78);
    expect(rows[0].entryTrigger).toContain('Stop near');
  });
});

describe('range bound scanner', () => {
  it('finds liquid sideways shares with repeated support and resistance touches', () => {
    const candles = Array.from({ length: 90 }, (_, index) => {
      const cycle = index % 18;
      const close = cycle < 9 ? 100 + cycle * 0.55 : 105 - (cycle - 9) * 0.55;
      return {
        date: `2026-03-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.15,
        high: close + 0.7,
        low: close - 0.7,
        close,
        volume: 2_000_000
      };
    });
    const rows = scanRangeBoundStocks([{
      ...fixtureMarket[0],
      candles,
      profile: {
        ...fixtureMarket[0].profile,
        symbol: 'RANGE',
        avgVolume: 2_000_000,
        marketCap: 20_000_000_000
      }
    }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].supportTouches).toBeGreaterThanOrEqual(2);
    expect(rows[0].resistanceTouches).toBeGreaterThanOrEqual(2);
    expect(rows[0].rangeWidthPercent).toBeGreaterThan(4);
  });

  it('separates exact support entries from broader bottom-zone names', () => {
    const candles = Array.from({ length: 90 }, (_, index) => {
      const cycle = index % 18;
      const close = cycle < 9 ? 100 + cycle * 0.55 : 105 - (cycle - 9) * 0.55;
      return {
        date: `2026-03-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.15,
        high: close + 0.7,
        low: close - 0.7,
        close,
        volume: 2_000_000
      };
    });

    candles[candles.length - 1] = {
      date: '2026-03-28',
      open: 100.2,
      high: 101,
      low: 99.7,
      close: 100.4,
      volume: 2_200_000
    };

    const atSupport = scanRangeBoundStocks([{
      ...fixtureMarket[0],
      candles,
      profile: {
        ...fixtureMarket[0].profile,
        symbol: 'SUPPORT',
        avgVolume: 2_000_000,
        marketCap: 20_000_000_000
      }
    }]);

    expect(atSupport).toHaveLength(1);
    expect(atSupport[0].position).toBe('At Support');
    expect(Math.abs(atSupport[0].distanceFromSupportPercent)).toBeLessThanOrEqual(1.2);

    candles[candles.length - 1] = {
      ...candles[candles.length - 1],
      open: 100.9,
      high: 101.6,
      low: 100.7,
      close: 101.2
    };

    const bounced = scanRangeBoundStocks([{
      ...fixtureMarket[0],
      candles,
      profile: {
        ...fixtureMarket[0].profile,
        symbol: 'BOUNCED',
        avgVolume: 2_000_000,
        marketCap: 20_000_000_000
      }
    }]);

    expect(bounced).toHaveLength(1);
    expect(bounced[0].position).toBe('Bottom Zone');
    expect(bounced[0].distanceFromSupportPercent).toBeGreaterThan(1.2);
  });
});

describe('penny stock scanner', () => {
  it('finds liquid penny stocks near support with 5 to 10 percent upside room', () => {
    const candles = Array.from({ length: 130 }, (_, index) => {
      const cycle = index % 20;
      const close = cycle < 10 ? 2.95 + cycle * 0.055 : 3.5 - (cycle - 10) * 0.055;
      return {
        date: `2026-05-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.02,
        high: close + 0.45,
        low: close - 0.08,
        close,
        volume: 2_000_000
      };
    });
    candles[candles.length - 1] = {
      date: '2026-05-18',
      open: 3.02,
      high: 3.11,
      low: 2.95,
      close: 3.08,
      volume: 2_800_000
    };

    const rows = scanPennyStocks([marketFromCandles(candles, {
      symbol: 'PENNY',
      marketCap: 550_000_000,
      avgVolume: 2_200_000
    })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBeLessThanOrEqual(5);
    expect(rows[0].position).toBe('Bottom Zone');
    expect(rows[0].distanceFromLowPercent).toBeLessThanOrEqual(12);
    expect(rows[0].upsideToResistancePercent).toBeGreaterThanOrEqual(8);
    expect(rows[0].target5).toBeGreaterThan(rows[0].price);
    expect(rows[0].target10).toBeGreaterThan(rows[0].price);
  });

  it('marks penny stocks that already rallied from support as wait-pullback names', () => {
    const candles = Array.from({ length: 130 }, (_, index) => {
      const cycle = index % 20;
      const close = cycle < 10 ? 2.95 + cycle * 0.055 : 3.5 - (cycle - 10) * 0.055;
      return {
        date: `2026-05-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.02,
        high: close + 0.45,
        low: close - 0.08,
        close,
        volume: 2_000_000
      };
    });
    candles[candles.length - 1] = {
      date: '2026-05-18',
      open: 3.65,
      high: 3.78,
      low: 3.58,
      close: 3.72,
      volume: 2_800_000
    };

    const rows = scanPennyStocks([marketFromCandles(candles, {
      symbol: 'CHASE',
      marketCap: 550_000_000,
      avgVolume: 2_200_000
    })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].position).toBe('Wait Pullback');
    expect(rows[0].entryTrigger).toContain('Do not chase');
  });

  it('excludes penny stocks with bankruptcy-style distress proxies', () => {
    const candles = Array.from({ length: 130 }, (_, index) => {
      const close = 5 - index * 0.03;
      return {
        date: `2026-06-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close + 0.02,
        high: close + 0.05,
        low: close - 0.08,
        close,
        volume: 300_000
      };
    });

    const rows = scanPennyStocks([marketFromCandles(candles, {
      symbol: 'WEAK',
      marketCap: 35_000_000,
      avgVolume: 300_000
    })]);

    expect(rows).toHaveLength(0);
  });
});

describe('ai runner radar', () => {
  it('shortlists only the strongest high-risk runner candidates', () => {
    const makeRunner = (symbol: string, move: number, volume: number) => {
      const candles = Array.from({ length: 50 }, (_, index) => {
        const close = 4 + index * 0.02;
        return {
          date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
          open: close - 0.04,
          high: close + 0.08,
          low: close - 0.08,
          close,
          volume: 1_000_000
        };
      });
      const previous = candles[candles.length - 2].close;
      const close = previous * (1 + move / 100);
      candles[candles.length - 1] = {
        date: '2026-07-28',
        open: previous * 1.03,
        high: close * 1.04,
        low: previous * 0.98,
        close,
        volume
      };
      return marketFromCandles(candles, {
        symbol,
        marketCap: 650_000_000,
        avgVolume: 1_000_000
      });
    };

    const rows = scanRunnerRadar([
      makeRunner('RUN1', 18, 6_000_000),
      makeRunner('RUN2', 14, 5_000_000),
      makeRunner('RUN3', 12, 4_500_000),
      makeRunner('RUN4', 10, 4_000_000),
      makeRunner('RUN5', 8, 3_500_000),
      makeRunner('RUN6', 7, 3_000_000)
    ]);

    expect(rows).toHaveLength(5);
    expect(rows[0].runnerScore).toBeGreaterThanOrEqual(rows[1].runnerScore);
    expect(rows.every((row) => row.risk === 'Extreme' || row.risk === 'Very High')).toBe(true);
  });

  it('does not show ordinary stocks without abnormal movement or volume', () => {
    const candles = Array.from({ length: 50 }, (_, index) => {
      const close = 20 + index * 0.05;
      return {
        date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
        open: close - 0.05,
        high: close + 0.1,
        low: close - 0.1,
        close,
        volume: 1_000_000
      };
    });

    const rows = scanRunnerRadar([marketFromCandles(candles, {
      symbol: 'CALM',
      marketCap: 2_000_000_000,
      avgVolume: 1_000_000
    })]);

    expect(rows).toHaveLength(0);
  });
});
