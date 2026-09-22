import { StrategyId } from '../types';
import { strategyNames } from '../engine/strategyEngine';

type Props = {
  value: StrategyId | 'all';
  onChange: (value: StrategyId | 'all') => void;
};

const strategyOrder: Array<StrategyId | 'all'> = [
  'pro-trader',
  'two-percent-vwap-momentum',
  'two-day-five-percent',
  'results-gap-down-recovery',
  'today-five-percent-down',
  'today-ten-percent-down',
  'today-fifteen-percent-down',
  'today-twenty-percent-down',
  'earnings-next-three-days',
  'all',
  'breakout-momentum',
  'pullback-uptrend',
  'relative-strength-leader',
  'oversold-bounce',
  'earnings-drift',
  'volume-squeeze',
  'sector-rotation',
  'fifty-two-week-high',
  'gap-fill-reversal',
  'recent-gap-down',
  'moving-average-reclaim',
  'bottom-reversal',
  'support-hold-pullback',
  'sideways-base-ready'
];

export const StrategyTabs = ({ value, onChange }: Props) => (
  <div className="grid max-h-[48vh] grid-cols-2 gap-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-9.5rem)] xl:grid-cols-1">
    {strategyOrder.map((item) => {
      const active = value === item;
      const label = item === 'all' ? 'All Strategies' : strategyNames[item];
      return (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`min-h-9 rounded-md border px-3 py-2 text-left text-sm font-semibold leading-tight transition ${
            active
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);
