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
    status: "ready",
    realtime: true,
    oi: true,
    depth: true,
    note: "Indian crypto derivatives exchange. Public market data needs no login; trading needs an API key.",
    docs: "https://docs.delta.exchange/",
  },
  {
    id: "schwab",
    name: "Charles Schwab",
    markets: ["US"],
    status: "ready",
    realtime: true,
    oi: false,
    depth: true,
    note: "Schwab Trader API. Real-time US quotes. Requires a Schwab account and an approved developer app — approval takes a few days.",
    docs: "https://developer.schwab.com/",
  },
  {
    id: "dhan",
    name: "Dhan",
    markets: ["IN", "FNO"],
    status: "partial",
    realtime: true,
    oi: true,
    depth: true,
    note: "DhanHQ has a real API, but it keys instruments by numeric security ID from a daily master file rather than by ticker. Until that file is loaded, we cannot map RELIANCE to Dhan's ID — and we will not guess an ID.",
    docs: "https://dhanhq.co/docs/v2/",
  },
  {
    id: "angelone",
    name: "Angel One",
    markets: ["IN", "FNO"],
    status: "partial",
    realtime: true,
    oi: true,
    depth: true,
    note: "SmartAPI is real and free, but also keys on numeric tokens from a daily instrument master. Same reason as Dhan: no ID file, no honest mapping.",
    docs: "https://smartapi.angelbroking.com/docs",
  },
  {
    id: "groww",
    name: "Groww",
    markets: ["IN"],
    status: "partial",
    realtime: true,
    oi: false,
    depth: false,
    note: "Groww's trading API is newer and also instrument-ID based. Same blocker as Dhan and Angel One.",
    docs: "https://groww.in/trade-api/docs",
  },
  {
    id: "robinhood",
    name: "Robinhood",
    markets: ["US"],
    status: "none",
    realtime: false,
    oi: false,
    depth: false,
    note: "Robinhood has NO official public API. The libraries that exist reverse-engineer their private app endpoints — which violates their terms, can get your account locked, and breaks without warning. Not worth your account. Use Schwab for US markets.",
    docs: null,
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
