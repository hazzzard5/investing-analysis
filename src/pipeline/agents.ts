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

export const tradeIdea = (thesis: string, data: unknown) =>
  askJson<import("../lib/tradeIdeas").RawIdea & { direction: string }>(
    `${BASE}\nYour role: Trade-setup analyst. Propose at most one paper-trading setup for this stock, or none. Data is delayed by about a day, so levels are zones, not live triggers.`,
    `Thesis: ${thesis}\n\nUsing the technicals (including overextension), DCF and multiples, memos and macro backdrop, decide:\n- "long": a buy zone with entry below or near the last price, a price target and a stop.\n- "short": only when the stock looks overextended or overvalued AND macro or momentum supports it; entry, a lower target, a higher stop. Note borrow costs and squeeze risk in the rationale.\n- "none": when there is no edge.\nReturn JSON: {"direction":"long|short|none","entry":number,"target":number,"stop":number,"horizon":"e.g. 1-3 months","condition":"what must happen, e.g. pullback to the 50-day average","rationale":"2-3 sentences citing the data","confidence":<1-10>}. Prices must be in the same units as last_price.\n\n${JSON.stringify(data).slice(0, 20_000)}`,
  );
