import assert from "node:assert";
import {
  resolveMoneynessStrike, resolveExpiry, lotsToQty, validateDerivativeIntent,
  resolveDerivativeContract, DEFAULT_LOTS, RESOLUTION_FAILED,
} from "./derivatives.js";

const strikes = [24600, 24700, 24800, 24900, 25000];   // ATM = 24800 when spot ~24810
const spot = 24810;

/* ---- MONEYNESS (Part 5) ---- */
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "ATM" }).strike, 24800);
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "ITM1" }).strike, 24700); // call ITM = below
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "ITM2" }).strike, 24600);
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "OTM1" }).strike, 24900); // call OTM = above
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "OTM2" }).strike, 25000);
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "PUT",  moneyness: "ITM1" }).strike, 24900); // put ITM = above
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "PUT",  moneyness: "OTM1" }).strike, 24700); // put OTM = below
// rung not listed → FAIL CLOSED (Part 28), never extrapolate
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "OTM4" }).error, RESOLUTION_FAILED);
assert.equal(resolveMoneynessStrike({ strikes, spot, optionType: "CALL", moneyness: "ITM4" }).error, RESOLUTION_FAILED);

/* ---- EXPIRY (Parts 6/7/8) ---- */
const day = 864e5, now = Date.now();
const inExp = [{ date: now + 2 * day, weekly: true }, { date: now + 9 * day, weekly: true }, { date: now + 20 * day, weekly: false }];
assert.equal(resolveExpiry({ expiries: inExp, intent: "CURRENT_WEEK", market: "IN" }).expiry.date, inExp[0].date);
assert.equal(resolveExpiry({ expiries: inExp, intent: "CURRENT_MONTH", market: "IN" }).expiry.date, inExp[2].date);
// India has no TOMORROW intent → unsupported
assert.equal(resolveExpiry({ expiries: inExp, intent: "TOMORROW", market: "IN" }).error, RESOLUTION_FAILED);
// US dailies TOMORROW → next listed strictly after today
const usExp = [{ date: now + 1 * day, weekly: true }, { date: now + 8 * day, weekly: true }];
assert.equal(resolveExpiry({ expiries: usExp, intent: "TOMORROW", market: "US" }).expiry.date, usExp[0].date);
// Crypto +30d / +90d intents pick nearest listed to the target
const cryptoExp = [{ date: now + 1 * day }, { date: now + 31 * day }, { date: now + 88 * day }];
assert.equal(resolveExpiry({ expiries: cryptoExp, intent: "PLUS_30D", market: "Crypto" }).expiry.date, cryptoExp[1].date);
assert.equal(resolveExpiry({ expiries: cryptoExp, intent: "PLUS_90D", market: "Crypto" }).expiry.date, cryptoExp[2].date);
// Commodity current/next month
const comExp = [{ date: now + 10 * day, weekly: false }, { date: now + 40 * day, weekly: false }];
assert.equal(resolveExpiry({ expiries: comExp, intent: "CURRENT_MONTH", market: "Commodity" }).expiry.date, comExp[0].date);
assert.equal(resolveExpiry({ expiries: comExp, intent: "NEXT_MONTH", market: "Commodity" }).expiry.date, comExp[1].date);
// no listed expiries → fail closed
assert.equal(resolveExpiry({ expiries: [], intent: "CURRENT_MONTH", market: "IN" }).error, RESOLUTION_FAILED);

/* ---- LOTS (Part 11/12) ---- */
assert.equal(lotsToQty(1, 65), 65);      // NIFTY 1 lot
assert.equal(lotsToQty(3, 65), 195);
assert.equal(lotsToQty(0, 65), null);    // zero lots
assert.equal(lotsToQty(2, 0), null);     // bad lot size
assert.equal(DEFAULT_LOTS.IN, 1);
assert.equal(DEFAULT_LOTS.Crypto, 100);

/* ---- VALIDATION (Part 27) ---- */
assert.ok(validateDerivativeIntent({ productType: "STOCK" }).ok);
assert.deepEqual(validateDerivativeIntent({ productType: "FUTURE", lots: 1, side: "SELL", market: "IN", expiryIntent: "CURRENT_MONTH" }).errors, []);
assert.ok(validateDerivativeIntent({ productType: "FUTURE", lots: 1, market: "IN", expiryIntent: "CURRENT_MONTH" }).errors.includes("future_missing_side"));
assert.ok(validateDerivativeIntent({ productType: "OPTION", lots: 1, moneyness: "ATM", market: "IN", expiryIntent: "CURRENT_WEEK" }).errors.includes("option_missing_call_put"));
assert.ok(validateDerivativeIntent({ productType: "OPTION", optionType: "CALL", lots: 1, market: "IN", expiryIntent: "CURRENT_WEEK" }).errors.includes("option_missing_moneyness"));
assert.ok(validateDerivativeIntent({ productType: "OPTION", optionType: "CALL", moneyness: "ATM", lots: 0, market: "IN", expiryIntent: "CURRENT_WEEK" }).errors.includes("lots_must_be_positive"));
assert.ok(validateDerivativeIntent({ productType: "FUTURE", side: "BUY", lots: 1.5, market: "IN", expiryIntent: "CURRENT_MONTH" }).errors.includes("fractional_lots_not_allowed"));

/* ---- FULL RESOLUTION (Part 20) ---- */
const spec = {
  lotSize: 65, contractMultiplier: 1, tickSize: 0.05, quantityStep: 65, minQty: 65, exchange: "NFO",
  metadataVersion: "2026.08", metadataSource: "broker_instrument_master",
  tradingSymbolFor: (c) => c.productType === "OPTION"
    ? `NIFTY${c.strike}${c.optionType[0] === "C" ? "CE" : "PE"}` : `NIFTYFUT`,
  instrumentIdFor: () => "NSE_FO|12345",
};
const okOpt = resolveDerivativeContract(
  { market: "IN", underlying: "NIFTY", productType: "OPTION", optionType: "CALL", moneyness: "ATM", expiryIntent: "CURRENT_WEEK", lots: 1 },
  { spot, strikes, expiries: inExp, spec, capabilities: { options: true, optionSides: ["CALL", "PUT"] } },
);
assert.equal(okOpt.error, undefined, JSON.stringify(okOpt));
assert.equal(okOpt.strike, 24800);
assert.equal(okOpt.quantity, 65);
assert.equal(okOpt.tradingSymbol, "NIFTY24800CE");
assert.equal(okOpt.metadataSource, "broker_instrument_master");

// missing spec → fail closed (never guess lot/multiplier — Part 13/14)
const noSpec = resolveDerivativeContract(
  { market: "IN", underlying: "NIFTY", productType: "FUTURE", side: "BUY", expiryIntent: "CURRENT_MONTH", lots: 1 },
  { spot, strikes, expiries: inExp, spec: null },
);
assert.equal(noSpec.error, RESOLUTION_FAILED);
assert.equal(noSpec.detail, "missing_or_invalid_contract_spec");

// capability off → fail closed (Part 19/39)
const capOff = resolveDerivativeContract(
  { market: "IN", underlying: "NIFTY", productType: "OPTION", optionType: "CALL", moneyness: "ATM", expiryIntent: "CURRENT_WEEK", lots: 1 },
  { spot, strikes, expiries: inExp, spec, capabilities: { options: false } },
);
assert.equal(capOff.error, RESOLUTION_FAILED);

// future SELL resolves with side preserved (Part 9)
const shortFut = resolveDerivativeContract(
  { market: "IN", underlying: "NIFTY", productType: "FUTURE", side: "SELL", expiryIntent: "CURRENT_MONTH", lots: 2 },
  { spot, strikes, expiries: inExp, spec, capabilities: { futures: true } },
);
assert.equal(shortFut.side, "SELL");
assert.equal(shortFut.quantity, 130);
assert.equal(shortFut.tradingSymbol, "NIFTYFUT");

console.log("derivatives domain model OK");
