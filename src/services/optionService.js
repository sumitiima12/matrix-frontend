import { BACKEND_URL } from "../config";
import { loadSession } from "./brokerService";

/**
 * The option chain, from the broker.
 *
 * There is no fallback. If the broker cannot give us the real contract list, option
 * trading is unavailable and the UI says so — because the only alternative is to
 * construct symbols from a guessed expiry calendar and a guessed strike interval, and
 * a wrong option symbol does not get rejected, it gets FILLED on the wrong contract.
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

  return d;   // { underlying, spot, expiries, contracts, lot }
}
