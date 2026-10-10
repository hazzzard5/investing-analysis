-- Research-only trade ideas (levels for paper tracking). Nothing here is executed anywhere.
create table trade_ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  ticker text not null,
  direction text not null check (direction in ('long','short')),
  entry numeric not null,
  target numeric not null,
  stop numeric not null,
  reward_risk numeric not null,
  last_price numeric not null,
  horizon text,
  condition text,
  rationale text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index trade_ideas_run_idx on trade_ideas(run_id);
alter table trade_ideas enable row level security;
