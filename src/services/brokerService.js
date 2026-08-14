import { BACKEND_URL } from "../config";
import { getAuthToken } from "./tradeService";

/**
 * services/brokerService.js — every broker HTTP call. No fetch() outside services/.
 *
 * THE BROWSER NEVER HOLDS A BROKER TOKEN.
 *
 * It holds an opaque session id, which is meaningless anywhere except our backend
 * and is bound to this user. The real access token — the one that can place trades
 * with real money — lives only in the server process. So an XSS on this page cannot
 * steal anything that works against the broker directly.
 *
 * The api_secret never reaches the browser either: the backend performs the OAuth
 * exchange. Anything shipped to the browser is readable by anyone with devtools.
 */

const KEY = "mx_broker_sessions";

/**
 * ONE BROKER PER MARKET, all connected at once.
 *
 * This used to be a single session: connecting Schwab silently evicted FYERS, so you could
 * never have live Indian and live US data together. No broker covers every market — FYERS
 * has no US equities, Schwab has no NSE, Delta is crypto-only — so a single-session model
 * could not deliver a live portfolio.
 *
 * Sessions are now keyed BY BROKER. Each market routes to whichever connected broker
 * covers it. Storage stays session-scoped and holds only opaque session ids — never a
 * broker token; those stay on the server. (See the module header.)
 */
function loadAll() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!m || typeof m !== "object") return {};
    const out = {};
    for (const [broker, s] of Object.entries(m)) {
      // Broker tokens die daily; don't hold a stale handle overnight.
      if (s && s.sessionId && s.at && Date.now() - s.at < 24 * 3600 * 1000) out[broker] = s;
    }
    return out;
  } catch { return {}; }
}

function saveAll(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

/** Every connected broker, keyed by broker id. */
export function loadSessions() {
  return loadAll();
}

/* Per-market broker PREFERENCE — which broker the user wants driving a given market when
   more than one connected broker covers it (e.g. IND Money + Groww both cover Indian).
   { IN: "groww", US: "indmoney", ... }. */
const PREF_KEY = "mx_broker_pref";
export function loadBrokerPref() {
  try { const m = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); return (m && typeof m === "object") ? m : {}; }
  catch { return {}; }
}
export function setBrokerPref(market, brokerId) {
  if (!market) return;
  const m = loadBrokerPref();
  if (brokerId) m[market] = brokerId; else delete m[market];
  try { localStorage.setItem(PREF_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}

/** The session for ONE broker. */
export function loadSessionFor(broker) {
  return loadAll()[broker] || null;
}

/**
 * Back-compat: "the" session, for callers that predate multi-broker (e.g. the option chain,
 * which is NSE-only and therefore always wants the Indian broker). Returns the Indian
 * broker's session if there is one, else any connected session.
 */
export function loadSession() {
  const all = loadAll();
  const keys = Object.keys(all);
  if (!keys.length) return null;
  const indian = keys.find((k) => (BROKER_MARKETS[k] || []).includes("IN"));
  return all[indian || keys[0]];
}

/* M-10: options are NSE-only, so they need an IN/F&O-capable broker specifically. Returns that session or
   null — the caller shows a targeted "connect an Indian options broker" message instead of firing the NSE
   option-chain route with, say, a Delta or Schwab session (which just errors confusingly). */
export function loadIndianSession() {
  const all = loadAll();
  const indian = Object.keys(all).find((k) => (BROKER_MARKETS[k] || []).includes("IN"));
  return indian ? all[indian] : null;
}

export function saveSession(s) {
  if (!s || !s.broker || !s.sessionId) return;
  const all = loadAll();
  all[s.broker] = s;
  saveAll(all);
}

/** Disconnect ONE broker (or all, if no broker given). */
export function clearSession(broker) {
  if (!broker) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } return; }
  const all = loadAll();
  delete all[broker];
  saveAll(all);
}

/* DAILY-EXPIRY brokers: their access token dies every morning (a SEBI rule, not ours). We remember
   WHEN the user last connected each — in a store that, unlike the 24h session handle above, is NOT
   dropped overnight — so the next morning we can nudge them to reconnect for live prices instead of
   quietly sliding them onto delayed Yahoo data. Shared-login FYERS users especially need this: they
   have no app creds on the server, so nothing can auto-refresh their token for them. */
const DAILY_EXPIRY = new Set(["fyers", "zerodha", "dhan", "indmoney", "angelone", "groww"]);
const CONN_KEY = "mx_broker_connected_at";
function _connMap() { try { return JSON.parse(localStorage.getItem(CONN_KEY) || "{}") || {}; } catch { return {}; } }
export function recordConnect(broker) {
  if (!broker) return;
  try { const m = _connMap(); m[broker] = Date.now(); localStorage.setItem(CONN_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
export function forgetConnect(broker) {
  try { const m = _connMap(); delete m[broker]; localStorage.setItem(CONN_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
/* The most recent 6:00 AM boundary. A broker token connected before this has expired for today. */
function lastExpiryBoundary() {
  const six = new Date(); six.setHours(6, 0, 0, 0);
  if (Date.now() < six.getTime()) six.setDate(six.getDate() - 1);
  return six.getTime();
}
/* Daily-expiry brokers the user connected on a PRIOR trading day (token now dead) that aren't
   currently live — the ones to nudge. `activeIds` are the currently-connected broker ids. */
export function brokersNeedingReconnect(activeIds = []) {
  const m = _connMap();
  const boundary = lastExpiryBoundary();
  const active = new Set(activeIds);
  return Object.keys(m).filter((id) => DAILY_EXPIRY.has(id) && !active.has(id) && Number(m[id]) < boundary);
}

/** Which markets each broker can actually serve. */
export const BROKER_MARKETS = {
  fyers: ["IN", "Commodity"], zerodha: ["IN", "Commodity"], dhan: ["IN", "Commodity"], angelone: ["IN", "Commodity"], groww: ["IN", "Commodity"],
  indmoney: ["IN", "FNO"],   // IND Money (INDstocks API) trades Indian NSE stocks; US is prices-only
  delta: ["Crypto"], coindcx: ["Crypto"], coinswitch: ["Crypto"], binance: ["Crypto"],
  schwab: ["US"],
};

/** The connected broker that covers a given market, or null. */
export function brokerForMarket(market) {
  const all = loadAll();
  const hit = Object.keys(all).find((b) => (BROKER_MARKETS[b] || []).includes(market));
  return hit ? { broker: hit, session: all[hit] } : null;
}

/** Identify ourselves to the backend: the verified JWT (Authorization) is the SOURCE OF TRUTH
    for who we are — the server derives identity from it, not from the X-User-Id header. We still
    send the opaque broker-session id and (for back-compat) X-User-Id, but money routes now trust
    only the token. Never a broker token here. */
/** Just the Bearer token header (or nothing) — for routes that only need identity, not a session. */
function tokenHdr() { const t = (() => { try { return getAuthToken(); } catch { return null; } })(); return t ? { Authorization: `Bearer ${t}` } : {}; }
function authHeaders(session, userId) {
  const h = {};
  const tok = (() => { try { return getAuthToken(); } catch { return null; } })();
  if (tok) h.Authorization = `Bearer ${tok}`;
  if (session && session.sessionId) h["X-Broker-Session"] = session.sessionId;
  if (userId) h["X-User-Id"] = String(userId);
  return h;
}

async function get(path, headers = {}) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}${path}`, { headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(d.error || `HTTP ${r.status}`);
    err.status = r.status;      // so callers can tell a dead token (401/403) from a 502
    throw err;
  }
  return d;
}

/** Which brokers this server actually has credentials for THIS user. Identity comes from the verified
    token (R14-P2-05) — the server ignores any userId param, so we just send the auth header. */
export async function brokerStatus({ verify = false } = {}) {
  // verify=true runs a live signed check (Delta) so "Connected" reflects a working key, not just a stored one.
  return get(`/api/broker/status${verify ? "?verify=1" : ""}`, tokenHdr());
}

/** STOR-1: single first-paint bootstrap — state + notices + capabilities + app-settings + screeners +
    strategies in ONE round-trip instead of ~6 separate GETs. Server draws from its short-TTL read cache
    and ETags the body, so the browser auto-revalidates (304) an unchanged bootstrap. Every field is
    fail-soft server-side, so callers can rely on the shape. Falls back naturally: if this call fails, the
    existing per-resource fetches still work. */
export async function bootstrap() {
  return get(`/api/bootstrap`, tokenHdr());
}

/** Step 1: the broker's own login page. We never see the user's password.
    userId is passed so the server resolves THIS user's bring-your-own app (BYOA) credentials. */
export async function brokerLoginUrl(broker, redirect, userId) {
  const d = await get(
    `/api/broker/login-url?broker=${broker}&redirect=${encodeURIComponent(redirect || "")}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`,
    { ...tokenHdr(), ...(userId ? { "X-User-Id": String(userId) } : {}) }
  );
  // R7-P1-01: remember the EFFECTIVE redirect the SERVER used (canonical FYERS_REDIRECT_URI when it pins
  // one), keyed by the state nonce, so we echo the identical value at session completion — not the browser
  // URL we requested, which the server may have overridden. R7-P1-02: also remember the initiating broker
  // keyed by state, so a callback (e.g. Schwab's ?code=) resolves to the right broker, not a guess.
  try {
    if (d.state) {
      const effRedirect = (d.redirect != null ? d.redirect : redirect);
      if (effRedirect) sessionStorage.setItem("mx_oauth_rd_" + d.state, effRedirect);
      sessionStorage.setItem("mx_oauth_bk_" + d.state, broker);
    }
  } catch { /* ignore */ }
  return d.url;
}

/** BRING-YOUR-OWN-APP: save the user's own API app credentials (app id + secret + optional
    PIN for daily auto-refresh) on the server, encrypted. Returns { ok, staticIp } so the UI
    can show which IP to whitelist. Must be authed — the secret is bound to the verified user. */
export async function saveBrokerAppCreds(broker, appId, secret, pin) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/broker/app-creds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHdr() },
    body: JSON.stringify({ broker, appId, secret, pin: pin || undefined }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

/** Setup info the user needs to register their own broker app: the static IP to whitelist. */
export async function brokerConnectInfo() {
  try { return await get("/api/broker/connect-info"); } catch { return {}; }
}

/** Step 2: the SERVER exchanges the request token and keeps the access token.
    `extra` carries bring-your-own credentials (Dhan/IND Money token, Angel One login). */
export async function brokerSession(broker, requestToken, userId, extra, state, redirect) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/broker/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHdr() },
    // R6-P1-02: echo the redirect used at login-url so the server can verify the OAuth state is bound to it.
    body: JSON.stringify({ broker, requestToken, userId, extra: extra || undefined, state: state || undefined, redirect: redirect || undefined }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return { broker, sessionId: d.sessionId, user: d.user || null, at: Date.now() };
}

/** Re-establish a session from the server's stored creds (no user reconnect needed).
    Used when a session id is dead (server restarted, or the mobile browser reopened). */
export async function resumeBroker(broker, userId) {
  if (!BACKEND_URL || !broker) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/broker/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") },
      body: JSON.stringify({ broker }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.sessionId) return null;
    const s = { broker, sessionId: d.sessionId, at: Date.now() };
    saveSession(s);
    return s;
  } catch { return null; }
}

/** REAL-TIME quotes. Symbols must already be in the broker's own format. */
export async function brokerQuotes(session, userId, brokerSymbols) {
  if (!brokerSymbols.length) return {};
  const d = await get(
    `/api/broker/quotes?symbols=${encodeURIComponent(brokerSymbols.join(","))}`,
    authHeaders(session, userId)
  );
  return d.quotes || {};
}

/** Forget this broker session, server-side too. */
export async function brokerLogout(session, userId) {
  if (!BACKEND_URL || !session) return;
  try {
    await fetch(`${BACKEND_URL}/api/broker/logout`, { method: "POST", headers: authHeaders(session, userId) });
  } catch { /* local session is cleared regardless */ }
}

/** KILL SWITCH — is this account's NEW-real-entry pause on? (Protective exits always keep running.) */
export async function getEntryHalt() {
  if (!BACKEND_URL) return false;
  try { const r = await fetch(`${BACKEND_URL}/api/automation/entry-halt`, { headers: { ...tokenHdr() } }); const d = await r.json().catch(() => ({})); return !!d.halted; }
  catch { return false; }
}
/** Pause (halt) or resume NEW real entries for this account. Server-side, survives restart. */
export async function setEntryHalt(halt) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/automation/entry-halt`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr() }, body: JSON.stringify({ halt: !!halt }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return !!d.halted;
}

/**
 * A REAL order, with real money.
 *
 * Deliberately awkward to reach: the caller must pass confirmLive, which becomes an
 * explicit header, AND the server must have BROKER_TRADING_ENABLED=true. Two locks.
 * Everything else in this app is paper; this one function is not, and it should not
 * be possible to arrive here by accident.
 */
export async function brokerPlaceOrder(session, userId, order, confirmLive) {
  if (!confirmLive) throw new Error("Live order not confirmed.");
  if (!BACKEND_URL) throw new Error("no-backend");
  /* R19-P1-02: ONE user order action must have exactly ONE durable identity. The caller mints a random
     action id when the order intent is created (the confirm sheet / buy handler) and passes it here as
     clientRequestId, reusing it for every retry of that same action until a terminal outcome — so a lost
     response + retry replays the one result instead of placing a second real order. If none is supplied we
     fall back to a fresh cryptographically-random UUID per call (never a time-bucketed hash, which merged two
     intentional orders in a window and changed identity across the boundary). Submit handlers are serialized
     upstream so a double-tap can't fire two calls. */
  const idemKey = order.clientRequestId ||
    (globalThis.crypto && globalThis.crypto.randomUUID ? `mx_${globalThis.crypto.randomUUID()}` : `mx_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);
  const r = await fetch(`${BACKEND_URL}/api/broker/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(session, userId),
      "X-Confirm-Live": "yes",
      "X-Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ ...order, clientRequestId: idemKey }),
  });
  const d = await r.json().catch(() => ({}));
  // A rejected order comes back 400 with a human reason (e.g. insufficient balance). Surface
  // that reason verbatim so the user sees WHY, not a generic HTTP code.
  if (!r.ok) {
    const e = new Error(d.reason || d.error || `HTTP ${r.status}`);
    e.status = d.status || "rejected"; e.reason = d.reason || d.error; e.httpStatus = r.status;
    /* R21-P1-01: mark whether the broker outcome is KNOWN. A 400/422 with a reason is a CONCLUSIVE rejection
       (nothing executed → safe to retry with a new id). A 409 (idempotency in-flight/unknown), 408/425/429,
       423 (risk-lock) or 5xx is AMBIGUOUS — the order may have reached the broker — so the caller must keep
       the SAME idempotency id and prompt the user to reconcile, never silently fire a new order. */
    e.conclusiveReject = (r.status === 400 || r.status === 422) && !!(d.reason || d.error) && d.status !== "unknown";
    e.ambiguous = !e.conclusiveReject;
    throw e;
  }
  return d;
}

/* INC-3 / ARCH-4: resolve an AMBIGUOUS order by asking the server what became of its idempotency key.
   Returns { status: none|in_flight|unknown|succeeded|rejected, ageMs, response? }. Used to clear a persisted
   "outcome unknown" intent once the server knows the terminal outcome — without ever re-submitting the order. */
export async function brokerIntentStatus(userId, key) {
  if (!BACKEND_URL || !key) return { status: "none" };
  try {
    const r = await fetch(`${BACKEND_URL}/api/order/intent-status?key=${encodeURIComponent(key)}`, { headers: { ...tokenHdr(), "X-User-Id": String(userId || "") } });
    const d = await r.json().catch(() => ({}));
    return r.ok ? d : { status: "none" };
  } catch { return { status: "none" }; }
}

/** The user's REAL holdings and cash, from the broker. Read-only. */
export async function brokerPortfolio(session, userId) {
  return get("/api/broker/portfolio", authHeaders(session, userId));
}

/** Positions the server-side auto-exit engine is watching for this user. */
export async function loadAutoExits(userId) {
  if (!BACKEND_URL) return { positions: [], engineLive: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autoexit`, { headers: { ...tokenHdr(), "X-User-Id": String(userId || "") } });
    const d = await r.json().catch(() => ({}));
    return { positions: Array.isArray(d.positions) ? d.positions : [], engineLive: !!d.engineLive, last: d.last || null };
  } catch { return { positions: [], engineLive: false }; }
}

/** Arm a stop-loss / take-profit / trailing-stop on an EXISTING real holding. The server
    registers a managed position and the exit engine sells (reduce-only) when a level hits. */
export async function registerAutoExit(userId, payload) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/autoexit/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") },
    body: JSON.stringify(payload || {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || "Couldn't arm the exit");
  return d;
}

/** Stop the engine watching a position (does NOT touch the position at the broker). */
export async function cancelAutoExit(userId, id) {
  if (!BACKEND_URL) return;
  try {
    await fetch(`${BACKEND_URL}/api/autoexit/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") },
      body: JSON.stringify({ id }),
    });
  } catch { /* best-effort */ }
}

/* ── Real-money AUTO-BUY (opt-in per strategy). Arms the server engine to place a real
   entry when the strategy fires, then hand the exit to the auto-exit engine. ── */
export async function registerAutoBuy(session, userId, payload) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/autobuy/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(session, userId) },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}
/* R31-C03: the SERVER owns the broker capability matrix (which real operations are certified per broker). The UI must
   READ it — never hard-code broker ids — so it can't offer Auto Buy on a broker the server will refuse. Fail closed:
   on any error return an empty matrix so brokerCap() is false everywhere (block, don't guess). */
export async function loadBrokerCapabilities() {
  if (!BACKEND_URL) return { version: null, capabilities: {}, keys: [] };
  try {
    const r = await fetch(`${BACKEND_URL}/api/broker/capabilities`);
    const d = await r.json().catch(() => ({}));
    return { version: d.version || null, capabilities: d.capabilities || {}, keys: Array.isArray(d.keys) ? d.keys : [], orderTypes: d.orderTypes || {} };
  } catch { return { version: null, capabilities: {}, keys: [], orderTypes: {} }; }
}
/* Does the loaded matrix certify `capability` for `broker`? Unknown ⇒ false (fail closed). */
export function brokerCapOf(caps, broker, capability) {
  const b = caps && caps.capabilities && caps.capabilities[String(broker || "").toLowerCase()];
  return !!(b && b[capability] === true);
}
/* R42-P2-04: the canonical ORDER TYPES the server will accept for `broker`, so the UI renders only certified choices.
   Unknown/not-loaded ⇒ null (caller shows its default full set; the backend still enforces). */
export function orderTypesOf(caps, broker) {
  const ot = caps && caps.orderTypes && caps.orderTypes[String(broker || "").toLowerCase()];
  return Array.isArray(ot) && ot.length ? ot : null;
}
export async function loadAutoBuys(userId) {
  if (!BACKEND_URL) return { strategies: [], engineLive: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autobuy`, { headers: { ...tokenHdr(), "X-User-Id": String(userId || "") } });
    const d = await r.json().catch(() => ({}));
    return { strategies: Array.isArray(d.strategies) ? d.strategies : [], engineLive: !!d.engineLive, last: d.last || null };
  } catch { return { strategies: [], engineLive: false }; }
}
/* Resume returns the server's decision. Resuming a strategy under unknown-order review can be BLOCKED
   (HTTP 409 { needsReview, reason }) until the user declares the outcome: pass resolution:"filled" to
   ADOPT the real broker position (no new entry) or resolution:"nofill" to clear after confirming nothing
   filled. Returns { ok, needsReview?, reason?, adopted?, linked?, note? }. */
export async function pauseAutoBuy(userId, id, paused, resolution = null) {
  if (!BACKEND_URL) return { ok: true };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autobuy/pause`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id, paused, resolution }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok !== false, status: r.status, ...d };
  } catch { return { ok: false }; }
}
export async function cancelAutoBuy(userId, id) {
  if (!BACKEND_URL) return;
  try { await fetch(`${BACKEND_URL}/api/autobuy/cancel`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id }) }); } catch { /* ignore */ }
}
/** Close a live position NOW — reduce-only market sell that flattens it and stops the strategy. */
export async function closeAutoBuy(userId, id) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/autobuy/close`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || "Couldn't close the position");
  return d;
}
/** Reconcile the real journal against Delta — drops phantom OPEN real crypto records Delta doesn't hold.
    Returns { removed, heldSymbols, droppedSymbols }. Display-only; never touches real holdings. */
export async function reconcileRealTrades(userId, { apply = false, confirmIds = [] } = {}) {
  if (!BACKEND_URL) throw new Error("no-backend");
  // apply:false → PREVIEW (wouldClose / unknownBroker, no mutation). apply:true → persist: close Delta-proven
  // phantoms, plus any broker-unknown rows the caller explicitly confirmed via confirmIds. The old call sent {} so
  // it was always preview-only and never actually reconciled — that's why the phantom rows survived "reconcile".
  const r = await fetch(`${BACKEND_URL}/api/trades/reconcile-real`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ apply: apply === true, confirmIds: Array.isArray(confirmIds) ? confirmIds : [] }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || "Couldn't reconcile with Delta");
  return d;
}
/** Update a live strategy's SL/TP — persisted to the strategy and its open managed position. */
export async function updateAutoBuy(userId, id, { sl, tp } = {}) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/autobuy/update`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id, sl, tp }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || "Couldn't update SL/TP");
  return d;
}
/** Admin flips the whole auto-buy engine LIVE / dry-run at runtime. */
export async function setAutoBuyLive(adminKey, on) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autobuy/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tokenHdr(), ...(adminKey ? { "X-Admin-Key": adminKey } : {}) },
      body: JSON.stringify({ on: !!on }),
    });
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}
