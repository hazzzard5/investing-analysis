# Investing Analysis

A multi-agent research and paper-portfolio dashboard. You enter a thesis and an amount; agents screen, analyse, challenge and size a portfolio; the dashboard tracks the hypothetical portfolio against the S&P 500.

**Paper trading only. Research, not financial advice. You make the final decision; nothing here places trades.**

## How it works

`src/pipeline/run.ts` runs one thesis end to end. The same function is called by the dashboard button, the CLI and (later) a scheduler.

1. Screening: thesis to criteria plus candidate tickers (validated against the data provider).
2. Per company: fundamentals, valuation (a transparent DCF computed in code, plus multiples), news and sentiment, a devil's advocate that argues against it, and a trade-setup analyst (below).
3. Risk, computed in code from about a year of prices: volatility, drawdown, pairwise correlation, sector concentration.
4. Portfolio construction: the model picks names and weights, then code enforces your rules (max weight per stock, min holdings).
5. Trade ideas: long or short setups with entry, target and stop, using technicals (overextension from RSI and distance from the 200-day average), valuation and the macro backdrop (Fed funds, 2y/10y, curve, VIX, credit spreads). Code rejects incoherent levels (wrong side of entry, reward/risk under 1.5, entry far from price). Research for paper tracking only; shorts ignore borrow cost and squeeze risk.
6. You press "Start paper tracking"; a daily snapshot job records portfolio value next to SPY.

## Run it locally

Needs Node 22+, Docker (for the database) and an Anthropic API key. Market data comes from Yahoo Finance by default (no key); macro data from FRED's public CSVs (no key).

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY
npx supabase start            # local Postgres on :54322, applies supabase/migrations
npm run dev                   # http://localhost:3000
```

No Docker? Point `DATABASE_URL` at any Postgres and run `npm run db:migrate`.

## Data

Daily-lagged data is fine; nothing is real time. `DATA_PROVIDER=yahoo` (default) uses the unofficial `yahoo-finance2` package, which needs no key but can break or be rate-limited without notice. `DATA_PROVIDER=fmp` uses Financial Modeling Prep (needs `FMP_API_KEY`; check which endpoints your plan includes). Both sit behind `src/lib/data`.

## Without the UI

```bash
npm run run:pipeline -- "AI infrastructure beneficiaries outside the megacaps" 10000
npm run snapshot              # record today's paper-portfolio value vs SPY
```

Schedule `npm run snapshot` daily (cron, launchd, Task Scheduler). When deployed, call `GET /api/cron/snapshot` with `Authorization: Bearer $CRON_SECRET`.

## Deploying later (Vercel + hosted Supabase)

Set `ANTHROPIC_API_KEY` (and `FMP_API_KEY` if using FMP), `DATABASE_URL` (Supabase connection string) and `CRON_SECRET` as environment variables. The run button currently starts the pipeline inside the request process, which suits a local server; on serverless a run can exceed the function time limit, so move `runPipeline` behind a queue or split it per stage first.

## Tests

`npm test` covers the risk math, weight caps, DCF, technicals and trade-idea validation. The pipeline was exercised end to end against a scratch Postgres with mocked FMP and model responses; it has not yet been run against live Yahoo, FRED or model output.
