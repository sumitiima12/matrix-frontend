import { BACKEND_URL } from "../config";

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
    const m = JSON.parse(sessionStorage.getItem(KEY) || "{}");
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
  try { sessionStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

/** Every connected broker, keyed by broker id. */
export function loadSessions() {
  return loadAll();
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
  if (!broker) { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } return; }
  const all = loadAll();
  delete all[broker];
  saveAll(all);
}

/** Which markets each broker can actually serve. */
export const BROKER_MARKETS = {
  fyers: ["IN"], zerodha: ["IN"], dhan: ["IN"], angelone: ["IN"], groww: ["IN"],
  delta: ["Crypto"],
  schwab: ["US"],
};

/** The connected broker that covers a given market, or null. */
export function brokerForMarket(market) {
  const all = loadAll();
  const hit = Object.keys(all).find((b) => (BROKER_MARKETS[b] || []).includes(market));
  return hit ? { broker: hit, session: all[hit] } : null;
}

/** Identify ourselves to the backend: opaque id + who we are. Never a broker token. */
function authHeaders(session, userId) {
  if (!session || !session.sessionId) return {};
  return { "X-Broker-Session": session.sessionId, "X-User-Id": String(userId || "") };
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
export async function brokerStatus() {
  return get("/api/broker/status");
}

/** Step 1: the broker's own login page. We never see the user's password. */
export async function brokerLoginUrl(broker, redirect) {
  const d = await get(`/api/broker/login-url?broker=${broker}&redirect=${encodeURIComponent(redirect || "")}`);
  return d.url;
}

/** Step 2: the SERVER exchanges the request token and keeps the access token. */
export async function brokerSession(broker, requestToken, userId) {
  if (!BACKEND_URL) throw new Error("no-backend");
  const r = await fetch(`${BACKEND_URL}/api/broker/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ broker, requestToken, userId }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return { broker, sessionId: d.sessionId, user: d.user || null, at: Date.now() };
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
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

/** The user's REAL holdings and cash, from the broker. Read-only. */
export async function brokerPortfolio(session, userId) {
  return get("/api/broker/portfolio", authHeaders(session, userId));
}
