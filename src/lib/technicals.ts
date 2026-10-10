import type { Series } from "./stats";

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

export function sma(s: Series, n: number): number | null {
  return s.length >= n ? avg(s.slice(-n).map((x) => x.close)) : null;
}

/** Wilder-style RSI over the last `n` changes (simple average version). */
export function rsi(s: Series, n = 14): number | null {
  if (s.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = s.length - n; i < s.length; i++) {
    const d = s[i].close - s[i - 1].close;
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export interface Technicals {
  price: number;
  sma50: number | null;
  sma200: number | null;
  pctFromSma50: number | null;
  pctFromSma200: number | null;
  rsi14: number | null;
  high52w: number;
  low52w: number;
  pctFromHigh: number;
  pctFromLow: number;
  /** "overextended_up" | "overextended_down" | "neutral" from RSI and distance from the 200-day average. */
  extension: "overextended_up" | "overextended_down" | "neutral";
}

export function technicals(s: Series): Technicals | null {
  if (s.length < 30) return null;
  const price = s.at(-1)!.close;
  const closes = s.slice(-252).map((x) => x.close);
  const s50 = sma(s, 50), s200 = sma(s, 200), r = rsi(s);
  const pct = (a: number | null) => (a ? price / a - 1 : null);
  const p200 = pct(s200);
  const up = (r !== null && r > 70) || (p200 !== null && p200 > 0.3);
  const down = (r !== null && r < 30) || (p200 !== null && p200 < -0.3);
  const hi = Math.max(...closes), lo = Math.min(...closes);
  return {
    price, sma50: s50, sma200: s200, pctFromSma50: pct(s50), pctFromSma200: p200, rsi14: r,
    high52w: hi, low52w: lo, pctFromHigh: price / hi - 1, pctFromLow: price / lo - 1,
    extension: up ? "overextended_up" : down ? "overextended_down" : "neutral",
  };
}
