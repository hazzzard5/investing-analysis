import { NextResponse } from "next/server";
import { monitorIdeas } from "../../../../pipeline/monitor";
import { snapshotAll } from "../../../../pipeline/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Scheduled job: advance trade-idea lifecycles and record paper snapshots. Protect with CRON_SECRET when deployed.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ideas: await monitorIdeas(), snapshots: await snapshotAll() });
}
