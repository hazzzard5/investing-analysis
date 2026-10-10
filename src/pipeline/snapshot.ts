import { sql } from "../lib/db";
import { data } from "../lib/data";

/** Record today's value of every paper portfolio next to the S&P 500 (SPY) path. Safe to run repeatedly. */
export async function snapshotAll(): Promise<{ portfolios: number }> {
  const pfs = await sql`select id, amount, cash, spy_entry_price from portfolios where status = 'paper'`;
  if (!pfs.length) return { portfolios: 0 };
  const spy = Number(await data.price("SPY"));
  const today = new Date().toISOString().slice(0, 10);
  for (const pf of pfs) {
    const pos = await sql`select ticker, shares from positions where portfolio_id = ${pf.id}`;
    let value = Number(pf.cash);
    let complete = true;
    for (const p of pos) {
      const px = await data.price(p.ticker);
      if (px === null) complete = false; // never record a value with a missing price
      else value += Number(p.shares) * px;
    }
    if (!complete || !Number.isFinite(spy)) continue;
    const spyValue = (Number(pf.amount) * spy) / Number(pf.spy_entry_price);
    await sql`insert into snapshots (portfolio_id, date, value, spy_value) values (${pf.id}, ${today}, ${value}, ${spyValue})
              on conflict (portfolio_id, date) do update set value = excluded.value, spy_value = excluded.spy_value`;
  }
  return { portfolios: pfs.length };
}
