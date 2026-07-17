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

    /* Dhan, Angel One and Groww quote by NUMERIC instrument IDs from their own
       instrument master files, which we have not downloaded. Rather than invent a
       symbol format, we map nothing — so they cannot silently quote the wrong
       stock. Wiring these means fetching and caching their instrument dumps. */
    case "dhan":
    case "angelone":
    case "groww":
      return null;

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
  dhan:      { markets: ["IN", "FNO"], name: "Dhan",           realtime: false, orders: false },
  angelone:  { markets: ["IN", "FNO"], name: "Angel One",      realtime: false, orders: false },
  groww:     { markets: ["IN"],        name: "Groww",          realtime: false, orders: false },
  delta:     { markets: ["Crypto"],    name: "Delta Exchange", realtime: false, orders: false },
  schwab:    { markets: ["US"],        name: "Charles Schwab", realtime: false, orders: false },
  robinhood: { markets: ["US"],        name: "Robinhood",      realtime: false, orders: false },
};
