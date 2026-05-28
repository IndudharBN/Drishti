import { ArrowLeft, Bell, ClipboardList, PlusCircle } from 'lucide-react';
import { RankedStock, StrategyResult } from '../types';
import { compactCurrency, currency, plainPercent, percent } from '../lib/format';
import { TradingChart } from './TradingChart';
import { StrategyChecks } from './StrategyChecks';

type Props = {
  stock: RankedStock;
  onBack: () => void;
  onAddWatch: (stock: RankedStock, result?: StrategyResult) => void;
  onCreateTradePlan: (stock: RankedStock, result?: StrategyResult) => void;
  onCreateAlerts: (stock: RankedStock, result?: StrategyResult) => void;
};

export const StockDetail = ({ stock, onBack, onAddWatch, onCreateTradePlan, onCreateAlerts }: Props) => {
  const { profile } = stock.series;
  const result = stock.bestResult;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </button>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-ink">{profile.symbol}</h1>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                Best score {result.score}
              </span>
            </div>
          <p className="mt-1 text-slate-600">{profile.company}</p>
          <p className="mt-1 text-sm text-slate-500">{profile.sector} / {profile.industry}</p>
          <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Yahoo Finance delayed chart data / updated {stock.series.lastUpdated}
          </p>
        </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[560px]">
            <Metric label="Market cap" value={compactCurrency(profile.marketCap)} />
            <Metric label="Avg volume" value={profile.avgVolume.toLocaleString()} />
            <Metric label="SPY rel. 20d" value={percent(stock.series.spyRelative20)} />
            <Metric label="Sector rel. 20d" value={percent(stock.series.sectorRelative20)} />
          </div>
        </div>
      </section>

      <TradingChart series={stock.series} result={result} />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <h2 className="font-semibold text-ink">Strategy Results</h2>
          <div className="mt-3 space-y-3">
            {stock.results.map((item) => (
              <div key={item.strategyId} className="rounded-md border border-line p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold text-ink">{item.strategyName}</p>
                    <p className="text-sm text-slate-500">Status: {item.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold">Score {item.score}</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Target {currency(item.target)}</span>
                    <span className="rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">Stop {currency(item.stop)}</span>
                    <span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">R/R {item.rewardRisk.toFixed(2)}x</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.reasons.join(' ')}</p>
                {item.blockers.length > 0 && <p className="mt-2 text-xs text-amber-700">{item.blockers.join(' ')}</p>}
                {item.checks && (
                  <>
                    <p className="mt-3 text-sm font-semibold text-ink">{item.strategyName} Filter Breakdown</p>
                    <StrategyChecks checks={item.checks} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <h2 className="font-semibold text-ink">Selected Trade Plan</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Entry" value={currency(result.entry)} />
              <Metric label="Target" value={currency(result.target)} />
              <Metric label="Stop" value={currency(result.stop)} />
              <Metric label="Risk" value={plainPercent(result.riskPercent)} />
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={() => onAddWatch(stock, result)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-slate-50">
                <PlusCircle className="h-4 w-4" />
                Add to Watchlist
              </button>
              <button onClick={() => onCreateTradePlan(stock, result)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <ClipboardList className="h-4 w-4" />
                Create Trade Plan
              </button>
              <button onClick={() => onCreateAlerts(stock, result)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                <Bell className="h-4 w-4" />
                Create Entry/Target/Stop Alerts
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <h2 className="font-semibold text-ink">Professional Read</h2>
            <p className="mt-2 text-sm text-slate-600">
              The Pro Trader model only passes names where market context, sector strength, stock leadership, setup quality, and risk/reward agree.
            </p>
            <p className="mt-3 text-sm font-semibold text-ink">Pro score: {stock.proResult.score}</p>
            <p className="mt-1 text-sm text-slate-600">{stock.proResult.reasons.join(' ')}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-slate-50 p-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="font-semibold text-ink">{value}</p>
  </div>
);
