import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, User, Wallet, Home, Repeat, Lightbulb, Bot, Bolt, Briefcase,
  Star, TrendingUp, TrendingDown, X, ChevronRight, Send, Plus, Trash2,
  ArrowUpRight, ArrowDownRight, Sparkles, SlidersHorizontal, Check,
  Activity, Newspaper, Building2, Filter, Play, Pause, ChevronLeft, Zap, Sun, Moon, Bell
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from "recharts";

/* ============================== THEME / CSS ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');
.theme-dark{
  --bg:#160E2B; --surface:#1E1638; --elev:#281E48; --ink:#F5F2FC; --ink-soft:#CBC3E0;
  --muted:#948BB4; --line:#342A54; --primary:#9A6CFF; --primary-2:#D07BF2;
  --primary-soft:rgba(154,108,255,.18); --up:#2FE0A6; --up-soft:rgba(47,224,166,.15);
  --down:#FF6B93; --down-soft:rgba(255,107,147,.15); --gold:#D07BF2; --gold-soft:rgba(154,108,255,.2);
  --lime:#C9FF3D; --grid:rgba(160,150,200,.14); --back:#0F0920;
  --shadow:0 1px 0 rgba(255,255,255,.06) inset, 0 30px 64px -24px rgba(10,0,30,.9), 0 12px 28px rgba(90,40,150,.28);
  --glow:0 20px 50px rgba(160,90,255,.55);
  --gold-grad:linear-gradient(120deg,#9A6CFF,#C06CF2 50%,#EC77E0);
  --silver-grad:linear-gradient(135deg,#6E6E78 0%,#C9C9D4 30%,#F4F4F8 50%,#B7B7C2 72%,#6E6E78 100%);
  --card-grad:linear-gradient(160deg,#241B42,#1A1230);
  --feature-grad:linear-gradient(145deg,#7C4DFF 0%,#A855F7 55%,#D06BEF 100%);
  --app-bg:radial-gradient(120% 60% at 50% -8%, #2A1B54 0%, #1B1136 42%, #140C26 100%);
  --header-bg:rgba(20,12,40,.72);
}
.theme-light{
  --bg:#F3EFFC; --surface:#FFFFFF; --elev:#FBF9FF; --ink:#1A1330; --ink-soft:#5A5274;
  --muted:#8A82A4; --line:#EBE5F8; --primary:#7C4DFF; --primary-2:#B85CF0;
  --primary-soft:#F0E8FF; --up:#12B98A; --up-soft:#E4F8F1;
  --down:#FF4D7D; --down-soft:#FFE9F0; --gold:#7C4DFF; --gold-soft:#F0E8FF;
  --lime:#C9FF3D; --grid:rgba(140,120,180,.14); --back:#EDE7FA;
  --shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 24px 50px -24px rgba(100,60,180,.26), 0 8px 18px rgba(100,60,180,.08);
  --glow:0 16px 38px rgba(124,77,255,.3);
  --gold-grad:linear-gradient(120deg,#7C4DFF,#A85CF2 50%,#DE6BE6);
  --silver-grad:linear-gradient(135deg,#9A9AA6 0%,#CFCFDA 30%,#FFFFFF 50%,#BFBFCC 72%,#9A9AA6 100%);
  --card-grad:linear-gradient(170deg,#FFFFFF,#F7F2FE);
  --feature-grad:linear-gradient(145deg,#7C4DFF 0%,#A855F7 55%,#D06BEF 100%);
  --app-bg:radial-gradient(120% 55% at 50% -6%, #EAE0FF 0%, #F3EEFC 45%, #F1EBFB 100%);
  --header-bg:rgba(255,255,255,.78);
}
*{box-sizing:border-box}
.mx{font-family:'Nunito',system-ui,sans-serif;color:var(--ink)}
.disp{font-family:'Quicksand','Nunito',sans-serif;letter-spacing:-.01em}
.mono{font-family:'Nunito',sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
.card{background:var(--card-grad);border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow)}
.flat{box-shadow:none}
.pill{border-radius:999px}
.hide-scroll::-webkit-scrollbar{display:none}
.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}
.tap{cursor:pointer;transition:transform .12s ease, box-shadow .12s ease, background .15s ease, opacity .15s}
.tap:active{transform:scale(.97)}
.glow{box-shadow:var(--glow)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .3s ease both}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet{animation:sheetUp .28s cubic-bezier(.22,1,.36,1) both}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shine{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(150,80,240,.65) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2.6s infinite}
.gradtext{background:linear-gradient(120deg,var(--primary),var(--primary-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.gold-text{background:var(--gold-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.gold-line{height:1px;background:var(--gold-grad);opacity:.85}
.silver-line{height:1px;background:var(--silver-grad);opacity:.7}
.gold-border{border:1px solid transparent;background:linear-gradient(var(--surface),var(--surface)) padding-box, var(--gold-grad) border-box}
.glass{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
input,textarea,select{font-family:inherit;color:var(--ink)}
.no-ring:focus{outline:2px solid var(--primary);outline-offset:1px}
input::placeholder,textarea::placeholder{color:var(--muted)}
select option{background:var(--surface);color:var(--ink)}
`;

/* ============================== HELPERS ============================== */
const CUR = { IN: "₹", US: "$", Crypto: "$", Commodity: "$" };
function fmt(n, market = "IN") {
  const c = CUR[market] || "₹";
  if (n == null || isNaN(n)) return c + "0";
  const opts = market === "IN"
    ? { maximumFractionDigits: 2 }
    : { maximumFractionDigits: 2 };
  const grouped = market === "IN"
    ? Number(n).toLocaleString("en-IN", opts)
    : Number(n).toLocaleString("en-US", opts);
  return c + grouped;
}
function compact(n) {
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}
function lcg(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
function series(sym, base, chg, points = 60) {
  const r = lcg(hash(sym) + 7);
  const start = base / (1 + chg / 100) * (0.92 + r() * 0.05);
  const out = [];
  let v = start;
  for (let i = 0; i < points; i++) {
    const drift = (base - v) * 0.06;
    const noise = (r() - 0.5) * base * 0.018;
    v = Math.max(base * 0.4, v + drift + noise);
    out.push({ i, p: +v.toFixed(2) });
  }
  out[points - 1].p = base;
  return out;
}
function candles(sym, base, chg, n = 34) {
  const pts = series(sym, base, chg, n + 1);
  const r = lcg(hash(sym) + 11);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const o = pts[i - 1].p, c = pts[i].p;
    const hi = Math.max(o, c) * (1 + r() * 0.012);
    const lo = Math.min(o, c) * (1 - r() * 0.012);
    out.push({ i, o: +o.toFixed(2), c: +c.toFixed(2), h: +hi.toFixed(2), l: +lo.toFixed(2), v: Math.round((0.5 + r()) * base * 1000) });
  }
  return out;
}
function quarters(sym, base, growth) {
  const r = lcg(hash(sym) + 3);
  const labels = ["Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25"];
  let v = base;
  return labels.map((q) => {
    v = v * (1 + growth / 100 + (r() - 0.5) * 0.05);
    return { q, v: Math.round(v) };
  });
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ============================== DATA ============================== */
function build(sym, name, price, chg, sector, cap, x = {}) {
  const h = hash(sym);
  const r = lcg(h);
  const vol = Math.round((x.vol ?? (2 + r() * 18)) * 1e6);
  const rsi = x.rsi ?? Math.round(28 + r() * 50);
  const pe = x.pe ?? +(12 + r() * 45).toFixed(1);
  const roe = x.roe ?? +(8 + r() * 28).toFixed(1);
  const sma50 = +(price * (0.96 + r() * 0.06)).toFixed(2);
  const sma200 = +(price * (0.9 + r() * 0.1)).toFixed(2);
  const macd = +((r() - 0.4) * 6).toFixed(2);
  const support = +(price * (0.93 - r() * 0.03)).toFixed(2);
  const resistance = +(price * (1.05 + r() * 0.04)).toFixed(2);
  const bull = x.bull ?? clamp(Math.round(50 + chg * 4 + (rsi - 50) * 0.6), 6, 96);
  const verdict = x.verdict ?? (bull >= 64 ? "Buy" : bull <= 40 ? "Sell" : "Hold");
  const revGrowth = x.revG ?? +(((r() - 0.3) * 30)).toFixed(1);
  const ebitdaGrowth = x.ebG ?? +(((r() - 0.3) * 34)).toFixed(1);
  return {
    sym, name, price, chg, sector, cap, vol, rsi, pe, roe, sma50, sma200, macd,
    support, resistance, bull, verdict, revGrowth, ebitdaGrowth,
    pick: x.pick, oneLiner: x.oneLiner || `${name} shows ${chg >= 0 ? "constructive" : "weak"} momentum; ${verdict.toLowerCase()} bias near current levels.`,
    news: x.news || [
      { d: "2d ago", t: `${name} reports steady quarterly traction across core segments.` },
      { d: "5d ago", t: `Analysts revisit ${sym} estimates after sector rotation.` },
    ],
    inst: x.inst,
    revBase: x.revBase ?? Math.round(2000 + r() * 18000),
    series: series(sym, price, chg),
    mdSpeech: x.mdSpeech || `Management struck a measured tone, flagging demand resilience and disciplined cost control while guiding for ${revGrowth >= 0 ? "continued" : "softer"} top-line growth.`,
    qSummary: x.qSummary || `Revenue trend is ${revGrowth >= 0 ? "improving" : "under pressure"}; margins ${ebitdaGrowth >= 0 ? "expanded" : "compressed"} on operating leverage and input costs.`,
  };
}

const IN_STOCKS = [
  build("RELIANCE", "Reliance Industries", 2945.6, 1.42, "Energy", "Large", {
    bull: 78, verdict: "Buy",
    pick: "Retail + Jio ramp with energy cash flows — a rare all-weather large cap setting up above its 50-DMA.",
    oneLiner: "Breakout above 50-DMA with rising volume; trend buyers favoured.",
    news: [{ d: "1d ago", t: "Jio adds record subscribers; ARPU inches up QoQ." }, { d: "4d ago", t: "Retail arm signals new-store acceleration into festive season." }],
    inst: [{ n: "SBI Mutual Fund", v: "₹1,240 Cr", c: 2.1 }, { n: "LIC", v: "₹980 Cr", c: 1.3 }],
    revBase: 235000, revG: 9.4, ebG: 12.1,
  }),
  build("TCS", "Tata Consultancy Services", 4012.3, -0.86, "IT", "Large", {
    bull: 58, verdict: "Hold",
    pick: "Deal pipeline intact but stock digesting gains — patient accumulation, not chase.",
    oneLiner: "Consolidating below resistance; wait for momentum confirmation.",
    revBase: 60000, revG: 6.2, ebG: 5.1, rsi: 47,
  }),
  build("HDFCBANK", "HDFC Bank", 1678.9, 0.94, "Banking", "Large", {
    bull: 71, verdict: "Buy",
    pick: "Merger synergies finally showing in NIM stability — banks' bellwether reclaiming leadership.",
    inst: [{ n: "ICICI Prudential", v: "₹860 Cr", c: 1.7 }],
    revBase: 80000, revG: 14.0, ebG: 13.2,
  }),
  build("INFY", "Infosys", 1542.0, 2.31, "IT", "Large", {
    bull: 74, verdict: "Buy",
    pick: "Upgraded FY guidance + buyback chatter — momentum and value lining up together.",
    revBase: 38000, revG: 7.8, ebG: 8.4, rsi: 63,
  }),
  build("TATAMOTORS", "Tata Motors", 982.4, 3.67, "Auto", "Large", {
    bull: 81, verdict: "Buy",
    pick: "JLR margins surprising + EV order book swelling — high-beta breakout with volume.",
    oneLiner: "Strong volume breakout; momentum traders in control.",
    news: [{ d: "6h ago", t: "JLR posts record wholesale volumes; demand robust." }],
    inst: [{ n: "Nippon India MF", v: "₹540 Cr", c: 3.4 }],
    revBase: 110000, revG: 11.2, ebG: 18.5, rsi: 68,
  }),
  build("ADANIENT", "Adani Enterprises", 3120.0, -2.14, "Infrastructure", "Large", {
    bull: 39, verdict: "Hold",
    pick: "Event-driven volatility — only for traders who respect tight stops.",
    rsi: 41,
  }),
  build("ZOMATO", "Zomato", 198.7, 4.85, "Consumer Tech", "Mid", {
    bull: 83, verdict: "Buy",
    pick: "Quick-commerce (Blinkit) inflecting to profitability — the GenZ growth story with real numbers now.",
    oneLiner: "Fresh all-time-high zone; trend strongly bullish.",
    news: [{ d: "1d ago", t: "Blinkit GOV growth outpaces food delivery again." }],
    inst: [{ n: "Motilal Oswal", v: "₹310 Cr", c: 5.2 }],
    revBase: 4200, revG: 58.0, ebG: 120.0, rsi: 71, pe: 88,
  }),
  build("DMART", "Avenue Supermarts", 4480.5, -0.42, "Retail", "Large", { bull: 55, revBase: 13000, revG: 17.0, ebG: 12.0 }),
  build("BAJFINANCE", "Bajaj Finance", 7210.0, 1.18, "NBFC", "Large", {
    bull: 69, verdict: "Buy",
    pick: "AUM compounding + digital app scaling — quality growth at a more reasonable price now.",
    revBase: 15000, revG: 26.0, ebG: 24.0,
  }),
  build("ITC", "ITC", 462.3, 0.31, "FMCG", "Large", { bull: 60, oneLiner: "Range-bound dividend play; low-beta accumulation.", revBase: 18000, revG: 5.0, ebG: 6.5 }),
  build("PAYTM", "One97 (Paytm)", 412.9, -3.92, "Fintech", "Mid", {
    bull: 34, verdict: "Sell",
    pick: "Regulatory overhang persists — avoid until clarity; for nimble traders only.",
    rsi: 33, pe: 0,
  }),
  build("IRCTC", "IRCTC", 902.1, 2.04, "Travel", "Mid", { bull: 66, verdict: "Buy", revBase: 1100, revG: 13.0, ebG: 15.0 }),
  build("TATAPOWER", "Tata Power", 412.8, 5.21, "Power", "Mid", {
    bull: 79, verdict: "Buy",
    pick: "Renewables capex + smart-meter wins — the energy-transition midcap with momentum.",
    oneLiner: "Volume-led breakout; renewables theme in play.", rsi: 70,
  }),
  build("HAL", "Hindustan Aeronautics", 4890.0, 1.77, "Defence", "Large", {
    bull: 75, verdict: "Buy",
    pick: "Order book visibility for years + Make-in-India tailwind — structural defence leader.",
    revBase: 8000, revG: 16.0, ebG: 19.0,
  }),
  build("NYKAA", "FSN E-Commerce (Nykaa)", 178.4, 1.05, "Consumer Tech", "Mid", { bull: 57, revBase: 1900, revG: 24.0, ebG: 40.0, pe: 95 }),
  build("IDEA", "Vodafone Idea", 8.4, -1.18, "Telecom", "Small", { bull: 31, verdict: "Sell", oneLiner: "Penny-cap, balance-sheet stress; high risk." }),
  build("SBIN", "State Bank of India", 842.6, 1.36, "Banking", "Large", { bull: 70, verdict: "Buy", pick: "Cheapest large PSU bank with improving asset quality and credit growth.", revBase: 105000, revG: 12, inst: [{ n: "LIC", v: "₹1,420 Cr", c: 1.9 }] }),
  build("ICICIBANK", "ICICI Bank", 1186.2, 0.78, "Banking", "Large", { bull: 73, verdict: "Buy", revBase: 62000, revG: 15 }),
  build("LT", "Larsen & Toubro", 3624.0, 1.92, "Infrastructure", "Large", { bull: 72, verdict: "Buy", pick: "Record order book + infra capex super-cycle — execution machine.", revBase: 55000, revG: 14 }),
  build("SUNPHARMA", "Sun Pharma", 1788.5, 0.46, "Pharma", "Large", { bull: 64, verdict: "Buy", revBase: 12000, revG: 9 }),
  build("DIXON", "Dixon Technologies", 14250.0, 3.42, "Electronics", "Mid", { bull: 80, verdict: "Buy", pick: "PLI-led EMS leader; mobile & component backward-integration scaling fast.", rsi: 69, revBase: 8500, revG: 44 }),
  build("YESBANK", "Yes Bank", 21.8, -2.34, "Banking", "Small", { bull: 38, verdict: "Sell", oneLiner: "Turnaround unproven; speculative small-cap." }),
  build("BEL", "Bharat Electronics", 312.4, 2.18, "Defence", "Large", { bull: 76, verdict: "Buy", pick: "Defence electronics order pipeline + margin strength.", revBase: 5400, revG: 18 }),
  build("DRREDDY", "Dr. Reddy's Labs", 1268.0, -0.62, "Pharma", "Large", { bull: 55, revBase: 7200, revG: 7 }),
  build("MARUTI", "Maruti Suzuki", 12640.0, 0.94, "Auto", "Large", { bull: 66, verdict: "Buy", revBase: 38000, revG: 10 }),
  build("NIFTY50", "Nifty 50 Index", 23450.0, 0.62, "Index", "Large", { bull: 68, verdict: "Buy", pick: "Benchmark holding near highs; broad-market momentum constructive with healthy breadth.", inst: [{ n: "Index basket", v: "₹—" }] }),
  build("BANKNIFTY", "Bank Nifty Index", 50480.0, 0.84, "Index", "Large", { bull: 66, verdict: "Buy", pick: "Financials leading; reclaim of resistance keeps the index bid." }),
  build("SENSEX", "BSE Sensex", 77100.0, 0.58, "Index", "Large", { bull: 67, verdict: "Buy" }),
  build("FINNIFTY", "Fin Nifty Index", 23180.0, 0.71, "Index", "Large", { bull: 65, verdict: "Buy" }),
  build("INDIAVIX", "India VIX", 13.8, -2.1, "Volatility", "Large", { bull: 42, verdict: "Hold", oneLiner: "Volatility gauge — low reading signals complacency; spikes flag fear.", pick: "Low VIX = calm tape; hedges are cheap here." }),
];

const US_STOCKS = [
  build("NVDA", "NVIDIA", 124.6, 2.85, "Semiconductors", "Large", { bull: 86, verdict: "Buy", pick: "AI compute demand still outstripping supply — the pick-and-shovel king of the GenAI era.", rsi: 72, revBase: 26000, revG: 122, inst: [{ n: "Vanguard", v: "$8.2 B", c: 1.1 }] }),
  build("TSLA", "Tesla", 248.3, -1.46, "Auto", "Large", { bull: 52, pick: "Robotaxi narrative vs. delivery reality — binary; size positions carefully.", rsi: 49 }),
  build("AAPL", "Apple", 214.1, 0.62, "Tech", "Large", { bull: 64, verdict: "Buy", revBase: 90000, revG: 5 }),
  build("AMZN", "Amazon", 186.9, 1.34, "E-commerce", "Large", { bull: 70, verdict: "Buy", revBase: 148000, revG: 11 }),
  build("PLTR", "Palantir", 27.8, 4.12, "Software", "Mid", { bull: 78, verdict: "Buy", pick: "Commercial AI deals accelerating — high-beta momentum favourite.", rsi: 69 }),
  build("META", "Meta Platforms", 498.2, 1.01, "Tech", "Large", { bull: 67, verdict: "Buy" }),
  build("MSFT", "Microsoft", 449.8, 0.74, "Tech", "Large", { bull: 72, verdict: "Buy", pick: "Copilot monetization + Azure AI demand — durable compounder.", revBase: 62000, revG: 16 }),
  build("GOOGL", "Alphabet", 178.2, 1.22, "Tech", "Large", { bull: 69, verdict: "Buy", revBase: 80000, revG: 13 }),
  build("AMD", "Advanced Micro Devices", 162.4, 2.96, "Semiconductors", "Large", { bull: 74, verdict: "Buy", pick: "MI300 AI accelerators ramping — the credible #2 to NVDA.", rsi: 66 }),
  build("COIN", "Coinbase", 224.6, 3.88, "Fintech", "Mid", { bull: 63, pick: "Levered to crypto cycle + spot ETF flows; high beta.", rsi: 64 }),
  build("SPX", "S&P 500 Index", 5460.0, 0.41, "Index", "Large", { bull: 64, verdict: "Buy", pick: "Broad US benchmark grinding higher on soft-landing hopes." }),
  build("NDX", "Nasdaq 100 Index", 19250.0, 0.73, "Index", "Large", { bull: 69, verdict: "Buy", pick: "Tech-heavy index riding AI leadership; momentum strong." }),
  build("DJI", "Dow Jones Index", 39200.0, 0.22, "Index", "Large", { bull: 58, verdict: "Hold" }),
  build("VIX", "CBOE Volatility Index", 13.4, -1.8, "Volatility", "Large", { bull: 44, verdict: "Hold", oneLiner: "US fear gauge — subdued now; watch for spikes on macro shocks." }),
];
const CRYPTO = [
  build("BTC", "Bitcoin", 64210.0, 1.92, "Crypto", "Large", { bull: 71, verdict: "Buy", pick: "Post-halving supply squeeze + ETF inflows — the macro hedge GenZ actually holds.", rsi: 61 }),
  build("ETH", "Ethereum", 3420.0, 2.64, "Crypto", "Large", { bull: 68, verdict: "Buy", rsi: 63 }),
  build("SOL", "Solana", 148.7, 4.88, "Crypto", "Mid", { bull: 76, verdict: "Buy", pick: "Throughput + meme/app activity — high-beta alt with strong momentum.", rsi: 70 }),
  build("DOGE", "Dogecoin", 0.142, -2.1, "Crypto", "Small", { bull: 44, oneLiner: "Sentiment-driven; trade the meme, mind the stops." }),
  build("XRP", "XRP", 0.61, 1.18, "Crypto", "Large", { bull: 58, verdict: "Hold" }),
  build("BNB", "BNB", 592.0, 0.84, "Crypto", "Large", { bull: 62, verdict: "Buy" }),
  build("AVAX", "Avalanche", 36.2, 3.42, "Crypto", "Mid", { bull: 67, verdict: "Buy", pick: "Subnet adoption + RWA tokenization narrative.", rsi: 65 }),
];
const COMMODITY = [
  build("GOLD", "Gold (per oz)", 2358.0, 0.54, "Metals", "Large", { bull: 66, verdict: "Buy", pick: "Rate-cut hopes + central-bank buying — classic risk-off ballast." }),
  build("SILVER", "Silver (per oz)", 30.7, 1.42, "Metals", "Mid", { bull: 63, verdict: "Buy" }),
  build("CRUDE", "Crude Oil (WTI)", 78.4, -0.88, "Energy", "Large", { bull: 48, oneLiner: "Range-bound on supply-demand tug; event-sensitive." }),
  build("NATGAS", "Natural Gas", 2.84, 2.06, "Energy", "Mid", { bull: 54, verdict: "Hold" }),
  build("COPPER", "Copper", 4.52, 1.12, "Metals", "Large", { bull: 68, verdict: "Buy", pick: "Electrification + grid demand — structural metal of the decade." }),
];

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
// Synthetic option-chain snapshot for an instrument (ATM strike, premium, OI).
function fnoData(s) {
  const r = lcg(hash(s.sym + "fno"));
  const rec = s.chg >= 0 ? "CALL" : "PUT";
  const step = s.price > 10000 ? 100 : s.price > 1000 ? 50 : s.price > 100 ? 10 : s.price > 20 ? 1 : 0.5;
  const atm = Math.round(s.price / step) * step;
  const premium = +(s.price * (0.012 + r() * 0.02)).toFixed(1);
  const oi = Math.round(4 + r() * 46) * 100000;
  const oiChg = +(((r() - 0.4) * 34)).toFixed(1);
  return { rec, atm, premium, oi, oiChg };
}

/* ============================== SMALL UI ============================== */
function Change({ v, big }) {
  const up = v >= 0;
  return (
    <span className="mono" style={{ color: up ? "var(--up)" : "var(--down)", fontWeight: 700, fontSize: big ? 15 : 12.5, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <ArrowUpRight size={big ? 16 : 13} /> : <ArrowDownRight size={big ? 16 : 13} />}
      {up ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}
function Spark({ data, up }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.slice(-24)} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={up ? "gu" : "gd"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#0FB97D" : "#FF4D67"} stopOpacity={0.35} />
            <stop offset="100%" stopColor={up ? "#0FB97D" : "#FF4D67"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="p" stroke={up ? "#0FB97D" : "#FF4D67"} strokeWidth={2} fill={`url(#${up ? "gu" : "gd"})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
function Gauge({ value, label }) {
  // semicircle 0..100; <40 bear, >64 bull
  const a = Math.PI * (1 - value / 100);
  const cx = 80, cy = 78, R = 64;
  const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
  const color = value >= 64 ? "var(--up)" : value <= 40 ? "var(--down)" : "#E8A33D";
  const word = value >= 64 ? "Bullish" : value <= 40 ? "Bearish" : "Neutral";
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="160" height="96" viewBox="0 0 160 96">
        <path d="M16 78 A64 64 0 0 1 144 78" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
        <path d="M16 78 A64 64 0 0 1 144 78" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={Math.PI * R} strokeDashoffset={Math.PI * R * (1 - value / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
        <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
      </svg>
      <div className="disp" style={{ fontWeight: 700, color, marginTop: -8 }}>{word}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label} · {value}/100</div>
    </div>
  );
}
function VerdictTag({ v, size = 13 }) {
  const map = { Buy: ["var(--up-soft)", "var(--up)"], Sell: ["var(--down-soft)", "var(--down)"], Hold: ["rgba(245,158,66,.16)", "#F59E42"] };
  const [bg, fg] = map[v] || map.Hold;
  return <span className="pill disp" style={{ background: bg, color: fg, fontWeight: 700, fontSize: size, padding: "4px 12px" }}>{v}</span>;
}
function CapTag({ c }) {
  return <span className="pill" style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 10.5, fontWeight: 600, padding: "2px 8px" }}>{c} Cap</span>;
}
function Pop({ children, style, className, amount = 0.03 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const center = r.top + r.height / 2;
      const dist = Math.min(1, Math.abs(center - vh / 2) / (vh / 2));
      const t = 1 - dist;
      el.style.transform = `scale(${(1 - amount + amount * t * 2).toFixed(3)})`;
      el.style.opacity = (0.62 + 0.38 * t).toFixed(3);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [amount]);
  return <div ref={ref} className={className} style={{ transition: "transform .18s ease, opacity .18s ease", willChange: "transform, opacity", ...style }}>{children}</div>;
}
function Section({ title, icon, right, children }) {
  return (
    <Pop className="fade" style={{ marginTop: 48 }}>
      <div className="mx" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "0 2px" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>{icon}{title}</div>
        {right}
      </div>
      <div className="gold-line" style={{ width: 44, margin: "0 0 16px 2px", borderRadius: 2 }} />
      {children}
    </Pop>
  );
}

/* ============================== STOCK ROW / CARD ============================== */
function AddBtn({ on, onClick, size = 28 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="tap" title={on ? "In watchlist" : "Add to watchlist"}
      style={{ width: size, height: size, borderRadius: 9, border: "1px solid " + (on ? "var(--primary)" : "var(--line)"), background: on ? "var(--primary)" : "var(--elev)", color: on ? "#fff" : "var(--primary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
      {on ? <Check size={Math.round(size * 0.55)} /> : <Plus size={Math.round(size * 0.6)} />}
    </button>
  );
}
function MiniRow({ s, market, onOpen, extra, watched, toggleWatch }) {
  return (
    <div className="card tap" onClick={() => onOpen(s)} style={{ padding: 14, minWidth: 158, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", maxWidth: 96, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
        </div>
        {toggleWatch && <AddBtn on={watched} onClick={() => toggleWatch(s.sym)} size={26} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 2 }}>
        <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{fmt(s.price, market)}</span>
        <Change v={s.chg} />
      </div>
      {extra && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{extra}</div>}
    </div>
  );
}
function ListRow({ s, market, onOpen, right, watched, toggleWatch }) {
  return (
    <div className="tap" onClick={() => onOpen(s)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>{s.sym}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(s.price, market)}</div>
        {right || <Change v={s.chg} />}
      </div>
      {toggleWatch && <AddBtn on={watched} onClick={() => toggleWatch(s.sym)} size={26} />}
    </div>
  );
}
/* carousel card: header (sym+price+change+add) plus a body slot */
function CarouselCard({ s, market, onOpen, children, width = 250, watched, toggleWatch }) {
  return (
    <div className="card tap" onClick={() => onOpen(s)} style={{ flex: "0 0 auto", width, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
        </div>
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{fmt(s.price, market)}</div>
          <Change v={s.chg} />
        </div>
        {toggleWatch && <AddBtn on={watched} onClick={() => toggleWatch(s.sym)} size={26} />}
      </div>
      {children}
    </div>
  );
}

/* ============================== ASK MATRIX (real Claude API) ============================== */
/* ============================== ASK MATRIX (backend proxy or in-app) ============================== */
// Set BACKEND_URL to your deployed proxy (e.g. "https://your-matrix-proxy.onrender.com")
// to keep the Anthropic key server-side. Empty string = in-app mode (key injected by the
// host runtime), which is what runs inside this preview.
const BACKEND_URL = "https://matrix-qp1i.onrender.com";
const MATRIX_PERSONA = "You are Matrix — the world's sharpest stock-market research assistant, fluent in fundamental analysis, technical analysis and macro/news-driven investing. Answer with crisp, structured, practical insight a confident GenZ investor can act on. Use short paragraphs or tight bullets. When giving a view, lay out the bull case, bear case and key levels rather than a bare command. Always end with a one-line reminder that this is educational research, not financial advice.";

/* ------- LIVE PRICES (Yahoo Finance via the backend proxy) -------
 * Yahoo can't be called straight from the browser (CORS + crumb auth), so live
 * quotes come through the proxy: app → /api/quote → Yahoo. When BACKEND_URL is
 * empty (this preview), the app stays on realistic simulated data. Map app
 * tickers → Yahoo tickers below. */
const Y_SPECIAL = {
  NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK", SENSEX: "^BSESN", FINNIFTY: "^NSEFIN", INDIAVIX: "^INDIAVIX",
  SPX: "^GSPC", NDX: "^NDX", DJI: "^DJI", VIX: "^VIX",
  GOLD: "GC=F", SILVER: "SI=F", CRUDE: "CL=F", NATGAS: "NG=F", COPPER: "HG=F",
  ZOMATO: "ETERNAL.NS", // NSE renamed Zomato Ltd -> Eternal Ltd (Mar 2025); old ZOMATO.NS ticker no longer resolves
};
function yahooSymbol(sym) {
  if (Y_SPECIAL[sym]) return Y_SPECIAL[sym];
  const m = marketOf(sym);
  if (m === "Crypto") return sym + "-USD";
  if (m === "US") return sym;
  return sym + ".NS"; // NSE
}
async function fetchLiveQuotes(appSyms) {
  if (!BACKEND_URL) return null;
  const map = {};
  appSyms.forEach((s) => { map[yahooSymbol(s)] = s; });
  const tickers = Object.keys(map);
  const r = await fetch(`${BACKEND_URL}/api/quote?symbols=${encodeURIComponent(tickers.join(","))}`);
  if (!r.ok) throw new Error("quote " + r.status);
  const d = await r.json();
  return (d.quotes || []).map((q) => ({ sym: map[q.sym] || q.sym, price: q.price, chg: q.chg })).filter((x) => x.sym && x.price != null);
}

/* ------------------------------ AUTH (backend) ------------------------------ */
const AUTH_KEY = "matrix_user"; // localStorage key holding the logged-in session
async function apiSignup(identifier, name, pin) {
  const r = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, name, pin }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Signup failed");
  return d.user;
}
async function apiLogin(identifier, pin) {
  const r = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Login failed");
  return d.user;
}
async function apiSaveProfile(identifier, profile) {
  const r = await fetch(`${BACKEND_URL}/api/auth/profile`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, profile }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Could not save profile");
  return d.user;
}

async function askMatrix(messages, system, maxTokens = 1000) {
  if (BACKEND_URL) {
    // Proxy mode — key never touches the client.
    const r = await fetch(`${BACKEND_URL}/api/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system, max_tokens: maxTokens }),
    });
    if (!r.ok) throw new Error("proxy " + r.status);
    const d = await r.json();
    return (d.text || "").trim();
  }
  // In-app fallback (host runtime injects the key).
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  const d = await r.json();
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

function useMatrixChat(context) {
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  async function send(text) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setBusy(true);
    const system = `${MATRIX_PERSONA}${context ? "\n\nCURRENT CONTEXT:\n" + context : ""}`;
    try {
      const out = await askMatrix(next, system, 1000);
      setMsgs([...next, { role: "assistant", content: out || "I couldn't generate a response just now — try rephrasing." }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: "Connection hiccup reaching the Matrix engine. Please try again." }]);
    } finally { setBusy(false); }
  }
  return { msgs, busy, send, reset: () => setMsgs([]) };
}
function ChatPanel({ context, suggestions, compactMode }) {
  const { msgs, busy, send } = useMatrixChat(context);
  const [text, setText] = useState("");
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy]);
  const fire = (t) => { send(t); setText(""); };
  return (
    <div className="mx" style={{ display: "flex", flexDirection: "column", height: compactMode ? 360 : "100%" }}>
      <div ref={scroller} className="hide-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 18, fontSize: 13 }}>
            <Bot size={26} color="var(--primary)" /><div style={{ marginTop: 6 }}>Ask Matrix anything — stocks, levels, strategy.</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
            <div className="pill" style={{
              background: m.role === "user" ? "var(--primary)" : "var(--surface)",
              color: m.role === "user" ? "#fff" : "var(--ink)",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 13px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {busy && <div style={{ color: "var(--muted)", fontSize: 12.5, paddingLeft: 4 }}>Matrix is thinking…</div>}
      </div>
      {suggestions && msgs.length === 0 && (
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 2px" }}>
          {suggestions.map((q) => (
            <button key={q} onClick={() => fire(q)} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 600, padding: "7px 12px" }}>{q}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fire(text)}
          placeholder="Ask Matrix…" className="no-ring"
          style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 14, padding: "11px 14px", fontSize: 13.5, background: "var(--surface)" }} />
        <button onClick={() => fire(text)} className="tap" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 14, width: 46, display: "grid", placeItems: "center" }}><Send size={17} /></button>
      </div>
    </div>
  );
}

/* ============================== STOCK DRAWER ============================== */
function Drawer({ s, onClose, onDetails }) {
  if (!s) return null;
  const market = marketOf(s.sym);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.32)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "24px 24px 0 0", maxHeight: "88vh", overflowY: "auto", padding: 18 }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>{s.sym}</div>
            <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{s.name}</div>
          </div>
          <X size={22} className="tap" onClick={onClose} color="var(--muted)" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 26 }}>{fmt(s.price, market)}</span>
          <Change v={s.chg} big />
        </div>
        <div style={{ height: 70, marginTop: 8 }}><Spark data={s.series} up={s.chg >= 0} /></div>

        <Block title="Key news / event" icon={<Newspaper size={14} />}>{s.news[0].t}</Block>
        <Block title="Technical summary" icon={<Activity size={14} />}>
          RSI {s.rsi} ({s.rsi > 70 ? "overbought" : s.rsi < 30 ? "oversold" : "neutral"}), price {s.price > s.sma50 ? "above" : "below"} 50-DMA. Support {fmt(s.support, market)} · Resistance {fmt(s.resistance, market)}.
        </Block>
        <Block title="Fundamental summary" icon={<Building2 size={14} />}>
          P/E {s.pe || "—"}, ROE {s.roe}%. Revenue growth {s.revGrowth}%, EBITDA growth {s.ebitdaGrowth}%. {s.qSummary}
        </Block>

        <div className="card" style={{ marginTop: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Matrix's verdict</div>
            <div className="disp" style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{s.verdict} near {fmt(s.price, market)}</div>
          </div>
          <VerdictTag v={s.verdict} size={15} />
        </div>

        <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "14px 2px 6px", fontWeight: 600 }}>Ask Matrix</div>
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto" }}>
          {["Should I buy right now?", "Support & resistance?", "Good time to enter?"].map((q) => (
            <button key={q} onClick={() => onDetails(s)} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12, fontWeight: 600, padding: "7px 12px", color: "var(--ink)" }}>{q}</button>
          ))}
        </div>

        <button onClick={() => onDetails(s)} className="tap disp glow" style={{ width: "100%", marginTop: 16, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 16, padding: "14px", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          View full details <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
function Block({ title, icon, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>{icon}{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/* ============================== STOCK DETAIL PAGE ============================== */
function CandleChart({ data, market, sup0, res0 }) {
  const [sup, setSup] = useState(sup0);
  const [res, setRes] = useState(res0);
  const drag = useRef(null);
  const box = useRef(null);
  const W = data.length * 11, H = 260, padT = 8, padB = 8;
  const lows = data.map((d) => d.l), highs = data.map((d) => d.h);
  const min = Math.min(...lows, sup, res) * 0.996;
  const max = Math.max(...highs, sup, res) * 1.004;
  const yOf = (p) => padT + (max - p) / (max - min) * (H - padT - padB);
  const priceAt = (clientY) => {
    const r = box.current.getBoundingClientRect();
    const frac = clamp((clientY - r.top) / r.height, 0, 1);
    return max - (frac * H - padT) / (H - padT - padB) * (max - min);
  };
  const down = (e) => {
    const p = priceAt(e.clientY);
    drag.current = Math.abs(p - sup) < Math.abs(p - res) ? "sup" : "res";
    box.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    const p = +priceAt(e.clientY).toFixed(2);
    drag.current === "sup" ? setSup(p) : setRes(p);
  };
  const up = () => { drag.current = null; };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Drag the gold & silver lines to set your levels</span>
        <span style={{ fontSize: 11, display: "flex", gap: 10 }}>
          <span className="gold-text" style={{ fontWeight: 800 }}>R {fmt(res, market)}</span>
          <span style={{ color: "#B7B7C2", fontWeight: 800 }}>S {fmt(sup, market)}</span>
        </span>
      </div>
      <div ref={box} style={{ width: "100%", touchAction: "none", cursor: "ns-resize" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
          {data.map((d) => {
            const x = d.i * 11 - 5.5, up = d.c >= d.o;
            const col = up ? "#1FE08C" : "#FF5C77";
            const yO = yOf(d.o), yC = yOf(d.c);
            return (
              <g key={d.i}>
                <line x1={x} x2={x} y1={yOf(d.h)} y2={yOf(d.l)} stroke={col} strokeWidth="1.2" />
                <rect x={x - 3} y={Math.min(yO, yC)} width="6" height={Math.max(2, Math.abs(yC - yO))} fill={col} rx="1" />
              </g>
            );
          })}
          {/* resistance (purple) */}
          <line x1="0" x2={W} y1={yOf(res)} y2={yOf(res)} stroke="#A99BFF" strokeWidth="1.4" strokeDasharray="6 4" />
          <rect x={W - 26} y={yOf(res) - 7} width="26" height="14" rx="3" fill="#A99BFF" />
          {/* support (silver) */}
          <line x1="0" x2={W} y1={yOf(sup)} y2={yOf(sup)} stroke="#C9C9D4" strokeWidth="1.4" strokeDasharray="6 4" />
          <rect x={W - 26} y={yOf(sup) - 7} width="26" height="14" rx="3" fill="#C9C9D4" />
        </svg>
      </div>
    </div>
  );
}
function DetailPage({ s, onBack, watched, toggleWatch, onTrade }) {
  const market = marketOf(s.sym);
  const [tf, setTf] = useState(60);
  const [active, setActive] = useState("overview");
  const [chartType, setChartType] = useState("candles");
  const [deepBusy, setDeepBusy] = useState(false);
  const [deepText, setDeepText] = useState("");
  const refs = useRef({});
  const rev = useMemo(() => quarters(s.sym, s.revBase, s.revGrowth), [s]);
  const ebd = useMemo(() => quarters(s.sym + "e", s.revBase * 0.28, s.ebitdaGrowth), [s]);
  const cdata = useMemo(() => candles(s.sym, s.price, s.chg, Math.round(tf / 1.8)), [s, tf]);
  const data = s.series.slice(-tf);
  const tabs = [["overview", "Overview"], ["fund", "Fundamentals"], ["tech", "Technicals"], ["news", "News"], ["ask", "Ask Matrix"]];
  const ctx = `Stock: ${s.name} (${s.sym}), market ${market}. Price ${fmt(s.price, market)} (${s.chg >= 0 ? "+" : ""}${s.chg}% today). RSI ${s.rsi}, P/E ${s.pe}, ROE ${s.roe}%, 50-DMA ${s.sma50}, 200-DMA ${s.sma200}, support ${s.support}, resistance ${s.resistance}. Revenue growth ${s.revGrowth}%, EBITDA growth ${s.ebitdaGrowth}%. Latest quarter: ${s.qSummary} MD commentary: ${s.mdSpeech} Recent news: ${s.news.map((n) => n.t).join(" | ")}. Matrix bull/bear score ${s.bull}/100, verdict ${s.verdict}.`;

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.dataset.sec); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [s]);

  const jump = (k) => { const el = refs.current[k]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  async function askDeep() {
    if (deepBusy) return;
    setDeepBusy(true); setDeepText("");
    const system = `You are Matrix — the world's sharpest equity-research assistant. Produce a structured deep-dive with these headed parts: Technical setup; Latest quarterly results; Recent news & catalysts; Bottom-line verdict with key levels. Be crisp and use short paragraphs. End with: "Educational research, not financial advice."\n\nCONTEXT:\n${ctx}`;
    try {
      const t = await askMatrix([{ role: "user", content: `Give me a comprehensive deep analysis of ${s.name} (${s.sym}) right now.` }], system, 1100);
      setDeepText(t || "Couldn't generate a deep analysis just now — please try again.");
    } catch { setDeepText("Connection hiccup reaching the Matrix engine. Please try again."); }
    finally { setDeepBusy(false); }
  }

  const secStyle = { scrollMarginTop: 118, marginTop: 34 };
  const Heading = ({ icon, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>{icon}{children}</div>
      <div className="gold-line" style={{ width: 44, marginTop: 7, borderRadius: 2 }} />
    </div>
  );

  return (
    <div className="mx fade" style={{ paddingBottom: 40 }}>
      <div className="glass" style={{ position: "sticky", top: 0, background: "var(--header-bg)", zIndex: 20, paddingTop: 6, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center" }}><ChevronLeft size={20} /></button>
          <div style={{ textAlign: "center" }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>{s.sym}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{s.name}</div>
          </div>
          <button onClick={() => toggleWatch(s.sym)} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center" }}>
            <Star size={18} fill={watched ? "var(--primary)" : "none"} color={watched ? "var(--primary)" : "var(--muted)"} />
          </button>
        </div>
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10 }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => jump(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 12.5, fontWeight: 700, border: "1px solid " + (active === k ? "var(--primary)" : "var(--line)"), background: active === k ? "var(--primary)" : "var(--surface)", color: active === k ? "#fff" : "var(--ink)" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
        <span className="mono" style={{ fontWeight: 800, fontSize: 30 }}>{fmt(s.price, market)}</span>
        <Change v={s.chg} big />
      </div>

      {/* OVERVIEW */}
      <div data-sec="overview" ref={(el) => (refs.current.overview = el)} style={{ scrollMarginTop: 118, marginTop: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["candles", "Candles"], ["area", "Area"]].map(([k, l]) => (
              <button key={k} onClick={() => setChartType(k)} className="pill tap disp" style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 13px", border: "1px solid " + (chartType === k ? "var(--primary)" : "var(--line)"), background: chartType === k ? "var(--primary)" : "transparent", color: chartType === k ? "#fff" : "var(--muted)" }}>{l}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {[[24, "1M"], [40, "3M"], [60, "6M"]].map(([n, l]) => (
                <button key={l} onClick={() => setTf(n)} className="pill tap" style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", border: "none", background: tf === n ? "var(--primary-soft)" : "transparent", color: tf === n ? "var(--primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
          </div>
          {chartType === "candles" ? (
            <CandleChart key={s.sym + tf} data={cdata} market={market} sup0={s.support} res0={s.resistance} />
          ) : (
            <div style={{ height: 244 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs><linearGradient id="big" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} stopOpacity={0.3} /><stop offset="100%" stopColor={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <YAxis domain={["dataMin", "dataMax"]} hide />
                  <Tooltip formatter={(v) => fmt(v, market)} labelFormatter={() => ""} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} itemStyle={{ color: "var(--ink)" }} />
                  <ReferenceLine y={s.support} stroke="#C9C9D4" strokeDasharray="4 4" />
                  <ReferenceLine y={s.resistance} stroke="#A99BFF" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="p" stroke={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} strokeWidth={2.4} fill="url(#big)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ marginTop: 12, padding: 16, background: "linear-gradient(160deg,var(--primary-soft),var(--surface))" }}>
          <div className="disp" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={16} color="var(--primary)" /> Matrix's analysis</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
            {s.pick || s.oneLiner} Technically, RSI sits at {s.rsi} with price {s.price > s.sma50 ? "above" : "below"} the 50-DMA and {s.sma50 > s.sma200 ? "a bullish" : "a bearish"} 50/200 structure. Fundamentally, revenue is {s.revGrowth >= 0 ? "growing" : "contracting"} {Math.abs(s.revGrowth)}% with EBITDA {s.ebitdaGrowth >= 0 ? "expanding" : "compressing"} {Math.abs(s.ebitdaGrowth)}%. Net verdict: <b>{s.verdict}</b>.
          </p>
          <button onClick={askDeep} disabled={deepBusy} className="tap disp glow" style={{ width: "100%", marginTop: 14, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 12, fontWeight: 700, fontSize: 13.5, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", opacity: deepBusy ? 0.7 : 1 }}>
            <Sparkles size={16} /> {deepBusy ? "Generating deep analysis…" : "Deep Analysis"}
          </button>
        </div>
        {(deepText || deepBusy) && (
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Sparkles size={15} color="var(--primary)" /> Matrix Deep Analysis</div>
            {deepBusy && !deepText ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Pulling technicals, latest quarter and news together…</div>
              : <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{deepText}</div>}
          </div>
        )}
        <button onClick={() => onTrade(s)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--elev)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, fontWeight: 700, fontSize: 14.5 }}>Trade {s.sym} with virtual money</button>
      </div>

      {/* FUNDAMENTALS */}
      <div data-sec="fund" ref={(el) => (refs.current.fund = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Building2 size={18} color="var(--primary)" />}>Fundamentals</Heading>
          <Gauge value={s.bull} label="Fundamental health" />
          <ChartCard title="Revenue (quarterly)" sub={`${s.revGrowth >= 0 ? "+" : ""}${s.revGrowth}% trend`}>
            <BarBlock data={rev} color="var(--primary)" />
          </ChartCard>
          <ChartCard title="EBITDA (quarterly)" sub={`${s.ebitdaGrowth >= 0 ? "+" : ""}${s.ebitdaGrowth}% trend`}>
            <BarBlock data={ebd} color="#0FB97D" />
          </ChartCard>
          <StatGrid rows={[["P/E", s.pe || "—"], ["ROE", s.roe + "%"], ["Mkt cap class", s.cap], ["Sector", s.sector], ["Rev growth", s.revGrowth + "%"], ["EBITDA growth", s.ebitdaGrowth + "%"]]} />
          <TextCard title="Quarterly results summary">{s.qSummary}</TextCard>
          <TextCard title="MD's speech — summary">{s.mdSpeech}</TextCard>
          <TextCard title="Matrix's summary" accent>Fundamentals score {s.bull}/100. {s.revGrowth >= 8 ? "Healthy top-line compounding" : "Modest growth"} paired with {s.ebitdaGrowth >= 8 ? "expanding margins" : "watchful margins"} keeps the structural bias <b>{s.verdict}</b>.</TextCard>
        </Pop>
      </div>

      {/* TECHNICALS */}
      <div data-sec="tech" ref={(el) => (refs.current.tech = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Activity size={18} color="var(--primary)" />}>Technicals</Heading>
          <Gauge value={clamp(s.bull + (s.rsi - 50) / 4, 5, 96) | 0} label="Technical strength" />
          <StatGrid rows={[
            ["RSI (14)", s.rsi + (s.rsi > 70 ? " · overbought" : s.rsi < 30 ? " · oversold" : " · neutral")],
            ["MACD", (s.macd >= 0 ? "+" : "") + s.macd + (s.macd >= 0 ? " · bullish" : " · bearish")],
            ["50-DMA", fmt(s.sma50, market)], ["200-DMA", fmt(s.sma200, market)],
            ["Support", fmt(s.support, market)], ["Resistance", fmt(s.resistance, market)],
            ["Trend", s.sma50 > s.sma200 ? "Golden-cross zone" : "Below 200-DMA"],
          ]} />
          <TextCard title="Technical summary">
            Price is trading {s.price > s.sma50 ? "above" : "below"} its 50-DMA and {s.price > s.sma200 ? "above" : "below"} its 200-DMA. RSI at {s.rsi} signals {s.rsi > 70 ? "stretched, overbought conditions" : s.rsi < 30 ? "oversold, possible bounce" : "balanced momentum"}; MACD is {s.macd >= 0 ? "positive" : "negative"}. Watch {fmt(s.support, market)} as support and {fmt(s.resistance, market)} as resistance.
          </TextCard>
          <TextCard title="Matrix's summary" accent>{s.rsi > 70 ? "Momentum is hot but extended — avoid chasing; buy dips toward support." : s.rsi < 30 ? "Oversold setup — high-risk traders can scalp a bounce with tight stops." : "Constructive, non-extended setup — trend continuation favoured while support holds."}</TextCard>
        </Pop>
      </div>

      {/* NEWS */}
      <div data-sec="news" ref={(el) => (refs.current.news = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Newspaper size={18} color="var(--primary)" />}>News</Heading>
          {s.news.map((n, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{n.d}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{n.t}</div>
              <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 7, display: "flex", gap: 5, alignItems: "center" }}><Sparkles size={13} /> Matrix: {i === 0 ? "Incrementally positive for sentiment; supports the current bias." : "Neutral-to-mild; monitor follow-through over coming sessions."}</div>
            </div>
          ))}
        </Pop>
      </div>

      {/* ASK */}
      <div data-sec="ask" ref={(el) => (refs.current.ask = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Bot size={18} color="var(--primary)" />}>Ask Matrix</Heading>
          <div className="card" style={{ padding: 14, height: 460 }}>
            <ChatPanel context={ctx} suggestions={["Should I buy right now?", "Support & resistance levels?", "Is this a good time to enter?", "Bull vs bear case?"]} />
          </div>
        </Pop>
      </div>
    </div>
  );
}
function ChartCard({ title, sub, children }) {
  return <div className="card" style={{ marginTop: 12, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
    </div>
    <div style={{ height: 150, marginTop: 8 }}>{children}</div>
  </div>;
}
function BarBlock({ data, color }) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="q" tick={{ fontSize: 10, fill: "#8A8A99" }} axisLine={false} tickLine={false} />
      <YAxis hide />
      <Tooltip formatter={(v) => compact(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} itemStyle={{ color: "var(--ink)" }} />
      <Bar dataKey="v" fill={color} radius={[6, 6, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>;
}
function StatGrid({ rows }) {
  return <div className="card" style={{ marginTop: 12, padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
    {rows.map(([k, v], i) => (
      <div key={i} style={{ padding: 12, borderBottom: i < rows.length - 2 ? "1px solid var(--line)" : "none" }}>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{k}</div>
        <div className="disp" style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{v}</div>
      </div>
    ))}
  </div>;
}
function TextCard({ title, children, accent }) {
  return <div className="card" style={{ marginTop: 12, padding: 14, background: accent ? "linear-gradient(160deg,var(--primary-soft),var(--surface))" : "var(--surface)" }}>
    <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, display: "flex", gap: 6, alignItems: "center" }}>{accent && <Sparkles size={14} color="var(--primary)" />}{title}</div>
    <p style={{ fontSize: 13, lineHeight: 1.6, margin: "7px 0 0" }}>{children}</p>
  </div>;
}

/* ============================== HOME ============================== */
const GLOBAL_MKTS = [
  { n: "NIFTY 50", c: 0.62 }, { n: "SENSEX", c: 0.58 }, { n: "BANK NIFTY", c: 0.84 },
  { n: "S&P 500", c: 0.41 }, { n: "NASDAQ", c: 0.73 }, { n: "DOW", c: 0.22 },
  { n: "FTSE 100", c: -0.18 }, { n: "NIKKEI", c: 1.12 }, { n: "HANG SENG", c: -0.44 },
  { n: "BTC", c: 1.92 }, { n: "ETH", c: 2.64 }, { n: "GOLD", c: 0.54 }, { n: "CRUDE", c: -0.88 },
];
function GlobalStrip() {
  return (
    <div className="hide-scroll" style={{ display: "flex", gap: 0, overflowX: "auto", marginTop: 10, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)" }}>
      {GLOBAL_MKTS.map((m, i) => (
        <div key={m.n} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRight: i < GLOBAL_MKTS.length - 1 ? "1px solid var(--line)" : "none" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>{m.n}</span>
          <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: m.c >= 0 ? "var(--up)" : "var(--down)" }}>{m.c >= 0 ? "▲" : "▼"}{Math.abs(m.c).toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}
function MarketPulseStrip({ market, list, onOpen }) {
  const vixSym = market === "US" ? "VIX" : "INDIAVIX";
  const idxSym = market === "US" ? "SPX" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY50";
  const vix = ALL.find((a) => a.sym === vixSym) || ALL.find((a) => a.sym === "INDIAVIX");
  const idx = ALL.find((a) => a.sym === idxSym) || ALL[0];
  const idxLabel = market === "US" ? "S&P 500" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY 50";
  const hot = useMemo(() => [...list].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 8), [list]);
  const [pi, setPi] = useState(0);
  useEffect(() => {
    if (hot.length < 2) return;
    const t = setInterval(() => setPi((p) => (p + 2) % hot.length), 2000);
    return () => clearInterval(t);
  }, [hot]);
  const pair = hot.length ? [hot[pi % hot.length], hot[(pi + 1) % hot.length]] : [];
  const open = (s) => s && onOpen(s);
  return (
    <div className="card" style={{ marginTop: 22, padding: 12, display: "flex", alignItems: "stretch", gap: 10 }}>
      <div onClick={() => open(vix)} className="tap" style={{ flex: "0 0 auto" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>VIX</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{vix.price}</span>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: vix.chg >= 0 ? "var(--down)" : "var(--up)" }}>{vix.chg >= 0 ? "+" : ""}{vix.chg}%</span>
        </div>
      </div>
      <div style={{ width: 1, background: "var(--line)" }} />
      <div onClick={() => open(idx)} className="tap" style={{ flex: "0 0 auto" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{idxLabel}</div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: idx.chg >= 0 ? "var(--up)" : "var(--down)" }}>{idx.chg >= 0 ? "▲ +" : "▼ "}{idx.chg}%</div>
      </div>
      <div style={{ width: 1, background: "var(--line)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>🔥 Hot Stocks</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          {pair.map((h, k) => (
            <div key={h.sym + k} onClick={() => open(h)} className="tap fade" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.sym}</span>
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: h.chg >= 0 ? "var(--up)" : "var(--down)", flex: "0 0 auto" }}>{h.chg >= 0 ? "+" : ""}{h.chg.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function StockIdeasStrip({ onOpen }) {
  const top = SEED_IDEAS.slice(0, 6);
  return (
    <Section title="Stock Ideas" icon={<Lightbulb size={17} color="var(--primary)" />}>
      <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {top.map((idea, i) => {
          const s = ALL.find((a) => a.sym === idea.sym); const m = marketOf(idea.sym);
          return (
            <div key={i} onClick={() => s && onOpen(s)} className="card tap" style={{ flex: "0 0 auto", width: 220, padding: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{idea.sym}</span>
                <span className="pill" style={{ fontSize: 10, background: idea.by === "Matrix" ? "var(--primary-soft)" : "var(--bg)", color: idea.by === "Matrix" ? "var(--primary)" : "var(--ink-soft)", fontWeight: 700, padding: "2px 8px" }}>{idea.by === "Matrix" ? "✦ Matrix" : idea.by}</span>
              </div>
              <PatternChart type={idea.pattern} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
                <div><div style={{ color: "var(--muted)", fontSize: 9.5 }}>Entry</div><span className="mono" style={{ fontWeight: 700 }}>{fmt(idea.entry, m)}</span></div>
                <div><div style={{ color: "var(--muted)", fontSize: 9.5 }}>Target</div><span className="mono" style={{ fontWeight: 700 }}>{fmt(idea.exit, m)}</span></div>
                <span className="pill" style={{ alignSelf: "center", background: "var(--up-soft)", color: "var(--up)", fontWeight: 800, fontSize: 11, padding: "3px 9px" }}>+{idea.gain}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
function FnoPicks({ onOpen }) {
  const items = [...FNO].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 8);
  return (
    <Section title="F&O Picks" icon={<Zap size={17} color="var(--primary)" />}>
      <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {items.map((s) => {
          const f = fnoData(s); const m = marketOf(s.sym);
          const call = f.rec === "CALL";
          return (
            <div key={s.sym} onClick={() => onOpen(s)} className="card tap" style={{ flex: "0 0 auto", width: 216, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>ATM {fmt(f.atm, m)}</div>
                </div>
                <span className="pill disp" style={{ fontSize: 11, fontWeight: 800, padding: "4px 11px", background: call ? "var(--up-soft)" : "var(--down-soft)", color: call ? "var(--up)" : "var(--down)" }}>{call ? "▲ CALL" : "▼ PUT"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, background: "var(--bg)", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>ATM PREMIUM</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 13.5 }}>{fmt(f.premium, m)}</div>
                </div>
                <div style={{ flex: 1, background: "var(--bg)", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>OI (ATM)</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 13.5 }}>{compact(f.oi)} <span style={{ fontSize: 10, color: f.oiChg >= 0 ? "var(--up)" : "var(--down)" }}>{f.oiChg >= 0 ? "↑" : "↓"}{Math.abs(f.oiChg)}%</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
function DashStat({ k, v, pos }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, opacity: .8 }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: pos ? "#9CFFD6" : "#FFB3BE" }}>{v}</div>
    </div>
  );
}
const MARKET_UPDATES = {
  IN: "Indian benchmarks are holding near record territory as domestic flows stay strong and the rupee steadies. IT and autos are leading on upbeat guidance, while rate-sensitive financials consolidate ahead of the next RBI cue. Breadth is healthy in mid-caps, though stretched valuations in pockets warrant selectivity.",
  US: "US indices remain AI-led, with mega-cap tech and semiconductors driving gains as soft-landing hopes persist. Markets are watching the Fed's rate path and earnings revisions; rotation into laggard sectors is tentative. Volatility is contained but headline-sensitive.",
  Crypto: "Crypto is firm on steady spot-ETF inflows and a post-halving supply backdrop. Bitcoin dominance is easing as majors like ETH and SOL outperform on app activity. Expect sharp two-way swings around macro prints and liquidity shifts.",
  Commodity: "Commodities are mixed: precious metals firm on rate-cut hopes and central-bank buying, while energy chops on supply-demand crosscurrents. Industrial metals catch a bid from electrification demand. Watch the dollar and real yields for direction.",
};
function HomeView({ market, setMarket, segment, setSegment, list, onOpen, watch, toggleWatch, profile, portfolio = [], wallet = 0, onGoPortfolio }) {
  const [glMode, setGlMode] = useState("Gainers");
  const picks = list.filter((s) => s.pick).slice(0, 5);
  const trending = [...list].sort((a, b) => b.vol - a.vol).slice(0, 6);
  const gainers = [...list].sort((a, b) => b.chg - a.chg).slice(0, 5);
  const losers = [...list].sort((a, b) => a.chg - b.chg).slice(0, 5);
  const traded = [...list].sort((a, b) => b.vol - a.vol).slice(0, 6);
  const inNews = list.filter((s) => s.news).slice(0, 6);
  const smart = list.filter((s) => s.inst);

  // portfolio dashboard math
  const dash = portfolio.reduce((a, h) => {
    const cur = (ALL.find((x) => x.sym === h.sym) || { price: h.buy }).price;
    const days = Math.max(1, Math.round((Date.now() - h.date) / 86400000));
    a.val += cur * h.qty; a.inv += h.buy * h.qty;
    a.annNum += (Math.pow(cur / h.buy, 365 / days) - 1) * (h.buy * h.qty);
    return a;
  }, { val: 0, inv: 0, annNum: 0 });
  const net = dash.val - dash.inv;
  const retPct = dash.inv ? (net / dash.inv) * 100 : 0;
  const annPct = dash.inv ? (dash.annNum / dash.inv) * 100 : 0;
  const upd = MARKET_UPDATES[market];

  return (
    <div>
      {/* Global markets live strip */}
      <GlobalStrip />

      {/* market category tabs (F&O is now a tab) */}
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 14 }}>
        {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]].map(([k, l]) => (
          <button key={k} onClick={() => setMarket(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "9px 15px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (market === k ? "var(--primary)" : "var(--line)"), background: market === k ? "var(--primary)" : "var(--surface)", color: market === k ? "#fff" : "var(--ink)" }}>{l}</button>
        ))}
      </div>

      {/* Portfolio dashboard card */}
      <div onClick={onGoPortfolio} className="card tap glow" style={{ marginTop: 14, padding: 16, border: "none", background: "var(--feature-grad)", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,.16), transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: .85 }}>Current value</span>
            <span className="pill" style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.16)", padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>My Portfolio <ChevronRight size={13} /></span>
          </div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 27, marginTop: 2 }}>{fmt(dash.val, "IN")}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <DashStat k="Returns %" v={(retPct >= 0 ? "+" : "") + retPct.toFixed(2) + "%"} pos={retPct >= 0} />
            <DashStat k="Net returns" v={(net >= 0 ? "+" : "") + fmt(net, "IN")} pos={net >= 0} />
            <DashStat k="Annualised" v={(annPct >= 0 ? "+" : "") + annPct.toFixed(1) + "%"} pos={annPct >= 0} />
          </div>
          {portfolio.length === 0 && <div style={{ fontSize: 11.5, opacity: .8, marginTop: 10 }}>No holdings yet — buy your first stock in Virtual Trade.</div>}
        </div>
      </div>

      {profile && (
        <div className="card" style={{ marginTop: 14, padding: 14, background: "linear-gradient(110deg,var(--primary),var(--primary-2))", border: "none", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: .9 }}>Tuned for you</div>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{profile.style} investor · {profile.risk} risk</div>
          <div style={{ fontSize: 12, opacity: .92, marginTop: 4 }}>Picks below are weighted toward {profile.caps.join(", ") || "all caps"}{profile.sectors.length ? ` and ${profile.sectors.join(", ")}` : ""}.</div>
        </div>
      )}

      {/* Matrix picks */}
      <Section title="Matrix's Picks" icon={<Sparkles size={17} color="var(--primary-2)" />}>
        <div className="hide-scroll" style={{ display: "flex", gap: 13, overflowX: "auto", paddingBottom: 8, paddingTop: 2 }}>
          {picks.map((s) => (
            <div key={s.sym} onClick={() => onOpen(s)} className="card tap glow" style={{ flex: "0 0 auto", width: 272, padding: 0, position: "relative", overflow: "hidden", border: "none", background: "var(--feature-grad)" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,.18), transparent 45%)", pointerEvents: "none" }} />
              <button onClick={(e) => { e.stopPropagation(); toggleWatch(s.sym); }} className="tap" style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.14)", color: "#fff", display: "grid", placeItems: "center", zIndex: 2 }}>
                {watch.includes(s.sym) ? <Check size={16} /> : <Plus size={17} />}
              </button>
              <div style={{ padding: 17, position: "relative", color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>💎</span>
                  <div><div className="disp" style={{ fontWeight: 700, fontSize: 15.5 }}>{s.sym}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>{s.name}</div></div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 19 }}>{fmt(s.price, market)}</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: s.chg >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{s.chg >= 0 ? "▲ +" : "▼ "}{s.chg.toFixed(2)}%</span>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.18)", fontSize: 12.5, color: "rgba(255,255,255,.92)", lineHeight: 1.55, display: "flex", gap: 6 }}>
                  <Sparkles size={14} color="#fff" style={{ flex: "0 0 auto", marginTop: 2 }} /><span>{s.pick}</span>
                </div>
                <div style={{ marginTop: 12 }}><VerdictTag v={s.verdict} /></div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Market updates summary */}
      <Pop style={{ marginTop: 22 }}>
        <div className="card" style={{ padding: 15 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Newspaper size={15} color="var(--primary)" /> Market updates</div>
          <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--ink-soft)" }}>{MARKET_UPDATES[market]}</p>
        </div>
      </Pop>

      {/* Stock Ideas carousel */}
      <StockIdeasStrip onOpen={onOpen} />

      {/* F&O Picks */}
      <FnoPicks onOpen={onOpen} />

      {/* Market pulse strip (VIX, index, hot stocks) */}
      <MarketPulseStrip market={market} list={list} onOpen={onOpen} />

      {/* Trending */}
      <Section title="Trending now" icon={<TrendingUp size={17} color="#0FB97D" />}>
        <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {trending.map((s) => <MiniRow key={s.sym} s={s} market={market} onOpen={onOpen} watched={watch.includes(s.sym)} toggleWatch={toggleWatch} />)}
        </div>
      </Section>

      {/* Screener (moved above gainers/losers) */}
      <Pop style={{ marginTop: 40 }}>
        <Screener onOpen={onOpen} market={market} list={list} />
      </Pop>

      {/* Gainers / Losers with slider */}
      <Section title="Top gainers & losers" icon={<Zap size={17} color="#E8A33D" />}
        right={
          <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3 }}>
            {["Gainers", "Losers"].map((m) => (
              <button key={m} onClick={() => setGlMode(m)} className="pill tap disp" style={{ padding: "5px 13px", fontSize: 11.5, fontWeight: 700, border: "none", background: glMode === m ? (m === "Gainers" ? "var(--up)" : "var(--down)") : "transparent", color: glMode === m ? "#fff" : "var(--muted)" }}>{m}</button>
            ))}
          </div>
        }>
        <div className="card" style={{ padding: "4px 14px" }}>
          {(glMode === "Gainers" ? gainers : losers).map((s) => <ListRow key={s.sym} s={s} market={market} onOpen={onOpen} watched={watch.includes(s.sym)} toggleWatch={toggleWatch} />)}
        </div>
      </Section>

      {/* Most traded — carousel */}
      <Section title="Most traded" icon={<Activity size={17} color="var(--primary)" />}>
        <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {traded.map((s) => (
            <CarouselCard key={s.sym} s={s} market={market} onOpen={onOpen} width={186} watched={watch.includes(s.sym)} toggleWatch={toggleWatch}>
              <div style={{ marginTop: 10, background: "var(--bg)", borderRadius: 12, padding: "8px 11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>Volume</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{compact(s.vol)}</span>
              </div>
            </CarouselCard>
          ))}
        </div>
      </Section>

      {/* In the news — carousel */}
      <Section title="In the news" icon={<Newspaper size={17} color="#E8A33D" />}>
        <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {inNews.map((s) => (
            <CarouselCard key={s.sym} s={s} market={market} onOpen={onOpen} width={250} watched={watch.includes(s.sym)} toggleWatch={toggleWatch}>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.news[0].t}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{s.news[0].d}</div>
            </CarouselCard>
          ))}
        </div>
      </Section>

      {/* Smart money — carousel, institution names + total trade value */}
      {smart.length > 0 && (
        <Section title="Smart Money picks" icon={<Building2 size={17} color="var(--primary)" />}>
          <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {smart.map((s) => (
              <CarouselCard key={s.sym} s={s} market={market} onOpen={onOpen} width={250} watched={watch.includes(s.sym)} toggleWatch={toggleWatch}>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                  {s.inst.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", borderRadius: 12, padding: "9px 11px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.n}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, flex: "0 0 auto", marginLeft: 8 }}>{it.v}</span>
                    </div>
                  ))}
                </div>
              </CarouselCard>
            ))}
          </div>
        </Section>
      )}
      <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)", margin: "26px 0 6px" }}>Simulated data for demo · Not financial advice</div>
    </div>
  );
}

/* ============================== SCREENER ============================== */
const METRICS = [["chg", "Day change %"], ["rsi", "RSI"], ["pe", "P/E"], ["price", "Price"], ["revGrowth", "Revenue growth %"], ["ebitdaGrowth", "EBITDA growth %"], ["roe", "ROE %"]];
const OPS = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"]];
function Screener({ onOpen, market, list }) {
  const [filters, setFilters] = useState([{ m: "rsi", o: ">", v: "50" }]);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const recommended = [
    { label: "Momentum movers", f: [{ m: "rsi", o: ">", v: "60" }, { m: "chg", o: ">", v: "1" }] },
    { label: "Value with growth", f: [{ m: "pe", o: "<", v: "30" }, { m: "revGrowth", o: ">", v: "8" }] },
    { label: "Oversold bounce", f: [{ m: "rsi", o: "<", v: "35" }] },
    { label: "High-margin growth", f: [{ m: "ebitdaGrowth", o: ">", v: "15" }] },
  ];
  const apply = (fs) => {
    const ok = list.filter((s) => fs.every((f) => {
      const x = s[f.m === "price" ? "price" : f.m]; const val = parseFloat(f.v);
      if (isNaN(val)) return true;
      return f.o === ">" ? x > val : f.o === "<" ? x < val : f.o === ">=" ? x >= val : x <= val;
    }));
    setResults(ok);
  };
  const upd = (i, k, val) => setFilters((p) => p.map((f, j) => j === i ? { ...f, [k]: val } : f));
  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Screener</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Build rules from technicals, fundamentals or events.</div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "16px 2px 8px" }}>Recommended</div>
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {recommended.map((r) => (
          <button key={r.label} onClick={() => { setFilters(r.f); apply(r.f); }} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, padding: "9px 14px" }}>{r.label}</button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 14 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Build your own</div>
        {filters.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 7, marginBottom: 8, alignItems: "center" }}>
            <select value={f.m} onChange={(e) => upd(i, "m", e.target.value)} style={selStyle}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={f.o} onChange={(e) => upd(i, "o", e.target.value)} style={{ ...selStyle, flex: "0 0 56px" }}>{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input value={f.v} onChange={(e) => upd(i, "v", e.target.value)} style={{ ...selStyle, flex: "0 0 70px" }} className="no-ring" />
            <button onClick={() => setFilters((p) => p.filter((_, j) => j !== i))} className="tap" style={{ border: "none", background: "transparent" }}><Trash2 size={16} color="var(--down)" /></button>
          </div>
        ))}
        <button onClick={() => setFilters((p) => [...p, { m: "pe", o: "<", v: "30" }])} className="tap" style={{ border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> Add filter</button>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Or describe it in plain text</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. large-cap IT stocks with RSI under 40 and rising revenue" className="no-ring"
          style={{ width: "100%", marginTop: 6, border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 60, resize: "vertical" }} />

        <button onClick={() => apply(filters)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Filter size={16} /> Run screener</button>
      </div>

      {results && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{results.length} match{results.length !== 1 ? "es" : ""}</div>
          <div className="card" style={{ padding: "4px 12px" }}>
            {results.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No stocks match these rules. Try loosening a filter.</div>
              : results.map((s) => <ListRow key={s.sym} s={s} market={market} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </div>
  );
}
const selStyle = { flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 8px", fontSize: 12.5, background: "var(--surface)", color: "var(--ink)" };

/* ============================== VIRTUAL TRADE ============================== */
function TradeView({ wallet, setWallet, portfolio, setPortfolio, preset, market }) {
  const [sel, setSel] = useState(preset || ALL[0]);
  const [qty, setQty] = useState(1);
  const [side, setSide] = useState("Buy");
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (preset) setSel(preset); }, [preset]);
  const m = marketOf(sel.sym);
  const cost = sel.price * qty;
  const holding = portfolio.find((p) => p.sym === sel.sym);
  const exec = () => {
    if (side === "Buy") {
      if (cost > wallet) { setMsg({ t: "Not enough virtual funds for this order.", e: true }); return; }
      setWallet((w) => w - cost);
      setPortfolio((p) => {
        const ex = p.find((h) => h.sym === sel.sym);
        if (ex) { const tq = ex.qty + qty; return p.map((h) => h.sym === sel.sym ? { ...h, qty: tq, buy: (h.buy * h.qty + cost) / tq } : h); }
        return [...p, { sym: sel.sym, name: sel.name, qty, buy: sel.price, date: Date.now() }];
      });
      setMsg({ t: `Bought ${qty} ${sel.sym} at ${fmt(sel.price, m)}.`, e: false });
    } else {
      if (!holding || holding.qty < qty) { setMsg({ t: "You don't hold enough units to sell.", e: true }); return; }
      setWallet((w) => w + cost);
      setPortfolio((p) => p.map((h) => h.sym === sel.sym ? { ...h, qty: h.qty - qty } : h).filter((h) => h.qty > 0));
      setMsg({ t: `Sold ${qty} ${sel.sym} at ${fmt(sel.price, m)}.`, e: false });
    }
    setQty(1);
  };
  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Virtual Trade</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Practice with {fmt(wallet, "IN")} virtual cash. Zero real risk.</div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Instrument</div>
        <select value={sel.sym} onChange={(e) => setSel(ALL.find((a) => a.sym === e.target.value))} style={{ ...selStyle, width: "100%", marginTop: 6, fontSize: 14, padding: 12 }}>
          {ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym} — {a.name}</option>)}
        </select>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 22 }}>{fmt(sel.price, m)}</span><Change v={sel.chg} big />
        </div>

        <div className="pill" style={{ display: "flex", background: "var(--bg)", padding: 4, marginTop: 14 }}>
          {["Buy", "Sell"].map((x) => (
            <button key={x} onClick={() => setSide(x)} className="pill tap disp" style={{ flex: 1, padding: 10, border: "none", fontWeight: 700, fontSize: 13.5, background: side === x ? (x === "Buy" ? "var(--up)" : "var(--down)") : "transparent", color: side === x ? "#fff" : "var(--muted)" }}>{x}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Quantity</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="tap" style={qBtn}>–</button>
            <input value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="no-ring mono" style={{ width: 56, textAlign: "center", border: "1px solid var(--line)", borderRadius: 10, padding: 8, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
            <button onClick={() => setQty((q) => q + 1)} className="tap" style={qBtn}>+</button>
          </div>
        </div>
        {holding && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>You hold {holding.qty} units @ avg {fmt(holding.buy, m)}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}>
          <span style={{ color: "var(--muted)" }}>Order value</span><span className="mono" style={{ fontWeight: 700 }}>{fmt(cost, m)}</span>
        </div>
        <button onClick={exec} className="tap disp glow" style={{ width: "100%", marginTop: 14, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontWeight: 700, fontSize: 15 }}>{side} {sel.sym}</button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: msg.e ? "var(--down)" : "var(--up)", textAlign: "center" }}>{msg.t}</div>}
      </div>
    </div>
  );
}
const qBtn = { width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 18, fontWeight: 700, color: "var(--ink)" };

/* ============================== PORTFOLIO ============================== */
function Portfolio({ portfolio, wallet }) {
  const rows = portfolio.map((h) => {
    const s = ALL.find((a) => a.sym === h.sym) || { price: h.buy, chg: 0 };
    const m = marketOf(h.sym);
    const cur = s.price, inv = h.buy * h.qty, val = cur * h.qty;
    const pl = val - inv, plp = (cur / h.buy - 1) * 100;
    const days = Math.max(1, Math.round((Date.now() - h.date) / 86400000)) || 1;
    const ann = (Math.pow(cur / h.buy, 365 / Math.max(days, 1)) - 1) * 100;
    return { ...h, m, cur, inv, val, pl, plp, days, ann: isFinite(ann) ? ann : plp };
  });
  const totalVal = rows.reduce((a, r) => a + r.val, 0);
  const totalInv = rows.reduce((a, r) => a + r.inv, 0);
  const totalPL = totalVal - totalInv;
  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Virtual Portfolio</div>
      <div className="card" style={{ marginTop: 12, padding: 16, background: "linear-gradient(120deg,#0E0E14,#2A2342)", border: "none", color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: .8 }}>Holdings value</div>
        <div className="mono" style={{ fontWeight: 700, fontSize: 28, marginTop: 2 }}>{fmt(totalVal, "IN")}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12.5 }}>
          <div><div style={{ opacity: .7 }}>Cash</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(wallet, "IN")}</div></div>
          <div><div style={{ opacity: .7 }}>Invested</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(totalInv, "IN")}</div></div>
          <div><div style={{ opacity: .7 }}>Total P/L</div><div className="mono" style={{ fontWeight: 700, color: totalPL >= 0 ? "#5CF0B5" : "#FF8FA0" }}>{totalPL >= 0 ? "+" : ""}{fmt(totalPL, "IN")}</div></div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 30, textAlign: "center", color: "var(--muted)" }}>
          <Briefcase size={28} color="var(--muted)" /><div style={{ marginTop: 8, fontSize: 13.5 }}>No holdings yet. Head to Virtual Trade to buy your first stock.</div>
        </div>
      ) : rows.map((r) => (
        <div key={r.sym} className="card" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div><div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{r.sym}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{r.qty} units · held {r.days}d</div></div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: r.pl >= 0 ? "var(--up)" : "var(--down)" }}>{r.pl >= 0 ? "+" : ""}{fmt(r.pl, r.m)}</div>
              <div className="mono" style={{ fontSize: 12, color: r.pl >= 0 ? "var(--up)" : "var(--down)" }}>{r.plp >= 0 ? "+" : ""}{r.plp.toFixed(2)}%</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11.5 }}>
            <Stat k="Buy" v={fmt(r.buy, r.m)} /><Stat k="Current" v={fmt(r.cur, r.m)} /><Stat k="Annualised" v={(r.ann >= 0 ? "+" : "") + r.ann.toFixed(1) + "%"} c={r.ann >= 0 ? "var(--up)" : "var(--down)"} />
          </div>
        </div>
      ))}
    </div>
  );
}
function Stat({ k, v, c }) { return <div><div style={{ color: "var(--muted)" }}>{k}</div><div className="mono" style={{ fontWeight: 700, color: c || "var(--ink)" }}>{v}</div></div>; }

/* ============================== WATCHLIST ============================== */
function WatchlistView({ watchlists, activeWl, setActiveWl, createWatchlist, deleteWatchlist, toggleWatch, onOpen }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const active = watchlists.find((w) => w.id === activeWl) || watchlists[0];
  const items = (active?.syms || []).map((sym) => ALL.find((a) => a.sym === sym)).filter(Boolean);
  const submit = () => { createWatchlist(name); setName(""); setAdding(false); };
  return (
    <div className="mx fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Watchlists</div>
        <button onClick={() => setAdding(!adding)} className="tap pill disp glow" style={{ background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> New list</button>
      </div>

      {adding && (
        <div className="card" style={{ marginTop: 12, padding: 12, display: "flex", gap: 8 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Watchlist name (e.g. High Beta)" className="no-ring" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, background: "var(--surface)" }} />
          <button onClick={submit} className="tap disp" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 700 }}>Create</button>
        </div>
      )}

      {/* list chips */}
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 14, paddingBottom: 2 }}>
        {watchlists.map((w) => (
          <button key={w.id} onClick={() => setActiveWl(w.id)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (w.id === activeWl ? "var(--primary)" : "var(--line)"), background: w.id === activeWl ? "var(--primary)" : "var(--surface)", color: w.id === activeWl ? "#fff" : "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
            {w.name} <span style={{ opacity: .8, fontSize: 11 }}>{w.syms.length}</span>
          </button>
        ))}
      </div>

      {active && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 2px 4px" }}>
          <span className="disp" style={{ fontWeight: 700, fontSize: 15 }}>{active.name}</span>
          {watchlists.length > 1 && (
            <button onClick={() => deleteWatchlist(active.id)} className="tap" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--down)", display: "flex", gap: 4, alignItems: "center" }}><Trash2 size={13} /> Delete list</button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 10, padding: 30, textAlign: "center", color: "var(--muted)" }}>
          <Star size={28} color="var(--muted)" /><div style={{ marginTop: 8, fontSize: 13.5 }}>This list is empty. Tap the + on any stock to add it here.</div>
        </div>
      ) : items.map((s) => {
        const m = marketOf(s.sym);
        return (
          <div key={s.sym} onClick={() => onOpen(s)} className="card tap" style={{ marginTop: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{s.name}</div></div>
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10 }}>
                <div><div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{fmt(s.price, m)}</div><Change v={s.chg} /></div>
                <button onClick={(e) => { e.stopPropagation(); toggleWatch(s.sym); }} className="tap" title="Remove" style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--down)", display: "grid", placeItems: "center" }}><X size={15} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 8, display: "flex", gap: 5 }}><Sparkles size={13} style={{ flex: "0 0 auto", marginTop: 1 }} />{s.oneLiner}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== IDEAS ============================== */
const SEED_IDEAS = [
  { by: "Matrix", sym: "TATAPOWER", entry: 410, exit: 470, stop: 396, gain: 14.6, pattern: "cup", tradeType: "Stock", logic: "Cup-and-handle breakout above ₹408 with rising volume; renewables order wins as catalyst." },
  { by: "Matrix", sym: "INFY", entry: 1535, exit: 1680, stop: 1488, gain: 9.4, pattern: "breakout", tradeType: "Stock", logic: "Reclaim of 50-DMA + bullish MACD crossover; FY guidance upgrade supports re-rating." },
  { by: "@arjun_trades", sym: "ZOMATO", entry: 192, exit: 230, stop: 178, gain: 19.8, pattern: "triangle", tradeType: "F&O", logic: "Ascending triangle; Blinkit profitability inflection. Stop below ₹178." },
  { by: "@nisha.fno", sym: "TATAMOTORS", entry: 970, exit: 1060, stop: 938, gain: 9.3, pattern: "flag", tradeType: "F&O", logic: "Flag continuation after JLR numbers; hold while above 20-EMA." },
  { by: "Matrix", sym: "NVDA", entry: 118, exit: 138, stop: 110, gain: 16.9, pattern: "breakout", tradeType: "Stock", logic: "AI capex cycle intact; breakout from base on volume." },
  { by: "Matrix", sym: "BTC", entry: 61000, exit: 72000, stop: 57000, gain: 18.0, pattern: "cup", tradeType: "Stock", logic: "Rounded base + ETF inflows; reclaim of range high targets prior high." },
];
const PATTERNS = {
  cup: { label: "Cup & Handle", pts: [[0, 28], [9, 32], [18, 50], [30, 62], [44, 64], [58, 62], [68, 50], [76, 34], [82, 28], [88, 40], [93, 34], [100, 14]] },
  triangle: { label: "Ascending Triangle", pts: [[0, 56], [12, 28], [24, 50], [40, 30], [56, 48], [72, 32], [86, 44], [100, 14]] },
  flag: { label: "Bull Flag", pts: [[0, 64], [16, 18], [28, 30], [40, 40], [52, 30], [64, 42], [76, 32], [88, 42], [100, 10]] },
  breakout: { label: "Breakout", pts: [[0, 50], [12, 44], [24, 54], [36, 42], [48, 52], [60, 44], [72, 38], [82, 28], [100, 8]] },
  doubleBottom: { label: "Double Bottom", pts: [[0, 30], [14, 56], [26, 38], [38, 58], [52, 42], [62, 56], [74, 36], [88, 22], [100, 10]] },
};
function PatternChart({ type }) {
  const P = PATTERNS[type] || PATTERNS.breakout;
  const H = 84, W = 100, pad = 6;
  const yOf = (v) => H - pad - (v / 70) * (H - 2 * pad);
  const line = P.pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${yOf(p[1]).toFixed(1)}`).join(" ");
  const area = `${line} L100 ${H} L0 ${H} Z`;
  const entryV = P.pts[Math.floor(P.pts.length * 0.7)][1];
  const targetV = P.pts[P.pts.length - 1][1];
  const id = "pg" + type;
  return (
    <div style={{ position: "relative", marginTop: 12, borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C6CFF" stopOpacity="0.45" /><stop offset="100%" stopColor="#7C6CFF" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" x2={W} y1={yOf(targetV)} y2={yOf(targetV)} stroke="#1FE08C" strokeWidth="0.7" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={yOf(entryV)} y2={yOf(entryV)} stroke="#A99BFF" strokeWidth="0.7" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="#A99BFF" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span className="pill" style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 800, background: "rgba(124,108,255,.9)", color: "#fff", padding: "3px 9px" }}>📈 {P.label}</span>
      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: "#1FE08C", background: "var(--surface)", padding: "2px 7px", borderRadius: 8 }}>Target</span>
      <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: "var(--primary-2)", background: "var(--surface)", padding: "2px 7px", borderRadius: 8 }}>Entry</span>
    </div>
  );
}
// Resolve an idea to a realized outcome by simulating a price path from entry and
// checking whether the TARGET or STOP was touched first. If neither, it's still open.
function ideaResult(idea) {
  const entry = idea.entry, target = idea.exit;
  const stop = idea.stop != null ? idea.stop : +(entry * 0.94).toFixed(2);
  const seed = hash(idea.sym + idea.by + entry);
  const r = lcg(seed + 1);
  const N = 70;
  let p = entry, closed = null;
  for (let i = 1; i <= N; i++) {
    const vol = entry * 0.022;
    const drift = entry * 0.0013; // mild upward bias
    p = p + drift + (r() - 0.5) * vol * 2;
    if (p >= target) { closed = { win: true, ret: (target / entry - 1) * 100, reason: "Target", bars: i }; break; }
    if (p <= stop) { closed = { win: false, ret: (stop / entry - 1) * 100, reason: "Stop", bars: i }; break; }
  }
  const daysAgo = Math.floor(lcg(seed + 9)() * 360);
  const type = idea.tradeType || "Stock", mkt = marketOf(idea.sym);
  if (!closed) return { status: "open", ret: (p / entry - 1) * 100, daysAgo, type, mkt, stop };
  return { status: "closed", win: closed.win, ret: closed.ret, reason: closed.reason, bars: closed.bars, daysAgo, type, mkt, stop };
}
function IdeasDashboard({ ideas }) {
  const [by, setBy] = useState("Matrix");
  const [type, setType] = useState("All");
  const [mkt, setMkt] = useState("All");
  const [range, setRange] = useState(365);
  const [cap, setCap] = useState(100000);
  const [symF, setSymF] = useState("All");
  const all = ideas.map((id) => ({ id, o: ideaResult(id) }))
    .filter(({ id, o }) =>
      (by === "All" || (by === "Matrix" ? id.by === "Matrix" : id.by !== "Matrix")) &&
      (type === "All" || o.type === type) &&
      (mkt === "All" || o.mkt === mkt) &&
      (symF === "All" || id.sym === symF) &&
      o.daysAgo <= range);
  const closed = all.filter((r) => r.o.status === "closed"); // realized only
  const openN = all.length - closed.length;
  const n = closed.length;
  const wins = closed.filter((r) => r.o.win).length;
  const losses = n - wins;
  const avg = n ? closed.reduce((a, r) => a + r.o.ret, 0) / n : 0;
  const total = (closed.reduce((a, r) => a * (1 + r.o.ret / 100), 1) - 1) * 100;
  const netPnl = cap * (total / 100);
  const winRate = n ? (wins / n) * 100 : 0;
  const sel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 6px", fontSize: 11.5 };
  const Stat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 88, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "9px 11px" }}>
      <div style={{ fontSize: 9.5, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14.5, marginTop: 2, color: c || "#fff" }}>{v}</div>
    </div>
  );
  return (
    <div className="card glow" style={{ marginTop: 14, padding: 16, border: "none", background: "var(--feature-grad)", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Ideas Dashboard</div>
        <span style={{ fontSize: 10.5, opacity: .85 }}>realized · last {range >= 365 ? "12 months" : range + "d"}</span>
      </div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 6 }}>{netPnl >= 0 ? "+" : ""}{fmt(netPnl, "IN")}</div>
      <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>Net realized P&amp;L on {fmt(cap, "IN")} deployed · {openN} still open</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Stat k="Returns %" v={(avg >= 0 ? "+" : "") + avg.toFixed(2) + "%"} c={avg >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        <Stat k="Annualised (12m)" v={(total >= 0 ? "+" : "") + total.toFixed(1) + "%"} c={total >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        <Stat k="Win rate" v={n ? winRate.toFixed(0) + "%" : "—"} />
        <Stat k="Win / Loss" v={wins + " : " + losses} />
        <Stat k="Trades" v={n} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <select value={by} onChange={(e) => setBy(e.target.value)} style={sel}><option value="Matrix">Posted by: Matrix</option><option value="All">Posted by: All</option><option value="Community">Posted by: Community</option></select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={sel}><option value="All">Type: All</option><option value="Stock">Stock</option><option value="F&O">F&amp;O</option></select>
        <select value={mkt} onChange={(e) => setMkt(e.target.value)} style={sel}><option value="All">Market: All</option><option value="IN">Indian</option><option value="US">US</option><option value="Crypto">Crypto</option></select>
        <select value={range} onChange={(e) => setRange(+e.target.value)} style={sel}><option value={30}>30d</option><option value={90}>3m</option><option value={180}>6m</option><option value={365}>12m</option></select>
        <select value={cap} onChange={(e) => setCap(+e.target.value)} style={sel}><option value={50000}>Capital: ₹50k</option><option value={100000}>Capital: ₹1L</option><option value={500000}>Capital: ₹5L</option><option value={1000000}>Capital: ₹10L</option></select>
        <select value={symF} onChange={(e) => setSymF(e.target.value)} style={sel}><option value="All">Symbol: All</option>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym}</option>)}</select>
      </div>
    </div>
  );
}
function Ideas({ onOpen }) {
  const [ideas, setIdeas] = useState(SEED_IDEAS);
  const [draft, setDraft] = useState({ sym: "NIFTY50", entry: "", exit: "", logic: "", pattern: "breakout" });
  const [open, setOpen] = useState(false);
  const post = () => {
    if (!draft.entry || !draft.exit || !draft.logic) return;
    const g = ((parseFloat(draft.exit) / parseFloat(draft.entry) - 1) * 100);
    setIdeas((p) => [{ by: "You", sym: draft.sym, entry: +draft.entry, exit: +draft.exit, gain: +g.toFixed(1), pattern: draft.pattern, logic: draft.logic }, ...p]);
    setDraft({ sym: "NIFTY50", entry: "", exit: "", logic: "", pattern: "breakout" }); setOpen(false);
  };
  return (
    <div className="mx fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Ideas</div>
        <button onClick={() => setOpen(!open)} className="tap pill disp glow" style={{ background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> Post idea</button>
      </div>

      <IdeasDashboard ideas={ideas} />
      {open && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <select value={draft.sym} onChange={(e) => setDraft({ ...draft, sym: e.target.value })} style={{ ...selStyle, width: "100%" }}>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym} — {a.name}</option>)}</select>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input placeholder="Entry" value={draft.entry} onChange={(e) => setDraft({ ...draft, entry: e.target.value })} className="no-ring" style={{ ...selStyle }} />
            <input placeholder="Exit" value={draft.exit} onChange={(e) => setDraft({ ...draft, exit: e.target.value })} className="no-ring" style={{ ...selStyle }} />
          </div>
          <select value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} style={{ ...selStyle, width: "100%", marginTop: 8 }}>{Object.entries(PATTERNS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <textarea placeholder="Logic — chart pattern, catalyst, levels…" value={draft.logic} onChange={(e) => setDraft({ ...draft, logic: e.target.value })} className="no-ring" style={{ width: "100%", marginTop: 8, border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 54 }} />
          <button onClick={post} className="tap disp" style={{ width: "100%", marginTop: 10, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 12, padding: 12, fontWeight: 700 }}>Publish idea</button>
        </div>
      )}
      {ideas.map((idea, i) => {
        const s = ALL.find((a) => a.sym === idea.sym); const m = marketOf(idea.sym);
        return (
          <div key={i} className="card" style={{ marginTop: 12, padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="pill" style={{ background: idea.by === "Matrix" ? "var(--primary-soft)" : "var(--bg)", color: idea.by === "Matrix" ? "var(--primary)" : "var(--ink-soft)", fontSize: 11, fontWeight: 700, padding: "3px 9px" }}>{idea.by === "Matrix" ? "✦ Matrix" : idea.by}</span>
                <span onClick={() => s && onOpen(s)} className="disp tap" style={{ fontWeight: 700, fontSize: 14 }}>{idea.sym}</span>
              </div>
              <span className="pill disp" style={{ background: "var(--up-soft)", color: "var(--up)", fontWeight: 700, fontSize: 12.5, padding: "4px 11px" }}>+{idea.gain}% potential</span>
            </div>
            <PatternChart type={idea.pattern} />
            <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
              <div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>Entry</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(idea.entry, m)}</div></div>
              <div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>Exit / target</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(idea.exit, m)}</div></div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.55 }}>{idea.logic}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== BACKTEST ENGINE ============================== */
function SMAarr(a, p) { const o = Array(a.length).fill(NaN); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) o[i] = s / p; } return o; }
function EMAarr(a, p) { const o = Array(a.length).fill(NaN); const k = 2 / (p + 1); let prev = a[0]; o[0] = a[0]; for (let i = 1; i < a.length; i++) { prev = a[i] * k + prev * (1 - k); o[i] = prev; } return o; }
function RSIarr(a, p) { const o = Array(a.length).fill(NaN); let g = 0, l = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } return o; }
function MACDarr(a) { const e12 = EMAarr(a, 12), e26 = EMAarr(a, 26); const line = a.map((_, i) => e12[i] - e26[i]); const signal = EMAarr(line, 9); const hist = line.map((v, i) => v - signal[i]); return { line, signal, hist }; }
function BBarr(a, p) { const mid = SMAarr(a, p); const upper = Array(a.length).fill(NaN), lower = Array(a.length).fill(NaN); for (let i = p - 1; i < a.length; i++) { let s = 0; for (let j = i - p + 1; j <= i; j++) s += (a[j] - mid[i]) ** 2; const sd = Math.sqrt(s / p); upper[i] = mid[i] + 2 * sd; lower[i] = mid[i] - 2 * sd; } return { upper, middle: mid, lower }; }
function CCIarr(c, p) { const tp = c.map((x) => (x.h + x.l + x.c) / 3); const sma = SMAarr(tp, p); const o = Array(c.length).fill(NaN); for (let i = p - 1; i < c.length; i++) { let md = 0; for (let j = i - p + 1; j <= i; j++) md += Math.abs(tp[j] - sma[i]); md /= p; o[i] = md === 0 ? 0 : (tp[i] - sma[i]) / (0.015 * md); } return o; }
function ATRarr(c, p) { const tr = c.map((x, i) => i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))); return EMAarr(tr, p); }
function VWAParr(c) { let pv = 0, vv = 0; return c.map((x) => { const tp = (x.h + x.l + x.c) / 3, v = x.v || 1; pv += tp * v; vv += v; return pv / vv; }); }
function ADXarr(c, p) {
  const n = c.length, pDM = Array(n).fill(0), mDM = Array(n).fill(0), tr = Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
    pDM[i] = up > dn && up > 0 ? up : 0; mDM[i] = dn > up && dn > 0 ? dn : 0;
    tr[i] = Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c));
  }
  const atr = EMAarr(tr, p), pdi = EMAarr(pDM, p).map((v, i) => 100 * v / (atr[i] || 1)), mdi = EMAarr(mDM, p).map((v, i) => 100 * v / (atr[i] || 1));
  const dx = pdi.map((v, i) => { const s = v + mdi[i]; return s ? 100 * Math.abs(v - mdi[i]) / s : 0; });
  return EMAarr(dx, p);
}
const CF = { open: "o", high: "h", low: "l", close: "c" };
function rollExt(c, len, field, max) { const o = Array(c.length).fill(NaN); for (let i = 0; i < c.length; i++) { let v = c[i][field]; for (let j = Math.max(0, i - len + 1); j <= i; j++) v = max ? Math.max(v, c[j][field]) : Math.min(v, c[j][field]); o[i] = v; } return o; }
function resolveOperand(op, defs, c, closes, vols, cache) {
  if (op in cache) return cache[op];
  let series;
  if (op !== "" && !isNaN(Number(op))) { const n = Number(op); series = closes.map(() => n); }
  else if (op === "Price") series = closes;
  else if (op === "Volume") series = vols;
  else {
    const [nm, attr] = op.split(".");
    const d = (defs || []).find((x) => x.name === nm);
    if (!d) series = closes.map(() => NaN);
    else {
      const len = Number(d.len) || 14;
      switch (d.type) {
        case "EMA": series = EMAarr(closes, len); break;
        case "SMA": series = SMAarr(closes, len); break;
        case "RSI": series = RSIarr(closes, len); break;
        case "CCI": series = CCIarr(c, len); break;
        case "ATR": series = ATRarr(c, len); break;
        case "VWAP": series = VWAParr(c); break;
        case "MACD": { const m = MACDarr(closes); series = m[attr || "line"]; break; }
        case "BB": { const b = BBarr(closes, len); series = b[attr || "middle"]; break; }
        case "KC": { const mid = EMAarr(closes, len), at = ATRarr(c, len); series = attr === "upper" ? mid.map((v, i) => v + 1.5 * at[i]) : attr === "lower" ? mid.map((v, i) => v - 1.5 * at[i]) : mid; break; }
        case "ADX": series = ADXarr(c, len); break;
        case "DMA": series = SMAarr(closes, len); break;
        case "Volume": series = vols; break;
        case "CurrentCandle": case "CurrentDay": { const f = CF[attr] || "c"; series = c.map((x) => x[f]); break; }
        case "PrevCandle": case "PrevDay": { const f = CF[attr] || "c"; series = c.map((x, i) => i > 0 ? c[i - 1][f] : NaN); break; }
        case "LastNCandles": { const f = CF[attr] || "c"; series = attr === "high" ? rollExt(c, len, "h", true) : attr === "low" ? rollExt(c, len, "l", false) : c.map((x, i) => (i - len + 1 >= 0 ? c[i - len + 1][f] : x[f])); break; }
        case "FirstNCandles": { const f = CF[attr] || "c"; const head = c.slice(0, Math.max(1, len)); const val = attr === "high" ? Math.max(...head.map((x) => x.h)) : attr === "low" ? Math.min(...head.map((x) => x.l)) : (attr === "open" ? head[0].o : head[head.length - 1].c); series = closes.map(() => val); break; }
        default: series = closes.map(() => NaN);
      }
    }
  }
  cache[op] = series; return series;
}
function evalCond(cond, i, get) {
  const L = get(cond.la), R = cond.bType === "num" ? null : get(cond.b);
  const lv = L[i], rv = cond.bType === "num" ? Number(cond.b) : R[i];
  const plv = L[i - 1], prv = cond.bType === "num" ? Number(cond.b) : (R ? R[i - 1] : NaN);
  if (lv == null || rv == null || isNaN(lv) || isNaN(rv)) return false;
  switch (cond.op) {
    case ">": return lv > rv; case "<": return lv < rv; case ">=": return lv >= rv; case "<=": return lv <= rv;
    case "==": return Math.abs(lv - rv) < 1e-9;
    case "crosses_above": return !isNaN(plv) && !isNaN(prv) && plv <= prv && lv > rv;
    case "crosses_below": return !isNaN(plv) && !isNaN(prv) && plv >= prv && lv < rv;
    default: return false;
  }
}
function chainEval(conds, i, get) { if (!conds || !conds.length) return false; let r = evalCond(conds[0], i, get); for (let k = 1; k < conds.length; k++) { const e = evalCond(conds[k], i, get); r = (conds[k].gate || "AND") === "OR" ? (r || e) : (r && e); } return r; }
function backtest(cfg, c) {
  const closes = c.map((x) => x.c), vols = c.map((x) => x.v || 0), cache = {};
  const get = (op) => resolveOperand(op, cfg.defs, c, closes, vols, cache);
  const trades = []; let pos = null, equity = 1, peak = 1, maxDD = 0; const eq = [{ i: 0, eq: 100 }];
  for (let i = 1; i < c.length; i++) {
    if (pos) equity *= closes[i] / closes[i - 1];
    eq.push({ i, eq: +(equity * 100).toFixed(2) });
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, (peak - equity) / peak);
    if (pos) {
      const ret = closes[i] / pos.entry - 1;
      const hitSL = cfg.sl && ret <= -Math.abs(Number(cfg.sl)) / 100;
      const hitTP = cfg.tp && ret >= Math.abs(Number(cfg.tp)) / 100;
      const sig = chainEval(cfg.exit, i, get);
      if (hitSL || hitTP || sig) { trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: closes[i], ret, reason: hitSL ? "SL" : hitTP ? "TP" : "Signal" }); pos = null; }
    } else if (chainEval(cfg.entry, i, get)) pos = { i, entry: closes[i] };
  }
  if (pos) { const i = c.length - 1; trades.push({ entryIdx: pos.i, exitIdx: i, entry: pos.entry, exit: closes[i], ret: closes[i] / pos.entry - 1, reason: "EOD" }); }
  const totalRet = (trades.reduce((a, t) => a * (1 + t.ret), 1) - 1) * 100;
  const wins = trades.filter((t) => t.ret > 0).length;
  const bh = (closes[closes.length - 1] / closes[0] - 1) * 100;
  return { trades, eq, stats: { n: trades.length, wins, winRate: trades.length ? wins / trades.length * 100 : 0, totalRet, maxDD: maxDD * 100, bh, avg: trades.length ? trades.reduce((a, t) => a + t.ret, 0) / trades.length * 100 : 0 } };
}
function BacktestResult({ cfg }) {
  const [sym, setSym] = useState("RELIANCE");
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(Date.now() - 180 * 864e5));
  const [to, setTo] = useState(iso(Date.now()));
  const [preset, setPreset] = useState("6m");
  const PRESETS = { "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730 };
  const applyPreset = (k) => { setPreset(k); if (k !== "custom") { setFrom(iso(Date.now() - PRESETS[k] * 864e5)); setTo(iso(Date.now())); } };
  const stock = ALL.find((a) => a.sym === sym) || ALL[0];
  const bars = useMemo(() => { const d = (new Date(to) - new Date(from)) / 864e5; return clamp(Math.round(d > 0 ? d : 120), 20, 400); }, [from, to]);
  const data = useMemo(() => candles(sym, stock.price, stock.chg, bars), [sym, stock, bars]);
  const res = useMemo(() => (cfg.mode === "plain" ? null : backtest(cfg, data)), [cfg, data]);
  if (cfg.mode === "plain") {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>Plain-English rules are parsed on the backend at deploy time — switch to the visual builder to run a quick local backtest.</div>;
  }
  const st = res.stats;
  const tile = (k, v, c) => (
    <div style={{ flex: "1 1 0", minWidth: 64, background: "var(--bg)", borderRadius: 12, padding: "9px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14, marginTop: 2, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Backtest on</span>
        <select value={sym} onChange={(e) => setSym(e.target.value)} style={{ ...selStyle, flex: "0 0 auto", minWidth: 120 }}>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym}</option>)}</select>
        <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>{bars} bars · sim</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>Range</div>
        <div className="pill hide-scroll" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginBottom: 8, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
          {[["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["2y", "2Y"]].map(([k, l]) => (
            <button key={k} onClick={() => applyPreset(k)} className="pill tap disp" style={{ padding: "5px 13px", fontSize: 11.5, fontWeight: 700, border: "none", background: preset === k ? "var(--primary)" : "transparent", color: preset === k ? "#fff" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>From</div>
            <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="no-ring mono" style={{ ...selStyle, width: "100%", colorScheme: "light dark" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>To</div>
            <input type="date" value={to} min={from} max={iso(Date.now())} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="no-ring mono" style={{ ...selStyle, width: "100%", colorScheme: "light dark" }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tile("Return", (st.totalRet >= 0 ? "+" : "") + st.totalRet.toFixed(1) + "%", st.totalRet >= 0 ? "var(--up)" : "var(--down)")}
        {tile("Win rate", st.winRate.toFixed(0) + "%")}
        {tile("Trades", st.n)}
        {tile("Max DD", "-" + st.maxDD.toFixed(1) + "%", "var(--down)")}
      </div>
      <div style={{ height: 130, marginTop: 12, background: "var(--bg)", borderRadius: 12, padding: "8px 6px 2px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={res.eq} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <defs><linearGradient id={"eq" + sym} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} stopOpacity="0.35" /><stop offset="100%" stopColor={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Tooltip formatter={(v) => v + " (start 100)"} labelFormatter={() => "Equity"} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }} />
            <ReferenceLine y={100} stroke="var(--muted)" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="eq" stroke={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} strokeWidth={2} fill={`url(#eq${sym})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>
        Strategy <b style={{ color: st.totalRet >= st.bh ? "var(--up)" : "var(--down)" }}>{st.totalRet >= st.bh ? "beat" : "lagged"}</b> buy-and-hold ({(st.bh >= 0 ? "+" : "") + st.bh.toFixed(1)}%). Avg trade {(st.avg >= 0 ? "+" : "") + st.avg.toFixed(2)}%.
      </div>
      {res.trades.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {res.trades.slice(-4).reverse().map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 2px", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Bar {t.entryIdx} → {t.exitIdx} <span className="pill" style={{ fontSize: 9, background: "var(--bg)", padding: "1px 7px", marginLeft: 4 }}>{t.reason}</span></span>
              <span className="mono" style={{ fontWeight: 800, color: t.ret >= 0 ? "var(--up)" : "var(--down)" }}>{(t.ret * 100 >= 0 ? "+" : "") + (t.ret * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Simulated bars · indicative only, not financial advice.</div>
    </div>
  );
}

/* ============================== TRADE AUTOMATION ============================== */
const IND_CATALOG = [
  { type: "EMA", label: "EMA", needsLen: true, attrs: [] },
  { type: "SMA", label: "SMA", needsLen: true, attrs: [] },
  { type: "RSI", label: "RSI", needsLen: true, attrs: [] },
  { type: "CCI", label: "CCI", needsLen: true, attrs: [] },
  { type: "MACD", label: "MACD", needsLen: false, attrs: ["line", "signal", "hist"] },
  { type: "BB", label: "Bollinger Band", needsLen: true, attrs: ["upper", "middle", "lower"] },
  { type: "KC", label: "Keltner Channel", needsLen: true, attrs: ["upper", "middle", "lower"] },
  { type: "ATR", label: "ATR", needsLen: true, attrs: [] },
  { type: "VWAP", label: "VWAP", needsLen: false, attrs: [] },
  { type: "ADX", label: "ADX", needsLen: true, attrs: [] },
  { type: "DMA", label: "DMA (displaced MA)", needsLen: true, attrs: [] },
  { type: "Volume", label: "Volume", needsLen: false, attrs: [] },
  { type: "CurrentCandle", label: "Current candle", needsLen: false, attrs: ["open", "high", "low", "close"] },
  { type: "PrevCandle", label: "Previous candle", needsLen: false, attrs: ["open", "high", "low", "close"] },
  { type: "FirstNCandles", label: "First N candles", needsLen: true, attrs: ["open", "high", "low", "close"] },
  { type: "LastNCandles", label: "Last N candles", needsLen: true, attrs: ["open", "high", "low", "close"] },
  { type: "CurrentDay", label: "Current day", needsLen: false, attrs: ["open", "close"] },
  { type: "PrevDay", label: "Previous day", needsLen: false, attrs: ["open", "close"] },
];
const TFS = ["3m", "5m", "15m", "30m", "1h", "4h", "1D"];
const OPSET = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="], ["crosses_above", "⤴ crosses above"], ["crosses_below", "⤵ crosses below"]];
function defOperands(defs) {
  const out = [];
  defs.forEach((d) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type) || { attrs: [] };
    if (cat.attrs.length) cat.attrs.forEach((a) => out.push(`${d.name}.${a}`));
    else out.push(d.name);
  });
  return out;
}
const TEMPLATES = [
  { name: "Golden Cross + RSI", code: "EMA1 = EMA(length=50, tf=1D)\nEMA2 = EMA(length=200, tf=1D)\nif EMA1 > EMA2 AND RSI1 < 70:\n    enter_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "50", name: "EMA1" }, { type: "EMA", len: "200", name: "EMA2" }, { type: "RSI", len: "14", name: "RSI1" }], entry: [{ la: "EMA1", op: ">", bType: "ind", b: "EMA2" }, { la: "RSI1", op: "<", bType: "num", b: "70", gate: "AND" }], exit: [{ la: "EMA1", op: "crosses_below", bType: "ind", b: "EMA2" }], sl: "3", tp: "8" } },
  { name: "Bollinger squeeze", code: "if Price <= BB1.lower:\n    enter_trade()\nif Price >= BB1.upper:\n    exit_trade()", tag: "Volatility",
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }], entry: [{ la: "Price", op: "<=", bType: "ind", b: "BB1.lower" }], exit: [{ la: "Price", op: ">=", bType: "ind", b: "BB1.upper" }], sl: "4", tp: "6" } },
  { name: "MACD crossover", code: "if MACD1.line crosses_above MACD1.signal:\n    enter_trade()", tag: "Momentum",
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }], entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }], exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }], sl: "3", tp: "8" } },
  { name: "CCI reversal", code: "if CCI1 < -100:\n    enter_trade()\nif CCI1 > 100:\n    exit_trade()", tag: "Reversal",
    cfg: { mode: "builder", defs: [{ type: "CCI", len: "20", name: "CCI1" }], entry: [{ la: "CCI1", op: "<", bType: "num", b: "-100" }], exit: [{ la: "CCI1", op: ">", bType: "num", b: "100" }], sl: "3", tp: "7" } },
];
const SEED_STRATS = [
  { id: "s1", name: "Golden Cross + RSI", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[0].cfg, created: Date.now() - 128 * 864e5 },
  { id: "s2", name: "MACD crossover", by: "Matrix", active: true, alerts: false, cfg: TEMPLATES[2].cfg, created: Date.now() - 46 * 864e5 },
  { id: "s3", name: "Bollinger squeeze", by: "Matrix", active: false, alerts: false, cfg: TEMPLATES[1].cfg, created: Date.now() - 84 * 864e5 },
  { id: "s4", name: "CCI reversal", by: "Community", active: false, alerts: false, cfg: TEMPLATES[3].cfg, created: Date.now() - 210 * 864e5 },
];
// Deterministic performance for a strategy over a chosen window (days).
function stratPerf(strat, rangeDays) {
  const r = lcg(hash(strat.name + strat.by + (strat.id || "")));
  const perYearTrades = 18 + Math.floor(r() * 46);
  const trades = Math.max(1, Math.round(perYearTrades * rangeDays / 365));
  const winRate = 46 + r() * 30;
  const wins = Math.round(trades * winRate / 100);
  const perYearRet = (r() * 0.95 - 0.18) * 42; // ≈ -7.5% .. +32% annualised
  const retPct = perYearRet * (rangeDays / 365);
  const cap = 100000;
  return { trades, wins, winRate, retPct, annual: perYearRet, pnl: cap * retPct / 100, cap };
}
function Automation() {
  const [mode, setMode] = useState("builder");
  const [defs, setDefs] = useState([
    { id: 1, type: "EMA", len: "50", tf: "1D", name: "EMA1" },
    { id: 2, type: "EMA", len: "200", tf: "1D", name: "EMA2" },
    { id: 3, type: "RSI", len: "14", tf: "15m", name: "RSI1" },
    { id: 4, type: "MACD", len: "", tf: "3m", name: "MACD1" },
  ]);
  const operands = useMemo(() => ["Price", "Volume", ...defOperands(defs)], [defs]);
  const [entryConds, setEntryConds] = useState([
    { la: "EMA1", op: ">", bType: "ind", b: "EMA2" },
    { la: "RSI1", op: "<", bType: "num", b: "70", gate: "AND" },
  ]);
  const [exitConds, setExitConds] = useState([
    { la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" },
    { la: "RSI1", op: ">", bType: "num", b: "70", gate: "OR" },
  ]);
  const [sl, setSl] = useState("3");
  const [tp, setTp] = useState("8");
  const [pEntry, setPEntry] = useState("Buy when EMA1 (50) crosses above EMA2 (200) and RSI is below 70.");
  const [pExit, setPExit] = useState("Exit when MACD line crosses below its signal, or RSI rises above 70.");
  const [strats, setStrats] = useState(SEED_STRATS);
  const [stratName, setStratName] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBt, setShowBt] = useState(false);
  const [btOpen, setBtOpen] = useState(null);
  const [btTpl, setBtTpl] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [toast, setToast] = useState(null);
  const [dashBy, setDashBy] = useState("All");
  const [dashRange, setDashRange] = useState(365);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  function fireAlert(a) {
    let text;
    try {
      const data = candles("NIFTY50", 23450, 0.62, 80);
      const bt = a.cfg && a.cfg.mode !== "plain" ? backtest(a.cfg, data) : null;
      const last = bt && bt.trades.length ? bt.trades[bt.trades.length - 1] : null;
      const kind = last ? (["Signal", "TP", "SL", "EOD"].includes(last.reason) ? "Exit" : "Entry") : null;
      text = last ? `${a.name}: ${kind} signal on NIFTY50 @ ${last.exit.toFixed(2)}` : `${a.name}: alerts armed — watching for entry/exit signals`;
    } catch { text = `${a.name}: alerts armed`; }
    setNotifs((p) => [{ id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...p].slice(0, 8));
    setToast(text);
  }

  const cfg = { mode, defs, entry: entryConds, exit: exitConds, sl, tp };
  const condStr = (c) => `${c.la} ${c.op} ${c.b}`;
  const chain = (conds) => conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condStr(c)}`).join("");
  const defLines = defs.map((d) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type);
    const args = [];
    if (cat?.needsLen && d.len) args.push(`length=${d.len}`);
    args.push(`tf=${d.tf}`);
    return `${d.name} = ${d.type}(${args.join(", ")})`;
  }).join("\n");
  const code = mode === "builder"
    ? `# Indicators\n${defLines}\n\n# Entry\nif ${chain(entryConds)}:\n    enter_trade(stop_loss=${sl}%, take_profit=${tp}%)\n\n# Exit\nif ${chain(exitConds)}:\n    exit_trade()`
    : `# Indicators\n${defLines}\n\n# Plain English\n# ENTRY: ${pEntry}\n# EXIT:  ${pExit}\n# risk:  stop_loss=${sl}%  take_profit=${tp}%`;

  const saveStrategy = (makeActive) => {
    const name = stratName.trim() || (mode === "builder" ? "Custom strategy" : "Plain-English strategy");
    const strat = { id: "u" + Date.now(), name, by: "You", active: makeActive, alerts: false, cfg, created: Date.now() };
    setStrats((p) => [strat, ...p]);
    setStratName(""); setShowBuilder(false);
    setToast(`${name} ${makeActive ? "deployed & running" : "saved as draft"}`);
  };
  const activateTemplate = (t) => {
    setStrats((p) => p.find((x) => x.name === t.name && x.by === "Matrix") ? p.map((x) => x.name === t.name ? { ...x, active: true } : x) : [{ id: "t" + Date.now(), name: t.name, by: "Matrix", active: true, alerts: false, cfg: t.cfg, created: Date.now() }, ...p]);
    setToast(`${t.name} activated`);
  };
  const toggleActive = (id) => setStrats((p) => p.map((s) => s.id === id ? { ...s, active: !s.active } : s));
  const toggleAlerts = (s) => { const willOn = !s.alerts; setStrats((p) => p.map((x) => x.id === s.id ? { ...x, alerts: willOn } : x)); if (willOn) fireAlert(s); };

  // dashboard aggregation
  const shown = strats.filter((s) => dashBy === "All" || s.by === dashBy);
  const perf = shown.map((s) => ({ s, p: stratPerf(s, dashRange) }));
  const agg = perf.reduce((a, { p }) => { a.trades += p.trades; a.wins += p.wins; a.pnl += p.pnl; a.cap += p.cap; a.annSum += p.annual; return a; }, { trades: 0, wins: 0, pnl: 0, cap: 0, annSum: 0 });
  const activeCount = shown.filter((s) => s.active).length;
  const dWinRate = agg.trades ? agg.wins / agg.trades * 100 : 0;
  const dRet = agg.cap ? agg.pnl / agg.cap * 100 : 0;
  const dAnn = perf.length ? agg.annSum / perf.length : 0;
  const activeStrats = perf.filter(({ s }) => s.active);
  const inactiveStrats = perf.filter(({ s }) => !s.active);
  const byOptions = ["All", "Matrix", "You", "Community"];
  const dsel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 8px", fontSize: 11.5 };
  const fmtDate = (t) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

  const DStat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 28%", minWidth: 88, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ fontSize: 9.5, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 15, marginTop: 3, color: c || "#fff" }}>{v}</div>
    </div>
  );
  const MetricMini = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 74 }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  const StrategyCard = ({ s, p }) => (
    <div className="card" style={{ padding: 15, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, flex: "0 0 auto", background: s.active ? "var(--up)" : "var(--muted)", boxShadow: s.active ? "0 0 0 4px var(--up-soft)" : "none" }} />
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>by {s.by} · started {fmtDate(s.created)}</div>
          </div>
        </div>
        {s.alerts && <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 8px", display: "flex", alignItems: "center", gap: 3, flex: "0 0 auto" }}><Bell size={10} /> Alerts</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <MetricMini k="Trades" v={p.trades} />
        <MetricMini k="Win rate" v={p.winRate.toFixed(0) + "%"} />
        <MetricMini k="P&L" v={(p.pnl >= 0 ? "+" : "") + fmt(p.pnl, "IN")} c={p.pnl >= 0 ? "var(--up)" : "var(--down)"} />
        <MetricMini k="Returns" v={(p.retPct >= 0 ? "+" : "") + p.retPct.toFixed(1) + "%"} c={p.retPct >= 0 ? "var(--up)" : "var(--down)"} />
        <MetricMini k="Annualised" v={(p.annual >= 0 ? "+" : "") + p.annual.toFixed(1) + "%"} c={p.annual >= 0 ? "var(--up)" : "var(--down)"} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
        <button onClick={() => toggleAlerts(s)} className="tap" title="Alert on entry/exit signal" style={{ border: "1px solid " + (s.alerts ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.alerts ? "var(--primary)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: s.alerts ? "#fff" : "var(--ink)" }}><Bell size={14} /></button>
        <button onClick={() => setBtOpen(btOpen === s.id ? null : s.id)} className="tap" style={{ border: "1px solid " + (btOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: btOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: btOpen === s.id ? "var(--primary)" : "var(--ink)" }}><Activity size={13} /> Backtest</button>
        <button onClick={() => toggleActive(s.id)} className="tap" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", padding: "7px 10px", display: "flex", gap: 5, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
          {s.active ? <><Pause size={13} /> Deactivate</> : <><Play size={13} /> Activate</>}
        </button>
      </div>
      {btOpen === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg || { mode: "plain" }} />
        </div>
      )}
    </div>
  );

  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>Trade Automation</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Track performance and manage your automated strategies.</div>

      {/* Automation dashboard */}
      <div className="card glow" style={{ marginTop: 18, padding: 18, border: "none", background: "var(--feature-grad)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Automation Dashboard</div>
          <span style={{ fontSize: 10.5, opacity: .85 }}>last {dashRange >= 365 ? "12 months" : dashRange + "d"}</span>
        </div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 8 }}>{dRet >= 0 ? "+" : ""}{fmt(agg.pnl, "IN")}</div>
        <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>Total P&amp;L across {shown.length} strategies</div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 }}>
          <DStat k="Active strategies" v={activeCount} />
          <DStat k="Trades executed" v={agg.trades} />
          <DStat k="Win rate" v={agg.trades ? dWinRate.toFixed(0) + "%" : "—"} />
          <DStat k="P&L total" v={(agg.pnl >= 0 ? "+" : "") + fmt(agg.pnl, "IN")} c={agg.pnl >= 0 ? "#9CFFD6" : "#FFB3BE"} />
          <DStat k="Returns %" v={(dRet >= 0 ? "+" : "") + dRet.toFixed(2) + "%"} c={dRet >= 0 ? "#9CFFD6" : "#FFB3BE"} />
          <DStat k="Annualised %" v={(dAnn >= 0 ? "+" : "") + dAnn.toFixed(1) + "%"} c={dAnn >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <select value={dashBy} onChange={(e) => setDashBy(e.target.value)} style={dsel}>{byOptions.map((o) => <option key={o} value={o}>Created by: {o}</option>)}</select>
          <select value={dashRange} onChange={(e) => setDashRange(+e.target.value)} style={dsel}><option value={30}>30d</option><option value={90}>3m</option><option value={180}>6m</option><option value={365}>12m</option></select>
        </div>
      </div>

      {/* Create a new automated strategy */}
      <button onClick={() => setShowBuilder((v) => !v)} className="tap disp glow" style={{ width: "100%", marginTop: 16, background: showBuilder ? "var(--surface)" : "linear-gradient(120deg,var(--primary),var(--primary-2))", color: showBuilder ? "var(--ink)" : "#fff", border: showBuilder ? "1px solid var(--line)" : "none", borderRadius: 16, padding: 15, fontWeight: 700, fontSize: 14.5, display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
        {showBuilder ? <><X size={17} /> Close builder</> : <><Plus size={18} /> Create a New Automated Strategy</>}
      </button>

      {showBuilder && (
        <div className="fade">
          {/* Strategy Ideas (templates) */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "18px 2px 10px", display: "flex", alignItems: "center", gap: 7 }}><Sparkles size={14} color="var(--primary)" /> Strategy Ideas — start from a template</div>
          <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2 }}>
            {TEMPLATES.map((t) => (
              <div key={t.name} className="card" style={{ flex: "0 0 auto", width: 236, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="disp" style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                  <span className="pill" style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 700, padding: "2px 8px" }}>{t.tag}</span>
                </div>
                <pre className="mono" style={{ fontSize: 10, background: "var(--bg)", borderRadius: 12, padding: 10, marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{t.code}</pre>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={() => activateTemplate(t)} className="tap pill" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 700, fontSize: 11.5, padding: 8, color: "var(--ink)" }}>Activate</button>
                  <button onClick={() => setBtTpl(btTpl === t.name ? null : t.name)} className="tap pill" style={{ flex: 1, border: "1px solid " + (btTpl === t.name ? "var(--primary)" : "var(--line)"), background: btTpl === t.name ? "var(--primary-soft)" : "var(--surface)", fontWeight: 700, fontSize: 11.5, padding: 8, color: btTpl === t.name ? "var(--primary)" : "var(--ink)", display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}><Activity size={13} /> Backtest</button>
                </div>
              </div>
            ))}
          </div>
          {btTpl && (
            <div className="card" style={{ marginTop: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>Backtest · {btTpl} <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>· pick a stock or index</span></span>
                <X size={18} className="tap" color="var(--muted)" onClick={() => setBtTpl(null)} />
              </div>
              <BacktestResult cfg={(TEMPLATES.find((x) => x.name === btTpl) || {}).cfg} />
            </div>
          )}

          {/* Step 1 — define indicators */}
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 1</span> Your indicators
            </div>
            <div className="gold-line" style={{ width: 40, margin: "10px 0 14px", borderRadius: 2 }} />
            <IndicatorDefs defs={defs} setDefs={setDefs} />
          </div>

          {/* Step 2 — signals */}
          <div className="card" style={{ marginTop: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 2</span> Signals
              </div>
              <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3 }}>
                {[["builder", "Builder"], ["plain", "Plain English"]].map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)} className="pill tap disp" style={{ padding: "5px 12px", fontSize: 11.5, fontWeight: 700, border: "none", background: mode === k ? "var(--primary)" : "transparent", color: mode === k ? "#fff" : "var(--muted)" }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="gold-line" style={{ width: 40, margin: "2px 0 16px", borderRadius: 2 }} />

            {mode === "builder" ? (
              <>
                <CondBuilder2 label="Entry signal — combine indicators with AND / OR" conds={entryConds} setConds={setEntryConds} operands={operands} />
                <div className="silver-line" style={{ margin: "16px 0" }} />
                <CondBuilder2 label="Exit signal" conds={exitConds} setConds={setExitConds} operands={operands} />
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Entry rules (plain English)</div>
                <textarea value={pEntry} onChange={(e) => setPEntry(e.target.value)} className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 64, background: "var(--surface)", resize: "vertical" }} />
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "12px 0 6px" }}>Exit rules (plain English)</div>
                <textarea value={pExit} onChange={(e) => setPExit(e.target.value)} className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 64, background: "var(--surface)", resize: "vertical" }} />
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <NumF label="Stop loss %" v={sl} set={setSl} />
              <NumF label="Take profit %" v={tp} set={setTp} />
            </div>
            <pre className="mono" style={{ fontSize: 11, background: "#0E0E18", color: "#C9D2FF", border: "1px solid #2A2A3D", borderRadius: 12, padding: 13, marginTop: 14, whiteSpace: "pre-wrap", lineHeight: 1.55, overflowX: "auto" }}>{code}</pre>

            <button onClick={() => setShowBt((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Activity size={16} color="var(--primary)" /> {showBt ? "Hide backtest" : "Backtest this strategy"}</button>
            {showBt && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <BacktestResult cfg={cfg} />
              </div>
            )}

            {/* Save */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Strategy name</div>
              <input value={stratName} onChange={(e) => setStratName(e.target.value)} placeholder="e.g. My Nifty swing setup" className="no-ring disp" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => saveStrategy(false)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Check size={16} color="var(--primary)" /> Save strategy</button>
                <button onClick={() => saveStrategy(true)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Bolt size={16} /> Save &amp; deploy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal alerts */}
      {notifs.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 8px" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Signal alerts</span>
            <button onClick={() => setNotifs([])} className="tap" style={{ border: "none", background: "transparent", fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>Clear</button>
          </div>
          <div className="card" style={{ padding: 13, marginBottom: 4 }}>
            {notifs.map((nt) => (
              <div key={nt.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)" }}>
                <Bell size={13} color="var(--primary)" style={{ flex: "0 0 auto" }} />
                <span style={{ fontSize: 12, flex: 1 }}>{nt.text}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{nt.time}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Strategies — Active / Inactive */}
      <div className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "28px 2px 4px" }}>Strategies</div>
      <div className="gold-line" style={{ width: 44, margin: "0 0 14px 2px", borderRadius: 2 }} />

      <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--up)", letterSpacing: ".04em", margin: "4px 2px 10px", display: "flex", alignItems: "center", gap: 6 }}>● ACTIVE <span style={{ color: "var(--muted)", fontWeight: 700 }}>({activeStrats.length})</span></div>
      {activeStrats.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>No active strategies for this filter.</div>
        : activeStrats.map(({ s, p }) => <StrategyCard key={s.id} s={s} p={p} />)}

      <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", letterSpacing: ".04em", margin: "16px 2px 10px", display: "flex", alignItems: "center", gap: 6 }}>● INACTIVE <span style={{ fontWeight: 700 }}>({inactiveStrats.length})</span></div>
      {inactiveStrats.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No inactive strategies for this filter.</div>
        : inactiveStrats.map(({ s, p }) => <StrategyCard key={s.id} s={s} p={p} />)}

      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", zIndex: 80, pointerEvents: "none" }}>
          <div className="card glow" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", maxWidth: 380, border: "1px solid var(--primary)" }}>
            <Bell size={16} color="var(--primary)" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
function IndicatorDefs({ defs, setDefs }) {
  const upd = (id, k, v) => setDefs((p) => p.map((d) => d.id === id ? { ...d, [k]: v } : d));
  const add = () => setDefs((p) => [...p, { id: Date.now(), type: "EMA", len: "20", tf: "1D", name: "IND" + (p.length + 1) }]);
  return (
    <div>
      {defs.map((d) => {
        const cat = IND_CATALOG.find((c) => c.type === d.type) || {};
        return (
          <div key={d.id} style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", marginBottom: 8 }}>
            <select value={d.type} onChange={(e) => upd(d.id, "type", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "9px 4px" }}>{IND_CATALOG.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}</select>
            <input value={cat.needsLen ? d.len : "—"} onChange={(e) => upd(d.id, "len", e.target.value)} disabled={!cat.needsLen} placeholder="len" className="no-ring mono" style={{ ...selStyle, flex: "0 0 40px", minWidth: 0, textAlign: "center", padding: "9px 2px", opacity: cat.needsLen ? 1 : 0.4 }} />
            <select value={d.tf} onChange={(e) => upd(d.id, "tf", e.target.value)} style={{ ...selStyle, flex: "0 0 56px", minWidth: 0, padding: "9px 2px" }}>{TFS.map((t) => <option key={t}>{t}</option>)}</select>
            <input value={d.name} onChange={(e) => upd(d.id, "name", e.target.value)} placeholder="name" className="no-ring disp" style={{ ...selStyle, flex: "1 1 0", minWidth: 0, fontWeight: 700, padding: "9px 6px" }} />
            <button onClick={() => setDefs((p) => p.filter((x) => x.id !== d.id))} className="tap" style={{ border: "none", background: "transparent", flex: "0 0 auto", padding: 2 }}><Trash2 size={15} color="var(--down)" /></button>
          </div>
        );
      })}
      <button onClick={add} className="tap" style={{ marginTop: 4, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add indicator</button>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Tip: name them (e.g. EMA1, MACD1). Only these appear in your signals below.</div>
    </div>
  );
}
function CondBuilder2({ label, conds, setConds, operands }) {
  const upd = (i, k, v) => setConds((p) => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const add = () => setConds((p) => [...p, { la: operands[0] || "Price", op: "<", bType: "num", b: "30", gate: "AND" }]);
  const del = (i) => setConds((p) => p.filter((_, j) => j !== i).map((c, j) => { if (j === 0) { const { gate, ...rest } = c; return rest; } return c; }));
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {conds.map((c, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          {i > 0 && (
            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              {["AND", "OR"].map((g) => (
                <button key={g} onClick={() => upd(i, "gate", g)} className="pill tap disp" style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 14px", border: "1px solid var(--line)", background: (c.gate || "AND") === g ? "var(--primary)" : "transparent", color: (c.gate || "AND") === g ? "#fff" : "var(--muted)" }}>{g}</button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", background: "var(--bg)", borderRadius: 12, padding: 8 }}>
            <select value={c.la} onChange={(e) => upd(i, "la", e.target.value)} style={{ ...selStyle, flex: "1 1 104px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
            <select value={c.op} onChange={(e) => upd(i, "op", e.target.value)} style={{ ...selStyle, flex: "1 1 96px" }}>{OPSET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 2, flex: "0 0 auto" }}>
              {[["ind", "Ind"], ["num", "#"]].map(([k, l]) => (
                <button key={k} onClick={() => upd(i, "bType", k)} className="pill tap" style={{ fontSize: 10.5, fontWeight: 800, padding: "4px 9px", border: "none", background: c.bType === k ? "var(--primary)" : "transparent", color: c.bType === k ? "#fff" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
            {c.bType === "ind"
              ? <select value={c.b} onChange={(e) => upd(i, "b", e.target.value)} style={{ ...selStyle, flex: "1 1 104px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
              : <input value={c.b} onChange={(e) => upd(i, "b", e.target.value)} className="no-ring mono" style={{ ...selStyle, flex: "1 1 64px", textAlign: "center" }} />}
            <button onClick={() => del(i)} disabled={conds.length === 1} className="tap" style={{ border: "none", background: "transparent", opacity: conds.length === 1 ? 0.3 : 1 }}><Trash2 size={15} color="var(--down)" /></button>
          </div>
        </div>
      ))}
      <button onClick={add} className="tap" style={{ marginTop: 10, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add condition</button>
    </div>
  );
}
function NumF({ label, v, set }) {
  return <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 5 }}>{label}</div>
    <input value={v} onChange={(e) => set(e.target.value)} className="no-ring mono" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: 10, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} /></div>;
}

/* ============================== SEARCH OVERLAY ============================== */
function SearchOverlay({ onClose, onOpen }) {
  const [q, setQ] = useState("");
  const res = ALL.filter((s) => (s.sym + s.name).toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 70, maxWidth: 460, margin: "0 auto" }} className="mx">
      <div style={{ display: "flex", gap: 10, padding: 14, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        <Search size={20} color="var(--muted)" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any stock…" className="no-ring" style={{ flex: 1, border: "none", fontSize: 16, background: "transparent" }} />
        <X size={22} className="tap" onClick={onClose} color="var(--muted)" />
      </div>
      <div className="hide-scroll" style={{ overflowY: "auto", height: "calc(100% - 60px)", padding: "0 14px" }}>
        {res.map((s) => <ListRow key={s.sym} s={s} market={marketOf(s.sym)} onOpen={(x) => { onOpen(x); }} />)}
        {res.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 40, fontSize: 14 }}>No matches. Try “TCS”, “NVDA”, “BTC”…</div>}
      </div>
    </div>
  );
}

/* ============================== AUTH (signup / login) ============================== */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [step, setStep] = useState(0); // signup: 0=identifier,1=name,2=pin
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const validIdentifier = /^\S+@\S+\.\S+$/.test(identifier.trim()) || /^\+?\d{7,15}$/.test(identifier.trim());

  const reset = () => { setStep(0); setIdentifier(""); setName(""); setPin(""); setConfirmPin(""); setErr(""); };
  const switchMode = (m) => { setMode(m); reset(); };

  const doLogin = async () => {
    setErr(""); setBusy(true);
    try {
      const user = await apiLogin(identifier.trim(), pin);
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      onAuthed(user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doSignup = async () => {
    if (pin !== confirmPin) { setErr("PINs don't match"); return; }
    setErr(""); setBusy(true);
    try {
      const user = await apiSignup(identifier.trim(), name.trim(), pin);
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      onAuthed(user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const inputStyle = { width: "100%", padding: "15px 16px", borderRadius: 16, border: "1.5px solid var(--line)", background: "var(--surface)", fontSize: 15, color: "var(--ink)" };
  const btnStyle = { width: "100%", padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--bg)", maxWidth: 460, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column" }} className="mx">
      <div className="disp" style={{ fontWeight: 700, fontSize: 26, marginTop: 30, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--primary)" }}>✦</span> <span className="gradtext">Matrix</span>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, marginBottom: 30 }}>
        {mode === "login" ? "Welcome back. Log in to continue." : "Create your account to get started."}
      </div>

      {mode === "login" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} placeholder="Mobile number or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <input style={inputStyle} placeholder="4-6 digit PIN" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          {err && <div style={{ color: "var(--down)", fontSize: 13 }}>{err}</div>}
          <button disabled={busy || !identifier.trim() || pin.length < 4} onClick={doLogin} className="tap" style={{ ...btnStyle, opacity: busy || !identifier.trim() || pin.length < 4 ? 0.6 : 1 }}>{busy ? "Logging in…" : "Log In"}</button>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            New here? <span className="tap" style={{ color: "var(--primary)", fontWeight: 700 }} onClick={() => switchMode("signup")}>Create an account</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>{[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? "var(--primary)" : "var(--line)" }} />)}</div>

          {step === 0 && (
            <>
              <input autoFocus style={inputStyle} placeholder="Mobile number or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              {err && <div style={{ color: "var(--down)", fontSize: 13 }}>{err}</div>}
              <button disabled={!validIdentifier} onClick={() => { setErr(""); setStep(1); }} className="tap" style={{ ...btnStyle, opacity: validIdentifier ? 1 : 0.6 }}>Continue</button>
            </>
          )}
          {step === 1 && (
            <>
              <input autoFocus style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              {err && <div style={{ color: "var(--down)", fontSize: 13 }}>{err}</div>}
              <button disabled={!name.trim()} onClick={() => { setErr(""); setStep(2); }} className="tap" style={{ ...btnStyle, opacity: name.trim() ? 1 : 0.6 }}>Continue</button>
            </>
          )}
          {step === 2 && (
            <>
              <input autoFocus style={inputStyle} placeholder="Set a 4-6 digit PIN" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              <input style={inputStyle} placeholder="Confirm PIN" type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} />
              {err && <div style={{ color: "var(--down)", fontSize: 13 }}>{err}</div>}
              <button disabled={busy || pin.length < 4 || confirmPin.length < 4} onClick={doSignup} className="tap" style={{ ...btnStyle, opacity: busy || pin.length < 4 || confirmPin.length < 4 ? 0.6 : 1 }}>{busy ? "Creating account…" : "Create Account"}</button>
            </>
          )}

          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            Already have an account? <span className="tap" style={{ color: "var(--primary)", fontWeight: 700 }} onClick={() => switchMode("login")}>Log in</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== ONBOARDING ============================== */
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ proficiency: "Beginner", risk: "Balanced", reward: "", style: "Technical", caps: [], sectors: [] });
  const steps = [
    { key: "proficiency", q: "How would you rate your investing skill?", opts: ["Beginner", "Intermediate", "Pro"], multi: false },
    { key: "risk", q: "Your risk appetite?", opts: ["Conservative", "Balanced", "Aggressive"], multi: false },
    { key: "style", q: "Your investing style?", opts: ["Technical", "Fundamental", "News / Event"], multi: false },
    { key: "caps", q: "Preferred market caps?", opts: ["Large", "Mid", "Small"], multi: true },
    { key: "sectors", q: "Any favourite sectors?", opts: ["IT", "Banking", "Auto", "Consumer Tech", "Energy", "Defence"], multi: true },
  ];
  const cur = steps[step];
  const toggle = (o) => {
    if (cur.multi) setP((s) => ({ ...s, [cur.key]: s[cur.key].includes(o) ? s[cur.key].filter((x) => x !== o) : [...s[cur.key], o] }));
    else setP((s) => ({ ...s, [cur.key]: o }));
  };
  const val = p[cur.key];
  const next = () => { if (step < steps.length - 1) setStep(step + 1); else onDone(p); };
  const back = () => { if (step > 0) setStep(step - 1); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--bg)", maxWidth: 460, margin: "0 auto", padding: 22, display: "flex", flexDirection: "column" }} className="mx">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 10, minHeight: 38 }}>
        {step > 0 && (
          <button onClick={back} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center", color: "var(--ink)" }}><ChevronLeft size={20} /></button>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Step {step + 1} of {steps.length}</span>
      </div>
      <div style={{ display: "flex", gap: 5 }}>{steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? "var(--primary)" : "var(--line)" }} />)}</div>
      <div className="disp" style={{ fontWeight: 700, fontSize: 24, marginTop: 30, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--primary)" }}>✦</span> Matrix</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Let's personalise your edge.</div>
      <div className="disp" style={{ fontWeight: 700, fontSize: 19, marginTop: 30 }}>{cur.q}</div>
      <div style={{ marginTop: 16, flex: 1 }}>
        {cur.opts.map((o) => {
          const sel = cur.multi ? val.includes(o) : val === o;
          return <button key={o} onClick={() => toggle(o)} className="tap" style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "15px 16px", borderRadius: 16, border: "1.5px solid " + (sel ? "var(--primary)" : "var(--line)"), background: sel ? "var(--primary-soft)" : "var(--surface)", fontWeight: 600, fontSize: 14.5, display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ink)" }}>{o}{sel && <Check size={18} color="var(--primary)" />}</button>;
        })}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onDone(null)} className="tap" style={{ flex: "0 0 auto", padding: "15px 18px", borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, color: "var(--muted)" }}>Skip</button>
        <button onClick={next} className="tap disp glow" style={{ flex: 1, padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", fontWeight: 700, fontSize: 15 }}>{step < steps.length - 1 ? "Continue" : "Enter Matrix"}</button>
      </div>
    </div>
  );
}

/* ============================== PROFILE SHEET ============================== */
function ProfileSheet({ profile, wallet, onClose, user, onLogout }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.32)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "24px 24px 0 0", padding: 20 }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,var(--primary),var(--primary-2))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 20 }} className="disp">{(user?.name || "M")[0].toUpperCase()}</div>
          <div><div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>{user?.name || "My Profile"}</div><div style={{ fontSize: 12.5, color: "var(--muted)" }}>{user?.identifier || "Virtual investor"}</div></div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 14, background: "var(--bg)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Virtual wallet</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 22 }}>{fmt(wallet, "IN")}</div>
        </div>
        {profile ? (
          <div style={{ marginTop: 14 }}>
            {[["Skill", profile.proficiency], ["Risk", profile.risk], ["Style", profile.style], ["Caps", profile.caps.join(", ") || "All"], ["Sectors", profile.sectors.join(", ") || "All"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        ) : <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>Personalisation skipped. Reopen the app to set preferences.</div>}
        {onLogout && (
          <button onClick={onLogout} className="tap" style={{ width: "100%", marginTop: 18, padding: 14, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 700, color: "var(--down)" }}>Log Out</button>
        )}
      </div>
    </div>
  );
}

/* ============================== ROOT ============================== */
export default function App() {
  const [theme, setTheme] = useState("dark");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [onboard, setOnboard] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("home");
  const [market, setMarket] = useState("IN");
  const [segment, setSegment] = useState("Stocks");
  const [wallet, setWallet] = useState(1000000);
  const [portfolio, setPortfolio] = useState([]);
  const [watchlists, setWatchlists] = useState([{ id: "w1", name: "My Watchlist", syms: ["ZOMATO", "TATAPOWER"] }]);
  const [activeWl, setActiveWl] = useState("w1");
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tradePreset, setTradePreset] = useState(null);
  const [live, setLive] = useState(false);
  const [liveAt, setLiveAt] = useState(null);
  const [, setLiveTick] = useState(0);

  // Restore a logged-in session from localStorage on load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        setProfile(u.profile || null);
        setOnboard(!u.onboarded); // only show personalization if it hasn't been done before
      }
    } catch { /* corrupted/no session -> stay logged out */ }
    setAuthChecked(true);
  }, []);

  // Overlay real Yahoo prices (via the proxy) onto the universe when configured.
  useEffect(() => {
    if (!BACKEND_URL) return;
    let stop = false;
    const pull = async () => {
      try {
        const rows = await fetchLiveQuotes(ALL.map((a) => a.sym));
        if (stop || !rows || !rows.length) return;
        let n = 0;
        rows.forEach((r) => { const s = ALL.find((a) => a.sym === r.sym); if (s) { s.price = r.price; s.chg = r.chg; n++; } });
        if (n) { setLive(true); setLiveAt(Date.now()); setLiveTick((t) => t + 1); }
      } catch { /* stay on simulated */ }
    };
    pull();
    const id = setInterval(pull, 30000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const watch = useMemo(() => (watchlists.find((w) => w.id === activeWl)?.syms) || [], [watchlists, activeWl]);
  const toggleWatch = (sym) => setWatchlists((p) => p.map((w) => w.id === activeWl ? { ...w, syms: w.syms.includes(sym) ? w.syms.filter((x) => x !== sym) : [...w.syms, sym] } : w));
  const createWatchlist = (name) => { const id = "w" + Date.now(); setWatchlists((p) => [...p, { id, name: name && name.trim() ? name.trim() : "List " + (p.length + 1), syms: [] }]); setActiveWl(id); };
  const deleteWatchlist = (id) => setWatchlists((p) => { const n = p.filter((w) => w.id !== id); if (!n.length) { setActiveWl("w1"); return [{ id: "w1", name: "My Watchlist", syms: [] }]; } if (id === activeWl) setActiveWl(n[0].id); return n; });
  const openStock = (s) => { setSearch(false); setDrawer(s); };
  const openDetail = (s) => { setDrawer(null); setDetail(s); };
  const goTrade = (s) => { setDetail(null); setTradePreset(s); setTab("trade"); };

  // personalised ordering for picks
  const list = useMemo(() => {
    let arr = [...UNIVERSE[market]];
    if (profile) {
      arr.sort((a, b) => {
        const score = (s) => (profile.caps.length && profile.caps.includes(s.cap) ? 3 : 0) + (profile.sectors.includes(s.sector) ? 3 : 0) + (profile.risk === "Aggressive" ? s.chg : profile.risk === "Conservative" ? -Math.abs(s.chg) + (s.cap === "Large" ? 2 : 0) : s.bull / 20);
        return score(b) - score(a);
      });
    }
    return arr;
  }, [market, profile]);

  const nav = [["home", Home, "Home"], ["trade", Repeat, "Trade"], ["ideas", Lightbulb, "Ideas"], ["automation", Bolt, "Auto"], ["portfolio", Briefcase, "Portfolio"], ["watchlist", Star, "Watch"], ["ask", Bot, "Ask"]];

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null); setProfile(null); setOnboard(false); setShowProfile(false);
  };
  const handleOnboardDone = async (p) => {
    setProfile(p); setOnboard(false);
    if (user) {
      try {
        const updated = await apiSaveProfile(user.identifier, p);
        localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
        setUser(updated);
      } catch { /* profile still applies locally even if the save call fails */ }
    }
  };

  if (!authChecked) return <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}><style>{CSS}</style></div>;
  if (!user) {
    return (
      <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
        <style>{CSS}</style>
        <AuthScreen onAuthed={(u) => { setUser(u); setProfile(u.profile || null); setOnboard(!u.onboarded); }} />
      </div>
    );
  }

  return (
    <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* fixed gradient backdrop so it stays behind scroll */}
      <div style={{ position: "fixed", inset: 0, background: "var(--app-bg, var(--bg))", zIndex: 0, pointerEvents: "none" }} />
      {onboard && <Onboarding onDone={handleOnboardDone} />}

      <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 86 }}>
        {/* ambient glow */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 420, height: 320, background: "radial-gradient(circle, rgba(154,108,255,.28), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        {/* HEADER */}
        <div className="glass" style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--header-bg)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 8px" }}>
            <div onClick={() => { setTab("home"); setDetail(null); }} className="tap disp" style={{ fontWeight: 700, fontSize: 21, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: "var(--primary)", fontSize: 20 }}>✦</span><span className="gradtext">Matrix</span>
              <span className="pill" title={live ? "Live prices via Yahoo Finance" : "Realistic simulated prices"} style={{ marginLeft: 4, fontSize: 8.5, fontWeight: 800, letterSpacing: ".05em", padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, background: live ? "var(--up-soft)" : "var(--primary-soft)", color: live ? "var(--up)" : "var(--primary)" }}>
                <span style={{ width: 5, height: 5, borderRadius: 5, background: live ? "var(--up)" : "var(--primary)", boxShadow: live ? "0 0 0 3px var(--up-soft)" : "none" }} />{live ? "LIVE" : "SIM"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {/* theme slider */}
              <div className="pill tap" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                style={{ display: "flex", alignItems: "center", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, position: "relative", width: 60, height: 30 }}>
                <div className="pill" style={{ position: "absolute", top: 3, left: theme === "dark" ? 3 : 30, width: 24, height: 22, background: "var(--primary)", transition: "left .22s cubic-bezier(.22,1,.36,1)", boxShadow: "var(--glow)" }} />
                <div style={{ flex: 1, display: "grid", placeItems: "center", zIndex: 1, color: theme === "dark" ? "#fff" : "var(--muted)" }}><Moon size={13} /></div>
                <div style={{ flex: 1, display: "grid", placeItems: "center", zIndex: 1, color: theme === "light" ? "#fff" : "var(--muted)" }}><Sun size={14} /></div>
              </div>
              <div onClick={() => setShowProfile(true)} className="tap pill gold-border" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px" }}>
                <Wallet size={15} color="var(--gold)" /><span className="mono gold-text" style={{ fontWeight: 800, fontSize: 12.5 }}>{compact(wallet)}</span>
              </div>
              <div onClick={() => setShowProfile(true)} className="tap glow" style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,var(--primary),var(--primary-2))", display: "grid", placeItems: "center", color: "#fff" }}><User size={18} /></div>
            </div>
          </div>
          <div style={{ padding: "0 18px 14px" }}>
            <div onClick={() => setSearch(true)} className="tap" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", color: "var(--muted)", fontSize: 13.5 }}>
              <Search size={17} /> Search any stock, crypto or commodity…
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "0 18px", position: "relative", zIndex: 1 }}>
          {detail ? (
            <DetailPage s={detail} onBack={() => setDetail(null)} watched={watch.includes(detail.sym)} toggleWatch={toggleWatch} onTrade={goTrade} />
          ) : (
            <>
              {tab === "home" && <HomeView market={market} setMarket={setMarket} segment={segment} setSegment={setSegment} list={list} onOpen={openStock} watch={watch} toggleWatch={toggleWatch} profile={profile} portfolio={portfolio} wallet={wallet} onGoPortfolio={() => { setDetail(null); setTab("portfolio"); }} />}
              {tab === "trade" && <TradeView wallet={wallet} setWallet={setWallet} portfolio={portfolio} setPortfolio={setPortfolio} preset={tradePreset} market={market} />}
              {tab === "ideas" && <Ideas onOpen={openStock} />}
              {tab === "automation" && <Automation />}
              {tab === "portfolio" && <Portfolio portfolio={portfolio} wallet={wallet} />}
              {tab === "watchlist" && <WatchlistView watchlists={watchlists} activeWl={activeWl} setActiveWl={setActiveWl} createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist} toggleWatch={toggleWatch} onOpen={openStock} />}
              {tab === "ask" && (
                <div className="fade">
                  <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Ask Matrix</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Your AI markets expert. Ask about any stock, sector or strategy.</div>
                  <div className="card" style={{ padding: 14, height: 520 }}>
                    <ChatPanel suggestions={["Is it a good time to buy Indian IT?", "Explain RSI vs MACD simply", "Build me a swing-trade checklist", "What sectors look strong now?"]} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* BOTTOM NAV */}
        {!detail && (
          <div className="glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--header-bg)", borderTop: "1px solid var(--line)", borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px rgba(40,10,80,.3)", display: "flex", padding: "9px 4px 11px", zIndex: 40 }}>
            {nav.map(([k, Icon, label]) => (
              <button key={k} onClick={() => { setTab(k); setTradePreset(null); }} className="tap" style={{ flex: 1, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === k ? "var(--primary)" : "var(--muted)" }}>
                <Icon size={20} fill={k === "watchlist" && tab === k ? "var(--primary)" : "none"} />
                <span style={{ fontSize: 9.5, fontWeight: 700 }}>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {drawer && <Drawer s={drawer} onClose={() => setDrawer(null)} onDetails={openDetail} />}
      {search && <SearchOverlay onClose={() => setSearch(false)} onOpen={openStock} />}
      {showProfile && <ProfileSheet profile={profile} wallet={wallet} onClose={() => setShowProfile(false)} user={user} onLogout={handleLogout} />}
    </div>
  );
}
