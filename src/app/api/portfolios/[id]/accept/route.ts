import { NextResponse } from "next/server";
import { sql } from "../../../../../lib/db";
import { snapshotAll } from "../../../../../pipeline/snapshot";

export const dynamic = "force-dynamic";

// The user's decision: start tracking a proposed portfolio as a paper portfolio. No trades are ever placed.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await sql`update portfolios set status = 'paper', start_date = current_date
                         where id = ${id} and status = 'proposed' returning id`;
  if (!rows.length) return NextResponse.json({ error: "not a proposed portfolio" }, { status: 404 });
  await snapshotAll().catch(() => {});
  return NextResponse.json({ ok: true });
}
