import { AlertRule, AppSettings, TradePlan, WatchlistItem } from '../types';
import { defaultSettings, strategyNames } from '../engine/strategyEngine';
import { currency, plainPercent } from '../lib/format';
import { Bell, CheckCircle2, PlugZap, Trash2 } from 'lucide-react';

type WatchProps = {
  items: WatchlistItem[];
  onRemove: (id: string) => void;
};

export const WatchlistPanel = ({ items, onRemove }: WatchProps) => (
  <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <h2 className="font-semibold text-ink">Watchlist</h2>
    <p className="mt-1 text-sm text-slate-500">Stocks you are monitoring for a clean trigger.</p>
    <div className="mt-4 space-y-3">
      {items.length === 0 && <Empty text="No watchlist items yet. Add a stock from any strategy card." />}
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
          <div>
            <p className="font-semibold text-ink">{item.symbol}</p>
            <p className="text-xs text-slate-500">{strategyNames[item.strategyId]} / {item.status}</p>
            <p className="mt-1 text-xs text-slate-600">Entry {currency(item.entry)} Target {currency(item.target)} Stop {currency(item.stop)}</p>
          </div>
          <button onClick={() => onRemove(item.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-loss">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  </section>
);

type PlanProps = {
  plans: TradePlan[];
  onRemove: (id: string) => void;
};

export const TradePlansPanel = ({ plans, onRemove }: PlanProps) => (
  <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <h2 className="font-semibold text-ink">Trade Plans</h2>
    <p className="mt-1 text-sm text-slate-500">Every setup should have entry, target, stop, and notes before capital is committed.</p>
    <div className="mt-4 space-y-3">
      {plans.length === 0 && <Empty text="No trade plans yet. Create one from a stock detail page." />}
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-md border border-line p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{plan.symbol}</p>
              <p className="text-xs text-slate-500">{strategyNames[plan.strategyId]}</p>
            </div>
            <button onClick={() => onRemove(plan.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-loss">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-md bg-slate-50 p-2">Entry <strong>{currency(plan.entry)}</strong></span>
            <span className="rounded-md bg-emerald-50 p-2 text-emerald-700">Target <strong>{currency(plan.target)}</strong></span>
            <span className="rounded-md bg-red-50 p-2 text-red-700">Stop <strong>{currency(plan.stop)}</strong></span>
          </div>
          <p className="mt-3 text-sm text-slate-600">{plan.notes}</p>
        </div>
      ))}
    </div>
  </section>
);

type AlertProps = {
  alerts: AlertRule[];
  prices: Record<string, number>;
  onRemove: (id: string) => void;
};

export const AlertsPanel = ({ alerts, prices, onRemove }: AlertProps) => (
  <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <div className="flex items-center gap-2">
      <Bell className="h-4 w-4 text-signal" />
      <h2 className="font-semibold text-ink">Alerts</h2>
    </div>
    <p className="mt-1 text-sm text-slate-500">V1 alerts are evaluated inside the app from the latest available price.</p>
    <div className="mt-4 space-y-3">
      {alerts.length === 0 && <Empty text="No alerts yet. Create alerts from a stock detail page." />}
      {alerts.map((alert) => {
        const price = prices[alert.symbol] ?? 0;
        const hit = alert.kind === 'stop' ? price <= alert.level : price >= alert.level * 0.995;
        return (
          <div key={alert.id} className={`flex items-center justify-between gap-3 rounded-md border p-3 ${hit ? 'border-emerald-200 bg-emerald-50' : 'border-line'}`}>
            <div>
              <p className="font-semibold text-ink">{alert.symbol} {alert.kind}</p>
              <p className="text-xs text-slate-600">Level {currency(alert.level)} / Latest {currency(price)}</p>
              {hit && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Trigger zone reached</p>}
            </div>
            <button onClick={() => onRemove(alert.id)} className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-loss">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  </section>
);

type SettingsProps = {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
};

export const SettingsPanel = ({ settings, onChange }: SettingsProps) => {
  const update = (key: keyof AppSettings, value: number) => onChange({ ...settings, [key]: value });
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <h2 className="font-semibold text-ink">Settings</h2>
      <p className="mt-1 text-sm text-slate-500">Tune the universal filters used by all strategies.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NumberField label="Minimum market cap" value={settings.minMarketCap} step={500000000} onChange={(value) => update('minMarketCap', value)} formatter={(value) => `$${(value / 1000000000).toFixed(1)}B`} />
        <NumberField label="Minimum price" value={settings.minPrice} step={1} onChange={(value) => update('minPrice', value)} formatter={(value) => currency(value)} />
        <NumberField label="Minimum avg volume" value={settings.minAverageVolume} step={250000} onChange={(value) => update('minAverageVolume', value)} formatter={(value) => value.toLocaleString()} />
        <NumberField label="Minimum dollar volume" value={settings.minDollarVolume} step={5000000} onChange={(value) => update('minDollarVolume', value)} formatter={(value) => `$${(value / 1000000).toFixed(0)}M`} />
        <NumberField label="Target percent" value={settings.targetPercent} step={0.5} onChange={(value) => update('targetPercent', value)} formatter={plainPercent} />
        <NumberField label="Max risk percent" value={settings.maxRiskPercent} step={0.25} onChange={(value) => update('maxRiskPercent', value)} formatter={plainPercent} />
      </div>
      <button onClick={() => onChange(defaultSettings)} className="mt-4 h-9 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-slate-50">
        Reset Defaults
      </button>
      <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2 font-semibold text-blue-900">
          <PlugZap className="h-4 w-4" />
          Trading 212 Connector
        </div>
        <p className="mt-2 text-sm text-blue-800">
          V1 keeps Trading 212 keys out of the browser. Add the API key and secret only as Netlify server environment variables, then connect via the server function when read-only account sync is enabled.
        </p>
      </div>
    </section>
  );
};

const NumberField = ({ label, value, step, onChange, formatter }: { label: string; value: number; step: number; onChange: (value: number) => void; formatter: (value: number) => string }) => (
  <label className="block">
    <span className="text-sm font-semibold text-ink">{label}</span>
    <span className="ml-2 text-xs text-slate-500">{formatter(value)}</span>
    <input
      className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-blue-100"
      type="number"
      value={value}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);

const Empty = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">{text}</div>
);
