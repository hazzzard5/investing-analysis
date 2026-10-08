# Investing Analysis

A multi-agent research and paper-portfolio dashboard. You enter a thesis and an amount; agents screen, analyse, challenge and size a portfolio; the dashboard tracks the hypothetical portfolio against the S&P 500.

**Paper trading only. Research, not financial advice. You make the final decision; nothing here places trades.**

## How it works

`src/pipeline/run.ts` runs one thesis end to end. The same function is called by the dashboard button, the CLI and (later) a scheduler.

1. Screening: thesis to FMP screener criteria plus candidate tickers (validated against FMP).
2. Per company: fundamentals, valuation (DCF and multiples), news and sentiment, then a devil's advocate that argues against it.
3. Risk, computed in code from about a year of prices: volatility, drawdown, pairwise correlation, sector concentration.
4. Portfolio construction: the model picks names and weights, then code enforces your rules (max weight per stock, min holdings).
5. You press "Start paper tracking"; a daily snapshot job records portfolio value next to SPY.

## Run it locally

Needs Node 22+, Docker (for the database), an [FMP](https://site.financialmodelingprep.com/) key and an Anthropic API key.

```bash
npm install
cp .env.example .env          # add FMP_API_KEY and ANTHROPIC_API_KEY
npx supabase start            # local Postgres on :54322, applies supabase/migrations
npm run dev                   # http://localhost:3000
```

No Docker? Point `DATABASE_URL` at any Postgres and run `npm run db:migrate`.

## Without the UI

```bash
npm run run:pipeline -- "AI infrastructure beneficiaries outside the megacaps" 10000
npm run snapshot              # record today's paper-portfolio value vs SPY
```

Schedule `npm run snapshot` daily (cron, launchd, Task Scheduler). When deployed, call `GET /api/cron/snapshot` with `Authorization: Bearer $CRON_SECRET`.

## Deploying later (Vercel + hosted Supabase)

Set `FMP_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL` (Supabase connection string) and `CRON_SECRET` as environment variables. The run button currently starts the pipeline inside the request process, which suits a local server; on serverless a run can exceed the function time limit, so move `runPipeline` behind a queue or split it per stage first.

## Tests

`npm test` covers the risk math and the weight-cap logic. The pipeline was exercised end to end against a scratch Postgres with mocked FMP and model responses; it has not yet been run against live FMP data.
