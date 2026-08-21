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

/* ---- Part 1 regression: Smart Auto-Buy phantom must contribute $0, not a fabricated live mark. This is what
   made the Total dashboard's Smart Auto-Buy box disagree with the Smart Auto-Buy dashboard. Both now read this
   same canonical value, so proving the value is correct proves the two dashboards reconcile. ---- */
const normSym = (s) => String(s || "").replace(/(USDT|USD|INR|PERP)$/i, "").replace(/-EQ$/i, "").toUpperCase();
const sabTrades = [
  // a REAL Smart Auto-Buy position the broker NO LONGER holds (phantom) — live price is way up, but no verified exit
  { sym: "RAVEUSD", market: "Crypto", tradeType: "Auto Buy", entry: 100, qty: 1, exitAt: null, exit: null, real: true },
];
const sabPrice = (s) => ({ RAVEUSD: 130 }[s] ?? null);   // +30 if (wrongly) marked to live

// heldSet loaded but EMPTY (broker holds nothing) → phantom must be excluded, SAB P&L = 0, not +30
const held = new Set();
const rPhantom = computeCategories(sabTrades, { mode: "real", market: "Crypto", priceOf: sabPrice, heldSet: held, normSym });
assert.equal(rPhantom.categories["Smart Auto-Buy"], 0, `phantom SAB must be $0, got ${rPhantom.categories["Smart Auto-Buy"]}`);
assert.equal(rPhantom.open, 0, "phantom must not count as an open position");
assert.equal(rPhantom.total, 0, "phantom must not contribute to total");

// same position, but the broker DOES hold it → legitimately marked to live price (+30)
const held2 = new Set([normSym("RAVEUSD")]);
const rHeld = computeCategories(sabTrades, { mode: "real", market: "Crypto", priceOf: sabPrice, heldSet: held2, normSym });
// ~+30 (a small crypto fee is deducted by the leverage-aware engine, so allow a tolerance — the point is it's marked to live)
assert.ok(rHeld.categories["Smart Auto-Buy"] > 25, `held SAB should mark to live (~+30), got ${rHeld.categories["Smart Auto-Buy"]}`);
assert.equal(rHeld.open, 1, "held position counts as open");

// no heldSet at all (holdings not loaded) → do NOT hide; mark to live so a legit position isn't dropped
const rNoHeld = computeCategories(sabTrades, { mode: "real", market: "Crypto", priceOf: sabPrice });
assert.ok(rNoHeld.categories["Smart Auto-Buy"] > 25, "with no holdings snapshot, don't hide (mark to live)");

console.log("Part1 SAB phantom reconciliation OK:", JSON.stringify({ phantom: rPhantom.categories["Smart Auto-Buy"], held: rHeld.categories["Smart Auto-Buy"] }));
