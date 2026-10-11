// Quantitative pre-ranking of the thesis-relevant S&P 500 names, so the expensive agents only see the best candidates.
export interface Metrics {
  symbol: string;
  marketCap: number | null;
  revenueGrowth: number | null;
  operatingMargin: number | null;
  fcfYield: number | null; // free cash flow / market cap
  momentum: number | null; // roughly 12-1 month return
  pe: number | null;
  debtToEquity: number | null;
  extension: number | null; // distance above 200-day average
  group?: string; // sub-industry: no group may supply more than half of the long candidates
}

const FACTORS: { key: keyof Metrics; sign: 1 | -1 }[] = [
  { key: "revenueGrowth", sign: 1 },
  { key: "operatingMargin", sign: 1 },
  { key: "fcfYield", sign: 1 },
  { key: "momentum", sign: 1 },
  { key: "pe", sign: -1 },
  { key: "debtToEquity", sign: -1 },
];

function zscores(vals: (number | null)[]): (number | null)[] {
  const xs = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (xs.length < 3) return vals.map(() => null);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
  // winsorise at +/-3 so one outlier can't dominate
  return vals.map((v) => (v === null || !Number.isFinite(v) ? null : Math.max(-3, Math.min(3, (v - m) / sd))));
}

export interface Ranked {
  symbol: string;
  score: number; // higher = more attractive on quality, growth, momentum and valuation
  side: "long" | "short";
  factors: number; // how many factors were available
}

/**
 * Score every name (average z-score across available factors, at least 3 needed), then take the top ~70% of
 * `count` as long candidates and the bottom ~30% as short candidates. Shorts get a bonus pick for names that
 * are extended far above their 200-day average.
 */
export function rankCandidates(all: Metrics[], count: number): Ranked[] {
  const z = FACTORS.map((f) => zscores(all.map((m) => m[f.key] as number | null)));
  const scored = all
    .map((m, i) => {
      const parts = FACTORS.map((f, j) => (z[j][i] === null ? null : z[j][i]! * f.sign)).filter((v): v is number => v !== null);
      const ext = m.extension ?? 0;
      return { symbol: m.symbol, group: m.group, factors: parts.length, score: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : NaN, ext };
    })
    .filter((s) => s.factors >= 3 && Number.isFinite(s.score))
  const nShort = Math.floor(count * 0.3);
  const nLong = count - nShort;
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  // Keep one sub-industry from filling the whole list: cap each at half the long slots (when groups are known).
  const cap = Math.max(1, Math.ceil(nLong / 2));
  const used = new Map<string, number>();
  const longs: typeof byScore = [];
  for (const x of byScore) {
    if (longs.length >= nLong) break;
    const g = x.group ?? x.symbol;
    if ((used.get(g) ?? 0) >= cap) continue;
    used.set(g, (used.get(g) ?? 0) + 1);
    longs.push(x);
  }
  for (const x of byScore) if (longs.length < nLong && !longs.includes(x)) longs.push(x);
  const rest = byScore.filter((x) => !longs.includes(x));
  // shorts: weakest scores, with extension (stretched price) pushing a name up the list
  const shorts = [...rest].sort((a, b) => a.score - 0.5 * Math.max(0, a.ext) - (b.score - 0.5 * Math.max(0, b.ext))).slice(0, nShort);
  return [
    ...longs.map(({ symbol, score, factors }) => ({ symbol, score, factors, side: "long" as const })),
    ...shorts.map(({ symbol, score, factors }) => ({ symbol, score, factors, side: "short" as const })),
  ];
}
