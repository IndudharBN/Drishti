import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BarChart3, ClipboardList, Database, ListFilter, RefreshCw, Settings, ShieldCheck, Star } from 'lucide-react';
import { defaultSettings, rankStocks } from './engine/strategyEngine';
import { AlertRule, AppSettings, RankedStock, StrategyId, TradePlan, WatchlistItem } from './types';
import { readJson, writeJson } from './lib/storage';
import { uid } from './lib/format';
import { StrategyTabs } from './components/StrategyTabs';
import { HeaderStats } from './components/HeaderStats';
import { StockCard } from './components/StockCard';
import { ComparisonTable } from './components/ComparisonTable';
import { AlertsPanel, SettingsPanel, TradePlansPanel, WatchlistPanel } from './components/WorkspacePanels';
import { StockDetail } from './components/StockDetail';
import { fetchLiveMarket } from './services/marketData';
import './styles.css';

type Section = 'dashboard' | 'watchlist' | 'alerts' | 'plans' | 'settings';

const WATCHLIST_KEY = 'swing_watchlist_v1';
const TRADE_PLANS_KEY = 'swing_trade_plans_v1';
const ALERTS_KEY = 'swing_alerts_v1';
const SETTINGS_KEY = 'swing_settings_v1';

const navigation: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Strategies', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'watchlist', label: 'Watchlist', icon: <Star className="h-4 w-4" /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" /> },
  { id: 'plans', label: 'Trade Plans', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
];

export default function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const [activeStrategy, setActiveStrategy] = useState<StrategyId | 'all'>('pro-trader');
  const [settings, setSettingsState] = useState<AppSettings>(() => readJson(SETTINGS_KEY, defaultSettings));
  const [watchlist, setWatchlistState] = useState<WatchlistItem[]>(() => readJson(WATCHLIST_KEY, []));
  const [plans, setPlansState] = useState<TradePlan[]>(() => readJson(TRADE_PLANS_KEY, []));
  const [alerts, setAlertsState] = useState<AlertRule[]>(() => readJson(ALERTS_KEY, []));
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [market, setMarket] = useState<import('./types').MarketSeries[]>([]);
  const [quoteState, setQuoteState] = useState<'loading' | 'refreshing' | 'live' | 'error'>('loading');
  const [quoteMessage, setQuoteMessage] = useState('Loading Yahoo Finance chart data and Nasdaq market metadata...');
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const loadMarket = useCallback(async (mode: 'initial' | 'manual' = 'manual') => {
    const hadMarket = market.length > 0;
    setQuoteState(mode === 'initial' ? 'loading' : 'refreshing');
    setQuoteMessage(mode === 'initial'
      ? 'Loading Yahoo Finance chart data and Nasdaq market metadata...'
      : 'Refreshing Yahoo Finance chart data and Nasdaq market metadata...');
    try {
      const liveMarket = await fetchLiveMarket();
      setMarket(liveMarket);
      setQuoteState('live');
      const refreshedAt = new Date().toLocaleString();
      setLastRefreshAt(refreshedAt);
      const nvda = liveMarket.find((series) => series.profile.symbol === 'NVDA');
      setQuoteMessage(`Fresh data loaded. NVDA latest close: ${nvda?.candles.at(-1)?.close ?? 'loaded'}. Refreshed ${refreshedAt}.`);
    } catch (error) {
      if (hadMarket) {
        setQuoteState('live');
        setQuoteMessage('Refresh failed. Keeping the last successfully loaded real market data; no dummy data is shown.');
        return;
      }
      setQuoteState('error');
      setQuoteMessage('Market data could not be loaded. The app will not display fallback or dummy prices.');
    }
  }, [market.length]);

  useEffect(() => {
    loadMarket('initial');
  }, []);

  const ranked = useMemo(() => rankStocks(market, settings), [market, settings]);
  const prices = useMemo(() => Object.fromEntries(market.map((series) => [series.profile.symbol, series.candles.at(-1)?.close ?? 0])), [market]);
  const recentGapGroups = useMemo(() => {
    if (activeStrategy !== 'recent-gap-down') return [];
    return [0, 1, 2].map((daysAgo) => {
      const stocks = ranked
        .map((stock) => ({
          stock,
          result: stock.results.find((item) => item.strategyId === 'recent-gap-down')
        }))
        .filter((item) =>
          item.result &&
          item.result.eventDaysAgo === daysAgo &&
          item.result.blockers.length === 0 &&
          item.result.checks?.every((check) => check.passed)
        )
        .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0))
        .slice(0, 10)
        .map((item) => item.stock);
      return { daysAgo, stocks };
    });
  }, [ranked, activeStrategy]);
  const visibleStocks = useMemo(() => {
    const isQualified = (stock: RankedStock, strategy: StrategyId) => {
      const result = stock.results.find((item) => item.strategyId === strategy);
      if (strategy === 'recent-gap-down') {
        return Boolean(result && result.eventDaysAgo !== undefined && result.blockers.length === 0 && result.checks?.every((check) => check.passed));
      }
      return Boolean(result && result.score >= 70 && result.blockers.length === 0);
    };
    if (activeStrategy === 'all') {
      return ranked.filter((stock) => stock.results.some((result) => result.strategyId !== 'pro-trader' && result.strategyId !== 'two-day-five-percent' && result.score >= 70 && result.blockers.length === 0));
    }
    return [...ranked].sort((a, b) => {
      const scoreA = a.results.find((result) => result.strategyId === activeStrategy)?.score ?? 0;
      const scoreB = b.results.find((result) => result.strategyId === activeStrategy)?.score ?? 0;
      return scoreB - scoreA;
    }).filter((stock) => isQualified(stock, activeStrategy));
  }, [ranked, activeStrategy]);
  const selectedStock = selectedSymbol ? ranked.find((stock) => stock.series.profile.symbol === selectedSymbol) : null;

  const persistSettings = (next: AppSettings) => {
    setSettingsState(next);
    writeJson(SETTINGS_KEY, next);
  };

  const setWatchlist = (next: WatchlistItem[]) => {
    setWatchlistState(next);
    writeJson(WATCHLIST_KEY, next);
  };

  const setPlans = (next: TradePlan[]) => {
    setPlansState(next);
    writeJson(TRADE_PLANS_KEY, next);
  };

  const setAlerts = (next: AlertRule[]) => {
    setAlertsState(next);
    writeJson(ALERTS_KEY, next);
  };

  const addWatch = (stock: RankedStock) => {
    const result = stock.bestResult;
    if (watchlist.some((item) => item.symbol === stock.series.profile.symbol && item.strategyId === result.strategyId)) return;
    setWatchlist([
      {
        id: uid('watch'),
        symbol: stock.series.profile.symbol,
        strategyId: result.strategyId,
        entry: result.entry,
        target: result.target,
        stop: result.stop,
        status: 'watching',
        createdAt: new Date().toISOString()
      },
      ...watchlist
    ]);
  };

  const createTradePlan = (stock: RankedStock) => {
    const result = stock.bestResult;
    setPlans([
      {
        id: uid('plan'),
        symbol: stock.series.profile.symbol,
        strategyId: result.strategyId,
        entry: result.entry,
        target: result.target,
        stop: result.stop,
        notes: `${result.strategyName}: wait for confirmation near ${result.entry}. Risk is ${result.riskPercent}% for a 5% target.`,
        createdAt: new Date().toISOString()
      },
      ...plans
    ]);
    setSection('plans');
  };

  const createAlerts = (stock: RankedStock) => {
    const result = stock.bestResult;
    const createdAt = new Date().toISOString();
    const newAlerts: AlertRule[] = [
      { id: uid('alert'), symbol: stock.series.profile.symbol, kind: 'entry', level: result.entry, enabled: true, createdAt },
      { id: uid('alert'), symbol: stock.series.profile.symbol, kind: 'target', level: result.target, enabled: true, createdAt },
      { id: uid('alert'), symbol: stock.series.profile.symbol, kind: 'stop', level: result.stop, enabled: true, createdAt }
    ];
    setAlerts([...newAlerts, ...alerts]);
    setSection('alerts');
  };

  if (selectedStock) {
    return (
      <Shell section={section} setSection={setSection}>
        <StockDetail
          stock={selectedStock}
          onBack={() => setSelectedSymbol(null)}
          onAddWatch={addWatch}
          onCreateTradePlan={createTradePlan}
          onCreateAlerts={createAlerts}
        />
      </Shell>
    );
  }

  return (
    <Shell section={section} setSection={setSection}>
      {section === 'dashboard' && (
        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Analysis only / no automatic order placement
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-ink">Swing Trading Strategy Dashboard</h1>
                <p className="mt-2 max-w-3xl text-slate-600">
                  Rank liquid U.S. stocks through 15 swing-trading strategy models including a stricter Pro Trader model. Every candidate must show a 5% target, a defined stop, and clear reasons.
                </p>
              </div>
              <div className="rounded-md border border-line bg-slate-50 p-3 text-sm text-slate-600 lg:max-w-sm">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  {quoteState === 'loading' || quoteState === 'refreshing' ? <RefreshCw className="h-4 w-4 animate-spin text-signal" /> : <Database className="h-4 w-4 text-signal" />}
                  Data mode: {quoteState === 'live' ? 'Live/delayed market data' : quoteState === 'refreshing' ? 'Refreshing market data' : quoteState === 'loading' ? 'Loading market data' : 'Data unavailable'}
                </div>
                <p className="mt-1">{quoteMessage}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700">No dummy prices are used. If the source fails, candidates stay hidden.</p>
                <button
                  onClick={() => loadMarket('manual')}
                  disabled={quoteState === 'loading' || quoteState === 'refreshing'}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${quoteState === 'loading' || quoteState === 'refreshing' ? 'animate-spin' : ''}`} />
                  Refresh Latest Data
                </button>
                {lastRefreshAt && <p className="mt-2 text-xs text-slate-500">Last refresh: {lastRefreshAt}</p>}
              </div>
            </div>
          </section>

          {quoteState === 'loading' && (
            <div className="rounded-lg border border-line bg-white p-6 text-sm text-slate-600 shadow-soft">Loading real market data...</div>
          )}
          {quoteState === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 shadow-soft">
              Market data is unavailable. No dummy data is displayed.
            </div>
          )}
          {(quoteState === 'live' || quoteState === 'refreshing') && (
            <>
              <HeaderStats stocks={ranked} />
              <StrategyTabs value={activeStrategy} onChange={setActiveStrategy} />

              {activeStrategy === 'recent-gap-down' ? (
                <div className="space-y-4">
                  {recentGapGroups.map((group) => {
                    const label = group.daysAgo === 0 ? 'Today' : group.daysAgo === 1 ? 'Yesterday' : '2 Sessions Ago';
                    return (
                      <section key={group.daysAgo} className="rounded-lg border border-line bg-white p-4 shadow-soft">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-semibold text-ink">{label}</h2>
                            <p className="text-sm text-slate-500">Opening gap down at least 5%, with every matrix filter passing.</p>
                          </div>
                          <span className="rounded-full border border-line bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                            {group.stocks.length}/10
                          </span>
                        </div>
                        {group.stocks.length === 0 ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                            No fully qualified 5%+ gap-down candidates for this day.
                          </div>
                        ) : (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {group.stocks.map((stock) => (
                              <StockCard
                                key={stock.series.profile.symbol}
                                stock={stock}
                                activeStrategy={activeStrategy}
                                onSelect={setSelectedSymbol}
                                onAddWatch={addWatch}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {visibleStocks.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800 xl:col-span-2">
                      No fully qualified candidates for this strategy right now. The app is intentionally not showing weak partial matches as trade candidates.
                    </div>
                  )}
                  {visibleStocks.slice(0, 8).map((stock) => (
                    <StockCard
                      key={stock.series.profile.symbol}
                      stock={stock}
                      activeStrategy={activeStrategy}
                      onSelect={setSelectedSymbol}
                      onAddWatch={addWatch}
                    />
                  ))}
                </div>
              )}

              <ComparisonTable stocks={ranked} onSelect={setSelectedSymbol} />
            </>
          )}
        </div>
      )}

      {section === 'watchlist' && <WatchlistPanel items={watchlist} onRemove={(id) => setWatchlist(watchlist.filter((item) => item.id !== id))} />}
      {section === 'alerts' && <AlertsPanel alerts={alerts} prices={prices} onRemove={(id) => setAlerts(alerts.filter((item) => item.id !== id))} />}
      {section === 'plans' && <TradePlansPanel plans={plans} onRemove={(id) => setPlans(plans.filter((item) => item.id !== id))} />}
      {section === 'settings' && <SettingsPanel settings={settings} onChange={persistSettings} />}
    </Shell>
  );
}

const Shell = ({ children, section, setSection }: { children: React.ReactNode; section: Section; setSection: (section: Section) => void }) => (
  <div className="min-h-screen bg-slate-100 text-ink">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-white lg:block">
      <div className="border-b border-line p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
            <ListFilter className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-ink">SwingDesk</p>
            <p className="text-xs text-slate-500">5% setup engine</p>
          </div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold ${
              section === item.id ? 'bg-ink text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                section === item.id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        {children}
      </main>
    </div>
  </div>
);
