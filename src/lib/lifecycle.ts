// Mechanical lifecycle of a frozen trade idea, evaluated on daily closes. No model involved.
import type { Series } from "./stats";

export type IdeaStatus = "pending" | "open" | "target_hit" | "stopped" | "invalidated" | "missed" | "expired";

export interface IdeaState {
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  status: IdeaStatus;
  createdAt: string; // yyyy-mm-dd
  fillPrice: number | null;
  filledAt: string | null;
  closedAt: string | null;
  closePrice: number | null;
}

export const PENDING_DAYS = 30; // an entry that never trades within this window is dropped
export const MAX_OPEN_DAYS = 180; // flagged as expired for a fresh look, not rewritten
const FILL_TOLERANCE = 0.005;

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const isActive = (s: IdeaStatus) => s === "pending" || s === "open";

/** Apply daily bars (oldest first, all after the last check) to an idea. */
export function advance(state: IdeaState, bars: Series): IdeaState {
  const s = { ...state };
  const long = s.direction === "long";
  for (const { date, close } of bars) {
    if (!isActive(s.status)) break;
    const hitTarget = long ? close >= s.target : close <= s.target;
    const hitStop = long ? close <= s.stop : close >= s.stop;
    if (s.status === "pending") {
      const fillable = long ? close <= s.entry * (1 + FILL_TOLERANCE) : close >= s.entry * (1 - FILL_TOLERANCE);
      if (hitStop || (hitTarget && !fillable)) {
        // the move happened (or the idea broke) without us ever getting in
        s.status = "missed"; s.closedAt = date; s.closePrice = close;
      } else if (fillable) {
        s.status = "open"; s.fillPrice = close; s.filledAt = date;
      } else if (days(s.createdAt, date) > PENDING_DAYS) {
        s.status = "expired"; s.closedAt = date; s.closePrice = close;
      }
    } else {
      if (hitTarget) { s.status = "target_hit"; s.closedAt = date; s.closePrice = close; }
      else if (hitStop) { s.status = "stopped"; s.closedAt = date; s.closePrice = close; }
      else if (days(s.filledAt!, date) > MAX_OPEN_DAYS) { s.status = "expired"; s.closedAt = date; s.closePrice = close; }
    }
  }
  return s;
}

/** Return of the paper position in percent (shorts gain when price falls). */
export function outcomePct(direction: "long" | "short", fill: number, price: number): number {
  return ((direction === "long" ? price / fill : fill / price) - 1) * 100;
}

/** True when the last daily move is large enough to justify a thesis review. */
export function isMaterialMove(history: Series, minMove = 0.07, sigmas = 3): { material: boolean; move: number } {
  if (history.length < 25) return { material: false, move: 0 };
  const rets = history.slice(1).map((x, i) => x.close / history[i].close - 1);
  const last = rets.at(-1)!;
  const prior = rets.slice(-61, -1);
  const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
  const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, prior.length - 1));
  return { material: Math.abs(last) >= minMove && Math.abs(last) >= sigmas * sd, move: last };
}
