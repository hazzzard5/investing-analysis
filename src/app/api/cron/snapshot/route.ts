import { NextResponse } from "next/server";
import { snapshotAll } from "../../../../pipeline/snapshot";

export const dynamic = "force-dynamic";

// Daily job: record paper-portfolio value vs SPY. Protect with CRON_SECRET when deployed.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await snapshotAll());
}
