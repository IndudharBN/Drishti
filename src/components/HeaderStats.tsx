import { RankedStock } from '../types';
import { Activity, ShieldCheck, Target, TrendingUp } from 'lucide-react';

type Props = {
  stocks: RankedStock[];
};

export const HeaderStats = ({ stocks }: Props) => {
  const proPasses = stocks.filter((stock) => stock.proResult.score >= 80).length;
  const confluence = stocks.filter((stock) => stock.confluence >= 2).length;
  const best = stocks[0];
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat icon={<ShieldCheck className="h-5 w-5" />} label="Pro Trader passes" value={String(proPasses)} />
      <Stat icon={<Target className="h-5 w-5" />} label="Strategy models" value="23" />
      <Stat icon={<Activity className="h-5 w-5" />} label="Confluence names" value={String(confluence)} />
      <Stat icon={<TrendingUp className="h-5 w-5" />} label="Top candidate" value={best ? best.series.profile.symbol : '-'} />
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="text-signal">{icon}</div>
    </div>
    <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
  </div>
);
