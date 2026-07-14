import { marketCloseMins, isMarketOpen } from "./riskService";
import { marketOf } from "../domain/universe";

/**
 * services/squareOff.js — automatic exit for INTRADAY positions.
 *
 * An intraday (MIS) position is not meant to be held overnight. A real broker will
 * force-close it for you, at whatever price the market happens to be at, and charge
 * you for the privilege. So Matrix closes it first, on a schedule you can predict:
 *
 *   Equities / F&O / Commodity   15 minutes before the closing bell
 *   Crypto                       23h45m after you bought (there is no bell)
 *
 * WHY 15 MINUTES AND NOT AT THE BELL: liquidity thins into the close and the last
 * minutes are the worst time to be forced out. Exiting early is the point of having
 * a rule at all.
 *
 * Crypto has no close, so "intraday" can only mean "a day from when you opened it".
 * 23h45m keeps a position from silently rolling into a second day.
 */

const SQUARE_OFF_LEAD_MINS = 15;
const CRYPTO_HOLD_MS = (23 * 60 + 45) * 60 * 1000;      // 23h 45m

/**
 * Is this holding due to be squared off right now?
 * @returns {null | { reason: string }}
 */
export function dueForSquareOff(h, now = new Date()) {
  if (!h || h.product !== "MIS") return null;             // only intraday positions
  if (!h.qty || h.qty <= 0) return null;

  const market = h.market || marketOf(h.sym);
  if (!market) return null;

  if (market === "Crypto") {
    if (!h.boughtAt) return null;                         // no open time -> can't reason; leave it alone
    const held = now.getTime() - h.boughtAt;
    return held >= CRYPTO_HOLD_MS
      ? { reason: "Intraday crypto position — 23h45m since entry" }
      : null;
  }

  const close = marketCloseMins(market);
  if (close == null) return null;
  if (!isMarketOpen(market, now)) return null;            // don't fire into a shut market

  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins >= close - SQUARE_OFF_LEAD_MINS
    ? { reason: `Intraday position — squared off ${SQUARE_OFF_LEAD_MINS} min before close` }
    : null;
}

/** Everything currently due. Pure — the caller does the selling. */
export function positionsDue(portfolio, now = new Date()) {
  return (portfolio || [])
    .map((h) => {
      const due = dueForSquareOff(h, now);
      return due ? { holding: h, reason: due.reason } : null;
    })
    .filter(Boolean);
}
