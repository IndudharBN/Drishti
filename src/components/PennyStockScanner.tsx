import { useMemo, useState } from 'react';
import { AlertTriangle, Coins, RefreshCw, Search, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { MarketSeries } from '../types';
import { PennyStockPosition, PennyStockQuality, PennyStockRow, scanPennyStocks } from '../lib/pennyStockScanner';
import { compactNumber, currency, plainPercent } from '../lib/format';

type Props = {
  market: MarketSeries[];
  onSelect: (symbol: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

type QualityFilter = 'All' | PennyStockQuality;
type PositionFilter = 'All' | PennyStockPosition;

const badgeClass = (value: string) => {
  if (value === 'Best Watch' || value === 'Bottom Zone') return 'bg-emerald-100 text-emerald-700';
  if (value === 'Speculative Watch') return 'bg-blue-100 text-blue-700';
  if (value === 'Wait Pullback') return 'bg-amber-100 text-amber-700';
  return 'bg-amber-100 text-amber-700';
};

export const PennyStockScanner = ({ market, onSelect, onRefresh, isRefreshing }: Props) => {
  const rows = useMemo(() => scanPennyStocks(market), [market]);
  const pennyUniverseCount = useMemo(() => market.filter((series) => {
    const price = series.candles.at(-1)?.close ?? 0;
    return series.profile.type === 'stock' && price >= 1 && price <= 5;
  }).length, [market]);
  const [search, setSearch] = useState('');
  const [quality, setQuality] = useState<QualityFilter>('All');
  const [position, setPosition] = useState<PositionFilter>('Bottom Zone');
  const [minUpside, setMinUpside] = useState(5);
  const [bestOnly, setBestOnly] = useState(false);

  const visibleRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.symbol.toLowerCase().includes(query) || row.company.toLowerCase().includes(query)) &&
      (quality === 'All' || row.quality === quality) &&
      (position === 'All' || row.position === position) &&
      row.upsideToResistancePercent >= minUpside &&
      (!bestOnly || row.quality === 'Best Watch');
  }).slice(0, 50), [bestOnly, minUpside, position, quality, rows, search]);

  const bestCount = rows.filter((row) => row.quality === 'Best Watch').length;
  const bottomCount = rows.filter((row) => row.position === 'Bottom Zone').length;
  const averageUpside = rows.length > 0 ? rows.reduce((sum, row) => sum + row.upsideToResistancePercent, 0) / rows.length : 0;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Penny Stocks</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Shortlists $1-$5 U.S. stocks only when they are close to a defended bottom with 5-10% bounce room. Rallied names are marked
              Wait Pullback and hidden from the default view so the table does not encourage chasing.
            </p>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            High-risk watchlist only. Confirm news, filings, spread, and live volume before any trade.
          </span>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-4">
          <Rule label="Price" value="$1 to $5 only; no OTC-style symbols, warrants, rights, units, or blank-check names." />
          <Rule label="Survival" value="Requires at least $100M market cap, acceptable dollar volume, and no severe 60-day collapse." />
          <Rule label="Bottom" value="Price must be close to a repeated 70-session support area, not simply making a fresh breakdown." />
          <Rule label="Target" value="Shows 5% and 10% targets, capped by nearby resistance." />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Best Watch" value={bestCount} />
        <SummaryCard icon={<Coins className="h-5 w-5" />} label="Bottom Zone" value={bottomCount} />
        <SummaryCard icon={<Target className="h-5 w-5" />} label="Avg Room to Resistance" value={`${averageUpside.toFixed(2)}%`} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Penny Universe Loaded" value={pennyUniverseCount} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_150px_170px_auto_auto] xl:items-end">
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Search
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Symbol or company" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
              </span>
            </label>
            <Select label="Quality" value={quality} onChange={(value) => setQuality(value as QualityFilter)} options={['All', 'Best Watch', 'Speculative Watch']} />
            <Select label="Position" value={position} onChange={(value) => setPosition(value as PositionFilter)} options={['Bottom Zone', 'All', 'Wait Pullback']} />
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Minimum room to resistance
              <input
                type="number"
                min={5}
                max={25}
                value={minUpside}
                onChange={(event) => setMinUpside(Number(event.target.value))}
                className="h-9 rounded-md border border-line bg-white px-2 text-sm font-medium text-ink"
              />
            </label>
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-slate-50 px-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={bestOnly} onChange={(event) => setBestOnly(event.target.checked)} />
              Best only
            </label>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Penny Data
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1780px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company', 'Sector', 'Quality', 'Position', 'Price', 'Buy Zone', 'Support', 'Resistance', '5% Target', '10% Target', 'Stop', 'Room', 'From Low', 'Drawdown', 'RSI', 'Volume', 'Market Cap', 'Score', 'Entry Trigger', 'Risk Flags'].map((heading) => (
                  <th key={heading} className="bg-slate-50 px-3 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => <PennyRow key={row.symbol} row={row} onSelect={onSelect} />)}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={21} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No bottom-zone penny candidates pass the current filters. That means no chase entry from this scanner right now; switch Position to All only to build a pullback watchlist.
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

const PennyRow = ({ row, onSelect }: { row: PennyStockRow; onSelect: (symbol: string) => void }) => (
  <tr className="border-t border-line align-top hover:bg-slate-50">
    <td className="px-3 py-3">
      <button className="font-semibold text-signal hover:underline" onClick={() => onSelect(row.symbol)}>
        {row.symbol}
      </button>
    </td>
    <td className="px-3 py-3 font-medium text-ink">{row.company} ({compactNumber(row.marketCap)})</td>
    <td className="px-3 py-3 text-xs text-slate-600">{row.sector}</td>
    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.quality)}`}>{row.quality}</span></td>
    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.position)}`}>{row.position}</span></td>
    <td className="px-3 py-3 font-semibold text-ink">{currency(row.price)}</td>
    <td className="px-3 py-3 font-medium text-gain">{currency(row.buyZoneLow)} - {currency(row.buyZoneHigh)}</td>
    <td className="px-3 py-3">{currency(row.support)}</td>
    <td className="px-3 py-3">{currency(row.resistance)}</td>
    <td className="px-3 py-3 text-gain">{currency(row.target5)}</td>
    <td className="px-3 py-3 text-gain">{currency(row.target10)}</td>
    <td className="px-3 py-3 font-semibold text-loss">{currency(row.stop)}</td>
    <td className="px-3 py-3 font-semibold text-gain">{plainPercent(row.upsideToResistancePercent)}</td>
    <td className="px-3 py-3">{plainPercent(row.distanceFromLowPercent)}</td>
    <td className="px-3 py-3">{plainPercent(row.drawdownFromHighPercent)}</td>
    <td className="px-3 py-3">{row.rsi.toFixed(1)}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{compactNumber(row.avgVolume20)} avg / {row.volumeRatio.toFixed(2)}x</td>
    <td className="px-3 py-3">{compactNumber(row.marketCap)}</td>
    <td className="px-3 py-3 font-semibold">{row.score}</td>
    <td className="max-w-sm px-3 py-3 text-xs text-slate-600">
      <p className="font-medium text-ink">{row.entryTrigger}</p>
      <p className="mt-1">{row.reason}</p>
    </td>
    <td className="max-w-xs px-3 py-3 text-xs text-amber-700">
      {row.riskFlags.length > 0 ? (
        <span className="inline-flex gap-1">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{row.riskFlags.join(' ')}</span>
        </span>
      ) : 'No major scanner risk flags'}
    </td>
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
