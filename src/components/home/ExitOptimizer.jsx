import React, { useState } from "react";
import { optimizeExits } from "../../domain/api";
import { Sparkles } from "lucide-react";

/* ExitOptimizer — "Optimize SL & TP".
   ONE optimiser with TWO options: Optimize Win rate, Optimize P&L. Tapping an option runs the backend
   grid sweep (SL × TP) over this screener/strategy's OWN past entry signals and reports the pair that
   best meets that objective, alongside the CURRENT pair — so the user sees Earlier vs Now across win
   rate, SL hit, TP hit, P&L and return. `mode="metric"` for My-Screener metric conditions; otherwise
   the candle entry chain. Long-only; validated out-of-sample.

   Props: { mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply(sl, tp) } */
const wr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";
const pct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
const amt = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(2);
const cnt = (x) => (x == null || isNaN(x)) ? "—" : String(x);

export default function ExitOptimizer({ mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply }) {
  const [state, setState] = useState({ loading: false, res: null, ran: false });
  const [objective, setObjective] = useState(null);   // null until the user picks an option

  const run = async (obj) => {
    setObjective(obj);
    if (!entry || !entry.length || !appSyms || !appSyms.length) {
      setState({ loading: false, ran: true, res: { entries: 0 } });
      return;
    }
    setState({ loading: true, res: null, ran: true });
    const res = await optimizeExits({ mode, defs, entry, tf, appSyms, currentSl, currentTp, objective: obj });
    setState({ loading: false, ran: true, res });
  };

  const { loading, res, ran } = state;
  const best = res && res.best;
  const cur = res && res.current;
  const oos = res && res.oos;

  const cellL = { fontSize: 9.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 };
  const num = { fontWeight: 800, fontSize: 12, color: "var(--ink)" };
  // Two options. Tapping one runs the optimiser for that objective (and highlights it).
  const optBtn = (k, label) => (
    <button key={k} onClick={() => run(k)} disabled={loading} className="tap disp" style={{
      flex: 1, padding: "10px 8px", fontSize: 11.5, fontWeight: 800, borderRadius: 10, cursor: "pointer",
      border: "1px solid " + (objective === k ? "#7C3AED" : "var(--line)"),
      background: objective === k ? "#7C3AED" : "var(--surface)",
      color: objective === k ? "#fff" : "var(--ink)", opacity: loading ? 0.6 : 1,
    }}>{label}</button>
  );

  // Comparison rows: Win rate, SL hit, TP hit, P&L, Return %.
  const rows = best ? [
    { k: "Win rate", e: cur ? wr(cur.winRate) : "—", n: wr(best.winRate) },
    { k: "SL hit", e: cur ? cnt(cur.slHit) : "—", n: cnt(best.slHit) },
    { k: "TP hit", e: cur ? cnt(cur.tpHit) : "—", n: cnt(best.tpHit) },
    { k: "P&L", e: cur ? amt(cur.pnl) : "—", n: amt(best.pnl), nColor: best.pnl >= 0 ? "var(--up)" : "var(--down)" },
    { k: "Return %", e: cur ? pct(cur.retPct) : "—", n: pct(best.retPct), nColor: best.retPct >= 0 ? "var(--up)" : "var(--down)" },
  ] : [];

  return (
    <div style={{ marginTop: 6 }}>
      <div className="disp" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color="#7C3AED" /> Optimize SL &amp; TP
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {optBtn("winrate", "Optimize Win rate")}
        {optBtn("pnl", "Optimize P&L")}
      </div>
      {loading && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Optimising on real candles…</div>}

      {ran && !loading && (!best) && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
          Not enough historical signals to backtest this{res && res.entries != null ? ` (${res.entries} found)` : ""} — try a higher timeframe, more symbols, or a looser entry, then run again. (This optimises on price history, not your own trades.)
        </div>
      )}

      {ran && !loading && best && (
        <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 11, padding: 11, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>Ideal exits · {objective === "winrate" ? "max win rate" : "max P&L"}</div>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{best.trades} past trades</div>
          </div>

          {/* Ideal SL / TP headline */}
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            <div style={{ flex: 1, textAlign: "center", background: "var(--elev)", borderRadius: 9, padding: "8px 6px" }}>
              <div style={cellL}>Ideal SL</div>
              <div className="mono" style={{ ...num, color: "var(--down)", fontSize: 16 }}>{best.sl}%</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "var(--elev)", borderRadius: 9, padding: "8px 6px" }}>
              <div style={cellL}>Ideal TP</div>
              <div className="mono" style={{ ...num, color: "var(--up)", fontSize: 16 }}>{best.tp}%</div>
            </div>
          </div>

          {/* Earlier vs Now across every metric */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 5, alignItems: "center" }}>
              <div />
              <div style={{ ...cellL, textAlign: "right" }}>Earlier{cur ? ` (${currentSl}/${currentTp})` : ""}</div>
              <div style={{ ...cellL, textAlign: "right" }}>Now ({best.sl}/{best.tp})</div>
              {rows.map((r) => (
                <React.Fragment key={r.k}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800 }}>{r.k}</div>
                  <div className="mono" style={{ ...num, textAlign: "right", color: "var(--muted)" }}>{r.e}</div>
                  <div className="mono" style={{ ...num, textAlign: "right", color: r.nColor || "var(--ink)" }}>{r.n}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
          {!cur && <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>Set a current SL/TP to compare "Earlier" against these ideals.</div>}

          {oos && (
            <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 9, lineHeight: 1.5 }}>
              Out-of-sample check (unseen {oos.trades} trades): {wr(oos.winRate)} win, {pct(oos.retPct)} return — {oos.retPct >= 0 ? "holds up" : "weaker, use with care"}.
            </div>
          )}
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>
            Backtested on past entries — not a guarantee of future results. P&L is per 1 unit / contract.
          </div>

          {onApply && (
            <button
              onClick={() => onApply(best.sl, best.tp)}
              className="tap"
              style={{ marginTop: 10, width: "100%", border: "none", background: "#7C3AED", color: "#fff", borderRadius: 9, padding: "9px 0", fontSize: 11.5, fontWeight: 800 }}
            >
              Apply {best.sl}% SL / {best.tp}% TP
            </button>
          )}
        </div>
      )}
    </div>
  );
}
