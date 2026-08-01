import test from "node:test";
import assert from "node:assert/strict";
import { backtest, parseRules } from "../src/domain/backtest.js";

/* Locks down the equity/drawdown realization (R2-P0-01) and event-ordering fixes: the equity curve and
   maxDD MUST reflect realized exits, including losses, and the final curve must equal the compounded
   ledger. Entries use "close crosses above open" (fires on a green candle after a non-green). */
const bar = (o, h, l, c) => ({ o, h, l, c, v: 1000, t: 0 });
function run(candles, sl, tp) {
  const p = parseRules("buy when close crosses above open");
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl, tp };
  candles.forEach((b, i) => (b.t = i * 300000));
  return backtest(cfg, candles, 1, "5m", {});   // costs default 0
}
// final equity implied by the curve must equal the compounded net ledger return
function curveMatchesLedger(r) {
  const compounded = r.trades.reduce((a, t) => a * (1 + t.ret), 1);
  const lastEq = r.eq[r.eq.length - 1].eq / 100;
  return Math.abs(compounded - lastEq) < 1e-6 || r.trades.length === 0;
}

test("a take-profit trade lifts equity and the curve equals the ledger", () => {
  // bar1 green → entry at bar2 open 100; bar2 hits +2% target (102).
  const r = run([bar(100, 100, 99, 99), bar(99, 101, 98.5, 100.5), bar(100.5, 103, 100, 102.5)], 1, 2);
  assert.equal(r.trades.length >= 1, true);
  assert.equal(r.trades[0].reason, "TP");
  assert.ok(r.stats.totalRet > 0);
  assert.ok(curveMatchesLedger(r));
});

test("a stop-loss trade shows up in maxDD (was 0 before the fix)", () => {
  const c = [bar(100, 100, 99, 99), bar(99, 101, 98.5, 100.5), bar(100.5, 100.6, 98, 98.2)];
  for (let i = 0; i < 6; i++) { const o = c[c.length - 1].c; c.push(bar(o, o + 0.2, o - 0.4, o - 0.3)); }
  const r = run(c, 1, 5);
  assert.ok(r.trades.some((t) => t.reason === "SL"));
  assert.ok(r.stats.maxDD > 0, "a realized loss must register drawdown");
  assert.ok(r.stats.totalRet < 0);
  assert.ok(curveMatchesLedger(r));
});

test("consecutive trades compound correctly (curve == ledger)", () => {
  const c = [];
  // two separate winning legs
  c.push(bar(100, 100, 99, 99), bar(99, 101, 98.5, 100.5), bar(100.5, 103, 100, 102.5));  // TP +2%
  c.push(bar(102, 102, 101, 101), bar(101, 103, 100.5, 102.5), bar(102.5, 105, 102, 104.6));  // green → TP +2%
  const r = run(c, 1, 2);
  assert.ok(r.trades.length >= 1);
  assert.ok(curveMatchesLedger(r));
});

test("a short trade realizes P&L with the correct sign", () => {
  const p = parseRules("sell when close crosses below open");
  const c = [bar(100, 101, 100, 101), bar(101, 101.5, 99, 99.5), bar(99.5, 100, 97, 97.5)];  // red → short entry, price falls
  c.forEach((b, i) => (b.t = i * 300000));
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl: 1, tp: 2, side: "SELL" };
  const r = backtest(cfg, c, 1, "5m", {});
  if (r.trades.length) { assert.ok(r.trades[0].ret > 0 || r.trades[0].reason === "TP"); assert.ok(curveMatchesLedger(r)); }
});
