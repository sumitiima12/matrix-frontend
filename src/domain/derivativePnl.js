/**
 * derivativePnl.js — the ONE canonical P&L convention for spot AND derivative positions.
 *
 * THE PROBLEM THIS SOLVES: paper P&L was computed as `qty × Δprice`, which is only correct when `qty` is already the
 * total underlying units and the instrument is priced per unit. Derivatives break that: a Delta BTC contract is
 * 0.001 BTC, a US option contract is 100 shares, an MCX Gold contract is 1000 g. Multiplying the broker order
 * quantity by Δprice alone under- or over-counts by the contract size.
 *
 * THE CONVENTION (matches contractSpecs.js and the resolvers):
 *   • quantity            = the number the BROKER trades (contracts for derivatives; shares/coins for spot).
 *   • contractMultiplier  = the underlying units (price-point value) ONE quantity unit represents. 1 for spot.
 *   • price               = the INSTRUMENT'S own quoted price (the underlying for a future; the premium for an option).
 *   • dir                 = +1 for a long (BUY), −1 for a short (SELL).
 *
 *   P&L        = (price − entry) × quantity × contractMultiplier × dir
 *   notional   = |price| × quantity × contractMultiplier
 *
 * Worked, against the real resolver outputs:
 *   Crypto BTC  : quantity 5,   mult 0.001 → 5 contracts = 0.005 BTC.
 *   US option   : quantity 3,   mult 100   → 3 contracts = 300 shares (P&L on the premium).
 *   Gold future : quantity 2,   mult 1000  → 2 contracts = 2000 g = 2 kg.
 *   Gold Mini   : quantity 2,   mult 100   → 2 contracts = 200 g   (after the contractSpecs lotSize fix).
 *   Spot equity : quantity N,   mult 1     → unchanged legacy behaviour.
 *
 * Pure, no I/O — unit-testable and safe to call from the paper book, the confirm preview and the risk display.
 */

function dirOf(side) {
  const s = String(side || "").toUpperCase();
  return s === "SELL" || s === "SHORT" ? -1 : 1;
}

/** Contract-aware P&L. Returns 0 (not NaN) when any input is missing/invalid, so a display never shows NaN. */
export function derivativePnl({ entry, price, quantity, contractMultiplier = 1, side = "BUY" } = {}) {
  const e = Number(entry), p = Number(price), q = Number(quantity), m = Number(contractMultiplier);
  if (!Number.isFinite(e) || !Number.isFinite(p) || !Number.isFinite(q) || !Number.isFinite(m)) return 0;
  return (p - e) * q * m * dirOf(side);
}

/** Contract-aware notional (position value at `price`). */
export function derivativeNotional({ price, quantity, contractMultiplier = 1 } = {}) {
  const p = Number(price), q = Number(quantity), m = Number(contractMultiplier);
  if (!Number.isFinite(p) || !Number.isFinite(q) || !Number.isFinite(m)) return 0;
  return Math.abs(p) * q * m;
}

/**
 * Read the P&L-relevant fields off a position/trade with the RIGHT default: spot rows (no derivative fields) keep
 * multiplier 1, so legacy stock/crypto-spot P&L is byte-for-byte unchanged. A derivative row carries
 * contractMultiplier from the resolver.
 */
export function pnlFieldsOf(row = {}) {
  const contractMultiplier = Number(row.contractMultiplier) > 0 ? Number(row.contractMultiplier) : 1;
  return {
    entry: Number(row.entry),
    quantity: Number(row.qty ?? row.quantity),
    contractMultiplier,
    side: row.side || (row.short ? "SELL" : "BUY"),
  };
}
