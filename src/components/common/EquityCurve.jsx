import React, { useMemo, useState } from "react";
import { useEquityCurve } from "../../hooks/useEquityCurve";
import { fmt, pct, chgColor } from "../../lib/format";

/**
 * EquityCurve — total portfolio value (cash + holdings) over time, for one market.
 *
 * Every point is reconstructed from real closing prices and the real trade log —
 * see useEquityCurve. Where a position has no price history, it is left out and
 * said so, rather than valued at cost and passed off as a market value.
 */

const RANGES = [[30, "1M"], [90, "3M"], [180, "6M"], [365, "1Y"]];

export default function EquityCurve({ market = "IN", portfolio, trades, deposits, wallet }) {
  const [days, setDays] = useState(90);
  const [mode, setMode] = useState("value");   // "value" = cash + holdings | "pnl" = cumulative profit
  const { loading, series, excluded } = useEquityCurve(market, portfolio, trades, deposits, wallet, days);

  const ccy = market === "FNO" ? "IN" : market;

  const metric = mode === "pnl" ? "pnl" : "total";
  const last = series && series.length ? series[series.length - 1] : null;

  const view = useMemo(() => {
    if (!series || series.length < 2) return null;
    const vals = series.map((p) => p[metric]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const W = 300;
    const H = 96;
    const pts = series.map((p, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - ((p[metric] - lo) / (hi - lo)) * H;
      return [x, y];
    });
    const first = series[0][metric];
    const lastVal = series[series.length - 1][metric];
    const zeroY = hi === lo ? null : H - ((0 - lo) / (hi - lo)) * H;
    return {
      W, H, pts,
      line: pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
      area: `M0,${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${W},${H} Z`,
      first, last: lastVal, zeroY,
      changePct: first !== 0 ? ((lastVal / first) - 1) * 100 : null,
      changeAbs: lastVal - first,
    };
  }, [series, metric]);

  // On the P&L chart the colour should track PROFIT, not the period's direction:
  // a portfolio that is down 2% today but still up overall is still in profit.
  const up = view ? (mode === "pnl" ? view.last >= 0 : view.changeAbs >= 0) : true;
  const stroke = up ? "var(--up)" : "var(--down)";

  return (
    <div className="card" style={{ marginTop: 14, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".04em" }}>
            {mode === "pnl" ? "CUMULATIVE P&L · REALISED + UNREALISED" : "TOTAL VALUE · CASH + HOLDINGS"}
          </div>
          {view && (
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, marginTop: 3, color: mode === "pnl" ? chgColor(view.last) : "var(--ink)" }}>
              {mode === "pnl" && view.last >= 0 ? "+" : ""}{fmt(view.last, ccy)}
            </div>
          )}
        </div>
        {view && mode === "value" && view.changePct != null && (
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: chgColor(view.changeAbs) }}>
              {view.changeAbs >= 0 ? "+" : ""}{fmt(view.changeAbs, ccy)}
            </div>
            <div className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: chgColor(view.changePct) }}>
              {pct(view.changePct, 2)}
            </div>
          </div>
        )}
        {view && last && mode === "pnl" && (
          /* A percentage change on a P&L line is nonsense once it crosses zero
             (from -100 to +100 is not "-200%"). The realised/unrealised split is
             the number that actually means something. */
          <div style={{ textAlign: "right", flex: "0 0 auto", fontSize: 10.5, lineHeight: 1.5 }}>
            <div className="mono" style={{ color: "var(--muted)" }}>
              Realised <span style={{ fontWeight: 800, color: chgColor(last.realised) }}>{fmt(last.realised, ccy)}</span>
            </div>
            <div className="mono" style={{ color: "var(--muted)" }}>
              Open <span style={{ fontWeight: 800, color: chgColor(last.unrealised) }}>{fmt(last.unrealised, ccy)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Small segmented toggle, not two full-width buttons. */}
      <div
        style={{
          display: "inline-flex", gap: 2, marginTop: 10, padding: 2,
          borderRadius: 9, background: "var(--elev)", border: "1px solid var(--line)",
        }}
      >
        {[["value", "Value"], ["pnl", "P&L"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className="tap disp"
            style={{
              border: "none", borderRadius: 7, padding: "4px 12px",
              fontSize: 10.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
              background: mode === k ? "var(--surface)" : "transparent",
              color: mode === k ? "var(--ink)" : "var(--muted)",
              boxShadow: mode === k ? "0 1px 3px rgba(0,0,0,.14)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
        {RANGES.map(([d, label]) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="tap mono"
            style={{
              flex: 1, borderRadius: 8, padding: "5px 4px", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
              border: "1px solid " + (days === d ? "var(--primary)" : "var(--line)"),
              background: days === d ? "var(--primary-soft)" : "transparent",
              color: days === d ? "var(--primary)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, minHeight: 96 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "34px 0", textAlign: "center" }}>
            Rebuilding from real prices…
          </div>
        ) : !view ? (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "28px 0", textAlign: "center", lineHeight: 1.5 }}>
            Not enough history yet. The curve is built from your actual trades and real
            closing prices — it appears once you've traded in this market.
          </div>
        ) : (
          <svg viewBox={`0 0 ${view.W} ${view.H}`} width="100%" height={view.H} preserveAspectRatio="none">
            <defs>
              <linearGradient id={`eq-${market}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Break-even. Without it, a P&L line that is entirely negative still
                LOOKS like it is climbing — the eye reads the shape, not the axis. */}
            {mode === "pnl" && view.zeroY != null && view.zeroY >= 0 && view.zeroY <= view.H && (
              <line x1="0" y1={view.zeroY} x2={view.W} y2={view.zeroY} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
            )}
            <path d={view.area} fill={`url(#eq-${market})`} />
            <path d={view.line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {view && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5, color: "var(--muted)" }}>
          <span className="mono">{series[0].day}</span>
          <span className="mono">{series[series.length - 1].day}</span>
        </div>
      )}

      {excluded && excluded.length > 0 && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
          Excluded (no price history): {excluded.join(", ")}. Left out rather than valued at cost.
        </div>
      )}
    </div>
  );
}
