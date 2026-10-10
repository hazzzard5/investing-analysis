import { fmpProvider } from "./fmpProvider";
import { yahoo } from "./yahoo";
import type { DataProvider } from "./types";

export type { DataProvider, Profile, NewsItem } from "./types";

/** Yahoo by default (free, no key). Set DATA_PROVIDER=fmp to use Financial Modeling Prep instead. */
export const data: DataProvider = process.env.DATA_PROVIDER === "fmp" ? fmpProvider : yahoo;
