import { ALL, marketOf } from "../domain/universe";
import { techSignal, techSignalShort } from "../domain/signals";

/**
 * Trade ideas — published by Matrix from the real signal engine, resolved against real candles.
 */

export function buildDailyIdeas() {
  const today = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const scored = ALL
    .filter((s) => s.sector !== "Volatility" && s.sector !== "Index" && s.hasData)
    .map((s) => ({ s, t: techSignal(s) }))
    // techSignal() returns null without real data. We require real entry + target/stop levels,
    // but NOT a positive score — so every market can surface its best 5 each day even when the
    // signals are only mildly bullish (we just take the top-ranked ones available).
    .filter((x) => x.t && x.s.price != null && x.t.target && x.t.stop);

  // Group by market and take the top 5 strongest signals in EACH — so every market (Indian,
  // US, Crypto, Commodity, F&O) gets 5 fresh daily ideas, not just whichever market tops a
  // single global ranking.
  const byMarket = {};
  for (const x of scored) {
    const m = marketOf(x.s.sym);
    (byMarket[m] = byMarket[m] || []).push(x);
  }
  const out = [];
  for (const m of Object.keys(byMarket)) {
    byMarket[m].sort((a, b) => b.t.score - a.t.score);
    // Crypto is the one market where shorting is offered (mirrors Top Picks), so leave room for a couple of
    // SHORT ideas alongside the longs. Every other market stays long-only.
    const isCrypto = m === "Crypto";
    for (const { s, t } of byMarket[m].slice(0, isCrypto ? 4 : 5)) {
      out.push({
        by: "Neo",
        publishedAt: today,
        sym: s.sym,
        direction: "Long",
        entry: +s.price.toFixed(2),
        exit: t.target,               // real: 60-session resistance or ATR projection
        stop: t.stop,                 // real: swing support cushioned by ATR
        gain: t.tpPct,
        rr: t.rr,
        pattern: t.pattern,
        tradeType: "Stock",
        signal: t.signal,
        logic: t.why,
      });
    }
    // SHORT ideas (crypto only): the strongest genuine bearish setups (score ≥ 2.4), excluding anything
    // already surfaced as a long. Target sits BELOW entry (downside profit), stop ABOVE.
    if (isCrypto) {
      const longSyms = new Set(out.filter((o) => o.direction === "Long" && marketOf(o.sym) === m).map((o) => o.sym));
      const shorts = byMarket[m]
        .filter((x) => !longSyms.has(x.s.sym))
        .map((x) => ({ s: x.s, t: techSignalShort(x.s) }))
        .filter((x) => x.t && x.t.score >= 2.4 && x.t.target && x.t.stop)
        .sort((a, b) => b.t.score - a.t.score)
        .slice(0, 2);
      for (const { s, t } of shorts) {
        out.push({
          by: "Neo",
          publishedAt: today,
          sym: s.sym,
          direction: "Short",
          side: "SELL",
          short: true,
          entry: +s.price.toFixed(2),
          exit: t.target,             // downside target (below entry)
          stop: t.stop,               // upside risk (above entry)
          gain: t.tpPct,              // downside reward %, positive
          rr: t.rr,
          pattern: t.pattern,
          tradeType: "Stock",
          signal: t.signal,
          logic: t.why,
        });
      }
    }
  }
  return out;
}
/**
 * Today's ideas.
 *
 * This used to be `const SEED_IDEAS = buildDailyIdeas()` — evaluated once, at
 * MODULE IMPORT time, before any market data had loaded. Every price was still
 * null at that moment, so it produced an empty list and froze it forever: the
 * Ideas page could never show anything, whatever the market did.
 *
 * Ideas are now computed on demand from whatever REAL data has actually arrived,
 * and cached for the hour (they are daily ideas — recomputing them on every
 * render would make them flicker as quotes tick).
 */
let _cache = { hour: null, ideas: [], ready: 0 };

export function currentIdeas() {
  const hour = Math.floor(Date.now() / 3600000);
  // How many symbols currently have REAL data (price + hasData). This climbs as each market's
  // quotes stream in (Indian/US first, then Crypto via Delta, etc.) and then plateaus. We rebuild
  // whenever it grows so a market whose data landed AFTER the first snapshot (e.g. Crypto) gets its
  // ideas — instead of the hour-cache freezing an early, market-incomplete list for a whole hour.
  // It's monotonic once loaded (price ticks don't change hasData), so this never flickers at rest.
  const ready = ALL.reduce((n, s) => n + ((s && s.hasData && s.price != null) ? 1 : 0), 0);
  if (_cache.hour !== hour || !_cache.ideas.length || ready > _cache.ready) {
    _cache = { hour, ideas: buildDailyIdeas(), ready };
  }
  return _cache.ideas;
}

/* Resolve an idea against REAL candles: walk forward from the publish time and
   see which level was actually touched first. Same rules as the exit engine
   (ties inside one candle assume the stop). Returns null while data is loading —
   the dashboard then reports only what it can actually verify.               */

export function resolveIdea(idea, candles) {
  const entry = idea.entry;
  const target = idea.exit;
  const stop = idea.stop;
  const mkt = marketOf(idea.sym);
  const type = idea.tradeType || "Stock";
  if (!candles || !candles.length || !target || !stop) return null;
  const from = idea.publishedAt || 0;
  const after = candles.filter((c) => c.t && c.t >= from);
  if (!after.length) return null;
  const first = after[0].t;
  const daysAgo = Math.max(0, Math.round((Date.now() - first) / 864e5));
  const isShort = idea.direction === "Short" || idea.side === "SELL" || idea.short;
  if (isShort) {
    // SHORT: profit when price falls to target (below entry); stopped when it rises to stop (above entry).
    // Ties inside one candle assume the stop, same conservative rule as longs. P&L% = (entry − exit) / entry.
    for (const c of after) {
      if (c.h >= stop) return { status: "closed", win: false, ret: (entry - stop) / entry * 100, reason: "Stop", exitAt: c.t, daysAgo, type, mkt, stop };
      if (c.l <= target) return { status: "closed", win: true, ret: (entry - target) / entry * 100, reason: "Target", exitAt: c.t, daysAgo, type, mkt, stop };
    }
    const lastS = after[after.length - 1].c;
    return { status: "open", ret: (entry - lastS) / entry * 100, last: lastS, daysAgo, type, mkt, stop };
  }
  for (const c of after) {
    if (c.l <= stop) return { status: "closed", win: false, ret: (stop / entry - 1) * 100, reason: "Stop", exitAt: c.t, daysAgo, type, mkt, stop };
    if (c.h >= target) return { status: "closed", win: true, ret: (target / entry - 1) * 100, reason: "Target", exitAt: c.t, daysAgo, type, mkt, stop };
  }
  const last = after[after.length - 1].c;
  return { status: "open", ret: (last / entry - 1) * 100, last, daysAgo, type, mkt, stop };
}
