export type StrategyId =
  | 'breakout-momentum'
  | 'pullback-uptrend'
  | 'relative-strength-leader'
  | 'oversold-bounce'
  | 'earnings-drift'
  | 'volume-squeeze'
  | 'sector-rotation'
  | 'fifty-two-week-high'
  | 'gap-fill-reversal'
  | 'recent-gap-down'
  | 'moving-average-reclaim'
  | 'bottom-reversal'
  | 'support-hold-pullback'
  | 'two-day-five-percent'
  | 'pro-trader';

export type StrategyStatus = 'triggered' | 'watch' | 'wait' | 'failed';

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SymbolProfile = {
  symbol: string;
  company: string;
  exchange?: string;
  tradingViewExchange?: string;
  sector: string;
  industry: string;
  marketCap: number;
  avgVolume: number;
  country: 'US';
  type: 'stock' | 'etf';
  nextEarningsDate?: string;
  lastEarningsDate?: string;
};

export type MarketSeries = {
  profile: SymbolProfile;
  candles: Candle[];
  spyRelative20: number;
  sectorRelative20: number;
  sectorReturn20: number;
  spyReturn20: number;
  dataSource?: 'yahoo' | 'stooq' | 'alpha-vantage' | 'insforge';
  lastUpdated?: string;
};

export type StrategyResult = {
  strategyId: StrategyId;
  strategyName: string;
  score: number;
  entry: number;
  target: number;
  stop: number;
  riskPercent: number;
  rewardRisk: number;
  status: StrategyStatus;
  reasons: string[];
  blockers: string[];
  checks?: StrategyCheck[];
  eventDate?: string;
  eventDaysAgo?: number;
  eventPercent?: number;
};

export type StrategyCheck = {
  label: string;
  required: string;
  actual: string;
  passed: boolean;
  points: number;
};

export type RankedStock = {
  series: MarketSeries;
  results: StrategyResult[];
  bestResult: StrategyResult;
  confluence: number;
  proResult: StrategyResult;
};

export type AppSettings = {
  minMarketCap: number;
  minPrice: number;
  minAverageVolume: number;
  minDollarVolume: number;
  targetPercent: number;
  maxRiskPercent: number;
  minRewardRisk: number;
};

export type WatchlistItem = {
  id: string;
  symbol: string;
  strategyId: StrategyId;
  entry: number;
  target: number;
  stop: number;
  createdAt: string;
  status: 'watching' | 'active' | 'hit-target' | 'stopped' | 'archived';
};

export type TradePlan = {
  id: string;
  symbol: string;
  strategyId: StrategyId;
  entry: number;
  target: number;
  stop: number;
  positionSize?: number;
  notes: string;
  createdAt: string;
};

export type AlertRule = {
  id: string;
  symbol: string;
  kind: 'entry' | 'target' | 'stop';
  level: number;
  enabled: boolean;
  createdAt: string;
};
