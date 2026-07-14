/**
 * Option selection — over REAL broker contracts only.
 *
 * Everything here operates on the contract list the broker returned. Nothing is
 * constructed. There is no strike-interval constant, no expiry calendar, no symbol
 * template — because each of those would be a guess, and a wrong guess here does not
 * throw an error, it buys a different contract.
 *
 * ATM is defined as the LISTED strike nearest the spot. Not spot rounded to 50, not
 * spot rounded to 100 — the nearest strike that actually exists, whatever the ladder
 * happens to be for that underlying.
 *
 * ITM / OTM are then offsets along that real ladder, and they mean OPPOSITE directions
 * for calls and puts:
 *
 *   CALL   ITM = strike BELOW spot      OTM = strike ABOVE spot
 *   PUT    ITM = strike ABOVE spot      OTM = strike BELOW spot
 *
 * Getting that backwards is a classic way to buy the exact opposite of your thesis.
 */

/** Sorted, de-duplicated list of strikes that actually exist for this expiry + type. */
export function strikeLadder(contracts, expiry, type) {
  const s = (contracts || [])
    .filter((c) => (!expiry || c.expiry === expiry) && (!type || c.type === type))
    .map((c) => c.strike)
    .filter((x) => x != null && !isNaN(x));
  return [...new Set(s)].sort((a, b) => a - b);
}

/** The listed strike nearest to spot. Returns null if we have no ladder or no spot. */
export function atmStrike(ladder, spot) {
  if (!ladder || !ladder.length || spot == null || isNaN(spot)) return null;
  return ladder.reduce((best, k) => (Math.abs(k - spot) < Math.abs(best - spot) ? k : best), ladder[0]);
}

/**
 * Pick a strike by moneyness.
 * @param steps how many strikes away from ATM (0 = ATM itself)
 * Returns null if the ladder doesn't extend that far — rather than clamping silently to
 * the end of the chain, which would hand you a contract you didn't ask for.
 */
export function strikeFor(ladder, spot, type, moneyness, steps = 1) {
  const atm = atmStrike(ladder, spot);
  if (atm == null) return null;
  if (moneyness === "ATM") return atm;

  const i = ladder.indexOf(atm);
  if (i < 0) return null;

  // CALL: higher strike = OTM. PUT: higher strike = ITM. The sign flips.
  const up = type === "CE" ? moneyness === "OTM" : moneyness === "ITM";
  const j = i + (up ? steps : -steps);

  return j >= 0 && j < ladder.length ? ladder[j] : null;
}

/** The one contract matching this exact expiry + strike + type. Never fabricated. */
export function findContract(contracts, expiry, strike, type) {
  if (strike == null) return null;
  return (contracts || []).find(
    (c) => c.expiry === expiry && Number(c.strike) === Number(strike) && c.type === type
  ) || null;
}

/**
 * Group expiries into what a trader actually asks for: "current week" / "current month".
 *
 * NOTE we do NOT compute these from an expiry-day rule. NSE has changed its expiry day,
 * and a stale hardcoded rule ("last Thursday") silently selects the wrong contract. The
 * broker's expiry list is the truth; we simply label the nearest one and the last one in
 * the front month, and show the real date next to each so the user can see what they're
 * actually trading.
 */
export function labelExpiries(expiries, now = Date.now()) {
  const future = (expiries || [])
    .map((e) => ({ raw: e, ms: Date.parse(e) }))
    .filter((e) => !isNaN(e.ms) && e.ms >= now - 86400000)
    .sort((a, b) => a.ms - b.ms);

  if (!future.length) return [];

  const nearest = future[0];
  const d0 = new Date(nearest.ms);

  // the last expiry inside the nearest expiry's calendar month = that month's monthly
  const sameMonth = future.filter(
    (e) => new Date(e.ms).getMonth() === d0.getMonth() && new Date(e.ms).getFullYear() === d0.getFullYear()
  );
  const monthly = sameMonth.length ? sameMonth[sameMonth.length - 1] : nearest;

  const out = [];
  out.push({ ...nearest, label: nearest.raw === monthly.raw ? "Current month" : "Current week" });
  if (monthly.raw !== nearest.raw) out.push({ ...monthly, label: "Current month" });

  // everything else, plainly dated
  future.forEach((e) => {
    if (e.raw !== nearest.raw && e.raw !== monthly.raw) out.push({ ...e, label: null });
  });

  return out;
}

/** Human date for an expiry, e.g. "16 Jul 2026". */
export function expiryLabel(raw) {
  const ms = Date.parse(raw);
  if (isNaN(ms)) return raw;
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Total contracts = lots × lot size. The broker trades quantity, not lots. */
export function qtyFromLots(lots, lotSize) {
  const l = Math.max(1, Number(lots) || 1);
  const s = Number(lotSize);
  if (!s || isNaN(s)) return null;      // no real lot size -> we do not guess one
  return l * s;
}
