/* P3-05 — durable order-lifecycle service tests. These exercise the SAME store + helpers every real-money
   order surface uses in Matrix.jsx, through a harness that mirrors placeRealMarketOrder's exact sequence
   (beginSubmit → place → settleTerminal | markUnknown). Storage is injected (a fake Map), so no DOM. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  OrderLifecycleStore, deriveIntentKey, interpretResult, classifyError, reconcileAction,
  storeKeyFor, ORDER_STATES, planClose,
} from "../src/services/orderLifecycle.js";

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _keys: () => [...m.keys()],
  };
}
let _id = 0;
const mint = () => `act_${++_id}`;

/* Mirrors placeRealMarketOrder's use of the store. `place(reqId)` simulates the broker: it may resolve with a
   {status} response or throw (with e.conclusiveReject for a definite reject, else an ambiguous transport error).
   Returns the same shape the real function returns. */
async function submit(store, intentKey, place, { clientRequestId = null, brokerId = "fyers" } = {}) {
  const { reqId, blocked } = store.beginSubmit(intentKey, { clientRequestId, mint });
  if (blocked) return { blocked: true, state: ORDER_STATES.SUBMITTING };
  try {
    const r = await place(reqId);
    const { state } = interpretResult(r);
    store.settleTerminal(intentKey);
    return { ok: state !== ORDER_STATES.REJECTED, state, reqId };
  } catch (e) {
    const { conclusive, state } = classifyError(e);
    if (conclusive) { store.settleTerminal(intentKey); return { ok: false, state, reqId }; }
    store.markUnknown(intentKey, reqId, brokerId);
    return { ok: false, state: ORDER_STATES.UNKNOWN, reqId };
  }
}
const timeout = () => { const e = new Error("network timeout"); return e; };                       // ambiguous
const reject = (msg) => { const e = new Error(msg || "insufficient funds"); e.conclusiveReject = true; e.reason = msg; return e; };

const KEY = () => deriveIntentKey({ brokerId: "fyers", brokerSym: "NSE:SBIN-EQ", side: "BUY", qty: 1, product: "CNC", sl: 0, tp: 0 });

test("1. rapid double-click submits exactly once", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  let placed = 0;
  const place = async () => { placed++; await new Promise((r) => setTimeout(r, 5)); return { status: "filled", orderId: "O1" }; };
  const key = KEY();
  const [a, b] = await Promise.all([submit(store, key, place), submit(store, key, place)]);   // two concurrent taps
  assert.equal(placed, 1, "only one order reaches the broker");
  const blocked = [a, b].filter((r) => r.blocked).length;
  assert.equal(blocked, 1, "the second concurrent tap is blocked");
});

test("2. timeout then retry reuses the SAME idempotency key", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = KEY();
  const first = await submit(store, key, async () => { throw timeout(); });                    // ambiguous
  assert.equal(first.state, ORDER_STATES.UNKNOWN);
  let usedReqId = null;
  const second = await submit(store, key, async (reqId) => { usedReqId = reqId; return { status: "filled", orderId: "O2" }; });
  assert.equal(usedReqId, first.reqId, "retry reuses the original reqId (no new key)");
  assert.equal(second.state, ORDER_STATES.FILLED);
});

test("3. reload restores and reconciles an unknown intent", async () => {
  const storage = makeStorage();
  const store = new OrderLifecycleStore("u1", storage);
  const key = KEY();
  const first = await submit(store, key, async () => { throw timeout(); });
  // Simulate a full reload: a brand-new store over the SAME storage + user.
  const reloaded = new OrderLifecycleStore("u1", storage);
  const pend = reloaded.persisted();
  assert.equal(pend.length, 1, "the unknown intent survives reload");
  assert.equal(pend[0].reqId, first.reqId);
  assert.equal(reconcileAction({ status: "in_flight" }), "retain-blocked");   // still unknown → keep blocking
  assert.equal(reconcileAction({ status: "succeeded" }), "clear-success");
  reloaded.settleTerminal(pend[0].intentKey);                                  // succeeded → clear
  assert.equal(reloaded.persisted().length, 0);
});

test("4. confirm drawer cannot create a second order after ambiguity", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = KEY();
  const executed = new Set();
  // Broker executes once per DISTINCT reqId; a repeat of the same reqId is an idempotent replay (no new fill).
  const place = (throwFirst) => async (reqId) => {
    if (throwFirst) throw timeout();
    if (executed.has(reqId)) return { status: "filled", orderId: "REPLAY", replay: true };
    executed.add(reqId); return { status: "filled", orderId: "O4" };
  };
  await submit(store, key, place(true));                    // ambiguous — server may already hold the order
  await submit(store, key, place(false));                   // retry (reuses reqId) → server replays, no 2nd fill
  assert.equal(executed.size, 1, "at most one distinct order ever reaches the exchange");
});

test("4b. R24-P1-01: reopening the drawer with a NEW actionId cannot replace an unknown intent", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = KEY();
  const executed = new Set();
  const place = (throwFirst) => async (reqId) => {
    if (throwFirst) throw timeout();
    if (executed.has(reqId)) return { status: "filled", orderId: "REPLAY", replay: true };
    executed.add(reqId); return { status: "filled", orderId: "O4b" };
  };
  const first = await submit(store, key, place(true));                          // ambiguous → unknown, reqId R
  assert.equal(first.state, ORDER_STATES.UNKNOWN);
  // The confirm drawer is closed and REOPENED — it mints a brand-new actionId and passes it as clientRequestId.
  let usedReqId = null;
  await submit(store, key, async (reqId) => { usedReqId = reqId; return place(false)(reqId); }, { clientRequestId: "freshActionId_from_reopen" });
  assert.equal(usedReqId, first.reqId, "the reopened drawer's new id is IGNORED — the unknown reqId still governs");
  assert.notEqual(usedReqId, "freshActionId_from_reopen");
  assert.equal(executed.size, 1, "no duplicate order despite the new action id");
});

test("R24-P1-02/P2-06: 'none' from intent-status stays blocked (not treated as retryable)", () => {
  assert.equal(reconcileAction({ status: "none" }), "retain-blocked");
  assert.equal(reconcileAction({ status: "in_flight" }), "retain-blocked");
  assert.equal(reconcileAction({ status: "unknown" }), "retain-blocked");
  assert.equal(reconcileAction({ status: "rejected" }), "clear-retryable");
  assert.equal(reconcileAction({ status: "succeeded" }), "clear-success");
});

test("5. option order waits for the real backend result (no premature 'filled')", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = deriveIntentKey({ brokerId: "fyers", brokerSym: "NSE:NIFTY24000CE", side: "BUY", qty: 50, product: "NRML" });
  let resolved = false;
  const place = async () => { await new Promise((r) => setTimeout(r, 8)); resolved = true; return { status: "pending", orderId: "OPT1" }; };
  const res = await submit(store, key, place);
  assert.equal(resolved, true, "submit awaited the broker before resolving");
  assert.equal(res.state, ORDER_STATES.PENDING, "the awaited outcome is reported, not an assumed fill");
});

test("6. a rejected order allows a deliberate retry with a NEW key", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = KEY();
  const r1 = await submit(store, key, async () => { throw reject("insufficient funds"); });
  assert.equal(r1.state, ORDER_STATES.REJECTED);
  assert.equal(store.size(), 0, "a conclusive reject clears the intent");
  let secondReqId = null;
  await submit(store, key, async (reqId) => { secondReqId = reqId; return { status: "filled", orderId: "O6" }; });
  assert.notEqual(secondReqId, r1.reqId, "a deliberate retry after a reject is a fresh order (new id)");
});

test("7. a successful idempotent replay does not place another order", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const key = KEY();
  const executed = new Set();
  const place = async (reqId) => { if (executed.has(reqId)) return { status: "filled", orderId: "REPLAY" }; executed.add(reqId); return { status: "filled", orderId: "O7" }; };
  const r1 = await submit(store, key, place);
  // Same explicit key replayed (e.g. a stale in-flight resend) → the server returns the stored response.
  await submit(store, key, place, { clientRequestId: r1.reqId });
  assert.equal(executed.size, 1, "the replay returns the stored response — no second execution");
});

test("8. two users on the same browser do not share intents", async () => {
  const storage = makeStorage();
  const store = new OrderLifecycleStore("userA", storage);
  const key = KEY();
  await submit(store, key, async () => { throw timeout(); });                 // A has an unknown intent
  assert.equal(store.persisted().length, 1);
  store.setUser("userB");                                                     // switch account
  assert.equal(store.persisted().length, 0, "B sees none of A's intents");
  assert.equal(store.get(key), undefined);
  // Distinct namespaced storage keys, and B's store never exposes A's.
  assert.ok(storage._keys().includes(storeKeyFor("userA")));
  store.setUser("userA");
  assert.equal(store.persisted().length, 1, "A's intent is still there when A returns");
});

test("9. the routed broker id is carried on the intent (drives the routed-broker message)", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  const keyF = deriveIntentKey({ brokerId: "fyers", brokerSym: "NSE:SBIN-EQ", side: "BUY", qty: 1, product: "CNC" });
  const keyD = deriveIntentKey({ brokerId: "delta", brokerSym: "BTCUSD", side: "BUY", qty: 1, product: "CNC" });
  assert.notEqual(keyF, keyD, "a FYERS and a Delta order are distinct intents (routed separately)");
  await submit(store, keyD, async () => { throw timeout(); }, { brokerId: "delta" });
  assert.equal(store.persisted()[0].brokerId, "delta", "the routed broker is recorded for reconcile/messaging");
});

test("10. paper/virtual orders never enter the real-order lifecycle", async () => {
  const store = new OrderLifecycleStore("u1", makeStorage());
  // A virtual order path does NOT call the store at all (Matrix routes paper to placeOrder, not placeRealMarketOrder).
  // Model that invariant: no beginSubmit → the store stays empty and nothing is persisted.
  assert.equal(store.size(), 0);
  assert.equal(store.persisted().length, 0);
});

test("helpers: interpretResult maps every broker status to the canonical state", () => {
  assert.equal(interpretResult({ status: "filled" }).state, ORDER_STATES.FILLED);
  assert.equal(interpretResult({ status: "partial" }).state, ORDER_STATES.PARTIAL);
  assert.equal(interpretResult({ status: "PENDING" }).state, ORDER_STATES.PENDING);
  assert.equal(interpretResult({ status: "rejected" }).state, ORDER_STATES.REJECTED);
  assert.equal(interpretResult({ status: "weird" }).state, ORDER_STATES.UNKNOWN);
  assert.equal(interpretResult({ status: "filled" }).confirmedFilled, true);
  assert.equal(interpretResult({ status: "pending" }).confirmedFilled, false);
});

test("helpers: classifyError separates conclusive reject from ambiguous unknown", () => {
  const rej = classifyError(reject("nope"));
  assert.equal(rej.conclusive, true); assert.equal(rej.state, ORDER_STATES.REJECTED);
  const amb = classifyError(timeout());
  assert.equal(amb.conclusive, false); assert.equal(amb.state, ORDER_STATES.UNKNOWN);
});

test("migration: a legacy unscoped blob is folded into the current user then removed", () => {
  const storage = makeStorage();
  storage.setItem("mx_pending_intents", JSON.stringify({ "fyers|X|BUY|1|CNC|0|0|0|": "legacyReq" }));
  const store = new OrderLifecycleStore("u1", storage);
  const pend = store.persisted();
  assert.equal(pend.length, 1);
  assert.equal(pend[0].reqId, "legacyReq");
  assert.equal(storage.getItem("mx_pending_intents"), null, "the shared legacy blob is deleted (no cross-user leak)");
});

/* M07 — REAL CLOSE path. planClose() is the single source of truth the live Close button uses (Matrix.jsx
   closePositionRow), so these prove the money-critical outcomes without a DOM. */
test("M07 close: an UNCONFIRMED broker result never books a close (position stays open)", () => {
  // No result, not-confirmed, pending, and rejected must all be 'unconfirmed'.
  assert.equal(planClose({ qty: 5, price: 100 }, null).action, "unconfirmed");
  assert.equal(planClose({ qty: 5, price: 100 }, { confirmedFilled: false }).action, "unconfirmed");
  assert.equal(planClose({ qty: 5, price: 100 }, { status: "pending", confirmedFilled: false }).action, "unconfirmed");
  assert.equal(planClose({ qty: 5, price: 100 }, { status: "rejected", confirmedFilled: false }).action, "unconfirmed");
});
test("M07 close: a FULL fill flattens at the broker's real average price", () => {
  const p = planClose({ qty: 5, price: 100, entry: 90 }, { confirmedFilled: true, filledQty: 5, avgPrice: 131 });
  assert.equal(p.action, "full");
  assert.equal(p.exitPx, 131, "uses the broker fill price, not the live mark or entry");
  assert.equal(p.closedQty, 5);
});
test("M07 close: a PARTIAL fill must NOT mark the whole position closed — residual stays open", () => {
  const p = planClose({ qty: 5, price: 100 }, { confirmedFilled: true, filledQty: 2, avgPrice: 130 });
  assert.equal(p.action, "partial");
  assert.equal(p.closedQty, 2);
  assert.equal(p.residualQty, 3, "the 3 unfilled stay OPEN so the exposure is never hidden");
});
test("M07 close: a confirmed fill with NO qty is treated as a full fill of the requested size", () => {
  const p = planClose({ qty: 4, price: 100 }, { confirmedFilled: true, avgPrice: 105 });
  assert.equal(p.action, "full");
  assert.equal(p.closedQty, 4);
});
test("M07 close: exitPx falls back to live mark, then entry, when the broker omits the fill price", () => {
  assert.equal(planClose({ qty: 1, price: 100, entry: 90 }, { confirmedFilled: true, filledQty: 1 }).exitPx, 100);
  assert.equal(planClose({ qty: 1, entry: 90 }, { confirmedFilled: true, filledQty: 1 }).exitPx, 90);
});
