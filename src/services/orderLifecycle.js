/* P3-05 — the ONE durable order-lifecycle service every REAL-money order surface goes through
   (confirm-drawer stock, options, instant Buy/Sell, screener, and any frontend-triggered real order).
   Paper/virtual trading never touches this file — it's real-order-only by construction.

   Why this exists: before this, the confirm drawer, the instant path and the option path each had their
   own ad-hoc lifecycle. The confirm drawer cleared its context before the broker replied, mislabelled
   timeouts as "rejected", lost the action id on retry, and kept every user's pending intents in one
   unscoped localStorage blob. This module centralises the state machine, the stable idempotency key, the
   per-user persistence and the reconciliation logic so there is exactly one implementation.

   State machine:
     draft → submitting → accepted | pending | partial | filled | rejected | cancelled | unknown
   A *broker response* (even "pending") is CONCLUSIVE for the client intent — the order reached the broker,
   so the idempotency key is spent and the intent is cleared. Only a transport-level ambiguity (timeout /
   5xx / idempotency-in-flight / risk-lock) leaves the intent `unknown`: the SAME key is retained and reused
   on retry so the server replays/blocks the single order rather than placing a second, and the UI shows
   "Order outcome unknown — checking broker" and never auto-resubmits. */

export const ORDER_STATES = Object.freeze({
  DRAFT: "draft",
  SUBMITTING: "submitting",
  ACCEPTED: "accepted",
  PENDING: "pending",
  PARTIAL: "partial",
  FILLED: "filled",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  UNKNOWN: "unknown",
});

/* A broker RESPONSE in any of these states means the order conclusively reached the broker — the client
   idempotency key is spent and the intent is cleared (a retry is a NEW deliberate order). `unknown` is the
   only non-conclusive state: the outcome is genuinely unresolved and the key must be retained for reconcile. */
const CONCLUSIVE_RESPONSE = new Set([
  ORDER_STATES.ACCEPTED, ORDER_STATES.PENDING, ORDER_STATES.PARTIAL,
  ORDER_STATES.FILLED, ORDER_STATES.REJECTED, ORDER_STATES.CANCELLED,
]);

export function isConclusiveResponseState(state) { return CONCLUSIVE_RESPONSE.has(state); }

/* Stable idempotency key for an order INTENT. Includes product + every protection leg so two deliberately
   different orders (a plain buy vs the same buy with a stop) are not collapsed as one duplicate, while
   rapid identical taps DO collapse. Callers with their own durable identity (a candle-keyed auto/screener
   buy) pass an explicit key instead. Deterministic — no timestamps. */
export function deriveIntentKey({ brokerId, brokerSym, side, qty, product, sl = 0, tp = 0, tsl = 0, strategy = null }) {
  return [
    brokerId, brokerSym, side, qty, product || "CNC",
    sl || 0, tp || 0, tsl || 0, strategy ? "S" : "",
  ].join("|");
}

/* Map a broker place-order RESPONSE to a canonical lifecycle state + whether a real fill exists. Drives the
   toast + the journal row; the numbers themselves (qty/price) are computed by the caller from the response. */
export function interpretResult(r) {
  const raw = String((r && r.status) || "filled").toLowerCase();
  let state;
  switch (raw) {
    case "filled": state = ORDER_STATES.FILLED; break;
    case "partial": state = ORDER_STATES.PARTIAL; break;
    case "pending": state = ORDER_STATES.PENDING; break;
    case "accepted": state = ORDER_STATES.ACCEPTED; break;
    case "rejected": state = ORDER_STATES.REJECTED; break;
    case "cancelled": case "canceled": state = ORDER_STATES.CANCELLED; break;
    default: state = ORDER_STATES.UNKNOWN;
  }
  const confirmedFilled = state === ORDER_STATES.FILLED || state === ORDER_STATES.PARTIAL;
  return { state, confirmedFilled };
}

/* Map a thrown error to conclusive-reject vs ambiguous(unknown). Only a broker's explicit rejection means
   nothing executed (safe to release the key). A timeout / 5xx / in-flight idempotency block / risk-lock is
   NOT a rejection — it's unknown, and must never be labelled "Broker rejected". */
export function classifyError(e) {
  const reason = (e && e.reason) || String((e && e.message) || e || "error");
  if (e && e.conclusiveReject) return { conclusive: true, state: ORDER_STATES.REJECTED, reason };
  return { conclusive: false, state: ORDER_STATES.UNKNOWN, reason };
}

/* Map the server's GET /api/order/intent-status result to a reconcile action.
   R24-P1-02 / P2-06: `none` means the server has NO record for this key — which, for a locally-persisted UNKNOWN
   intent, is NOT proof the broker never accepted the order (the durable row may have been archived/expired, or the
   original request died before the server recorded it). So `none` must NOT free the key. Only a CONCLUSIVE broker
   `rejected` proves nothing executed and is safe to retry; `succeeded` replays the stored response; everything else
   (in_flight / unknown / none / unrecognised) keeps the intent blocked and reconcilable. */
export function reconcileAction(res) {
  const s = res && res.status;
  if (s === "succeeded") return "clear-success";              // terminal success — show stored response, clear intent
  if (s === "rejected") return "clear-retryable";             // broker-proven reject — a deliberate retry is allowed
  return "retain-blocked";                                    // in_flight / unknown / none → block dup, keep reconciling
}

/* Per-user localStorage key. NEVER a single global blob — intents are namespaced by authenticated user so
   logging out / switching accounts on a shared browser can't inherit another account's pending intent. */
export function storeKeyFor(userKey) { return `mx_pending_intents::${userKey || "anon"}`; }
const LEGACY_KEY = "mx_pending_intents";

function readJSON(storage, key) {
  try { return JSON.parse((storage && storage.getItem(key)) || "{}") || {}; } catch { return {}; }
}
function writeJSON(storage, key, obj) {
  try { storage && storage.setItem(key, JSON.stringify(obj)); } catch { /* storage may be unavailable */ }
}

/* The durable store: an in-memory Map of live intents backed by per-user localStorage. Framework-agnostic
   (storage is injected) so it unit-tests in Node with a fake storage and runs in the browser with the real
   localStorage. Only UNKNOWN intents are persisted — those are the ones that must survive a reload to be
   reconciled; submitting/terminal intents are transient. */
export class OrderLifecycleStore {
  constructor(userKey, storage) {
    this.storage = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    this.userKey = null;
    this.map = new Map();
    this.setUser(userKey);
  }

  /* Switch to a user's intents. Clears the in-memory view (so no cross-account bleed) and rehydrates that
     user's persisted UNKNOWN intents. On first use it also migrates any legacy UNSCOPED blob into the
     current user and deletes it, closing the old shared-storage leak. */
  setUser(userKey) {
    const key = userKey == null ? null : String(userKey);
    if (key === this.userKey) return;
    this.userKey = key;
    this.map = new Map();
    // Migrate a pre-namespacing global blob into this user, then remove it.
    const legacy = readJSON(this.storage, LEGACY_KEY);
    if (Object.keys(legacy).length) {
      const mine = readJSON(this.storage, storeKeyFor(this.userKey));
      for (const k of Object.keys(legacy)) {
        const v = legacy[k];
        mine[k] = typeof v === "string" ? { reqId: v } : v;
      }
      writeJSON(this.storage, storeKeyFor(this.userKey), mine);
      try { this.storage && this.storage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    }
    const persisted = readJSON(this.storage, storeKeyFor(this.userKey));
    for (const k of Object.keys(persisted)) {
      const v = persisted[k];
      this.map.set(k, { reqId: (v && v.reqId) || v, state: ORDER_STATES.UNKNOWN, brokerId: v && v.brokerId });
    }
  }

  get(intentKey) { return this.map.get(intentKey); }
  size() { return this.map.size; }

  /* Begin a submission. Returns { reqId, blocked }. `blocked` when the SAME intent is already submitting
     (rapid double-click / concurrent tap) — the caller must NOT place. Otherwise it returns the reqId to
     use: an UNKNOWN intent's existing reqId is REUSED (so the server dedupes the one order), a caller-owned
     clientRequestId is honoured, else a fresh id is minted. Marks the intent `submitting`. */
  beginSubmit(intentKey, { clientRequestId = null, mint }) {
    const existing = this.map.get(intentKey);
    if (existing && existing.state === ORDER_STATES.SUBMITTING) return { reqId: existing.reqId, blocked: true };
    /* R24-P1-01: an existing UNKNOWN intent's reqId ALWAYS wins — a caller-supplied clientRequestId (e.g. a
       confirmation drawer that was closed and REOPENED, minting a fresh actionId) must NEVER replace the identity
       of an order whose broker outcome is still unresolved. Reusing the stored reqId means the server dedupes/
       replays the single potentially-executed order instead of the reopened drawer placing a duplicate. A fresh
       id is minted only when there is no unresolved intent for this normalized order. */
    const reqId = (existing && existing.state === ORDER_STATES.UNKNOWN)
      ? existing.reqId
      : (clientRequestId || mint());
    this.map.set(intentKey, { ...existing, reqId, state: ORDER_STATES.SUBMITTING, brokerId: (existing && existing.brokerId) });
    return { reqId, blocked: false };
  }

  /* Conclusive outcome (broker responded, or a definite reject) — the key is spent. Drop it from memory and
     from the persisted store so a later retry is a brand-new deliberate order. */
  settleTerminal(intentKey) {
    this.map.delete(intentKey);
    const persisted = readJSON(this.storage, storeKeyFor(this.userKey));
    if (intentKey in persisted) { delete persisted[intentKey]; writeJSON(this.storage, storeKeyFor(this.userKey), persisted); }
  }

  /* Ambiguous outcome — retain the SAME reqId as `unknown` and persist it so a reload can reconcile it. */
  markUnknown(intentKey, reqId, brokerId) {
    this.map.set(intentKey, { reqId, state: ORDER_STATES.UNKNOWN, brokerId });
    const persisted = readJSON(this.storage, storeKeyFor(this.userKey));
    persisted[intentKey] = { reqId, brokerId, ts: Date.now() };
    writeJSON(this.storage, storeKeyFor(this.userKey), persisted);
  }

  /* All persisted (UNKNOWN) intents for the current user — for reconcile-on-load. */
  persisted() {
    const obj = readJSON(this.storage, storeKeyFor(this.userKey));
    return Object.keys(obj).map((k) => ({ intentKey: k, reqId: (obj[k] && obj[k].reqId) || obj[k], brokerId: obj[k] && obj[k].brokerId }));
  }
}
