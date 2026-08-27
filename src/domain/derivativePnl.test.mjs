import { test } from "node:test";
import assert from "node:assert";
import { derivativePnl, derivativeNotional, pnlFieldsOf } from "./derivativePnl.js";

test("spot equity/crypto (no multiplier) == legacy qty × Δprice — no regression", () => {
  // 10 shares, entry 100 -> 110 : +100. Long.
  assert.equal(derivativePnl({ entry: 100, price: 110, quantity: 10, side: "BUY" }), 100);
  // Short 10 @ 100 -> 110 : -100.
  assert.equal(derivativePnl({ entry: 100, price: 110, quantity: 10, side: "SELL" }), -100);
});

test("crypto BTC future: 5 contracts × 0.001 BTC × Δ", () => {
  // BTC 100000 -> 101000, 5 contracts, 0.001 BTC/contract => 5 × 0.001 × 1000 = +5.
  assert.equal(derivativePnl({ entry: 100000, price: 101000, quantity: 5, contractMultiplier: 0.001, side: "BUY" }), 5);
});

test("US option: 3 contracts × 100 shares × Δpremium", () => {
  // premium 2.00 -> 2.50, 3 contracts, 100 shares/contract => 3 × 100 × 0.5 = +150.
  assert.equal(derivativePnl({ entry: 2.0, price: 2.5, quantity: 3, contractMultiplier: 100, side: "BUY" }), 150);
});

test("Gold future: 2 contracts × 1000 g × Δprice", () => {
  // price per gram 60 -> 61, 2 contracts (1 kg each) => 2 × 1000 × 1 = +2000.
  assert.equal(derivativePnl({ entry: 60, price: 61, quantity: 2, contractMultiplier: 1000, side: "BUY" }), 2000);
});

test("Gold Mini future (post-fix): 2 contracts × 100 g × Δprice — NOT double-counted", () => {
  // 2 lots of Gold Mini: broker qty 2, 100 g/contract. price 60 -> 61 => 2 × 100 × 1 = +200 (was 20000 with the bug).
  assert.equal(derivativePnl({ entry: 60, price: 61, quantity: 2, contractMultiplier: 100, side: "BUY" }), 200);
});

test("notional respects the multiplier", () => {
  assert.equal(derivativeNotional({ price: 101000, quantity: 5, contractMultiplier: 0.001 }), 505);   // 5 × 0.001 × 101000
  assert.equal(derivativeNotional({ price: 100, quantity: 10 }), 1000);                                 // spot: mult defaults 1
});

test("pnlFieldsOf defaults spot rows to multiplier 1; reads derivative rows", () => {
  assert.deepEqual(pnlFieldsOf({ entry: 100, qty: 10 }), { entry: 100, quantity: 10, contractMultiplier: 1, side: "BUY" });
  assert.deepEqual(pnlFieldsOf({ entry: 2, qty: 3, contractMultiplier: 100, short: true }), { entry: 2, quantity: 3, contractMultiplier: 100, side: "SELL" });
});

test("invalid inputs return 0, never NaN", () => {
  assert.equal(derivativePnl({ entry: undefined, price: 1, quantity: 1 }), 0);
  assert.equal(derivativePnl({ entry: 1, price: NaN, quantity: 1 }), 0);
  assert.equal(derivativeNotional({ price: "x", quantity: 1 }), 0);
});
