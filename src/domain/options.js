/**
 * Option selection — over REAL broker contracts only.
 *
 * Nothing here is constructed. No strike-interval constant, no expiry calendar, no symbol
 * template — each would be a guess, and a wrong guess does not throw an error, it trades a
 * different contract. A mistyped stock symbol gets rejected; a plausible-but-wrong option
 * symbol gets FILLED.
 *
 * ATM = the LISTED strike nearest spot. Not spot rounded to 50 or 100 — the nearest strike
 * that actually exists, whatever the ladder happens to be.
 *
 * ITM / OTM mean OPPOSITE directions for calls and puts:
 *   CALL   ITM = strike BELOW spot     OTM = strike ABOVE spot
 *   PUT    ITM = strike ABOVE spot     OTM = strike BELOW spot
 * Getting that backwards buys the exact inverse of your thesis.
 */

export function strikeLadder(contracts, expiry, type) {
  const s = (contracts || [])
    .filter((c) => (!expiry || c.expiry === expiry) && (!type || c.type === type))
    .map((c) => c.strike)
    .filter((x) => x != null && !isNaN(x));
  return [...new Set(s)].sort((a, b) => a - b);
}

export function atmStrike(ladder, spot) {
  if (!ladder || !ladder.length || spot == null || isNaN(spot)) return null;
  return ladder.reduce((best, k) => (Math.abs(k - spot) < Math.abs(best - spot) ? k : best), ladder[0]);
}

/**
 * @param steps strikes away from ATM (0 = ATM)
 * Returns null if the ladder doesn't reach — rather than clamping to the end of the chain,
 * which would hand back a contract nobody asked for.
 */
export function strikeFor(ladder, spot, type, moneyness, steps = 1) {
  const atm = atmStrike(ladder, spot);
  if (atm == null) return null;
  if (moneyness === "ATM") return atm;

  const i = ladder.indexOf(atm);
  if (i < 0) return null;

  const up = type === "CE" ? moneyness === "OTM" : moneyness === "ITM";
  const j = i + (up ? steps : -steps);
  return j >= 0 && j < ladder.length ? ladder[j] : null;
}

export function findContract(contracts, expiry, strike, type) {
  if (strike == null) return null;
  return (contracts || []).find(
    (c) => c.expiry === expiry && Number(c.strike) === Number(strike) && c.type === type
  ) || null;
}

/**
 * Label the broker's expiries as "current week" / "current month".
 *
 * We do NOT compute these from an expiry-day rule — NSE has changed its expiry day, and a
 * stale rule silently picks the wrong contract. The broker's list is the truth; we label
 * the nearest one and the last one in that month, and always show the real date beside it.
 * A label can go stale. A date cannot.
 */
export function labelExpiries(expiries, now = Date.now()) {
  const future = (expiries || [])
    .map((e) => ({ raw: e, ms: Date.parse(e) }))
    .filter((e) => !isNaN(e.ms) && e.ms >= now - 86400000)
    .sort((a, b) => a.ms - b.ms);

  if (!future.length) return [];

  const nearest = future[0];
  const d0 = new Date(nearest.ms);
  const sameMonth = future.filter(
    (e) => new Date(e.ms).getMonth() === d0.getMonth() && new Date(e.ms).getFullYear() === d0.getFullYear()
  );
  const monthly = sameMonth.length ? sameMonth[sameMonth.length - 1] : nearest;

  const out = [{ ...nearest, label: nearest.raw === monthly.raw ? "Current month" : "Current week" }];
  if (monthly.raw !== nearest.raw) out.push({ ...monthly, label: "Current month" });
  future.forEach((e) => {
    if (e.raw !== nearest.raw && e.raw !== monthly.raw) out.push({ ...e, label: null });
  });
  return out;
}

/** Resolve "current week" / "current month" against the broker's real expiry list. */
export function resolveExpiry(expiries, want, now = Date.now()) {
  const labelled = labelExpiries(expiries, now);
  if (!labelled.length) return null;
  const hit = labelled.find((e) => e.label === want);
  return hit ? hit.raw : labelled[0].raw;
}

export function expiryLabel(raw) {
  const ms = Date.parse(raw);
  if (isNaN(ms)) return raw;
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** lots × lot size. The broker trades quantity, not lots. Null lot size -> null, never 1. */
export function qtyFromLots(lots, lotSize) {
  const l = Math.max(1, Number(lots) || 1);
  const s = Number(lotSize);
  if (!s || isNaN(s)) return null;
  return l * s;
}

/**
 * The one call an automation makes: "given this underlying and my option preferences,
 * what is the exact contract to trade RIGHT NOW?"
 *
 * Returns null — and the strategy does not trade — if anything is missing. An automation
 * that fires on a guessed contract is worse than one that doesn't fire.
 */
export function resolveOptionOrder(chain, opt, spot, now = Date.now()) {
  if (!chain || !chain.contracts || !opt) return null;

  const px = chain.spot != null ? chain.spot : spot;
  if (px == null) return null;

  const expiry = resolveExpiry(chain.expiries, opt.expiry || "Current week", now);
  if (!expiry) return null;

  const type = opt.type === "PE" ? "PE" : "CE";
  const ladder = strikeLadder(chain.contracts, expiry, type);
  const strike = strikeFor(ladder, px, type, opt.moneyness || "ATM", Number(opt.steps) || 1);
  if (strike == null) return null;

  const contract = findContract(chain.contracts, expiry, strike, type);
  if (!contract) return null;

  const lotSize = contract.lot || chain.lot || null;
  const qty = qtyFromLots(opt.lots || 1, lotSize);
  if (qty == null) return null;         // no real lot size -> cannot size the order

  return { contract, qty, lots: Number(opt.lots) || 1, lotSize, expiry, strike, type, spot: px };
}
