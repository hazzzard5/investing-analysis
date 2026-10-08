-- Core schema. Works on any Postgres 13+ (local Supabase, hosted Supabase, plain Postgres).

create table theses (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  amount numeric not null check (amount > 0),
  max_weight numeric not null default 0.20 check (max_weight > 0 and max_weight <= 1),
  min_holdings int not null default 5 check (min_holdings >= 1),
  created_at timestamptz not null default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  current_stage text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- agent: screening | fundamentals | valuation | news | devils_advocate | risk | portfolio
create table memos (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  agent text not null,
  ticker text,
  score numeric,
  verdict text,
  content jsonb not null,
  markdown text not null,
  created_at timestamptz not null default now()
);
create index memos_run_idx on memos(run_id);

create table portfolios (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed','paper','closed')),
  amount numeric not null,
  cash numeric not null default 0,
  start_date date,
  spy_entry_price numeric,
  created_at timestamptz not null default now()
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  ticker text not null,
  name text,
  sector text,
  weight numeric not null,
  shares numeric not null,
  entry_price numeric not null,
  rationale text
);
create index positions_portfolio_idx on positions(portfolio_id);

-- scope: ticker | portfolio
create table risk_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  scope text not null,
  ticker text,
  metric text not null,
  value numeric not null,
  detail jsonb
);
create index risk_metrics_run_idx on risk_metrics(run_id);

create table snapshots (
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  date date not null,
  value numeric not null,
  spy_value numeric not null,
  primary key (portfolio_id, date)
);

-- Local single-user MVP: the app reaches the database server-side only.
-- Lock the tables down so a browser holding the public Supabase key sees nothing.
alter table theses enable row level security;
alter table runs enable row level security;
alter table memos enable row level security;
alter table portfolios enable row level security;
alter table positions enable row level security;
alter table risk_metrics enable row level security;
alter table snapshots enable row level security;
