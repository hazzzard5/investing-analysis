import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Constituent {
  symbol: string; // Yahoo style: BRK-B
  name: string;
  sector: string;
  subIndustry: string;
}

/** Minimal CSV parser that handles quoted fields with commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseUniverse(csv: string): Constituent[] {
  const [head, ...rows] = parseCsv(csv);
  const ix = (n: string) => head.indexOf(n);
  return rows.map((r) => ({
    symbol: r[ix("Symbol")].replace(".", "-"),
    name: r[ix("Security")],
    sector: r[ix("GICS Sector")],
    subIndustry: r[ix("GICS Sub-Industry")],
  }));
}

/** S&P 500 snapshot committed in data/sp500.csv; refresh with `npm run universe:refresh`. */
export function loadUniverse(): Constituent[] {
  return parseUniverse(readFileSync(join(process.cwd(), "data", "sp500.csv"), "utf8"));
}
