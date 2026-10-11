import * as fmp from "../fmp";
import type { DataProvider } from "./types";

// Optional paid/free-tier FMP provider (set DATA_PROVIDER=fmp). Fundamentals are mapped onto the same shape as Yahoo's.
const n = (v: any) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);

export const fmpProvider: DataProvider = {
  name: "fmp",
  async profile(symbol) {
    const p = await fmp.profile(symbol).catch(() => null);
    if (!p) return null;
    return { symbol: p.symbol, name: p.companyName, sector: p.sector ?? "Unknown", industry: p.industry ?? "Unknown", marketCap: Number(p.marketCap) || 0, price: Number(p.price), summary: String(p.description ?? "").slice(0, 600) };
  },
  async price(symbol) {
    return n((await fmp.quote(symbol).catch(() => null))?.price);
  },
  prices: (symbol, days) => fmp.prices(symbol, days),
  async fundamentals(symbol) {
    const [r, inc, cf, bs, d] = await Promise.all([
      fmp.ratios(symbol).catch(() => []),
      fmp.income(symbol).catch(() => []),
      fmp.cashflow(symbol).catch(() => []),
      fmp.balance(symbol).catch(() => []),
      fmp.dcf(symbol).catch(() => null),
    ]);
    const i0 = inc[0] ?? {}, i1 = inc[1] ?? {}, c0 = cf[0] ?? {}, b0 = bs[0] ?? {}, r0 = r[0] ?? {};
    return {
      revenue: n(i0.revenue),
      revenueGrowth: i1.revenue ? Number(i0.revenue) / Number(i1.revenue) - 1 : null,
      grossMargin: n(r0.grossProfitMargin),
      operatingMargin: n(r0.operatingProfitMargin),
      profitMargin: n(r0.netProfitMargin),
      freeCashflow: n(c0.freeCashFlow),
      operatingCashflow: n(c0.operatingCashFlow),
      totalCash: n(b0.cashAndCashEquivalents),
      totalDebt: n(b0.totalDebt),
      debtToEquity: n(r0.debtToEquityRatio),
      currentRatio: n(r0.currentRatio),
      sharesOutstanding: n(i0.weightedAverageShsOut),
      trailingPE: n(r0.priceToEarningsRatio),
      priceToBook: n(r0.priceToBookRatio),
      fmpDcf: n(d?.dcf),
    };
  },
  async news(symbol) {
    return (await fmp.news(symbol).catch(() => [])).map((x: any) => ({ date: String(x.publishedDate ?? "").slice(0, 10), title: x.title, publisher: x.publisher }));
  },
};
