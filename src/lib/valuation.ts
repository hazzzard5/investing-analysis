// Simple, transparent two-stage DCF from free cash flow. A sanity check, not a price oracle.
export interface DcfInput {
  freeCashflow: number | null;
  revenueGrowth: number | null;
  sharesOutstanding: number | null;
  totalCash?: number | null;
  totalDebt?: number | null;
}

export interface DcfResult {
  perShare: number;
  assumptions: { growth: number; discount: number; terminal: number; years: number };
  low: number; // discount rate +1pt
  high: number; // discount rate -1pt
}

function value(fcf: number, g: number, r: number, tg: number, years: number): number {
  let pv = 0;
  let cf = fcf;
  for (let t = 1; t <= years; t++) {
    const gt = g + ((tg - g) * (t - 1)) / (years - 1); // growth fades linearly to terminal
    cf *= 1 + gt;
    pv += cf / (1 + r) ** t;
  }
  return pv + (cf * (1 + tg)) / (r - tg) / (1 + r) ** years;
}

export function dcf(i: DcfInput, discount = 0.1, terminal = 0.03, years = 10): DcfResult | null {
  if (!i.freeCashflow || i.freeCashflow <= 0 || !i.sharesOutstanding) return null; // negative FCF: DCF not meaningful
  const growth = Math.min(Math.max(i.revenueGrowth ?? 0.05, 0), 0.25); // clamp: no heroic assumptions
  const net = (i.totalCash ?? 0) - (i.totalDebt ?? 0);
  const ps = (r: number) => (value(i.freeCashflow!, growth, r, terminal, years) + net) / i.sharesOutstanding!;
  return { perShare: ps(discount), low: ps(discount + 0.01), high: ps(discount - 0.01), assumptions: { growth, discount, terminal, years } };
}
