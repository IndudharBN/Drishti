create table if not exists symbols (
  symbol text primary key,
  company text not null,
  sector text not null,
  industry text,
  market_cap numeric,
  avg_volume numeric,
  country text default 'US',
  type text default 'stock',
  updated_at timestamptz default now()
);

create table if not exists daily_bars (
  symbol text references symbols(symbol) on delete cascade,
  day date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null,
  source text default 'alpha-vantage',
  created_at timestamptz default now(),
  primary key (symbol, day)
);

create table if not exists signal_runs (
  id uuid primary key default gen_random_uuid(),
  symbol text references symbols(symbol) on delete cascade,
  strategy_id text not null,
  score numeric not null,
  entry numeric not null,
  target numeric not null,
  stop numeric not null,
  risk_percent numeric not null,
  reward_risk numeric not null,
  status text not null,
  reasons jsonb default '[]'::jsonb,
  blockers jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  symbol text references symbols(symbol) on delete cascade,
  strategy_id text not null,
  entry numeric not null,
  target numeric not null,
  stop numeric not null,
  status text default 'watching',
  created_at timestamptz default now()
);

create table if not exists trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  symbol text references symbols(symbol) on delete cascade,
  strategy_id text not null,
  entry numeric not null,
  target numeric not null,
  stop numeric not null,
  position_size numeric,
  notes text,
  created_at timestamptz default now()
);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  symbol text references symbols(symbol) on delete cascade,
  kind text not null check (kind in ('entry', 'target', 'stop')),
  level numeric not null,
  enabled boolean default true,
  created_at timestamptz default now()
);

create index if not exists daily_bars_symbol_day_idx on daily_bars(symbol, day desc);
create index if not exists signal_runs_symbol_strategy_idx on signal_runs(symbol, strategy_id, created_at desc);
