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
  const candidates = Number(b?.candidates ?? 15);
  if (!text || !(amount > 0) || !(maxWeight > 0 && maxWeight <= 1) || !(minHoldings >= 1) || !(candidates >= 5 && candidates <= 40)) {
    return NextResponse.json({ error: "thesis, a positive amount, maxWeight (0-1], minHoldings and candidates (5-40) are required" }, { status: 400 });
  }
  const id = await createRun({ text, amount, maxWeight, minHoldings, candidates });
  // Local server: keep going after the response. Hosted serverless needs a queue; see README.
  void runPipeline(id);
  return NextResponse.json({ id }, { status: 202 });
}
