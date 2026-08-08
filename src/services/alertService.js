/**
 * services/alertService.js — UX-3 price alerts. CRUD for a user's own price alerts. Every call carries the
 * auth token; the backend scopes to the verified identity. Alerts fire as push notifications from the server,
 * so the user needs notifications enabled for delivery (the create UI nudges that).
 */
import { BACKEND_URL } from "../config";
import { getAuthToken } from "./tradeService";

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  try { const t = getAuthToken(); if (t) h.Authorization = `Bearer ${t}`; } catch { /* no token */ }
  return h;
}

export async function listAlerts() {
  if (!BACKEND_URL) return { alerts: [], types: [] };
  const r = await fetch(`${BACKEND_URL}/api/alerts`, { headers: authHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `alerts ${r.status}`);
  return { alerts: d.alerts || [], types: d.types || [] };
}

export async function createAlert({ symbol, market, type, threshold, note }) {
  const r = await fetch(`${BACKEND_URL}/api/alerts`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ symbol, market, type, threshold, note }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `alerts ${r.status}`);
  return d.alert;
}

export async function toggleAlert(id, active) {
  const r = await fetch(`${BACKEND_URL}/api/alerts/${encodeURIComponent(id)}/toggle`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ active }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `alerts ${r.status}`); }
  return true;
}

export async function deleteAlert(id) {
  const r = await fetch(`${BACKEND_URL}/api/alerts/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `alerts ${r.status}`); }
  return true;
}
