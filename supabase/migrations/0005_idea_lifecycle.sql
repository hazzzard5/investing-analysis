-- A trade idea's thesis is frozen when it is created. These columns track what happens to it afterwards.
alter table trade_ideas
  add column status text not null default 'pending'
    check (status in ('pending','open','target_hit','stopped','invalidated','missed','expired')),
  add column filled_at date,
  add column fill_price numeric,
  add column closed_at date,
  add column close_price numeric,
  add column outcome_pct numeric,
  add column current_price numeric,
  add column spy_at_fill numeric,
  add column spy_at_close numeric,
  add column spy_current numeric,
  add column last_checked date;
create index trade_ideas_status_idx on trade_ideas(status);

-- Log of material-event reviews. The original thesis is never rewritten; a review can only mark it invalidated.
create table thesis_events (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references trade_ideas(id) on delete cascade,
  date date not null,
  kind text not null,
  verdict text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (idea_id, date, kind)
);
alter table thesis_events enable row level security;
