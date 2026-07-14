/**
 * domain/brokers.js — the broker catalogue, and an honest account of what each
 * one can actually do.
 *
 * Some of the brokers people ask for do not have a usable public API. Listing them
 * as "coming soon" would be a promise we cannot keep, and shipping a half-adapter
 * that silently returns nothing is worse. So each entry states plainly what it
 * supports and, where it supports nothing, WHY.
 *
 *   status: "ready"     -> adapter implemented, endpoints documented by the broker
 *   status: "partial"   -> auth works, but quotes need an instrument-master file
 *                          we don't ship yet
 *   status: "none"      -> no public API we can legitimately use
 */

export const BROKERS = [
  {
    id: "zerodha",
    name: "Zerodha",
    markets: ["IN", "FNO"],
    status: "ready",
    realtime: true,
    oi: true,
    depth: true,
    note: "Kite Connect. Real-time quotes, market depth and open interest. ₹500/month + ₹2,000 one-time. Access token expires daily — you re-login each morning (Zerodha's rule).",
    docs: "https://kite.trade/docs/connect/v3/",
  },
  {
    id: "fyers",
    name: "FYERS",
    markets: ["IN", "FNO"],
    status: "ready",
    realtime: true,
    oi: true,
    depth: true,
    note: "FYERS API v3. Real-time quotes and depth, free with an account. Access token expires daily.",
    docs: "https://myapi.fyers.in/docsv3",
  },
  {
    id: "delta",
    name: "Delta Exchange",
    markets: ["Crypto"],
    // NOT BUILT. The server implements fyers and zerodha only — there is no Delta OAuth,
    // no quote adapter, no order path and no env keys. Marking this "ready" put a Connect
    // button in front of an integration that does not exist, which is a promise the app
    // cannot keep.
    status: "planned",
    realtime: false,
    oi: false,
    depth: false,
    note: "Not integrated yet. The backend has no Delta adapter — connecting it needs the OAuth/API-key flow, a quote adapter and an order path to be built first.",
    docs: "https://docs.delta.exchange/",
  },
  {
    id: "schwab",
    name: "Charles Schwab",
    markets: ["US"],
    status: "planned",   // no server adapter — same as Delta
    realtime: false,
    oi: false,
    depth: true,
    note: "Not integrated yet. The backend has no Schwab adapter — the OAuth flow and quote/order paths still need building.",
    docs: "https://developer.schwab.com/",
  },
  {
    id: "ibkr",
    name: "Interactive Brokers",
    markets: ["US", "IN"],
    status: "gateway",
    realtime: true,
    oi: false,
    depth: true,
    note: "IBKR's retail API runs through the Client Portal Gateway — a Java process that must run on YOUR machine and that you log into each day. A cloud backend like ours cannot reach it (it listens on your localhost). Connecting IBKR therefore needs Matrix running locally, not on Vercel. The adapter is written; the deployment model is the blocker, and pretending otherwise would waste your time.",
    docs: "https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/",
  },
];

export const brokerById = (id) => BROKERS.find((b) => b.id === id) || null;

/** Brokers we can actually connect today. */
export const READY = BROKERS.filter((b) => b.status === "ready");

/** Which broker (if any) is connected for a given market. */
export function brokerForMarket(connections, market) {
  const ids = Object.keys(connections || {});
  for (const id of ids) {
    const b = brokerById(id);
    if (b && connections[id] && b.markets.includes(market)) return b;
  }
  return null;
}
