/**
 * services/riskService.js — THE RISK ENGINE.
 *
 * Per the product spec: every order must pass through here before it reaches a
 * portfolio, an automation, or (later) a broker adapter. Strategies must never
 * place orders directly.
 *
 *   Strategy Engine -> Risk Engine -> Broker Adapter -> Broker API
 *
 * Pure and synchronous: given an order and the current account state, it returns
 * an allow/deny decision with a human-readable reason. No I/O, fully testable.
 */

export const DEFAULT_LIMITS = {
  maxPositionPct: 25,      // max % of that market's wallet in a single position
  maxOpenPositions: 15,    // per market
  maxTradesPerDay: 30,     // per market
  maxDailyLossPct: 5,      // stop trading after losing this % of the wallet today
  cooldownMs: 60_000,      // min gap between two orders in the same symbol
  allowOutsideMarketHours: true,  // paper trading: allowed, but flagged
};

/** Indian & US cash markets have sessions; crypto is 24/7. */
export function isMarketOpen(market, now = new Date()) {
  if (market === "Crypto") return true;
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (market === "IN" || market === "FNO") return mins >= 225 && mins <= 600;      // 09:15–16:00 IST
  if (market === "US") return mins >= 810 && mins <= 1260;                          // 09:30–16:00 ET (approx, EDT)
  if (market === "Commodity") return mins >= 240 && mins <= 1410;
  return true;
}

/* Closing bell, in UTC minutes-since-midnight. Same numbers isMarketOpen uses, named
   once so the square-off engine and the open/closed check can never drift apart. */
export function marketCloseMins(market) {
  if (market === "IN" || market === "FNO") return 600;    // 15:30 IST
  if (market === "US") return 1260;                       // 16:00 ET (approx)
  if (market === "Commodity") return 1410;
  return null;                                            // Crypto never closes
}

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Validate an order.
 *
 * @param order   { sym, side: "BUY"|"SELL", qty, price, market }
 * @param account { wallet, portfolio, trades, limits? }
 * @returns { ok, reasons: string[], warnings: string[] }
 */
export function validateOrder(order, account) {
  const limits = { ...DEFAULT_LIMITS, ...(account.limits || {}) };
  const reasons = [];
  const warnings = [];

  const { sym, side = "BUY", qty, price, market = "IN" } = order || {};
  const { wallet = 0, portfolio = [], trades = [] } = account || {};

  // --- basic sanity ---
  if (!sym) reasons.push("No symbol on the order.");
  if (!qty || qty <= 0 || !Number.isFinite(qty)) reasons.push("Quantity must be a positive number.");
  if (!price || price <= 0 || !Number.isFinite(price)) reasons.push("No live price available for this symbol — order blocked.");
  if (reasons.length) return { ok: false, reasons, warnings };

  const value = qty * price;
  const held = portfolio.find((h) => h.sym === sym);
  const todays = trades.filter((t) => (t.entryAt || 0) >= startOfDay() && (t.market || "IN") === market);
  const openInMarket = portfolio.filter((h) => (h.market || "IN") === market);

  if (side === "BUY") {
    // --- margin / funds ---
    if (value > wallet) reasons.push(`Insufficient funds: order needs ${value.toFixed(2)} but the ${market} wallet holds ${wallet.toFixed(2)}.`);

    // --- position sizing ---
    const equity = wallet + portfolio.reduce((a, h) => a + (h.qty || 0) * (h.price || h.avg || 0), 0);
    const existing = held ? (held.qty || 0) * price : 0;
    const pct = equity > 0 ? ((value + existing) / equity) * 100 : 100;
    if (pct > limits.maxPositionPct) {
      reasons.push(`Position size ${pct.toFixed(1)}% of ${market} equity exceeds the ${limits.maxPositionPct}% cap.`);
    }

    // --- max open positions ---
    if (!held && openInMarket.length >= limits.maxOpenPositions) {
      reasons.push(`Already holding ${openInMarket.length} positions in ${market} (cap ${limits.maxOpenPositions}).`);
    }
  }

  if (side === "SELL") {
    if (!held || (held.qty || 0) < qty) {
      reasons.push(`Cannot sell ${qty} ${sym} — you hold ${held ? held.qty : 0}.`);
    }
  }

  // --- trade frequency ---
  if (todays.length >= limits.maxTradesPerDay) {
    reasons.push(`Daily trade cap reached for ${market} (${limits.maxTradesPerDay}).`);
  }

  // --- daily loss limit ---
  const realisedToday = trades
    .filter((t) => (t.exitAt || 0) >= startOfDay() && (t.market || "IN") === market)
    .reduce((a, t) => a + (t.pnl || 0), 0);
  const lossCap = -(wallet * limits.maxDailyLossPct) / 100;
  if (realisedToday < lossCap) {
    reasons.push(`Daily loss limit hit in ${market} (${realisedToday.toFixed(0)} vs cap ${lossCap.toFixed(0)}). Trading paused until tomorrow.`);
  }

  // --- duplicate / cooldown ---
  const lastSame = trades
    .filter((t) => t.sym === sym && t.entryAt)
    .sort((a, b) => b.entryAt - a.entryAt)[0];
  if (side === "BUY" && lastSame && Date.now() - lastSame.entryAt < limits.cooldownMs) {
    reasons.push(`Cooldown active on ${sym} — wait ${Math.ceil((limits.cooldownMs - (Date.now() - lastSame.entryAt)) / 1000)}s before re-entering.`);
  }

  // --- market hours (warn, don't block, for paper trading) ---
  if (!isMarketOpen(market)) {
    const msg = `${market} market is closed — the order will fill at the last traded price.`;
    if (limits.allowOutsideMarketHours) warnings.push(msg); else reasons.push(msg);
  }

  return { ok: reasons.length === 0, reasons, warnings };
}
