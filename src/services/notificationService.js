/**
 * services/notificationService.js — the notification engine.
 *
 * A tiny pub/sub bus. Every meaningful event in the pipeline (fills, stops,
 * targets, risk blocks, automation triggers) publishes here, and the UI
 * subscribes. Keeping it decoupled means adding push or email later is a new
 * subscriber, not a change to the pipeline.
 */

export const KINDS = {
  OPPORTUNITY: "opportunity",   // a pick or signal worth looking at
  RISK: "risk",                 // the Risk Engine blocked or warned
  STOP: "stop",                 // stop-loss hit
  TARGET: "target",             // target hit
  FILL: "fill",                 // order filled
  EXIT: "exit",                 // position closed
  ORDER: "order",               // broker order status
  AUTOMATION: "automation",     // an automation triggered
  MARKET: "market",             // market open/close
};

const subscribers = new Set();
let log = [];

/** Subscribe. Returns an unsubscribe function. */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Publish a notification to every subscriber. */
export function notify(n) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    kind: n.kind || KINDS.MARKET,
    text: n.text || "",
    error: Boolean(n.error),
    meta: n.meta || null,
  };
  log = [item, ...log].slice(0, 200);
  subscribers.forEach((fn) => {
    try { fn(item); } catch { /* a bad subscriber must not break the pipeline */ }
  });
  return item;
}

export const history = () => log;
export const clear = () => { log = []; };
