import assert from "node:assert";
import { computeCategories, sourceCategory, CATEGORIES } from "./portfolioPnl.js";

// bucketing / provenance
assert.equal(sourceCategory({ tradeType: "Screener Auto Buy" }), "Screener");
assert.equal(sourceCategory({ tradeType: "Manual", screenerName: "Swing Catcher" }), "Screener"); // self-evidence wins
assert.equal(sourceCategory({ tradeType: "Auto Buy" }), "Smart Auto-Buy");
assert.equal(sourceCategory({ tradeType: "Automate" }), "Automate");
assert.equal(sourceCategory({ tradeType: "Ideas" }), "Ideas");
assert.equal(sourceCategory({ tradeType: "Manual" }), "Manual");
assert.equal(sourceCategory({ tradeType: "" }), "Unknown/Imported");

const now = Date.now();
const trades = [
  { sym: "BNBUSD", market: "Crypto", tradeType: "Screener Auto Buy", screenerName: "Swing Catcher", entry: 600, qty: 1, exitAt: null, exit: null, real: false },
  { sym: "ETHUSD", market: "Crypto", tradeType: "Auto Buy", entry: 100, qty: 2, exitAt: now, exit: 90, real: false },   // closed loss
  { sym: "SOLUSD", market: "Crypto", tradeType: "Automate", entry: 20, qty: 5, exitAt: now, exit: 25, real: false },    // closed win
  { sym: "XRPUSD", market: "Crypto", tradeType: "Manual", entry: 1, qty: 10, exitAt: null, exit: null, real: false },
  { sym: "NIFTY", market: "IN", tradeType: "Manual", entry: 100, qty: 1, exitAt: now, exit: 110, real: false },         // wrong market — excluded
  { sym: "DOGEUSD", market: "Crypto", tradeType: "Manual", entry: 1, qty: 1, exitAt: now, exit: 2, real: true },        // wrong mode — excluded
];
const priceOf = (s) => ({ BNBUSD: 605, XRPUSD: 1.1 }[s] ?? null);

const r = computeCategories(trades, { mode: "virtual", market: "Crypto", from: null, to: null, priceOf });

// invariant: total === Σ categories (within a cent of rounding)
const sum = CATEGORIES.reduce((a, c) => a + r.categories[c], 0);
assert.ok(Math.abs(sum - r.total) <= 0.01, `total ${r.total} !== Σcats ${sum}`);
// only the 4 in-scope crypto/virtual trades counted (NIFTY market + DOGE real excluded)
assert.equal(r.trades, 4, `expected 4 in-scope, got ${r.trades}`);
assert.equal(r.open, 2);    // BNB (screener) + XRP (manual) open
assert.equal(r.closed, 2);  // ETH (auto buy) + SOL (automate) closed
// each category non-zero where expected
assert.ok(r.categories["Screener"] !== 0, "screener should be non-zero (BNB open)");
assert.ok(r.categories["Smart Auto-Buy"] !== 0, "auto-buy should be non-zero (ETH loss)");
assert.ok(r.categories["Automate"] !== 0, "automate should be non-zero (SOL win)");

console.log("portfolioPnl invariants OK:", JSON.stringify(r));
