/**
 * services/adminService.js — admin-only API calls.
 *
 * Every call carries the admin's userId AND the admin key. The backend requires both;
 * neither alone grants access. The key is entered by the admin at runtime and kept only
 * in memory for the session — never stored.
 */
import { BACKEND_URL } from "../config";

function headers(userId, key) {
  return { "Content-Type": "application/json", "X-User-Id": userId || "", "X-Admin-Key": key || "" };
}

/** Am I an admin with this key? Used to decide whether to show the panel. */
export async function adminCheck(userId, key) {
  if (!BACKEND_URL) return false;
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/check`, { headers: headers(userId, key) });
    const d = await r.json().catch(() => ({}));
    return !!d.admin;
  } catch { return false; }
}

/** Visibility-only: is this userId an admin candidate? No key needed — only decides whether
 *  to show the admin button. Grants no access. */
export async function adminIsAdminUser(userId) {
  if (!BACKEND_URL || !userId) return false;
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/is-admin-user`, { headers: { "X-User-Id": userId } });
    const d = await r.json().catch(() => ({}));
    return !!d.adminUser;
  } catch { return false; }
}

/** List all users. */
export async function adminListUsers(userId, key) {
  const r = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: headers(userId, key) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `admin ${r.status}`);
  return d.users || [];
}

/** Full detail on one user: profile, state (strategies + onboarding), trades. */
export async function adminGetUser(userId, key, phone) {
  const r = await fetch(`${BACKEND_URL}/api/admin/user?phone=${encodeURIComponent(phone)}`, { headers: headers(userId, key) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `admin ${r.status}`);
  return d;
}

/** Block or unblock a user. */
export async function adminSetBlocked(userId, key, phone, blocked) {
  const r = await fetch(`${BACKEND_URL}/api/admin/block`, {
    method: "POST",
    headers: headers(userId, key),
    body: JSON.stringify({ phone, blocked }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `admin ${r.status}`);
  return d;
}

/** Admin backstop: reset a user's PIN to a new value. */
export async function adminResetPin(userId, key, phone, newPin) {
  const r = await fetch(`${BACKEND_URL}/api/admin/reset-pin`, {
    method: "POST",
    headers: headers(userId, key),
    body: JSON.stringify({ phone, newPin }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `admin ${r.status}`);
  return d;
}
