/**
 * services/tradeService.js — trade persistence, auth and per-user state.
 * Pure transport: no wallet maths, no risk checks, no UI concerns.
 *
 * Auth: login/register return a signed token. We hold it here (and mirror it to
 * localStorage so it survives reloads) and attach it as `Authorization: Bearer <token>`
 * on every data call. The server derives the userId from the token — the userId is no
 * longer trusted from the request body/query.
 */
import { BACKEND_URL } from "../config";

const TOKEN_KEY = "mx_token";

let authToken = null;
try { authToken = (typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || null; } catch { /* ignore */ }

export function setAuthToken(token) {
  authToken = token || null;
  try {
    if (typeof localStorage !== "undefined") {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* ignore */ }
}
export function getAuthToken() { return authToken; }

/* Optional hook: when a data call comes back 401, the app can force a re-login. */
let onUnauthorized = null;
export function setOnUnauthorized(fn) { onUnauthorized = fn; }
function handle401(status) { if (status === 401 && typeof onUnauthorized === "function") onUnauthorized(); }

function authHeaders(extra) {
  const h = { ...(extra || {}) };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

const post = async (path, body, auth = true) => {
  if (!BACKEND_URL) return null;
  const r = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (auth) handle401(r.status);
  return r.json().catch(() => ({ ok: false, error: `bad response from ${path}` }));
};

/** Upsert a trade (used on open, on risk-order change, and on close). */
export async function saveTrade(userId, trade) {
  // userId is ignored by the server now (derived from the token) but kept in the
  // signature so callers don't all need changing.
  try { return await post("/api/trades", { trade }); } catch { return null; }
}

export async function listTrades(userId, from, to) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/trades?from=${from || 0}&to=${to || Date.now()}`, {
      headers: authHeaders(),
    });
    handle401(r.status);
    if (!r.ok) return null;
    return (await r.json()).trades || [];
  } catch { return null; }
}

export async function register(phone, pin, name) {
  const d = await post("/api/register", { phone, pin, name }, false);
  if (d && d.token) setAuthToken(d.token);
  return d;
}

export async function login(phone, pin) {
  const d = await post("/api/login", { phone, pin }, false);
  if (d && d.token) setAuthToken(d.token);
  return d;
}

export function logout() { setAuthToken(null); }

export async function saveState(userId, state) {
  return post("/api/state", { state });
}

export async function loadState(userId) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/state`, { headers: authHeaders() });
    handle401(r.status);
    if (!r.ok) return null;
    return (await r.json()).state || null;
  } catch { return null; }
}
