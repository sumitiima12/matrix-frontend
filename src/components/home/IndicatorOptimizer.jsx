import React, { useState } from "react";
import { optimizeIndicators } from "../../domain/api";
import { Sparkles } from "lucide-react";

/* IndicatorOptimizer — "Optimize Indicators" for a screener/strategy.
   ONE optimiser, TWO options (Optimize Win rate / Optimize P&L). Tapping an option searches the ideal
   indicator LENGTHS + a shared timeframe (≤1h) over this screener's OWN past entry signals and reports
   the tuned setup vs the current one across win rate, P&L and return. A "Lock timeframe" toggle keeps
   the current timeframe fixed and tunes only the lengths. `mode="metric"` for metric screeners; else the
   candle entry chain. Long-only; validated on the strategy's own history.

   Props: { mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply(defs, tf) } */
const wr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";
const pct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
const amt = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(2);

export default function IndicatorOptimizer({ mode, defs, entry, tf, appSyms, currentSl, currentTp, onApply, tfTunable = true }) {
  const [state, setState] = useState({ loading: false, res: null, ran: false, applied: false });
  const [objective, setObjective] = useState(null);   // null until the user picks an option
  const [lockTf, setLockTf] = useState(true);          // default ON — keep tf fixed; tune only lengths
  const lockable = ["3m", "5m", "15m", "30m", "1h"].includes(String(tf));
  const numeric = (defs || []).some((d) => Number(d && d.len) > 0);   // any tunable indicator length?
  // Even with NO tunable lengths, the optimiser can still sweep the TIMEFRAME (e.g. Price change % 5m →
  // 3m/10m) — so it's useful unless the tf is also locked. Only truly nothing to do when both are true.
  const tfFixed = lockTf && lockable;
  // Optimizable when: an indicator has a tunable length, OR the timeframe is both tunable (a tf-based
  // metric like Price change %) and not locked.
  const canTune = numeric || (tfTunable && !tfFixed);

  const run = async (obj) => {
    setObjective(obj);
    if (!entry || !entry.length || !appSyms || !appSyms.length || !canTune) {
      setState({ loading: false, ran: true, res: { entries: 0 }, applied: false });
      return;
    }
    setState({ loading: true, res: null, ran: true, applied: false });
    const res = await optimizeIndicators({ mode, defs, entry, tf, appSyms, currentSl, currentTp, objective: obj, lockTf: tfFixed ? tf : null });
    setState({ loading: false, ran: true, res, applied: false });
  };

  const { loading, res, ran, applied } = state;
  const best = res && res.best;
  const cur = res && res.current;
  const changes = (res && res.changes) || [];
  const tfChanged = !!(best && best.tf && String(best.tf) !== String(tf));   // timeframe-only improvement
  const hasChange = changes.length > 0 || tfChanged;

  const cellL = { fontSize: 9.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 };
  const num = { fontWeight: 800, fontSize: 12, color: "var(--ink)" };
  const optBtn = (k, label) => (
    <button key={k} onClick={() => run(k)} disabled={loading || !canTune} title={!canTune ? "No tunable indicator lengths and the timeframe is locked" : undefined} className="tap disp" style={{
      flex: 1, padding: "10px 8px", fontSize: 11.5, fontWeight: 800, borderRadius: 10, cursor: canTune ? "pointer" : "not-allowed",
      border: "1px solid " + (objective === k ? "#0EA5E9" : "var(--line)"),
      background: objective === k ? "#0EA5E9" : "var(--surface)",
      color: objective === k ? "#fff" : "var(--ink)", opacity: (loading || !canTune) ? 0.6 : 1,
    }}>{label}</button>
  );

  const rows = best ? [
    { k: "Win rate", e: cur ? wr(cur.winRate) : "—", n: wr(best.winRate) },
    { k: "P&L", e: cur ? amt(cur.pnl) : "—", n: amt(best.pnl), nColor: best.pnl >= 0 ? "var(--up)" : "var(--down)" },
    { k: "Return %", e: cur ? pct(cur.retPct) : "—", n: pct(best.retPct), nColor: best.retPct >= 0 ? "var(--up)" : "var(--down)" },
  ] : [];

  return (
    <div style={{ marginTop: 12 }}>
      <div className="disp" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color="#0EA5E9" /> Optimize Indicators
      </div>
      {/* Lock timeframe — when on, only indicator lengths are tuned and this tf stays fixed. */}
      <label className="tap" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontSize: 10.5, fontWeight: 700, color: lockable ? "var(--ink)" : "var(--muted)", cursor: lockable ? "pointer" : "not-allowed" }}>
        <input type="checkbox" checked={lockTf && lockable} disabled={!lockable} onChange={(e) => setLockTf(e.target.checked)} style={{ accentColor: "#0EA5E9", width: 15, height: 15 }} />
        Lock timeframe to {tf} {lockable ? "(tune indicator lengths only)" : "(only ≤ 1h can be locked)"}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        {optBtn("winrate", "Optimize Win rate")}
        {optBtn("pnl", "Optimize P&L")}
      </div>
      {/* When there are no tunable lengths (a metric screener), say what will still happen: the tf sweep. */}
      {!numeric && (
        <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          {!tfTunable
            ? "No tunable indicator lengths — nothing to optimise."
            : tfFixed
              ? "No tunable indicator lengths — and the timeframe is locked, so there's nothing to optimise."
              : "No tunable indicator lengths here — this tunes the timeframe only (e.g. 5m → 3m / 10m if it scores better)."}
        </div>
      )}
      {loading && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Searching indicator lengths &amp; timeframes…</div>}

      {ran && !loading && (!best) && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
          {!canTune
            ? "Nothing to optimise — this screener has no tunable indicator lengths and the timeframe is locked."
            : `Not enough historical signals to backtest this${res && res.entries != null ? ` (${res.entries} found)` : ""} — try a higher timeframe, more symbols, or a looser entry, then run again.`}
        </div>
      )}

      {ran && !loading && best && (
        <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 11, padding: 11, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>Tuned indicators · {objective === "winrate" ? "max win rate" : "max P&L"}</div>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{best.trades != null ? `${best.trades} past trades` : ""}</div>
          </div>

          {/* Per-indicator change: name · length@tf → length@tf; and/or a timeframe-only change. */}
          <div style={{ fontSize: 10.5, color: "var(--ink)", marginTop: 8, lineHeight: 1.5 }}>
            {changes.length
              ? changes.map((c) => `${c.name}: ${c.fromLen ?? "—"}@${c.fromTf} → ${c.toLen}@${c.toTf}`).join(" · ")
              : tfChanged
                ? `Timeframe: ${tf} → ${best.tf}`
                : `Already optimal @ ${best.tf}.`}
          </div>

          {/* Earlier vs Now across the metrics */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 5, alignItems: "center" }}>
              <div />
              <div style={{ ...cellL, textAlign: "right" }}>Earlier</div>
              <div style={{ ...cellL, textAlign: "right" }}>Now</div>
              {rows.map((r) => (
                <React.Fragment key={r.k}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800 }}>{r.k}</div>
                  <div className="mono" style={{ ...num, textAlign: "right", color: "var(--muted)" }}>{r.e}</div>
                  <div className="mono" style={{ ...num, textAlign: "right", color: r.nColor || "var(--ink)" }}>{r.n}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>
            Backtested on past entries — SL/TP held fixed. Not a guarantee of future results.
          </div>

          {onApply && hasChange && (
            <button
              onClick={() => { onApply(best.defs, best.tf); setState((s) => ({ ...s, applied: true })); }}
              disabled={applied}
              className="tap"
              style={{ marginTop: 10, width: "100%", border: "none", background: applied ? "var(--up)" : "#0EA5E9", color: "#fff", borderRadius: 9, padding: "9px 0", fontSize: 11.5, fontWeight: 800, opacity: applied ? 0.95 : 1 }}
            >
              {applied ? "✓ Applied" : (changes.length ? `Apply tuned indicators @ ${best.tf}` : `Apply timeframe ${best.tf}`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
