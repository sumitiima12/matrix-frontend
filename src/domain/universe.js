import { LOTS } from "./fno";
/**
 * domain/universe.js — WHAT Matrix can trade.
 *
 * The instrument universe and the rules for identifying instruments. This is
 * domain knowledge, not UI and not I/O — which is why services take resolved
 * Yahoo tickers and never import this file (no circular dependencies).
 */

/**
 * Create an instrument.
 *
 * Indicators and volume are NOT generated here. They start as
 * null and are filled with REAL values from /api/indicators and
 * /api/fundamentals. A null means "no data yet" — the UI renders "—" rather
 * than inventing a number.
 */
export function build(sym, name, price, chg, sector, cap, x = {}) {
  return {
    sym, name, sector, cap,
    // Price and day-change start NULL. The seed values in the arrays below are
    // only there to keep the shape readable — they are never displayed. Until a
    // REAL quote arrives from the backend the UI renders "—". A stale hardcoded
    // price is worse than no price: corporate actions (Bajaj Finance's 4:1 bonus
    // + 1:2 split) can make a hardcoded number wrong by hundreds of percent.
    price: null,
    chg: null,
    hasData: false,
    vol: null, avgVol: null,
    // Real short-term momentum from 5-min candles (see /api/intraday).
    chg5m: null, chg15m: null, volSurge: null,
    rsi: null, sma50: null, sma200: null, ema20: null, ema50: null,
    macd: null, macdSignal: null, macdHist: null,
    atr: null, adx: null, cci: null, stoch: null, vwap: null, bbPctB: null, mfi: null, obv: null,
    high52: null, low52: null, support: null, resistance: null,
    /* No fundamentals fields. Yahoo's quoteSummary refuses datacenter IPs, so
       P/E, ROE, margins, market cap and growth have NO source. They were always
       null in practice; carrying the keys around only invited a UI to render a
       blank row and imply the number exists but is loading. */
    quarters: null, inst: null,
    verdict: x.verdict ?? null,
  };
}

/* ---------------------------------------------------------------------------
   THE CURATED UNIVERSE
   These are the exact instruments Matrix trades — an explicit product decision,
   not something derived from data. Sector is factual metadata. Market-cap tier
   --------------------------------------------------------------------------- */

const stock = (sym, name, sector) => build(sym, name, null, null, sector, null);
const index = (sym, name, sector) => ({ ...build(sym, name, null, null, sector, "Index"), isIndex: true });

/** Indian indices. Shown in Market Overview; never ranked as stocks. */
const IN_INDICES = [
  index("NIFTY50", "Nifty 50", "Index"),
  index("BANKNIFTY", "Bank Nifty", "Index"),
  index("FINNIFTY", "Fin Nifty", "Index"),
  index("SENSEX", "BSE Sensex", "Index"),
  index("INDIAVIX", "India VIX", "Volatility"),
];

/** The curated Indian universe — the exact instruments Matrix trades. */
const IN_EQUITY = [
  stock("ADANIENT", "Adani Enterprises", "Infrastructure"),
  stock("ADANIPORTS", "Adani Ports & SEZ", "Infrastructure"),
  stock("APOLLOHOSP", "Apollo Hospitals", "Healthcare"),
  stock("ASIANPAINT", "Asian Paints", "Consumer"),
  stock("ASTRAMICRO", "Astra Microwave Products", "Defence"),
  stock("AXISBANK", "Axis Bank", "Banking"),
  stock("BAJAJ-AUTO", "Bajaj Auto", "Auto"),
  stock("BAJAJFINSV", "Bajaj Finserv", "Financial Services"),
  stock("BAJFINANCE", "Bajaj Finance", "Financial Services"),
  stock("BDL", "Bharat Dynamics", "Defence"),
  stock("BEL", "Bharat Electronics", "Defence"),
  stock("BEML", "BEML", "Defence"),
  stock("BHARTIARTL", "Bharti Airtel", "Telecom"),
  stock("BSE", "BSE Ltd", "Financial Services"),
  stock("CAMS", "Computer Age Management Services", "Financial Services"),
  stock("CDSL", "Central Depository Services", "Financial Services"),
  stock("CIPLA", "Cipla", "Pharma"),
  stock("COALINDIA", "Coal India", "Energy"),
  stock("COCHINSHIP", "Cochin Shipyard", "Defence"),
  stock("DATAPATTERNS", "Data Patterns (India)", "Defence"),
  stock("DIXON", "Dixon Technologies", "Electronics"),
  stock("DRREDDY", "Dr. Reddy's Laboratories", "Pharma"),
  stock("EASEMYTRIP", "Easy Trip Planners", "Travel"),
  stock("EICHERMOT", "Eicher Motors", "Auto"),
  stock("ETERNAL", "Eternal (formerly Zomato)", "Consumer Tech"),
  stock("GODREJPROP", "Godrej Properties", "Realty"),
  stock("GRASIM", "Grasim Industries", "Cement"),
  stock("GRSE", "Garden Reach Shipbuilders", "Defence"),
  stock("HAL", "Hindustan Aeronautics", "Defence"),
  stock("HAPPSTMNDS", "Happiest Minds Technologies", "IT"),
  stock("HCLTECH", "HCL Technologies", "IT"),
  stock("HDFCAMC", "HDFC Asset Management", "Financial Services"),
  stock("HDFCBANK", "HDFC Bank", "Banking"),
  stock("HDFCLIFE", "HDFC Life Insurance", "Insurance"),
  stock("HEROMOTOCO", "Hero MotoCorp", "Auto"),
  stock("HINDALCO", "Hindalco Industries", "Metals"),
  stock("HINDUNILVR", "Hindustan Unilever", "FMCG"),
  stock("ICICIBANK", "ICICI Bank", "Banking"),
  stock("IDEAFORGE", "ideaForge Technology", "Defence"),
  stock("INDUSINDBK", "IndusInd Bank", "Banking"),
  stock("INFY", "Infosys", "IT"),
  stock("INTELLECT", "Intellect Design Arena", "IT"),
  stock("ITC", "ITC", "FMCG"),
  stock("JIOFIN", "Jio Financial Services", "Financial Services"),
  stock("JSWSTEEL", "JSW Steel", "Metals"),
  stock("KOTAKBANK", "Kotak Mahindra Bank", "Banking"),
  stock("LATENTVIEW", "Latent View Analytics", "IT"),
  stock("LT", "Larsen & Toubro", "Infrastructure"),
  stock("M&M", "Mahindra & Mahindra", "Auto"),
  stock("MAPMYINDIA", "C.E. Info Systems (MapmyIndia)", "IT"),
  stock("MARUTI", "Maruti Suzuki India", "Auto"),
  stock("MAZDOCK", "Mazagon Dock Shipbuilders", "Defence"),
  stock("NESTLEIND", "Nestle India", "FMCG"),
  stock("NTPC", "NTPC", "Power"),
  stock("NYKAA", "FSN E-Commerce (Nykaa)", "Consumer Tech"),
  stock("ONGC", "Oil & Natural Gas Corporation", "Energy"),
  stock("PAYTM", "One97 Communications (Paytm)", "Fintech"),
  stock("POLICYBZR", "PB Fintech (Policybazaar)", "Fintech"),
  stock("POWERGRID", "Power Grid Corporation", "Power"),
  stock("RELIANCE", "Reliance Industries", "Energy"),
  stock("SBICARD", "SBI Cards & Payment Services", "Financial Services"),
  stock("SBIN", "State Bank of India", "Banking"),
  stock("SHRIRAMFIN", "Shriram Finance", "Financial Services"),
  stock("SUNPHARMA", "Sun Pharmaceutical", "Pharma"),
  stock("SWIGGY", "Swiggy", "Consumer Tech"),
  stock("TATACONSUM", "Tata Consumer Products", "FMCG"),
  stock("TATAMOTORS", "Tata Motors", "Auto"),
  stock("TATASTEEL", "Tata Steel", "Metals"),
  stock("TCS", "Tata Consultancy Services", "IT"),
  stock("TECHM", "Tech Mahindra", "IT"),
  stock("TITAN", "Titan Company", "Consumer"),
  stock("TRENT", "Trent", "Retail"),
  stock("ULTRACEMCO", "UltraTech Cement", "Cement"),
  stock("WIPRO", "Wipro", "IT"),
];

const IN_STOCKS = [...IN_INDICES, ...IN_EQUITY];


/* ---- US ---- */
const US_STOCKS = [
  index("SPX", "S&P 500", "Index"),
  index("NDX", "Nasdaq 100", "Index"),
  index("DJI", "Dow Jones", "Index"),
  index("VIX", "CBOE Volatility Index", "Volatility"),
  stock("AAPL", "Apple", "Tech"),
  stock("MSFT", "Microsoft", "Software"),
  stock("NVDA", "NVIDIA", "Semiconductors"),
  stock("AMZN", "Amazon", "E-commerce"),
  stock("META", "Meta Platforms", "Tech"),
  stock("GOOGL", "Alphabet", "Tech"),
  stock("TSLA", "Tesla", "Auto"),
  stock("AMD", "AMD", "Semiconductors"),
  stock("AVGO", "Broadcom", "Semiconductors"),
  stock("NFLX", "Netflix", "Media"),
  stock("PLTR", "Palantir", "Software"),
  stock("CRWD", "CrowdStrike", "Cybersecurity"),
  stock("SNOW", "Snowflake", "Software"),
  stock("ORCL", "Oracle", "Software"),
  stock("CRM", "Salesforce", "Software"),
  stock("UBER", "Uber", "Mobility"),
  stock("COIN", "Coinbase", "Fintech"),
  stock("HOOD", "Robinhood", "Fintech"),
  stock("SHOP", "Shopify", "E-commerce"),
  stock("ARM", "Arm Holdings", "Semiconductors"),
  stock("SMCI", "Super Micro Computer", "Hardware"),
  stock("QCOM", "Qualcomm", "Semiconductors"),
  stock("INTC", "Intel", "Semiconductors"),
  stock("ANET", "Arista Networks", "Networking"),
  stock("PANW", "Palo Alto Networks", "Cybersecurity"),
  stock("DDOG", "Datadog", "Software"),
  stock("NET", "Cloudflare", "Cloud"),
  stock("APP", "AppLovin", "AdTech"),
  stock("ADBE", "Adobe", "Software"),
  stock("INTU", "Intuit", "Software"),
  stock("MSTR", "MicroStrategy (Strategy)", "Bitcoin Treasury"),
  stock("ABNB", "Airbnb", "Travel"),
  stock("COST", "Costco", "Retail"),
  stock("MA", "Mastercard", "Payments"),
  stock("CAT", "Caterpillar", "Industrials"),
  stock("MARA", "MARA Holdings", "Bitcoin Mining"),
  stock("RIOT", "Riot Platforms", "Bitcoin Mining"),
  stock("BE", "Bloom Energy", "Clean Energy"),
  stock("PLUG", "Plug Power", "Clean Energy"),
  stock("CVNA", "Carvana", "E-commerce"),
  stock("SNAP", "Snap", "Tech"),
];

/* ---- Crypto ----
   NOTE ON PERPETUALS: the requested symbols carried a ".P" suffix (perpetual
   futures). Our data source publishes SPOT only, so these are spot prices.
   Funding rates and futures basis are NOT modelled — a perpetual can trade away
   from spot, and we do not pretend to know by how much.

   LAB and RAVE are deliberately absent. LAB is a real, liquid token but our data
   source does not carry it. RAVE resolves to Ravendex, a dormant 2021 Cardano
   token with no trading volume — serving its stale "last known price" would be
   worse than serving nothing. Both return when a real feed for them exists. */
const CRYPTO = [
  stock("BTC", "Bitcoin", "Crypto"),
  stock("ETH", "Ethereum", "Crypto"),
  stock("SOL", "Solana", "Crypto"),
  stock("BNB", "BNB", "Crypto"),
  stock("XRP", "XRP", "Crypto"),
  stock("LINK", "Chainlink", "Crypto"),
  stock("PIPPIN", "pippin", "Crypto"),
];

/* ---- Commodity ----
   IMPORTANT: these are COMEX/NYMEX contracts priced in USD, not MCX contracts
   priced in INR. MCX gold and COMEX gold are different contracts with different
   prices, lot sizes and hours. The prices here are real — they are simply the
   US contracts. There is no MCX feed available to us. */
const COMMODITY = [
  stock("GOLD", "Gold (COMEX)", "Metals"),
  stock("SILVER", "Silver (COMEX)", "Metals"),
  stock("CRUDEOIL", "Crude Oil WTI (NYMEX)", "Energy"),
  stock("ALUMINIUM", "Aluminium (COMEX)", "Metals"),
];

/* ---- F&O ----
   Membership is DERIVED from the real lot-size table (LOTS in domain/fno.js).
   An instrument is F&O-tradable if and only if we know its exchange-published lot
   size. A second hand-written list here would drift out of sync with LOTS, and a
   symbol that is tradable but has no lot size is precisely the bug we removed:
   lotSize() used to fall back to a made-up 500. No fallback, no guess. */
const FNO = IN_STOCKS
  .filter((s) => LOTS[s.sym] != null)
  .map((s) => ({ ...s, lot: LOTS[s.sym] }));

const UNIVERSE = { IN: IN_STOCKS, US: US_STOCKS, Crypto: CRYPTO, Commodity: COMMODITY, FNO };
const ALL = [...IN_STOCKS, ...US_STOCKS, ...CRYPTO, ...COMMODITY];
/**
 * Which market an instrument belongs to, or NULL if we do not carry it.
 *
 * This used to fall through to "IN" for anything unrecognised, which is how LAB —
 * a crypto we deliberately excluded because Yahoo has no feed for it — ended up
 * listed under Indian holdings. An unknown symbol is not an Indian stock; it is
 * unknown, and saying otherwise is a small lie with real consequences (it would be
 * sent to Yahoo as LAB.NS and priced against the wrong instrument).
 */
function marketOf(sym) {
  if (IN_STOCKS.find((s) => s.sym === sym)) return "IN";
  if (US_STOCKS.find((s) => s.sym === sym)) return "US";
  if (CRYPTO.find((s) => s.sym === sym)) return "Crypto";
  if (COMMODITY.find((s) => s.sym === sym)) return "Commodity";
  return null;
}
// Market hours in IST (regardless of the device's own timezone).
function istParts() {
  const d = new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + 5.5 * 3600000);
  return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
}
function marketHoursLabel(market) {
  return market === "Crypto" ? "24×7" : market === "US" ? "7:30pm–1:30am IST" : market === "Commodity" ? "9:00am–8:30pm IST" : "9:15am–3:30pm IST";
}

/* ---- Yahoo ticker mapping (domain knowledge, kept out of the services) ---- */
const Y_SPECIAL = {
  // Indian indices
  NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK", SENSEX: "^BSESN", FINNIFTY: "^NSEFIN", INDIAVIX: "^INDIAVIX",
  // US indices
  SPX: "^GSPC", NDX: "^NDX", DJI: "^DJI", VIX: "^VIX",
  // Commodity futures (COMEX / NYMEX, USD — NOT MCX)
  GOLD: "GC=F", SILVER: "SI=F", CRUDEOIL: "CL=F", ALUMINIUM: "ALI=F",
};
function yahooSymbol(sym) {
  if (Y_SPECIAL[sym]) return Y_SPECIAL[sym];
  const m = marketOf(sym);
  if (m === "Crypto") return sym + "-USD";
  if (m === "US") return sym;
  if (m === "IN") return sym + ".NS";      // NSE
  // Unknown instrument: return it untouched rather than guessing it is Indian and
  // requesting SOMETHING.NS, which would either 404 or — worse — quietly resolve to
  // a different company that happens to share the ticker.
  return sym;
}

export {
  IN_STOCKS, US_STOCKS, CRYPTO, COMMODITY, FNO, UNIVERSE, ALL,
  Y_SPECIAL, yahooSymbol, marketOf, istParts, marketHoursLabel,
  IN_INDICES, IN_EQUITY,
};

/** Global index strip shown on the dashboard. */
/**
 * The global markets strip.
 *
 * These used to be HARDCODED percentages (NIFTY +0.62%, BTC +1.92%...) that never
 * changed — thirteen invented numbers sitting at the top of the dashboard. They
 * are now references to real instruments; the strip reads each one's live change
 * and shows "—" until real data arrives.
 *
 * FTSE, Nikkei and Hang Seng were dropped: they were pure fiction, and we do not
 * poll them. Add them back by adding real instruments and quoting them.
 */
export const GLOBAL_MKTS = [
  { sym: "NIFTY50", n: "NIFTY 50" },
  { sym: "SENSEX", n: "SENSEX" },
  { sym: "BANKNIFTY", n: "BANK NIFTY" },
  { sym: "SPX", n: "S&P 500" },
  { sym: "NDX", n: "NASDAQ" },
  { sym: "DJI", n: "DOW" },
  { sym: "BTC", n: "BTC" },
  { sym: "ETH", n: "ETH" },
  { sym: "GOLD", n: "GOLD" },
  { sym: "CRUDEOIL", n: "CRUDE" },
];

/**
 * Market-cap tier, DERIVED from the real market cap Yahoo reports.
 *
 * Never hardcoded on the instrument: a hardcoded tier goes stale silently as a
 * company grows or shrinks. Returns null when we have no real market cap, and
 * the UI shows "—" rather than guessing a tier.
 *
 * Thresholds are a stated heuristic in INR (SEBI classifies by rank, not value,
 * and the rank list is not in our data): Large > ₹50,000 cr, Mid ₹15,000–50,000 cr.
 */

