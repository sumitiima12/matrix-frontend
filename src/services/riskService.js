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
  // Safety FLOOR (P1-02), mirroring backend riskEngine.DEFAULT_LIMITS. Single positions stay permissive
  // (a one-symbol position can be the whole sleeve), but a daily-loss circuit breaker, a per-symbol
  // cooldown and sane count caps are on by default. Fully overridable in Profile → Risk limits.
  maxPositionPct: 100,     // a single position may use the whole sleeve
  maxOpenPositions: 50,
  maxTradesPerDay: 100,
  maxDailyLossPct: 25,     // halt a market after −25% realised on the day
  cooldownMs: 15000,       // 15s between two entries in the same symbol
  allowOutsideMarketHours: true,  // paper trading: allowed, but flagged
};

/* R3-#6: conservative (generous-leverage) per-market initial-margin fraction of notional for a short.
   A short consumes margin, not full notional — charging full notional falsely rejected legit leveraged
   crypto shorts. Kept in sync with the backend riskEngine. */
const SHORT_MARGIN_FRACTION = { Crypto: 0.04, FNO: 0.15, IN: 0.20, US: 0.30, Commodity: 0.10 };
const shortMarginFraction = (market) => SHORT_MARGIN_FRACTION[market] != null ? SHORT_MARGIN_FRACTION[market] : 0.20;

/** Indian & US cash markets have sessions; crypto is 24/7. */
export function isMarketOpen(market, now = new Date()) {
  if (market === "Crypto") return true;
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (market === "IN") return mins >= 225 && mins <= 600;      // L-04: 09:15–15:30 IST (03:45–10:00 UTC)
  // US observes DST, so a hardcoded UTC window is wrong half the year. Compute wall-clock
  // time in the exchange timezone (Intl handles EST/EDT), then check 09:30-16:00 ET.
  if (market === "US") {
    try {
      const et = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(now);
      const get = (t) => { const p = et.find((x) => x.type === t); return p ? p.value : ""; };
      const wd = get("weekday");
      if (wd === "Sat" || wd === "Sun") return false;
      const etMins = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
      return etMins >= 570 && etMins <= 960;   // 09:30-16:00 ET
    } catch {
      return mins >= 810 && mins <= 1260;      // fallback
    }
  }
  // Commodity = MCX (Indian, INR). Regular session 09:00–23:30 IST = 03:30–18:00 UTC (210–1080 min).
  if (market === "Commodity") return mins >= 210 && mins <= 1080;
  return true;
}

/* H-02/H-04: the closing bell must be reasoned about in the EXCHANGE's LOCAL time, not a fixed UTC minute —
   US markets shift an hour under daylight-saving, so a hardcoded UTC close is an hour wrong for ~8 months.
   `closeLocalMins` is minutes-since-local-midnight of the bell; `localMins` is the current wall-clock minute
   in that exchange's timezone (DST-correct via Intl). The square-off engine compares these two. */
export function marketTz(market) { return market === "US" ? "America/New_York" : "Asia/Kolkata"; }
export function closeLocalMins(market) {
  if (market === "IN") return 15 * 60 + 30;               // 15:30 IST
  if (market === "US") return 16 * 60;                    // 16:00 ET
  if (market === "Commodity") return 23 * 60 + 30;        // 23:30 IST (MCX)
  return null;                                            // Crypto never closes
}
export function localMins(market, now = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: marketTz(market), hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
    const h = +p.find((x) => x.type === "hour").value, m = +p.find((x) => x.type === "minute").value;
    return (h === 24 ? 0 : h) * 60 + m;
  } catch { return now.getUTCHours() * 60 + now.getUTCMinutes(); }
}
/* Back-compat (deprecated): fixed-UTC close. Kept only so nothing that imported it breaks; the square-off
   engine now uses the DST-correct localMins/closeLocalMins pair above. */
export function marketCloseMins(market) {
  if (market === "IN") return 600;
  if (market === "US") return 1260;
  if (market === "Commodity") return 1080;
  return null;
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
  // Price gates BUYS only — a SELL closes a position you already own and must not be trapped by a missing quote.
  if (side === "BUY" && (!price || price <= 0 || !Number.isFinite(price))) reasons.push("No live price available for this order.");
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
    // A SELL can now either CLOSE a long you hold, or OPEN/increase a SHORT. Selling more than a long
    // holding (or holding nothing / a short) opens a short — which, like a buy, needs a live price and
    // margin. We no longer block "selling more than you hold": the excess is a short entry.
    const longHeld = held && !(held.side === "SELL" || held.short) ? (held.qty || 0) : 0;
    const shortQty = Math.max(0, qty - longHeld);
    if (shortQty > 0) {
      if (!price || price <= 0 || !Number.isFinite(price)) reasons.push("No live price available to open a short.");
      else {
        // R3-#6: charge estimated MARGIN (a fraction of notional), not full notional — full notional
        // falsely rejected legit leveraged crypto shorts. Matches the backend riskEngine.
        const reqMargin = shortQty * price * shortMarginFraction(market);
        if (reqMargin > wallet) reasons.push(`Insufficient margin to short: needs ≈ ${reqMargin.toFixed(2)} but the ${market} wallet holds ${wallet.toFixed(2)}.`);
      }
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
  // Base the cap on START-OF-DAY equity, not the current wallet — otherwise the cap shrinks
  // as you lose (a moving target). Start-of-day wallet ≈ current wallet minus today's P&L.
  const startOfDayWallet = wallet - realisedToday;
  const lossCap = -(startOfDayWallet * limits.maxDailyLossPct) / 100;
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
