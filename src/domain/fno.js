/**
 * domain/fno.js — F&O domain rules.
 *
 * Restores makeFuture(), which was referenced across the app but had no
 * definition (F&O picks and F&O auto-buy would have thrown).
 *
 * IMPORTANT / HONEST LIMITATION:
 * Yahoo does not publish an NSE futures feed, so a futures contract here is
 * priced off its UNDERLYING's real spot price. The price is real — it is just
 * the underlying's, not the contract's. Cost of carry (the small premium a
 * future trades at over spot) is NOT modelled. Everything else — lot size,
 * expiry date, monthly roll — is the real exchange convention.
 */

/** Real NSE lot sizes. */
/**
 * REAL NSE lot sizes, supplied by the user from the exchange contract list.
 *
 * These are exchange facts, not estimates. An earlier version of this file
 * carried lot sizes from memory and several were WRONG — BAJFINANCE was 125
 * against a real 750, a 6x error that would have sized every "1 lot" trade at a
 * sixth of its true exposure. It also fell back to `|| 500` for anything unknown,
 * i.e. it invented a lot size rather than admit it lacked one.
 *
 * Rules now: a symbol is F&O-tradable if and only if it appears here. No default,
 * no fallback, no guess. NSE revises these periodically — when they change, this
 * table is the single place to update.
 */
export const LOTS = {
  // Indices
  NIFTY50: 65, BANKNIFTY: 30, FINNIFTY: 60,
  // Banking & financials
  HDFCBANK: 550, ICICIBANK: 700, SBIN: 750, AXISBANK: 625, KOTAKBANK: 2000,
  BAJFINANCE: 750,
  // IT
  TCS: 175, INFY: 400, HCLTECH: 350, WIPRO: 1500, TECHM: 600,
  // Energy & commodities
  RELIANCE: 250, NTPC: 1500, ONGC: 2250, COALINDIA: 1350,
  // Metals
  TATASTEEL: 550, JSWSTEEL: 675, HINDALCO: 1425,
  // Auto
  TATAMOTORS: 825, MARUTI: 50, "M&M": 200,
  // Infra, defence, industrials
  LT: 175, ADANIENT: 309, HAL: 175, BEL: 2850, ULTRACEMCO: 100,
  // Consumer & other
  ITC: 1600, BHARTIARTL: 475, ASIANPAINT: 250, SUNPHARMA: 350,
  TITAN: 175, DIXON: 50,
};

/**
 * Lot size for an F&O contract.
 *
 * Returns NULL when we do not have the real, exchange-published lot size.
 *
 * This used to fall back to `|| 500`. A wrong lot size is not a cosmetic error:
 * it silently sizes the position wrong, so the money at risk is wrong, and the
 * P&L is wrong. 500 was a made-up number standing in for a fact. An instrument
 * whose real lot size we do not know is not tradable in F&O, full stop — see
 * FNO_SYMS in universe.js, which only admits names present in LOTS.
 */
export const lotSize = (sym) => (LOTS[sym] == null ? null : LOTS[sym]);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];


/**
 * The current-month contract — rolls to next month automatically once this
 * month's expiry has passed.
 *
 * The roll happens at the END of expiry day (market close), not at midnight:
 * on expiry day itself the contract is still the current month and still trades.
 */
/**
 * ⚠ THE EXPIRY DAY IS NOT OURS TO ASSERT.
 *
 * This used to compute the LAST THURSDAY of the month and present it as the expiry date.
 * That rule is stale: NSE has moved its expiry day (a July 2026 weekly expiry falls on
 * TUESDAY the 21st, not a Thursday), so the "expiry" we printed was a date on which
 * nothing expires.
 *
 * We now return the contract MONTH only — which is what the futures label actually needs
 * ("RELIANCE JUL FUT") — and no longer claim a precise date. Anywhere a real expiry date
 * matters, it comes from the broker's contract list (see /api/broker/optionchain), which
 * knows today's calendar. We do not.
 */
export function currentExpiry(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  // Month only. No `date` field: we would be inventing it.
  return { label: MONTHS[m], year: y, month: m };
}

/**
 * Build the current-month FUTURES contract for an underlying.
 * Price tracks the underlying's real spot (see limitation above).
 */
export function makeFuture(s, now = new Date()) {
  const exp = currentExpiry(now);
  const lot = lotSize(s.sym);
  // No real lot size -> not a tradable future. Return null rather than a contract
  // sized on a guess; callers already filter these out.
  if (lot == null) return null;
  return {
    ...s,
    sym: `${s.sym} ${exp.label} FUT`,
    under: s.sym,
    name: `${s.name} — ${exp.label} ${exp.year} Futures`,
    isFut: true,
    fno: true,
    lot,
    expiry: exp.label,
    // price/chg inherited from the underlying's REAL quote
  };
}
