import test from "node:test";
import assert from "node:assert/strict";
import { advance, isMaterialMove, outcomePct, type IdeaState } from "./lifecycle";

const base: IdeaState = { direction: "long", entry: 100, target: 120, stop: 90, status: "pending", createdAt: "2026-01-01", fillPrice: null, filledAt: null, closedAt: null, closePrice: null };
const bars = (...c: number[]) => c.map((close, i) => ({ date: `2026-01-${String(i + 2).padStart(2, "0")}`, close }));

test("long fills on a dip to entry, then hits target", () => {
  const s = advance(base, bars(105, 100, 110, 121));
  assert.equal(s.status, "target_hit");
  assert.equal(s.fillPrice, 100);
  assert.equal(s.closePrice, 121);
});

test("long that never reaches entry before the target is missed", () => {
  assert.equal(advance(base, bars(105, 110, 121)).status, "missed");
});

test("stop closes an open idea", () => {
  const s = advance(base, bars(100, 95, 89));
  assert.equal(s.status, "stopped");
  assert.equal(s.closePrice, 89);
});

test("short mirrors long", () => {
  const sh: IdeaState = { ...base, direction: "short", entry: 100, target: 80, stop: 110 };
  assert.equal(advance(sh, bars(95, 100, 90, 79)).status, "target_hit");
  assert.equal(advance(sh, bars(100, 111)).status, "stopped");
});

test("pending entries expire", () => {
  assert.equal(advance(base, [{ date: "2026-03-01", close: 110 }]).status, "expired");
});

test("closed ideas ignore later bars", () => {
  const s = advance(base, bars(100, 121, 50));
  assert.equal(s.status, "target_hit");
});

test("outcomePct signs", () => {
  assert.ok(outcomePct("long", 100, 110) > 0);
  assert.ok(outcomePct("short", 100, 90) > 0);
  assert.ok(outcomePct("short", 100, 110) < 0);
});

test("material move needs size and sigma", () => {
  const calm = Array.from({ length: 80 }, (_, i) => ({ date: `d${i}`, close: 100 + (i % 2) * 0.5 }));
  assert.equal(isMaterialMove([...calm, { date: "x", close: 120 }]).material, true);
  assert.equal(isMaterialMove([...calm, { date: "x", close: 100.4 }]).material, false);
});
