import { notFound } from "next/navigation";
import { sql } from "../../../lib/db";
import AutoRefresh from "../../../components/AutoRefresh";
import AcceptButton from "../../../components/AcceptButton";
import PerfChart from "../../../components/PerfChart";

export const dynamic = "force-dynamic";

const AGENT_LABEL: Record<string, string> = {
  screening: "Screening",
  fundamentals: "Fundamentals",
  valuation: "Valuation",
  news: "News and sentiment",
  devils_advocate: "Devil's advocate",
  thesis: "Lead analyst thesis",
  risk: "Risk",
  portfolio: "Portfolio constructor",
};
const pct = (n: number, d = 1) => `${(Number(n) * 100).toFixed(d)}%`;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run] = await sql`select r.*, t.text, t.amount, t.max_weight, t.min_holdings
                          from runs r join theses t on t.id = r.thesis_id where r.id = ${id}`.catch(() => []);
  if (!run) notFound();

  const memos = await sql`select * from memos where run_id = ${id} order by created_at`;
  const [pf] = await sql`select * from portfolios where run_id = ${id}`;
  const positions = pf ? await sql`select * from positions where portfolio_id = ${pf.id} order by weight desc` : [];
  const risk = await sql`select * from risk_metrics where run_id = ${id}`;
  const ideas = await sql`select * from trade_ideas where run_id = ${id} order by confidence desc, reward_risk desc`;
  const snaps = pf ? await sql`select date, value, spy_value from snapshots where portfolio_id = ${pf.id} order by date` : [];

  const pRisk = Object.fromEntries(risk.filter((r) => r.scope === "portfolio").map((r) => [r.metric, r]));
  const tRisk = (t: string, m: string) => risk.find((r) => r.scope === "ticker" && r.ticker === t && r.metric === m)?.value;
  const general = memos.filter((m) => !m.ticker);
  const perTicker = new Map<string, any[]>();
  for (const m of memos.filter((m) => m.ticker)) perTicker.set(m.ticker, [...(perTicker.get(m.ticker) ?? []), m]);

  return (
    <>
      <AutoRefresh active={run.status === "queued" || run.status === "running"} />
      <h1>{run.text}</h1>
      <p className="muted">
        ${Number(run.amount).toLocaleString()} · max {pct(run.max_weight, 0)} per stock · min {run.min_holdings} holdings ·{" "}
        <span className="pill">{run.status}{run.current_stage ? `: ${run.current_stage}` : ""}</span>
      </p>
      {run.error && <p className="err">Run failed: {run.error}</p>}

      {pf && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Proposed portfolio</h2>
          <table>
            <thead>
              <tr><th>Stock</th><th>Sector</th><th className="num">Weight</th><th className="num">Shares</th><th className="num">Entry</th><th className="num">Vol</th><th className="num">1y drawdown</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} title={p.rationale ?? ""}>
                  <td><b>{p.ticker}</b> <span className="muted">{p.name}</span></td>
                  <td>{p.sector}</td>
                  <td className="num">{pct(p.weight)}</td>
                  <td className="num">{Number(p.shares)}</td>
                  <td className="num">${Number(p.entry_price).toFixed(2)}</td>
                  <td className="num">{tRisk(p.ticker, "annual_volatility") != null ? pct(tRisk(p.ticker, "annual_volatility")) : "-"}</td>
                  <td className="num">{tRisk(p.ticker, "max_drawdown_1y") != null ? pct(tRisk(p.ticker, "max_drawdown_1y")) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Cash left over: ${Number(pf.cash).toFixed(2)}. Hover a row for the rationale.</p>
          {pf.status === "proposed" ? (
            <>
              <p className="muted">Nothing is traded. Starting paper tracking only records hypothetical value against the S&P 500 from today.</p>
              <AcceptButton portfolioId={pf.id} />
            </>
          ) : (
            <p className="muted">Paper tracking since {String(pf.start_date).slice(0, 10)}.</p>
          )}
        </section>
      )}

      {Object.keys(pRisk).length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Portfolio risk (about 1 year, backward-looking)</h2>
          <div className="row">
            <div><div className="muted">Annual volatility</div><b>{pct(pRisk.portfolio_volatility?.value)}</b></div>
            <div><div className="muted">Worst drawdown</div><b>{pct(pRisk.portfolio_max_drawdown_1y?.value)}</b></div>
            <div><div className="muted">Avg pairwise correlation</div><b>{Number(pRisk.avg_pairwise_correlation?.value).toFixed(2)}</b></div>
            <div><div className="muted">Top sector ({pRisk.top_sector_weight?.detail?.sector})</div><b>{pct(pRisk.top_sector_weight?.value)}</b></div>
          </div>
        </section>
      )}

      {ideas.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Trade ideas (research, paper only)</h2>
          <p className="muted">
            Levels use data that is about a day old, so treat them as zones. They are not advice and nothing is executed; shorts ignore borrow cost and squeeze risk.
          </p>
          <table>
            <thead>
              <tr><th>Stock</th><th>Side</th><th className="num">Last</th><th className="num">Entry</th><th className="num">Target</th><th className="num">Stop</th><th className="num">R:R</th><th className="num">Conf.</th></tr>
            </thead>
            <tbody>
              {ideas.map((i) => (
                <tr key={i.id} title={`${i.condition}\n${i.rationale}`}>
                  <td><b>{i.ticker}</b></td>
                  <td><span className="pill" style={{ color: i.direction === "long" ? "var(--good)" : "var(--bad)" }}>{i.direction}</span></td>
                  <td className="num">${Number(i.last_price).toFixed(2)}</td>
                  <td className="num">${Number(i.entry).toFixed(2)}</td>
                  <td className="num">${Number(i.target).toFixed(2)}</td>
                  <td className="num">${Number(i.stop).toFixed(2)}</td>
                  <td className="num">{Number(i.reward_risk).toFixed(1)}</td>
                  <td className="num">{Number(i.confidence)}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ideas.map((i) => (
            <details key={i.id}>
              <summary>{i.ticker} ({i.stance}): {i.condition || "setup"} ({i.horizon})</summary>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {`Thesis: ${i.thesis ?? ""}\n\nEntry: ${i.entry_basis ?? ""}\nTarget: ${i.target_basis ?? ""}\nStop: ${i.stop_basis ?? ""}\nThesis breaks if: ${i.invalidation ?? ""}\n\n${i.rationale ?? ""}`}
              </div>
            </details>
          ))}
        </section>
      )}

      {pf?.status === "paper" && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Performance vs S&P 500</h2>
          <PerfChart points={snaps.map((s) => ({ date: String(s.date).slice(0, 10), value: Number(s.value), spy: Number(s.spy_value) }))} />
        </section>
      )}

      <h2>Agent memos</h2>
      <section className="card">
        {general.map((m) => (
          <details key={m.id} open={m.agent === "portfolio"}>
            <summary>{AGENT_LABEL[m.agent] ?? m.agent}</summary>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.markdown}</div>
          </details>
        ))}
        {[...perTicker.entries()].map(([ticker, ms]) => (
          <details key={ticker}>
            <summary>{ticker}</summary>
            {ms.map((m) => (
              <div key={m.id} style={{ margin: "8px 0" }}>
                <div className="muted">{AGENT_LABEL[m.agent] ?? m.agent}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.markdown}</div>
              </div>
            ))}
          </details>
        ))}
        {!memos.length && <p className="muted">Memos appear here as each agent finishes.</p>}
      </section>
    </>
  );
}
