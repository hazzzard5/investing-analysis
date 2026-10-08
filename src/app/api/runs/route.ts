import { NextResponse } from "next/server";
import { createRun, runPipeline } from "../../../pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const text = String(b?.text ?? "").trim();
  const amount = Number(b?.amount);
  const maxWeight = Number(b?.maxWeight ?? 0.2);
  const minHoldings = Number(b?.minHoldings ?? 5);
  if (!text || !(amount > 0) || !(maxWeight > 0 && maxWeight <= 1) || !(minHoldings >= 1)) {
    return NextResponse.json({ error: "thesis, a positive amount, maxWeight (0-1] and minHoldings are required" }, { status: 400 });
  }
  const id = await createRun({ text, amount, maxWeight, minHoldings });
  // Local server: keep going after the response. Hosted serverless needs a queue; see README.
  void runPipeline(id);
  return NextResponse.json({ id }, { status: 202 });
}
