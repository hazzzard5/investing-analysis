import test from "node:test";
import assert from "node:assert/strict";
import { loadUniverse, parseCsv } from "./universe";
import { rankCandidates, type Metrics } from "./ranking";

test("parseCsv handles quoted commas", () => {
  assert.deepEqual(parseCsv('a,"b,c",d\n1,2,3\n'), [["a", "b,c", "d"], ["1", "2", "3"]]);
});

test("S&P 500 snapshot loads with Yahoo-style tickers", () => {
  const u = loadUniverse();
  assert.ok(u.length > 480 && u.length < 520);
  assert.ok(u.some((c) => c.symbol === "BRK-B"));
  assert.ok(u.every((c) => c.sector && c.subIndustry));
});

const m = (symbol: string, k: number): Metrics => ({ symbol, marketCap: 1e10, revenueGrowth: k, operatingMargin: k, fcfYield: k, momentum: k, pe: 30 - k * 10, debtToEquity: 1 - k * 0.1, extension: k > 2 ? 0.4 : 0 });

test("rankCandidates splits long and short and returns the requested count", () => {
  const all = Array.from({ length: 30 }, (_, i) => m(`T${i}`, (i - 15) / 5));
  const r = rankCandidates(all, 10);
  assert.equal(r.length, 10);
  assert.equal(r.filter((x) => x.side === "short").length, 3);
  assert.equal(r[0].symbol, "T29");
  assert.ok(r.filter((x) => x.side === "short").every((x) => Number(x.symbol.slice(1)) < 10));
});

test("names with too little data are skipped", () => {
  const sparse: Metrics = { symbol: "X", marketCap: null, revenueGrowth: 1, operatingMargin: null, fcfYield: null, momentum: null, pe: null, debtToEquity: null, extension: null };
  const r = rankCandidates([sparse, ...Array.from({ length: 10 }, (_, i) => m(`T${i}`, i))], 5);
  assert.ok(!r.some((x) => x.symbol === "X"));
});

test("rankCandidates keeps one sub-industry from taking every long slot", () => {
  const all = [
    ...Array.from({ length: 6 }, (_, i) => ({ ...m(`A${i}`, 5 - i * 0.1), group: "Semis" })),
    ...Array.from({ length: 4 }, (_, i) => ({ ...m(`B${i}`, 2 - i * 0.1), group: "Utilities" })),
  ];
  const longs = rankCandidates(all, 6).filter((r) => r.side === "long");
  assert.ok(longs.filter((r) => r.symbol.startsWith("A")).length <= 3);
  assert.ok(longs.some((r) => r.symbol.startsWith("B")));
});
