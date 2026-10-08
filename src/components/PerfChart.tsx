type Pt = { date: string; value: number; spy: number };

// Portfolio vs S&P 500 (SPY), both starting at the same dollar amount.
export default function PerfChart({ points }: { points: Pt[] }) {
  if (points.length < 2) return <p className="muted">Needs at least two daily snapshots. Run the daily snapshot job to build the history.</p>;
  const W = 640, H = 220, P = 36;
  const all = points.flatMap((p) => [p.value, p.spy]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i: number) => P + (i / (points.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - P * 2);
  const line = (k: "value" | "spy") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Portfolio value versus S&P 500" style={{ width: "100%", maxWidth: W }}>
      <path d={line("spy")} fill="none" stroke="var(--muted)" strokeWidth="2" />
      <path d={line("value")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <text x={P} y={14} fontSize="11" fill="var(--accent)">Portfolio ${points.at(-1)!.value.toFixed(0)}</text>
      <text x={P + 150} y={14} fontSize="11" fill="var(--muted)">S&P 500 (SPY) ${points.at(-1)!.spy.toFixed(0)}</text>
      <text x={P} y={H - 8} fontSize="10" fill="var(--muted)">{points[0].date}</text>
      <text x={W - P} y={H - 8} fontSize="10" fill="var(--muted)" textAnchor="end">{points.at(-1)!.date}</text>
    </svg>
  );
}
