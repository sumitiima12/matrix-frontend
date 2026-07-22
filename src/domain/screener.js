
/* Technicals only. P/E, revenue growth, EBITDA growth and ROE are gone: there is
   no fundamentals feed (Yahoo quoteSummary blocks datacenter IPs), so a screener
   rule on them would silently match NOTHING and look like a broken screener. */
export const METRICS = [["chg", "Day change %"], ["price", "Price"], ["rsi", "RSI"], ["macd", "MACD"], ["adx", "ADX"], ["cci", "CCI"], ["stoch", "Stochastic %K"], ["mfi", "MFI"], ["atr", "ATR"], ["vwap", "VWAP"], ["ema20", "EMA 20"], ["ema50", "EMA 50"], ["sma50", "SMA 50 (50-DMA)"], ["sma200", "SMA 200 (200-DMA)"], ["bbPctB", "Bollinger %B"]];

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
  // technical indicators (same set as the automate module)
  const indKV = [["adx", "adx"], ["cci", "cci"], ["mfi", "mfi"], ["atr", "atr"], ["vwap", "vwap"], ["macd", "macd"], ["stochastic", "stoch"], ["stoch", "stoch"], ["ema20", "ema20"], ["ema 20", "ema20"], ["ema50", "ema50"], ["ema 50", "ema50"], ["50 dma", "sma50"], ["50-dma", "sma50"], ["sma50", "sma50"], ["200 dma", "sma200"], ["200-dma", "sma200"], ["sma200", "sma200"], ["bollinger", "bbPctB"], ["volume", "vol"]];
  indKV.forEach(([kw, field]) => {
    let mm;
    if ((mm = t.match(new RegExp(kw + "\\s*(?:>|greater than|more than|above|over)\\s*(\\d+\\.?\\d*)")))) { res.conds.push({ m: field, o: ">", v: +mm[1] }); res.note.push(`${kw.toUpperCase()} > ${mm[1]}`); }
    if ((mm = t.match(new RegExp(kw + "\\s*(?:<|less than|under|below)\\s*(\\d+\\.?\\d*)")))) { res.conds.push({ m: field, o: "<", v: +mm[1] }); res.note.push(`${kw.toUpperCase()} < ${mm[1]}`); }
  });
  if ((m = t.match(/price\s*(?:>|above|over|more than)\s*(\d+\.?\d*)(?![\d.]|[\s-]?(?:day|dma|ema|sma))/))) { res.conds.push({ m: "price", o: ">", v: +m[1] }); res.note.push(`Price > ${m[1]}`); }
  if ((m = t.match(/price\s*(?:<|below|under|less than)\s*(\d+\.?\d*)(?![\d.]|[\s-]?(?:day|dma|ema|sma))/))) { res.conds.push({ m: "price", o: "<", v: +m[1] }); res.note.push(`Price < ${m[1]}`); }
  if ((m = t.match(/(?:change|gain|up|return)\s*(?:>|above|over|more than)\s*(\d+\.?\d*)\s*%?/))) { res.conds.push({ m: "chg", o: ">", v: +m[1] }); res.note.push(`Change > ${m[1]}%`); }
  if ((/\bdma\b|\bsma\b|moving average/.test(t) && /50/.test(t) && /(100|200)/.test(t)) || /golden cross/.test(t)) { res.dma = true; res.note.push("50-DMA > 200-DMA"); }
  // Trader vocabulary — the same words Neo understands in the strategy builder.
  if (/oversold/.test(t)) { res.conds.push({ m: "rsi", o: "<", v: 30 }); res.note.push("RSI < 30 (oversold)"); }
  if (/overbought/.test(t)) { res.conds.push({ m: "rsi", o: ">", v: 70 }); res.note.push("RSI > 70 (overbought)"); }
  if (/death cross/.test(t)) { res.dmaBear = true; res.note.push("50-DMA < 200-DMA (death cross)"); }
  if (/(?:price|trading)\s*(?:>|above|over)\s*(?:the\s*)?200[\s-]?(?:day|dma)/.test(t)) { res.conds.push({ m: "price", o: ">", rhs: "sma200" }); res.note.push("Price > 200-DMA"); }
  if (/(?:price|trading)\s*(?:<|below|under)\s*(?:the\s*)?200[\s-]?(?:day|dma)/.test(t)) { res.conds.push({ m: "price", o: "<", rhs: "sma200" }); res.note.push("Price < 200-DMA"); }
  if (/(?:price|trading)\s*(?:>|above|over)\s*(?:the\s*)?50[\s-]?(?:day|dma)/.test(t)) { res.conds.push({ m: "price", o: ">", rhs: "sma50" }); res.note.push("Price > 50-DMA"); }
  if (/(?:price|trading)\s*(?:<|below|under)\s*(?:the\s*)?50[\s-]?(?:day|dma)/.test(t)) { res.conds.push({ m: "price", o: "<", rhs: "sma50" }); res.note.push("Price < 50-DMA"); }
  // MACD momentum shorthand — "MACD bullish/positive" -> MACD > 0, "bearish/negative" -> MACD < 0.
  if (/macd\s*(?:is\s*)?(?:bullish|positive|above\s*zero)/.test(t)) { res.conds.push({ m: "macd", o: ">", v: 0 }); res.note.push("MACD > 0 (bullish)"); }
  if (/macd\s*(?:is\s*)?(?:bearish|negative|below\s*zero)/.test(t)) { res.conds.push({ m: "macd", o: "<", v: 0 }); res.note.push("MACD < 0 (bearish)"); }
  /* INDICATOR-vs-INDICATOR comparisons in prose: "EMA 20 above EMA 50", "price above VWAP",
     "RSI above SMA50". The number-based matchers above handle "<indicator> > <value>"; this handles
     "<indicator> <op> <indicator>", which people write just as often. Only fires when BOTH sides
     resolve to a real screener field and the right side isn't a number (that's the value case). */
  const FIELD_WORDS = [
    [/\bprice\b|\bltp\b|\bclose\b/, "price"],
    [/200[\s-]?(?:day|dma)|sma\s*200|200\s*sma/, "sma200"],
    [/50[\s-]?(?:day|dma)|sma\s*50|50\s*sma/, "sma50"],
    [/\bema\s*20\b|\b20\s*ema\b/, "ema20"],
    [/\bema\s*50\b|\b50\s*ema\b/, "ema50"],
    [/\bvwap\b/, "vwap"], [/\brsi\b/, "rsi"], [/\badx\b/, "adx"], [/\bmacd\b/, "macd"],
    [/\bstoch\w*/, "stoch"], [/\bcci\b/, "cci"], [/\bmfi\b/, "mfi"], [/\batr\b/, "atr"],
  ];
  const fieldOf = (s) => { for (const [re, f] of FIELD_WORDS) if (re.test(s)) return f; return null; };
  const OPRE = /(?:\bis\s+)?(?:above|over|greater than|higher than|>|below|under|less than|lower than|<)/;
  t.split(/\s+and\s+|,|;/).forEach((clause) => {
    const om = OPRE.exec(clause); if (!om) return;
    const [lhs, rhs] = clause.split(om[0]);
    if (rhs == null) return;
    // Resolve BOTH sides to a field. A pure-number RHS ("60") resolves to nothing and is left to the
    // value matchers above; but "EMA 50" / "SMA 200" contain digits yet ARE fields, so we can't reject
    // on digits alone — we reject only when the right side fails to resolve to a real indicator.
    const mA = fieldOf(lhs || ""), mB = fieldOf(rhs || "");
    if (mA && mB && mA !== mB) {
      const o = /above|over|greater|higher|>/.test(om[0]) ? ">" : "<";
      if (!res.conds.find((c) => c.m === mA && c.rhs === mB)) { res.conds.push({ m: mA, o, rhs: mB }); res.note.push(`${mA} ${o} ${mB}`); }
    }
  });
  return res;
}
/**
 * NOTE ON TIMEFRAMES
 * ------------------
 * The screener used to expose 3m/5m/15m/30m/1h/1d and resolve an indicator for
 * the chosen timeframe via indAt(), which took the DAILY value and applied a
 * seeded random wobble. Those numbers were invented — screening "RSI < 30 on 5m"
 * matched against a fabricated RSI.
 *
 * The backend computes indicators from real DAILY candles only, so daily is the
 * only timeframe we can screen honestly. The selector is gone rather than lying.
 *
 * To restore it, add a backend endpoint that computes indicators per timeframe
 * from real intraday candles, then reintroduce the selector here.
 */

/** The real, backend-computed value for a field. No adjustment, no invention. */
export function indValue(s, field) {
  const v = s[field];
  return v == null || Number.isNaN(v) ? null : v;
}

export function matchScreen(list, res) {
  return list.filter((s) => {
    if (res.sectors.length && !res.sectors.some((sec) => (s.sector || "").toLowerCase().includes(sec))) return false;
    if (res.dma && !(s.sma50 > s.sma200)) return false;
    if (res.dmaBear && !(s.sma50 < s.sma200)) return false;
    return res.conds.every((c) => {
      const x = s[c.m]; if (x == null || isNaN(x)) return false;
      // A condition can compare a metric against a fixed value OR another indicator (c.rhs).
      const y = c.rhs != null ? s[c.rhs] : c.v;
      if (y == null || isNaN(y)) return false;
      return c.o === ">" ? x > y : c.o === "<" ? x < y : c.o === ">=" ? x >= y : x <= y;
    });
  });
}
