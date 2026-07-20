import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, STarr, DMIarr, STOCHarr, CF } from "../lib/series";
import { pivots, detectPatterns, PATTERN_KEYS } from "./patterns";

/* Support / resistance as evaluable series: at each bar, the price of the most recent CONFIRMED
   swing low (support) / swing high (resistance) at or before that bar. Falls back to a rolling
   extreme early on, before any pivot exists, so the operand is never NaN for the whole window. */
function srSeries(c, kind) {
  const pv = pivots(c, 3);
  const wantT = kind === "support" ? "L" : "H";
  const out = new Array(c.length).fill(NaN);
  let last = NaN, pi = 0;
  for (let i = 0; i < c.length; i++) {
    while (pi < pv.length && pv[pi].i <= i) { if (pv[pi].t === wantT) last = pv[pi].p; pi++; }
    if (!isNaN(last)) { out[i] = last; continue; }
    // No pivot yet — use the running extreme of the window seen so far.
    let ext = kind === "support" ? Infinity : -Infinity;
    for (let j = 0; j <= i; j++) ext = kind === "support" ? Math.min(ext, c[j].l) : Math.max(ext, c[j].h);
    out[i] = ext;
  }
  return out;
}

/* Chart-pattern condition series: 1 on bars where a pattern of `key` is present (from its
   confirmation bar, held for a short window so the entry rule has time to fire), else 0. */
function patternSeries(c, key, within = 3) {
  const s = new Array(c.length).fill(0);
  const pats = detectPatterns(c).filter((p) => p.key === key);
  for (const p of pats) for (let j = p.at; j <= Math.min(c.length - 1, p.at + within); j++) s[j] = 1;
  return s;
}
/* Map a plain-English pattern phrase to its canonical key, or null. Longest phrase wins so
   "inverse head and shoulders" beats "head and shoulders". */
export function patternKeyFromText(text) {
  const t = String(text || "").toLowerCase();
  const phrases = Object.keys(PATTERN_KEYS).sort((a, b) => b.length - a.length);
  for (const ph of phrases) if (t.includes(ph)) return PATTERN_KEYS[ph];
  return null;
}
export const PATTERN_OPERAND_PREFIX = "PAT:";
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
  else if (op === "Support") series = srSeries(c, "support");
  else if (op === "Resistance") series = srSeries(c, "resistance");
  else if (op.startsWith(PATTERN_OPERAND_PREFIX)) series = patternSeries(c, op.slice(PATTERN_OPERAND_PREFIX.length));
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
        case "DMI": { const dm = DMIarr(c, len); series = attr === "minus" ? dm.minus : attr === "adx" ? dm.adx : dm.plus; break; }
        case "Stoch": { const st = STOCHarr(c, len, Number(d.smoothK) || 3, Number(d.smoothD) || 3); series = attr === "d" ? st.d : st.k; break; }
        case "Supertrend": { const st = STarr(c, len, Number(d.mult) || 3); series = attr === "dir" ? st.dir : st.line; break; }
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

    /* "Crossed above at some point in the last N bars" — the cross stays TRUE for a
       short window instead of for exactly one candle. Requiring two separate crosses to
       land on the same bar is nearly a coincidence; this lets you say "the band broke
       out AND momentum crossed up within the last 3 candles", which is what the rule
       actually means. Default 3 bars. */
    case "crossed_above_within": {
      const n = Math.max(1, Number(cond.n) || 3);
      for (let k = 0; k < n; k++) {
        const a = L[i - k], b = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k] : NaN);
        const pa = L[i - k - 1], pb = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k - 1] : NaN);
        if (!isNaN(a) && !isNaN(b) && !isNaN(pa) && !isNaN(pb) && pa <= pb && a > b) return true;
      }
      return false;
    }
    case "crossed_below_within": {
      const n = Math.max(1, Number(cond.n) || 3);
      for (let k = 0; k < n; k++) {
        const a = L[i - k], b = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k] : NaN);
        const pa = L[i - k - 1], pb = cond.bType === "num" ? Number(cond.b) : (R ? R[i - k - 1] : NaN);
        if (!isNaN(a) && !isNaN(b) && !isNaN(pa) && !isNaN(pb) && pa >= pb && a < b) return true;
      }
      return false;
    }
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
  { type: "DMI", label: "DMI (+DI / -DI / ADX)", needsLen: true, attrs: ["plus", "minus", "adx"] },
  { type: "Stoch", label: "Stochastic (%K / %D)", needsLen: true, attrs: ["k", "d"] },
  { type: "Supertrend", label: "Supertrend", needsLen: true, attrs: ["line", "dir"] },
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
export const CC_DEF = { type: "CurrentCandle", len: "", name: "CC" };   // this candle's O/H/L/C
export function mapToken(tok) {
  const t = tok.toLowerCase();
  if (/hist/.test(t)) return { operand: "MACD.hist", def: MACD_DEF };
  if (/signal/.test(t)) return { operand: "MACD.signal", def: MACD_DEF };
  if (/macd/.test(t)) return { operand: "MACD.line", def: MACD_DEF };
  // Candle O/H/L/C — must be checked BEFORE the generic price/close catch, and each maps to
  // the real candle field so "close > open" means a green candle (not the old bug where
  // "open" was dropped and it collapsed to "price > 0").
  if (/\bopen\b/.test(t)) return { operand: "CC.open", def: CC_DEF };
  if (/\bhigh\b/.test(t)) return { operand: "CC.high", def: CC_DEF };
  if (/\blow\b/.test(t)) return { operand: "CC.low", def: CC_DEF };
  if (/\bclose\b/.test(t)) return { operand: "CC.close", def: CC_DEF };
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
  if (/resistance/.test(t)) return { operand: "Resistance", def: null };
  if (/support/.test(t)) return { operand: "Support", def: null };
  if (/price|ltp|spot/.test(t)) return { operand: "Price", def: null };
  return null;
}
export const TOKEN_RE = /macd\s*hist\w*|macd\s*signal\w*|signal\s*line|macd\s*line|macd|\d+\s*[- ]?\s*ema|ema\s*\(?\s*\d*\s*\)?|\d+\s*[- ]?\s*sma|sma\s*\(?\s*\d*\s*\)?|upper\s*band|lower\s*band|middle\s*band|bollinger\s*\w*|\brsi\b|\badx\b|\bcci\b|\bvwap\b|\bvolume\b|\bresistance\b|\bsupport\b|\bprice\b|\bclose\b|\bopen\b|\bhigh\b|\blow\b|\bltp\b/gi;
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
/* ── THE INTERPRETER (Neo) ──────────────────────────────────────────────────────────────
   One place that turns a plain-English line into executable conditions. Handles, in order:
     1. Named chart patterns ("cup and handle", "double bottom", …) -> a pattern condition
        the engine checks with the real detector. Stripped BEFORE the and/or split so the
        "and" inside "cup AND handle" doesn't get treated as a logical connective.
     2. support / resistance, VWAP, candle O/H/L/C, indicators, numbers -> operand conditions.
   Used by the strategy builder (Automate) AND the screener, so both read the same language. */
/* Compound trading phrases that don't fit the "operand op operand" grammar — mapped whole to
   the conditions (and indicators) a trader means by them. Extends what Neo understands beyond
   raw indicator names to the vocabulary people actually use. */
const PHRASE_RULES = [
  { re: /golden\s*cross/i, cond: { la: "EMA50", op: "crosses_above", b: "EMA200", bType: "ind" }, defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }] },
  { re: /death\s*cross/i, cond: { la: "EMA50", op: "crosses_below", b: "EMA200", bType: "ind" }, defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }] },
  { re: /oversold/i, cond: { la: "RSI", op: "<", b: "30", bType: "num" }, defs: [{ type: "RSI", len: "14", name: "RSI" }] },
  { re: /overbought/i, cond: { la: "RSI", op: ">", b: "70", bType: "num" }, defs: [{ type: "RSI", len: "14", name: "RSI" }] },
  { re: /macd\s*(turns?|crosses?|goes?)?\s*(bullish|positive)/i, cond: { la: "MACD.line", op: "crosses_above", b: "MACD.signal", bType: "ind" }, defs: [{ type: "MACD", len: "", name: "MACD" }] },
  { re: /macd\s*(turns?|crosses?|goes?)?\s*(bearish|negative)/i, cond: { la: "MACD.line", op: "crosses_below", b: "MACD.signal", bType: "ind" }, defs: [{ type: "MACD", len: "", name: "MACD" }] },
  { re: /(?:bounce|bounces|bouncing|bounced|rebound|rebounds|rebounding|reversal|reverses|holds?|holding|respect(?:s|ing)?|defend(?:s|ing)?|support)\s*(?:from|off|at|of|near|the)?\s*support|near\s*support|at\s*support|off\s*support/i, cond: { la: "Price", op: ">", b: "Support", bType: "ind" }, defs: [] },
  { re: /(?:reject|rejected|rejects|rejecting|fail|fails|failing|failed|reverses?|resistance)\s*(?:at|from|off|near|the)?\s*resistance|near\s*resistance|at\s*resistance|hits?\s*resistance/i, cond: { la: "Price", op: "<", b: "Resistance", bType: "ind" }, defs: [] },
  { re: /break(?:s|ing|out)?\s*(?:above|over|through|past)?\s*resistance|breakout/i, cond: { la: "Price", op: "crosses_above", b: "Resistance", bType: "ind" }, defs: [] },
  { re: /break(?:s|ing|down)?\s*(?:below|under|through)?\s*support|breakdown/i, cond: { la: "Price", op: "crosses_below", b: "Support", bType: "ind" }, defs: [] },
];

export function interpretText(text) {
  const conds = [], defs = [], unparsed = [];
  if (!text || !text.trim()) return { conds, defs, unparsed };
  let work = String(text);
  const pushDefs = (ds) => (ds || []).forEach((d) => { if (d && !defs.find((x) => x.name === d.name)) defs.push(d); });

  // 0. Compound phrases (golden cross, oversold, MACD turns bullish, bounce off support…).
  for (const pr of PHRASE_RULES) {
    if (pr.re.test(work)) {
      const c = { ...pr.cond, gate: conds.length ? "AND" : undefined };
      if (!conds.find((x) => x.la === c.la && x.b === c.b && x.op === c.op)) { conds.push(c); pushDefs(pr.defs); }
      work = work.replace(pr.re, " ");
    }
  }

  // 1. Chart-pattern phrases anywhere in the line.
  const phrases = Object.keys(PATTERN_KEYS).sort((a, b) => b.length - a.length);
  for (const ph of phrases) {
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    if (re.test(work)) {
      const key = PATTERN_KEYS[ph];
      const la = PATTERN_OPERAND_PREFIX + key;
      if (!conds.find((cd) => cd.la === la)) {
        conds.push({ la, op: ">", b: "0", bType: "num", gate: conds.length ? "AND" : undefined });
      }
      work = work.replace(re, " ");   // remove so the and/or splitter ignores it
    }
  }

  // 2. The remaining text: operand op operand/number, chained with AND / OR.
  const cleaned = work.replace(/^\s*(buy|sell|enter|exit|go long|short|when|if)\b[:,]?\s*/i, "").trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+(and|or)\s+/i);
    for (let i = 0; i < parts.length; i += 2) {
      const clause = parts[i];
      if (!clause || !clause.trim()) continue;
      const gate = (i > 0 && parts[i - 1] && parts[i - 1].toLowerCase() === "or") ? "OR" : (conds.length || i > 0) ? "AND" : undefined;
      const p = parseClause(clause);
      if (p) { if (gate) p.cond.gate = gate; conds.push(p.cond); p.defs.forEach((d) => { if (d && !defs.find((x) => x.name === d.name)) defs.push(d); }); }
      else unparsed.push(clause.trim());
    }
  }
  // Drop clauses that are only filler left over after a phrase/pattern was consumed ("when price",
  // "on", "then") — they aren't real unparsed conditions and shouldn't raise a warning.
  const FILLER = /^(?:when|then|if|on|at|in|a|an|the|is|are|was|be|it|its|and|or|buy|sell|enter|exit|go|long|short|price|of|to|from|for|with|that|this|now)$/i;
  const cleanUnparsed = unparsed.filter((u) => u.split(/\s+/).some((w) => w && !FILLER.test(w)));
  return { conds, defs, unparsed: cleanUnparsed };
}

/* Human phrase for a single operand, so a condition preview reads like English. */
export function operandLabel(op) {
  if (typeof op === "string" && op.startsWith(PATTERN_OPERAND_PREFIX)) {
    const key = op.slice(PATTERN_OPERAND_PREFIX.length);
    const ph = Object.keys(PATTERN_KEYS).find((k) => PATTERN_KEYS[k] === key);
    return ph ? ph.replace(/\b\w/g, (m) => m.toUpperCase()) : key;
  }
  if (op === "Support") return "support"; if (op === "Resistance") return "resistance";
  if (op === "Price") return "price"; if (op === "Volume") return "volume";
  return op;
}
/* Render a condition as a sentence — pattern conditions read as "a Cup & Handle forms". */
export function humanizeCond(c) {
  if (typeof c.la === "string" && c.la.startsWith(PATTERN_OPERAND_PREFIX)) {
    return `a ${operandLabel(c.la)} forms`;
  }
  const opw = { ">": "is above", "<": "is below", ">=": "is at/above", "<=": "is at/below", "==": "equals", crosses_above: "crosses above", crosses_below: "crosses below" }[c.op] || c.op;
  const right = c.bType === "num" ? c.b : operandLabel(c.b);
  return `${operandLabel(c.la)} ${opw} ${right}`;
}

/* Plain-English "how Neo detects this pattern" notes, keyed by canonical pattern key.
   Shown under "Neo reads" so the user sees the actual geometric rule behind a pattern. */
export const PATTERN_EXPLAIN = {
  "double-bottom": "Two swing lows at roughly the same price (within ~2%), separated by a higher peak. Neo confirms it when price closes back above that middle peak — the breakout that completes the W.",
  "double-top": "Two swing highs at about the same price with a valley between. Neo confirms it when price closes below that middle valley — the breakdown that completes the M.",
  "cup-handle": "A rounded U-shaped base (the cup) followed by a small downward drift (the handle). Neo triggers when price breaks above the handle's high.",
  "head-shoulders": "Three peaks — a higher middle 'head' between two lower 'shoulders'. Neo confirms on a close below the neckline joining the two intervening lows.",
  "inv-head-shoulders": "Three troughs — a lower middle 'head' between two higher 'shoulders'. Neo confirms on a close above the neckline joining the two intervening highs.",
  "asc-triangle": "A flat resistance line with rising lows beneath it. Neo triggers on a close above the flat top.",
  "desc-triangle": "A flat support line with falling highs above it. Neo triggers on a close below the flat bottom.",
  "sym-triangle": "Lower highs and higher lows converging to a point. Neo triggers on a close beyond whichever trendline breaks first.",
  "bull-flag": "A sharp rally, then a slight downward-sloping consolidation. Neo triggers on a breakout above the flag's upper edge.",
  "bear-flag": "A sharp drop, then a slight upward-sloping consolidation. Neo triggers on a breakdown below the flag's lower edge.",
  "rising-wedge": "Higher highs and higher lows converging upward — usually bearish. Neo triggers on a close below the lower line.",
  "falling-wedge": "Lower highs and lower lows converging downward — usually bullish. Neo triggers on a close above the upper line.",
  "rectangle": "Price oscillating between a flat support and flat resistance. Neo triggers on a close beyond either edge.",
};
/* Which pattern keys appear in a set of conditions (for showing the explainer). */
export function patternsInConds(conds) {
  const keys = [];
  for (const c of conds || []) {
    if (typeof c.la === "string" && c.la.startsWith(PATTERN_OPERAND_PREFIX)) {
      const k = c.la.slice(PATTERN_OPERAND_PREFIX.length);
      if (!keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}

export function condCode(c) { return `${c.la} ${c.op} ${c.b}`; }
export function chainCode(conds) { return conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condCode(c)}`).join(""); }

export const TEMPLATES = [
  /* BB breakout with momentum confirmation.
     Entry demands THREE things line up on the same completed candle: a close that has
     just crossed the upper band, RSI above 60, and a positive MACD histogram. The band
     break already implies the candle pushed up through resistance, so the separate
     green-candle check was largely redundant.

     The MACD is confirmed by histogram > 0, which is positive exactly when the MACD line
     is above its signal — so "momentum is positive" is still required, we just don't also
     demand the cross to happen ON the breakout bar (a near-coincidence that suppressed
     most entries).

     Exit is deliberately WIDE (OR): the trend breaking (close under the middle band),
     momentum turning (MACD cross down), or the move going parabolic (RSI > 90). Any
     one of them is enough. Quick to leave, slow to enter. */
  { name: "BB breakout + MACD", tag: "Momentum",
    code: "BB1 = BollingerBand(length=20)\nRSI1 = RSI(length=14)\nMACD1 = MACD()\nCC1 = CurrentCandle()\n\nif CC1.close crosses_above BB1.upper\n   AND RSI1 > 60\n   AND MACD1.hist > 0:\n    enter_trade()\n\nif CC1.close crosses_below BB1.middle\n   OR MACD1.line crosses_below MACD1.signal\n   OR RSI1 > 90:\n    exit_trade()",
    cfg: {
      mode: "builder",
      defs: [
        { type: "BB", len: "20", name: "BB1" },
        { type: "RSI", len: "14", name: "RSI1" },
        { type: "MACD", len: "", name: "MACD1" },
        { type: "CurrentCandle", len: "", name: "CC1" },
      ],
      entry: [
        { la: "CC1.close", op: "crosses_above", bType: "ind", b: "BB1.upper" },
        { gate: "AND", la: "RSI1", op: ">", bType: "num", b: "60" },
        { gate: "AND", la: "MACD1.hist", op: ">", bType: "num", b: "0" },
      ],
      exit: [
        { la: "CC1.close", op: "crosses_below", bType: "ind", b: "BB1.middle" },
        { gate: "OR", la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" },
        { gate: "OR", la: "RSI1", op: ">", bType: "num", b: "90" },
      ],
    },
  },
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

/**
 * Turn a strategy's structured cfg into plain English.
 *
 * The sample-strategy cards used to print the raw DSL ("EMA1 = EMA(length=50)\nif EMA1 >
 * EMA2 AND RSI1 < 70: enter_trade()") — which is precise but reads like code, not an idea.
 * This renders the SAME cfg as sentences, so a starter idea reads the way a person would
 * describe it. It's derived from the executable rules, not a hand-written blurb, so it
 * cannot drift from what the strategy actually does.
 */
function humanIndicator(def) {
  const L = def.len ? ` ${def.len}` : "";
  switch (def.type) {
    case "EMA": return `the ${def.len}-period EMA`;
    case "SMA": return `the ${def.len}-day moving average`;
    case "RSI": return `RSI`;
    case "MACD": return `MACD`;
    case "BB": return `the Bollinger Bands`;
    case "ADX": return `ADX`;
    case "Supertrend": return `Supertrend`;
    case "CCI": return `CCI`;
    case "ATR": return `ATR`;
    case "VWAP": return `VWAP`;
    default: return `${def.type}${L}`;
  }
}

const OP_WORDS = {
  ">": "is above", "<": "is below", ">=": "is at or above", "<=": "is at or below",
  "==": "equals", "crosses_above": "crosses above", "crosses_below": "crosses below",
  crossed_above_within: "crosses above", crossed_below_within: "crosses below",
};

function humanCond(cond, defs) {
  const byName = (n) => defs.find((d) => d.name === n);
  const left = byName(cond.la) ? humanIndicator(byName(cond.la)) : cond.la;
  const op = OP_WORDS[cond.op] || cond.op;
  let right;
  if (cond.bType === "ind" && byName(cond.b)) right = humanIndicator(byName(cond.b));
  else if (cond.bType === "num" || cond.bType === "price") right = cond.b;
  else right = cond.b;
  const gate = cond.gate ? `${cond.gate.toLowerCase()} ` : "";
  return `${gate}${left} ${op} ${right}`;
}

export function humanizeStrategy(cfg) {
  if (!cfg) return null;
  const defs = cfg.defs || [];
  const entry = (cfg.entry || []).map((c) => humanCond(c, defs));
  const exit = (cfg.exit || []).map((c) => humanCond(c, defs));
  const bits = [];
  if (entry.length) bits.push({ k: "Buy when", v: entry.join(" ") });
  if (exit.length) bits.push({ k: "Sell when", v: exit.join(" ") });
  if (cfg.sl) bits.push({ k: "Stop loss", v: `${cfg.sl}%` });
  if (cfg.tp) bits.push({ k: "Target", v: `${cfg.tp}%` });
  return bits;
}
