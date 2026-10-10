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

const bull = { stance: "bullish" as const, fairValueLow: 110, fairValueHigh: 125 };

test("direction must follow the thesis stance", () => {
  assert.ok(validateIdea({ direction: "long", entry: 100, target: 120, stop: 92 }, 102, bull));
  assert.equal(validateIdea({ direction: "short", entry: 100, target: 80, stop: 108 }, 99, bull), null);
  assert.equal(validateIdea({ direction: "long", entry: 100, target: 120, stop: 92 }, 102, { ...bull, stance: "neutral" }), null);
});

test("long target cannot run past thesis fair value", () => {
  assert.equal(validateIdea({ direction: "long", entry: 100, target: 150, stop: 92 }, 102, bull), null);
});
