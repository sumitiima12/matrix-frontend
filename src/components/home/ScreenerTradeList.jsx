import { useMemo } from "react";
import { fmt, chgColor } from "../../lib/format";

/* SCREENER TRADE LIST — the expandable "List of Trades" for a screener card, mirroring the Automate
   strategy-card list. Unlike those (which come from a backtest), this is sourced from the screener's
   ACTUAL executed auto-buy trades: every round-trip this screener placed, scoped to the card's active
   mode + selected period, each with entry/exit date-time, exit type, return % and P&L. P&L is price
   move × quantity held (t.qty is coins / shares / lots for all markets), with shorts inverted — the
   same maths the card's P&L total uses, so the list and the total always agree. */
export default function ScreenerTradeList({ trades, strategyName, mode, market, periodFrom, priceOf, open }) {
  const rows = useMemo(() => {
    const isReal = mode === "real";
    return (trades || [])
      .filter((t) => {
        if (t.strategy !== strategyName) return false;
        if (isReal ? !t.real : !!t.real) return false;
        if (t.status === "rejected" || t.entry == null) return false;
        const closed = t.exitAt != null && t.exit != null && t.exitType !== "Open";
        if (closed && (t.exitAt || t.entryAt || 0) < periodFrom) return false;   // closed before window
        return true;
      })
      .map((t) => {
        const closed = t.exitAt != null && t.exit != null && t.exitType !== "Open";
        const cur = closed ? t.exit : (priceOf(t.sym) != null ? priceOf(t.sym) : t.entry);
        const dir = (t.side === "SELL" || t.short) ? -1 : 1;
        const pnl = (cur - t.entry) * (t.qty || 0) * dir;
        const retPct = t.entry ? ((cur / t.entry) - 1) * 100 * dir : 0;
        return {
          sym: t.sym, entryAt: t.entryAt, exitAt: closed ? t.exitAt : null,
          exitType: closed ? (t.exitType || "Closed") : "Open", pnl, retPct, open: !closed,
        };
      })
      .sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
  }, [trades, strategyName, mode, market, periodFrom, priceOf]);

  if (!open) return null;

  const dt = (ms) => {
    if (!ms) return { d: "—", t: "" };
    const x = new Date(ms);
    return { d: x.toLocaleDateString("en-GB"), t: x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
  };
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };

  return (
    <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)", padding: "8px 10px", background: "var(--elev)" }}>
        List of Trades <span style={{ color: "var(--muted)", fontWeight: 700 }}>· {rows.length}</span>
      </div>
      {rows.length ? (
        <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
            <thead>
              <tr>
                <th style={th}>Symbol</th><th style={th}>Entry</th><th style={th}>Exit</th><th style={th}>Exit type</th>
                <th style={{ ...th, textAlign: "right" }}>Return</th>
                <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const e = dt(r.entryAt), x = dt(r.exitAt);
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 800 }}>{r.sym}</td>
                    <td style={td}><span style={{ fontWeight: 800 }}>{e.d}</span> <span style={{ color: "var(--muted)" }}>{e.t}</span></td>
                    <td style={td}>{r.open ? <span style={{ color: "var(--primary)", fontWeight: 800 }}>Open</span> : <><span style={{ fontWeight: 800 }}>{x.d}</span> <span style={{ color: "var(--muted)" }}>{x.t}</span></>}</td>
                    <td style={{ ...td, color: r.exitType === "Stop loss" || r.exitType === "Trailing stop" ? "var(--down)" : r.exitType === "Exit trigger" ? "var(--up)" : "var(--muted)" }}>{r.exitType}</td>
                    <td style={{ ...td, textAlign: "right", color: r.retPct >= 0 ? "var(--up)" : "var(--down)" }}>{(r.retPct >= 0 ? "+" : "") + r.retPct.toFixed(2)}%</td>
                    <td style={{ ...td, textAlign: "right", color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{(r.pnl >= 0 ? "+" : "") + fmt(r.pnl, market)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--muted)", padding: "12px 10px" }}>No trades from this screener in the selected period.</div>
      )}
    </div>
  );
}
