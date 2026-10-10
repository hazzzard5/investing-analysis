import { askJson } from "../lib/llm";

export const DISCLAIMER =
  "Research output for a paper-trading experiment. Not financial advice; the user makes all decisions.";

const BASE = `You are one analyst on a research team. Use only the data provided; if something is missing, say so rather than guessing. Cite specific figures. ${DISCLAIMER}`;

export interface Memo {
  verdict: string;
  score: number; // 1 (worst) to 10 (best) for the thesis
  summary: string;
  points: string[];
}

const MEMO_SHAPE = `{"verdict":"short label","score":<1-10 number>,"summary":"2-3 sentences","points":["3-6 short bullets with figures"]}`;

export function memoMarkdown(m: Memo): string {
  return `**${m.verdict}** (score ${m.score}/10)\n\n${m.summary}\n\n${m.points.map((p) => `- ${p}`).join("\n")}`;
}

async function memo(role: string, task: string, thesis: string, data: unknown): Promise<Memo> {
  const m = await askJson<Memo>(
    `${BASE}\nYour role: ${role}.`,
    `Investment thesis: ${thesis}\n\nTask: ${task}\n\nReturn JSON shaped like ${MEMO_SHAPE}\n\nData:\n${JSON.stringify(data).slice(0, 24_000)}`,
  );
  m.score = Math.min(10, Math.max(1, Number(m.score) || 5));
  m.points = Array.isArray(m.points) ? m.points : [];
  return m;
}

export const fundamentals = (thesis: string, data: unknown) =>
  memo(
    "Fundamentals analyst",
    "Assess revenue growth, margins, debt, cash flow and competitive moat. Score how healthy the business is.",
    thesis,
    data,
  );

export const valuation = (thesis: string, data: unknown) =>
  memo(
    "Valuation analyst",
    "Judge whether the stock looks cheap, fair or expensive using the DCF value, price and multiples. Higher score = more attractive valuation.",
    thesis,
    data,
  );

export const sentiment = (thesis: string, data: unknown) =>
  memo(
    "News and sentiment analyst",
    "Summarise recent headlines for tone and material events. Higher score = more favourable recent news flow.",
    thesis,
    data,
  );

export const devilsAdvocate = (thesis: string, data: unknown) =>
  memo(
    "Devil's advocate",
    "Argue AGAINST owning this stock for this thesis, using the other analysts' memos and data. Score = how strong the bear case is (10 = very strong, so a high score is bad for the stock).",
    thesis,
    data,
  );

export interface ScreenPlan {
  criteria: {
    sector?: string;
    industry?: string;
    marketCapMoreThan?: number;
    marketCapLowerThan?: number;
    exchange?: string;
  };
  tickers: string[];
  rationale: string;
}

export const planScreen = (thesis: string) =>
  askJson<ScreenPlan>(
    `${BASE}\nYour role: Screening analyst. Turn the thesis into FMP stock-screener criteria and propose candidate US-listed tickers from your own knowledge.`,
    `Thesis: ${thesis}\n\nReturn JSON: {"criteria":{"sector":"optional FMP sector name","industry":"optional FMP industry name","marketCapMoreThan":number,"marketCapLowerThan":number,"exchange":"optional e.g. NASDAQ"},"tickers":["up to 15 tickers"],"rationale":"2 sentences"}. Respect exclusions in the thesis (for example "outside the megacaps" means a market cap ceiling).`,
  );

export interface Construction {
  picks: { ticker: string; weight: number; rationale: string }[];
}

export const construct = (thesis: string, rules: { maxWeight: number; minHoldings: number }, summaries: unknown) =>
  askJson<Construction>(
    `${BASE}\nYour role: Portfolio constructor. Choose holdings and weights that fit the thesis and balance the analysts' views.`,
    `Thesis: ${thesis}\nRules: at least ${rules.minHoldings} holdings, no holding above ${(rules.maxWeight * 100).toFixed(0)}%, weights sum to 1.\n\nReturn JSON: {"picks":[{"ticker":"","weight":0.2,"rationale":"one sentence"}]}\n\nCandidates and memo scores:\n${JSON.stringify(summaries).slice(0, 24_000)}`,
  );

export const riskCommentary = (thesis: string, metrics: unknown) =>
  memo(
    "Risk analyst",
    "Comment on the portfolio's risk using the computed metrics: volatility, correlation, sector concentration, worst drawdown. Score = overall safety (10 = low risk).",
    thesis,
    metrics,
  );

export interface StockThesis extends Memo {
  stance: "bullish" | "bearish" | "neutral";
  fairValueLow: number | null;
  fairValueHigh: number | null;
  catalysts: string[];
  invalidation: string[];
}

/** Lead analyst: synthesises the other agents' memos into one per-stock thesis. Trade levels must come from this. */
export const stockThesis = async (thesis: string, data: unknown): Promise<StockThesis> => {
  const t = await askJson<StockThesis & { conviction?: number }>(
    `${BASE}\nYour role: Lead analyst. Merge the fundamentals, valuation, sentiment and devil's advocate memos into a single investment thesis for this stock, and say what would prove it wrong.`,
    `Portfolio thesis: ${thesis}\n\nReturn JSON: {"stance":"bullish|bearish|neutral","verdict":"short label","conviction":<1-10>,"summary":"3-4 sentences: why, citing the memos","fairValueLow":number|null,"fairValueHigh":number|null,"catalysts":["what could move the price toward fair value"],"invalidation":["specific, observable events or price levels that would break the thesis"]}.\nFair value must come from the provided DCF range, multiples or analyst targets; use null if the data does not support one. A bearish stance needs a real overvaluation or deterioration case, not just a strong bear memo.\n\n${JSON.stringify(data).slice(0, 20_000)}`,
  );
  t.stance = ["bullish", "bearish", "neutral"].includes(t.stance) ? t.stance : "neutral";
  t.score = Math.min(10, Math.max(1, Number(t.conviction) || 5));
  t.points = [
    ...(t.fairValueLow && t.fairValueHigh ? [`Fair value range: $${Number(t.fairValueLow).toFixed(2)} to $${Number(t.fairValueHigh).toFixed(2)}`] : []),
    ...(t.catalysts ?? []).map((c) => `Catalyst: ${c}`),
    ...(t.invalidation ?? []).map((c) => `Invalidation: ${c}`),
  ];
  t.fairValueLow = Number(t.fairValueLow) > 0 ? Number(t.fairValueLow) : null;
  t.fairValueHigh = Number(t.fairValueHigh) > 0 ? Number(t.fairValueHigh) : null;
  return t;
};

export const tradeIdea = (thesis: string, data: unknown) =>
  askJson<import("../lib/tradeIdeas").RawIdea & { direction: string }>(
    `${BASE}\nYour role: Trade-setup analyst. Turn the lead analyst's stock thesis into at most one paper-trading setup, or none. Data is delayed by about a day, so levels are zones, not live triggers.`,
    `Portfolio thesis: ${thesis}\n\nThe stock_thesis in the data is the basis for everything. Derive the levels from it:\n- direction must match its stance: bullish gives "long", bearish gives "short", neutral gives "none".\n- entry: a zone justified by the thesis fair value (a discount to it) and, for timing, the technicals (pullback to a moving average, overextension).\n- target: at or below the thesis fair value for a long; at or above it for a short. Name the fair value you used.\n- stop: a price that invalidates the thesis, tied to one of its invalidation points or a technical level behind the entry.\n- Shorts also need overextension or deteriorating fundamentals plus supportive macro; mention borrow cost and squeeze risk.\nReturn JSON: {"direction":"long|short|none","entry":number,"target":number,"stop":number,"entry_basis":"why this entry, citing the thesis and data","target_basis":"which fair value or target","stop_basis":"which invalidation point","horizon":"e.g. 1-3 months","condition":"what must happen before acting","rationale":"2 sentences","confidence":<1-10>}. Prices use the same units as last_price.\n\n${JSON.stringify(data).slice(0, 20_000)}`,
  );
