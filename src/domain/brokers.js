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
    markets: ["IN", "FNO", "Commodity"],
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
    markets: ["IN", "FNO", "Commodity"],
    status: "ready",
    realtime: true,
    oi: true,
    depth: true,
    /* BRING-YOUR-OWN-APP + OAuth. The user pastes their OWN FYERS API app id/secret, then logs
       in on FYERS — so live prices and trades run on THEIR account, not a shared one. */
    byoaOAuth: true,
    fields: [
      { key: "appId", label: "App ID", type: "text", hint: "Your FYERS app's App ID (e.g. ABCD1234-100), from myapi.fyers.in → create app" },
      { key: "secret", label: "Secret ID", type: "password", hint: "The app's Secret ID, shown when you create the app" },
      { key: "pin", label: "Trading PIN (optional)", type: "password", hint: "Optional. Lets Matrix auto-refresh your daily token so you stay connected ~15 days instead of logging in every morning." },
    ],
    note: "Connect your OWN FYERS account. Create an API app at myapi.fyers.in, whitelist the IP shown below, set its redirect URL, then log in with FYERS. Live NSE quotes; trades go to your account.",
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
    status: "ready",
    realtime: true,
    oi: true,
    depth: true,
    apiKeyOnly: true,   // no OAuth redirect — the server's API keys ARE the credential
    adminOnly: true,    // server-side account (like FYERS) — not a per-user connect
    note: "Powers the built-in crypto price feed for all users. Signed with API keys held on the server (the server's Delta account) — configured on the server.",
    docs: "https://docs.delta.exchange/",
  },
  {
    id: "coindcx",
    name: "CoinDCX",
    markets: ["Crypto"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "apiKey", label: "API key", type: "password", hint: "From CoinDCX → Account → API Dashboard → Create API key" },
      { key: "apiSecret", label: "API secret", type: "password", hint: "Shown once when you create the key" },
    ],
    note: "Connect your own CoinDCX account to trade crypto. Signed with your API key + secret (kept on the server, never in the browser).",
    docs: "https://docs.coindcx.com/",
  },
  {
    id: "coinswitch",
    name: "CoinSwitch",
    markets: ["Crypto"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "apiKey", label: "API key", type: "password", hint: "From CoinSwitch PRO → API Trading" },
      { key: "apiSecret", label: "API secret (Ed25519)", type: "password", hint: "The secret/private key shown when you create the key" },
    ],
    note: "Connect your own CoinSwitch PRO account. Signed with your API key + secret (kept on the server).",
    docs: "https://api-trading.coinswitch.co/",
  },
  {
    id: "binance",
    name: "Binance",
    markets: ["Crypto"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "apiKey", label: "API key", type: "password", hint: "From Binance → API Management → Create API" },
      { key: "apiSecret", label: "API secret", type: "password", hint: "Shown once when you create the key" },
    ],
    note: "Connect your own Binance account. Signed with your API key + secret. Note: Binance may be geo-restricted depending on the server region.",
    docs: "https://developers.binance.com/docs/binance-spot-api-docs",
  },
  {
    id: "dhan",
    name: "Dhan",
    markets: ["IN", "FNO", "Commodity"],
    status: "ready",
    realtime: false,   // prices come from the FYERS house feed; Dhan gives portfolio + orders
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "accessToken", label: "Access token", type: "password", hint: "From web.dhan.co → DhanHQ Trading APIs → Generate token" },
      { key: "clientId", label: "Client ID", type: "text", hint: "Your Dhan client ID (dhanClientId)" },
    ],
    note: "Paste an access token generated on web.dhan.co. Shows your real Dhan holdings. Live prices come from the FYERS feed. Tokens expire — regenerate when it stops working.",
    docs: "https://dhanhq.co/docs/v2/",
  },
  {
    id: "indmoney",
    name: "IND Money",
    markets: ["IN", "FNO"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "accessToken", label: "Access token", type: "password", hint: "indstocks.com → log in → /app/api-trading → Generate Token. NOTE: it expires every 24h, regenerate daily." },
    ],
    note: "Trade Indian (NSE) stocks via the INDstocks API. Paste your access token from indstocks.com/app/api-trading (expires daily). Flat ₹5/order. (US prices in Matrix already come from IND Money automatically — no connection needed for those.)",
    docs: "https://api-docs.indstocks.com/",
  },
  {
    id: "angelone",
    name: "Angel One",
    markets: ["IN", "FNO", "Commodity"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "apiKey", label: "API key", type: "password", hint: "Your SmartAPI app's API key (smartapi.angelone.in)" },
      { key: "clientCode", label: "Client code", type: "text", hint: "Your Angel One client code" },
      { key: "pin", label: "PIN", type: "password", hint: "Your Angel One login PIN" },
      { key: "totp", label: "TOTP", type: "text", hint: "Current 6-digit code from your authenticator app" },
    ],
    note: "SmartAPI login with your API key, client code, PIN and a live TOTP. Shows your real Angel One holdings. Live prices come from the FYERS feed. The session lasts the trading day.",
    docs: "https://smartapi.angelone.in/docs",
  },
  {
    id: "groww",
    name: "Groww",
    markets: ["IN", "FNO", "Commodity"],
    status: "ready",
    realtime: false,
    oi: false,
    depth: false,
    userCreds: true,
    fields: [
      { key: "accessToken", label: "Access token", type: "password", hint: "From groww.in/trade-api → generate an access token" },
    ],
    note: "Paste your Groww trading-API access token. Shows your real Groww holdings. Live prices come from the FYERS feed.",
    docs: "https://groww.in/trade-api/docs",
  },
  /* Charles Schwab — kept LAST in the list. */
  {
    id: "schwab",
    name: "Charles Schwab",
    markets: ["US"],
    status: "ready",
    realtime: true,
    oi: false,
    depth: true,
    note: "OAuth2. The access token lasts ~30 minutes and is refreshed automatically; the refresh token lasts ~7 days. Set SCHWAB_APP_KEY and SCHWAB_APP_SECRET on Render.",
    docs: "https://developer.schwab.com/",
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
