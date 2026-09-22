import { RankedStock, StrategyId } from '../types';
import { strategyNames } from '../engine/strategyEngine';

type Props = {
  stocks: RankedStock[];
  onSelect: (symbol: string) => void;
};

const columns: StrategyId[] = [
  'pro-trader',
  'two-percent-vwap-momentum',
  'two-day-five-percent',
  'results-gap-down-recovery',
  'today-five-percent-down',
  'today-ten-percent-down',
  'today-fifteen-percent-down',
  'today-twenty-percent-down',
  'earnings-next-three-days',
  'breakout-momentum',
  'pullback-uptrend',
  'relative-strength-leader',
  'oversold-bounce',
  'earnings-drift',
  'volume-squeeze',
  'sector-rotation',
  'fifty-two-week-high',
  'gap-fill-reversal',
  'moving-average-reclaim',
  'bottom-reversal',
  'support-hold-pullback',
  'sideways-base-ready'
];

export const ComparisonTable = ({ stocks, onSelect }: Props) => (
  <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
    <div className="border-b border-line px-4 py-3">
      <h2 className="font-semibold text-ink">Strategy Comparison</h2>
      <p className="text-sm text-slate-500">Higher scores mean the setup, trend, and risk model agree more strongly.</p>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            {columns.map((column) => <th key={column} className="px-3 py-3">{strategyNames[column].replace(' ', '\n')}</th>)}
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.series.profile.symbol} className="border-t border-line">
              <td className="px-4 py-3">
                <button className="font-semibold text-signal hover:underline" onClick={() => onSelect(stock.series.profile.symbol)}>
                  {stock.series.profile.symbol}
                </button>
                <p className="text-xs text-slate-500">{stock.series.profile.sector}</p>
              </td>
              {columns.map((column) => {
                const result = stock.results.find((item) => item.strategyId === column);
                const score = result?.score ?? 0;
                return (
                  <td key={column} className="px-3 py-3">
                    <span className={`inline-flex min-w-10 justify-center rounded-md px-2 py-1 text-xs font-semibold ${
                      score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        score >= 65 ? 'bg-blue-100 text-blue-700' :
                          score >= 45 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                    }`}>
                      {score}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
