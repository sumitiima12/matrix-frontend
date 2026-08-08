/* pushService.js — browser Web Push enrollment for MatrixOne.
   Talks to the backend (/api/push/*), registers the service worker, and manages the PushSubscription +
   the user's per-category notification prefs. All functions are safe to call on unsupported browsers
   (they resolve to a disabled/why state instead of throwing). */

import { BACKEND_URL } from "../config";
import { getAuthToken } from "./tradeService";

/* Category keys the backend understands. `none` is a hard opt-out; `all` receives everything. */
export const PUSH_CATEGORIES = [
  { key: "all", label: "All notifications" },
  { key: "trades", label: "Trades & fills" },
  { key: "broker", label: "Broker & connection" },
  { key: "alerts", label: "Price & strategy alerts" },
  { key: "other", label: "Other updates" },
];
export const DEFAULT_PREFS = { all: true, trades: true, broker: true, alerts: true, other: true, none: false };

const PREFS_KEY = "mx_push_prefs";
export function loadLocalPrefs() {
  try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) || "null"); return v && typeof v === "object" ? v : { ...DEFAULT_PREFS }; }
  catch { return { ...DEFAULT_PREFS }; }
}
export function saveLocalPrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  try { const t = getAuthToken(); if (t) h.Authorization = `Bearer ${t}`; } catch { /* no token */ }
  return h;
}

/* Is push even possible in this browser/context? iOS only exposes it inside an installed PWA. */
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function isStandalone() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}

/* Server config: is push configured (VAPID keys present) + the public key to subscribe with. */
export async function fetchPushConfig() {
  try {
    const r = await fetch(`${BACKEND_URL}/api/push/config`);
    if (!r.ok) return { enabled: false, publicKey: null };
    return await r.json();
  } catch { return { enabled: false, publicKey: null }; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

/* Full enable flow: config → SW → permission → subscribe → send to backend. Returns { ok, reason? }. */
export async function enablePush(prefs) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const cfg = await fetchPushConfig();
  if (!cfg.enabled || !cfg.publicKey) return { ok: false, reason: "server-disabled" };
  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-failed" };
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    });
  }
  const usePrefs = prefs || loadLocalPrefs();
  const r = await fetch(`${BACKEND_URL}/api/push/subscribe`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ subscription: sub.toJSON(), prefs: usePrefs }),
  });
  if (!r.ok) return { ok: false, reason: "subscribe-failed" };
  saveLocalPrefs(usePrefs);
  return { ok: true };
}

/* Turn push off on this device (unsubscribe locally + tell the backend to prune it). */
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await fetch(`${BACKEND_URL}/api/push/unsubscribe`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    return { ok: true };
  } catch { return { ok: false }; }
}

/* Push updated category prefs to the backend (applies across all this user's devices). */
export async function updatePushPrefs(prefs) {
  saveLocalPrefs(prefs);
  try {
    const r = await fetch(`${BACKEND_URL}/api/push/prefs`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ prefs }) });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

export async function sendTestPush() {
  try { const r = await fetch(`${BACKEND_URL}/api/push/test`, { method: "POST", headers: authHeaders() }); return { ok: r.ok }; }
  catch { return { ok: false }; }
}

/* Current enrollment state on this device (for the toggle's initial value). */
export async function pushState() {
  if (!pushSupported()) return { supported: false, subscribed: false, permission: "default" };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && (await reg.pushManager.getSubscription()); subscribed = !!sub; } catch { /* ignore */ }
  return { supported: true, subscribed, permission: Notification.permission };
}
