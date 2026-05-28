import { StrategyCheck } from '../types';
import { CheckCircle2, XCircle } from 'lucide-react';

type Props = {
  checks?: StrategyCheck[];
  compact?: boolean;
};

export const StrategyChecks = ({ checks, compact = false }: Props) => {
  if (!checks || checks.length === 0) return null;

  if (compact) {
    const passed = checks.filter((item) => item.passed).length;
    return (
      <div className="mt-3 overflow-hidden rounded-md border border-line bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Filter pass</p>
          <p className="text-xs font-semibold text-ink">{passed}/{checks.length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[620px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Filter</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2 text-center">Pts</th>
                <th className="px-3 py-2 text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((item) => (
                <tr key={item.label} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-semibold text-ink">{item.label}</td>
                  <td className="px-3 py-2 text-slate-600">{item.required}</td>
                  <td className="px-3 py-2 text-slate-700">{item.actual}</td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-600">{item.points}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={item.passed ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                      {item.passed ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-line">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Filter</th>
            <th className="px-3 py-2">Required</th>
            <th className="px-3 py-2">Current value</th>
            <th className="px-3 py-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((item) => (
            <tr key={item.label} className="border-t border-line">
              <td className="px-3 py-2 font-medium text-ink">{item.label}</td>
              <td className="px-3 py-2 text-slate-600">{item.required}</td>
              <td className="px-3 py-2 text-slate-600">{item.actual}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {item.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {item.passed ? 'Pass' : 'Fail'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
