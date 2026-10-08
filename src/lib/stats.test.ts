import test from "node:test";
import assert from "node:assert/strict";
import { capWeights, maxDrawdown, correlation, annualVol } from "./stats";

const series = (closes: number[]) => closes.map((close, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, close }));

test("capWeights sums to 1 and respects the cap", () => {
  const w = capWeights([10, 1, 1, 1, 1, 1], 0.3);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(w.every((x) => x <= 0.3 + 1e-9));
});

test("capWeights relaxes an infeasible cap to equal weight", () => {
  const w = capWeights([1, 2, 3], 0.2);
  w.forEach((x) => assert.ok(Math.abs(x - 1 / 3) < 1e-9));
});

test("maxDrawdown finds peak to trough", () => {
  assert.ok(Math.abs(maxDrawdown([100, 120, 60, 90]) - -0.5) < 1e-9);
});

test("identical series correlate at 1", () => {
  const s = series(Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5 + i));
  assert.ok(Math.abs(correlation(s, s) - 1) < 1e-9);
});

test("flat series has zero vol", () => {
  assert.equal(annualVol(series([5, 5, 5, 5])), 0);
});
