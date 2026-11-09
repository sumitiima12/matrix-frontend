/* Delta-style leverage model for crypto positions.
 *
 * Paper (virtual) crypto now behaves like a real Delta perp: the capital you deploy is the
 * position NOTIONAL, the exchange locks margin = notional ÷ leverage, and an isolated-margin
 * position can never lose more than that margin (it liquidates first). Trading fees are the
 * Delta taker fee on both legs. Real positions still read broker-truth P&L from Delta; this
 * makes the PAPER simulation produce the same shape of number, so the logic is uniform.
 *
 * Leverage is per-symbol, mirroring Delta India: 25× on the majors (BTC/ETH/SOL), 20× on the
 * rest. Non-crypto markets are unleveraged (spot), so leverageFor() returns 1 and positionPnl()
 * falls back to plain (exit − entry) × qty.
 */

import { isDeltaUsd, marketOf } from "./universe";

export const CRYPTO_LEV_DEFAULT = 20;                 // Delta default for non-major crypto
export const CRYPTO_LEV_MAJORS = 25;                  // BTC / ETH / SOL
export const US_TOKEN_LEV = 25;                       // US Stock Tokens — 25x across the board
export const DELTA_TAKER_FEE = 0.0005;                // 0.05% per side (taker)

const MAJORS = new Set(["BTC", "ETH", "SOL"]);

/* Reduce a symbol to its base coin ticker so BTCUSD / BTC-PERP / BTC all map to BTC. */
export function coinOf(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[-_/].*$/, "")        // drop -PERP, _USD, /USDT suffixes
    .replace(/USDT?$/, "")          // drop trailing USD / USDT
    .replace(/[^A-Z0-9]/g, "");
}

/* Per-symbol leverage. `market` (optional) short-circuits to 1 for non-crypto. */
export function leverageFor(sym, market) {
  const m = market || marketOf(sym);               // fall back to the symbol's market when caller omits it
  if (m && !isDeltaUsd(m)) return 1;               // non-Delta markets are spot (1x)
  if (m === "USStockTokens") return US_TOKEN_LEV;  // US stock tokens: 25x across the board
  return MAJORS.has(coinOf(sym)) ? CRYPTO_LEV_MAJORS : CRYPTO_LEV_DEFAULT;
}

/* Margin the exchange locks for a crypto position of `qty` coins entered at `entry`. */
export function marginFor(t, market) {
  const qty = Number(t && t.qty) || 0;
  const entry = Number(t && t.entry) || 0;
  if (!qty || !entry) return 0;
  return Math.abs(entry * qty) / leverageFor(t.sym, market);
}

/* Position P&L that mirrors a Delta perp:
 *   crypto → gross (exit−entry)×qty×dir, minus round-trip taker fees, floored at −margin (liquidation).
 *   other  → plain gross (spot, no leverage / fees / liquidation).
 * `market` is the trade's market ("Crypto" for the leveraged path). */
export function positionPnl(t, exitPx, market, opts = null) {
  if (t == null || t.entry == null || exitPx == null) return 0;
  const dir = (t.side === "SELL" || t.short) ? -1 : 1;
  const isCrypto = isDeltaUsd(market);              // Crypto AND US Stock Tokens use the leveraged Delta-perp path
  const qty = Number(t.qty) || (isCrypto ? 0 : 1);
  const gross = (Number(exitPx) - Number(t.entry)) * qty * dir;
  if (!isCrypto || !qty) return gross;              // unleveraged spot markets keep the plain formula
  const notional = Math.abs(Number(t.entry) * qty);
  const margin = notional / leverageFor(t.sym, market);
  // `opts.gross` skips the MODELED taker fee — used when REAL per-trade costs (commission/funding/liquidation)
  // are attributed from the broker ledger instead, so we don't subtract a fee twice.
  const fees = (opts && opts.gross) ? 0 : notional * DELTA_TAKER_FEE * 2;   // entry + exit legs
  const net = gross - fees;
  return Math.max(net, -margin);                     // isolated margin: loss can't exceed the margin
}

/* The REAL cost attributed to a trade — a NEGATIVE number (a debit) to ADD to gross P&L. For a Delta
   crypto / US-token trade the backend attributes funding + commission + liquidation from the wallet ledger and
   the client stamps it as `t._cost` (already negative). For every other market it's the broker brokerage /
   charges carried on the row (`fees`/`charges`, stored positive → returned negative). 0 when nothing is known. */
export function tradeCostOf(t) {
  if (t && t._costAttributed && Number.isFinite(Number(t._cost))) return Number(t._cost);
  const f = Number(t && (t.fees != null ? t.fees : t.charges)) || 0;
  return f ? -Math.abs(f) : 0;
}

/* Attribute Delta wallet COSTS to individual trades. Given the app's trades and the backend's per-symbol cost
   ledger (getDeltaCosts().bySymbol), stamp each REAL closed Crypto/US-token trade with `_cost` (the summed
   funding + commission + liquidation whose timestamp falls inside that position's open→close window) and
   `_costAttributed:true`. Entries are CONSUMED greedily (each ledger line attributed to at most one trade, oldest
   close first) so overlapping positions in the same symbol don't double-count. Returns a NEW array; non-matching
   trades pass through untouched. Idempotent per call — pass the full trades list each time costs refresh. */
export function attributeDeltaCosts(trades, costs) {
  if (!Array.isArray(trades) || !costs) return trades || [];
  const mkPool = (bySym) => { const p = {}; for (const k of Object.keys(bySym || {})) { const es = (bySym[k].entries || []).map((e) => ({ ts: Number(e.ts) || 0, amount: Number(e.amount) || 0, used: false })); es.sort((a, b) => a.ts - b.ts); p[k] = es; } return p; };
  const costPool = mkPool(costs.bySymbol);           // funding + commission + liquidation (≤0)
  const realPool = mkPool(costs.realisedBySymbol);   // Delta's per-close realised trade P&L (cashflow)
  const BUFFER_MS = 5 * 60 * 1000;   // fees/funding can post a few minutes after the fill
  const closed = trades
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t && t.real && isDeltaUsd(marketOf(t.sym)) && t.exitAt != null && t.exit != null)
    .sort((a, b) => (Number(a.t.exitAt) || 0) - (Number(b.t.exitAt) || 0));
  const stampCost = {}, stampReal = {};
  // COSTS (funding/fees/liquidation): precise Delta timestamps → window-match around the hold.
  for (const { t, idx } of closed) {
    const base = coinOf(t.sym);
    const ces = costPool[base];
    if (ces && ces.length) {
      const lo = (Number(t.entryAt) || Number(t.exitAt) || 0) - BUFFER_MS, hi = (Number(t.exitAt) || 0) + BUFFER_MS;
      let sum = 0, any = false;
      for (const e of ces) { if (e.used) continue; if (e.ts >= lo && e.ts <= hi) { sum += e.amount; e.used = true; any = true; } }
      if (any) stampCost[idx] = +sum.toFixed(6);
    }
  }
  // REALISED (cashflow): the app's exitAt can lag Delta's real close, so pair FIFO per symbol (nth close ↔ nth
  // cashflow, chronological) rather than by time window — robust to the lag.
  const bySym = {};
  for (const { t, idx } of closed) { const b = coinOf(t.sym); (bySym[b] = bySym[b] || []).push(idx); }
  for (const sym of Object.keys(bySym)) {
    const es = realPool[sym]; if (!es || !es.length) continue;
    const idxs = bySym[sym];
    const n = Math.min(es.length, idxs.length);
    for (let i = 0; i < n; i++) { stampReal[idxs[i]] = +Number(es[i].amount).toFixed(6); es[i].used = true; }
  }
  return trades.map((t, idx) => {
    if (!(idx in stampCost) && !(idx in stampReal)) return t;
    const out = { ...t, _costAttributed: true };
    if (idx in stampCost) out._cost = stampCost[idx];
    if (idx in stampReal) out._attrRealised = stampReal[idx];
    return out;
  });
}

/* P&L NET of real costs — the number shown per strategy / per screener.
   - REAL Delta crypto/US-token with attributed wallet costs → gross (no modeled fee) + attributed cost, floored
     at −margin (a liquidation can't lose more than the margin, cost included).
   - VIRTUAL crypto → plain positionPnl (the modeled taker fee is the only cost estimate that exists on paper).
   - Spot (IN / US / Commodity) → gross − brokerage carried on the row. */
export function netTradePnl(t, exitPx, market) {
  if (t == null || t.entry == null || exitPx == null) return 0;
  const mkt = market || marketOf(t.sym);
  const cost = tradeCostOf(t);
  if (isDeltaUsd(mkt)) {
    // AUTHORITATIVE: Delta's own per-close realised P&L (cashflow), attributed to this trade, is the truth for a
    // closed real position — it rescues the 90%+ of crypto closes the app books flat ($0) because it can't
    // reconstruct the exit. Net = Delta realised + attributed funding/fees (cost ≤ 0).
    if (t.real && t._attrRealised != null) return Number(t._attrRealised) + cost;
    if (t.real && t._costAttributed) {
      const grossNet = positionPnl(t, exitPx, mkt, { gross: true }) + cost;   // cost ≤ 0
      const qty = Number(t.qty) || 0;
      const margin = qty ? Math.abs(Number(t.entry) * qty) / leverageFor(t.sym, mkt) : Infinity;
      return Math.max(grossNet, -margin);
    }
    return positionPnl(t, exitPx, mkt);                 // virtual perp: keep the modeled fee
  }
  return positionPnl(t, exitPx, mkt) + cost;            // spot: subtract brokerage (cost ≤ 0)
}
