// Macro backdrop from FRED's public CSV downloads (no API key). Fails soft: missing series are null.
const SERIES: Record<string, string> = {
  fed_funds_rate: "DFF",
  treasury_10y: "DGS10",
  treasury_2y: "DGS2",
  yield_curve_10y_minus_2y: "T10Y2Y",
  vix: "VIXCLS",
  high_yield_spread: "BAMLH0A0HYM2",
};

async function last(id: string): Promise<{ value: number; date: string } | null> {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const rows = (await res.text()).trim().split("\n").slice(1).map((l) => l.split(","));
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = Number(rows[i][1]);
      if (rows[i][1] && Number.isFinite(v)) return { value: v, date: rows[i][0] };
    }
  } catch {}
  return null;
}

export async function macroSnapshot(): Promise<Record<string, { value: number; date: string } | null>> {
  const entries = await Promise.all(Object.entries(SERIES).map(async ([k, id]) => [k, await last(id)] as const));
  return Object.fromEntries(entries);
}
