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

/** Which brokers this server actually has credentials for. */
export async function brokerStatus(userId) {
  return get(`/api/broker/status${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
}

/** Step 1: the broker's own login page. We never see the user's password.
    userId is passed so the server resolves THIS user's bring-your-own app (BYOA) credentials. */
export async function brokerLoginUrl(broker, redirect, userId) {
  const d = await get(
    `/api/broker/login-url?broker=${broker}&redirect=${encodeURIComponent(redirect || "")}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`,
    { ...tokenHdr(), ...(userId ? { "X-User-Id": String(userId) } : {}) }
  );
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
export async function brokerSession(broker, requestToken, userId, extra) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/broker/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHdr() },
    body: JSON.stringify({ broker, requestToken, userId, extra: extra || undefined }),
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
  const r = await fetch(`${BACKEND_URL}/api/broker/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(session, userId),
      "X-Confirm-Live": "yes",
    },
    body: JSON.stringify(order),
  });
  const d = await r.json().catch(() => ({}));
  // A rejected order comes back 400 with a human reason (e.g. insufficient balance). Surface
  // that reason verbatim so the user sees WHY, not a generic HTTP code.
  if (!r.ok) { const e = new Error(d.reason || d.error || `HTTP ${r.status}`); e.status = d.status || "rejected"; e.reason = d.reason || d.error; throw e; }
  return d;
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
export async function loadAutoBuys(userId) {
  if (!BACKEND_URL) return { strategies: [], engineLive: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autobuy`, { headers: { ...tokenHdr(), "X-User-Id": String(userId || "") } });
    const d = await r.json().catch(() => ({}));
    return { strategies: Array.isArray(d.strategies) ? d.strategies : [], engineLive: !!d.engineLive, last: d.last || null };
  } catch { return { strategies: [], engineLive: false }; }
}
export async function pauseAutoBuy(userId, id, paused) {
  if (!BACKEND_URL) return;
  try { await fetch(`${BACKEND_URL}/api/autobuy/pause`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id, paused }) }); } catch { /* ignore */ }
}
export async function cancelAutoBuy(userId, id) {
  if (!BACKEND_URL) return;
  try { await fetch(`${BACKEND_URL}/api/autobuy/cancel`, { method: "POST", headers: { "Content-Type": "application/json", ...tokenHdr(), "X-User-Id": String(userId || "") }, body: JSON.stringify({ id }) }); } catch { /* ignore */ }
}
/** Admin flips the whole auto-buy engine LIVE / dry-run at runtime. */
export async function setAutoBuyLive(adminKey, on) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/autobuy/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(adminKey ? { "X-Admin-Key": adminKey } : {}) },
      body: JSON.stringify({ on: !!on }),
    });
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}
