import test from "node:test";
import assert from "node:assert/strict";
import { dcf } from "./valuation";
import { technicals, rsi } from "./technicals";

test("dcf returns null for negative free cash flow", () => {
  assert.equal(dcf({ freeCashflow: -5, revenueGrowth: 0.1, sharesOutstanding: 100 }), null);
});

test("dcf is higher at lower discount rates and clamps growth", () => {
  const r = dcf({ freeCashflow: 1000, revenueGrowth: 2, sharesOutstanding: 100 })!;
  assert.ok(r.high > r.perShare && r.perShare > r.low);
  assert.equal(r.assumptions.growth, 0.25);
});

const rising = Array.from({ length: 260 }, (_, i) => ({ date: `d${i}`, close: 100 + i * 2 }));

test("a steady climb reads as overextended up", () => {
  assert.equal(rsi(rising), 100);
  assert.equal(technicals(rising)!.extension, "overextended_up");
});

test("too little history gives no technicals", () => {
  assert.equal(technicals(rising.slice(0, 10)), null);
});
