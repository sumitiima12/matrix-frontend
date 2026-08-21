/**
 * derivatives.js — the ONE canonical derivative intent + contract-resolution domain model for Matrix One.
 *
 * This module is PURE and framework-agnostic. It owns the vocabulary (product type, option side, moneyness,
 * expiry intent, lots→quantity) and the deterministic resolution math (moneyness ladder, expiry-intent match).
 *
 * SAFETY PRINCIPLE — it never invents a contract. Strike ladders, listed expiries and lot/contract specs are
 * PASSED IN from the authoritative instrument master (broker/exchange). If the requested rung/expiry/spec is not
 * present, resolution FAILS CLOSED with a structured error rather than guessing. Real-money callers must treat a
 * failed resolution as "do not submit" (see Part 28). Every automation module (Smart Auto-Buy, Screener, Screener
 * Auto Buy, Automate) should collect INTENT with these enums and resolve through resolveDerivativeContract, instead
 * of reproducing strike/expiry/lot logic per page.
 */

export const PRODUCT_TYPES = ["STOCK", "FUTURE", "OPTION"];
export const OPTION_TYPES = ["CALL", "PUT"];
export const SIDES = ["BUY", "SELL"];                 // BUY = long, SELL = short (futures direction)
export const MONEYNESS = ["ATM", "ITM1", "ITM2", "ITM3", "ITM4", "OTM1", "OTM2", "OTM3", "OTM4"];

/* Expiry INTENTS are per-market. They are selection rules, not calendar dates — resolveExpiry maps each to an
   actual listed expiry from the instrument master, or fails closed. */
export const EXPIRY_INTENTS = {
  IN:        ["CURRENT_WEEK", "CURRENT_MONTH"],
  US:        ["CURRENT_WEEK", "CURRENT_MONTH", "TOMORROW"],   // TOMORROW only meaningful for SPX/NDX-style dailies
  Crypto:    ["TODAY", "TOMORROW", "PLUS_30D", "PLUS_90D"],
  Commodity: ["CURRENT_MONTH", "NEXT_MONTH"],
};

/* Default LOTS by market for derivatives. Stock keeps its own quantity behaviour (not lots). Crypto's product
   requirement is 100 "lots" for the UI — but the broker quantity is always lots × lotSize from the instrument
   master (never assume 100 lots == 100 coins). */
export const DEFAULT_LOTS = { IN: 1, US: 1, Commodity: 1, Crypto: 100 };

export const RESOLUTION_FAILED = "DERIVATIVE_CONTRACT_RESOLUTION_FAILED";

/** lots × lotSize → broker order quantity. Both must be finite positive numbers. */
export function lotsToQty(lots, lotSize) {
  const l = Number(lots), s = Number(lotSize);
  if (!Number.isFinite(l) || !Number.isFinite(s) || l <= 0 || s <= 0) return null;
  return l * s;
}

/** Round a spot to the nearest listed strike, returning its index in an ascending strikes[] (or -1). */
export function atmIndex(strikes, spot) {
  if (!Array.isArray(strikes) || !strikes.length || !Number.isFinite(Number(spot))) return -1;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < strikes.length; i++) {
    const d = Math.abs(Number(strikes[i]) - Number(spot));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Resolve a moneyness rung to an actual listed strike.
 *   CALL: ITM = below ATM (strike < spot), OTM = above ATM.
 *   PUT : ITM = above ATM (strike > spot), OTM = below ATM.
 * strikes MUST be the real ladder from the instrument master (ascending). Returns { strike, index } or
 * { error } when the requested rung is not listed — NEVER extrapolates a strike that doesn't exist.
 */
export function resolveMoneynessStrike({ strikes, spot, optionType, moneyness }) {
  if (!Array.isArray(strikes) || strikes.length === 0) return { error: RESOLUTION_FAILED, detail: "empty_strike_ladder" };
  if (!OPTION_TYPES.includes(optionType)) return { error: RESOLUTION_FAILED, detail: "bad_option_type" };
  if (!MONEYNESS.includes(moneyness)) return { error: RESOLUTION_FAILED, detail: "bad_moneyness" };
  const asc = [...strikes].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const atm = atmIndex(asc, spot);
  if (atm < 0) return { error: RESOLUTION_FAILED, detail: "no_atm" };
  if (moneyness === "ATM") return { strike: asc[atm], index: atm };
  const depth = Number(moneyness.slice(3));                       // ITM3 -> 3
  const dir = moneyness.startsWith("ITM")
    ? (optionType === "CALL" ? -1 : +1)                          // call ITM is below, put ITM is above
    : (optionType === "CALL" ? +1 : -1);                         // call OTM is above, put OTM is below
  const idx = atm + dir * depth;
  if (idx < 0 || idx >= asc.length) return { error: RESOLUTION_FAILED, detail: "strike_rung_not_listed" };
  return { strike: asc[idx], index: idx };
}

/**
 * Resolve an expiry INTENT to an actual listed expiry.
 * expiries: array of { date: epochMs|ISO, weekly?: bool } from the instrument master, for THIS underlying/product.
 * Returns { expiry } (the chosen entry) or { error } when nothing matches the intent — never fabricates a date.
 */
export function resolveExpiry({ expiries, intent, market, nowMs = Date.now() }) {
  if (!Array.isArray(expiries) || expiries.length === 0) return { error: RESOLUTION_FAILED, detail: "no_listed_expiries" };
  const norm = expiries
    .map((e) => ({ ...e, ts: typeof e.date === "number" ? e.date : Date.parse(e.date) }))
    .filter((e) => Number.isFinite(e.ts) && e.ts >= startOfDay(nowMs))     // drop already-expired
    .sort((a, b) => a.ts - b.ts);
  if (!norm.length) return { error: RESOLUTION_FAILED, detail: "all_expiries_past" };
  const allowed = EXPIRY_INTENTS[market] || [];
  if (!allowed.includes(intent)) return { error: RESOLUTION_FAILED, detail: "intent_not_supported_for_market" };

  const nowDay = startOfDay(nowMs);
  const pick = (fn) => { const m = norm.find(fn); return m ? { expiry: m } : { error: RESOLUTION_FAILED, detail: "no_contract_for_intent" }; };
  switch (intent) {
    case "TODAY":         return pick((e) => startOfDay(e.ts) === nowDay);
    case "TOMORROW":      // next listed expiry strictly after today (dailies: literally tomorrow; else nearest listed)
      return pick((e) => startOfDay(e.ts) > nowDay);
    case "CURRENT_WEEK":  { const w = norm.find((e) => e.weekly === true); return w ? { expiry: w } : { expiry: norm[0] }; }   // prefer weekly; else the nearest listed (no fabrication)
    case "CURRENT_MONTH": { const m = norm.find((e) => e.weekly !== true) || norm[0]; return m ? { expiry: m } : { error: RESOLUTION_FAILED, detail: "no_monthly" }; }
    case "NEXT_MONTH":    { const monthlies = norm.filter((e) => e.weekly !== true); return monthlies[1] ? { expiry: monthlies[1] } : { error: RESOLUTION_FAILED, detail: "no_next_month" }; }
    case "PLUS_30D":      return nearestTo(norm, nowMs + 30 * 864e5);
    case "PLUS_90D":      return nearestTo(norm, nowMs + 90 * 864e5);
    default:              return { error: RESOLUTION_FAILED, detail: "unknown_intent" };
  }
}

function nearestTo(norm, targetTs) {
  let best = null, bestD = Infinity;
  for (const e of norm) { const d = Math.abs(e.ts - targetTs); if (d < bestD) { bestD = d; best = e; } }
  return best ? { expiry: best } : { error: RESOLUTION_FAILED, detail: "no_contract_for_intent" };
}
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

/**
 * Validate a derivative INTENT before any resolution/execution. Returns { ok, errors[] }. Backend-authoritative
 * callers must re-run this server-side (frontend disabling is not trusted — Part 27).
 */
export function validateDerivativeIntent(intent = {}) {
  const errors = [];
  const { productType, side, optionType, moneyness, expiryIntent, lots, market } = intent;
  if (!PRODUCT_TYPES.includes(productType)) errors.push("invalid_product_type");
  if (productType === "STOCK") return { ok: errors.length === 0, errors };   // stock keeps its own qty rules
  if (productType === "FUTURE") {
    if (!SIDES.includes(side)) errors.push("future_missing_side");
  }
  if (productType === "OPTION") {
    if (!OPTION_TYPES.includes(optionType)) errors.push("option_missing_call_put");
    if (!MONEYNESS.includes(moneyness)) errors.push("option_missing_moneyness");
  }
  if (market && EXPIRY_INTENTS[market] && !EXPIRY_INTENTS[market].includes(expiryIntent)) errors.push("invalid_expiry_intent");
  if (!(Number(lots) > 0)) errors.push("lots_must_be_positive");
  if (Number(lots) !== Math.floor(Number(lots))) errors.push("fractional_lots_not_allowed");
  return { ok: errors.length === 0, errors };
}

/**
 * The one entry point every module calls. Collects INTENT + the authoritative market data (spot, strike ladder,
 * listed expiries) and instrument SPEC (lotSize, contractMultiplier, tick/step, brokerSymbol builder) and returns a
 * canonical executable contract — or a structured RESOLUTION_FAILED. It cannot fabricate specs: they must be provided
 * by the caller from the instrument master. For STOCK it passes through with the existing quantity behaviour.
 *
 * @param intent { market, underlying, productType, side, optionType, moneyness, expiryIntent, lots, broker }
 * @param data   { spot, strikes[], expiries[], spec: { lotSize, contractMultiplier, tickSize, quantityStep,
 *                 minQty, exchange, tradingSymbolFor(ctx) }, capabilities }
 */
export function resolveDerivativeContract(intent = {}, data = {}) {
  const v = validateDerivativeIntent(intent);
  if (!v.ok) return { error: RESOLUTION_FAILED, detail: "invalid_intent", errors: v.errors };

  const { productType } = intent;
  const cap = data.capabilities || {};
  // Capability gate (Part 19/39): the product must be supported for this market+broker+instrument.
  if (productType === "FUTURE" && cap.futures === false) return { error: RESOLUTION_FAILED, detail: "futures_not_supported" };
  if (productType === "OPTION" && cap.options === false) return { error: RESOLUTION_FAILED, detail: "options_not_supported" };
  if (productType === "OPTION" && Array.isArray(cap.optionSides) && !cap.optionSides.includes(intent.optionType)) {
    return { error: RESOLUTION_FAILED, detail: "option_side_not_supported" };
  }

  if (productType === "STOCK") {
    return { productType: "STOCK", underlying: intent.underlying, exchange: data.spec && data.spec.exchange,
      tradingSymbol: intent.underlying, lotSize: 1, contractMultiplier: 1 };
  }

  const spec = data.spec;
  if (!spec || !(Number(spec.lotSize) > 0) || !(Number(spec.contractMultiplier) > 0)) {
    return { error: RESOLUTION_FAILED, detail: "missing_or_invalid_contract_spec" };   // never guess lot/multiplier
  }

  // Expiry
  const ex = resolveExpiry({ expiries: data.expiries, intent: intent.expiryIntent, market: intent.market });
  if (ex.error) return { error: RESOLUTION_FAILED, detail: "expiry_" + ex.detail };

  // Strike (options only)
  let strike = null, moneyness = null;
  if (productType === "OPTION") {
    const st = resolveMoneynessStrike({ strikes: data.strikes, spot: data.spot, optionType: intent.optionType, moneyness: intent.moneyness });
    if (st.error) return { error: RESOLUTION_FAILED, detail: "strike_" + st.detail };
    strike = st.strike; moneyness = intent.moneyness;
  }

  const qty = lotsToQty(intent.lots, spec.lotSize);
  if (qty == null) return { error: RESOLUTION_FAILED, detail: "quantity_resolution_failed" };
  if (Number(spec.minQty) > 0 && qty < Number(spec.minQty)) return { error: RESOLUTION_FAILED, detail: "below_broker_min_quantity" };
  if (Number(spec.quantityStep) > 0 && Math.abs((qty / spec.quantityStep) - Math.round(qty / spec.quantityStep)) > 1e-9) {
    return { error: RESOLUTION_FAILED, detail: "invalid_quantity_step" };
  }

  const ctx = { market: intent.market, underlying: intent.underlying, productType, optionType: intent.optionType || null,
    strike, expiry: ex.expiry, side: intent.side || null };
  const tradingSymbol = typeof spec.tradingSymbolFor === "function" ? spec.tradingSymbolFor(ctx) : null;
  if (!tradingSymbol) return { error: RESOLUTION_FAILED, detail: "no_broker_trading_symbol" };

  return {
    underlying: intent.underlying,
    market: intent.market,
    productType,
    side: intent.side || null,                 // futures direction (BUY/SELL); null for options handled by optionType
    optionType: intent.optionType || null,
    moneyness,
    strike,
    expiry: ex.expiry.date ?? ex.expiry.ts,
    expiryIntent: intent.expiryIntent,
    lots: Number(intent.lots),
    lotSize: Number(spec.lotSize),
    contractMultiplier: Number(spec.contractMultiplier),
    quantity: qty,
    tickSize: spec.tickSize ?? null,
    quantityStep: spec.quantityStep ?? null,
    exchange: spec.exchange ?? null,
    tradingSymbol,
    instrumentId: (typeof spec.instrumentIdFor === "function" ? spec.instrumentIdFor(ctx) : null),
    metadataVersion: spec.metadataVersion ?? null,
    metadataSource: spec.metadataSource ?? null,
  };
}
