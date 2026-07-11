/**
 * services/tradeService.js — trade persistence, auth and per-user state.
 * Pure transport: no wallet maths, no risk checks, no UI concerns.
 */
import { BACKEND_URL } from "../config";

const post = async (path, body) => {
  if (!BACKEND_URL) return null;
  const r = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: false, error: `bad response from ${path}` }));
};

/** Upsert a trade (used on open, on risk-order change, and on close). */
export async function saveTrade(userId, trade) {
  try { return await post("/api/trades", { userId, trade }); } catch { return null; }
}

export async function listTrades(userId, from, to) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/trades?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`);
    if (!r.ok) return null;
    return (await r.json()).trades || [];
  } catch { return null; }
}

export async function register(phone, pin, name) {
  return post("/api/register", { phone, pin, name });
}

export async function login(phone, pin) {
  return post("/api/login", { phone, pin });
}

export async function saveState(userId, state) {
  return post("/api/state", { userId, state });
}

export async function loadState(userId) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/state?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) return null;
    return (await r.json()).state || null;
  } catch { return null; }
}
