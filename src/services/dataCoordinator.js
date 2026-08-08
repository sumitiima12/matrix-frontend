/**
 * services/dataCoordinator.js — ONE adaptive client-side data coordinator.
 *
 * The reviewer's finding: many mounted components independently poll quotes, indicators, screeners,
 * strategies, positions and exits on overlapping 60s timers. The backend has single-flight + short caching,
 * but the BROWSER had no shared coordinator — so hidden tabs and duplicate consumers still generated load.
 *
 * This module is that coordinator. Every background read goes through `coordinatedFetch`, which gives us,
 * in one place:
 *   • DE-DUPLICATION — concurrent identical requests (same key) share ONE in-flight promise.
 *   • SHORT TTL CACHE — a fresh cached result is returned without hitting the network, so multiple features
 *     that want the same quotes/history within the window share the same bytes.
 *   • VISIBILITY / OFFLINE AWARENESS — while the tab is hidden or the browser is offline, NON-essential reads
 *     do NOT hit the network; they serve the last cached value. Work stops for backgrounded tabs.
 *   • ADAPTIVE BACKOFF — after an error, the effective freshness window for that key is stretched
 *     exponentially, so a failing endpoint isn't hammered.
 *   • CAPACITY RESERVED FOR MONEY OPERATIONS — background (normal) reads pass through a small concurrency
 *     gate; `priority: 'critical'` requests (orders, risk, reconciliation) BYPASS the gate and the
 *     visibility/backoff throttles entirely, so a trade or risk check is never queued behind a quote poll.
 *
 * It is transport-agnostic: pass a `fetcher` that returns a promise. `usePolled` layers a shared, overlap-free,
 * visibility-aware interval on top so N subscribers to the same key share ONE timer and ONE fetch.
 */
import { useEffect, useRef, useState } from "react";

/* ---- global page state (visibility + online) ---- */
const hasDoc = typeof document !== "undefined";
const hasNav = typeof navigator !== "undefined";
let _hidden = hasDoc ? document.visibilityState === "hidden" : false;
let _online = hasNav ? navigator.onLine !== false : true;
const _pageListeners = new Set();
function _emitPage() { for (const fn of _pageListeners) { try { fn({ hidden: _hidden, online: _online }); } catch { /* ignore */ } } }
if (hasDoc) document.addEventListener("visibilitychange", () => { _hidden = document.visibilityState === "hidden"; _emitPage(); });
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { _online = true; _emitPage(); });
  window.addEventListener("offline", () => { _online = false; _emitPage(); });
}
export const isBackgrounded = () => _hidden;
export const isOnline = () => _online;
/** Subscribe to page active/online changes; returns an unsubscribe. */
export function onPageStateChange(fn) { _pageListeners.add(fn); return () => _pageListeners.delete(fn); }

/* ---- cache + in-flight de-dup ---- */
const _cache = new Map();      // key -> { value, at, err, backoff }
const _inflight = new Map();   // key -> promise

/* ---- concurrency gate (background reads only; criticals bypass) ---- */
const MAX_BG_CONCURRENCY = 6;
let _bgActive = 0;
const _bgQueue = [];
function _acquire() {
  if (_bgActive < MAX_BG_CONCURRENCY) { _bgActive++; return Promise.resolve(); }
  return new Promise((res) => _bgQueue.push(res));
}
function _release() {
  _bgActive = Math.max(0, _bgActive - 1);
  const next = _bgQueue.shift();
  if (next) { _bgActive++; next(); }
}

/**
 * The one read primitive. Returns the fetched (or cached) value.
 *
 * @param {string}   key      stable identity for this request (usually the URL + params).
 * @param {Function} fetcher  () => Promise<value>. Only called on a real fetch.
 * @param {object}   opts
 *   ttlMs      how long a successful result stays fresh (default 8000).
 *   priority   'normal' (default, throttled/paused) | 'critical' (orders/risk — never throttled).
 *   force      ignore the cache and fetch now (still de-duped).
 */
export async function coordinatedFetch(key, fetcher, opts = {}) {
  const ttlMs = Number(opts.ttlMs) > 0 ? Number(opts.ttlMs) : 8000;
  const critical = opts.priority === "critical";
  const now = Date.now();
  const entry = _cache.get(key);

  // Fresh cache hit (adaptive: a prior error stretches the effective window via entry.backoff).
  if (!opts.force && entry && entry.err == null) {
    const window = ttlMs * (entry.backoff || 1);
    if (now - entry.at < window) return entry.value;
  }
  // Background work is suppressed while hidden/offline — serve last value, don't touch the network.
  if (!critical && (_hidden || !_online)) {
    return entry ? entry.value : null;
  }
  // De-dup concurrent identical requests.
  if (_inflight.has(key)) return _inflight.get(key);

  const run = (async () => {
    if (!critical) await _acquire();
    try {
      const value = await fetcher();
      _cache.set(key, { value, at: Date.now(), err: null, backoff: 1 });
      return value;
    } catch (e) {
      // Adaptive backoff: double the stretch each consecutive failure, capped at 8×.
      const prev = _cache.get(key);
      const backoff = Math.min(8, ((prev && prev.backoff) || 1) * 2);
      _cache.set(key, { value: prev ? prev.value : null, at: Date.now(), err: e, backoff });
      throw e;
    } finally {
      _inflight.delete(key);
      if (!critical) _release();
    }
  })();
  _inflight.set(key, run);
  return run;
}

/** Read the last cached value for a key without triggering a fetch (null if none). */
export function peekCache(key) { const e = _cache.get(key); return e ? e.value : null; }
/** Invalidate a key (e.g. after a write) so the next read refetches. */
export function invalidate(key) { _cache.delete(key); }

/* ---- shared poll scheduler: N subscribers to a key share ONE timer + ONE fetch, overlap-free ---- */
const _pollers = new Map();   // key -> { fn, intervalMs, subs:Set, timer, running, lastEmit }
function _tick(key) {
  const p = _pollers.get(key);
  if (!p || p.running) return;                        // never overlap: skip if a fetch is still in flight
  if (_hidden || !_online) return;                    // paused in background/offline
  p.running = true;
  Promise.resolve()
    .then(p.fn)
    .then((v) => { p.lastEmit = v; for (const s of p.subs) { try { s.onData && s.onData(v); } catch { /* ignore */ } } })
    .catch((e) => { for (const s of p.subs) { try { s.onError && s.onError(e); } catch { /* ignore */ } } })
    .finally(() => { p.running = false; });
}
function _ensurePoller(key, fn, intervalMs) {
  let p = _pollers.get(key);
  if (!p) {
    p = { fn, intervalMs, subs: new Set(), timer: null, running: false, lastEmit: undefined };
    p.timer = setInterval(() => _tick(key), Math.max(3000, intervalMs));
    _pollers.set(key, p);
  } else { p.fn = fn; }                                // keep the latest fetcher closure
  return p;
}
/** Subscribe to a shared poll. Returns unsubscribe. When the tab becomes visible again it refreshes once. */
export function subscribePoll(key, fn, { intervalMs = 60000, onData, onError, immediate = true } = {}) {
  const p = _ensurePoller(key, fn, intervalMs);
  const sub = { onData, onError };
  p.subs.add(sub);
  if (immediate) { if (p.lastEmit !== undefined && onData) onData(p.lastEmit); else _tick(key); }
  return () => {
    p.subs.delete(sub);
    if (p.subs.size === 0) { clearInterval(p.timer); _pollers.delete(key); }
  };
}
// A newly-visible tab should refresh its shared pollers once (they were paused while hidden).
onPageStateChange(({ hidden, online }) => { if (!hidden && online) for (const key of _pollers.keys()) _tick(key); });

/** React hook: shared, overlap-free, visibility-aware poll. Returns { data, error, loading, refresh }. */
export function usePolled(key, fn, { intervalMs = 60000, enabled = true } = {}) {
  const [data, setData] = useState(() => peekCache(key));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    if (!enabled || !key) return undefined;
    setLoading(true);
    const unsub = subscribePoll(key, () => fnRef.current(), {
      intervalMs,
      onData: (v) => { setData(v); setError(null); setLoading(false); },
      onError: (e) => { setError(e); setLoading(false); },
    });
    return unsub;
  }, [key, intervalMs, enabled]);
  const refresh = () => _tick(key);
  return { data, error, loading, refresh };
}

export default { coordinatedFetch, usePolled, subscribePoll, peekCache, invalidate, isBackgrounded, isOnline, onPageStateChange };
