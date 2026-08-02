import { BACKEND_URL } from "../config";
import { loadIndianSession } from "./brokerService";
import { getAuthToken } from "./tradeService";

/**
 * The option chain, from the broker. There is no fallback.
 *
 * If the broker can't give us the real contract list, options are unavailable — because
 * the only alternative is constructing symbols from a guessed expiry calendar and a
 * guessed strike interval, and a wrong option symbol gets filled, not rejected.
 */
export async function fetchOptionChain(underlying, userId) {
  if (!BACKEND_URL) throw new Error("Backend not configured");
  // M-10: options need an Indian (NSE/F&O) broker specifically — not just any connected broker.
  const s = loadIndianSession();
  if (!s || !s.sessionId) throw new Error("Connect an Indian options broker (e.g. Zerodha, FYERS) to trade options.");

  /* C-01: the route is protected by requireAuth, so it MUST carry the verified bearer token — the opaque
     broker session + X-User-Id alone return 401 for a normally signed-in user (the whole options chain
     appeared broken). Send Authorization alongside the broker-session headers. */
  const headers = { "X-Broker-Session": s.sessionId, "X-User-Id": String(userId || "") };
  try { const t = getAuthToken(); if (t) headers.Authorization = `Bearer ${t}`; } catch { /* no token */ }
  const r = await fetch(
    `${BACKEND_URL}/api/broker/optionchain?underlying=${encodeURIComponent(underlying)}`,
    { headers }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Could not load the option chain (${r.status})`);
  if (!d.contracts || !d.contracts.length) throw new Error("Broker returned no option contracts");
  return d;
}
