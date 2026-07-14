import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, CF } from "../lib/series";
/**
 * domain/strategyLang.js — the strategy rule language.
 *
 * Parses plain-English and visual-builder conditions into evaluable operands,
 * and evaluates them against REAL candles. Pure: no UI, no I/O.
 *
 * Used by domain/backtest.js (to run a strategy) and by the Automation page
 * (to show the generated pseudo-code and the operand pickers).
 */
function rollExt(c, len, field, max) { const o = Array(c.length).fill(NaN); for (let i = 0; i < c.length; i++) { let v = c[i][field]; for (let j = Math.max(0, i - len + 1); j <= i; j++) v = max ? Math.max(v, c[j][field]) : Math.min(v, c[j][field]); o[i] = v; } return o; }
export function resolveOperand(op, defs, c, closes, vols, cache) {
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
export function evalCond(cond, i, get) {
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
export function chainEval(conds, i, get) { if (!conds || !conds.length) return false; let r = evalCond(conds[0], i, get); for (let k = 1; k < conds.length; k++) { const e = evalCond(conds[k], i, get); r = (conds[k].gate || "AND") === "OR" ? (r || e) : (r && e); } return r; }
/**
 * The indicator catalogue the strategy builder offers.
 *
 * This lived in pages/Automation.jsx while domain/strategyLang.js referenced it —
 * i.e. a domain module depended on a UI page, which is backwards, and it crashed
 * the app at runtime (ReferenceError: IND_CATALOG is not defined). It belongs
 * here, with the language that consumes it; the page imports it from here.
 */
export const IND_CATALOG = [
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

export function defOperands(defs) {
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
export const MACD_DEF = { type: "MACD", len: "", name: "MACD" };
export const BB_DEF = { type: "BB", len: "20", name: "BB" };
export function mapToken(tok) {
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
export const TOKEN_RE = /macd\s*hist\w*|macd\s*signal\w*|signal\s*line|macd\s*line|macd|\d+\s*[- ]?\s*ema|ema\s*\(?\s*\d*\s*\)?|\d+\s*[- ]?\s*sma|sma\s*\(?\s*\d*\s*\)?|upper\s*band|lower\s*band|middle\s*band|bollinger\s*\w*|\brsi\b|\badx\b|\bcci\b|\bvwap\b|\bvolume\b|\bprice\b|\bclose\b|\bltp\b/gi;
export function detectOp(clause) {
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
export function parseClause(clause) {
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
export function condCode(c) { return `${c.la} ${c.op} ${c.b}`; }
export function chainCode(conds) { return conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condCode(c)}`).join(""); }

export const TEMPLATES = [
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
