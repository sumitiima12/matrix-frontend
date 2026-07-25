import React, { useState } from "react";
import { optimizeExits } from "../../domain/api";
import { Sparkles } from "lucide-react";

/* ExitOptimizer — "Find ideal SL/TP".
   Runs the backend grid sweep (SL × TP) over this screener/strategy's OWN past entry signals and
   reports the pair that would have maximised expectancy, alongside the CURRENT pair, so the user sees
   previous vs new win rate and P&L before applying. `mode="metric"` for My-Screener metric conditions;
   otherwise the candle entry chain (Popular screeners). Long-only; validated out-of-sample.

   Props: { mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply(sl, tp) } */
const pct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
const wr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";

export default function ExitOptimizer({ mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply }) {
  const [state, setState] = useState({ loading: false, res: null, ran: false });

  const run = async () => {
    if (!entry || !entry.length || !appSyms || !appSyms.length) {
      setState({ loading: false, ran: true, res: { entries: 0 } });
      return;
    }
    setState({ loading: true, res: null, ran: true });
    const res = await optimizeExits({ mode, defs, entry, tf, appSyms, currentSl, currentTp });
    setState({ loading: false, ran: true, res });
  };

  const { loading, res, ran } = state;
  const best = res && res.best;
  const cur = res && res.current;
  const oos = res && res.oos;

  const cellL = { fontSize: 9.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 };
  const num = { fontWeight: 800, fontSize: 12.5, color: "var(--ink)" };

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={run}
        disabled={loading}
        className="tap"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)",
          background: "var(--surface)", color: "var(--ink)", borderRadius: 9, padding: "7px 11px",
          fontSize: 10.5, fontWeight: 800, opacity: loading ? 0.6 : 1,
        }}
      >
        <Sparkles size={13} color="#7C3AED" />
        {loading ? "Optimising…" : "Find ideal SL / TP"}
      </button>

      {ran && !loading && (!best) && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
          Not enough past entry signals to optimise{res && res.entries != null ? ` (${res.entries} found)` : ""}. Add symbols with more history or a looser entry, then try again.
        </div>
      )}

      {ran && !loading && best && (
        <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 11, padding: 11, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>Ideal exits</div>
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

          {/* Previous vs New — win rate + return over the same past signals */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 4, alignItems: "center" }}>
              <div />
              <div style={{ ...cellL, textAlign: "right" }}>Win rate</div>
              <div style={{ ...cellL, textAlign: "right" }}>P&amp;L</div>

              {cur && <>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800 }}>Current ({currentSl}/{currentTp}%)</div>
                <div className="mono" style={{ ...num, textAlign: "right", color: "var(--muted)" }}>{wr(cur.winRate)}</div>
                <div className="mono" style={{ ...num, textAlign: "right", color: "var(--muted)" }}>{pct(cur.retPct)}</div>
              </>}

              <div style={{ fontSize: 10.5, color: "var(--ink)", fontWeight: 800 }}>New ({best.sl}/{best.tp}%)</div>
              <div className="mono" style={{ ...num, textAlign: "right" }}>{wr(best.winRate)}</div>
              <div className="mono" style={{ ...num, textAlign: "right", color: best.retPct >= 0 ? "var(--up)" : "var(--down)" }}>{pct(best.retPct)}</div>
            </div>
          </div>

          {oos && (
            <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 9, lineHeight: 1.5 }}>
              Out-of-sample check (unseen {oos.trades} trades): {wr(oos.winRate)} win, {pct(oos.retPct)} return — {oos.retPct >= 0 ? "holds up" : "weaker, use with care"}.
            </div>
          )}
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>
            Backtested on past entries — not a guarantee of future results.
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
