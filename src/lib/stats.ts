// Pure risk math. No I/O, so it is unit-testable.
export type Series = { date: string; close: number }[];

export function dailyReturns(s: Series): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < s.length; i++) out.push({ date: s[i].date, r: s[i].close / s[i - 1].close - 1 });
  return out;
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

export function stdev(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}

/** Annualised volatility from a price series. */
export const annualVol = (s: Series) => stdev(dailyReturns(s).map((x) => x.r)) * Math.sqrt(252);

/** Worst peak-to-trough fall of a price/value series, as a negative fraction (e.g. -0.32). */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

/** Correlation of daily returns over the dates both series share. */
export function correlation(a: Series, b: Series): number {
  const bm = new Map(dailyReturns(b).map((x) => [x.date, x.r]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const x of dailyReturns(a)) {
    const y = bm.get(x.date);
    if (y !== undefined) {
      xs.push(x.r);
      ys.push(y);
    }
  }
  if (xs.length < 20) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}

/** Daily value path of a weighted, daily-rebalanced portfolio on dates every holding has. */
export function portfolioPath(holdings: { weight: number; series: Series }[]): number[] {
  const maps = holdings.map((h) => new Map(dailyReturns(h.series).map((x) => [x.date, x.r])));
  const dates = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  let v = 1;
  const path = [1];
  for (const d of dates) {
    v *= 1 + holdings.reduce((sum, h, i) => sum + h.weight * maps[i].get(d)!, 0);
    path.push(v);
  }
  return path;
}

/**
 * Turn raw positive scores into weights that sum to 1 with no weight above `cap`.
 * If the cap is infeasible for this many names (n * cap < 1) it relaxes to 1/n.
 */
export function capWeights(raw: number[], cap: number): number[] {
  const n = raw.length;
  if (n === 0) return [];
  const c = Math.max(cap, 1 / n);
  const base = raw.map((x) => (x > 0 ? x : 1e-9));
  const w = new Array<number>(n).fill(0);
  let free = base.map((_, i) => i);
  let remaining = 1;
  while (free.length) {
    const total = free.reduce((s, i) => s + base[i], 0);
    const over = free.filter((i) => (base[i] / total) * remaining > c + 1e-12);
    if (!over.length) {
      for (const i of free) w[i] = (base[i] / total) * remaining;
      break;
    }
    for (const i of over) {
      w[i] = c;
      remaining -= c;
    }
    free = free.filter((i) => !over.includes(i));
  }
  return w;
}
