import { ALL, marketOf } from "./universe";

/**
 * domain/brokerSymbols.js — our symbol -> the broker's symbol.
 *
 * Getting this wrong is not cosmetic: it means quoting, or ORDERING, the wrong
 * instrument. So there is no clever guessing. Where a mapping is not known we
 * return null, the symbol is skipped, and the UI shows "—".
 *
 * A WRONG SYMBOL IS FAR WORSE THAN NO SYMBOL.
 *
 * Indices are the sharp edge — their names are irregular at every broker — so they
 * are spelled out one by one rather than derived from a rule.
 */

const INDEX_MAP = {
  zerodha: {
    NIFTY50: "NSE:NIFTY 50",
    BANKNIFTY: "NSE:NIFTY BANK",
    FINNIFTY: "NSE:NIFTY FIN SERVICE",
    SENSEX: "BSE:SENSEX",
    INDIAVIX: "NSE:INDIA VIX",
  },
  fyers: {
    NIFTY50: "NSE:NIFTY50-INDEX",
    BANKNIFTY: "NSE:NIFTYBANK-INDEX",
    FINNIFTY: "NSE:FINNIFTY-INDEX",
    SENSEX: "BSE:SENSEX-INDEX",
    INDIAVIX: "NSE:INDIAVIX-INDEX",
  },
};

/** Delta Exchange crypto pairs. */
const DELTA_MAP = {
  BTC: "BTCUSD", ETH: "ETHUSD", SOL: "SOLUSD",
  XRP: "XRPUSD", BNB: "BNBUSD", ADA: "ADAUSD", DOGE: "DOGEUSD",
};

/** @returns {string|null} the broker's symbol, or null if we cannot map it honestly. */
export function brokerSymbol(sym, broker) {
  // A REAL Delta holding is read back already as its perpetual symbol ("EVAAUSD", "XRPUSD").
  // That's often not a literal universe entry (the universe stores the bare coin "EVAA"), but it
  // IS already the exact Delta symbol — so for Delta, pass a "<COIN>USD(T)" symbol straight
  // through instead of failing "no symbol mapping". The server still verifies the product exists.
  if (broker === "delta" && /USDT?$/i.test(String(sym)) && !ALL.find((a) => a.sym === sym)) {
    return String(sym).replace(/USDT$/i, "USD");
  }
  const s = ALL.find((a) => a.sym === sym);
  if (!s) return null;
  const mkt = marketOf(sym);

  switch (broker) {
    case "zerodha": {
      if (mkt !== "IN" && mkt !== "FNO") return null;   // Kite is Indian markets only
      const idx = INDEX_MAP.zerodha[sym];
      if (idx) return idx;
      if (s.isIndex) return null;                       // unknown index: do NOT guess
      return `NSE:${sym}`;
    }

    case "fyers": {
      if (mkt !== "IN" && mkt !== "FNO") return null;
      const idx = INDEX_MAP.fyers[sym];
      if (idx) return idx;
      if (s.isIndex) return null;
      return `NSE:${sym}-EQ`;
    }

    case "delta":
      /* Delta names every perpetual the same way: <COIN>USD (BTCUSD, XRPUSD, DOGEUSD…),
         confirmed against the live contract list. So we derive it rather than maintaining a
         hand-list — and the server double-checks the product exists before placing an order,
         so an unlisted coin fails honestly ("Delta does not list …") instead of silently
         hitting the wrong instrument. INDEX_MAP-style exceptions can be added if any surface. */
      return mkt === "Crypto" ? (DELTA_MAP[sym] || `${sym}USD`) : null;

    /* Per-user crypto exchanges. We pass the bare coin (e.g. "BTC"); the server formats the
       trading pair per exchange (CoinDCX -> BTCINR, Binance -> BTCUSDT). */
    case "coindcx":
    case "binance":
    case "coinswitch":
      return mkt === "Crypto" ? sym : null;

    case "schwab":
    case "robinhood":
      if (mkt !== "US" || s.isIndex) return null;       // US index quoting differs
      return sym;

    /* Dhan, Angel One, Groww and IND Money trade by NUMERIC instrument IDs. The SERVER
       resolves the id from each broker's own instrument master and REFUSES if it can't
       match strictly (see dhanSecurityId / angelToken) — so a wrong stock is impossible.
       Here we just pass the plain NSE cash-equity symbol; indices are not supported. */
    case "dhan":
    case "angelone":
    case "groww":
    case "indmoney":
      if (mkt !== "IN" && mkt !== "FNO") return null;
      if (s.isIndex) return null;                       // index F&O needs contract ids we don't map
      return sym;

    default:
      return null;
  }
}

/** Broker symbol -> our symbol, so a quote can be written back onto the universe. */
export function fromBrokerSymbol(bsym, broker) {
  const hit = ALL.find((a) => brokerSymbol(a.sym, broker) === bsym);
  return hit ? hit.sym : null;
}

/** Only the symbols this broker can actually price. */
export function mappableSymbols(broker, syms) {
  return (syms || []).filter((s) => brokerSymbol(s, broker) != null);
}

/** What each broker really covers. `realtime` = the integration actually works today. */
export const BROKER_COVERAGE = {
  zerodha:   { markets: ["IN", "FNO"], name: "Zerodha",        realtime: true,  orders: true },
  fyers:     { markets: ["IN", "FNO"], name: "FYERS",          realtime: true,  orders: true },
  dhan:      { markets: ["IN", "FNO"], name: "Dhan",           realtime: false, orders: true },
  angelone:  { markets: ["IN", "FNO"], name: "Angel One",      realtime: false, orders: true },
  groww:     { markets: ["IN"],        name: "Groww",          realtime: false, orders: true },
  indmoney:  { markets: ["IN", "US"],  name: "IND Money",      realtime: false, orders: true },
  delta:     { markets: ["Crypto"],    name: "Delta Exchange", realtime: true,  orders: true },
  coindcx:   { markets: ["Crypto"],    name: "CoinDCX",        realtime: false, orders: true },
  binance:   { markets: ["Crypto"],    name: "Binance",        realtime: false, orders: true },
  coinswitch:{ markets: ["Crypto"],    name: "CoinSwitch",     realtime: false, orders: true },
  schwab:    { markets: ["US"],        name: "Charles Schwab", realtime: false, orders: false },
  robinhood: { markets: ["US"],        name: "Robinhood",      realtime: false, orders: false },
};
