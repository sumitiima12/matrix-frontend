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

export async function register(phone, pin, name, secQuestion, secAnswer, username, referralCode, email) {
  const d = await post("/api/register", { phone, pin, name, secQuestion, secAnswer, username, referralCode, email }, false);
  if (d && d.token) setAuthToken(d.token);
  return d;
}

/** Is a desired user ID available? { valid, available } */
export async function checkUsername(u) {
  if (!BACKEND_URL) return { valid: true, available: true };
  try {
    const r = await fetch(`${BACKEND_URL}/api/username/available?u=${encodeURIComponent(u)}`);
    return r.json().catch(() => ({ valid: false, available: false }));
  } catch { return { valid: false, available: false }; }
}

/** Set/change the signed-in user's handle (mandate flow for existing accounts). */
export async function setUsername(username) {
  if (!BACKEND_URL) return { ok: false, error: "No backend connected." };
  try { return await post("/api/username", { username }); }
  catch { return { ok: false, error: "Network error — please try again." }; }
}

/** Set (or clear) the user's contact email. */
export async function setEmail(email) {
  if (!BACKEND_URL) return { ok: false, error: "No backend connected." };
  try { return await post("/api/email", { email }); }
  catch { return { ok: false, error: "Network error — please try again." }; }
}

/** Public strategies — shared across users. */
export async function listPublicStrategies({ symbol = "", by = "" } = {}) {
  if (!BACKEND_URL) return [];
  try {
    const q = new URLSearchParams();
    if (symbol) q.set("symbol", symbol);
    if (by) q.set("by", by);
    const r = await fetch(`${BACKEND_URL}/api/public-strategies?${q.toString()}`);
    if (!r.ok) return [];
    return (await r.json()).strategies || [];
  } catch { return []; }
}
export async function publishStrategy(strategy) {
  return post("/api/public-strategies", { strategy });
}
export async function unpublishStrategy(id) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/public-strategies/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
    handle401(r.status);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/** Community ideas — anyone can post; everyone can browse. */
export async function listIdeas({ symbol = "", by = "", adminKey = "" } = {}) {
  if (!BACKEND_URL) return [];
  try {
    const q = new URLSearchParams();
    if (symbol) q.set("symbol", symbol);
    if (by) q.set("by", by);
    // With the admin key, the server returns pending ideas too (so the admin can review them).
    const headers = authHeaders(adminKey ? { "X-Admin-Key": adminKey } : {});
    const r = await fetch(`${BACKEND_URL}/api/ideas?${q.toString()}`, { headers });
    if (!r.ok) return [];
    return (await r.json()).ideas || [];
  } catch { return []; }
}
export async function postIdea(idea) {
  return post("/api/ideas", idea);
}
/** Admin approves or rejects a pending idea. */
export async function reviewIdea(id, status, adminKey) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/ideas/${encodeURIComponent(id)}/review`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", ...(adminKey ? { "X-Admin-Key": adminKey } : {}) }),
      body: JSON.stringify({ status }),
    });
    handle401(r.status);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}
export async function deleteIdea(id) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/ideas/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
    handle401(r.status);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/* Admin: accounts awaiting approval, and approve/reject one. */
export async function adminPendingUsers(adminKey) {
  if (!BACKEND_URL) return { users: [] };
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/pending-users`, { headers: authHeaders(adminKey ? { "X-Admin-Key": adminKey } : {}) });
    const d = await r.json().catch(() => ({}));
    return { users: Array.isArray(d.users) ? d.users : [] };
  } catch { return { users: [] }; }
}
export async function adminApproveUser(phone, approved, adminKey) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/approve`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", ...(adminKey ? { "X-Admin-Key": adminKey } : {}) }),
      body: JSON.stringify({ phone, approved }),
    });
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/* Admin: permanently delete any account by phone. */
export async function adminDeleteUser(phone, adminKey) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/delete-user`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", ...(adminKey ? { "X-Admin-Key": adminKey } : {}) }),
      body: JSON.stringify({ phone }),
    });
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/* Permanently delete the signed-in user's own account and all their data. */
export async function deleteAccount() {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/account/delete`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }) });
    handle401(r.status);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/* ---- Global admin-controlled app settings (Real-mode + broker-connect gates) ---- */
const DEFAULT_SETTINGS = { allowRealMode: { IN: false, US: false, Crypto: false, Commodity: false }, allowBrokerConnect: { IN: false, US: false, Crypto: false, Commodity: false }, allowVirtual: { IN: false, Global: false }, showIndianWithoutBroker: false };
export async function getAppSettings() {
  if (!BACKEND_URL) return DEFAULT_SETTINGS;
  try {
    const r = await fetch(`${BACKEND_URL}/api/app-settings`);
    const d = await r.json().catch(() => ({}));
    return d.settings || DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
export async function saveAppSettings(settings, userId, adminKey) {
  if (!BACKEND_URL) return { ok: false };
  try {
    const r = await fetch(`${BACKEND_URL}/api/app-settings`, {
      method: "POST",
      // isAdmin() on the server needs BOTH X-User-Id and X-Admin-Key — sending only the key 403s
      // and the setting silently reverts on reload.
      headers: authHeaders({ "Content-Type": "application/json", "X-User-Id": String(userId || ""), ...(adminKey ? { "X-Admin-Key": adminKey } : {}) }),
      body: JSON.stringify({ settings }),
    });
    handle401(r.status);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false }; }
}

/** Forgot-PIN step 1: fetch the user's security question. */
export async function forgotQuestion(phone) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/forgot/question?phone=${encodeURIComponent(phone)}`);
    return r.json().catch(() => ({ ok: false }));
  } catch { return { ok: false, error: "network" }; }
}

/** Forgot-PIN step 2: submit the answer + new PIN. On success, returns a token (logs in). */
export async function forgotReset(phone, answer, newPin) {
  const d = await post("/api/forgot/reset", { phone, answer, newPin }, false);
  if (d && d.token) setAuthToken(d.token);
  return d;
}

export async function login(phone, pin) {
  const d = await post("/api/login", { phone, pin }, false);
  if (d && d.token) setAuthToken(d.token);
  return d;
}

export function logout() { setAuthToken(null); }

/** Change the login PIN. Needs the current PIN; identity comes from the auth token server-side. */
export async function changePin(currentPin, newPin) {
  const d = await post("/api/pin/change", { currentPin, newPin });
  if (!d || d.error || !d.ok) throw new Error((d && d.error) || "Couldn't change your PIN");
  return d;
}

/** Verify the login PIN (step-up for entering Real mode). Returns true/false. */
export async function verifyPin(pin) {
  const d = await post("/api/pin/verify", { pin });
  if (!d || d.error) throw new Error((d && d.error) || "Couldn't verify your PIN");
  return !!d.ok;
}

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

/** Get the logged-in user's security question status. */
export async function getMySecurityQuestion() {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/security-question`, { headers: authHeaders() });
    handle401(r.status);
    if (!r.ok) return null;
    return r.json().catch(() => null);
  } catch { return null; }
}

/** Set/change the logged-in user's security question + answer. */
export async function setMySecurityQuestion(question, answer) {
  return post("/api/security-question", { question, answer });
}
