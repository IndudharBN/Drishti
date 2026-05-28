import { AppSettings, Candle, MarketSeries, RankedStock, StrategyCheck, StrategyId, StrategyResult } from '../types';
import { atr, average, getSupportResistance, highest, lowest, macd, rateOfChange, round2, rsi, sma, standardDeviation, trendSlope } from '../lib/indicators';
import { clamp } from '../lib/format';

export const defaultSettings: AppSettings = {
  minMarketCap: 2_000_000_000,
  minPrice: 10,
  minAverageVolume: 1_000_000,
  minDollarVolume: 25_000_000,
  targetPercent: 5,
  maxRiskPercent: 3,
  minRewardRisk: 1.5
};

export const strategyNames: Record<StrategyId, string> = {
  'breakout-momentum': 'Breakout Momentum',
  'pullback-uptrend': 'Pullback in Uptrend',
  'relative-strength-leader': 'Relative Strength Leader',
  'oversold-bounce': 'Oversold Bounce',
  'earnings-drift': 'Earnings Momentum',
  'volume-squeeze': 'Volume Squeeze',
  'sector-rotation': 'Sector Rotation',
  'fifty-two-week-high': '52-Week High Continuation',
  'gap-fill-reversal': 'Gap Fill Reversal',
  'recent-gap-down': 'Recent Gap Down 5%+',
  'moving-average-reclaim': 'Moving Average Reclaim',
  'bottom-reversal': 'Bottom Reversal',
  'support-hold-pullback': 'Support Hold Pullback',
  'two-day-five-percent': '2-Day 5% Forecast',
  'pro-trader': 'Pro Trader Master Strategy'
};

const last = <T>(values: T[]) => values[values.length - 1];
const prev = <T>(values: T[], offset = 1) => values[values.length - 1 - offset];

const scoreBool = (condition: boolean, points: number) => (condition ? points : 0);
const volumeRatioScore = (ratio: number) => (ratio - 1) * 18;

const daysUntil = (iso?: string) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const today = new Date('2026-05-05T00:00:00Z').getTime();
  return (new Date(`${iso}T00:00:00Z`).getTime() - today) / 86400000;
};

const baseContext = (series: MarketSeries, settings: AppSettings) => {
  const closes = series.candles.map((candle) => candle.close);
  const volumes = series.candles.map((candle) => candle.volume);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 120);
  const atr14 = atr(series.candles, 14);
  const rsi14 = rsi(closes, 14);
  const macdData = macd(closes);
  const sr = getSupportResistance(series.candles);
  const candle = last(series.candles);
  const previous = prev(series.candles);
  const currentAtr = last(atr14) ?? candle.close * 0.025;
  const avgVolume20 = average(volumes.slice(-20));
  const dollarVolume = candle.close * series.profile.avgVolume;
  const entry = candle.close;
  const target = entry * (1 + settings.targetPercent / 100);
  const supportStop = Math.min(sr.support * 0.995, entry - currentAtr * 1.25);
  const stop = Math.max(entry * (1 - settings.maxRiskPercent / 100), supportStop);
  const riskPercent = ((entry - stop) / entry) * 100;
  const rewardRisk = settings.targetPercent / Math.max(riskPercent, 0.1);
  const blockers: string[] = [];
  if (series.profile.marketCap < settings.minMarketCap) blockers.push('Market cap below configured minimum.');
  if (entry < settings.minPrice) blockers.push('Price below configured minimum.');
  if (series.profile.avgVolume < settings.minAverageVolume) blockers.push('Average volume below configured minimum.');
  if (dollarVolume < settings.minDollarVolume) blockers.push('Dollar volume below configured minimum.');
  if (daysUntil(series.profile.nextEarningsDate) <= 3) blockers.push('Earnings are too close for non-earnings setups.');
  if (riskPercent > settings.maxRiskPercent + 0.1) blockers.push('Stop distance is wider than the max risk setting.');
  if (rewardRisk < settings.minRewardRisk) blockers.push('Reward/risk is below the minimum setting.');
  return {
    closes,
    volumes,
    sma20,
    sma50,
    sma200,
    atr14,
    rsi14,
    macdData,
    sr,
    candle,
    previous,
    currentAtr,
    avgVolume20,
    dollarVolume,
    entry,
    target,
    stop,
    riskPercent,
    rewardRisk,
    blockers,
    above20: candle.close > (last(sma20) ?? 0),
    above50: candle.close > (last(sma50) ?? 0),
    above200: candle.close > (last(sma200) ?? 0),
    sma20Up: trendSlope(sma20) > 0,
    sma50Up: trendSlope(sma50) > 0,
    currentRsi: last(rsi14) ?? 50,
    macdImproving: (last(macdData.histogram) ?? 0) > (prev(macdData.histogram, 1) ?? -1),
    volumeRatio: candle.volume / Math.max(avgVolume20, 1),
    return5: rateOfChange(closes, 5),
    return20: rateOfChange(closes, 20)
  };
};

const makeResult = (
  strategyId: StrategyId,
  rawScore: number,
  ctx: ReturnType<typeof baseContext>,
  reasons: string[],
  setupBlockers: string[] = [],
  options?: {
    allowNearEarnings?: boolean;
    ignoreRiskBlockers?: boolean;
    strictBlockers?: boolean;
    checks?: StrategyCheck[];
    eventDate?: string;
    eventDaysAgo?: number;
    eventPercent?: number;
  }
): StrategyResult => {
  const blockers = [
    ...ctx.blockers.filter((blocker) => {
      if (options?.allowNearEarnings && blocker.includes('Earnings are too close')) return false;
      if (options?.ignoreRiskBlockers && (blocker.includes('Stop distance') || blocker.includes('Reward/risk'))) return false;
      return true;
    }),
    ...setupBlockers
  ];
  const score = Math.round(clamp(rawScore - blockers.length * 8, 0, 100));
  const status = blockers.length > 0 ? (score >= 70 ? 'watch' : 'failed') : score >= 80 ? 'triggered' : score >= 65 ? 'watch' : 'wait';
  return {
    strategyId,
    strategyName: strategyNames[strategyId],
    score,
    entry: round2(ctx.entry),
    target: round2(ctx.target),
    stop: round2(ctx.stop),
    riskPercent: round2(ctx.riskPercent),
    rewardRisk: round2(ctx.rewardRisk),
    status,
    reasons,
    blockers,
    checks: options?.checks,
    eventDate: options?.eventDate,
    eventDaysAgo: options?.eventDaysAgo,
    eventPercent: options?.eventPercent
  };
};

const check = (label: string, required: string, actual: string, passed: boolean, points: number): StrategyCheck => ({
  label,
  required,
  actual,
  passed,
  points
});

export const evaluateStrategies = (series: MarketSeries, settings: AppSettings = defaultSettings): StrategyResult[] => {
  const ctx = baseContext(series, settings);
  const last20High = highest(ctx.closes.slice(0, -1), 20);
  const last10High = highest(ctx.closes.slice(0, -1), 10);
  const last10Low = lowest(ctx.closes, 10);
  const recentRange = (highest(ctx.closes, 10) - lowest(ctx.closes, 10)) / ctx.entry * 100;
  const nearHigh = ((ctx.sr.fiftyTwoWeekHigh - ctx.entry) / ctx.entry) * 100;
  const gapDown = ctx.previous && ctx.candle.open < ctx.previous.low * 0.97;
  const recentGapEvents = series.candles
    .map((candle, index) => {
      const prior = series.candles[index - 1];
      if (!prior) return null;
      return {
        candle,
        daysAgo: series.candles.length - 1 - index,
        gapPercent: ((candle.open - prior.close) / prior.close) * 100,
        priorClose: prior.close
      };
    })
    .filter((event): event is { candle: Candle; daysAgo: number; gapPercent: number; priorClose: number } => Boolean(event))
    .filter((event) => event.daysAgo <= 2 && event.gapPercent <= -5)
    .sort((a, b) => a.daysAgo - b.daysAgo || a.gapPercent - b.gapPercent);
  const recentGapEvent = recentGapEvents[0];
  const recentGapDown = Boolean(recentGapEvent);
  const recentGapReclaim = recentGapEvent ? ctx.entry >= recentGapEvent.candle.open : false;
  const recentGapHeldLow = recentGapEvent ? series.candles.slice(series.candles.length - 1 - recentGapEvent.daysAgo).every((candle) => candle.close >= recentGapEvent.candle.low * 0.98) : false;
  const reclaimed50 = ctx.previous.close < (prev(ctx.sma50) ?? ctx.previous.close) && ctx.candle.close > (last(ctx.sma50) ?? ctx.candle.close + 1);
  const recentPriceLow = lowest(ctx.closes, 20);
  const priorPriceLow = lowest(ctx.closes.slice(0, -8), 20);
  const recentRsiValues = ctx.rsi14.filter((value): value is number => value !== null);
  const recentRsiLow = lowest(recentRsiValues, Math.min(20, recentRsiValues.length));
  const priorRsiLow = lowest(recentRsiValues.slice(0, -8), Math.min(20, Math.max(recentRsiValues.length - 8, 1)));
  const bullishDivergence = recentPriceLow <= priorPriceLow * 1.01 && recentRsiLow > priorRsiLow + 1.5;
  const close20 = ctx.closes.slice(-20);
  const bbMid = average(close20);
  const bbDev = standardDeviation(close20);
  const lowerBand = bbMid - bbDev * 2;
  const previousBelowLowerBand = ctx.previous.close < lowerBand;
  const reclaimedLowerBand = previousBelowLowerBand && ctx.candle.close > lowerBand;
  const capitulationVolume = Math.max(...ctx.volumes.slice(-8)) / Math.max(ctx.avgVolume20, 1);
  const hammerLike = (ctx.candle.close > ctx.candle.open) && ((Math.min(ctx.candle.open, ctx.candle.close) - ctx.candle.low) > (ctx.candle.high - ctx.candle.low) * 0.45);
  const bullishEngulf = ctx.candle.close > ctx.previous.open && ctx.candle.open < ctx.previous.close && ctx.candle.close > ctx.candle.open;
  const reversalConfirmed = ctx.candle.close > ctx.previous.high || hammerLike || bullishEngulf;
  const nearMajorBottomZone = ctx.entry <= ctx.sr.recentLow * 1.04 || ctx.entry <= ctx.sr.fiftyTwoWeekLow * 1.08 || ctx.entry <= ctx.sr.support * 1.025;
  const exhaustionSignal = bullishDivergence || capitulationVolume >= 1.8 || reclaimedLowerBand || ctx.currentRsi <= 35;
  const previousRsi = prev(ctx.rsi14, 1) ?? ctx.currentRsi;
  const rsiTurningUp = ctx.currentRsi > previousRsi;
  const oversoldPriorQuality = ctx.above200 || ctx.entry >= (last(ctx.sma200) ?? ctx.entry) * 0.97;
  const oversoldDepth = ctx.currentRsi >= 25 && ctx.currentRsi <= 42 && (ctx.return5 <= -4 || rateOfChange(ctx.closes, 10) <= -6);
  const oversoldSupport = ctx.entry <= ctx.sr.support * 1.025 || ctx.entry <= ctx.sr.recentLow * 1.04 || reclaimedLowerBand;
  const oversoldConfirmation = ctx.candle.close > ctx.previous.high || bullishEngulf || hammerLike || (reclaimedLowerBand && rsiTurningUp);
  const oversoldRiskOk = ctx.rewardRisk >= settings.minRewardRisk && ctx.riskPercent <= settings.maxRiskPercent;
  const results: StrategyResult[] = [];
  const breakoutZone = ctx.entry >= last20High * 0.995;
  const healthyBreakoutRsi = ctx.currentRsi >= 50 && ctx.currentRsi <= 76;
  const enoughVolume = ctx.volumeRatio >= 0.95;
  const pullbackNearMa = ctx.entry <= (last(ctx.sma20) ?? ctx.entry) * 1.04 || ctx.entry <= (last(ctx.sma50) ?? ctx.entry) * 1.035;
  const pullbackHeld = ctx.entry > last10Low * 1.005 || reversalConfirmed;
  const movingAverageReclaim = reclaimed50 || ctx.candle.close > (last(ctx.sma20) ?? ctx.candle.close + 1) || (ctx.previous.close < (prev(ctx.sma20) ?? ctx.previous.close) && ctx.candle.close > (last(ctx.sma20) ?? ctx.candle.close));
  const sma20Value = last(ctx.sma20) ?? ctx.entry;
  const sma50Value = last(ctx.sma50) ?? ctx.entry;
  const sma200Value = last(ctx.sma200) ?? ctx.entry;
  const supportCandidates = [ctx.sr.support, ctx.sr.recentLow, sma20Value, sma50Value]
    .filter((value) => Number.isFinite(value) && value > 0 && value <= ctx.entry * 1.005);
  const supportLevel = supportCandidates.length > 0 ? Math.max(...supportCandidates) : ctx.sr.support;
  const pctAboveSupport = ((ctx.entry - supportLevel) / ctx.entry) * 100;
  const recentFive = series.candles.slice(-5);
  const recentThree = series.candles.slice(-3);
  const downCloses5 = recentFive.filter((candle, index) => index > 0 && candle.close < recentFive[index - 1].close).length;
  const closesBelowSupport3 = recentThree.filter((candle) => candle.close < supportLevel * 0.995).length;
  const lastThreeRedVolumes = recentThree.filter((candle) => candle.close < candle.open).map((candle) => candle.volume);
  const redVolumeFading = lastThreeRedVolumes.length < 2 || lastThreeRedVolumes[lastThreeRedVolumes.length - 1] <= lastThreeRedVolumes[0] * 1.1;
  const supportHoldTrendOk = ctx.above200 || ctx.entry >= sma200Value * 0.97;
  const supportHoldCorrection = ctx.return5 <= -2 && ctx.return5 >= -10 && downCloses5 >= 2;
  const supportHoldNearSupport = pctAboveSupport >= -0.5 && pctAboveSupport <= 4;
  const supportHeld = closesBelowSupport3 === 0;
  const supportHoldVolumeOk = ctx.volumeRatio <= 1.25 || redVolumeFading;
  const supportHoldBounce = ctx.candle.close > ctx.previous.high || hammerLike || bullishEngulf || (rsiTurningUp && ctx.currentRsi >= 38 && ctx.currentRsi <= 58);
  const supportHoldRiskOk = ctx.rewardRisk >= settings.minRewardRisk && ctx.riskPercent <= settings.maxRiskPercent;
  const twoDayWindows = series.candles.slice(0, -2).map((candle, index) => ((series.candles[index + 2].close - candle.close) / candle.close) * 100);
  const recentTwoDayWindows = twoDayWindows.slice(-40);
  const twoDayBurstRate = twoDayWindows.filter((value) => value >= settings.targetPercent).length / Math.max(twoDayWindows.length, 1);
  const recentTwoDayBurstRate = recentTwoDayWindows.filter((value) => value >= settings.targetPercent).length / Math.max(recentTwoDayWindows.length, 1);
  const currentTwoDayReturn = rateOfChange(ctx.closes, 2);
  const atrPercent = (ctx.currentAtr / ctx.entry) * 100;
  const twoDayVolatilityCapacity = atrPercent * Math.sqrt(2);
  const priceAcceleration = ctx.return5 > rateOfChange(ctx.closes, 10) / 2;
  const twoDayForecastProbability = clamp(
    twoDayBurstRate * 100 +
    recentTwoDayBurstRate * 60 +
    Math.max(ctx.return5, 0) * 1.8 +
    Math.max(series.spyRelative20, 0) * 1.2 +
    Math.max(series.sectorRelative20, 0) +
    Math.max(volumeRatioScore(ctx.volumeRatio), 0),
    0,
    100
  );

  const breakoutChecks = [
    check('Trend position', 'Price above 20-day and 50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, ctx.above20 && ctx.above50, 28),
    check('20-day trend', '20-day MA rising', `${trendSlope(ctx.sma20).toFixed(2)} slope`, ctx.sma20Up, 10),
    check('Momentum RSI', 'RSI 50-76', ctx.currentRsi.toFixed(1), healthyBreakoutRsi, 16),
    check('MACD momentum', 'MACD histogram improving', `${(last(ctx.macdData.histogram) ?? 0).toFixed(2)} vs prior ${(prev(ctx.macdData.histogram, 1) ?? 0).toFixed(2)}`, ctx.macdImproving, 12),
    check('Volume', 'At least 0.95x average volume', `${ctx.volumeRatio.toFixed(2)}x`, enoughVolume, 14),
    check('Breakout zone', 'Price within 0.5% of 20-day high or above', `${ctx.entry.toFixed(2)} vs 20d high ${last20High.toFixed(2)}`, breakoutZone, 20)
  ];
  results.push(makeResult(
    'breakout-momentum',
    breakoutChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Price is judged against a recent breakout level.', 'Momentum, trend, and volume are all scored before accepting a 5% target.'],
    [
      ...(!ctx.above20 || !ctx.above50 ? ['Required gate failed: price is not above both 20-day and 50-day moving averages.'] : []),
      ...(!ctx.sma20Up ? ['Required gate failed: 20-day moving average is not rising.'] : []),
      ...(!healthyBreakoutRsi ? ['Required gate failed: RSI is not in the healthy breakout momentum zone.'] : []),
      ...(!enoughVolume ? ['Required gate failed: volume is below average for a breakout setup.'] : []),
      ...(!breakoutZone ? ['Required gate failed: price is not in the 20-day breakout zone.'] : [])
    ],
    { checks: breakoutChecks }
  ));

  const pullbackChecks = [
    check('Uptrend', 'Price above rising 50-day MA', `${ctx.entry.toFixed(2)} vs MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}, slope ${trendSlope(ctx.sma50).toFixed(2)}`, ctx.above50 && ctx.sma50Up, 34),
    check('RSI cooled', 'RSI 43-60', ctx.currentRsi.toFixed(1), ctx.currentRsi >= 43 && ctx.currentRsi <= 60, 16),
    check('Near moving average', 'Near 20-day/50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, pullbackNearMa, 14),
    check('Held pullback low', 'Above recent low or reversal confirmed', `${ctx.entry.toFixed(2)} vs 10d low ${last10Low.toFixed(2)}`, pullbackHeld, 12),
    check('Calm volume', 'Volume <= 1.35x average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio <= 1.35, 12),
    check('Momentum improving', 'MACD histogram improving', `${(last(ctx.macdData.histogram) ?? 0).toFixed(2)} vs prior ${(prev(ctx.macdData.histogram, 1) ?? 0).toFixed(2)}`, ctx.macdImproving, 12)
  ];
  results.push(makeResult(
    'pullback-uptrend',
    pullbackChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Looks for a controlled pullback in an existing uptrend.', 'Prefers RSI cooled into a healthier entry zone and calmer pullback volume.'],
    [
      ...(!ctx.above50 || !ctx.sma50Up ? ['Required gate failed: price is not in a rising 50-day uptrend.'] : []),
      ...(ctx.currentRsi < 43 || ctx.currentRsi > 60 ? ['Required gate failed: RSI is not cooled into the pullback zone.'] : []),
      ...(!pullbackNearMa ? ['Required gate failed: price is not close enough to the 20-day or 50-day moving average.'] : []),
      ...(!pullbackHeld ? ['Required gate failed: price has not held above the recent pullback low or confirmed reversal.'] : []),
      ...(ctx.volumeRatio > 1.35 ? ['Required gate failed: pullback volume is too heavy.'] : []),
      ...(!ctx.macdImproving ? ['Required gate failed: momentum is not improving.'] : [])
    ],
    { checks: pullbackChecks }
  ));

  const relativeStrengthChecks = [
    check('Stock vs SPY', 'Outperform SPY by > 2% over 20d', `${series.spyRelative20.toFixed(2)}%`, series.spyRelative20 > 2, 24),
    check('Stock vs sector', 'Outperform sector by > 1% over 20d', `${series.sectorRelative20.toFixed(2)}%`, series.sectorRelative20 > 1, 20),
    check('Sector vs SPY', 'Sector return > SPY return', `${series.sectorReturn20.toFixed(2)}% vs SPY ${series.spyReturn20.toFixed(2)}%`, series.sectorReturn20 > series.spyReturn20, 16),
    check('Trend', 'Price above 50-day MA', `${ctx.entry.toFixed(2)} vs MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, ctx.above50, 12),
    check('Near highs', 'Within 15% of 52-week high', `${nearHigh.toFixed(2)}% below high`, nearHigh <= 15, 12),
    check('Healthy RSI', 'RSI 50-75', ctx.currentRsi.toFixed(1), ctx.currentRsi >= 50 && ctx.currentRsi <= 75, 8),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 8)
  ];
  results.push(makeResult(
    'relative-strength-leader',
    relativeStrengthChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Ranks stocks that outperform both SPY and their sector.', 'Best for finding leadership rather than cheap-looking laggards.'],
    [
      ...(series.spyRelative20 <= 2 ? ['Required gate failed: stock is not outperforming SPY by at least 2% over 20 days.'] : []),
      ...(series.sectorRelative20 <= 1 ? ['Required gate failed: stock is not outperforming its sector by at least 1% over 20 days.'] : []),
      ...(series.sectorReturn20 <= series.spyReturn20 ? ['Required gate failed: sector is not outperforming SPY.'] : []),
      ...(!ctx.above50 ? ['Required gate failed: price is not above the 50-day moving average.'] : []),
      ...(nearHigh > 15 ? ['Required gate failed: stock is not close enough to its 52-week high for leadership.'] : []),
      ...(ctx.currentRsi < 50 || ctx.currentRsi > 75 ? ['Required gate failed: RSI does not show healthy leadership momentum.'] : [])
    ],
    { checks: relativeStrengthChecks }
  ));

  const oversoldChecks = [
    check('Prior quality', 'Above 200-day MA or within 3% below it', `${ctx.entry.toFixed(2)} vs MA200 ${(last(ctx.sma200) ?? 0).toFixed(2)}`, oversoldPriorQuality, 14),
    check('Oversold depth', 'RSI 25-42 and 5d <= -4% or 10d <= -6%', `RSI ${ctx.currentRsi.toFixed(1)}, 5d ${ctx.return5.toFixed(2)}%, 10d ${rateOfChange(ctx.closes, 10).toFixed(2)}%`, oversoldDepth, 22),
    check('Near support', 'Within 2.5% of support, 4% of recent low, or lower-band reclaim', `${ctx.entry.toFixed(2)} vs support ${ctx.sr.support.toFixed(2)}, recent low ${ctx.sr.recentLow.toFixed(2)}`, oversoldSupport, 18),
    check('Buyer confirmation', 'Previous-high reclaim, bullish engulfing, hammer, or Bollinger reclaim with RSI turn', `Close ${ctx.candle.close.toFixed(2)}, prev high ${ctx.previous.high.toFixed(2)}, RSI ${previousRsi.toFixed(1)} -> ${ctx.currentRsi.toFixed(1)}`, oversoldConfirmation, 18),
    check('Volume stabilization', 'Volume at least 0.85x 20-day average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio >= 0.85, 8),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x and risk <= ${settings.maxRiskPercent.toFixed(1)}%`, `R/R ${ctx.rewardRisk.toFixed(2)}x, risk ${ctx.riskPercent.toFixed(2)}%`, oversoldRiskOk, 20)
  ];

  results.push(makeResult(
    'oversold-bounce',
    oversoldChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Only accepts stocks with real oversold pressure, a support area, and buyer confirmation.', 'This is a gated setup: weak partial matches are not treated as candidates.'],
    [
      ...(!oversoldPriorQuality ? ['Required gate failed: stock lacks acceptable prior long-term structure.'] : []),
      ...(!oversoldDepth ? ['Required gate failed: stock is not deeply enough oversold by RSI and recent decline.'] : []),
      ...(!oversoldSupport ? ['Required gate failed: price is not close enough to support/recent low or lower-band reclaim.'] : []),
      ...(!oversoldConfirmation ? ['Required gate failed: buyer confirmation has not appeared yet.'] : []),
      ...(!oversoldRiskOk ? ['Required gate failed: reward/risk or max risk is not acceptable.'] : [])
    ],
    { checks: oversoldChecks }
  ));

  const earningsChecks = [
    check('Recent earnings', 'Recent earnings date available', series.profile.lastEarningsDate || 'Not available', Boolean(series.profile.lastEarningsDate), 14),
    check('Follow-through', '5-day return > 2%', `${ctx.return5.toFixed(2)}%`, ctx.return5 > 2, 16),
    check('Volume', 'Volume > 1.2x average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio > 1.2, 12),
    check('Trend hold', 'Price above 20-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}`, ctx.above20, 12),
    check('Post-event breakout', 'Price above 10-day high', `${ctx.entry.toFixed(2)} vs 10d high ${last10High.toFixed(2)}`, ctx.entry > last10High, 14),
    check('Not overextended', 'RSI < 78', ctx.currentRsi.toFixed(1), ctx.currentRsi < 78, 10),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 12),
    check('Sector support', 'Sector 20d return > 0%', `${series.sectorReturn20.toFixed(2)}%`, series.sectorReturn20 > 0, 10)
  ];
  results.push(makeResult(
    'earnings-drift',
    earningsChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Looks for post-earnings strength that holds instead of fading immediately.', 'The preferred trigger is a break above post-earnings consolidation.'],
    [
      ...(!series.profile.lastEarningsDate ? ['Required gate failed: no recent earnings date is available for an earnings-drift setup.'] : []),
      ...(ctx.return5 <= 2 ? ['Required gate failed: stock has not shown at least 2% post-event follow-through over 5 days.'] : []),
      ...(ctx.volumeRatio <= 1.2 ? ['Required gate failed: volume is not at least 1.2x average volume.'] : []),
      ...(!ctx.above20 ? ['Required gate failed: price is not above the 20-day moving average.'] : []),
      ...(ctx.entry <= last10High ? ['Required gate failed: price has not broken above the post-earnings range.'] : []),
      ...(ctx.currentRsi >= 78 ? ['Required gate failed: stock is too extended after earnings.'] : [])
    ],
    { allowNearEarnings: true, checks: earningsChecks }
  ));

  const squeezeChecks = [
    check('Uptrend', 'Above rising 50-day MA', `${ctx.entry.toFixed(2)} vs MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, ctx.above50 && ctx.sma50Up, 28),
    check('Tight range', '10-day range < 5%', `${recentRange.toFixed(2)}%`, recentRange < 5, 20),
    check('Volume contraction', 'Volume < 0.95x average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio < 0.95, 14),
    check('Near range high', 'Price within 2.5% of 10-day high', `${ctx.entry.toFixed(2)} vs 10d high ${last10High.toFixed(2)}`, ctx.entry > last10High * 0.975, 12),
    check('ATR control', 'ATR/price < 3.5%', `${((ctx.currentAtr / ctx.entry) * 100).toFixed(2)}%`, ctx.currentAtr / ctx.entry < 0.035, 12),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 14)
  ];
  results.push(makeResult(
    'volume-squeeze',
    squeezeChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Finds tight bases where volatility and volume contract before a potential move.', 'Best entries occur when price breaks the tight range on renewed volume.'],
    [
      ...(!ctx.above50 || !ctx.sma50Up ? ['Required gate failed: stock is not in a rising 50-day trend.'] : []),
      ...(recentRange >= 5 ? ['Required gate failed: recent 10-day range is not tight enough.'] : []),
      ...(ctx.volumeRatio >= 0.95 ? ['Required gate failed: volume has not contracted enough.'] : []),
      ...(ctx.entry <= last10High * 0.975 ? ['Required gate failed: price is not near the top of the squeeze range.'] : []),
      ...(ctx.currentAtr / ctx.entry >= 0.035 ? ['Required gate failed: ATR is too wide for a tight squeeze.'] : [])
    ],
    { checks: squeezeChecks }
  ));

  const sectorRotationChecks = [
    check('Sector beats SPY', 'Sector 20d return > SPY 20d return', `${series.sectorReturn20.toFixed(2)}% vs SPY ${series.spyReturn20.toFixed(2)}%`, series.sectorReturn20 > series.spyReturn20, 22),
    check('Sector strength', 'Sector 20d return > 2.5%', `${series.sectorReturn20.toFixed(2)}%`, series.sectorReturn20 > 2.5, 16),
    check('Stock trend', 'Above 20-day and 50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, ctx.above20 && ctx.above50, 24),
    check('Stock beats sector', 'Stock outperforms sector over 20d', `${series.sectorRelative20.toFixed(2)}%`, series.sectorRelative20 > 0, 14),
    check('Volume', 'Volume > average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio > 1.0, 10),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 14)
  ];
  results.push(makeResult(
    'sector-rotation',
    sectorRotationChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Looks for stocks benefiting from money rotating into their sector.', 'Requires both sector strength and stock-level confirmation.'],
    [
      ...(series.sectorReturn20 <= series.spyReturn20 ? ['Required gate failed: sector is not outperforming SPY.'] : []),
      ...(series.sectorReturn20 <= 2.5 ? ['Required gate failed: sector return is not strong enough over 20 days.'] : []),
      ...(!ctx.above20 || !ctx.above50 ? ['Required gate failed: stock is not above both 20-day and 50-day moving averages.'] : []),
      ...(series.sectorRelative20 <= 0 ? ['Required gate failed: stock is not outperforming its sector.'] : []),
      ...(ctx.volumeRatio <= 1.0 ? ['Required gate failed: volume does not confirm sector rotation.'] : [])
    ],
    { checks: sectorRotationChecks }
  ));

  const highContinuationChecks = [
    check('Near 52-week high', 'Within 7% of 52-week high', `${nearHigh.toFixed(2)}% below high`, nearHigh <= 7, 18),
    check('All key MAs', 'Above 20/50/200-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}, MA200 ${(last(ctx.sma200) ?? 0).toFixed(2)}`, ctx.above20 && ctx.above50 && ctx.above200, 36),
    check('RSI continuation', 'RSI 55-72', ctx.currentRsi.toFixed(1), ctx.currentRsi >= 55 && ctx.currentRsi <= 72, 14),
    check('Volume', 'Volume > average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio > 1.0, 10),
    check('Breakout zone', 'Price within 1.5% of 52-week high', `${ctx.entry.toFixed(2)} vs high ${ctx.sr.fiftyTwoWeekHigh.toFixed(2)}`, ctx.entry >= ctx.sr.fiftyTwoWeekHigh * 0.985, 12),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 10)
  ];
  results.push(makeResult(
    'fifty-two-week-high',
    highContinuationChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Prioritizes stocks pushing into or through 52-week highs.', 'Rejects overextended highs without enough risk/reward room.'],
    [
      ...(nearHigh > 7 ? ['Required gate failed: stock is not within 7% of its 52-week high.'] : []),
      ...(!ctx.above20 || !ctx.above50 || !ctx.above200 ? ['Required gate failed: stock is not above 20-day, 50-day, and 200-day moving averages.'] : []),
      ...(ctx.currentRsi < 55 || ctx.currentRsi > 72 ? ['Required gate failed: RSI is not in the ideal continuation zone.'] : []),
      ...(ctx.volumeRatio <= 1.0 ? ['Required gate failed: volume does not confirm the high continuation.'] : []),
      ...(ctx.entry < ctx.sr.fiftyTwoWeekHigh * 0.985 ? ['Required gate failed: price has not reached the 52-week high breakout zone.'] : [])
    ],
    { checks: highContinuationChecks }
  ));

  const gapFillChecks = [
    check('Gap-down structure', 'Recent open at least 3% below prior low', `${ctx.candle.open.toFixed(2)} vs previous low ${ctx.previous.low.toFixed(2)}`, Boolean(gapDown), 18),
    check('Reclaim trigger', 'Close above previous high', `${ctx.entry.toFixed(2)} vs previous high ${ctx.previous.high.toFixed(2)}`, ctx.entry > ctx.previous.high, 16),
    check('RSI reversal zone', 'RSI 35-55', ctx.currentRsi.toFixed(1), ctx.currentRsi >= 35 && ctx.currentRsi <= 55, 14),
    check('Support hold', 'Price above support', `${ctx.entry.toFixed(2)} vs support ${ctx.sr.support.toFixed(2)}`, ctx.entry > ctx.sr.support, 12),
    check('Volume', 'Volume >= 0.9x average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio >= 0.9, 10),
    check('Still discounted', '5-day return < 0%', `${ctx.return5.toFixed(2)}%`, ctx.return5 < 0, 10),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 20)
  ];
  results.push(makeResult(
    'gap-fill-reversal',
    gapFillChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Looks for a controlled gap-down reversal where the gap-fill target is meaningful.', 'Avoids serious breakdowns by requiring price to reclaim the gap candle.'],
    [
      ...(!gapDown ? ['Required gate failed: no qualifying recent gap-down structure was detected.'] : []),
      ...(ctx.entry <= ctx.previous.high ? ['Required gate failed: price has not reclaimed the gap-down candle high.'] : []),
      ...(ctx.currentRsi < 35 || ctx.currentRsi > 55 ? ['Required gate failed: RSI is not in the reversal zone.'] : []),
      ...(ctx.entry <= ctx.sr.support ? ['Required gate failed: price has not held above support.'] : []),
      ...(ctx.volumeRatio < 0.9 ? ['Required gate failed: volume is too weak for reversal confirmation.'] : [])
    ],
    { checks: gapFillChecks }
  ));

  const recentGapLabel = recentGapEvent
    ? `${recentGapEvent.daysAgo === 0 ? 'today' : recentGapEvent.daysAgo === 1 ? 'yesterday' : '2 sessions ago'} (${recentGapEvent.candle.date})`
    : 'None in last 3 sessions';
  const recentGapRiskOk = ctx.rewardRisk >= settings.minRewardRisk && ctx.riskPercent <= settings.maxRiskPercent + 0.1;
  const recentGapChecks = [
    check('Tradability', `Market cap >= $${(settings.minMarketCap / 1_000_000_000).toFixed(0)}B, price >= $${settings.minPrice}, avg volume >= ${(settings.minAverageVolume / 1_000_000).toFixed(0)}M`, `Cap $${(series.profile.marketCap / 1_000_000_000).toFixed(1)}B, price ${ctx.entry.toFixed(2)}, avg volume ${(series.profile.avgVolume / 1_000_000).toFixed(1)}M`, ctx.blockers.filter((blocker) => blocker.includes('Market cap') || blocker.includes('Price') || blocker.includes('volume') || blocker.includes('Dollar')).length === 0, 15),
    check('Gap event', 'Opening gap down <= -5% in last 3 sessions', recentGapEvent ? `${recentGapEvent.gapPercent.toFixed(2)}% gap on ${recentGapLabel}; open ${recentGapEvent.candle.open.toFixed(2)} vs prior close ${recentGapEvent.priorClose.toFixed(2)}` : 'No 5%+ opening gap down found', recentGapDown, 45),
    check('Recency', 'Gap was today, yesterday, or 2 sessions ago', recentGapLabel, recentGapDown, 10),
    check('Gap low damage', 'Current close is not more than 2% below the gap-day low', recentGapEvent ? `Close ${ctx.entry.toFixed(2)} vs gap low ${recentGapEvent.candle.low.toFixed(2)}` : 'No gap event', recentGapHeldLow, 10),
    check('Volume confirmation', 'Gap-day volume >= 1.2x 20-day average', recentGapEvent ? `${(recentGapEvent.candle.volume / Math.max(ctx.avgVolume20, 1)).toFixed(2)}x` : 'No gap event', recentGapEvent ? recentGapEvent.candle.volume / Math.max(ctx.avgVolume20, 1) >= 1.2 : false, 10),
    check('Opening price reclaim', 'Current close has reclaimed the gap-day open', recentGapEvent ? `Close ${ctx.entry.toFixed(2)} vs gap open ${recentGapEvent.candle.open.toFixed(2)}` : 'No gap event', recentGapReclaim, 10),
    check('Trend damage check', 'Above 200-day MA or within 7% below it', `${ctx.entry.toFixed(2)} vs MA200 ${(last(ctx.sma200) ?? ctx.entry).toFixed(2)}`, ctx.above200 || ctx.entry >= (last(ctx.sma200) ?? ctx.entry) * 0.93, 5),
    check('5% trade model', `R/R >= ${settings.minRewardRisk.toFixed(1)}x and risk <= ${settings.maxRiskPercent.toFixed(1)}%`, `R/R ${ctx.rewardRisk.toFixed(2)}x, risk ${ctx.riskPercent.toFixed(2)}%`, recentGapRiskOk, 10)
  ];
  results.push(makeResult(
    'recent-gap-down',
    recentGapChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    [
      'Tracks mid/large-cap stocks with an opening gap down of 5% or more in the last three trading sessions.',
      'This is an event radar first: reversal quality, gap-low hold, volume, and 5% trade model are shown separately in the matrix.'
    ],
    [
      ...(!recentGapDown ? ['Required gate failed: no opening gap down of 5% or more was found in the last three trading sessions.'] : [])
    ],
    {
      allowNearEarnings: true,
      ignoreRiskBlockers: true,
      checks: recentGapChecks,
      eventDate: recentGapEvent?.candle.date,
      eventDaysAgo: recentGapEvent?.daysAgo,
      eventPercent: recentGapEvent?.gapPercent
    }
  ));

  const maReclaimChecks = [
    check('MA reclaim', 'Reclaimed 20-day or 50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, movingAverageReclaim, 20),
    check('50-day trend', 'Above rising 50-day MA', `${ctx.entry.toFixed(2)} vs MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}, slope ${trendSlope(ctx.sma50).toFixed(2)}`, ctx.above50 && ctx.sma50Up, 24),
    check('RSI bullish', 'RSI > 50', ctx.currentRsi.toFixed(1), ctx.currentRsi > 50, 14),
    check('MACD improving', 'MACD histogram improving', `${(last(ctx.macdData.histogram) ?? 0).toFixed(2)} vs prior ${(prev(ctx.macdData.histogram, 1) ?? 0).toFixed(2)}`, ctx.macdImproving, 12),
    check('Volume', 'Volume > 0.9x average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio > 0.9, 10),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x`, `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= settings.minRewardRisk, 20)
  ];
  results.push(makeResult(
    'moving-average-reclaim',
    maReclaimChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    ['Finds stocks that shook out below a moving average and reclaimed it with strength.', 'The reclaim candle defines a clean entry and nearby invalidation level.'],
    [
      ...(!movingAverageReclaim ? ['Required gate failed: price has not reclaimed a key moving average.'] : []),
      ...(!ctx.above50 || !ctx.sma50Up ? ['Required gate failed: stock is not back in a rising 50-day trend.'] : []),
      ...(ctx.currentRsi <= 50 ? ['Required gate failed: RSI has not reclaimed bullish territory.'] : []),
      ...(!ctx.macdImproving ? ['Required gate failed: MACD momentum is not improving.'] : []),
      ...(ctx.volumeRatio <= 0.9 ? ['Required gate failed: volume is too weak to confirm the reclaim.'] : [])
    ],
    { checks: maReclaimChecks }
  ));

  const bottomReversalChecks = [
    check('Major bottom zone', 'Near recent low/support/52-week low zone', `${ctx.entry.toFixed(2)} vs recent low ${ctx.sr.recentLow.toFixed(2)}, 52w low ${ctx.sr.fiftyTwoWeekLow.toFixed(2)}`, nearMajorBottomZone, 25),
    check('RSI divergence', 'Price lower/flat low while RSI higher low', `Price low ${recentPriceLow.toFixed(2)} vs prior ${priorPriceLow.toFixed(2)}, RSI low ${recentRsiLow.toFixed(1)} vs prior ${priorRsiLow.toFixed(1)}`, bullishDivergence, 20),
    check('Capitulation volume', 'Peak recent volume >= 1.8x average', `${capitulationVolume.toFixed(2)}x`, capitulationVolume >= 1.8, 15),
    check('Oversold/reclaim', 'Lower-band reclaim or RSI <= 38', `RSI ${ctx.currentRsi.toFixed(1)}, lower band ${lowerBand.toFixed(2)}`, reclaimedLowerBand || ctx.currentRsi <= 38, 15),
    check('Reversal confirmation', 'Previous-high reclaim, hammer, or bullish engulfing', `Close ${ctx.entry.toFixed(2)} vs previous high ${ctx.previous.high.toFixed(2)}`, reversalConfirmed, 15),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x and risk <= ${settings.maxRiskPercent.toFixed(1)}%`, `R/R ${ctx.rewardRisk.toFixed(2)}x, risk ${ctx.riskPercent.toFixed(2)}%`, ctx.rewardRisk >= settings.minRewardRisk && ctx.riskPercent <= settings.maxRiskPercent, 10)
  ];
  results.push(makeResult(
    'bottom-reversal',
    bottomReversalChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    [
      'Looks for selling exhaustion near a major support zone, then waits for buyer confirmation.',
      'This does not assume the stock cannot fall lower; it requires a nearby invalidation level and a 5% target with acceptable risk.'
    ],
    [
      ...(!nearMajorBottomZone ? ['Required gate failed: price is not close enough to recent low, major support, or 52-week low zone.'] : []),
      ...(!exhaustionSignal ? ['Required gate failed: no RSI divergence, capitulation volume, Bollinger reclaim, or deeply oversold RSI.'] : []),
      ...(!reversalConfirmed ? ['Required gate failed: no reversal candle or previous-high reclaim has confirmed buyer control yet.'] : []),
      ...(ctx.rewardRisk < settings.minRewardRisk ? ['Required gate failed: 5% target does not meet minimum reward/risk.'] : [])
    ],
    { checks: bottomReversalChecks }
  ));

  const supportHoldChecks = [
    check('Tradability', `Market cap >= $${(settings.minMarketCap / 1_000_000_000).toFixed(0)}B, price >= $${settings.minPrice}, avg volume >= ${(settings.minAverageVolume / 1_000_000).toFixed(0)}M`, `Cap $${(series.profile.marketCap / 1_000_000_000).toFixed(1)}B, price ${ctx.entry.toFixed(2)}, avg volume ${(series.profile.avgVolume / 1_000_000).toFixed(1)}M`, ctx.blockers.filter((blocker) => blocker.includes('Market cap') || blocker.includes('Price') || blocker.includes('volume') || blocker.includes('Dollar')).length === 0, 10),
    check('Not a downtrend', 'Above 200-day MA or within 3% below it', `${ctx.entry.toFixed(2)} vs MA200 ${sma200Value.toFixed(2)}`, supportHoldTrendOk, 18),
    check('Controlled correction', '5-day return -2% to -10% and at least 2 down closes', `5d ${ctx.return5.toFixed(2)}%, down closes ${downCloses5}/4`, supportHoldCorrection, 20),
    check('Near support', '-0.5% to 4% from recent support/20-day/50-day zone', `${pctAboveSupport.toFixed(2)}% from support ${supportLevel.toFixed(2)}`, supportHoldNearSupport, 18),
    check('Support held', 'No close >0.5% below support in last 3 sessions', `${closesBelowSupport3} confirmed closes below support`, supportHeld, 14),
    check('Selling pressure', 'Volume <= 1.25x avg or red volume fading', `Volume ${ctx.volumeRatio.toFixed(2)}x, red volume fading ${redVolumeFading ? 'yes' : 'no'}`, supportHoldVolumeOk, 8),
    check('Bounce confirmation', 'Previous-high reclaim, hammer, engulfing, or RSI turn from 38-58', `Close ${ctx.entry.toFixed(2)} vs prev high ${ctx.previous.high.toFixed(2)}, RSI ${previousRsi.toFixed(1)} -> ${ctx.currentRsi.toFixed(1)}`, supportHoldBounce, 12),
    check('Reward/risk', `R/R >= ${settings.minRewardRisk.toFixed(1)}x and risk <= ${settings.maxRiskPercent.toFixed(1)}%`, `R/R ${ctx.rewardRisk.toFixed(2)}x, risk ${ctx.riskPercent.toFixed(2)}%`, supportHoldRiskOk, 20)
  ];

  results.push(makeResult(
    'support-hold-pullback',
    supportHoldChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    [
      'Finds mid/large-cap stocks correcting for a few sessions into support without breaking that support.',
      'This is designed to catch a controlled pullback, not a stock in a confirmed downtrend.'
    ],
    [
      ...(!supportHoldTrendOk ? ['Required gate failed: stock is too weak versus the 200-day moving average.'] : []),
      ...(!supportHoldCorrection ? ['Required gate failed: recent move is not a controlled 5-day correction.'] : []),
      ...(!supportHoldNearSupport ? ['Required gate failed: price is not within the support-hold buy zone.'] : []),
      ...(!supportHeld ? ['Required gate failed: support has not held over the last 3 sessions.'] : []),
      ...(!supportHoldVolumeOk ? ['Required gate failed: selling pressure is not controlled.'] : []),
      ...(!supportHoldBounce ? ['Required gate failed: bounce confirmation has not appeared yet.'] : []),
      ...(!supportHoldRiskOk ? ['Required gate failed: reward/risk or max risk is not acceptable.'] : [])
    ],
    { checks: supportHoldChecks }
  ));

  const twoDayForecastChecks = [
    check('Historical 2-day burst rate', `Past 2-session windows reaching +${settings.targetPercent.toFixed(0)}%`, `${(twoDayBurstRate * 100).toFixed(1)}% all-time, ${(recentTwoDayBurstRate * 100).toFixed(1)}% recent`, twoDayBurstRate >= 0.04 || recentTwoDayBurstRate >= 0.08, 16),
    check('Current momentum', 'Positive 2d and 5d momentum with acceleration', `2d ${currentTwoDayReturn.toFixed(2)}%, 5d ${ctx.return5.toFixed(2)}%`, currentTwoDayReturn > 0 && ctx.return5 > 2 && priceAcceleration, 18),
    check('Volatility capacity', `ATR can support a ${settings.targetPercent.toFixed(0)}% 2-day move`, `ATR ${atrPercent.toFixed(2)}%, 2d capacity ${twoDayVolatilityCapacity.toFixed(2)}%`, twoDayVolatilityCapacity >= settings.targetPercent * 0.75, 16),
    check('Volume expansion', 'Volume at least 1.1x 20-day average', `${ctx.volumeRatio.toFixed(2)}x`, ctx.volumeRatio >= 1.1, 14),
    check('Relative strength', 'Stock outperforming SPY and sector', `SPY rel ${series.spyRelative20.toFixed(2)}%, sector rel ${series.sectorRelative20.toFixed(2)}%`, series.spyRelative20 > 1.5 && series.sectorRelative20 > 0.5, 16),
    check('Trend support', 'Above 20-day and 50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${sma20Value.toFixed(2)}, MA50 ${sma50Value.toFixed(2)}`, ctx.above20 && ctx.above50, 10),
    check('Setup quality', 'Forecast probability >= 60%', `${twoDayForecastProbability.toFixed(0)}% model probability`, twoDayForecastProbability >= 60, 10)
  ];

  results.push(makeResult(
    'two-day-five-percent',
    twoDayForecastChecks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    ctx,
    [
      'Ranks stocks with the best technical probability of reaching a 5% gain within the next two trading sessions.',
      'Uses historical 2-day burst behavior, current momentum, volatility capacity, volume expansion, relative strength, and trend support.'
    ],
    [
      ...(twoDayForecastProbability < 50 ? ['Required gate failed: model probability is below 50% for a two-day 5% forecast.'] : []),
      ...(twoDayVolatilityCapacity < settings.targetPercent * 0.6 ? ['Required gate failed: recent volatility is too low for a realistic 5% two-day move.'] : []),
      ...(!ctx.above20 || !ctx.above50 ? ['Required gate failed: price is not above both 20-day and 50-day moving averages.'] : [])
    ],
    { checks: twoDayForecastChecks }
  ));

  const topTenAverage = average(results.map((result) => result.score));
  const proScore =
    scoreBool(ctx.above20 && ctx.above50, 12) +
    scoreBool(series.sectorReturn20 > series.spyReturn20, 18) +
    scoreBool(series.spyRelative20 > 1.5 && series.sectorRelative20 > 0.5, 20) +
    scoreBool(ctx.rewardRisk >= 2, 18) +
    scoreBool(ctx.riskPercent <= settings.maxRiskPercent, 12) +
    scoreBool(topTenAverage > 62, 10) +
    scoreBool(results.filter((result) => result.score >= 75).length >= 2, 10);
  const proChecks = [
    check('Trend base', 'Above 20-day and 50-day MA', `${ctx.entry.toFixed(2)} vs MA20 ${(last(ctx.sma20) ?? 0).toFixed(2)}, MA50 ${(last(ctx.sma50) ?? 0).toFixed(2)}`, ctx.above20 && ctx.above50, 12),
    check('Sector support', 'Sector beats SPY', `${series.sectorReturn20.toFixed(2)}% vs SPY ${series.spyReturn20.toFixed(2)}%`, series.sectorReturn20 > series.spyReturn20, 18),
    check('Leadership', 'Stock beats SPY > 1.5% and sector > 0.5%', `SPY rel ${series.spyRelative20.toFixed(2)}%, sector rel ${series.sectorRelative20.toFixed(2)}%`, series.spyRelative20 > 1.5 && series.sectorRelative20 > 0.5, 20),
    check('Reward/risk', 'R/R >= 1.6x', `${ctx.rewardRisk.toFixed(2)}x`, ctx.rewardRisk >= 1.6, 18),
    check('Risk control', `Risk <= ${settings.maxRiskPercent.toFixed(1)}%`, `${ctx.riskPercent.toFixed(2)}%`, ctx.riskPercent <= settings.maxRiskPercent, 12),
    check('Strategy quality', 'Average strategy score > 62', `${topTenAverage.toFixed(1)}`, topTenAverage > 62, 10),
    check('Confluence', 'At least 2 qualified strategy confirmations', `${results.filter((result) => result.blockers.length === 0 && result.score >= 75).length}`, results.filter((result) => result.blockers.length === 0 && result.score >= 75).length >= 2, 10)
  ];
  results.push(makeResult(
    'pro-trader',
    proScore,
    ctx,
    ['Uses market, sector, leadership, setup quality, and risk filters together.', 'This is intentionally strict and prefers a small list of high-quality candidates.'],
    [
      ...(!ctx.above20 || !ctx.above50 ? ['Required gate failed: price is not above both 20-day and 50-day moving averages.'] : []),
      ...(series.sectorReturn20 <= series.spyReturn20 ? ['Required gate failed: sector is not outperforming SPY.'] : []),
      ...(series.spyRelative20 <= 1.5 || series.sectorRelative20 <= 0.5 ? ['Required gate failed: stock is not a strong relative-strength leader.'] : []),
      ...(ctx.rewardRisk < 1.6 ? ['Required gate failed: reward/risk is below 1.6x for Pro Trader model.'] : []),
      ...(results.filter((result) => result.blockers.length === 0 && result.score >= 75).length < 2 ? ['Required gate failed: fewer than two qualified strategy confirmations.'] : [])
    ],
    { checks: proChecks }
  ));

  return results.sort((a, b) => b.score - a.score);
};

export const rankStocks = (market: MarketSeries[], settings: AppSettings = defaultSettings): RankedStock[] =>
  market.map((series) => {
    const results = evaluateStrategies(series, settings);
    const proResult = results.find((result) => result.strategyId === 'pro-trader') ?? results[0];
    const qualified = results.find((result) => result.strategyId !== 'two-day-five-percent' && result.blockers.length === 0 && result.score >= 70);
    const confluence = results.filter((result) => result.strategyId !== 'pro-trader' && result.strategyId !== 'two-day-five-percent' && result.blockers.length === 0 && result.score >= 75).length;
    return {
      series,
      results,
      bestResult: qualified ?? results[0],
      confluence,
      proResult
    };
  }).sort((a, b) => b.proResult.score + b.confluence * 3 - (a.proResult.score + a.confluence * 3));

export const chartIndicators = (candles: Candle[]) => {
  const closes = candles.map((candle) => candle.close);
  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 120),
    rsi14: rsi(closes, 14),
    atr14: atr(candles, 14),
    macd: macd(closes),
    supportResistance: getSupportResistance(candles)
  };
};
