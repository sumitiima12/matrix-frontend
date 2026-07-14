import { BACKEND_URL } from "../config";
import { loadSession } from "./brokerService";

/**
 * The option chain, from the broker. There is no fallback.
 *
 * If the broker can't give us the real contract list, options are unavailable — because
 * the only alternative is constructing symbols from a guessed expiry calendar and a
 * guessed strike interval, and a wrong option symbol gets filled, not rejected.
 */
export async function fetchOptionChain(underlying, userId) {
  if (!BACKEND_URL) throw new Error("Backend not configured");
  const s = loadSession();
  if (!s || !s.sessionId) throw new Error("Connect a broker to trade options");

  const r = await fetch(
    `${BACKEND_URL}/api/broker/optionchain?underlying=${encodeURIComponent(underlying)}`,
    { headers: { "X-Broker-Session": s.sessionId, "X-User-Id": String(userId || "") } }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Could not load the option chain (${r.status})`);
  if (!d.contracts || !d.contracts.length) throw new Error("Broker returned no option contracts");
  return d;
}
