import YahooFinance from "yahoo-finance2";
import type { DataProvider, NewsItem, Profile } from "./types";

// Unofficial Yahoo Finance access (no key). Daily lag is fine for this app; expect occasional breakage.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] } as any) as any;
const raw = (v: any) => (v && typeof v === "object" && "raw" in v ? v.raw : v);
const num = (v: any) => {
  const n = Number(raw(v));
  return Number.isFinite(n) ? n : null;
};

export const yahoo: DataProvider = {
  name: "yahoo",

  async profile(symbol) {
    const [q, s] = await Promise.all([
      yf.quote(symbol).catch(() => null),
      yf.quoteSummary(symbol, { modules: ["assetProfile"] }, { validateResult: false }).catch(() => null),
    ]);
    const price = num(q?.regularMarketPrice);
    if (!q || price === null) return null;
    const p = s?.assetProfile ?? {};
    return {
      symbol: q.symbol ?? symbol,
      name: q.longName ?? q.shortName ?? symbol,
      sector: p.sector ?? "Unknown",
      industry: p.industry ?? "Unknown",
      marketCap: num(q.marketCap) ?? 0,
      price,
      summary: p.longBusinessSummary ? String(p.longBusinessSummary).slice(0, 600) : undefined,
    } satisfies Profile;
  },

  async price(symbol) {
    return num((await yf.quote(symbol).catch(() => null))?.regularMarketPrice);
  },

  async prices(symbol, days = 365) {
    const res = await yf.chart(symbol, { period1: new Date(Date.now() - days * 86_400_000), interval: "1d" });
    return (res.quotes ?? [])
      .filter((r: any) => r.close != null)
      .map((r: any) => ({ date: new Date(r.date).toISOString().slice(0, 10), close: Number(r.close) }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  },

  async fundamentals(symbol) {
    const s = await yf.quoteSummary(
      symbol,
      { modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "earningsTrend"] },
      { validateResult: false },
    );
    const f = s.financialData ?? {};
    const k = s.defaultKeyStatistics ?? {};
    const d = s.summaryDetail ?? {};
    return {
      price: num(f.currentPrice),
      revenue: num(f.totalRevenue),
      revenueGrowth: num(f.revenueGrowth),
      earningsGrowth: num(f.earningsGrowth),
      grossMargin: num(f.grossMargins),
      operatingMargin: num(f.operatingMargins),
      profitMargin: num(f.profitMargins),
      roe: num(f.returnOnEquity),
      freeCashflow: num(f.freeCashflow),
      operatingCashflow: num(f.operatingCashflow),
      totalCash: num(f.totalCash),
      totalDebt: num(f.totalDebt),
      debtToEquity: num(f.debtToEquity),
      currentRatio: num(f.currentRatio),
      sharesOutstanding: num(k.sharesOutstanding),
      trailingPE: num(d.trailingPE),
      forwardPE: num(d.forwardPE ?? k.forwardPE),
      pegRatio: num(k.pegRatio),
      priceToBook: num(k.priceToBook),
      beta: num(k.beta ?? d.beta),
      fiftyTwoWeekHigh: num(d.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(d.fiftyTwoWeekLow),
      analystTargetMean: num(f.targetMeanPrice),
      analystRecommendation: f.recommendationKey ?? null,
    };
  },

  async news(symbol) {
    const r = await yf.search(symbol, { newsCount: 8, quotesCount: 0 }).catch(() => null);
    return (r?.news ?? []).map(
      (n: any): NewsItem => ({
        date: n.providerPublishTime ? new Date(n.providerPublishTime).toISOString().slice(0, 10) : "",
        title: n.title,
        publisher: n.publisher,
      }),
    );
  },

};
