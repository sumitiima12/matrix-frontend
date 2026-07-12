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
export const LOTS = {
  NIFTY50: 50, BANKNIFTY: 15, FINNIFTY: 40,
  RELIANCE: 250, HDFCBANK: 550, ICICIBANK: 700, SBIN: 750,
  TCS: 150, INFY: 400, TATAMOTORS: 800, TATAPOWER: 1500,
  LT: 150, BAJFINANCE: 125, ADANIENT: 300, HAL: 150,
  BEL: 2850, DIXON: 50, ITC: 1600,
};

export const lotSize = (sym) => LOTS[sym] || 500;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Last Thursday of a given month (NSE monthly expiry convention). */
export function lastThursday(year, month) {
  const d = new Date(year, month + 1, 0);          // last day of month
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * The current-month contract — rolls to next month automatically once this
 * month's expiry has passed.
 *
 * The roll happens at the END of expiry day (market close), not at midnight:
 * on expiry day itself the contract is still the current month and still trades.
 */
export function currentExpiry(now = new Date()) {
  let y = now.getFullYear();
  let m = now.getMonth();
  let exp = lastThursday(y, m);
  const expiryEnd = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate(), 23, 59, 59);
  if (now > expiryEnd) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    exp = lastThursday(y, m);
  }
  return { date: exp, label: MONTHS[m], year: y, month: m };
}

/**
 * Build the current-month FUTURES contract for an underlying.
 * Price tracks the underlying's real spot (see limitation above).
 */
export function makeFuture(s, now = new Date()) {
  const exp = currentExpiry(now);
  const lot = lotSize(s.sym);
  return {
    ...s,
    sym: `${s.sym} ${exp.label} FUT`,
    under: s.sym,
    name: `${s.name} — ${exp.label} ${exp.year} Futures`,
    isFut: true,
    fno: true,
    lot,
    expiry: exp.label,
    expiryDate: exp.date.getTime(),
    // price/chg inherited from the underlying's REAL quote
  };
}
