import { useMemo, useState } from 'react';
import { Crosshair, Search, ShieldCheck, Target, TrendingUp, Volume2 } from 'lucide-react';
import { MarketSeries } from '../types';
import { RangeBoundPosition, RangeBoundQuality, RangeBoundRow, scanRangeBoundStocks } from '../lib/rangeBoundScanner';
import { compactNumber, currency, plainPercent } from '../lib/format';

type Props = {
  market: MarketSeries[];
  onSelect: (symbol: string) => void;
};

type QualityFilter = 'All' | RangeBoundQuality;
type PositionFilter = 'All' | RangeBoundPosition;

const badgeClass = (value: string) => {
  if (value === 'High' || value === 'At Support') return 'bg-emerald-100 text-emerald-700';
  if (value === 'Bottom Zone') return 'bg-blue-100 text-blue-700';
  if (value === 'Medium' || value === 'Middle') return 'bg-blue-100 text-blue-700';
  if (value === 'Top Zone' || value === 'Breaking Support') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
};

export const RangeBoundScanner = ({ market, onSelect }: Props) => {
  const rows = useMemo(() => scanRangeBoundStocks(market), [market]);
  const [search, setSearch] = useState('');
  const [quality, setQuality] = useState<QualityFilter>('All');
  const [position, setPosition] = useState<PositionFilter>('At Support');
  const [sector, setSector] = useState('All');

  const sectors = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => row.sector))).sort()], [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.symbol.toLowerCase().includes(query) || row.company.toLowerCase().includes(query)) &&
      (quality === 'All' || row.quality === quality) &&
      (position === 'All' || row.position === position) &&
      (sector === 'All' || row.sector === sector);
  }).slice(0, 45), [position, quality, rows, search, sector]);

  const supportCount = rows.filter((row) => row.position === 'At Support').length;
  const highQualityCount = rows.filter((row) => row.quality === 'High').length;
  const averageUpside = rows.length > 0 ? rows.reduce((sum, row) => sum + row.rangeUpsidePercent, 0) / rows.length : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Range Bound Shares</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-600">
              Tracks liquid, quality U.S. shares moving sideways between repeated support and resistance. The default view now shows only shares
              trading directly at support, then separates names that have already moved into a broader bottom zone.
            </p>
          </div>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
            Delayed daily candles. Confirm live spread, news, and intraday support before placing any order.
          </span>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-4">
          <Rule label="At Support" value="Price is within roughly 1.2% above repeated support, or no more than 0.8% below it." />
          <Rule label="Top" value="Resistance is estimated from repeated highs; take profits before crowding appears." />
          <Rule label="Quality" value="Requires market cap, volume, dollar volume, and multiple support/resistance touches." />
          <Rule label="Risk" value="Breaking Support is separated from At Support because the range may be failing." />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="High Quality Ranges" value={highQualityCount} />
        <SummaryCard icon={<Crosshair className="h-5 w-5" />} label="At Support" value={supportCount} />
        <SummaryCard icon={<Target className="h-5 w-5" />} label="Avg Room to Top" value={`${averageUpside.toFixed(2)}%`} />
        <SummaryCard icon={<Volume2 className="h-5 w-5" />} label="Visible Candidates" value={visibleRows.length} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_120px_160px_180px] xl:items-end">
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Search
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Symbol or company" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
              </span>
            </label>
            <Select label="Quality" value={quality} onChange={(value) => setQuality(value as QualityFilter)} options={['All', 'High', 'Medium', 'Watch']} />
            <Select label="Position" value={position} onChange={(value) => setPosition(value as PositionFilter)} options={['At Support', 'All', 'Bottom Zone', 'Middle', 'Top Zone', 'Breaking Support']} />
            <Select label="Sector" value={sector} onChange={setSector} options={sectors} />
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1740px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company', 'Sector', 'Quality', 'Position', 'Price', 'Buy Zone', 'Support', 'From Support', 'Resistance', 'To Top', 'Range Width', '2% Target', '3% Target', '4% Target', 'Stop', 'Touches', 'Volume', 'Score', 'Reason'].map((heading) => (
                  <th key={heading} className="bg-slate-50 px-3 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => <RangeRow key={row.symbol} row={row} onSelect={onSelect} />)}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No shares are trading directly at repeated support right now. Switch Position to Bottom Zone or All only if you want a pullback watchlist.
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

const RangeRow = ({ row, onSelect }: { row: RangeBoundRow; onSelect: (symbol: string) => void }) => (
  <tr className="border-t border-line align-top hover:bg-slate-50">
    <td className="px-3 py-3">
      <button className="font-semibold text-signal hover:underline" onClick={() => onSelect(row.symbol)}>
        {row.symbol}
      </button>
    </td>
    <td className="px-3 py-3 font-medium text-ink">{row.company}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{row.sector}</td>
    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.quality)}`}>{row.quality}</span></td>
    <td className="px-3 py-3">
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.position)}`}>{row.position}</span>
      <p className="mt-1 text-xs text-slate-500">{plainPercent(row.rangePositionPercent)} through range</p>
    </td>
    <td className="px-3 py-3 font-semibold text-ink">{currency(row.price)}</td>
    <td className="px-3 py-3 font-medium text-gain">{currency(row.buyZoneLow)} - {currency(row.buyZoneHigh)}</td>
    <td className="px-3 py-3">{currency(row.support)}</td>
    <td className={`px-3 py-3 font-semibold ${Math.abs(row.distanceFromSupportPercent) <= 1.2 ? 'text-gain' : row.distanceFromSupportPercent < -0.8 ? 'text-loss' : 'text-slate-700'}`}>{plainPercent(row.distanceFromSupportPercent)}</td>
    <td className="px-3 py-3">{currency(row.resistance)}</td>
    <td className="px-3 py-3 font-semibold text-gain">{plainPercent(row.rangeUpsidePercent)}</td>
    <td className="px-3 py-3">{plainPercent(row.rangeWidthPercent)}</td>
    <td className="px-3 py-3">{currency(row.target2)}</td>
    <td className="px-3 py-3">{currency(row.target3)}</td>
    <td className="px-3 py-3">{currency(row.target4)}</td>
    <td className="px-3 py-3 font-semibold text-loss">{currency(row.stop)}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{row.supportTouches} bottom / {row.resistanceTouches} top</td>
    <td className="px-3 py-3 text-xs text-slate-600">{compactNumber(row.avgVolume20)} avg / {row.volumeRatio.toFixed(2)}x</td>
    <td className="px-3 py-3 font-semibold">{row.score}</td>
    <td className="max-w-sm px-3 py-3 text-xs text-slate-600">{row.reason}</td>
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
