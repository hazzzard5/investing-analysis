# Investing Analysis

A multi-agent research and paper-portfolio dashboard. You enter a thesis and an amount; agents screen, analyse, challenge and size a portfolio; the dashboard tracks the hypothetical portfolio against the S&P 500.

**Paper trading only. Research, not financial advice. You make the final decision; nothing here places trades.**

## How it works

`src/pipeline/run.ts` runs one thesis end to end. The same function is called by the dashboard button, the CLI and (later) a scheduler.

1. Screening (S&P 500 only): an agent maps the thesis onto S&P 500 sub-industries (and any size limit it implies, such as "outside the megacaps"). Code pulls data for up to 80 matching names and ranks them on growth, margins, FCF yield, momentum, valuation and leverage. The top 70% of the "stocks to analyse" count become long candidates and the weakest or most stretched 30% short candidates. The constituent list is a snapshot in `data/sp500.csv` (`npm run universe:refresh` updates it).
2. Per company: fundamentals, valuation (a transparent DCF computed in code, plus multiples), news and sentiment, and a devil's advocate that argues against it.
3. Per-stock thesis: a lead analyst merges those memos into one thesis (stance, fair-value range, catalysts, what would invalidate it).
4. Risk, computed in code from about a year of prices: volatility, drawdown, pairwise correlation, sector concentration.
5. Portfolio construction: the model picks names and weights, then code enforces your rules (max weight per stock, min holdings).
6. Trade ideas: entry, target and stop derived from the thesis (direction follows the stance, target stays within the fair value, stop ties to an invalidation point), with technicals and macro (Fed funds, 2y/10y, curve, VIX, credit spreads) for timing. Code rejects incoherent levels. Research for paper tracking only; shorts ignore borrow cost and squeeze risk.
7. You press "Start paper tracking" on the portfolio if you want it tracked against SPY.

## Frozen theses and the tracker

A thesis is written once and not regenerated, so you can see whether the original call plays out. After a run, each trade idea is tracked from its creation (`/tracker`): waiting for entry, open, target hit, stopped out, never filled, expired (30 days unfilled or 180 days open), or invalidated. `npm run monitor` checks active ideas against new daily closes using plain rules, with no model calls. A model is used only when an active idea has a dramatic one-day move (at least 7% and 3 standard deviations); it then judges the original thesis against what happened and can mark it invalidated, but it can never rewrite it. Results are shown next to the S&P 500 over the same period. Run `npm run monitor` as often as you like (daily or weekly); repeat runs on the same data change nothing.

## Run it locally

Needs Node 22+ and an Anthropic API key. No Docker required. Market data comes from Yahoo Finance by default (no key); macro data from FRED's public CSVs (no key).

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY
npm run db                    # terminal 1: local Postgres on :54322 (data kept in .data/), applies migrations, leave running
npm run dev                   # terminal 2: http://localhost:3000
```

`npm run db` downloads real Postgres binaries through npm, so nothing else needs installing. If you prefer Docker, `npx supabase start` gives the same database on the same port. Or point `DATABASE_URL` at any Postgres and run `npm run db:migrate`.

## Data

Daily-lagged data is fine; nothing is real time. `DATA_PROVIDER=yahoo` (default) uses the unofficial `yahoo-finance2` package, which needs no key but can break or be rate-limited without notice. `DATA_PROVIDER=fmp` uses Financial Modeling Prep (needs `FMP_API_KEY`; check which endpoints your plan includes). Both sit behind `src/lib/data`.

## Without the UI

```bash
npm run run:pipeline -- "AI infrastructure beneficiaries outside the megacaps" 10000
npm run monitor               # advance trade ideas and record paper-portfolio value vs SPY
```

`npm run run:pipeline` starts a new thesis (ad hoc or from a scheduler). Schedule `npm run monitor` (it also records paper-portfolio snapshots) with cron, launchd or Task Scheduler. When deployed, call `GET /api/cron/monitor` with `Authorization: Bearer $CRON_SECRET`.

## Scheduling on your own computer

Everything runs locally, so use your computer's scheduler. `npm run monitor` is the only job you need on a schedule (daily or weekly; it never rewrites a thesis). Start new theses from the dashboard or `npm run run:pipeline`.

```cron
# Weekdays at 5:30pm local time (after the US close; data is end-of-day anyway)
30 17 * * 1-5  cd /path/to/investing-analysis && npm run monitor >> monitor.log 2>&1
```

The computer must be awake and the database running (`npm run db`) when the job fires. On macOS use `launchd` or Calendar-triggered Shortcuts if cron is awkward; on Windows use Task Scheduler. A missed run is harmless: the next run catches up on all the closes since the last check.

## If you ever host it (Vercel + hosted Supabase)

Set `ANTHROPIC_API_KEY` (and `FMP_API_KEY` if using FMP), `DATABASE_URL` (Supabase connection string) and `CRON_SECRET` as environment variables. The run button currently starts the pipeline inside the request process, which suits a local server; on serverless a run can exceed the function time limit, so move `runPipeline` behind a queue or split it per stage first.

## Tests

`npm test` covers the risk math, weight caps, DCF, technicals, S&P 500 ranking, trade-idea validation and the idea lifecycle. The pipeline was exercised end to end against a scratch Postgres with mocked FMP and model responses; it has not yet been run against live Yahoo, FRED or model output.
