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
 * Indicators, volume and fundamentals are NOT generated here. They start as
 * null and are filled with REAL values from /api/indicators and
 * /api/fundamentals. A null means "no data yet" — the UI renders "—" rather
 * than inventing a number.
 */
export function build(sym, name, price, chg, sector, cap, x = {}) {
  return {
    sym, name, price, chg, sector, cap,
    hasData: false,
    vol: null, avgVol: null,
    rsi: null, sma50: null, sma200: null, ema20: null, ema50: null,
    macd: null, macdSignal: null, macdHist: null,
    atr: null, adx: null, cci: null, stoch: null, vwap: null, bbPctB: null, mfi: null, obv: null,
    high52: null, low52: null, support: null, resistance: null,
    pe: x.pe ?? null, roe: x.roe ?? null,
    revGrowth: x.revG ?? null, ebitdaGrowth: x.ebG ?? null,
    profitMargin: null, marketCap: null, debtToEquity: null,
    quarters: null, inst: null,
    verdict: x.verdict ?? null,
  };
}

const IN_STOCKS = [
  build("RELIANCE", "Reliance Industries", 2945.6, 1.42, "Energy", "Large", {
  }),
  build("TCS", "Tata Consultancy Services", 4012.3, -0.86, "IT", "Large", {
  }),
  build("HDFCBANK", "HDFC Bank", 1678.9, 0.94, "Banking", "Large", {
  }),
  build("INFY", "Infosys", 1542.0, 2.31, "IT", "Large", {
  }),
  build("TATAMOTORS", "Tata Motors", 982.4, 3.67, "Auto", "Large", {
  }),
  build("ADANIENT", "Adani Enterprises", 3120.0, -2.14, "Infrastructure", "Large", {
  }),
  build("ETERNAL", "Eternal Ltd", 198.7, 4.85, "Consumer Tech", "Mid", {
  }),
  build("DMART", "Avenue Supermarts", 4480.5, -0.42, "Retail", "Large", { ebG: 12.0 }),
  build("BAJFINANCE", "Bajaj Finance", 7210.0, 1.18, "NBFC", "Large", {
  }),
  build("ITC", "ITC", 462.3, 0.31, "FMCG", "Large", { ebG: 6.5 }),
  build("PAYTM", "One97 (Paytm)", 412.9, -3.92, "Fintech", "Mid", {
  }),
  build("IRCTC", "IRCTC", 902.1, 2.04, "Travel", "Mid", { ebG: 15.0 }),
  build("TATAPOWER", "Tata Power", 412.8, 5.21, "Power", "Mid", {
  }),
  build("HAL", "Hindustan Aeronautics", 4890.0, 1.77, "Defence", "Large", {
  }),
  build("NYKAA", "FSN E-Commerce (Nykaa)", 178.4, 1.05, "Consumer Tech", "Mid", { pe: 95 }),
  build("IDEA", "Vodafone Idea", 8.4, -1.18, "Telecom", "Small", {}),
  build("SBIN", "State Bank of India", 842.6, 1.36, "Banking", "Large", {}),
];

/* ---- Broader Indian universe (symbol, name, price, sector, cap) ---- */
const MORE_IN = [
  ["TCS", "Tata Consultancy", 4120, "IT", "Large"],
  ["KOTAKBANK", "Kotak Mahindra Bank", 1795, "Banking", "Large"], ["AXISBANK", "Axis Bank", 1168, "Banking", "Large"],
  ["BAJFINANCE", "Bajaj Finance", 7220, "NBFC", "Large"], ["BHARTIARTL", "Bharti Airtel", 1520, "Telecom", "Large"],
  ["HINDUNILVR", "Hindustan Unilever", 2460, "FMCG", "Large"], ["ITC", "ITC Ltd", 428, "FMCG", "Large"],
  ["ADANIENT", "Adani Enterprises", 2985, "Conglomerate", "Large"], ["ADANIPORTS", "Adani Ports", 1372, "Infrastructure", "Large"],
  ["ASIANPAINT", "Asian Paints", 2905, "Consumer", "Large"], ["TITAN", "Titan Company", 3410, "Consumer", "Large"],
  ["ULTRACEMCO", "UltraTech Cement", 11250, "Cement", "Large"], ["WIPRO", "Wipro", 292, "IT", "Large"],
  ["HCLTECH", "HCL Technologies", 1642, "IT", "Large"], ["TECHM", "Tech Mahindra", 1585, "IT", "Large"],
  ["POWERGRID", "Power Grid Corp", 328, "Utilities", "Large"], ["NTPC", "NTPC Ltd", 368, "Utilities", "Large"],
  ["ONGC", "ONGC", 268, "Energy", "Large"], ["COALINDIA", "Coal India", 462, "Energy", "Large"],
  ["JSWSTEEL", "JSW Steel", 918, "Metals", "Large"], ["TATASTEEL", "Tata Steel", 152, "Metals", "Large"],
  ["HINDALCO", "Hindalco", 648, "Metals", "Large"], ["GRASIM", "Grasim Industries", 2565, "Cement", "Large"],
  ["NESTLEIND", "Nestle India", 2510, "FMCG", "Large"], ["BAJAJFINSV", "Bajaj Finserv", 1642, "NBFC", "Large"],
  ["BAJAJ-AUTO", "Bajaj Auto", 9720, "Auto", "Large"], ["EICHERMOT", "Eicher Motors", 4780, "Auto", "Large"],
  ["HEROMOTOCO", "Hero MotoCorp", 5240, "Auto", "Large"], ["M&M", "Mahindra & Mahindra", 2890, "Auto", "Large"],
  ["DIVISLAB", "Divi's Labs", 5920, "Pharma", "Large"], ["CIPLA", "Cipla", 1502, "Pharma", "Large"],
  ["APOLLOHOSP", "Apollo Hospitals", 6820, "Healthcare", "Large"], ["BRITANNIA", "Britannia", 5180, "FMCG", "Large"],
  ["PIDILITIND", "Pidilite", 2985, "Chemicals", "Mid"], ["DABUR", "Dabur India", 512, "FMCG", "Large"],
  ["GODREJCP", "Godrej Consumer", 1245, "FMCG", "Mid"], ["SIEMENS", "Siemens India", 6980, "Capital Goods", "Large"],
  ["DMART", "Avenue Supermarts", 4620, "Retail", "Large"], ["PNB", "Punjab National Bank", 104, "Banking", "Mid"],
  ["BANKBARODA", "Bank of Baroda", 242, "Banking", "Mid"], ["CANBK", "Canara Bank", 108, "Banking", "Mid"],
  ["INDUSINDBK", "IndusInd Bank", 985, "Banking", "Large"], ["GAIL", "GAIL India", 208, "Energy", "Large"],
  ["IOC", "Indian Oil", 142, "Energy", "Large"], ["BPCL", "Bharat Petroleum", 312, "Energy", "Large"],
  ["VEDL", "Vedanta", 448, "Metals", "Large"], ["DLF", "DLF Ltd", 815, "Realty", "Large"],
  ["PAYTM", "Paytm (One97)", 445, "Fintech", "Mid"],
  ["POLICYBZR", "PB Fintech", 1520, "Fintech", "Mid"], ["IRCTC", "IRCTC", 812, "Travel", "Mid"],
  ["JUBLFOOD", "Jubilant FoodWorks", 645, "Consumer", "Mid"], ["TVSMOTOR", "TVS Motor", 2380, "Auto", "Mid"],
  ["ASHOKLEY", "Ashok Leyland", 228, "Auto", "Mid"], ["BOSCHLTD", "Bosch", 33200, "Auto", "Large"],
  ["CUMMINSIND", "Cummins India", 3620, "Capital Goods", "Mid"], ["ABB", "ABB India", 8120, "Capital Goods", "Large"],
  ["SBILIFE", "SBI Life", 1512, "Insurance", "Large"], ["HDFCLIFE", "HDFC Life", 645, "Insurance", "Large"],
  ["ICICIGI", "ICICI Lombard", 1920, "Insurance", "Mid"], ["ICICIPRULI", "ICICI Pru Life", 685, "Insurance", "Mid"],
  ["SHRIRAMFIN", "Shriram Finance", 3120, "NBFC", "Mid"], ["CHOLAFIN", "Cholamandalam", 1385, "NBFC", "Mid"],
  ["MUTHOOTFIN", "Muthoot Finance", 1985, "NBFC", "Mid"], ["LTIM", "LTIMindtree", 5620, "IT", "Large"],
  ["PERSISTENT", "Persistent Systems", 5880, "IT", "Mid"], ["COFORGE", "Coforge", 8420, "IT", "Mid"],
  ["MPHASIS", "Mphasis", 2985, "IT", "Mid"], ["OFSS", "Oracle Fin Serv", 12200, "IT", "Mid"],
  ["TATACONSUM", "Tata Consumer", 1085, "FMCG", "Large"], ["COLPAL", "Colgate-Palmolive", 3420, "FMCG", "Mid"],
  ["MARICO", "Marico", 685, "FMCG", "Mid"], ["BERGEPAINT", "Berger Paints", 528, "Consumer", "Mid"],
  ["HAVELLS", "Havells India", 1885, "Consumer", "Mid"], ["VOLTAS", "Voltas", 1685, "Consumer", "Mid"],
  ["TORNTPHARM", "Torrent Pharma", 3285, "Pharma", "Mid"], ["LUPIN", "Lupin", 2185, "Pharma", "Mid"],
  ["AUROPHARMA", "Aurobindo Pharma", 1385, "Pharma", "Mid"], ["ALKEM", "Alkem Labs", 5620, "Pharma", "Mid"],
  ["ZYDUSLIFE", "Zydus Lifesciences", 1085, "Pharma", "Mid"], ["MANKIND", "Mankind Pharma", 2385, "Pharma", "Mid"],
  ["INDIGO", "InterGlobe (IndiGo)", 4620, "Aviation", "Large"], ["JINDALSTEL", "Jindal Steel", 985, "Metals", "Mid"],
  ["SAIL", "SAIL", 128, "Metals", "Mid"], ["NMDC", "NMDC", 218, "Metals", "Mid"],
  ["PFC", "Power Finance Corp", 512, "NBFC", "Mid"], ["RECLTD", "REC Ltd", 528, "NBFC", "Mid"],
  ["IRFC", "Indian Rlwy Finance", 158, "NBFC", "Mid"], ["TRENT", "Trent Ltd", 6820, "Retail", "Large"],
  ["ADANIGREEN", "Adani Green", 1085, "Utilities", "Large"], ["ADANIPOWER", "Adani Power", 612, "Utilities", "Large"],
  ["MOTHERSON", "Samvardhana Motherson", 168, "Auto", "Mid"], ["BHEL", "BHEL", 248, "Capital Goods", "Mid"],
];
const MORE_US = [
  ["JPM", "JPMorgan Chase", 212, "Banking", "Large"], ["V", "Visa", 278, "Fintech", "Large"],
  ["MA", "Mastercard", 462, "Fintech", "Large"], ["JNJ", "Johnson & Johnson", 158, "Healthcare", "Large"],
  ["UNH", "UnitedHealth", 512, "Healthcare", "Large"], ["XOM", "Exxon Mobil", 118, "Energy", "Large"],
  ["CVX", "Chevron", 158, "Energy", "Large"], ["WMT", "Walmart", 68, "Retail", "Large"],
  ["PG", "Procter & Gamble", 168, "FMCG", "Large"], ["KO", "Coca-Cola", 62, "FMCG", "Large"],
  ["PEP", "PepsiCo", 172, "FMCG", "Large"], ["COST", "Costco", 872, "Retail", "Large"],
  ["HD", "Home Depot", 362, "Retail", "Large"], ["MCD", "McDonald's", 262, "Consumer", "Large"],
  ["NKE", "Nike", 78, "Consumer", "Large"], ["DIS", "Disney", 98, "Media", "Large"],
  ["NFLX", "Netflix", 685, "Media", "Large"], ["CRM", "Salesforce", 268, "Software", "Large"],
  ["ORCL", "Oracle", 142, "Software", "Large"], ["ADBE", "Adobe", 528, "Software", "Large"],
  ["INTC", "Intel", 32, "Semiconductors", "Large"], ["CSCO", "Cisco", 52, "Tech", "Large"],
  ["QCOM", "Qualcomm", 172, "Semiconductors", "Large"], ["TXN", "Texas Instruments", 198, "Semiconductors", "Large"],
  ["AVGO", "Broadcom", 168, "Semiconductors", "Large"], ["MU", "Micron", 108, "Semiconductors", "Large"],
  ["IBM", "IBM", 192, "Tech", "Large"], ["ACN", "Accenture", 342, "IT Services", "Large"],
  ["ABT", "Abbott Labs", 112, "Healthcare", "Large"], ["PFE", "Pfizer", 28, "Pharma", "Large"],
  ["MRK", "Merck", 122, "Pharma", "Large"], ["LLY", "Eli Lilly", 785, "Pharma", "Large"],
  ["TMO", "Thermo Fisher", 585, "Healthcare", "Large"], ["DHR", "Danaher", 252, "Healthcare", "Large"],
  ["BAC", "Bank of America", 42, "Banking", "Large"], ["WFC", "Wells Fargo", 62, "Banking", "Large"],
  ["GS", "Goldman Sachs", 492, "Banking", "Large"], ["MS", "Morgan Stanley", 102, "Banking", "Large"],
  ["C", "Citigroup", 68, "Banking", "Large"], ["AXP", "American Express", 248, "Fintech", "Large"],
  ["BLK", "BlackRock", 892, "Asset Mgmt", "Large"], ["SCHW", "Charles Schwab", 72, "Fintech", "Large"],
  ["BA", "Boeing", 178, "Aerospace", "Large"], ["CAT", "Caterpillar", 362, "Industrials", "Large"],
  ["GE", "GE Aerospace", 172, "Aerospace", "Large"], ["HON", "Honeywell", 205, "Industrials", "Large"],
  ["UPS", "UPS", 132, "Logistics", "Large"], ["RTX", "RTX Corp", 118, "Aerospace", "Large"],
  ["LMT", "Lockheed Martin", 462, "Defence", "Large"], ["DE", "Deere & Co", 382, "Industrials", "Large"],
  ["UBER", "Uber", 72, "Tech", "Large"], ["ABNB", "Airbnb", 128, "Travel", "Large"],
  ["SHOP", "Shopify", 78, "E-commerce", "Large"], ["SQ", "Block", 68, "Fintech", "Mid"],
  ["PYPL", "PayPal", 68, "Fintech", "Large"], ["SNOW", "Snowflake", 158, "Software", "Mid"],
  ["NET", "Cloudflare", 88, "Software", "Mid"], ["CRWD", "CrowdStrike", 342, "Cybersecurity", "Large"],
  ["ZS", "Zscaler", 192, "Cybersecurity", "Mid"], ["DDOG", "Datadog", 122, "Software", "Mid"],
  ["MDB", "MongoDB", 268, "Software", "Mid"], ["PANW", "Palo Alto Networks", 342, "Cybersecurity", "Large"],
  ["MRVL", "Marvell", 78, "Semiconductors", "Large"], ["SMCI", "Super Micro", 42, "Hardware", "Mid"],
  ["ARM", "ARM Holdings", 138, "Semiconductors", "Large"], ["TSM", "TSMC (ADR)", 178, "Semiconductors", "Large"],
  ["ASML", "ASML (ADR)", 745, "Semiconductors", "Large"], ["SBUX", "Starbucks", 92, "Consumer", "Large"],
  ["CMCSA", "Comcast", 42, "Media", "Large"], ["T", "AT&T", 22, "Telecom", "Large"],
  ["VZ", "Verizon", 42, "Telecom", "Large"], ["TMUS", "T-Mobile", 218, "Telecom", "Large"],
  ["F", "Ford", 12, "Auto", "Large"], ["GM", "General Motors", 48, "Auto", "Large"],
  ["RIVN", "Rivian", 14, "Auto", "Mid"], ["LCID", "Lucid", 3, "Auto", "Mid"],
  ["MMM", "3M", 128, "Industrials", "Large"], ["GILD", "Gilead Sciences", 78, "Pharma", "Large"],
  ["AMGN", "Amgen", 285, "Pharma", "Large"], ["BMY", "Bristol Myers", 52, "Pharma", "Large"],
  ["CVS", "CVS Health", 62, "Healthcare", "Large"], ["LOW", "Lowe's", 245, "Retail", "Large"],
  ["TGT", "Target", 142, "Retail", "Large"], ["BKNG", "Booking Holdings", 3980, "Travel", "Large"],
  ["NOW", "ServiceNow", 872, "Software", "Large"], ["INTU", "Intuit", 645, "Software", "Large"],
  ["AMAT", "Applied Materials", 198, "Semiconductors", "Large"], ["LRCX", "Lam Research", 82, "Semiconductors", "Large"],
  ["KLAC", "KLA Corp", 742, "Semiconductors", "Large"], ["ADI", "Analog Devices", 218, "Semiconductors", "Large"],
  ["MARA", "MARA Holdings", 18, "Crypto Miners", "Mid", { vol: 40 }], ["RIOT", "Riot Platforms", 11, "Crypto Miners", "Mid", { vol: 38 }],
  ["PLUG", "Plug Power", 2.4, "Clean Energy", "Mid", { vol: 45 }], ["BE", "Bloom Energy", 22, "Clean Energy", "Mid", { vol: 20 }],
  ["CVNA", "Carvana", 245, "E-commerce", "Mid", { vol: 22 }], ["HOOD", "Robinhood", 62, "Fintech", "Large", { vol: 48 }],
  ["SNAP", "Snap", 11, "Media", "Mid", { vol: 42 }], ["APLD", "Applied Digital", 9.5, "Data Centers", "Small", { vol: 25 }],
];

/* -------------------------------------------------------------------------
   NOTE: the seed arrays for US_STOCKS / CRYPTO / COMMODITY were lost in an
   earlier refactor and are reconstructed here. US_STOCKS is seeded with the
   mega-caps and indices that must always be present (the rest arrive from
   MORE_US below). Prices are only a starting placeholder — every one of them
   is overwritten by the REAL live quote as soon as the backend responds.
   ------------------------------------------------------------------------- */

/** Deterministic starting day-change so the UI isn't blank before live data. */
const dchg = (sym) => 0;

const US_STOCKS = [
  build("SPX", "S&P 500", 5620, 0, "Index", "Index"),
  build("NDX", "Nasdaq 100", 19850, 0, "Index", "Index"),
  build("DJI", "Dow Jones", 41200, 0, "Index", "Index"),
  build("VIX", "CBOE Volatility Index", 14.2, 0, "Volatility", "Index"),
  build("AAPL", "Apple", 228, 0, "Tech", "Large"),
  build("MSFT", "Microsoft", 425, 0, "Software", "Large"),
  build("GOOGL", "Alphabet", 172, 0, "Tech", "Large"),
  build("AMZN", "Amazon", 186, 0, "E-commerce", "Large"),
  build("NVDA", "NVIDIA", 128, 0, "Semiconductors", "Large"),
  build("META", "Meta Platforms", 562, 0, "Tech", "Large"),
  build("TSLA", "Tesla", 248, 0, "Auto", "Large"),
  build("PLTR", "Palantir", 38, 0, "Software", "Large"),
  build("COIN", "Coinbase", 215, 0, "Fintech", "Large"),
  build("AMD", "AMD", 152, 0, "Semiconductors", "Large"),
];

const CRYPTO = [
  build("BTC", "Bitcoin", 62000, 0, "Crypto", "Large"),
  build("ETH", "Ethereum", 2450, 0, "Crypto", "Large"),
  build("SOL", "Solana", 145, 0, "Crypto", "Large"),
  build("XRP", "XRP", 0.58, 0, "Crypto", "Large"),
  build("BNB", "BNB", 565, 0, "Crypto", "Large"),
  build("ADA", "Cardano", 0.36, 0, "Crypto", "Mid"),
  build("DOGE", "Dogecoin", 0.11, 0, "Crypto", "Mid"),
  build("AVAX", "Avalanche", 26, 0, "Crypto", "Mid"),
  build("DOT", "Polkadot", 4.2, 0, "Crypto", "Mid"),
  build("MATIC", "Polygon", 0.42, 0, "Crypto", "Mid"),
  build("LINK", "Chainlink", 11.5, 0, "Crypto", "Mid"),
  build("LTC", "Litecoin", 68, 0, "Crypto", "Mid"),
];

const COMMODITY = [
  build("GOLD", "Gold", 2510, 0, "Metals", "Commodity"),
  build("SILVER", "Silver", 29.4, 0, "Metals", "Commodity"),
  build("CRUDE", "Crude Oil (WTI)", 72.5, 0, "Energy", "Commodity"),
  build("NATGAS", "Natural Gas", 2.2, 0, "Energy", "Commodity"),
  build("COPPER", "Copper", 4.15, 0, "Metals", "Commodity"),
  build("ALUMINIUM", "Aluminium", 2.35, 0, "Metals", "Commodity"),
];

const seenIN = new Set(IN_STOCKS.map((s) => s.sym));
const seenUS = new Set(US_STOCKS.map((s) => s.sym));
IN_STOCKS.push(...MORE_IN.filter((a) => !seenIN.has(a[0])).map((a) => build(a[0], a[1], a[2], dchg(a[0]), a[3], a[4] || "Large", a[5] || {})));
US_STOCKS.push(...MORE_US.filter((a) => !seenUS.has(a[0])).map((a) => build(a[0], a[1], a[2], dchg(a[0]), a[3], a[4] || "Large", a[5] || {})));

/* -------- Trim each universe to the requested set -------- */
const trimVol = (arr, n, keepSyms) => {
  const keep = new Set(keepSyms);
  const kept = arr.filter((s) => keep.has(s.sym));
  const rest = arr.filter((s) => !keep.has(s.sym) && s.price > 0.1).sort((a, b) => b.vol - a.vol).slice(0, n);
  const merged = [...kept, ...rest.filter((s) => s.price > 0.1)];
  arr.length = 0; arr.push(...merged);
};
const IN_KEEP = ["NIFTY50", "BANKNIFTY", "SENSEX", "FINNIFTY", "INDIAVIX", "RELIANCE", "HDFCBANK", "ICICIBANK", "SBIN", "TCS", "INFY", "TATAMOTORS", "TATAPOWER", "LT", "BAJFINANCE", "ADANIENT", "HAL", "BEL", "DIXON", "ITC"];
const US_KEEP = ["SPX", "NDX", "DJI", "VIX", "TSM", "PLTR", "MARA", "COIN", "RIOT", "PLUG", "BE", "INTC", "CVNA", "HOOD", "SHOP", "META", "GOOGL", "AAPL", "AMZN", "SNAP", "APLD", "SMCI", "NVDA"];
trimVol(IN_STOCKS, 50, IN_KEEP);         // top 50 Indian by volume (+ indexes & F&O names)
trimVol(US_STOCKS, 25, US_KEEP);         // top 25 US by volume (+ required names)
trimVol(CRYPTO, 10, ["SPX"]);            // top 10 crypto by volume, price > 0.1
// commodities: only the five requested
const COMMO_KEEP = new Set(["GOLD", "SILVER", "ALUMINIUM", "COPPER", "CRUDE"]);
{ const merged = COMMODITY.filter((s) => COMMO_KEEP.has(s.sym)); COMMODITY.length = 0; COMMODITY.push(...merged); }

const bySym = (arr, syms) => syms.map((s) => arr.find((a) => a.sym === s)).filter(Boolean);
const FNO = bySym(IN_STOCKS, ["NIFTY50", "BANKNIFTY", "FINNIFTY", "RELIANCE", "HDFCBANK", "ICICIBANK", "SBIN", "TCS", "INFY", "TATAMOTORS", "TATAPOWER", "LT", "BAJFINANCE", "ADANIENT", "HAL", "BEL", "DIXON", "ITC"]);
const UNIVERSE = { IN: IN_STOCKS, US: US_STOCKS, Crypto: CRYPTO, Commodity: COMMODITY, FNO };
const ALL = [...IN_STOCKS, ...US_STOCKS, ...CRYPTO, ...COMMODITY];
function marketOf(sym) {
  if (US_STOCKS.find((s) => s.sym === sym)) return "US";
  if (CRYPTO.find((s) => s.sym === sym)) return "Crypto";
  if (COMMODITY.find((s) => s.sym === sym)) return "Commodity";
  return "IN";
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
  NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK", SENSEX: "^BSESN", FINNIFTY: "^NSEFIN", INDIAVIX: "^INDIAVIX",
  SPX: "^GSPC", NDX: "^NDX", DJI: "^DJI", VIX: "^VIX",
  GOLD: "GC=F", SILVER: "SI=F", CRUDE: "CL=F", NATGAS: "NG=F", COPPER: "HG=F", ALUMINIUM: "ALI=F",
};
function yahooSymbol(sym) {
  if (Y_SPECIAL[sym]) return Y_SPECIAL[sym];
  const m = marketOf(sym);
  if (m === "Crypto") return sym + "-USD";
  if (m === "US") return sym;
  return sym + ".NS"; // NSE
}

export {
  IN_STOCKS, US_STOCKS, CRYPTO, COMMODITY, FNO, UNIVERSE, ALL,
  Y_SPECIAL, yahooSymbol, marketOf, istParts, marketHoursLabel,
};

/** Global index strip shown on the dashboard. */
export const GLOBAL_MKTS = [
  { n: "NIFTY 50", c: 0.62 }, { n: "SENSEX", c: 0.58 }, { n: "BANK NIFTY", c: 0.84 },
  { n: "S&P 500", c: 0.41 }, { n: "NASDAQ", c: 0.73 }, { n: "DOW", c: 0.22 },
  { n: "FTSE 100", c: -0.18 }, { n: "NIKKEI", c: 1.12 }, { n: "HANG SENG", c: -0.44 },
  { n: "BTC", c: 1.92 }, { n: "ETH", c: 2.64 }, { n: "GOLD", c: 0.54 }, { n: "CRUDE", c: -0.88 },
];

