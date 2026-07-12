import React from "react";
import { hash, lcg } from "../lib/format";

export const METRICS = [["chg", "Day change %"], ["price", "Price"], ["rsi", "RSI"], ["macd", "MACD"], ["adx", "ADX"], ["cci", "CCI"], ["stoch", "Stochastic %K"], ["mfi", "MFI"], ["atr", "ATR"], ["vwap", "VWAP"], ["ema20", "EMA 20"], ["ema50", "EMA 50"], ["sma50", "SMA 50 (50-DMA)"], ["sma200", "SMA 200 (200-DMA)"], ["bbPctB", "Bollinger %B"], ["vol", "Volume"], ["pe", "P/E"], ["revGrowth", "Revenue growth %"], ["ebitdaGrowth", "EBITDA growth %"], ["roe", "ROE %"]];

export const OPS = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"]];

/**
 * Screener engine — parses plain-English screens and matches them against REAL indicator data.
 */

export function parseScreen(text) {
  const t = " " + text.toLowerCase() + " ";
  const res = { sectors: [], caps: [], conds: [], dma: false, note: [] };
  if (/\b(it|information technology|software|tech|semiconductor)\b/.test(t)) { res.sectors.push("it", "software", "semiconductor", "tech", "it services"); res.note.push("IT/Tech sector"); }
  if (/\bpharma|healthcare|drug\b/.test(t)) { res.sectors.push("pharma", "healthcare"); res.note.push("Pharma"); }
  if (/\bbank|banking\b/.test(t)) { res.sectors.push("bank"); res.note.push("Banking"); }
  if (/\bfmcg|consumer\b/.test(t)) { res.sectors.push("fmcg", "consumer"); res.note.push("FMCG/Consumer"); }
  if (/\bauto|automobile\b/.test(t)) { res.sectors.push("auto"); res.note.push("Auto"); }
  if (/\benergy|oil|power\b/.test(t)) { res.sectors.push("energy", "utilities"); res.note.push("Energy"); }
  if (/\bmetal|steel|mining\b/.test(t)) { res.sectors.push("metal"); res.note.push("Metals"); }
  if (/large[\s-]?cap|\blarge\b/.test(t)) { res.caps.push("Large"); res.note.push("Large cap"); }
  if (/mid[\s-]?cap|\bmid\b/.test(t)) { res.caps.push("Mid"); res.note.push("Mid cap"); }
  if (/small[\s-]?cap|\bsmall\b/.test(t)) { res.caps.push("Small"); res.note.push("Small cap"); }
  let m;
  if ((m = t.match(/rsi\s*(?:>|greater than|more than|above|over)\s*(\d+)/))) { res.conds.push({ m: "rsi", o: ">", v: +m[1] }); res.note.push(`RSI > ${m[1]}`); }
  if ((m = t.match(/rsi\s*(?:<|less than|under|below)\s*(\d+)/))) { res.conds.push({ m: "rsi", o: "<", v: +m[1] }); res.note.push(`RSI < ${m[1]}`); }
  if ((m = t.match(/p\/?e\s*(?:<|less than|under|below)\s*(\d+)/))) { res.conds.push({ m: "pe", o: "<", v: +m[1] }); res.note.push(`P/E < ${m[1]}`); }
  if ((m = t.match(/p\/?e\s*(?:>|more than|above|over)\s*(\d+)/))) { res.conds.push({ m: "pe", o: ">", v: +m[1] }); res.note.push(`P/E > ${m[1]}`); }
  if ((m = t.match(/roe\s*(?:>|more than|above|over)\s*(\d+)/))) { res.conds.push({ m: "roe", o: ">", v: +m[1] }); res.note.push(`ROE > ${m[1]}`); }
  // technical indicators (same set as the automate module)
  const indKV = [["adx", "adx"], ["cci", "cci"], ["mfi", "mfi"], ["atr", "atr"], ["vwap", "vwap"], ["macd", "macd"], ["stochastic", "stoch"], ["stoch", "stoch"], ["ema20", "ema20"], ["ema 20", "ema20"], ["ema50", "ema50"], ["ema 50", "ema50"], ["50 dma", "sma50"], ["50-dma", "sma50"], ["sma50", "sma50"], ["200 dma", "sma200"], ["200-dma", "sma200"], ["sma200", "sma200"], ["bollinger", "bbPctB"], ["volume", "vol"]];
  indKV.forEach(([kw, field]) => {
    let mm;
    if ((mm = t.match(new RegExp(kw + "\\s*(?:>|greater than|more than|above|over)\\s*(\\d+\\.?\\d*)")))) { res.conds.push({ m: field, o: ">", v: +mm[1] }); res.note.push(`${kw.toUpperCase()} > ${mm[1]}`); }
    if ((mm = t.match(new RegExp(kw + "\\s*(?:<|less than|under|below)\\s*(\\d+\\.?\\d*)")))) { res.conds.push({ m: field, o: "<", v: +mm[1] }); res.note.push(`${kw.toUpperCase()} < ${mm[1]}`); }
  });
  if ((m = t.match(/price\s*(?:>|above|over|more than)\s*(\d+\.?\d*)/))) { res.conds.push({ m: "price", o: ">", v: +m[1] }); res.note.push(`Price > ${m[1]}`); }
  if ((m = t.match(/price\s*(?:<|below|under|less than)\s*(\d+\.?\d*)/))) { res.conds.push({ m: "price", o: "<", v: +m[1] }); res.note.push(`Price < ${m[1]}`); }
  if ((m = t.match(/(?:change|gain|up|return)\s*(?:>|above|over|more than)\s*(\d+\.?\d*)\s*%?/))) { res.conds.push({ m: "chg", o: ">", v: +m[1] }); res.note.push(`Change > ${m[1]}%`); }
  if (/ebi?tda\s*(?:positive|>\s*0|is positive)|positive\s*ebi?tda/.test(t)) { res.conds.push({ m: "ebitdaGrowth", o: ">", v: 0 }); res.note.push("EBITDA positive"); }
  if (/rising revenue|revenue growth|growing revenue|revenue rising|sales growth|revenue growing/.test(t)) { res.conds.push({ m: "revGrowth", o: ">", v: 0 }); res.note.push("Revenue rising"); }
  if ((/\bdma\b|\bsma\b|moving average/.test(t) && /50/.test(t) && /(100|200)/.test(t)) || /golden cross/.test(t)) { res.dma = true; res.note.push("50-DMA > 200-DMA"); }
  return res;
}
const SCREEN_TFS = [["3m", "3 min"], ["5m", "5 min"], ["15m", "15 min"], ["30m", "30 min"], ["1h", "1 hour"], ["1d", "1 day"]];
const TF_ADJ = { "3m": 0.99, "5m": 0.995, "15m": 1.0, "30m": 1.005, "1h": 1.01, "1d": 1.0 };
// Deterministic per-timeframe value for an indicator field (sim: same base, tf-seeded wobble).

export function indAt(s, field, tf) {
  const base = s[field];
  if (base == null || isNaN(base)) return base;
  if (!tf || tf === "1d") return base;
  const r = lcg(hash(s.sym + "|" + field + "|" + tf))();
  return +(base * ((TF_ADJ[tf] || 1) + (r - 0.5) * 0.04)).toFixed(4);
}

export function matchScreen(list, res) {
  return list.filter((s) => {
    if (res.sectors.length && !res.sectors.some((sec) => (s.sector || "").toLowerCase().includes(sec))) return false;
    if (res.caps.length && !res.caps.includes(s.cap)) return false;
    if (res.dma && !(s.sma50 > s.sma200)) return false;
    return res.conds.every((c) => { const x = s[c.m]; if (x == null || isNaN(x)) return false; return c.o === ">" ? x > c.v : c.o === "<" ? x < c.v : c.o === ">=" ? x >= c.v : x <= c.v; });
  });
}
