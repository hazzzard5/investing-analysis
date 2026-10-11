import Link from "next/link";
import { sql } from "../../lib/db";
import { isActive, outcomePct, type IdeaStatus } from "../../lib/lifecycle";

export const dynamic = "force-dynamic";

const LABEL: Record<IdeaStatus, string> = {
  pending: "Waiting for entry",
  open: "Open",
  target_hit: "Target hit",
  stopped: "Stopped out",
  invalidated: "Thesis invalidated",
  missed: "Never filled",
  expired: "Expired",
};
const money = (n: number | null) => (n === null ? "-" : `$${Number(n).toFixed(2)}`);
const pct = (n: number | null) => (n === null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const day = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

export default async function Tracker() {
  const ideas: any[] = await sql`
    select i.*, r.id as run_id, t.text as thesis_text
    from trade_ideas i join runs r on r.id = i.run_id join theses t on t.id = r.thesis_id
    order by i.created_at desc`.catch(() => [] as any[]);
  const events: any[] = ideas.length ? await sql`select * from thesis_events order by date desc` : [];

  const view = ideas.map((i) => {
    const filled = i.fill_price !== null;
    const live = filled && i.status === "open" && i.current_price !== null ? outcomePct(i.direction, Number(i.fill_price), Number(i.current_price)) : null;
    const result = i.outcome_pct !== null ? Number(i.outcome_pct) : live;
    const spyEnd = i.status === "open" ? i.spy_current : i.spy_at_close;
    const spyMove = filled && i.spy_at_fill && spyEnd ? (Number(spyEnd) / Number(i.spy_at_fill) - 1) * 100 : null;
    return { ...i, result, spyMove };
  });
  const active = view.filter((i) => isActive(i.status));
  const closed = view.filter((i) => !isActive(i.status));
  const finished = closed.filter((i) => i.outcome_pct !== null);
  const wins = finished.filter((i) => Number(i.outcome_pct) > 0).length;

  const row = (i: (typeof view)[number]) => (
    <tr key={i.id}>
      <td><Link href={`/runs/${i.run_id}`}><b>{i.ticker}</b></Link> <span className="muted">{i.thesis_text.slice(0, 40)}</span></td>
      <td><span className="pill" style={{ color: i.direction === "long" ? "var(--good)" : "var(--bad)" }}>{i.direction}</span></td>
      <td>{LABEL[i.status as IdeaStatus]}</td>
      <td className="num">{money(i.entry)} / {money(i.target)} / {money(i.stop)}</td>
      <td className="num">{i.fill_price !== null ? `${money(i.fill_price)} on ${day(i.filled_at)}` : "-"}</td>
      <td className="num">{money(i.status === "open" || i.status === "pending" ? i.current_price : i.close_price)}</td>
      <td className="num" style={{ color: i.result === null ? undefined : i.result >= 0 ? "var(--good)" : "var(--bad)" }}>{pct(i.result)}</td>
      <td className="num">{pct(i.spyMove)}</td>
    </tr>
  );
  const head = (
    <thead>
      <tr><th>Stock</th><th>Side</th><th>Status</th><th className="num">Entry / target / stop</th><th className="num">Filled</th><th className="num">Price</th><th className="num">Result</th><th className="num">S&P 500 same period</th></tr>
    </thead>
  );

  return (
    <>
      <h1>Trade tracker</h1>
      <p className="muted">
        Each idea keeps the thesis, entry, target and stop it was created with. They are only checked against new prices; nothing is rewritten, and the thesis is reviewed only after a dramatic event. Paper results, not advice.
      </p>
      {!ideas.length && <p className="muted">No trade ideas yet. Run research first.</p>}
      {active.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Active ({active.length})</h2>
          <table>{head}<tbody>{active.map(row)}</tbody></table>
        </section>
      )}
      {closed.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Closed ({closed.length})</h2>
          {finished.length > 0 && <p className="muted">{wins} of {finished.length} filled ideas ended in profit.</p>}
          <table>{head}<tbody>{closed.map(row)}</tbody></table>
        </section>
      )}
      {events.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Thesis reviews</h2>
          {events.map((e) => {
            const i = ideas.find((x) => x.id === e.idea_id);
            return (
              <p key={e.id}>
                <b>{i?.ticker}</b> {day(e.date)} <span className="pill">{e.verdict}</span> {e.note}
              </p>
            );
          })}
        </section>
      )}
    </>
  );
}
