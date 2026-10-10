// Validates model-proposed trade ideas against hard rules. The model suggests levels; code decides if they are coherent.
export interface RawIdea {
  direction?: string;
  entry?: number;
  target?: number;
  stop?: number;
  horizon?: string;
  condition?: string;
  rationale?: string;
  confidence?: number;
}

export interface TradeIdea {
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  rewardRisk: number;
  horizon: string;
  condition: string;
  rationale: string;
  confidence: number;
}

export const MIN_REWARD_RISK = 1.5;
export const MAX_ENTRY_DISTANCE = 0.15; // entry must be within 15% of the last price

export function validateIdea(raw: RawIdea | null | undefined, price: number): TradeIdea | null {
  if (!raw || (raw.direction !== "long" && raw.direction !== "short")) return null;
  const entry = Number(raw.entry), target = Number(raw.target), stop = Number(raw.stop);
  if (![entry, target, stop].every((x) => Number.isFinite(x) && x > 0)) return null;
  const long = raw.direction === "long";
  if (long ? !(stop < entry && entry < target) : !(target < entry && entry < stop)) return null;
  if (Math.abs(entry / price - 1) > MAX_ENTRY_DISTANCE) return null;
  const rewardRisk = Math.abs(target - entry) / Math.abs(entry - stop);
  if (rewardRisk < MIN_REWARD_RISK) return null;
  return {
    direction: raw.direction,
    entry, target, stop,
    rewardRisk,
    horizon: String(raw.horizon ?? "weeks to months"),
    condition: String(raw.condition ?? ""),
    rationale: String(raw.rationale ?? ""),
    confidence: Math.min(10, Math.max(1, Number(raw.confidence) || 5)),
  };
}
