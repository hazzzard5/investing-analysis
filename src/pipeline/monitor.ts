import { sql } from "../lib/db";
import { data } from "../lib/data";
import { advance, isActive, isMaterialMove, outcomePct, type IdeaState, type IdeaStatus } from "../lib/lifecycle";
import type { Series } from "../lib/stats";
import * as agents from "./agents";

const spyOn = (spy: Series, date: string | null) => (date ? [...spy].reverse().find((b) => b.date <= date)?.close ?? null : null);

/**
 * Checks every active trade idea against new daily closes. The thesis itself is never regenerated:
 * ideas only move pending -> open -> target_hit / stopped, or are marked invalidated after a material event
 * is reviewed. Safe to run daily or weekly; repeat runs on the same data change nothing.
 */
export async function monitorIdeas(): Promise<{ checked: number; closed: number; reviewed: number }> {
  const ideas = await sql`select * from trade_ideas where status in ('pending','open')`;
  if (!ideas.length) return { checked: 0, closed: 0, reviewed: 0 };
  const spy = await data.prices("SPY", 400).catch(() => [] as Series);
  let closed = 0, reviewed = 0, checked = 0;

  for (const idea of ideas) {
    const createdAt = new Date(idea.created_at).toISOString().slice(0, 10);
    const since = idea.last_checked ? new Date(idea.last_checked).toISOString().slice(0, 10) : createdAt;
    const ageDays = Math.ceil((Date.now() - Date.parse(createdAt)) / 86_400_000);
    const history = await data.prices(idea.ticker, Math.max(150, ageDays + 100)).catch(() => [] as Series);
    if (!history.length) continue; // data hiccup: leave the idea untouched rather than guess
    checked++;

    const bars = history.filter((b) => b.date > since);
    let st: IdeaState = {
      direction: idea.direction, entry: Number(idea.entry), target: Number(idea.target), stop: Number(idea.stop),
      status: idea.status as IdeaStatus, createdAt,
      fillPrice: idea.fill_price === null ? null : Number(idea.fill_price),
      filledAt: idea.filled_at ? new Date(idea.filled_at).toISOString().slice(0, 10) : null,
      closedAt: null, closePrice: null,
    };
    st = advance(st, bars);

    // Material-event review: only for ideas still alive, at most once per day, and it can only invalidate.
    const lastBar = history.at(-1)!;
    if (isActive(st.status) && bars.length) {
      const { material, move } = isMaterialMove(history);
      if (material) {
        const [seen] = await sql`select 1 from thesis_events where idea_id = ${idea.id} and date = ${lastBar.date} and kind = 'move_review'`;
        if (!seen) {
          const headlines = await data.news(idea.ticker).catch(() => []);
          const check = await agents
            .thesisCheck(
              { ticker: idea.ticker, direction: idea.direction, thesis: idea.thesis, invalidation: idea.invalidation, entry: idea.entry, target: idea.target, stop: idea.stop },
              { date: lastBar.date, one_day_move_pct: Number((move * 100).toFixed(1)), close: lastBar.close, headlines },
            )
            .catch(() => null);
          if (check) {
            reviewed++;
            await sql`insert into thesis_events (idea_id, date, kind, verdict, note) values (${idea.id}, ${lastBar.date}, 'move_review', ${check.verdict}, ${check.reason})
                      on conflict do nothing`;
            if (check.verdict === "invalidated") {
              st = { ...st, status: "invalidated", closedAt: lastBar.date, closePrice: lastBar.close };
            }
          }
        }
      }
    }

    const done = !isActive(st.status);
    if (done) closed++;
    const fill = st.fillPrice;
    const exit = done ? st.closePrice : null;
    const outcome = fill !== null && exit !== null ? outcomePct(st.direction, fill, exit) : null;
    await sql`update trade_ideas set
        status = ${st.status}, filled_at = ${st.filledAt}, fill_price = ${fill},
        closed_at = ${st.closedAt}, close_price = ${exit}, outcome_pct = ${outcome},
        current_price = ${lastBar.close}, last_checked = ${lastBar.date},
        spy_at_fill = ${spyOn(spy, st.filledAt)}, spy_at_close = ${done ? spyOn(spy, st.closedAt) : null},
        spy_current = ${spyOn(spy, lastBar.date)}
      where id = ${idea.id}`;
  }
  return { checked, closed, reviewed };
}
