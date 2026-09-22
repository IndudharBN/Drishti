import { useMemo } from 'react';
import { AlertTriangle, RefreshCw, Rocket, ShieldAlert, Target, Zap } from 'lucide-react';
import { MarketSeries } from '../types';
import { RunnerRadarRow, scanRunnerRadar } from '../lib/runnerRadar';
import { compactCurrency, compactNumber, currency, percent } from '../lib/format';

type Props = {
  market: MarketSeries[];
  onSelect: (symbol: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const setupClass = (setup: string) => {
  if (setup === 'Live Runner') return 'bg-red-100 text-red-700';
  if (setup === 'Pre-Breakout Watch') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
};

export const RunnerRadar = ({ market, onSelect, onRefresh, isRefreshing }: Props) => {
  const rows = useMemo(() => scanRunnerRadar(market), [market]);
  const topScore = rows[0]?.runnerScore ?? 0;
  const liveRunnerCount = rows.filter((row) => row.setup === 'Live Runner').length;
  const averageVolumeRatio = rows.length > 0 ? rows.reduce((sum, row) => sum + row.volumeRatio, 0) / rows.length : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-ink">AI Runner Radar</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Shows up to five very high-risk stocks with the strongest 50%+ runner pattern: abnormal volume, fast same-day movement,
              wide range expansion, and price near breakout levels. This is a radar list, not an investment recommendation.
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Radar
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-4">
          <Rule label="Not prediction" value="The score finds runner conditions; it cannot know which stock will actually jump 50% or 100%." />
          <Rule label="Catalyst" value="Most 50%+ runners need news, squeeze, FDA/data, earnings, offering, sector mania, or extreme volume." />
          <Rule label="Risk" value="These names can reverse fast, halt, dilute, or gap down. Treat them as observation only unless independently verified." />
          <Rule label="Limit" value="Maximum five names. If there are no clean radar setups, the list stays empty." />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Rocket className="h-5 w-5" />} label="Radar Candidates" value={rows.length} />
        <SummaryCard icon={<Zap className="h-5 w-5" />} label="Top Runner Score" value={topScore} />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Live Runners" value={liveRunnerCount} />
        <SummaryCard icon={<Target className="h-5 w-5" />} label="Avg Relative Volume" value={`${averageVolumeRatio.toFixed(2)}x`} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1720px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company', 'Sector', 'Setup', 'Risk', 'Price', 'Today', '5D', '20D', 'Range', 'Rel Vol', 'Dollar Vol', 'Market Cap', 'Breakout Distance', 'Runner Score', 'Trigger', 'Reason'].map((heading) => (
                  <th key={heading} className="bg-slate-50 px-3 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => <RunnerRow key={row.symbol} row={row} onSelect={onSelect} />)}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No high-risk runner candidates pass the radar filters right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const RunnerRow = ({ row, onSelect }: { row: RunnerRadarRow; onSelect: (symbol: string) => void }) => (
  <tr className="border-t border-line align-top hover:bg-slate-50">
    <td className="px-3 py-3">
      <button className="font-semibold text-signal hover:underline" onClick={() => onSelect(row.symbol)}>
        {row.symbol}
      </button>
    </td>
    <td className="px-3 py-3 font-medium text-ink">{row.company}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{row.sector}</td>
    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${setupClass(row.setup)}`}>{row.setup}</span></td>
    <td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"><ShieldAlert className="h-3.5 w-3.5" />{row.risk}</span></td>
    <td className="px-3 py-3 font-semibold text-ink">{currency(row.price)}</td>
    <td className={`px-3 py-3 font-semibold ${row.todayMovePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.todayMovePercent)}</td>
    <td className={`px-3 py-3 ${row.fiveDayMovePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.fiveDayMovePercent)}</td>
    <td className={`px-3 py-3 ${row.twentyDayMovePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.twentyDayMovePercent)}</td>
    <td className="px-3 py-3">{percent(row.rangePercent)}</td>
    <td className="px-3 py-3 font-semibold">{row.volumeRatio.toFixed(2)}x</td>
    <td className="px-3 py-3">{compactCurrency(row.dollarVolume)}</td>
    <td className="px-3 py-3">{compactNumber(row.marketCap)}</td>
    <td className={`px-3 py-3 ${row.breakoutDistancePercent >= 0 ? 'text-gain' : 'text-slate-700'}`}>{percent(row.breakoutDistancePercent)}</td>
    <td className="px-3 py-3">
      <span className="font-semibold text-ink">{row.runnerScore}</span>
      <p className="mt-1 text-xs font-semibold text-slate-500">{row.probabilityBand}</p>
    </td>
    <td className="max-w-sm px-3 py-3 text-xs font-semibold text-ink">{row.trigger}</td>
    <td className="max-w-md px-3 py-3 text-xs text-slate-600">{row.reason}</td>
  </tr>
);

const SummaryCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between text-slate-500"><p className="text-sm">{label}</p><span className="text-signal">{icon}</span></div>
    <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
  </div>
);

const Rule = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-red-100 bg-red-50 p-3">
    <p className="font-semibold text-red-900">{label}</p>
    <p className="mt-1 text-red-800">{value}</p>
  </div>
);
