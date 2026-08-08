/**
 * automationHelpers.js — pure, hook-free helpers extracted from Automation.jsx (PERF-10, first slice).
 *
 * These are stateless formatting/predicate functions with no React or side effects, so pulling them out of the
 * 2,300-line Automation component is a safe decomposition: same behavior, less in the component file, and they're
 * now independently importable/testable. No rendering logic moved — that (and re-render isolation) is the larger,
 * separately-verified part of PERF-10.
 */

/** Human phrase for a backtest's covered period, e.g. "45 days" / "the available history". */
export function btPeriodStr(stats) {
  const p = stats && stats.period;
  if (!p) return "the available history";
  return `${p.n} ${p.unit}${p.n === 1 ? "" : "s"}`;
}

/** Who authored a strategy: premium / Matrix → "Neo", else the stored author or "You". */
export function creatorOf(s) {
  return (s && (s.premium || s.by === "Matrix")) ? "Neo" : ((s && s.by) || "You");
}

/** The 9 CSV/table cells for a backtest stat row, in column order (Trades…Max DD). */
export function statCells(st) {
  if (!st) return ["", "", "", "", "", "", "", "", ""];
  return [
    st.trades || 0, st.wins || 0, st.losses || 0,
    st.winRate != null ? st.winRate.toFixed(0) + "%" : "-",
    st.tpHit || 0, st.slHit || 0,
    (st.retPct >= 0 ? "+" : "") + (st.retPct || 0).toFixed(1) + "%",
    st.pnl == null ? "" : (st.pnl >= 0 ? "+" : "") + Math.round(st.pnl),
    st.maxDD == null ? "" : "-" + Math.round(st.maxDD),
  ];
}

/** Does a strategy run on `sym`? Empty symbol list means "matches everything". */
export function stratRunsOnSym(s, sym) {
  const syms = (s && (s.symbols || (s.symbol ? [s.symbol] : []))) || [];
  return syms.length ? syms.includes(sym) : true;
}
