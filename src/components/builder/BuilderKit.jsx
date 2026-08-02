// BuilderKit — shared strategy-builder pieces extracted from Automation.jsx so PopularScreeners (and
// any eager consumer) can import them WITHOUT pulling the whole Automation page into the main bundle,
// letting Automation.jsx lazy-split cleanly. Pure presentational components; no Automation-local deps.
import { useState } from "react";
import { ListChecks, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { selStyle } from "../common/styles";
import { IND_CATALOG } from "../../domain/strategyLang";
import { fmt } from "../../lib/format";

/* LIST OF TRADES — a collapsible ledger of every round-trip a backtest executed: entry & exit
   date/time, prices, return and (sized) P&L. The button reveals the table; once open it can be
   exported to CSV. Reused by the strategy-card backtest and the Automate ▸ Backtest rows. */
export function TradeLog({ trades, market = "IN", showSym = false, accent = "#7C3AED" }) {
  const [open, setOpen] = useState(false);
  const list = trades || [];
  const dt = (ms) => {
    if (!ms) return { d: "—", t: "" };
    const x = new Date(ms);
    return { d: x.toLocaleDateString("en-GB"), t: x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
  };
  const cols = [];
  if (showSym) cols.push(["Symbol", (r) => r.sym || ""]);
  cols.push(["Entry Date", (r) => dt(r.entryTime).d]);
  cols.push(["Entry Time", (r) => dt(r.entryTime).t]);
  cols.push(["Exit Date", (r) => dt(r.exitTime).d]);
  cols.push(["Exit Time", (r) => dt(r.exitTime).t]);
  cols.push(["Invested", (r) => (r.invested != null ? r.invested : "")]);
  cols.push(["Qty", (r) => (r.qty != null ? r.qty : "")]);
  cols.push(["Entry Price", (r) => (r.entryPrice != null ? r.entryPrice : "")]);
  cols.push(["Exit Price", (r) => (r.exitPrice != null ? r.exitPrice : "")]);
  cols.push(["Return %", (r) => (r.retPct >= 0 ? "+" : "") + (r.retPct || 0).toFixed(2) + "%"]);
  cols.push(["P&L", (r) => (r.pnl == null ? "" : (r.pnl >= 0 ? "+" : "") + r.pnl.toFixed(2))]);
  cols.push(["Exit Reason", (r) => r.reason || ""]);
  const exportCsv = () => {
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc(c[0])).join(",")];
    list.forEach((r) => lines.push(cols.map((c) => esc(c[1](r))).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trades-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen((v) => !v)} disabled={!list.length} className="tap disp" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 13px", fontSize: 11.5, fontWeight: 800, opacity: list.length ? 1 : 0.5, cursor: list.length ? "pointer" : "not-allowed" }}>
        <ListChecks size={14} color={accent} /> {open ? "Hide" : "List of"} Trades ({list.length})
      </button>
      {open && list.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--elev)" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>{list.length} trade{list.length === 1 ? "" : "s"}</span>
            <button onClick={exportCsv} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 5 }}>⬇ Export CSV</button>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: showSym ? 760 : 700 }}>
              <thead><tr>
                <th style={th}>#</th>
                {showSym && <th style={th}>Symbol</th>}
                <th style={th}>Entry</th>
                <th style={th}>Exit</th>
                <th style={{ ...th, textAlign: "right" }}>Invested</th>
                <th style={{ ...th, textAlign: "right" }}>Entry Price</th>
                <th style={{ ...th, textAlign: "right" }}>Exit Price</th>
                <th style={{ ...th, textAlign: "right" }}>Return</th>
                <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
                <th style={th}>Exit</th>
              </tr></thead>
              <tbody>
                {list.map((r, i) => {
                  const e = dt(r.entryTime), x = dt(r.exitTime);
                  const qtyStr = r.qty == null ? "" : (Math.abs(r.qty) >= 1 ? r.qty.toFixed(2) : r.qty.toFixed(6));
                  return (
                    <tr key={i}>
                      <td style={{ ...td, color: "var(--muted)" }}>{i + 1}</td>
                      {showSym && <td style={{ ...td, fontWeight: 800 }}>{r.sym}</td>}
                      <td style={td}><span style={{ fontWeight: 800 }}>{e.d}</span> <span style={{ color: "var(--muted)" }}>{e.t}</span></td>
                      <td style={td}><span style={{ fontWeight: 800 }}>{x.d}</span> <span style={{ color: "var(--muted)" }}>{x.t}</span></td>
                      {/* Invested notional on top, quantity below (qty is fractional for crypto). */}
                      <td style={{ ...td, textAlign: "right" }}>{r.invested == null ? "—" : <><span style={{ fontWeight: 800 }}>{fmt(r.invested, market)}</span>{qtyStr ? <><br /><span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 9 }}>{qtyStr} qty</span></> : null}</>}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.entryPrice == null ? "—" : fmt(r.entryPrice, market)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.exitPrice == null ? "—" : fmt(r.exitPrice, market)}</td>
                      <td style={{ ...td, textAlign: "right", color: r.retPct >= 0 ? "var(--up)" : "var(--down)" }}>{(r.retPct >= 0 ? "+" : "") + (r.retPct || 0).toFixed(2)}%</td>
                      <td style={{ ...td, textAlign: "right", color: (r.pnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{r.pnl == null ? "—" : (r.pnl >= 0 ? "+" : "") + fmt(r.pnl, market)}</td>
                      <td style={{ ...td, color: "var(--muted)" }}>{r.reason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export const TFS = ["3m", "5m", "15m", "30m", "1h", "4h", "1D"];
export const OPSET = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="], ["crosses_above", "⤴ crosses above"], ["crosses_below", "⤵ crosses below"], ["crossed_above_within", "⤴ crossed above (within N)"], ["crossed_below_within", "⤵ crossed below (within N)"]];
// Extra editable parameters per indicator type (beyond length + timeframe). e.g. MACD's
// fast/slow/signal (default 12/26/9), Bollinger's std-dev multiplier, Stochastic's smoothing.
const IND_PARAMS = {
  MACD: [["fast", "Fast", "12"], ["slow", "Slow", "26"], ["signal", "Signal", "9"]],
  BB: [["mult", "Std Dev", "2"]],
  KC: [["mult", "Multiplier", "1.5"]],
  Stoch: [["smoothK", "Smooth %K", "3"], ["smoothD", "Smooth %D", "3"]],
  Supertrend: [["mult", "Multiplier", "3"]],
};
export function IndicatorDefs({ defs, setDefs, defaultTf = "1D" }) {
  const [openId, setOpenId] = useState(null);   // which indicator's settings panel is expanded
  const upd = (id, k, v) => setDefs((p) => p.map((d) => d.id === id ? { ...d, [k]: v } : d));
  const add = () => setDefs((p) => [...p, { id: Date.now(), type: "EMA", len: "20", tf: defaultTf, name: "IND" + (p.length + 1) }]);
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }}>
        You don't need to add <b>Price</b> and <b>Volume</b> as indicators — they're already available to use in Step 2. (Add a Volume indicator here only if you want its <b>average</b> or <b>median</b>.)
      </div>
      {defs.map((d) => {
        const cat = IND_CATALOG.find((c) => c.type === d.type) || {};
        const params = IND_PARAMS[d.type] || [];
        const hasSettings = params.length > 0 || d.type === "Volume";
        const open = openId === d.id;
        return (
          <div key={d.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap" }}>
              <select aria-label="Indicator" value={d.type} onChange={(e) => upd(d.id, "type", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "9px 4px" }}>{IND_CATALOG.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}</select>
              <input value={cat.needsLen ? d.len : "—"} onChange={(e) => upd(d.id, "len", e.target.value.replace(/[^0-9]/g, ""))} disabled={!cat.needsLen} placeholder="len" className="no-ring mono" style={{ ...selStyle, flex: "0 0 40px", minWidth: 0, textAlign: "center", padding: "9px 2px", opacity: cat.needsLen ? 1 : 0.4 }} />
              <select aria-label="Timeframe" value={d.tf} onChange={(e) => upd(d.id, "tf", e.target.value)} style={{ ...selStyle, flex: "0 0 56px", minWidth: 0, padding: "9px 2px" }}>{TFS.map((t) => <option key={t}>{t}</option>)}</select>
              <input value={d.name} onChange={(e) => upd(d.id, "name", e.target.value)} placeholder="name" className="no-ring disp" style={{ ...selStyle, flex: "1 1 0", minWidth: 0, fontWeight: 700, padding: "9px 6px" }} />
              <button onClick={() => setOpenId(open ? null : d.id)} title="Indicator settings" className="tap" style={{ border: "1px solid " + (open ? "var(--primary)" : "var(--line)"), background: open ? "var(--primary-soft)" : "transparent", color: open ? "var(--primary)" : hasSettings ? "var(--ink)" : "var(--muted)", borderRadius: 8, flex: "0 0 auto", width: 30, height: 30, display: "grid", placeItems: "center" }}><SlidersHorizontal size={13} /></button>
              <button onClick={() => setDefs((p) => p.filter((x) => x.id !== d.id))} className="tap" style={{ border: "none", background: "transparent", flex: "0 0 auto", padding: 2 }}><Trash2 size={15} color="var(--down)" /></button>
            </div>
            {open && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, padding: "10px 11px", background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
                {params.length === 0 && d.type !== "Volume" && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Uses the length and timeframe above. No extra settings.</div>}
                {params.map(([k, label, def]) => (
                  <label key={k} style={{ flex: "0 0 auto" }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>{label.toUpperCase()}</div>
                    <input value={d[k] != null && d[k] !== "" ? d[k] : def} onChange={(e) => upd(d.id, k, e.target.value.replace(/[^0-9.]/g, ""))} className="no-ring mono" style={{ ...selStyle, width: 66, textAlign: "center", padding: "8px 4px" }} />
                  </label>
                ))}
                {d.type === "Volume" && (
                  <label style={{ flex: "0 0 auto" }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>MEASURE</div>
                    <select value={d.mode || "avg"} onChange={(e) => upd(d.id, "mode", e.target.value)} style={{ ...selStyle, minWidth: 110, padding: "8px 6px" }}>
                      <option value="avg">Average (over len)</option>
                      <option value="median">Median (over len)</option>
                      <option value="raw">Raw volume</option>
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={add} className="tap" style={{ marginTop: 4, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add indicator</button>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Tip: name them (e.g. EMA1, MACD1) and tap ⚙ to change length, timeframe or settings (MACD 12/26/9 → any). Only these appear in your signals below.</div>
    </div>
  );
}

export function CondBuilder2({ label, conds, setConds, operands }) {
  const upd = (i, k, v) => setConds((p) => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const add = () => setConds((p) => [...p, { la: operands[0] || "Price", op: "<", bType: "num", b: "30", gate: "AND" }]);
  const del = (i) => setConds((p) => p.filter((_, j) => j !== i).map((c, j) => { if (j === 0) { const { gate, ...rest } = c; return rest; } return c; }));
  // "Entry signal — combine indicators…" → bold heading + muted hint after the dash.
  const [heading, ...restLabel] = String(label).split("—");
  const hint = restLabel.join("—").trim();
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 800, letterSpacing: -0.2 }}>{heading.trim()}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>{hint}</div>}
      </div>
      {conds.map((c, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          {i > 0 && (
            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              {["AND", "OR"].map((g) => (
                <button key={g} onClick={() => upd(i, "gate", g)} className="pill tap disp" style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 14px", border: "1px solid var(--line)", background: (c.gate || "AND") === g ? "var(--primary)" : "transparent", color: (c.gate || "AND") === g ? "var(--on-primary)" : "var(--muted)" }}>{g}</button>
              ))}
            </div>
          )}
          {/* One line, NO horizontal scroll — the operand/operator/value selects shrink to share
              the width (min-width:0 lets them ellipsize) while the type toggle and the delete
              button stay pinned and always visible, so you never scroll to reach delete. */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap", background: "var(--bg)", borderRadius: 12, padding: 6 }}>
            <select aria-label="Left operand" value={c.la} onChange={(e) => upd(i, "la", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 4px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
            <select aria-label="Operator" value={c.op} onChange={(e) => upd(i, "op", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 4px" }}>{OPSET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 2, flex: "0 0 auto" }}>
              {[["ind", "Ind"], ["num", "#"]].map(([k, l]) => (
                <button key={k} onClick={() => upd(i, "bType", k)} className="pill tap" style={{ fontSize: 10, fontWeight: 800, padding: "4px 7px", border: "none", background: c.bType === k ? "var(--primary)" : "transparent", color: c.bType === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
            {c.bType === "ind"
              ? <select aria-label="Right operand" value={c.b} onChange={(e) => upd(i, "b", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 4px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
              : <input value={c.b} onChange={(e) => upd(i, "b", e.target.value)} className="no-ring mono" style={{ ...selStyle, flex: "1 1 44px", minWidth: 0, textAlign: "center", padding: "8px 4px" }} />}
            {/* The "within N bars" operators need their N. Shown only when relevant. */}
            {(c.op === "crossed_above_within" || c.op === "crossed_below_within") && (
              <input aria-label="within N bars" title="within N bars"
                value={c.n == null ? 3 : c.n}
                onChange={(e) => upd(i, "n", e.target.value.replace(/[^0-9]/g, "") || "1")}
                className="no-ring mono"
                style={{ flex: "0 0 30px", width: 30, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, background: "var(--elev)", color: "var(--ink)", fontWeight: 800, fontSize: 11.5, padding: "8px 2px" }}
              />
            )}
            <button onClick={() => del(i)} disabled={conds.length === 1} className="tap" style={{ flex: "0 0 auto", border: "none", background: "transparent", padding: 2, opacity: conds.length === 1 ? 0.3 : 1 }}><Trash2 size={15} color="var(--down)" /></button>
          </div>
        </div>
      ))}
      <button onClick={add} className="tap" style={{ marginTop: 10, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add condition</button>
    </div>
  );
}
