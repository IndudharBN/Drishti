import { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Search, ShieldCheck, TrendingUp, Volume2 } from 'lucide-react';
import { MarketSeries } from '../types';
import { BandBounceRow, BandBounceStrength, BandBounceTimeframe, sampleBandBounceRows, scanBandBounces } from '../lib/bandBounceScanner';
import { currency } from '../lib/format';
import { BandBounceChart } from './BandBounceChart';

type Props = {
  market: MarketSeries[];
};

type SignalFilter = 'All' | BandBounceRow['signalType'];
type StrengthFilter = 'All' | BandBounceStrength;
type RsiFilter = 'All' | 'Oversold' | 'Neutral' | 'Overbought';

const badgeClass = (value: string) => {
  if (value === 'Strong' || value === 'Strong Buy' || value === 'High volume') return 'bg-emerald-100 text-emerald-700';
  if (value === '2% Bounce Setup') return 'bg-blue-100 text-blue-700';
  if (value === 'Medium') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
};

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="grid gap-1 text-xs font-semibold text-slate-500">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-sm font-medium text-ink">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </label>
);

export const BandBounceScanner = ({ market }: Props) => {
  const liveRows = useMemo(() => scanBandBounces(market), [market]);
  const rows = liveRows.length > 0 ? liveRows : sampleBandBounceRows;
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('All');
  const [strengthFilter, setStrengthFilter] = useState<StrengthFilter>('All');
  const [timeframe, setTimeframe] = useState<BandBounceTimeframe>('Daily');
  const [rsiFilter, setRsiFilter] = useState<RsiFilter>('All');
  const [highVolumeOnly, setHighVolumeOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const rsiGroup = row.rsi < 40 ? 'Oversold' : row.rsi > 60 ? 'Overbought' : 'Neutral';
    return (signalFilter === 'All' || row.signalType === signalFilter) &&
      (strengthFilter === 'All' || row.strength === strengthFilter) &&
      (rsiFilter === 'All' || rsiGroup === rsiFilter) &&
      (!highVolumeOnly || row.volumeStatus === 'High volume') &&
      (!query || row.symbol.toLowerCase().includes(query) || row.company.toLowerCase().includes(query));
  }), [rows, search, signalFilter, strengthFilter, rsiFilter, highVolumeOnly]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Band Bounce Scanner</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Buy-only Bollinger Band EMA/WMA 2% entry scanner. It only shows lower-band reclaim candidates with RSI recovery, upward EMA/WMA confirmation, room to a 2% target, and acceptable reward/risk.</p>
          </div>
          {liveRows.length === 0 && <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Showing labeled sample rows until live matches appear.</span>}
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-4">
          <Rule label="Entry" value="Lower band touch + green close back inside the band" />
          <Rule label="Confirmation" value="EMA or WMA turning up, RSI rising from 30-55" />
          <Rule label="Volume" value="Volume at least 1.1x average, stronger above 1.2x" />
          <Rule label="Trade math" value="2% target must offer at least 1.5x reward/risk" />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Strong Buy Signals" value={rows.filter((row) => row.signalType === 'Strong Buy').length} />
        <SummaryCard icon={<Activity className="h-5 w-5" />} label="2% Bounce Setups" value={rows.filter((row) => row.signalType === '2% Bounce Setup').length} />
        <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="R/R 1.5x+ Signals" value={rows.filter((row) => row.rewardRisk >= 1.5).length} />
        <SummaryCard icon={<Volume2 className="h-5 w-5" />} label="High Volume Signals" value={rows.filter((row) => row.volumeStatus === 'High volume').length} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_130px_120px_120px_auto] xl:items-end">
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Search
              <span className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Symbol or company" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
              </span>
            </label>
            <Select label="Signal Type" value={signalFilter} onChange={(value) => setSignalFilter(value as SignalFilter)} options={['All', 'Strong Buy', '2% Bounce Setup']} />
            <Select label="Strength" value={strengthFilter} onChange={(value) => setStrengthFilter(value as StrengthFilter)} options={['All', 'Strong', 'Medium', 'Weak']} />
            <Select label="Timeframe" value={timeframe} onChange={(value) => setTimeframe(value as BandBounceTimeframe)} options={['5 min', '15 min', '1 hour', 'Daily']} />
            <Select label="RSI" value={rsiFilter} onChange={(value) => setRsiFilter(value as RsiFilter)} options={['All', 'Oversold', 'Neutral', 'Overbought']} />
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-slate-50 px-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={highVolumeOnly} onChange={(event) => setHighVolumeOnly(event.target.checked)} />
              High Volume only
            </label>
          </div>
          {timeframe !== 'Daily' && <p className="mt-3 text-xs font-medium text-amber-700">Current market feed provides daily candles. Displayed rows remain daily until intraday candles are connected.</p>}
        </div>

        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-[1780px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
              <tr>
                {['Symbol', 'Company Name', 'Current Price', 'Signal Type', 'Signal Strength', 'Bollinger Band Position', 'EMA Trend', 'WMA Trend', 'RSI', 'Volume Status', 'Entry Price', 'Stop Loss', '2% Target', 'Upper Band Target', 'Risk Reward', 'Last Signal Time'].map((heading) => <th key={heading} className="bg-slate-50 px-3 py-3">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => <ScannerRow key={row.symbol} row={row} series={market.find((series) => series.profile.symbol === row.symbol)} open={expanded === row.symbol} onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)} />)}
              {visibleRows.length === 0 && <tr><td colSpan={16} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No 2% Bollinger bounce setups match these filters right now.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
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

const ScannerRow = ({ row, series, open, onToggle }: { row: BandBounceRow; series?: MarketSeries; open: boolean; onToggle: () => void }) => (
  <>
    <tr onClick={onToggle} className="cursor-pointer border-t border-line align-top hover:bg-slate-50">
      <td className="px-3 py-3 font-semibold text-signal">{row.symbol} {open ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />}</td>
      <td className="px-3 py-3 font-medium text-ink">{row.company}</td>
      <td className="px-3 py-3">{currency(row.price)}</td>
      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.signalType)}`}>{row.signalType}</span></td>
      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.strength)}`}>{row.strength} {row.score}</span></td>
      <td className="px-3 py-3 text-xs text-slate-600">{row.bandPosition}</td>
      <td className="px-3 py-3">{row.emaTrend}</td>
      <td className="px-3 py-3">{row.wmaTrend}</td>
      <td className="px-3 py-3">{row.rsi.toFixed(1)}</td>
      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.volumeStatus)}`}>{row.volumeStatus}</span></td>
      <td className="px-3 py-3">{currency(row.entry)}</td>
      <td className="px-3 py-3 text-loss">{currency(row.stop)}</td>
      <td className="px-3 py-3">{currency(row.target1)}</td>
      <td className="px-3 py-3 text-gain">{currency(row.target2)}</td>
      <td className="px-3 py-3 font-semibold">{row.rewardRisk.toFixed(2)}x</td>
      <td className="px-3 py-3 text-xs text-slate-600">{row.lastSignalTime}</td>
    </tr>
    {open && (
      <tr className="border-t border-line bg-slate-50">
        <td colSpan={16} className="p-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h3 className="font-semibold text-ink">{row.symbol} / {row.company}</h3>
              <p className="mt-2 text-sm text-slate-600">{row.reason}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">Risk/reward: entry {currency(row.entry)}, stop {currency(row.stop)}, 2% target {currency(row.target1)}, upper-band target {currency(row.target2)}. The 2% target offers {row.rewardRisk.toFixed(2)}x reward/risk.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Metric label="Bollinger Bands" value={`${currency(row.lowerBand)} / ${currency(row.middleBand)} / ${currency(row.upperBand)}`} />
              <Metric label="Bollinger %B" value={row.bollingerPercentB.toFixed(2)} />
              <Metric label="BandWidth" value={`${row.bollingerBandwidth.toFixed(2)}%`} />
              <Metric label="EMA" value={`${currency(row.ema)} / ${row.emaTrend}`} />
              <Metric label="WMA" value={`${currency(row.wma)} / ${row.wmaTrend}`} />
              <Metric label="RSI / Volume" value={`${row.rsi.toFixed(1)} / ${row.volumeRatio.toFixed(2)}x`} />
            </div>
          </div>
          <BandBounceChart row={row} series={series} />
        </td>
      </tr>
    )}
  </>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-line bg-white p-2">
    <p className="text-slate-500">{label}</p>
    <p className="mt-1 font-semibold text-ink">{value}</p>
  </div>
);
