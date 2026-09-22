import { useEffect, useMemo, useState } from 'react';
import { Activity, ExternalLink, Gauge, Search, ShieldCheck, TrendingUp } from 'lucide-react';
import { MarketSeries } from '../types';
import { scanVolatileStocks, VolatileStockRow } from '../lib/volatileStocks';
import { compactNumber, currency, plainPercent } from '../lib/format';
import { readJson, writeJson } from '../lib/storage';

type Props = {
  market: MarketSeries[];
  onSelect: (symbol: string) => void;
};

type DirectionFilter = 'All' | VolatileStockRow['direction'];
type QualityFilter = 'All' | VolatileStockRow['quality'];
type SetupFilter = 'All' | VolatileStockRow['setup'];
type ReadinessFilter = 'All' | VolatileStockRow['readiness'];
type VolatileFilterState = {
  search: string;
  direction: DirectionFilter;
  quality: QualityFilter;
  setup: SetupFilter;
  readiness: ReadinessFilter;
  highQualityOnly: boolean;
};

const FILTER_KEY = 'swing_most_volatile_filters_v1';
const defaultFilters: VolatileFilterState = {
  search: '',
  direction: 'Bullish',
  quality: 'All',
  setup: 'All',
  readiness: 'Entry Setup',
  highQualityOnly: true
};

const badgeClass = (value: string) => {
  if (value === 'High' || value === 'Bullish' || value === 'Entry Setup') return 'bg-emerald-100 text-emerald-700';
  if (value === 'Medium' || value === 'Two-way' || value === 'Pullback Reversal' || value === 'Watch') return 'bg-blue-100 text-blue-700';
  if (value === 'Bearish' || value === 'Avoid') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

const tradingViewUrlFor = (series?: MarketSeries, symbol?: string) => {
  const exchange = series?.profile.tradingViewExchange || series?.profile.exchange || 'NASDAQ';
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${exchange}:${symbol || series?.profile.symbol || ''}`)}`;
};

export const MostVolatileToday = ({ market, onSelect }: Props) => {
  const rows = useMemo(() => scanVolatileStocks(market), [market]);
  const [filters, setFilters] = useState<VolatileFilterState>(() => ({ ...defaultFilters, ...readJson(FILTER_KEY, defaultFilters) }));
  const { search, direction, quality, setup, readiness, highQualityOnly } = filters;

  useEffect(() => {
    writeJson(FILTER_KEY, filters);
  }, [filters]);

  const updateFilter = <K extends keyof VolatileFilterState>(key: K, value: VolatileFilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const visibleRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.symbol.toLowerCase().includes(query) || row.company.toLowerCase().includes(query)) &&
      (direction === 'All' || row.direction === direction) &&
      (quality === 'All' || row.quality === quality) &&
      (setup === 'All' || row.setup === setup) &&
      (readiness === 'All' || row.readiness === readiness) &&
      (!highQualityOnly || row.quality === 'High');
  }), [direction, highQualityOnly, quality, readiness, rows, search, setup]);

  const bullishCount = rows.filter((row) => row.direction === 'Bullish').length;
  const highQualityCount = rows.filter((row) => row.quality === 'High').length;
  const entrySetupCount = rows.filter((row) => row.readiness === 'Entry Setup').length;
  const pullbackReversalCount = rows.filter((row) => row.setup === 'Pullback Reversal').length;
  const topRange = rows[0]?.todayRangePercent ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Most Volatile Today</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-600">
          Ranks liquid U.S. stocks with the biggest tradable range, then shortlists the best long-entry candidates using liquidity,
          relative volume, bullish direction, controlled pullback, and at least 1.5x reward/risk for a 2% target.
        </p>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-4">
          <Rule label="Entry Setup" value="Bullish, liquid, high relative volume, holding the upper half of today's range, and clean risk/reward." />
          <Rule label="Watch" value="Interesting volatility, but one or two items still need confirmation before entry." />
          <Rule label="Avoid" value="Direction, volume, extension, or reward/risk is not clean enough for a long-entry shortlist." />
          <Rule label="Important" value="This uses delayed daily chart data. Confirm live spread, news, and VWAP in your broker before placing any order." />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Entry Setups" value={entrySetupCount} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Bullish Movers" value={bullishCount} />
        <SummaryCard icon={<Gauge className="h-5 w-5" />} label="Pullback Reversals" value={pullbackReversalCount} />
        <SummaryCard icon={<Activity className="h-5 w-5" />} label="High Quality Volatile" value={highQualityCount || `${topRange.toFixed(2)}% top range`} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_140px_150px_170px_auto] xl:items-end">
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Search
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Symbol or company" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
              </span>
            </label>
            <Select label="Readiness" value={readiness} onChange={(value) => updateFilter('readiness', value as ReadinessFilter)} options={['All', 'Entry Setup', 'Watch', 'Avoid']} />
            <Select label="Direction" value={direction} onChange={(value) => updateFilter('direction', value as DirectionFilter)} options={['All', 'Bullish', 'Two-way', 'Bearish']} />
            <Select label="Quality" value={quality} onChange={(value) => updateFilter('quality', value as QualityFilter)} options={['All', 'High', 'Medium', 'Speculative']} />
            <Select label="Setup" value={setup} onChange={(value) => updateFilter('setup', value as SetupFilter)} options={['All', 'Momentum', 'Pullback Reversal']} />
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-slate-50 px-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={highQualityOnly} onChange={(event) => updateFilter('highQualityOnly', event.target.checked)} />
              High quality only
            </label>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1840px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company', 'Sector', 'Readiness', 'Entry Trigger', 'Price', 'Move', 'Range', 'From High', 'Range Pos', 'Open-Close', 'Volume', 'Dollar Vol', 'Setup', 'Quality', 'Direction', 'Score', '2% Target', 'Stop', 'R/R', 'TradingView', 'Reason'].map((heading) => (
                  <th key={heading} className="bg-slate-50 px-3 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.symbol} className="border-t border-line align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <button className="font-semibold text-signal hover:underline" onClick={() => onSelect(row.symbol)}>
                      {row.symbol}
                    </button>
                  </td>
                  <td className="px-3 py-3 font-medium text-ink">{row.company}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{row.sector}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.readiness)}`}>{row.readiness}</span>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{row.readinessScore}/100</p>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-slate-600">
                    <p className="font-medium text-ink">{row.entryTrigger}</p>
                    {row.readinessBlockers.length > 0 && <p className="mt-1 text-amber-700">{row.readinessBlockers.slice(0, 2).join(' ')}</p>}
                  </td>
                  <td className="px-3 py-3">{currency(row.price)}</td>
                  <td className={`px-3 py-3 font-semibold ${row.todayMovePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{plainPercent(row.todayMovePercent)}</td>
                  <td className="px-3 py-3 font-semibold text-ink">{plainPercent(row.todayRangePercent)}</td>
                  <td className="px-3 py-3">{plainPercent(row.pullbackFromHighPercent)}</td>
                  <td className="px-3 py-3">{plainPercent(row.rangePositionPercent)}</td>
                  <td className={`px-3 py-3 ${row.openToClosePercent >= 0 ? 'text-gain' : 'text-loss'}`}>{plainPercent(row.openToClosePercent)}</td>
                  <td className="px-3 py-3">{row.volumeRatio.toFixed(2)}x</td>
                  <td className="px-3 py-3">{compactNumber(row.dollarVolume)}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.setup)}`}>{row.setup}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.quality)}`}>{row.quality}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.direction)}`}>{row.direction}</span></td>
                  <td className="px-3 py-3 font-semibold">{row.score}</td>
                  <td className="px-3 py-3 text-gain">{currency(row.twoPercentTarget)}</td>
                  <td className="px-3 py-3 text-loss">{currency(row.suggestedStop)}</td>
                  <td className="px-3 py-3 font-semibold">{row.rewardRisk.toFixed(2)}x</td>
                  <td className="px-3 py-3">
                    <a
                      href={tradingViewUrlFor(market.find((series) => series.profile.symbol === row.symbol), row.symbol)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-semibold text-ink hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <p>{row.readinessReasons.slice(0, 3).join('. ') || row.reason}</p>
                    <p className="mt-1 text-slate-500">{row.reason}</p>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={22} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No volatile stocks match these readiness filters right now.
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

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="grid gap-1 text-xs font-semibold text-slate-500">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-sm font-medium text-ink">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);

const SummaryCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between text-slate-500"><p className="text-sm">{label}</p><span className="text-signal">{icon}</span></div>
    <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
  </div>
);

const Rule = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
    <p className="font-semibold text-blue-900">{label}</p>
    <p className="mt-1 text-blue-800">{value}</p>
  </div>
);
