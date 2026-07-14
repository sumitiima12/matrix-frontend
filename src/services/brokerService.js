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

const KEY = "mx_broker_session";

export function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!s || !s.sessionId) return null;
    // Broker tokens die daily; don't hold a stale handle overnight.
    if (!s.at || Date.now() - s.at > 20 * 3600 * 1000) return null;
    return s;
  } catch { return null; }
}

export function saveSession(s) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function clearSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
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
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
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
