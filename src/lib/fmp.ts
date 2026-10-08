// Thin client for Financial Modeling Prep's "stable" API.
const BASE = "https://financialmodelingprep.com/stable";

type Params = Record<string, string | number | boolean | undefined>;

export async function fmp<T = any>(path: string, params: Params = {}): Promise<T> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not set");
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FMP ${path} failed: ${res.status}`);
  const body = await res.json();
  if (body && !Array.isArray(body) && body["Error Message"]) throw new Error(`FMP ${path}: ${body["Error Message"]}`);
  return body as T;
}

export interface ScreenCriteria {
  sector?: string;
  industry?: string;
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  exchange?: string;
  limit?: number;
}

export const screener = (c: ScreenCriteria) =>
  fmp<any[]>("company-screener", {
    ...c,
    isEtf: false,
    isFund: false,
    isActivelyTrading: true,
    limit: c.limit ?? 25,
  });

export const profile = async (symbol: string) => (await fmp<any[]>("profile", { symbol }))[0] ?? null;
export const quote = async (symbol: string) => (await fmp<any[]>("quote", { symbol }))[0] ?? null;
export const ratios = (symbol: string) => fmp<any[]>("ratios", { symbol, limit: 4 });
export const income = (symbol: string) => fmp<any[]>("income-statement", { symbol, limit: 4 });
export const cashflow = (symbol: string) => fmp<any[]>("cash-flow-statement", { symbol, limit: 4 });
export const balance = (symbol: string) => fmp<any[]>("balance-sheet-statement", { symbol, limit: 4 });
export const dcf = async (symbol: string) => (await fmp<any[]>("discounted-cash-flow", { symbol }))[0] ?? null;
export const news = (symbol: string) => fmp<any[]>("news/stock", { symbols: symbol, limit: 8 });

/** Daily closes, oldest first, for roughly the last year. */
export async function prices(symbol: string, days = 365): Promise<{ date: string; close: number }[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const rows = await fmp<any[]>("historical-price-eod/light", {
    symbol,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
  return rows
    .map((r) => ({ date: r.date as string, close: Number(r.price ?? r.close) }))
    .filter((r) => Number.isFinite(r.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}
