import test from "node:test";
import assert from "node:assert/strict";
import { validateIdea } from "./tradeIdeas";

test("accepts a coherent long", () => {
  const i = validateIdea({ direction: "long", entry: 100, target: 120, stop: 92 }, 102)!;
  assert.ok(Math.abs(i.rewardRisk - 2.5) < 1e-9);
});

test("accepts a coherent short", () => {
  assert.ok(validateIdea({ direction: "short", entry: 100, target: 80, stop: 108 }, 99));
});

test("rejects levels on the wrong side, poor reward/risk, or far from price", () => {
  assert.equal(validateIdea({ direction: "long", entry: 100, target: 90, stop: 95 }, 100), null);
  assert.equal(validateIdea({ direction: "long", entry: 100, target: 104, stop: 95 }, 100), null);
  assert.equal(validateIdea({ direction: "short", entry: 200, target: 150, stop: 210 }, 100), null);
  assert.equal(validateIdea({ direction: "none" }, 100), null);
});
