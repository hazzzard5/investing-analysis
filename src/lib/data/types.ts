import type { Series } from "../stats";

export interface Profile {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  summary?: string;
}

export interface NewsItem {
  date: string;
  title: string;
  publisher?: string;
}

/** Everything the agents need. Daily-lagged data is fine; nothing here is real time. */
export interface DataProvider {
  name: string;
  profile(symbol: string): Promise<Profile | null>;
  /** Latest price. */
  price(symbol: string): Promise<number | null>;
  /** Daily closes, oldest first. */
  prices(symbol: string, days?: number): Promise<Series>;
  /** Key ratios, growth, margins, cash flow and debt as a flat-ish object, plus raw inputs for the DCF. */
  fundamentals(symbol: string): Promise<Record<string, any>>;
  news(symbol: string): Promise<NewsItem[]>;
  /** Optional: screen by criteria. Providers without a screener return []. */
  screen(criteria: Record<string, any>): Promise<string[]>;
}
