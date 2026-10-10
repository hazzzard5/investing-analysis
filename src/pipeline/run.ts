import { sql } from "../lib/db";
import { data, type Profile } from "../lib/data";
import { macroSnapshot } from "../lib/macro";
import { technicals } from "../lib/technicals";
import { validateIdea } from "../lib/tradeIdeas";
import { dcf } from "../lib/valuation";
import { annualVol, capWeights, correlation, maxDrawdown, portfolioPath, type Series } from "../lib/stats";
import * as agents from "./agents";
import { memoMarkdown, type Memo } from "./agents";

const CONCURRENCY = 3;
const MAX_CANDIDATES = 12;

async function pool<T, R>(items: T[], fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function stage(runId: string, name: string) {
  await sql`update runs set current_stage = ${name} where id = ${runId}`;
}

async function saveMemo(runId: string, agent: string, ticker: string | null, m: Memo) {
  await sql`insert into memos (run_id, agent, ticker, score, verdict, content, markdown)
            values (${runId}, ${agent}, ${ticker}, ${m.score}, ${m.verdict}, ${sql.json(m as any)}, ${memoMarkdown(m)})`;
}

/**
 * The whole research pipeline for one run. Callable from the UI, a CLI, or a scheduled job.
 * Never throws: failures are recorded on the run row.
 */
export async function runPipeline(runId: string): Promise<void> {
  try {
    const [run] = await sql`
      select r.id, t.text, t.amount, t.max_weight, t.min_holdings
      from runs r join theses t on t.id = r.thesis_id where r.id = ${runId}`;
    if (!run) throw new Error(`run ${runId} not found`);
    const thesis: string = run.text;
    const amount = Number(run.amount);
    const maxWeight = Number(run.max_weight);
    const minHoldings = Number(run.min_holdings);

    await sql`update runs set status = 'running', started_at = now(), error = null where id = ${runId}`;

    // 1. Screening
    await stage(runId, "screening");
    const plan = await agents.planScreen(thesis);
    const screened = await data.screen(plan.criteria).catch(() => [] as string[]);
    const symbols = [
      ...new Set([...(plan.tickers ?? []), ...screened].map((s) => String(s).toUpperCase())),
    ];
    const profiles = (await pool(symbols.slice(0, 30), async (s) => ({ s, p: await data.profile(s).catch(() => null) })))
      .filter((x): x is { s: string; p: Profile } => x.p !== null)
      .slice(0, MAX_CANDIDATES);
    if (profiles.length < minHoldings) throw new Error(`Only ${profiles.length} usable candidates found; need at least ${minHoldings}`);
    await saveMemo(runId, "screening", null, {
      verdict: `${profiles.length} candidates`,
      score: 5,
      summary: plan.rationale,
      points: profiles.map((x) => `${x.s}: ${x.p.name} (${x.p.sector}, mkt cap ${Math.round(x.p.marketCap / 1e6)}M)`),
    });

    // 2. Per-company analysis: fundamentals, valuation, sentiment, then devil's advocate
    await stage(runId, "analysis");
    const macro = await macroSnapshot();
    const analysed = await pool(profiles, async ({ s, p }) => {
      const [fund, hist, n] = await Promise.all([
        data.fundamentals(s).catch(() => ({}) as Record<string, any>),
        data.prices(s).catch(() => [] as Series),
        data.news(s).catch(() => []),
      ]);
      const tech = technicals(hist);
      const dcfValue = dcf(fund as any);
      const [f, v, ns] = await Promise.all([
        agents.fundamentals(thesis, { profile: p, fundamentals: fund }),
        agents.valuation(thesis, { profile: p, price: p.price, dcf: dcfValue, fundamentals: fund }),
        agents.sentiment(thesis, { headlines: n }),
      ]);
      const da = await agents.devilsAdvocate(thesis, { profile: p, fundamentals: f, valuation: v, sentiment: ns });
      await Promise.all([
        saveMemo(runId, "fundamentals", s, f),
        saveMemo(runId, "valuation", s, v),
        saveMemo(runId, "news", s, ns),
        saveMemo(runId, "devils_advocate", s, da),
      ]);
      const th = await agents.stockThesis(thesis, {
        ticker: s,
        last_price: p.price,
        dcf: dcfValue,
        analyst_target_mean: (fund as any).analystTargetMean ?? null,
        multiples: { trailingPE: (fund as any).trailingPE, forwardPE: (fund as any).forwardPE, pegRatio: (fund as any).pegRatio },
        memos: { fundamentals: f, valuation: v, sentiment: ns, devils_advocate: da },
      });
      await saveMemo(runId, "thesis", s, th);
      const rawIdea = await agents
        .tradeIdea(thesis, {
          ticker: s,
          last_price: p.price,
          stock_thesis: { stance: th.stance, summary: th.summary, fairValueLow: th.fairValueLow, fairValueHigh: th.fairValueHigh, catalysts: th.catalysts, invalidation: th.invalidation },
          technicals: tech,
          macro,
        })
        .catch(() => null);
      const idea = validateIdea(rawIdea, p.price, th);
      if (idea) {
        await sql`insert into trade_ideas (run_id, ticker, direction, entry, target, stop, reward_risk, last_price, horizon, condition, rationale, confidence, stance, thesis, entry_basis, target_basis, stop_basis, invalidation)
                  values (${runId}, ${s}, ${idea.direction}, ${idea.entry}, ${idea.target}, ${idea.stop}, ${idea.rewardRisk}, ${p.price}, ${idea.horizon}, ${idea.condition}, ${idea.rationale}, ${idea.confidence}, ${th.stance}, ${th.summary}, ${idea.entryBasis}, ${idea.targetBasis}, ${idea.stopBasis}, ${(th.invalidation ?? []).join("; ")})`;
      }
      // Composite 1-10: bear-case strength counts against the stock.
      const composite = (f.score + v.score + ns.score + (11 - da.score)) / 4;
      return { ticker: s, profile: p, price: Number(p.price), hist, composite, f, v, ns, da };
    });

    // 3. Risk (computed in code from price history)
    await stage(runId, "risk");
    const spy = await data.prices("SPY");
    const hist = new Map<string, Series>(analysed.map((a) => [a.ticker, a.hist]));
    const usable = analysed.filter((a) => a.hist.length > 60 && a.price > 0);
    if (usable.length < minHoldings) throw new Error(`Only ${usable.length} candidates have price history; need ${minHoldings}`);
    for (const a of usable) {
      const s = hist.get(a.ticker)!;
      const dd = maxDrawdown(s.map((x) => x.close));
      const vol = annualVol(s);
      await sql`insert into risk_metrics (run_id, scope, ticker, metric, value) values
        (${runId}, 'ticker', ${a.ticker}, 'annual_volatility', ${vol}),
        (${runId}, 'ticker', ${a.ticker}, 'max_drawdown_1y', ${dd})`;
    }

    // 4. Portfolio construction
    await stage(runId, "portfolio");
    const summaries = usable.map((a) => ({
      ticker: a.ticker,
      name: a.profile.name,
      sector: a.profile.sector,
      composite: Number(a.composite.toFixed(2)),
      fundamentals: a.f.verdict,
      valuation: a.v.verdict,
      sentiment: a.ns.verdict,
      bear_case: a.da.summary,
    }));
    const byTicker = new Map(usable.map((a) => [a.ticker, a]));
    let picks = (await agents.construct(thesis, { maxWeight, minHoldings }, summaries).catch(() => ({ picks: [] }))).picks
      .map((p) => ({ ...p, ticker: String(p.ticker).toUpperCase() }))
      .filter((p, i, all) => byTicker.has(p.ticker) && all.findIndex((x) => x.ticker === p.ticker) === i);
    // Fall back to top composite scores if the model picked too few valid names.
    if (picks.length < minHoldings) {
      picks = [...usable]
        .sort((a, b) => b.composite - a.composite)
        .slice(0, Math.max(minHoldings, Math.min(8, usable.length)))
        .map((a) => ({ ticker: a.ticker, weight: a.composite, rationale: "Top composite analyst score." }));
    }
    // Enforce rules in code, whatever the model returned.
    const weights = capWeights(picks.map((p) => Number(p.weight) || 0), maxWeight);

    const [pf] = await sql`insert into portfolios (run_id, amount, spy_entry_price)
                           values (${runId}, ${amount}, ${spy.at(-1)?.close ?? null}) returning id`;
    let invested = 0;
    const held: { ticker: string; weight: number; series: Series; sector: string }[] = [];
    for (let i = 0; i < picks.length; i++) {
      const a = byTicker.get(picks[i].ticker)!;
      const shares = Math.floor(((amount * weights[i]) / a.price) * 100) / 100; // fractional, 2dp
      invested += shares * a.price;
      held.push({ ticker: a.ticker, weight: weights[i], series: hist.get(a.ticker)!, sector: a.profile.sector ?? "Unknown" });
      await sql`insert into positions (portfolio_id, ticker, name, sector, weight, shares, entry_price, rationale)
                values (${pf.id}, ${a.ticker}, ${a.profile.name}, ${a.profile.sector}, ${weights[i]}, ${shares}, ${a.price}, ${picks[i].rationale})`;
    }
    await sql`update portfolios set cash = ${amount - invested} where id = ${pf.id}`;

    // 5. Portfolio-level risk
    const path = portfolioPath(held.map((h) => ({ weight: h.weight, series: h.series })));
    const returns = path.slice(1).map((v, i) => v / path[i] - 1);
    const n = returns.length || 1;
    const m = returns.reduce((a, b) => a + b, 0) / n;
    const pVol = Math.sqrt(returns.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) * Math.sqrt(252);
    const pDD = maxDrawdown(path);
    const corrs: number[] = [];
    for (let i = 0; i < held.length; i++)
      for (let j = i + 1; j < held.length; j++) {
        const c = correlation(held[i].series, held[j].series);
        if (Number.isFinite(c)) corrs.push(c);
      }
    const avgCorr = corrs.length ? corrs.reduce((a, b) => a + b, 0) / corrs.length : 0;
    const sectors = new Map<string, number>();
    for (const h of held) sectors.set(h.sector, (sectors.get(h.sector) ?? 0) + h.weight);
    const [topSector, topSectorWeight] = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0];
    const spyVol = annualVol(spy);
    const spyDD = maxDrawdown(spy.map((x) => x.close));
    const pm = { portfolio_volatility: pVol, portfolio_max_drawdown_1y: pDD, avg_pairwise_correlation: avgCorr, top_sector_weight: topSectorWeight };
    for (const [metric, value] of Object.entries(pm)) {
      await sql`insert into risk_metrics (run_id, scope, metric, value, detail)
                values (${runId}, 'portfolio', ${metric}, ${value}, ${metric === "top_sector_weight" ? sql.json({ sector: topSector }) : null})`;
    }
    const rm = await agents.riskCommentary(thesis, {
      ...pm,
      top_sector: topSector,
      holdings: held.map((h) => ({ ticker: h.ticker, weight: h.weight, sector: h.sector })),
      benchmark_spy: { volatility: spyVol, max_drawdown_1y: spyDD },
      note: "Drawdown and volatility are backward-looking over about one year.",
    });
    await saveMemo(runId, "risk", null, rm);
    await saveMemo(runId, "portfolio", null, {
      verdict: `${picks.length} holdings`,
      score: Number(rm.score),
      summary: `Proposed allocation of $${amount.toLocaleString()} across ${picks.length} stocks (max ${(maxWeight * 100).toFixed(0)}% each).`,
      points: picks.map((p, i) => `${p.ticker} ${(weights[i] * 100).toFixed(1)}%: ${p.rationale}`),
    });

    await sql`update runs set status = 'done', current_stage = null, finished_at = now() where id = ${runId}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pipeline ${runId}]`, e);
    await sql`update runs set status = 'failed', error = ${msg}, finished_at = now() where id = ${runId}`;
  }
}

export async function createRun(input: { text: string; amount: number; maxWeight: number; minHoldings: number }) {
  const [t] = await sql`insert into theses (text, amount, max_weight, min_holdings)
                        values (${input.text}, ${input.amount}, ${input.maxWeight}, ${input.minHoldings}) returning id`;
  const [r] = await sql`insert into runs (thesis_id) values (${t.id}) returning id`;
  return r.id as string;
}
