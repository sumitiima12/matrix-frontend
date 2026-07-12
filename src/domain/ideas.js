import React from "react";
import { ALL, marketOf } from "../domain/universe";
import { techSignal } from "../domain/signals";

/**
 * Trade ideas — published by Matrix from the real signal engine, resolved against real candles.
 */

export function buildDailyIdeas() {
  return ALL
    .filter((s) => s.sector !== "Volatility" && s.sector !== "Index" && s.hasData)
    .map((s) => ({ s, t: techSignal(s) }))
    .filter((x) => x.t && x.t.score > 0 && x.t.target && x.t.stop)
    .sort((a, b) => b.t.score - a.t.score)
    .slice(0, 9)
    .map(({ s, t }) => ({
      by: "Matrix",
      publishedAt: new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
      sym: s.sym,
      entry: +s.price.toFixed(2),
      exit: t.target,               // real: 60-session resistance or ATR projection
      stop: t.stop,                 // real: swing support cushioned by ATR
      gain: t.tpPct,
      rr: t.rr,
      pattern: t.pattern,
      tradeType: marketOf(s.sym) === "IN" ? "Stock" : "Stock",
      signal: t.signal,
      logic: t.why,
    }));
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
let _cache = { hour: null, ideas: [] };

export function currentIdeas() {
  const hour = Math.floor(Date.now() / 3600000);
  if (_cache.hour !== hour || !_cache.ideas.length) {
    _cache = { hour, ideas: buildDailyIdeas() };
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
  for (const c of after) {
    if (c.l <= stop) return { status: "closed", win: false, ret: (stop / entry - 1) * 100, reason: "Stop", exitAt: c.t, daysAgo, type, mkt, stop };
    if (c.h >= target) return { status: "closed", win: true, ret: (target / entry - 1) * 100, reason: "Target", exitAt: c.t, daysAgo, type, mkt, stop };
  }
  const last = after[after.length - 1].c;
  return { status: "open", ret: (last / entry - 1) * 100, last, daysAgo, type, mkt, stop };
}
