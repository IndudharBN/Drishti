import { StrategyId } from '../types';
import { strategyNames } from '../engine/strategyEngine';

type Props = {
  value: StrategyId | 'all';
  onChange: (value: StrategyId | 'all') => void;
};

const strategyOrder: Array<StrategyId | 'all'> = [
  'pro-trader',
  'two-day-five-percent',
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
  'support-hold-pullback'
];

export const StrategyTabs = ({ value, onChange }: Props) => (
  <div className="flex gap-2 overflow-x-auto pb-2">
    {strategyOrder.map((item) => {
      const active = value === item;
      const label = item === 'all' ? 'All Strategies' : strategyNames[item];
      return (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`h-9 shrink-0 rounded-md border px-3 text-sm font-semibold transition ${
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
