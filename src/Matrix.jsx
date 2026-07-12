import React, { useState, useMemo, useRef, useEffect } from "react";
import { fetchFundamentals, fetchIndicators, fetchTrades, marketOpen, postTrade, resolveExitFromCandles, fetchLiveQuotes } from "./domain/api";
import {
  Search, User, Wallet, Home, Repeat, Lightbulb, Bot, Bolt, Briefcase,
  Star, TrendingUp, TrendingDown, X, ChevronRight, Send, Plus, Trash2,
  ArrowUpRight, ArrowDownRight, Sparkles, SlidersHorizontal, Check,
  Activity, Newspaper, Building2, Filter, Play, Pause, ChevronLeft, Zap, Sun, Moon, Bell, Pencil, Clock, LogIn, LogOut
} from "lucide-react";

/* ---- Modular layers (see product.md architecture) ----
   config    : environment
   lib/*     : pure maths & formatting (no I/O)
   services/*: all I/O + the Risk Engine (no UI, no React)
   hooks/*   : React bindings over the services
   This file now holds domain data (the universe) + UI, and is being
   progressively broken up further. Business logic lives in services/.        */
import { BACKEND_URL, MATRIX_PERSONA, TF_YF } from "./config";
import { CUR, MKT_LABEL, fmt, compact, clamp, hash, lcg, DAY, timeAgo, lsGet, lsSet, getUserId } from "./lib/format";
import { smaSeries, emaSeries as emaSeriesC, bollingerSeries, macdSeries, rsiSeries, OVERLAYS, CHART_TFS } from "./lib/indicators";
import { getQuotes, getHistory, getNews, getIndicators, getFundamentals } from "./services/marketService";
import { ask as aiAsk, interpretScreen, interpretStrategy, marketBrief } from "./services/aiService";
import { saveTrade as apiSaveTrade, listTrades, register as apiRegisterSvc, login as apiLoginSvc } from "./services/tradeService";
import { validateOrder, isMarketOpen, DEFAULT_LIMITS } from "./services/riskService";
import { analyzeStock } from "./services/aiService";
import { recTone } from "./services/researchService";
import { analyzeHolding, portfolioHealth, sectorExposure } from "./services/portfolioService";
import { analyzeJournal } from "./services/journalService";
import BuyButton from "./components/common/BuyButton";
import { PATTERNS, TF_N } from "./lib/patterns";
import { ALL, UNIVERSE, IN_STOCKS, US_STOCKS, CRYPTO, COMMODITY, FNO, marketOf, yahooSymbol, istParts, marketHoursLabel } from "./domain/universe";
import { makeFuture, lotSize, LOTS, currentExpiry } from "./domain/fno";
import { techSignal, dailyPicks } from "./domain/signals";
import Change from "./components/common/Change";
import AddBtn from "./components/common/AddBtn";
import Pop from "./components/common/Pop";
import Section from "./components/common/Section";
import VerdictTag from "./components/common/VerdictTag";
import Gauge from "./components/common/Gauge";
import StatGrid from "./components/common/StatGrid";
import BarBlock from "./components/common/BarBlock";
import ChartCard from "./components/common/ChartCard";
import TextCard from "./components/common/TextCard";
import CarouselCard from "./components/cards/CarouselCard";
import ListRow from "./components/cards/ListRow";
import Drawer from "./components/common/Drawer";
import Block from "./components/common/Block";
import Spark from "./components/common/Spark";
import CapTag from "./components/common/CapTag";
import MiniRow from "./components/common/MiniRow";
import DashStat from "./components/common/DashStat";
import FilterChip from "./components/common/FilterChip";
import MultiSelect from "./components/common/MultiSelect";
import WatchAddButton from "./components/common/WatchAddButton";
import ResearchVerdict from "./components/ai/ResearchVerdict";
import HomeView from "./pages/Dashboard";
import DetailPage from "./pages/StockDetail";
import Portfolio from "./pages/PortfolioPage";
import TradeHistory from "./pages/Orders";
import Automation from "./pages/Automation";
import Screener from "./pages/Screener";
import Ideas from "./pages/Ideas";
import WatchlistView from "./pages/Watchlist";
import ChatPanel from "./pages/AIAssistant";
import TradeView from "./pages/Trade";
import ProfileSheet, { LoginScreen, Onboarding, LoginModal } from "./components/auth/Auth";
import SearchOverlay from "./components/common/SearchOverlay";
import MiniCandles from "./components/charts/MiniCandles";
import ProChart from "./components/charts/ProChart";
import PatternChart from "./components/charts/PatternChart";
import { useCandles } from "./hooks/useCandles";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from "recharts";

/* ============================== THEME / CSS ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');
.theme-dark{
  --bg:#0B0B0D; --surface:#151517; --elev:#1D1D20; --ink:#F4F4F6; --ink-soft:#C2C2C8;
  --muted:#86868E; --line:#28282C; --primary:#E8E8EC; --primary-2:#9A9AA2;
  --primary-soft:rgba(232,232,236,.12); --up:#22C55E; --up-soft:rgba(34,197,94,.14);
  --down:#EF4444; --down-soft:rgba(239,68,68,.14); --gold:#C9C9D0; --gold-soft:rgba(200,200,208,.14);
  --lime:#C9FF3D; --grid:rgba(180,180,190,.10); --back:#08080A; --amber:#F59E0B;
  --shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 24px 56px -22px rgba(0,0,0,.85), 0 8px 20px rgba(0,0,0,.4);
  --glow:0 16px 40px rgba(0,0,0,.5);
  --gold-grad:linear-gradient(120deg,#8A8A92,#D8D8DE 45%,#F4F4F6 55%,#A8A8B0);
  --silver-grad:linear-gradient(135deg,#6E6E78 0%,#C9C9D4 30%,#F4F4F8 50%,#B7B7C2 72%,#6E6E78 100%);
  --card-grad:linear-gradient(160deg,#17171A,#111113);
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:radial-gradient(120% 60% at 50% -10%, #1A1A1D 0%, #0E0E10 50%, #08080A 100%);
  --header-bg:rgba(11,11,13,.72);
  --on-primary:#141416;
}
.theme-light{
  --bg:#F7F7F8; --surface:#FFFFFF; --elev:#FBFBFC; --ink:#141416; --ink-soft:#55555C;
  --muted:#9A9AA2; --line:#ECECEE; --primary:#1A1A1D; --primary-2:#8A8A92;
  --primary-soft:#F1F1F3; --up:#10B981; --up-soft:#E6F7F0;
  --down:#EF4444; --down-soft:#FDECEC; --gold:#6E6E78; --gold-soft:#F1F1F3;
  --lime:#C9FF3D; --grid:rgba(20,20,25,.06); --back:#F1F1F3; --amber:#F59E0B;
  --shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 18px 44px -22px rgba(20,20,30,.16), 0 6px 16px rgba(20,20,30,.05);
  --glow:0 14px 32px rgba(20,20,30,.12);
  --gold-grad:linear-gradient(120deg,#9A9AA2,#C9C9D0 45%,#6E6E78);
  --silver-grad:linear-gradient(135deg,#9A9AA6 0%,#CFCFDA 30%,#FFFFFF 50%,#BFBFCC 72%,#9A9AA6 100%);
  --card-grad:linear-gradient(170deg,#FFFFFF,#FBFBFC);
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:linear-gradient(180deg,#FAFAFB 0%,#F5F5F7 100%);
  --header-bg:rgba(247,247,248,.8);
  --on-primary:#FFFFFF;
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
.metal{position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.06), 0 22px 48px -20px rgba(0,0,0,.72)}
.metal::before{content:"";position:absolute;top:0;left:-30%;width:35%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.10) 50%,transparent);transform:skewX(-16deg);pointer-events:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .3s ease both}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet{animation:sheetUp .28s cubic-bezier(.22,1,.36,1) both}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shine{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(160,160,170,.55) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2.6s infinite}
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
// Seeded RNG. The first outputs of a raw Lehmer/LCG are strongly correlated with
// the seed (they skew high for typical seeds), so we warm it up before use —
// otherwise anything deciding an outcome on the first draw is badly biased.
// Guarded local storage (won't crash if storage is unavailable, e.g. in preview).


/* ============================== SMALL UI ============================== */


// Real headlines via the proxy (Yahoo / Moneycontrol / NewsAPI). Null in preview.
// Relative time from an ISO timestamp (real news carries real publish times).
// Map app timeframes → Yahoo range/interval (Yahoo lacks 3m/4h, so use nearest supported).

// REAL fundamentals + REAL institutional holders (Yahoo quoteSummary via backend).

// REAL indicators + volume, computed server-side from actual daily candles.

/* ================== REAL EXIT ENGINE (paper-trading) ==================
   Walks REAL intraday candles forward from the entry time and closes a position
   at whichever level is actually touched first — take-profit, stop-loss, or a
   trailing stop that ratchets up behind the highest price seen since entry.
   No random outcomes: exit price, exit time and P&L all come from market data.
   `risk` is read live from the holding, so edits in Portfolio take effect at once.
   Returns null when the position is still open (nothing touched yet).            */
// Trade history flat-file sync (no-ops gracefully without a backend).




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
function defOperands(defs) {
  const out = [];
  defs.forEach((d) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type) || { attrs: [] };
    if (cat.attrs.length) cat.attrs.forEach((a) => out.push(`${d.name}.${a}`));
    else out.push(d.name);
  });
  return out;
}

/* -------- Plain-English → executable rules parser --------
 * Turns sentences like "exit when RSI crosses above 85 or MACD histogram
 * becomes negative or MACD line crosses below MACD signal line" into structured,
 * backtestable conditions the engine understands. */
const MACD_DEF = { type: "MACD", len: "", name: "MACD" };
const BB_DEF = { type: "BB", len: "20", name: "BB" };
function mapToken(tok) {
  const t = tok.toLowerCase();
  if (/hist/.test(t)) return { operand: "MACD.hist", def: MACD_DEF };
  if (/signal/.test(t)) return { operand: "MACD.signal", def: MACD_DEF };
  if (/macd/.test(t)) return { operand: "MACD.line", def: MACD_DEF };
  let m;
  if ((m = t.match(/(\d+)\s*[- ]?\s*ema|ema\s*\(?\s*(\d+)?/))) { const len = m[1] || m[2] || "20"; return { operand: "EMA" + len, def: { type: "EMA", len, name: "EMA" + len } }; }
  if ((m = t.match(/(\d+)\s*[- ]?\s*sma|sma\s*\(?\s*(\d+)?/))) { const len = m[1] || m[2] || "50"; return { operand: "SMA" + len, def: { type: "SMA", len, name: "SMA" + len } }; }
  if (/upper/.test(t)) return { operand: "BB.upper", def: BB_DEF };
  if (/lower/.test(t)) return { operand: "BB.lower", def: BB_DEF };
  if (/middle|bollinger|\bbb\b/.test(t)) return { operand: "BB.middle", def: BB_DEF };
  if (/rsi/.test(t)) return { operand: "RSI", def: { type: "RSI", len: "14", name: "RSI" } };
  if (/adx/.test(t)) return { operand: "ADX", def: { type: "ADX", len: "14", name: "ADX" } };
  if (/cci/.test(t)) return { operand: "CCI", def: { type: "CCI", len: "20", name: "CCI" } };
  if (/vwap/.test(t)) return { operand: "VWAP", def: { type: "VWAP", len: "", name: "VWAP" } };
  if (/volume/.test(t)) return { operand: "Volume", def: { type: "Volume", len: "", name: "Volume" } };
  if (/price|close|ltp|spot/.test(t)) return { operand: "Price", def: null };
  return null;
}
const TOKEN_RE = /macd\s*hist\w*|macd\s*signal\w*|signal\s*line|macd\s*line|macd|\d+\s*[- ]?\s*ema|ema\s*\(?\s*\d*\s*\)?|\d+\s*[- ]?\s*sma|sma\s*\(?\s*\d*\s*\)?|upper\s*band|lower\s*band|middle\s*band|bollinger\s*\w*|\brsi\b|\badx\b|\bcci\b|\bvwap\b|\bvolume\b|\bprice\b|\bclose\b|\bltp\b/gi;
function detectOp(clause) {
  const c = clause.toLowerCase();
  if (/cross(es|ing)?\s*(above|over)/.test(c)) return { op: "crosses_above" };
  if (/cross(es|ing)?\s*(below|under)/.test(c)) return { op: "crosses_below" };
  if (/(become|becomes|turn|turns|goes|going)\s*(negative|below\s*zero)/.test(c)) return { op: "<", rhs: "0" };
  if (/(become|becomes|turn|turns|goes|going)\s*(positive|above\s*zero)/.test(c)) return { op: ">", rhs: "0" };
  if (c.includes(">=") || /greater\s*than\s*or\s*equal|at\s*least/.test(c)) return { op: ">=" };
  if (c.includes("<=") || /less\s*than\s*or\s*equal|at\s*most/.test(c)) return { op: "<=" };
  if (c.includes(">") || /greater\s*than|more\s*than|above|exceed|exceeds|rises?\s*above|goes?\s*above|breaks?\s*above/.test(c)) return { op: ">" };
  if (c.includes("<") || /less\s*than|below|under|drops?\s*below|falls?\s*below|dips?\s*below|breaks?\s*below/.test(c)) return { op: "<" };
  if (c.includes("==") || c.includes("=") || /equal|reaches|reach|hits|hit/.test(c)) return { op: "==" };
  return null;
}
function parseClause(clause) {
  const toks = [...clause.matchAll(TOKEN_RE)].map((mm) => ({ idx: mm.index, ...(mapToken(mm[0]) || {}) })).filter((t) => t.operand);
  const opi = detectOp(clause);
  if (!toks.length || !opi) return null;
  const left = toks[0];
  let b, bType, rdef = null;
  if (opi.rhs !== undefined) { b = opi.rhs; bType = "num"; }
  else if (toks[1]) { b = toks[1].operand; bType = "ind"; rdef = toks[1].def; }
  else { const nums = clause.match(/-?\d+(\.\d+)?/g); b = nums ? nums[nums.length - 1] : "0"; bType = "num"; }
  return { cond: { la: left.operand, op: opi.op, b, bType }, defs: [left.def, rdef].filter(Boolean) };
}
function condCode(c) { return `${c.la} ${c.op} ${c.b}`; }
function chainCode(conds) { return conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condCode(c)}`).join(""); }

const TEMPLATES = [
  { name: "Golden Cross + RSI", code: "EMA1 = EMA(length=50, tf=1D)\nEMA2 = EMA(length=200, tf=1D)\nif EMA1 > EMA2 AND RSI1 < 70:\n    enter_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "50", name: "EMA1" }, { type: "EMA", len: "200", name: "EMA2" }, { type: "RSI", len: "14", name: "RSI1" }], entry: [{ la: "EMA1", op: ">", bType: "ind", b: "EMA2" }, { la: "RSI1", op: "<", bType: "num", b: "70", gate: "AND" }], exit: [{ la: "EMA1", op: "crosses_below", bType: "ind", b: "EMA2" }], sl: "3", tp: "8" } },
  { name: "Bollinger squeeze", code: "if Price <= BB1.lower:\n    enter_trade()\nif Price >= BB1.upper:\n    exit_trade()", tag: "Volatility",
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }], entry: [{ la: "Price", op: "<=", bType: "ind", b: "BB1.lower" }], exit: [{ la: "Price", op: ">=", bType: "ind", b: "BB1.upper" }], sl: "4", tp: "6" } },
  { name: "MACD crossover", code: "if MACD1.line crosses_above MACD1.signal:\n    enter_trade()", tag: "Momentum",
    cfg: { mode: "builder", defs: [{ type: "MACD", len: "", name: "MACD1" }], entry: [{ la: "MACD1.line", op: "crosses_above", bType: "ind", b: "MACD1.signal" }], exit: [{ la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" }], sl: "3", tp: "8" } },
  { name: "CCI reversal", code: "if CCI1 < -100:\n    enter_trade()\nif CCI1 > 100:\n    exit_trade()", tag: "Reversal",
    cfg: { mode: "builder", defs: [{ type: "CCI", len: "20", name: "CCI1" }], entry: [{ la: "CCI1", op: "<", bType: "num", b: "-100" }], exit: [{ la: "CCI1", op: ">", bType: "num", b: "100" }], sl: "3", tp: "7" } },
  { name: "BB breakout + RSI", code: "BB1 = BollingerBand(length=20)\nRSI1 = RSI(length=14)\nif close crosses_above BB1.upper AND RSI1 > 60:\n    enter_trade()\nif close crosses_below BB1.middle:\n    exit_trade()", tag: "Breakout",
    cfg: { mode: "builder", defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }], entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "BB1.upper" }, { la: "RSI1", op: ">", bType: "num", b: "60", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "BB1.middle" }], sl: "3", tp: "9" } },
  { name: "Multi-timeframe trend (3/5/10/30m)", code: "# Same trend across 3m, 5m, 10m, 30m\nEMA_3 = EMA(20, tf=3m); EMA_5 = EMA(20, tf=5m)\nEMA_10 = EMA(20, tf=10m); EMA_30 = EMA(20, tf=30m)\nif close>EMA_3 AND close>EMA_5 AND close>EMA_10 AND close>EMA_30:\n    enter_trade()\nif close < EMA_5:\n    exit_trade()", tag: "MTF",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "20", tf: "3m", name: "EMA_3" }, { type: "EMA", len: "20", tf: "5m", name: "EMA_5" }, { type: "EMA", len: "20", tf: "10m", name: "EMA_10" }, { type: "EMA", len: "20", tf: "30m", name: "EMA_30" }], entry: [{ la: "Price", op: ">", bType: "ind", b: "EMA_3" }, { la: "Price", op: ">", bType: "ind", b: "EMA_5", gate: "AND" }, { la: "Price", op: ">", bType: "ind", b: "EMA_10", gate: "AND" }, { la: "Price", op: ">", bType: "ind", b: "EMA_30", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA_5" }], sl: "2", tp: "6" } },
  { name: "EMA 13 / SMA 83 crossover", code: "EMA13 = EMA(13); SMA83 = SMA(83); SMA39 = SMA(39)\nif EMA13 crosses_above SMA83:\n    enter_trade()\nif EMA13 crosses_below SMA39:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }, { type: "SMA", len: "39", name: "SMA39" }], entry: [{ la: "EMA13", op: "crosses_above", bType: "ind", b: "SMA83" }], exit: [{ la: "EMA13", op: "crosses_below", bType: "ind", b: "SMA39" }], sl: "3", tp: "8" } },
  { name: "EMA 9 / SMA 39 crossover", code: "EMA9 = EMA(9); SMA39 = SMA(39); EMA21 = EMA(21)\nif EMA9 crosses_above SMA39:\n    enter_trade()\nif EMA9 crosses_below EMA21:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "EMA", len: "9", name: "EMA9" }, { type: "SMA", len: "39", name: "SMA39" }, { type: "EMA", len: "21", name: "EMA21" }], entry: [{ la: "EMA9", op: "crosses_above", bType: "ind", b: "SMA39" }], exit: [{ la: "EMA9", op: "crosses_below", bType: "ind", b: "EMA21" }], sl: "3", tp: "8" } },
  { name: "ADX trend + Triple EMA + Volume", code: "if ADX1 > 25 AND EMA_f crosses_above EMA_s AND Volume > VMA:\n    enter_trade()\nif EMA_f crosses_below EMA_m:\n    exit_trade()", tag: "Trend",
    cfg: { mode: "builder", defs: [{ type: "ADX", len: "14", name: "ADX1" }, { type: "EMA", len: "8", name: "EMA_f" }, { type: "EMA", len: "21", name: "EMA_m" }, { type: "EMA", len: "55", name: "EMA_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }], entry: [{ la: "ADX1", op: ">", bType: "num", b: "25" }, { la: "EMA_f", op: "crosses_above", bType: "ind", b: "EMA_s", gate: "AND" }], exit: [{ la: "EMA_f", op: "crosses_below", bType: "ind", b: "EMA_m" }], sl: "3", tp: "9" } },
  { name: "Keltner + Heikin-Ashi + MACD", code: "if close crosses_above KC1.upper AND MACD1.line > MACD1.signal:\n    enter_trade()\nif close crosses_below KC1.middle:\n    exit_trade()", tag: "Momentum",
    cfg: { mode: "builder", defs: [{ type: "KC", len: "20", name: "KC1" }, { type: "MACD", len: "", name: "MACD1" }, { type: "CurrentCandle", name: "HA" }], entry: [{ la: "Price", op: "crosses_above", bType: "ind", b: "KC1.upper" }, { la: "MACD1.line", op: ">", bType: "ind", b: "MACD1.signal", gate: "AND" }], exit: [{ la: "Price", op: "crosses_below", bType: "ind", b: "KC1.middle" }], sl: "3", tp: "8" } },
  { name: "RSI + CCI + BB mean-reversion", code: "if RSI1<35 AND CCI1<-100 AND close<=BB1.lower:\n    enter_trade()\nif RSI1>60 OR close>=BB1.middle:\n    exit_trade()", tag: "Reversal",
    cfg: { mode: "builder", defs: [{ type: "RSI", len: "14", name: "RSI1" }, { type: "CCI", len: "20", name: "CCI1" }, { type: "BB", len: "20", name: "BB1" }], entry: [{ la: "RSI1", op: "<", bType: "num", b: "35" }, { la: "CCI1", op: "<", bType: "num", b: "-100", gate: "AND" }, { la: "Price", op: "<=", bType: "ind", b: "BB1.lower", gate: "AND" }], exit: [{ la: "RSI1", op: ">", bType: "num", b: "60" }, { la: "Price", op: ">=", bType: "ind", b: "BB1.middle", gate: "OR" }], sl: "4", tp: "7" } },
];

// Reusable multi-select (chips). Empty value array = "All".
function stratPerf(strat, rangeDays) {
  const r = lcg(hash(strat.name + strat.by + (strat.id || "")));
  const perYearTrades = 18 + Math.floor(r() * 46);
  const trades = Math.max(1, Math.round(perYearTrades * rangeDays / 365));
  const winRate = 46 + r() * 30;
  const wins = Math.round(trades * winRate / 100);
  const perYearRet = (r() * 0.95 - 0.18) * 42; // ≈ -7.5% .. +32% annualised
  const retPct = perYearRet * (rangeDays / 365);
  const cap = strat.cap || 100000;
  return { trades, wins, winRate, retPct, annual: perYearRet, pnl: cap * retPct / 100, cap };
}

function profileSummary(p) {
  if (!p) return null;
  const caps = p.caps && p.caps.length ? p.caps.join(" & ").toLowerCase() + " cap" : "all caps";
  const secs = p.sectors && p.sectors.length ? p.sectors.join(", ") : "all sectors";
  return `${p.risk || "Balanced"}-risk ${(p.proficiency || "Beginner").toLowerCase()} investor with a ${(p.style || "Technical").toLowerCase()}-analysis trading style, interested in ${caps} and ${secs}.`;
}
export default function App() {
  const [theme, setTheme] = useState("light");
  const [authed, setAuthed] = useState(() => !!lsGet("mx_auth", null));
  const [guest, setGuest] = useState(false);
  const [onboardSkipped, setOnboardSkipped] = useState(false);
  const [profile, setProfile] = useState(null);
  const [repersonalise, setRepersonalise] = useState(false);
  const [tab, setTab] = useState("home");
  const [market, setMarket] = useState("IN");
  const [segment, setSegment] = useState("Stocks");
  const [walletMap, setWalletMap] = useState({ IN: 1000000, US: 1000000, Crypto: 1000000, FNO: 1000000, Commodity: 1000000 });
  const wallet = walletMap[market] ?? 1000000;
  const adjustWallet = (mkt, delta) => setWalletMap((w) => ({ ...w, [mkt]: (w[mkt] ?? 1000000) + delta }));
  const [portfolio, setPortfolio] = useState([]);
  const [guestId] = useState(getUserId);
  const [auth, setAuth] = useState(() => lsGet("mx_auth", null));   // { phone, name } when logged in, else null
  const userId = auth ? "ph_" + auth.phone : guestId;
  const [loginOpen, setLoginOpen] = useState(false);
  const doLogout = () => { setAuth(null); lsSet("mx_auth", null); };
  const onAuthed = (a) => { setAuth(a); lsSet("mx_auth", a); setLoginOpen(false); };
  const [trades, setTrades] = useState([]);
  const [riskLimits, setRiskLimits] = useState(DEFAULT_LIMITS);   // Risk Engine config
  const [histOpen, setHistOpen] = useState(false);
  const [hydratedUser, setHydratedUser] = useState(null);
  const recordTrade = (t) => {
    const rec = { id: t.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tradeType: t.tradeType || "Manual", exitType: t.exitType || "Manual", ...t };
    if (!rec.tradeType) rec.tradeType = "Manual";
    if (!rec.exitType) rec.exitType = "Manual";
    setTrades((p) => { if (rec.id && p.some((x) => x.id === rec.id)) return p; return [rec, ...p].slice(0, 5000); });
    postTrade(userId, rec);
  };
  // Record simulated auto-buy / automate trades once per day (deduped by stable id).
  const recordBatch = (list) => { list.forEach((t) => recordTrade(t)); };
  // ---- REAL EXIT ENGINE ----
  // Every minute, check each OPEN position that has a target/stop against real
  // intraday candles. If a level was actually touched, close the position at that
  // real price/time, credit the wallet, and write the realised P&L to history.
  const resolving = useRef(false);
  useEffect(() => {
    if (!BACKEND_URL) return;                       // needs the live backend
    // Apply a closed trade locally: credit wallet, reduce the holding, notify.
    const applyClose = (t, closed) => {
      const qty = closed.qty || t.qty || 1;
      setTrades((p) => p.map((x) => (x.id === t.id ? closed : x)));
      adjustWallet(closed.market || "IN", closed.exit * qty);
      setPortfolio((p) => p.map((x) => x.sym === closed.sym ? { ...x, qty: x.qty - qty } : x).filter((x) => x.qty > 0));
      const pnl = closed.pnl || 0;
      setBuyToast({ t: `${closed.sym} auto-exited at ${fmt(closed.exit, closed.market || "IN")} (${closed.exitType}) · P&L ${pnl >= 0 ? "+" : ""}${fmt(pnl, closed.market || "IN")}`, e: pnl < 0 });
    };
    const tick = async () => {
      if (resolving.current) return;
      resolving.current = true;
      try {
        // 1) SYNC: the server-side monitor may have closed positions while the app
        //    was shut. Pull them in and settle the wallet/portfolio accordingly.
        const remote = await fetchTrades(userId, 0, Date.now());
        if (remote && remote.length) {
          const byId = new Map(remote.map((r) => [r.id, r]));
          trades.forEach((t) => {
            if (t.exitAt != null) return;                   // already closed locally
            const r = byId.get(t.id);
            if (r && r.exitAt != null) applyClose(t, r);    // server closed it
          });
        }
        // 2) FALLBACK: resolve anything still open in-app (e.g. monitor disabled).
        const open = trades.filter((t) => {
          if (t.exitAt != null) return false;
          const h = portfolio.find((x) => x.sym === t.sym);
          return !!(t.tp || t.sl || t.tsl || (h && (h.tp || h.sl || h.tsl)));
        });
        for (const t of open.slice(0, 6)) {
          const h = portfolio.find((x) => x.sym === t.sym);
          const risk = h ? { tp: h.tp ?? t.tp, sl: h.sl ?? t.sl, tsl: h.tsl ?? t.tsl } : {};
          const hit = await resolveExitFromCandles(t, risk);
          if (!hit) continue;
          const qty = Math.min(t.qty || 1, h ? h.qty : (t.qty || 1));
          if (qty < 1) continue;
          const closed = { ...t, ...hit, qty, pnl: +((hit.exit - t.entry) * qty).toFixed(2) };
          applyClose(t, closed);
          postTrade(userId, closed);
        }
      } catch (e) { /* transient network issues shouldn't break the loop */ }
      finally { resolving.current = false; }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [trades, portfolio, userId]);

  // Portfolio price snapshot — frozen until the user buys or sells (portfolio changes).
  const [priceSnap, setPriceSnap] = useState({});
  useEffect(() => {
    setPriceSnap((prev) => { const m = { ...prev }; portfolio.forEach((h) => { const s = ALL.find((a) => a.sym === h.sym); m[h.sym] = s ? s.price : (prev[h.sym] ?? h.buy); }); return m; });
  }, [portfolio]);
  const [watchlists, setWatchlists] = useState([{ id: "w1", name: "My Watchlist", syms: ["ETERNAL", "TATAPOWER"] }]);
  const [activeWl, setActiveWl] = useState("w1");
  // Load this user's saved data whenever the user changes (login / logout).
  useEffect(() => {
    const st = lsGet("mx_state_" + userId, null);
    setPortfolio((st && st.portfolio) || []);
    setWalletMap((st && st.walletMap) || { IN: 1000000, US: 1000000, Crypto: 1000000, FNO: 1000000, Commodity: 1000000 });
    const wl = (st && st.watchlists) || [{ id: "w1", name: "My Watchlist", syms: ["ETERNAL", "TATAPOWER"] }];
    setWatchlists(wl); setActiveWl(wl[wl.length - 1] ? wl[wl.length - 1].id : "w1");
    setProfile((st && st.profile) || null);
    setOnboardSkipped(!!(st && st.onboardSkipped));
    setTrades(lsGet("mx_trades_" + userId, []));
    setHydratedUser(userId);
    if (BACKEND_URL) fetchTrades(userId, 0, Date.now()).then((t) => { if (t && t.length) setTrades(t); }).catch(() => {});
  }, [userId]);
  // Persist per-user (only after this user's data has been hydrated, to avoid clobbering).
  useEffect(() => { if (hydratedUser === userId) lsSet("mx_state_" + userId, { portfolio, walletMap, watchlists, profile, onboardSkipped }); }, [portfolio, walletMap, watchlists, profile, onboardSkipped, hydratedUser, userId]);
  useEffect(() => { if (hydratedUser === userId) lsSet("mx_trades_" + userId, trades); }, [trades, hydratedUser, userId]);
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tradePreset, setTradePreset] = useState(null);
  const [buyToast, setBuyToast] = useState(null);
  useEffect(() => { if (!buyToast) return; const t = setTimeout(() => setBuyToast(null), 3200); return () => clearTimeout(t); }, [buyToast]);
  const [live, setLive] = useState(false);
  const [liveAt, setLiveAt] = useState(null);
  const [, setLiveTick] = useState(0);

  // Refresh prices / indicators / news every 1 minute (only the selected market's symbols).
  const REFRESH_MS = 60000;   // 1 minute
  useEffect(() => {
    let stop = false;
    const syms = (UNIVERSE[market] || []).map((a) => a.sym);
    const pullLive = async () => {
      try {
        const rows = await fetchLiveQuotes(syms);
        if (stop || !rows || !rows.length) { setLive(false); return; }
        let n = 0;
        rows.forEach((r) => { const s = ALL.find((a) => a.sym === r.sym); if (s) { s.price = r.price; s.chg = r.chg; n++; } });
        if (n) { setLive(true); setLiveAt(Date.now()); setLiveTick((t) => t + 1); } else setLive(false);
      } catch { setLive(false); }
    };
    // REAL indicators + REAL volume, computed by the backend from actual candles.
    const pullIndicators = async () => {
      try {
        const ind = await fetchIndicators(syms);
        if (stop || !ind) return;
        let n = 0;
        Object.keys(ind).forEach((ySym) => {
          const s = ALL.find((a) => yahooSymbol(a.sym) === ySym || a.sym === ySym);
          if (!s) return;
          Object.assign(s, ind[ySym], { hasData: true });
          n++;
        });
        if (n) setLiveTick((t) => t + 1);
      } catch { /* leave indicators null -> UI shows "—" */ }
    };
    const pullFundamentals = async () => {
      try {
        const f = await fetchFundamentals(syms);
        if (stop || !f) return;
        Object.keys(f).forEach((ySym) => {
          const s = ALL.find((a) => yahooSymbol(a.sym) === ySym || a.sym === ySym);
          if (s) Object.assign(s, f[ySym]);        // pe, roe, revGrowth, marketCap, inst (real holders)
        });
        setLiveTick((t) => t + 1);
      } catch { /* leave null -> UI shows "—" */ }
    };
    const refresh = () => { if (BACKEND_URL) { pullLive(); pullIndicators(); pullFundamentals(); } };   // no synthetic fallback: no data = no numbers
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => { stop = true; clearInterval(id); };
  }, [market]);

  const watch = useMemo(() => [...new Set(watchlists.flatMap((w) => w.syms))], [watchlists]);
  const toggleWatch = (sym) => setWatchlists((p) => p.map((w) => w.id === activeWl ? { ...w, syms: w.syms.includes(sym) ? w.syms.filter((x) => x !== sym) : [...w.syms, sym] } : w));
  const addToWatch = (sym, listId) => setWatchlists((p) => p.map((w) => w.id === (listId || activeWl) ? (w.syms.includes(sym) ? w : { ...w, syms: [...w.syms, sym] }) : w));
  const createWatchlist = (name) => { const id = "w" + Date.now(); setWatchlists((p) => [...p, { id, name: name && name.trim() ? name.trim() : "List " + (p.length + 1), syms: [] }]); setActiveWl(id); return id; };
  const deleteWatchlist = (id) => setWatchlists((p) => { const n = p.filter((w) => w.id !== id); if (!n.length) { setActiveWl("w1"); return [{ id: "w1", name: "My Watchlist", syms: [] }]; } if (id === activeWl) setActiveWl(n[0].id); return n; });
  const openStock = (s) => { setSearch(false); setDrawer(s); };
  const openDetail = (s) => { setDrawer(null); setDetail(s); };
  const goTrade = (s) => { setDetail(null); setTradePreset(s); setTab("trade"); };
  const buyStock = (s, qty = 1, opts = {}) => {
    const mkt = marketOf(s.sym);
    const cost = s.price * qty;
    // ---- RISK ENGINE ---------------------------------------------------------
    // Per the architecture, NO order reaches the portfolio without passing here.
    // Strategies, auto-buy and manual buys all funnel through this one gate.
    const verdict = validateOrder(
      { sym: s.sym, side: "BUY", qty, price: s.price, market: mkt },
      { wallet: walletMap[mkt] ?? 0, portfolio: portfolio.filter((h) => marketOf(h.sym) === mkt), trades, limits: riskLimits }
    );
    if (!verdict.ok) { setBuyToast({ t: verdict.reasons[0], e: true }); return false; }
    if (verdict.warnings.length) setBuyToast({ t: verdict.warnings[0], e: false });
    adjustWallet(mkt, -cost);
    setPortfolio((p) => {
      const ex = p.find((h) => h.sym === s.sym);
      if (ex) { const tq = ex.qty + qty; return p.map((h) => h.sym === s.sym ? { ...h, qty: tq, buy: (h.buy * h.qty + cost) / tq, ...opts } : h); }
      return [...p, { sym: s.sym, name: s.name, qty, buy: s.price, date: Date.now(), ...opts }];
    });
    setBuyToast({ t: `Bought ${qty} ${s.sym} @ ${fmt(s.price, mkt)} — added to portfolio.`, e: false });
    recordTrade({ sym: s.sym, name: s.name, entry: s.price, entryAt: Date.now(), exit: null, exitAt: null, pnl: null, qty, market: mkt, tradeType: opts.tradeType || "Manual", exitType: "Open", tp: opts.tp, sl: opts.sl });
    return true;
  };
  const sellStock = (s, qty = 1) => {
    const mkt = marketOf(s.sym);
    const sv = validateOrder(
      { sym: s.sym, side: "SELL", qty, price: s.price, market: mkt },
      { wallet: walletMap[mkt] ?? 0, portfolio, trades, limits: riskLimits }
    );
    if (!sv.ok) { setBuyToast({ t: sv.reasons[0], e: true }); return false; }
    const held = portfolio.find((h) => h.sym === s.sym);
    if (!held || held.qty < 1) { setBuyToast({ t: `You don't hold ${s.sym}.`, e: true }); return false; }
    const sellQty = Math.min(qty, held.qty);
    const proceeds = s.price * sellQty;
    adjustWallet(mkt, +proceeds);
    recordTrade({ sym: s.sym, name: s.name || held.name, entry: held.buy, entryAt: held.date, exit: s.price, exitAt: Date.now(), pnl: +((s.price - held.buy) * sellQty).toFixed(2), qty: sellQty, market: mkt, tradeType: "Manual", exitType: "Manual" });
    setPortfolio((p) => p.map((h) => h.sym === s.sym ? { ...h, qty: h.qty - sellQty } : h).filter((h) => h.qty > 0));
    setBuyToast({ t: `Sold ${sellQty} ${s.sym} @ ${fmt(s.price, mkt)} — credited to wallet.`, e: false });
    return true;
  };
  const updateHolding = (sym, patch) => {
    setPortfolio((p) => p.map((h) => h.sym === sym ? { ...h, ...patch } : h));
    // Push the new risk orders onto the OPEN trade too, and sync to the backend so
    // the server-side monitor can honour them even while the app is closed.
    setTrades((p) => p.map((t) => {
      if (t.sym !== sym || t.exitAt != null) return t;
      const upd = { ...t, tp: patch.tp, sl: patch.sl, tsl: patch.tsl };
      postTrade(userId, upd);
      return upd;
    }));
  };

  // personalised ordering for picks
  const list = useMemo(() => {
    let arr = [...UNIVERSE[market]];
    if (profile) {
      arr.sort((a, b) => {
        const score = (s) => (profile.caps.length && profile.caps.includes(s.cap) ? 3 : 0) + (profile.sectors.includes(s.sector) ? 3 : 0) + (profile.risk === "Aggressive" ? s.chg : profile.risk === "Conservative" ? -Math.abs(s.chg) + (s.cap === "Large" ? 2 : 0) : (s.rsi != null ? (s.rsi - 50) / 10 : 0));
        return score(b) - score(a);
      });
    }
    return arr;
  }, [market, profile]);

  const nav = [["home", Home, "Home"], ["ideas", Lightbulb, "Ideas"], ["ask", Bot, "Ask"], ["automation", Bolt, "Auto"], ["portfolio", Briefcase, "Portfolio"], ["watchlist", Star, "Watch"]];

  return (
    <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* fixed gradient backdrop so it stays behind scroll */}
      <div style={{ position: "fixed", inset: 0, background: "var(--app-bg, var(--bg))", zIndex: 0, pointerEvents: "none" }} />
      {!authed && <LoginScreen onGuest={() => { setGuest(true); setAuthed(true); }} onAuthed={(a) => { onAuthed(a); setGuest(false); setAuthed(true); }} />}
      {authed && hydratedUser === userId && (repersonalise || (!profile && !onboardSkipped)) && (
        <Onboarding
          initial={repersonalise ? profile : null}
          onDone={(p) => { setProfile(p); setRepersonalise(false); setOnboardSkipped(true); }}
          onSkip={() => { setOnboardSkipped(true); setRepersonalise(false); }}
        />
      )}

      <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 86 }}>
        {/* ambient glow */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 420, height: 320, background: "radial-gradient(circle, rgba(150,150,160,.12), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        {/* HEADER */}
        <div className="glass" style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--header-bg)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px", gap: 8 }}>
            <div onClick={() => { setTab("home"); setDetail(null); }} className="tap disp" style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span style={{ color: "var(--primary)", fontSize: 19 }}>✦</span>
              <span className="gradtext" style={{ fontWeight: 700, fontSize: 20 }}>Matrix</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 3 }}>
                <span className="pill" title={`${market} market ${marketOpen(market) ? "open" : "closed"} · ${marketHoursLabel(market)}. Prices refresh every minute.${live ? " Live Yahoo feed." : " Simulated feed — connect the proxy for real data."}`} style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".04em", padding: "2px 6px", display: "flex", alignItems: "center", gap: 3, background: marketOpen(market) ? "var(--up-soft)" : "var(--primary-soft)", color: marketOpen(market) ? "var(--up)" : "var(--muted)" }}>
                  <span style={{ width: 4, height: 4, borderRadius: 4, background: marketOpen(market) ? "var(--up)" : "var(--muted)" }} />{live ? "LIVE" : BACKEND_URL ? (marketOpen(market) ? "NO DATA" : "CLOSED") : "NO DATA"}
                </span>
                {liveAt && <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 700 }}>{new Date(liveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="tap pill" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--elev)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={15} />}
              </button>
              <div onClick={() => setShowProfile(true)} className="tap pill gold-border" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <Wallet size={15} color="var(--gold)" />
              </div>
              <div onClick={() => setShowProfile(true)} className="tap glow" style={{ width: 34, height: 34, borderRadius: 11, background: "var(--feature-grad)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><User size={17} /></div>
            </div>
          </div>
          <div style={{ padding: "0 18px 14px" }}>
            <div onClick={() => setSearch(true)} className="tap" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", color: "var(--muted)", fontSize: 13.5 }}>
              <Search size={17} /> Search any stock, crypto or commodity…
            </div>
          </div>
          {!detail && ["home", "ideas", "automation", "portfolio"].includes(tab) && (
            <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 12px" }}>
              {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]].map(([k, l]) => (
                <button key={k} onClick={() => setMarket(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (market === k ? "var(--primary)" : "var(--line)"), background: market === k ? "var(--primary)" : "var(--surface)", color: market === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: "0 18px", position: "relative", zIndex: 1 }}>
          {detail ? (
            <DetailPage s={detail} onBack={() => setDetail(null)} watched={watch.includes(detail.sym)} toggleWatch={toggleWatch} onTrade={goTrade} onBuy={buyStock} />
          ) : (
            <>
              {tab === "home" && <HomeView market={market} setMarket={setMarket} segment={segment} setSegment={setSegment} list={list} onOpen={openStock} onBuy={buyStock} watch={watch} toggleWatch={toggleWatch} profile={profile} portfolio={portfolio} wallet={wallet} onGoPortfolio={() => { setDetail(null); setTab("portfolio"); }} onRecord={recordTrade} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} trades={trades} />}
              {tab === "trade" && <TradeView walletMap={walletMap} adjustWallet={adjustWallet} portfolio={portfolio} setPortfolio={setPortfolio} preset={tradePreset} market={market} recordTrade={recordTrade} />}
              {tab === "ideas" && <Ideas onOpen={openStock} onBuy={buyStock} market={market} />}
              {tab === "automation" && <Automation market={market} onRecord={recordTrade} onBuyReal={buyStock} />}
              {tab === "portfolio" && <Portfolio portfolio={portfolio} wallet={wallet} market={market} onGoHome={() => { setDetail(null); setTab("home"); }} onBuy={buyStock} onSell={sellStock} onUpdate={updateHolding} priceSnap={priceSnap} />}
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

      {drawer && <Drawer s={drawer} onClose={() => setDrawer(null)} onDetails={openDetail} onBuy={buyStock} />}
      {search && <SearchOverlay onClose={() => setSearch(false)} onOpen={openStock} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} />}
      {showProfile && <ProfileSheet profile={profile} walletMap={walletMap} onClose={() => setShowProfile(false)} onTradeHistory={() => setHistOpen(true)} auth={auth} onLogin={() => setLoginOpen(true)} onLogout={doLogout} onPersonalise={() => setRepersonalise(true)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onAuthed={onAuthed} />}
      {histOpen && <TradeHistory userId={userId} trades={trades} onClose={() => setHistOpen(false)} />}
      {buyToast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", zIndex: 90, pointerEvents: "none" }}>
          <div className="card glow" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", maxWidth: 380, border: "1px solid " + (buyToast.e ? "var(--down)" : "var(--up)") }}>
            {buyToast.e ? <X size={16} color="var(--down)" /> : <Check size={16} color="var(--up)" />}
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{buyToast.t}</span>
          </div>
        </div>
      )}
    </div>
  );
}
