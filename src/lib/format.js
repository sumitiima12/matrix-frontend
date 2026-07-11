/**
 * lib/format.js — pure formatting & small utilities. No side effects, no I/O.
 */
export const CUR = { IN: "₹", US: "$", Crypto: "$", Commodity: "$", FNO: "₹" };
export const MKT_LABEL = { IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", Commodity: "🪙 Commodity", FNO: "⚡ F&O" };

export function fmt(n, market = "IN") {
  const c = CUR[market] || "₹";
  if (n == null || isNaN(n)) return "—";
  const a = Math.abs(n);
  const digits = a === 0 ? 2 : a < 0.001 ? 8 : a < 1 ? 4 : 2;
  const grouped = Number(n).toLocaleString(market === "IN" ? "en-IN" : "en-US", { maximumFractionDigits: digits });
  return c + grouped;
}

export function compact(n) {
  if (n == null || isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function hash(str) {
  let h = 0;
  const v = String(str);
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Seeded RNG, warmed up (a raw Lehmer LCG's first draws correlate with the seed). */
export function lcg(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 8; i++) next();
  return next;
}

export const DAY = Math.floor(Date.now() / 864e5);

/** Relative time from an ISO string or epoch ms. */
export function timeAgo(iso) {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (isNaN(t)) return String(iso);
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* Guarded localStorage — never throws if storage is unavailable. */
export function lsGet(k, fb) {
  try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
}
export function lsSet(k, v) {
  try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
export function getUserId() {
  let id = lsGet("mx_uid", null);
  if (!id) { id = "u_" + Math.random().toString(36).slice(2, 10); lsSet("mx_uid", id); }
  return id;
}
