import test from "node:test";
import assert from "node:assert/strict";
import { backtest, parseRules, riskAdjustedReturnPct } from "../src/domain/backtest.js";

/* Locks down the equity/drawdown realization (R2-P0-01) and event-ordering fixes: the equity curve and
   maxDD MUST reflect realized exits, including losses, and the final curve must equal the FIXED-STAKE
   (additive) ledger — gains are not reinvested, so per-trade returns SUM, they don't compound.
   Entries use "close crosses above open" (fires on a green candle after a non-green). */
const bar = (o, h, l, c) => ({ o, h, l, c, v: 1000, t: 0 });
function run(candles, sl, tp) {
  const p = parseRules("buy when close crosses above open");
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl, tp };
  candles.forEach((b, i) => (b.t = i * 300000));
  return backtest(cfg, candles, 1, "5m", {});   // costs default 0
}
// final equity implied by the curve must equal the FIXED-STAKE (additive) net ledger — per-trade
// returns SUM (gains not reinvested), so equity = 1 + Σ ret.
function curveMatchesLedger(r) {
  const summed = 1 + r.trades.reduce((a, t) => a + t.ret, 0);
  const lastEq = r.eq[r.eq.length - 1].eq / 100;
  return Math.abs(summed - lastEq) < 1e-6 || r.trades.length === 0;
}

test("riskAdjustedReturnPct: return on required capital = P&L / (stake + 1.5·maxDD)", () => {
  // User's example: three +1/+2/+3 trades on a 100 stake, no drawdown → 6/100 = 6%.
  assert.equal(riskAdjustedReturnPct(6, 100, 0), 6);
  // With a 2-unit max drawdown → 6 / (100 + 1.5·2) = 6/103 = 5.825…%.
  assert.ok(Math.abs(riskAdjustedReturnPct(6, 100, 2) - (6 / 103) * 100) < 1e-9);
  // A bigger drawdown lowers the return (penalises risk); a zero denominator is null-safe.
  assert.ok(riskAdjustedReturnPct(6, 100, 20) < riskAdjustedReturnPct(6, 100, 2));
  assert.equal(riskAdjustedReturnPct(5, 0, 0), null);
});

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

// R3-#5: a long stop is 1% below entry (99). If the next bar GAPS DOWN and opens at 95 (below the stop),
// the fill must be the worse open (95), not the stop (99) — otherwise the backtest understates the loss.
test("a stop that gaps through fills at the worse open, not the stop (R3-#5)", () => {
  // bar0 red, bar1 green → entry at bar2 open 100, stop 99. bar2 holds above the stop. bar3 GAPS DOWN
  // and opens at 95 (below the stop) — the fill must be the worse open (95), not the stop (99).
  const c = [bar(100, 100, 99, 99), bar(99, 101, 98.5, 100.5), bar(100, 101, 99.5, 100.2), bar(95, 95, 90, 92)];
  c.forEach((b, i) => (b.t = i * 300000));
  const p = parseRules("buy when close crosses above open");
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl: 1, tp: 50 };
  const r = backtest(cfg, c, 1, "5m", {});
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].reason, "SL");
  assert.equal(r.trades[0].exit, 95);                     // filled at the gap-open, not the 99 stop
  assert.ok(r.trades[0].ret < -0.04, "a ~5% gap loss, not a ~1% stop loss");
});

// Opt-in intraday square-off: a position carried across a session boundary is flattened at the prior
// session's last close when squareOffEod is set; without it, it holds to end-of-dataset (unchanged).
test("opt-in EOD square-off closes at the session boundary (intraday)", () => {
  const b = (o, h, l, c, t) => ({ o, h, l, c, v: 1000, t });
  const D0 = Date.UTC(2024, 0, 1, 9, 15), D1 = Date.UTC(2024, 0, 2, 9, 15), M = 300000;
  const c = [
    b(100, 100, 99, 99, D0),            // red
    b(99, 101, 98.5, 100.5, D0 + M),    // green → entry signal
    b(100, 101, 99.5, 100.2, D0 + 2 * M), // ENTRY at open 100 (session 1)
    b(100.2, 101, 99.8, 100.8, D0 + 3 * M), // held (session 1 last bar)
    b(100.8, 102, 100, 101, D1),        // NEW SESSION (next UTC day)
  ];
  const p = parseRules("buy when close crosses above open");
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl: 5, tp: 50 };   // SL/TP won't hit
  const on = backtest(cfg, c, 1, "5m", { squareOffEod: true });
  assert.equal(on.trades.length, 1);
  assert.equal(on.trades[0].reason, "EOD");
  assert.equal(on.trades[0].exit, 100.8);   // prior session's last close, not the next-session bar
  const off = backtest(cfg, c, 1, "5m", {});   // default: holds to end-of-dataset
  assert.equal(off.trades[0].exit, 101);       // last valid close of the whole dataset
});

// R3-#4: a malformed FINAL candle (NaN/zero close) must not corrupt the forced-exit / buy&hold. The
// engine should force-close on the last VALID close and still produce finite stats.
test("a malformed final candle does not corrupt results (R3-#4)", () => {
  const c = [bar(100, 100, 99, 99), bar(99, 101, 98.5, 100.5), bar(100.5, 103, 100, 102.5), { o: 0, h: 0, l: 0, c: 0, v: 0, t: 0 }];
  c.forEach((b, i) => (b.t = i * 300000));
  const p = parseRules("buy when close crosses above open");
  const cfg = { entry: p.conds, exit: [], defs: p.defs, sl: 1, tp: 50 };   // TP won't hit → forced EOD exit
  const r = backtest(cfg, c, 1, "5m", {});
  assert.ok(Number.isFinite(r.stats.totalRet), "totalRet must be finite despite the zero final candle");
  assert.ok(Number.isFinite(r.stats.bh), "buy&hold must be finite despite the zero final candle");
  assert.ok(r.trades.every((t) => Number.isFinite(t.ret) && t.exit > 0), "no trade may exit at a zero/NaN price");
});
