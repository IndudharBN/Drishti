import { AlertTriangle, BrainCircuit, Eye, Plus, ShieldCheck, TrendingUp } from 'lucide-react';
import { RankedStock, StrategyId } from '../types';
import { compactCurrency, compactNumber, currency, plainPercent } from '../lib/format';
import { StrategyChecks } from './StrategyChecks';
import { analyzeSentiment } from '../lib/sentiment';

type Props = {
  stock: RankedStock;
  activeStrategy: StrategyId | 'all';
  onSelect: (symbol: string) => void;
  onAddWatch: (stock: RankedStock) => void;
};

const toneForScore = (score: number) => {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 65) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (score >= 45) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

export const StockCard = ({ stock, activeStrategy, onSelect, onAddWatch }: Props) => {
  const { profile } = stock.series;
  const result = activeStrategy === 'all'
    ? stock.bestResult
    : stock.results.find((item) => item.strategyId === activeStrategy) ?? stock.bestResult;
  const price = stock.series.candles.at(-1)?.close ?? result.entry;
  const sentiment = analyzeSentiment(stock, activeStrategy);
  const sentimentToneClass = sentiment.index >= 62
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : sentiment.index >= 45
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : sentiment.index >= 30
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';

  return (
    <article className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-ink">{profile.symbol}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneForScore(result.score)}`}>
              {result.score}
            </span>
            {stock.confluence >= 2 && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                {stock.confluence} strategy confluence
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{profile.company}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{profile.sector} / {profile.industry}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-ink">{currency(price)}</p>
          <p className="text-xs text-slate-500">{compactCurrency(profile.marketCap)} cap</p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Yahoo delayed data
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Entry</p>
          <p className="font-semibold text-ink">{currency(result.entry)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">5% Target</p>
          <p className="font-semibold text-gain">{currency(result.target)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Stop</p>
          <p className="font-semibold text-loss">{currency(result.stop)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">R/R</p>
          <p className="font-semibold text-ink">{result.rewardRisk.toFixed(2)}x</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.results.filter((item) => item.score >= 70).slice(0, 4).map((item) => (
          <span key={item.strategyId} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {item.strategyName}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-md bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <TrendingUp className="h-4 w-4 text-signal" />
          {result.strategyName}
        </div>
        <p className="mt-2 text-sm text-slate-600">{result.reasons[0]}</p>
        {result.blockers.length > 0 && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{result.blockers[0]}</span>
          </div>
        )}
        <StrategyChecks checks={result.checks} compact />
        <div className="mt-3 rounded-md border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BrainCircuit className="h-4 w-4 text-signal" />
              Sentiment Analysis
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sentimentToneClass}`}>
                {sentiment.tone}
              </span>
              <span className="rounded-full border border-line bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Index {sentiment.index}/100
              </span>
              <span className="rounded-full border border-line bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Score {sentiment.score > 0 ? '+' : ''}{sentiment.score}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">{sentiment.summary}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[520px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2">Current</th>
                  <th className="px-3 py-2 text-right">Impact</th>
                </tr>
              </thead>
              <tbody>
                {sentiment.details.map((detail) => (
                  <tr key={detail.label} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">{detail.label}</td>
                    <td className="px-3 py-2 text-slate-700">{detail.value}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      detail.impact === 'Positive'
                        ? 'text-emerald-700'
                        : detail.impact === 'Negative'
                          ? 'text-red-700'
                          : 'text-slate-600'
                    }`}>
                      {detail.impact}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Avg volume {compactNumber(profile.avgVolume)} / Risk {plainPercent(result.riskPercent)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onAddWatch(stock)} className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Watch
          </button>
          <button onClick={() => onSelect(profile.symbol)} className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Eye className="h-4 w-4" />
            Analyze
          </button>
        </div>
      </div>
      {stock.proResult.score >= 80 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <ShieldCheck className="h-4 w-4" />
          Passes the stricter Pro Trader model.
        </div>
      )}
    </article>
  );
};
