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
function coinOf(sym) {
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
export function positionPnl(t, exitPx, market) {
  if (t == null || t.entry == null || exitPx == null) return 0;
  const dir = (t.side === "SELL" || t.short) ? -1 : 1;
  const isCrypto = isDeltaUsd(market);              // Crypto AND US Stock Tokens use the leveraged Delta-perp path
  const qty = Number(t.qty) || (isCrypto ? 0 : 1);
  const gross = (Number(exitPx) - Number(t.entry)) * qty * dir;
  if (!isCrypto || !qty) return gross;              // unleveraged spot markets keep the plain formula
  const notional = Math.abs(Number(t.entry) * qty);
  const margin = notional / leverageFor(t.sym, market);
  const fees = notional * DELTA_TAKER_FEE * 2;       // entry + exit legs
  const net = gross - fees;
  return Math.max(net, -margin);                     // isolated margin: loss can't exceed the margin
}
