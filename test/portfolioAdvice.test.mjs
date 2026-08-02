/**
 * test/portfolioAdvice.test.mjs — C-02 regression: short stop/target advice must branch by direction.
 * A short at 100 with stop 102 / target 95: at 103 the stop is broken (Exit), at 94 the target is hit
 * (Take profit) — the opposite of the long-only comparison that shipped before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeHolding, ACTIONS } from "../src/services/portfolioService.js";

const stock = (price) => ({ price, hasData: true, rsi: 50, sma50: 100, sma200: 100, atr: 2 });
const shortHolding = { sym: "X", qty: 1, buy: 100, short: true, sl: 2, tp: 5 };   // stop 102, target 95

test("short: price ABOVE the stop triggers Exit (not Take profit)", () => {
  const r = analyzeHolding(shortHolding, stock(103), { score: 0 });
  assert.equal(r.action, "Exit");
});

test("short: price BELOW the target triggers Take profit (not Exit)", () => {
  const r = analyzeHolding(shortHolding, stock(94), { score: 0 });
  assert.equal(r.action, "Take profit");
});

test('"Take profit" is a declared action (M-07)', () => {
  assert.ok(ACTIONS.includes("Take profit"));
});
