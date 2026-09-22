import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, RefreshCw, Search, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { IndexKey } from '../types';
import { fetchIndexLeadership, IndexDriverRow, IndexLeadershipData } from '../services/indexData';
import { compactCurrency, compactNumber, currency, percent } from '../lib/format';

type Props = {
  onSelect?: (symbol: string) => void;
};

type SetupFilter = 'All' | IndexDriverRow['setup'];
type DirectionFilter = 'All' | 'Positive' | 'Negative';

const indexTabs: Array<{ key: IndexKey; label: string }> = [
  { key: 'sp500', label: 'S&P 500' },
  { key: 'nasdaq100', label: 'Nasdaq 100' }
];

const setupClass = (setup: string) => {
  if (setup === 'Momentum Leader') return 'bg-emerald-100 text-emerald-700';
  if (setup === 'Early Reclaim') return 'bg-blue-100 text-blue-700';
  if (setup === 'Pullback Watch') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

export const IndexDrivers = ({ onSelect }: Props) => {
  const [activeIndex, setActiveIndex] = useState<IndexKey>('sp500');
  const [data, setData] = useState<IndexLeadershipData | null>(null);
  const [state, setState] = useState<'loading' | 'refreshing' | 'live' | 'error'>('loading');
  const [message, setMessage] = useState('Loading S&P 500 and Nasdaq 100 leadership data...');
  const [search, setSearch] = useState('');
  const [setup, setSetup] = useState<SetupFilter>('All');
  const [direction, setDirection] = useState<DirectionFilter>('Positive');

  const loadData = useCallback(async (mode: 'initial' | 'manual' | 'auto' = 'manual') => {
    setState(mode === 'initial' ? 'loading' : 'refreshing');
    setMessage(mode === 'auto' ? 'Auto-refreshing index leadership data...' : 'Refreshing index leadership data...');
    try {
      const next = await fetchIndexLeadership();
      setData(next);
      setState('live');
      setMessage(`Fresh index leadership data loaded at ${new Date(next.refreshedAt).toLocaleString()}.`);
    } catch (error) {
      setState(data ? 'live' : 'error');
      setMessage(data ? 'Refresh failed. Keeping the last loaded index leadership data.' : 'Index leadership data could not be loaded.');
    }
  }, [data]);

  useEffect(() => {
    loadData('initial');
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadData('auto');
    }, 120_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const rows = data?.rows[activeIndex] ?? [];
  const summary = data?.summaries[activeIndex];
  const refreshedLabel = data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : '';
  const todayHeaderLabel = summary ? `${summary.priceSession} / ${summary.priceTimestamp}` : refreshedLabel;
  const visibleRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.symbol.toLowerCase().includes(query) || row.company.toLowerCase().includes(query)) &&
      (setup === 'All' || row.setup === setup) &&
      (direction === 'All' || (direction === 'Positive' ? row.todayChangePercent >= 0 : row.todayChangePercent < 0));
  }).slice(0, 80), [direction, rows, search, setup]);

  const advancers = rows.filter((row) => row.todayChangePercent > 0).length;
  const decliners = rows.filter((row) => row.todayChangePercent < 0).length;
  const topDriver = rows[0];
  const bestSwing = rows.find((row) => row.setup !== 'Avoid Chase');

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Index Drivers</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Tracks S&P 500 and Nasdaq 100 performance using SPY and QQQ, then ranks constituent stocks that are driving the move.
              Use the setup column to separate swing candidates from names that have already moved too far.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
              Auto-refreshes every 2 minutes while this tab is open.
            </span>
            <button
              onClick={() => loadData('manual')}
              disabled={state === 'loading' || state === 'refreshing'}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${state === 'loading' || state === 'refreshing' ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <p className={`mt-3 text-xs font-semibold ${state === 'error' ? 'text-red-700' : 'text-slate-500'}`}>{message}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5" />}
          label={summary ? `${summary.name} (${summary.proxySymbol})` : 'Index'}
          value={summary ? `${currency(summary.price)} ${percent(summary.todayChangePercent)}` : '-'}
          detail={summary ? `${summary.marketWindow}; ${summary.priceSession}` : undefined}
        />
        <SummaryCard icon={<Activity className="h-5 w-5" />} label="Breadth" value={`${advancers} up / ${decliners} down`} />
        <SummaryCard icon={<Zap className="h-5 w-5" />} label="Top Driver" value={topDriver ? `${topDriver.symbol} ${percent(topDriver.todayChangePercent)}` : '-'} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Best Swing Setup" value={bestSwing ? `${bestSwing.symbol} ${bestSwing.swingScore}` : '-'} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {indexTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveIndex(tab.key)}
                className={`h-9 rounded-md border px-3 text-sm font-semibold ${activeIndex === tab.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-slate-700 hover:border-slate-400'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_170px_140px] xl:items-end">
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Search
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Symbol or company" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
              </span>
            </label>
            <Select label="Setup" value={setup} onChange={(value) => setSetup(value as SetupFilter)} options={['All', 'Momentum Leader', 'Early Reclaim', 'Pullback Watch', 'Avoid Chase']} />
            <Select label="Direction" value={direction} onChange={(value) => setDirection(value as DirectionFilter)} options={['Positive', 'All', 'Negative']} />
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1980px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company', 'Sector', 'Setup', 'Previous Close', 'Current Price', 'Today', '5D', '20D', 'Rel Vol', 'Dollar Vol', 'Market Cap', 'Driver Weight', 'Swing Score', 'Driver Score', 'Reason'].map((heading) => (
                  <th key={heading} className="bg-slate-50 px-3 py-3">
                    <span>{heading}</span>
                    {heading === 'Current Price' && todayHeaderLabel && (
                      <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold normal-case text-slate-400">
                        {todayHeaderLabel}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => <DriverRow key={row.symbol} row={row} onSelect={onSelect} />)}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    {state === 'loading' || state === 'refreshing' ? 'Loading index leadership rows...' : 'No index driver rows match these filters.'}
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

const DriverRow = ({ row, onSelect }: { row: IndexDriverRow; onSelect?: (symbol: string) => void }) => (
  <tr className="border-t border-line align-top hover:bg-slate-50">
    <td className="px-3 py-3">
      <button className="font-semibold text-signal hover:underline" onClick={() => onSelect?.(row.symbol)}>
        {row.symbol}
      </button>
    </td>
    <td className="px-3 py-3 font-medium text-ink">{row.company}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{row.sector}</td>
    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${setupClass(row.setup)}`}>{row.setup}</span></td>
    <td className="px-3 py-3 font-semibold text-ink">
      {currency(row.previousClose)}
      <p className={`mt-1 whitespace-nowrap text-[10px] font-semibold ${row.previousCloseChangePercent >= 0 ? 'text-gain' : 'text-loss'}`}>
        Prev session {percent(row.previousCloseChangePercent)}
      </p>
    </td>
    <td className="px-3 py-3 font-semibold text-ink">
      {currency(row.price)}
      <p className="mt-1 whitespace-nowrap text-[10px] font-semibold text-slate-400">{row.priceSession}</p>
    </td>
    <td className={`px-3 py-3 font-semibold ${row.todayChangePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.todayChangePercent)}</td>
    <td className={`px-3 py-3 ${row.fiveDayChangePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.fiveDayChangePercent)}</td>
    <td className={`px-3 py-3 ${row.twentyDayChangePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{percent(row.twentyDayChangePercent)}</td>
    <td className="px-3 py-3">{row.volumeRatio.toFixed(2)}x</td>
    <td className="px-3 py-3">{compactCurrency(row.dollarVolume)}</td>
    <td className="px-3 py-3">{compactNumber(row.marketCap)}</td>
    <td className={`px-3 py-3 font-semibold ${row.estimatedContribution >= 0 ? 'text-gain' : 'text-loss'}`}>
      {row.estimatedContribution >= 0 ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : <TrendingDown className="mr-1 inline h-3.5 w-3.5" />}
      {compactNumber(Math.abs(row.estimatedContribution))}
    </td>
    <td className="px-3 py-3 font-semibold">{row.swingScore}</td>
    <td className="px-3 py-3 font-semibold">{row.driverScore}</td>
    <td className="max-w-md px-3 py-3 text-xs text-slate-600">{row.reason}</td>
  </tr>
);

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="grid gap-1 text-xs font-semibold text-slate-500">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-sm font-medium text-ink">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);

const SummaryCard = ({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number | string; detail?: string }) => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between text-slate-500"><p className="text-sm">{label}</p><span className="text-signal">{icon}</span></div>
    <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    {detail && <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>}
  </div>
);
