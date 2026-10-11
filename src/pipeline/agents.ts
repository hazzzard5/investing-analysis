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

export interface UniversePick {
  subIndustries: string[];
  tickers: string[];
  marketCapMin?: number;
  marketCapMax?: number;
  rationale: string;
}

/** Screening analyst: choose which part of the S&P 500 the thesis is about. Code does the actual filtering and ranking. */
export const pickUniverse = (thesis: string, subIndustries: string[], symbols: string[]) =>
  askJson<UniversePick>(
    `${BASE}\nYour role: Screening analyst. The investable universe is the S&P 500. Map the thesis onto it using ONLY the sub-industries and tickers provided.`,
    `Thesis: ${thesis}\n\nReturn JSON: {"subIndustries":["exact names from the list, as many as the thesis plausibly touches"],"tickers":["optional S&P 500 tickers you are sure belong, even if their sub-industry is not listed"],"marketCapMin":number|null,"marketCapMax":number|null,"rationale":"2 sentences"}. Set market cap bounds in US dollars only if the thesis implies a size (for example "outside the megacaps" means a ceiling around 100000000000). Otherwise null.\n\nSub-industries:\n${subIndustries.join("\n")}\n\nTickers:\n${symbols.join(" ")}`,
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
  thesisFit: number;
  fairValueLow: number | null;
  fairValueHigh: number | null;
  catalysts: string[];
  invalidation: string[];
}

/** Lead analyst: synthesises the other agents' memos into one per-stock thesis. Trade levels must come from this. */
export const stockThesis = async (thesis: string, data: unknown): Promise<StockThesis> => {
  const t = await askJson<StockThesis & { conviction?: number }>(
    `${BASE}\nYour role: Lead analyst. Merge the fundamentals, valuation, sentiment and devil's advocate memos into a single investment thesis for this stock, and say what would prove it wrong.`,
    `Portfolio thesis: ${thesis}\n\nReturn JSON: {"stance":"bullish|bearish|neutral","verdict":"short label","conviction":<1-10>,"thesisFit":<1-10>,"summary":"3-4 sentences: why, citing the memos","fairValueLow":number|null,"fairValueHigh":number|null,"catalysts":["what could move the price toward fair value"],"invalidation":["specific, observable events or price levels that would break the thesis"]}.\nFair value must come from the provided DCF range, multiples or analyst targets; use null if the data does not support one. thesisFit rates how directly this company benefits from the portfolio thesis (10 = a core beneficiary, 5 = loosely related, 1 = unrelated); sector does not matter, only whether the link is real and specific. A bearish stance needs a real overvaluation or deterioration case, not just a strong bear memo. screening_side is only the quantitative screen's prior (long = strong metrics, short = weak or stretched); weigh the evidence and commit to \"bullish\" or \"bearish\" whenever the memos lean one way. Use \"neutral\" only when the evidence is genuinely balanced, which should be rare.\n\n${JSON.stringify(data).slice(0, 20_000)}`,
  );
  t.stance = ["bullish", "bearish", "neutral"].includes(t.stance) ? t.stance : "neutral";
  t.score = Math.min(10, Math.max(1, Number(t.conviction) || 5));
  t.thesisFit = Math.min(10, Math.max(1, Number(t.thesisFit) || 5));
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

export interface ThesisCheck {
  verdict: "intact" | "weakened" | "invalidated";
  reason: string;
}

/**
 * Reviews a frozen thesis after a dramatic event. It can only judge the ORIGINAL thesis against what happened;
 * it never writes a new one. Ordinary volatility is not a reason to change anything.
 */
export const thesisCheck = (frozen: unknown, event: unknown) =>
  askJson<ThesisCheck>(
    `${BASE}\nYour role: Thesis reviewer. A trade idea was written with a fixed thesis and fixed invalidation points. Decide only whether what just happened has broken that original thesis.`,
    `Verdict rules: "invalidated" only if an invalidation point was clearly hit or the event dramatically undermines the core reasoning (for example fraud, a failed deal, a guidance collapse, a regulatory ban). "weakened" if it matters but the thesis can still play out. Otherwise "intact"; a big price move on its own does not invalidate a thesis. Default to "intact" when unsure.\nReturn JSON: {"verdict":"intact|weakened|invalidated","reason":"2 sentences citing the event"}.\n\nFrozen thesis:\n${JSON.stringify(frozen)}\n\nEvent:\n${JSON.stringify(event).slice(0, 12_000)}`,
  );
