/**
 * F&O lot sizes — real NSE contract sizes.
 *
 * This file is deliberately SMALL. It used to also compute expiry dates (last Thursday
 * of the month) and build synthetic futures contracts. Both are gone:
 *
 *   - the expiry rule was WRONG. NSE has moved its expiry day — a July 2026 weekly
 *     expiry falls on a Tuesday, not a Thursday — so we were printing dates on which
 *     nothing expires. Expiries now come from the broker's live contract list, which
 *     knows today's calendar. We do not.
 *
 *   - futures are not traded here any more. Only options, and only through automation.
 *
 * What remains is the one thing we can state as fact: how many units are in one lot.
 * There is NO fallback default. A name that isn't listed here has no lot size, and a
 * strategy cannot size an option order on it — which is the correct outcome. Guessing
 * "probably 500" would mean an order 3x the size the user intended.
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

/** @returns {number|null} the real lot size, or null. Never a guessed default. */
export function lotSize(sym) {
  const n = LOTS[sym];
  return n != null ? n : null;
}

/** Can this underlying be traded as an option? Only if we know its real lot size. */
export function isOptionable(sym) {
  return lotSize(sym) != null;
}

/** The F&O-eligible names, derived from the lot table — never a second hand-written list. */
export const OPTIONABLE = Object.keys(LOTS);
