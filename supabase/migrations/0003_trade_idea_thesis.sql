-- Trade levels are derived from the lead analyst's per-stock thesis; keep that link visible.
alter table trade_ideas
  add column stance text,
  add column thesis text,
  add column entry_basis text,
  add column target_basis text,
  add column stop_basis text,
  add column invalidation text;
