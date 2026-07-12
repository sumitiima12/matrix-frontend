import { resolveOperand, chainEval, parseClause, mapToken, detectOp } from "./strategyLang";
import React from "react";

/**
 * Backtest engine — runs a strategy over REAL candles and reports win rate, P&L and drawdown.
 */

export function backtest(cfg, c) {
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

export function parseRules(text) {
  if (!text || !text.trim()) return { conds: [], defs: [], unparsed: [] };
  const cleaned = text.replace(/^\s*(buy|sell|enter|exit|go long|short|when|if)\b[:,]?\s*/i, "");
  const parts = cleaned.split(/\s+(and|or)\s+/i);
  const conds = [], defs = [], unparsed = [];
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i];
    const gate = i === 0 ? undefined : (parts[i - 1].toLowerCase() === "or" ? "OR" : "AND");
    const p = parseClause(clause);
    if (p) { if (gate) p.cond.gate = gate; conds.push(p.cond); p.defs.forEach((d) => { if (d && !defs.find((x) => x.name === d.name)) defs.push(d); }); }
    else if (clause.trim()) unparsed.push(clause.trim());
  }
  return { conds, defs, unparsed };
}
