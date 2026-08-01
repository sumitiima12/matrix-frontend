import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defOperands, chainCode, IND_CATALOG, TEMPLATES, detectTf, detectAllTfs, tfMinutes } from "../domain/strategyLang";
import { backtest, parseRules } from "../domain/backtest";
import { stratPerf } from "../domain/strategies";
import { Activity, Bell, Bolt, Check, ChevronDown, ChevronUp, Copy, Globe, ListChecks, Pause, Pencil, Play, Plus, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BACKEND_URL } from "../config";
import { chgColor, clamp, fmt, pct, DAY, lsGet, lsSet } from "../lib/format";
import { useBacktestStats, loadBtCandles, scoreCfg } from "../hooks/useBacktestStats";
import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, CF } from "../lib/series";
import { ALL, UNIVERSE, marketOf } from "../domain/universe";
import { apiListPublicStrategies, apiPublishStrategy, apiUnpublishStrategy, aiInterpretStrategyAI, optimizeExits, optimizeIndicators, scanScreener, marketOpen } from "../domain/api";
import { humanizeStrategy, humanizeCond, PATTERN_EXPLAIN, patternsInConds, suggestStrategy } from "../domain/strategyLang";
/* Neo's plain-English read-back of a set of conditions: "a Cup & Handle forms, and RSI is below 40". */
const neoReads = (conds) => (conds || []).map((c, i) => `${i ? (c.gate === "OR" ? "or " : "and ") : ""}${humanizeCond(c)}`).join(", ");
import { useCandles } from "../hooks/useCandles";
import OptionLeg from "../components/common/OptionLeg";
import MultiSelect from "../components/common/MultiSelect";
import ExitOptimizer from "../components/home/ExitOptimizer";
import { selStyle } from "../components/common/styles";
import { downloadCSV } from "../lib/csv";
import { brokerSymbol } from "../domain/brokerSymbols";
import { registerAutoBuy, loadAutoBuys, pauseAutoBuy, cancelAutoBuy, closeAutoBuy, updateAutoBuy, setAutoBuyLive } from "../services/brokerService";

/**
 * Automation — visual strategy builder, plain-English rules, and backtesting on REAL candles.
 */


/* A human "5 days" / "6 months" label from the stats the headline backtest returns. */
function btPeriodStr(stats) {
  const p = stats && stats.period;
  if (!p) return "the available history";
  return `${p.n} ${p.unit}${p.n === 1 ? "" : "s"}`;
}

/* A labeled divider that heads the "Long" and "Short" groups inside each strategy tab. */
function SectionHead({ label, color, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 2px 8px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color, letterSpacing: 0.2 }}>{label}</span>
      {count != null && <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", background: "var(--elev)", borderRadius: 999, padding: "1px 8px" }}>{count}</span>}
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

/* Buy (long) vs Sell (short) toggle for the Samples / Premium sections. "Buy" shows the standard
   long strategies; "Sell" shows their short mirrors (same setup, opposite direction). */
function DirToggle({ dir, setDir }) {
  return (
    <div style={{ display: "flex", gap: 6, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, marginBottom: 12 }}>
      {[["buy", "Buy", "var(--up)"], ["sell", "Sell", "var(--down)"]].map(([k, label, col]) => (
        <button key={k} onClick={() => setDir(k)} className="tap disp" style={{
          flex: 1, borderRadius: 9, padding: "8px 4px", fontWeight: 800, fontSize: 12, cursor: "pointer",
          border: "none",
          background: dir === k ? col : "transparent",
          color: dir === k ? "#fff" : "var(--muted)",
        }}>{label}</button>
      ))}
    </div>
  );
}

/* Long / Short segmented toggle shown ABOVE Activate All in every strategy type. Selecting a side
   filters the list (and the bulk Activate/Deactivate) to Long or Short strategies. */
function LongShortToggle({ side, setSide, longCount, shortCount }) {
  const opts = [["long", "▲ Long", "var(--up)", longCount], ["short", "▼ Short", "var(--down)", shortCount]];
  return (
    <div style={{ display: "flex", gap: 6, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, margin: "0 0 10px" }}>
      {opts.map(([k, label, col, count]) => (
        <button key={k} onClick={() => setSide(k)} className="tap disp" style={{
          flex: 1, borderRadius: 9, padding: "8px 4px", fontWeight: 800, fontSize: 12, cursor: "pointer", border: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: side === k ? col : "transparent",
          color: side === k ? "#fff" : "var(--muted)",
        }}>
          {label}
          {count != null && <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 7px", background: side === k ? "rgba(255,255,255,.22)" : "var(--surface)", color: side === k ? "#fff" : "var(--muted)" }}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

/* Minimum reward/risk selector for the SL&TP optimiser. The optimiser will only pick a target that is
   at least this multiple of the stop (e.g. 1.5 → TP ≥ 1.5× SL), so it can't recommend a poor RR setup.
   "Off" lets it search the full grid with no floor. */
function RRMinSelect({ value, onChange }) {
  return (
    <label className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 10.5, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
      Min reward : risk
      <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="no-ring" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, fontSize: 11 }}>
        {[["0", "Off"], ["1", "1 : 1"], ["1.5", "1.5 : 1"], ["2", "2 : 1"], ["2.5", "2.5 : 1"], ["3", "3 : 1"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/* Max stop-loss cap for the exit optimiser. When set, the optimiser will never propose an SL wider than
   this — e.g. "1%" means the recommended stop is at most 1%. "Off" lets it search the full grid. */
function MaxSlSelect({ value, onChange }) {
  return (
    <label className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, marginLeft: 12, fontSize: 10.5, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
      Max SL
      <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="no-ring" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, fontSize: 11 }}>
        {[["0", "Off"], ["0.3", "0.3%"], ["0.5", "0.5%"], ["0.75", "0.75%"], ["1", "1%"], ["1.5", "1.5%"], ["2", "2%"], ["3", "3%"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

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

function BacktestResult({ cfg, defaultSym, blocked = false, onConnect, defaultTf = "5m" }) {
  // Default to the symbol the strategy is ACTIVATED on. Backtesting a NIFTY50
  // strategy against RELIANCE by default tests something you never deployed.
  const [sym, setSym] = useState(defaultSym || "RELIANCE");
  useEffect(() => { if (defaultSym) setSym(defaultSym); }, [defaultSym]);
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  // How far back real candles actually EXIST at each timeframe — intraday history is short, so the
  // backtest window defaults to this. Otherwise picking "5 min" leaves a 6-month window almost empty.
  const TF_LOOKBACK = { "1m": 5, "3m": 365, "5m": 365, "15m": 365, "30m": 365, "1h": 730, "4h": 730, "1d": 1825 };
  const [tf, setTf] = useState(defaultTf);
  const [from, setFrom] = useState(iso(Date.now() - (TF_LOOKBACK[defaultTf] || 180) * 864e5));
  const [to, setTo] = useState(iso(Date.now()));
  const [preset, setPreset] = useState("auto");
  const BT_TF = [["1m", "1 min"], ["3m", "3 min"], ["5m", "5 min"], ["15m", "15 min"], ["30m", "30 min"], ["1h", "1 hour"], ["4h", "4 hours"], ["1d", "1 day"]];
  const PRESETS = { "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730 };
  const applyPreset = (k) => { setPreset(k); if (k !== "custom") { setFrom(iso(Date.now() - PRESETS[k] * 864e5)); setTo(iso(Date.now())); } };
  // Switching timeframe snaps the window to the span that timeframe can actually cover.
  const changeTf = (k) => { setTf(k); setPreset("auto"); setFrom(iso(Date.now() - (TF_LOOKBACK[k] || 180) * 864e5)); setTo(iso(Date.now())); };
  const stock = ALL.find((a) => a.sym === sym) || ALL[0];
  /* THE DATE RANGE USED TO BE DECORATIVE.
     It computed `bars` = the number of DAYS between From and To, then sliced that many
     CANDLES — of whatever timeframe. On a 3-minute chart, "6 months" became 180 two-minute
     bars: about six hours of one session. The dates never filtered by date at all, and a
     strategy that would have traded plenty over six months reported zero trades.

     Now: filter by real timestamps, and compute indicators over the FULL history so a
     20-period Bollinger band isn't NaN for the entire window. */
  const { data: realData, loading: btLoading } = useCandles(sym, tf, 0, true);   // backtest = pull the LONG history window, not the chart's short one

  const fromMs = useMemo(() => new Date(from + "T00:00:00").getTime(), [from]);
  const toMs = useMemo(() => new Date(to + "T23:59:59").getTime(), [to]);

  const { data, startIdx, covered } = useMemo(() => {
    if (!realData || !realData.length) return { data: null, startIdx: 1, covered: null };
    // First bar inside the window. Everything before it is warm-up, not test data.
    let s = realData.findIndex((x) => x.t >= fromMs);
    if (s < 0) s = realData.length;           // window starts after our newest bar
    const end = realData.findIndex((x) => x.t > toMs);
    const cut = end < 0 ? realData.length : end;
    const inWindow = cut - s;

    return {
      data: realData.slice(0, cut),           // full history up to `to` (warm-up included)
      startIdx: Math.max(1, s),
      covered: {
        inWindow,
        first: realData[0] ? realData[0].t : null,
        last: realData[cut - 1] ? realData[cut - 1].t : null,
      },
    };
  }, [realData, fromMs, toMs]);

  const res = useMemo(
    () => (!cfg || cfg.mode === "plain" || !data ? null : backtest(cfg, data, startIdx, tf)),
    [cfg, data, startIdx, tf]
  );

  const bars = covered ? covered.inWindow : 0;
  // COMPLIANCE GATE: backtesting Indian stocks needs REAL history, which we can only serve a user
  // from THEIR OWN connected broker (we can't redistribute anyone else's feed). No broker -> nudge.
  if (blocked) {
    return (
      <div className="card" style={{ padding: 16, textAlign: "center", background: "var(--primary-soft)", border: "1px dashed var(--primary)", margin: "6px 0" }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>🔒</div>
        <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Connect your broker to backtest</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>
          Backtesting runs on real market history. To stay compliant we can only use <b>your own broker's</b> data —
          connect FYERS (or your broker) to unlock backtesting on real Indian candles.
        </div>
        {onConnect && (
          <button onClick={onConnect} className="tap disp" style={{ marginTop: 12, border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 12, padding: "10px 18px", fontWeight: 800, fontSize: 13 }}>
            Connect broker
          </button>
        )}
      </div>
    );
  }
  // No cfg at all -> the template lookup missed. Say so; do not throw a white screen.
  if (!cfg) {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>This strategy has no runnable configuration to backtest.</div>;
  }
  if (cfg.mode === "plain") {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>Plain-English rules are parsed on the backend at deploy time — switch to the visual builder to run a backtest.</div>;
  }
  if (btLoading) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>Loading real price history…</div>;

  /* Yahoo caps intraday history hard: 3-minute candles go back ONE DAY, 15-minute a
     month, hourly three months. Asking for "6M of 3-minute" is not a small stretch —
     it is impossible, and the old code silently returned six hours of one session and
     reported zero trades. Say what the data can actually support. */
  const TF_COVER = { "1m": "5 days", "3m": "~3 months", "5m": "~3 months", "15m": "~3 months", "30m": "~3 months", "1h": "1 year", "4h": "2 years", "1d": "5 years" };
  const coverNote = TF_COVER[tf];

  if (covered && covered.inWindow < 30) {
    return (
      <div style={{ fontSize: 12, color: "var(--amber)", padding: "10px 2px", lineHeight: 1.6, fontWeight: 600 }}>
        Only {covered.inWindow} candle{covered.inWindow === 1 ? "" : "s"} of real data fall inside this window
        {coverNote ? <> — Yahoo only provides about <b>{coverNote}</b> of history at the <b>{tf}</b> timeframe.</> : "."}
        <div style={{ color: "var(--muted)", fontWeight: 500, marginTop: 6 }}>
          {covered.first
            ? <>Available: {new Date(covered.first).toLocaleDateString("en-IN")} → {new Date(covered.last).toLocaleDateString("en-IN")}. </>
            : null}
          Pick a longer timeframe (1h or 1d) for a multi-month test, or shorten the date range.
        </div>
      </div>
    );
  }
  if (!data || !res) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>{BACKEND_URL ? "No price history available for this symbol/timeframe — backtest can't run on real data." : "Connect the backend to backtest on real price history."}</div>;
  const st = res.stats;
  const tile = (k, v, c) => (
    <div style={{ flex: "1 1 0", minWidth: 64, background: "var(--bg)", borderRadius: 12, padding: "9px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14, marginTop: 2, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Backtest on</span>
        <select aria-label="Symbol" value={sym} onChange={(e) => setSym(e.target.value)} style={{ ...selStyle, flex: "0 0 auto", minWidth: 120 }}>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym}</option>)}</select>
        <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>{bars} real bars</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>Candle timeframe</div>
        <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>
          {BT_TF.map(([k, l]) => (
            <button key={k} onClick={() => changeTf(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "6px 11px", fontSize: 11, fontWeight: 700, border: "1px solid " + (tf === k ? "var(--primary)" : "var(--line)"), background: tf === k ? "var(--primary)" : "var(--surface)", color: tf === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>Range</div>
        <div className="pill hide-scroll" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginBottom: 8, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
          {[["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["2y", "2Y"]].map(([k, l]) => (
            <button key={k} onClick={() => applyPreset(k)} className="pill tap disp" style={{ padding: "5px 13px", fontSize: 11.5, fontWeight: 700, border: "none", background: preset === k ? "var(--primary)" : "transparent", color: preset === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>From</div>
            <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="no-ring mono" style={{ ...selStyle, width: "100%", colorScheme: "light dark" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>To</div>
            <input type="date" value={to} min={from} max={iso(Date.now())} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="no-ring mono" style={{ ...selStyle, width: "100%", colorScheme: "light dark" }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tile("Return", (st.totalRet >= 0 ? "+" : "") + st.totalRet.toFixed(1) + "%", st.totalRet >= 0 ? "var(--up)" : "var(--down)")}
        {tile("Win rate", st.winRate.toFixed(0) + "%")}
        {tile("Trades", st.n)}
        {tile("Max DD", "-" + st.maxDD.toFixed(1) + "%", "var(--down)")}
      </div>
      <div style={{ height: 130, marginTop: 12, background: "var(--bg)", borderRadius: 12, padding: "8px 6px 2px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={res.eq} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <defs><linearGradient id={"eq" + sym} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} stopOpacity="0.35" /><stop offset="100%" stopColor={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Tooltip formatter={(v) => v + " (start 100)"} labelFormatter={() => "Equity"} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }} />
            <ReferenceLine y={100} stroke="var(--muted)" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="eq" stroke={st.totalRet >= 0 ? "#1FE08C" : "#FF5C77"} strokeWidth={2} fill={`url(#eq${sym})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>
        Strategy <b style={{ color: st.totalRet >= st.bh ? "var(--up)" : "var(--down)" }}>{st.totalRet >= st.bh ? "beat" : "lagged"}</b> buy-and-hold ({(st.bh >= 0 ? "+" : "") + st.bh.toFixed(1)}%). Avg trade {(st.avg >= 0 ? "+" : "") + st.avg.toFixed(2)}%.
      </div>
      {/* List of Trades — every round-trip with real entry/exit date-time, price, return & per-unit P&L.
          Replaces the old raw "Bar N → M" dump. Exportable to CSV once opened. */}
      <TradeLog
        trades={(res.trades || []).map((t) => ({
          entryTime: data[t.entryIdx] ? data[t.entryIdx].t : null,
          exitTime: data[t.exitIdx] ? data[t.exitIdx].t : null,
          entryPrice: t.entry,
          exitPrice: t.exit,
          retPct: (t.ret || 0) * 100,
          pnl: (t.ret || 0) * (t.entry || 0),   // P&L per 1 unit/contract, direction-aware
          reason: t.reason,
        }))}
        market={marketOf(sym)}
      />
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Real market candles · P&L shown per 1 unit/contract · past performance is not a prediction. Not financial advice.</div>
    </div>
  );
}

/* ============================== TRADE AUTOMATION ============================== */

export const TFS = ["3m", "5m", "15m", "30m", "1h", "4h", "1D"];
export const OPSET = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="], ["crosses_above", "⤴ crosses above"], ["crosses_below", "⤵ crosses below"], ["crossed_above_within", "⤴ crossed above (within N)"], ["crossed_below_within", "⤵ crossed below (within N)"]];

function TemplateCard({ t, onActivate, onToggleBt, btActive, onLoad, selected = false, market = "IN" }) {
  // Only symbols that belong to the market you are looking at.
  const symbolOptions = useMemo(() => {
    return (UNIVERSE[market] || []).map((s) => s.sym);
  }, [market]);
  const [syms, setSyms] = useState([]);
  const stop = (e) => e.stopPropagation();
  return (
    <div
      className="card tap"
      onClick={() => onLoad && onLoad(t)}
      title="Tap to load into the builder (tap again to clear)"
      style={{ flex: "0 0 auto", width: 250, padding: 14, cursor: onLoad ? "pointer" : "default", border: selected ? "1.5px solid var(--primary)" : undefined, boxShadow: selected ? "0 0 0 3px var(--primary-soft)" : undefined }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="disp" style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
        <span className="pill" style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 700, padding: "2px 8px" }}>{t.tag}</span>
      </div>
      {/* Plain-English rules — derived from the SAME cfg the strategy runs on, so the
          description can't drift from the behaviour. */}
      <div style={{ background: "var(--bg)", borderRadius: 12, padding: 11, marginTop: 10 }}>
        {(humanizeStrategy(t.cfg) || []).map((b, k) => (
          <div key={k} style={{ fontSize: 11, marginBottom: 4, lineHeight: 1.45 }}>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>{b.k} </span>
            <span style={{ fontWeight: 600 }}>{b.v}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, margin: "10px 0 6px" }}>Symbol to activate on</div>
      {/* One symbol, from THIS market. The old picker was a multi-select over a
          fixed cross-market list, so TSLA and NVDA showed up while you were on
          Indian equity — symbols the strategy could never sensibly trade. */}
      <select
        value={syms[0] || ""}
        onClick={stop}
        onChange={(e) => { e.stopPropagation(); setSyms(e.target.value ? [e.target.value] : []); }}
        aria-label="Symbol to activate this strategy on"
        style={{ ...selStyle, width: "100%" }}
      >
        <option value="">Choose a symbol…</option>
        {symbolOptions.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button disabled={!syms.length} onClick={(e) => { stop(e); syms.length && onActivate(t, syms); }} className="tap pill" style={{ flex: 1, border: "none", background: syms.length ? "linear-gradient(120deg,var(--primary),var(--primary-2))" : "var(--elev)", color: syms.length ? "var(--on-primary)" : "var(--muted)", fontWeight: 700, fontSize: 11.5, padding: 9, cursor: syms.length ? "pointer" : "not-allowed", opacity: syms.length ? 1 : 0.7 }}>Activate</button>
        <button onClick={(e) => { stop(e); onToggleBt(t.name); }} className="tap pill" style={{ flex: "0 0 auto", border: "1px solid " + (btActive ? "var(--primary)" : "var(--line)"), background: btActive ? "var(--primary-soft)" : "var(--surface)", fontWeight: 700, fontSize: 11.5, padding: "9px 11px", color: btActive ? "var(--primary)" : "var(--ink)", display: "flex", gap: 4, alignItems: "center" }}><Activity size={13} /> Test</button>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--primary)", fontWeight: 700, marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}><Copy size={11} /> Tap card to edit in builder</div>
    </div>
  );
}

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

/* Segmented two/three-option toggle — used for Buy Type and Order Type. */
function SegF({ label, options, value, set, disabled = [] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map((o) => {
          const off = disabled.includes(o);
          return (
            <button
              key={o}
              onClick={() => !off && set(o)}
              disabled={off}
              className="tap disp"
              title={off ? "Not available for options" : ""}
              style={{
                flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.4 : 1,
                border: "1px solid " + (value === o && !off ? "var(--primary)" : "var(--line)"),
                background: value === o && !off ? "var(--primary)" : "var(--surface)",
                color: value === o && !off ? "var(--on-primary)" : "var(--ink)",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumF({ label, v, set }) {
  return <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 5 }}>{label}</div>
    <input value={v} onChange={(e) => set(e.target.value)} className="no-ring mono" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: 10, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} /></div>;
}

/* ============================== SEARCH OVERLAY ============================== */

/**
 * A sample (Matrix-authored) strategy. It has never traded, so it has no live
 * record. Rather than invent one, we RUN it over the last six months of real
 * candles and report exactly what came out — and we label it a backtest, because
 * that is what it is. Hindsight is not performance.
 */
/* Deploy-size control shown on every strategy card — "Amount per trade ($)" for crypto
   (default 10, ±10), "Quantity per trade" for other markets (default 1, ±1). */
function DeploySizeField({ market, value, onChange }) {
  const isC = market === "Crypto";
  const step = isC ? 10 : 1;
  const val = value != null ? value : (isC ? 200 : 1);
  const set = (n) => onChange(Math.max(1, n));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{isC ? "Amount per trade (USD)" : "Quantity per trade"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => set(Number(val) - step)} className="tap" style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", fontWeight: 800 }}>−</button>
        {isC && <span className="mono" style={{ fontWeight: 800, fontSize: 12, color: "var(--muted)" }}>$</span>}
        <input value={val} onChange={(e) => { const n = isC ? parseFloat(e.target.value.replace(/[^0-9.]/g, "")) : parseInt(e.target.value.replace(/[^0-9]/g, ""), 10); set(Number.isFinite(n) && n > 0 ? n : 1); }} inputMode={isC ? "decimal" : "numeric"} className="mono no-ring" style={{ width: 56, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 12.5, background: "var(--elev)", color: "var(--ink)" }} />
        <button onClick={() => set(Number(val) + step)} className="tap" style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", fontWeight: 800 }}>+</button>
      </div>
    </div>
  );
}

/* Who made a strategy: Neo for the built-in sample/premium set, otherwise the poster's user id
   (public strategies) or "You" for your own. Drives the "Created by" tag on every card. */
function creatorOf(s) { return (s && (s.premium || s.by === "Matrix")) ? "Neo" : ((s && s.by) || "You"); }
/* Editable Stop-loss / Target on a strategy card. Defaults come from the strategy (0.5% / 1.5% if it
   carries none); the user can change them before deploying and the chosen values ride along on activate. */
/* "Optimize SL & TP" for a single strategy card — ONE optimiser, TWO options (Optimize Win rate /
   Optimize P&L). Tapping an option grid-searches the ideal exits on the card's symbol and writes them
   into the SL/TP fields. */
function CardOptimizeButton({ cfg, sym, tf = "5m", sl, tp, setSl, setTp }) {
  const [st, setSt] = useState({ loading: false, done: false, none: false });
  const [objective, setObjective] = useState(null);
  const [rrMin, setRrMin] = useState(1.5);   // minimum reward/risk the optimiser must respect
  const [maxSl, setMaxSl] = useState(0);     // optional cap: never recommend an SL above this (0 = off)
  const canOpt = !!(cfg && (cfg.entry || []).length > 0 && sym);
  const run = async (obj) => {
    if (!canOpt) return;
    setObjective(obj);
    setSt({ loading: true, done: false, none: false });
    const res = await optimizeExits({ mode: cfg.mode === "metric" ? "metric" : undefined, defs: cfg.defs || [], entry: cfg.entry, tf, appSyms: [sym], currentSl: sl ? Number(sl) : null, currentTp: tp ? Number(tp) : null, objective: obj, rrMin, maxSl }).catch(() => null);
    const best = res && res.best ? res.best : null;
    if (best) { setSl(String(best.sl)); setTp(String(best.tp)); }
    setSt({ loading: false, done: !!best, none: !best });
  };
  const optBtn = (k, label) => (
    <button key={k} onClick={() => run(k)} disabled={st.loading || !canOpt} className="tap disp" style={{ flex: "1 1 90px", padding: "9px 8px", fontSize: 11, fontWeight: 800, borderRadius: 10, border: "1px solid " + (objective === k ? "#7C3AED" : "var(--line)"), background: objective === k ? "#7C3AED" : "var(--surface)", color: objective === k ? "#fff" : "var(--ink)", cursor: canOpt ? "pointer" : "not-allowed", opacity: (st.loading || !canOpt) ? 0.6 : 1 }}>{label}</button>
  );
  return (
    <div style={{ marginTop: 8 }}>
      {/* Title + its two objective buttons on one line. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="disp" style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}><Sparkles size={13} color="#7C3AED" /> Optimize SL &amp; TP</div>
        {optBtn("winrate", "Win rate")}{optBtn("pnl", "P&L")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}><RRMinSelect value={rrMin} onChange={setRrMin} /><MaxSlSelect value={maxSl} onChange={setMaxSl} /></div>
      {st.loading && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Backtesting on historical candles…</div>}
      {st.done && <div style={{ fontSize: 9.5, color: "var(--up)", marginTop: 6, fontWeight: 700 }}>✓ Optimized → SL {sl}% / TP {tp}%</div>}
      {st.none && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Couldn't fetch enough price history for {sym || "this symbol"} on {tf} — try a higher timeframe or another symbol.</div>}
    </div>
  );
}

/* "Optimize Indicators" for a strategy card — ONE optimiser, TWO options. Tapping an option searches
   the indicator LENGTHS + a shared timeframe (≤1h) that maximise win rate or P&L on the card's symbol,
   then applies them to the user's copy of the strategy (defs + tf) and shows what changed. */
function CardIndicatorOptimizeButton({ cfg, sym, tf = "5m", sl, tp, onApply }) {
  const [st, setSt] = useState({ loading: false, done: false, none: false, changes: null });
  const [objective, setObjective] = useState(null);
  const [lockTf, setLockTf] = useState(true);         // default ON — keep this tf fixed; tune only lengths
  const numericDefs = (cfg && (cfg.defs || []).some((d) => Number(d && d.len) > 0));
  const canOpt = !!(cfg && (cfg.entry || []).length > 0 && sym && numericDefs);
  const lockable = ["3m", "5m", "15m", "30m", "1h"].includes(String(tf));   // timeframes the optimiser searches
  const run = async (obj) => {
    if (!canOpt) return;
    setObjective(obj);
    setSt({ loading: true, done: false, none: false, changes: null });
    const res = await optimizeIndicators({ mode: cfg.mode === "metric" ? "metric" : undefined, defs: cfg.defs || [], entry: cfg.entry, tf, appSyms: [sym], currentSl: sl ? Number(sl) : null, currentTp: tp ? Number(tp) : null, objective: obj, lockTf: (lockTf && lockable) ? tf : null }).catch(() => null);
    const best = res && res.best ? res.best : null;
    if (best && onApply) onApply(best.defs, best.tf);
    setSt({ loading: false, done: !!best, none: !best, changes: (res && res.changes) || null });
  };
  const optBtn = (k, label) => (
    <button key={k} onClick={() => run(k)} disabled={st.loading || !canOpt} className="tap disp" title={!numericDefs ? "This strategy has no tunable indicator lengths" : undefined} style={{ flex: "1 1 90px", padding: "9px 8px", fontSize: 11, fontWeight: 800, borderRadius: 10, border: "1px solid " + (objective === k ? "#0EA5E9" : "var(--line)"), background: objective === k ? "#0EA5E9" : "var(--surface)", color: objective === k ? "#fff" : "var(--ink)", cursor: canOpt ? "pointer" : "not-allowed", opacity: (st.loading || !canOpt) ? 0.6 : 1 }}>{label}</button>
  );
  return (
    <div style={{ marginTop: 10 }}>
      {/* Title + its two objective buttons on one line. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="disp" style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}><Sparkles size={13} color="#0EA5E9" /> Optimize Indicators</div>
        {optBtn("winrate", "Win rate")}{optBtn("pnl", "P&L")}
      </div>
      {/* Lock timeframe — when on, the optimiser only tunes indicator lengths and keeps this tf fixed. */}
      <label className="tap" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, fontSize: 10, fontWeight: 700, color: lockable ? "var(--ink)" : "var(--muted)", cursor: lockable ? "pointer" : "not-allowed" }}>
        <input type="checkbox" checked={lockTf && lockable} disabled={!lockable} onChange={(e) => setLockTf(e.target.checked)} style={{ accentColor: "#0EA5E9", width: 14, height: 14 }} />
        Lock timeframe to {tf} {lockable ? "(tune lengths only)" : "(only ≤ 1h can be locked)"}
      </label>
      {st.loading && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Searching indicator lengths &amp; timeframes…</div>}
      {st.done && st.changes && st.changes.length > 0 && (
        <div style={{ fontSize: 9.5, color: "var(--up)", marginTop: 6, lineHeight: 1.5, fontWeight: 700 }}>
          ✓ Applied · {st.changes.map((c) => `${c.name}: ${c.fromLen ?? "—"}@${c.fromTf}→${c.toLen}@${c.toTf}`).join(" · ")}
        </div>
      )}
      {st.done && st.changes && st.changes.length === 0 && (
        <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Current indicators are already optimal for this objective.</div>
      )}
      {st.none && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Couldn't fetch enough price history for {sym || "this symbol"} on {tf} — try a higher timeframe or another symbol.</div>}
    </div>
  );
}

/* User-editable Symbol + Timeframe for a strategy card (revealed by the card's Edit button). The
   timeframe applies to ALL of the strategy's indicators. Entry/exit rules stay hidden here. */
function CardSymTfPanel({ market, sym, setSym, tf, setTf }) {
  const symOptions = useMemo(() => (UNIVERSE[market] || []).map((s) => s.sym).filter((x) => x !== "INDIAVIX"), [market]);
  return (
    <div style={{ marginTop: 10, background: "var(--elev)", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>SYMBOL</div>
          <select value={sym || ""} onChange={(e) => setSym(e.target.value)} style={{ ...selStyle, width: "100%" }}>{symOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        </label>
        <label style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>TIMEFRAME</div>
          <select value={tf} onChange={(e) => setTf(e.target.value)} style={{ ...selStyle, width: "100%" }}>{TFS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </label>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>Timeframe applies to all indicators in this strategy.</div>
    </div>
  );
}

function StratSLTP({ sl, tp, setSl, setTp }) {
  const box = { width: 54, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 12.5, background: "var(--elev)", color: "var(--ink)" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Stop-loss / Target</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input value={sl} onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={box} />
        <span style={{ fontSize: 11, color: "var(--down)", fontWeight: 800 }}>% SL</span>
        <input value={tp} onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={box} />
        <span style={{ fontSize: 11, color: "var(--up)", fontWeight: 800 }}>% TP</span>
      </div>
    </div>
  );
}
/* CARD TRADE LOG — the expandable "List of Trades" opened by tapping a card's TRADES tile. It adds a
   date-range filter over the backtest's trade ledger and a summary strip (trades / win rate / SL hit /
   TP hit / P&L / return) for the selected range, then the per-trade table: entry & exit date-time,
   exit type, return % and P&L, exportable to CSV. Same backtest ledger the tiles are computed from. */
function CardTradeLog({ tradeList, market = "IN", open = false }) {
  const [range, setRange] = useState("all");
  const DAY_MS = 86400000;
  const from = useMemo(() => {
    const now = Date.now();
    if (range === "7d") return now - 7 * DAY_MS;
    if (range === "30d") return now - 30 * DAY_MS;
    if (range === "3m") return now - 91 * DAY_MS;
    if (range === "6m") return now - 182 * DAY_MS;
    if (range === "1y") return now - 365 * DAY_MS;
    return 0;
  }, [range]);
  const rows = useMemo(
    () => (tradeList || []).filter((t) => (t.exitTime || t.entryTime || 0) >= from),
    [tradeList, from]
  );
  const sum = useMemo(() => {
    const n = rows.length;
    const wins = rows.filter((r) => (r.retPct || 0) > 0).length;
    return {
      n,
      winRate: n ? (wins / n) * 100 : null,
      slHit: rows.filter((r) => r.reason === "SL").length,
      tpHit: rows.filter((r) => r.reason === "TP").length,
      pnl: rows.reduce((a, r) => a + (r.pnl || 0), 0),
      ret: rows.reduce((a, r) => a + (r.retPct || 0), 0),
    };
  }, [rows]);
  const dt = (ms) => {
    if (!ms) return { d: "—", t: "" };
    const x = new Date(ms);
    return { d: x.toLocaleDateString("en-GB"), t: x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
  };
  const exportCsv = () => {
    const cols = [
      ["#", (r, i) => i + 1], ["Symbol", (r) => r.sym || ""],
      ["Entry Date", (r) => dt(r.entryTime).d], ["Entry Time", (r) => dt(r.entryTime).t],
      ["Exit Date", (r) => dt(r.exitTime).d], ["Exit Time", (r) => dt(r.exitTime).t],
      ["Exit Type", (r) => r.reason || ""],
      ["Return %", (r) => ((r.retPct || 0) >= 0 ? "+" : "") + (r.retPct || 0).toFixed(2)],
      ["P&L", (r) => (r.pnl == null ? "" : r.pnl.toFixed(2))],
    ];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc(c[0])).join(",")];
    rows.forEach((r, i) => lines.push(cols.map((c) => esc(c[1](r, i))).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trades-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  if (!open) return null;
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  const sCell = (label, val, color) => (
    <div style={{ flex: "1 1 auto", minWidth: 60, background: "var(--elev)", borderRadius: 9, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 12, color: color || "var(--ink)", marginTop: 2 }}>{val}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "var(--elev)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ink)" }}>List of Trades</span>
        <select value={range} onChange={(e) => setRange(e.target.value)}
          style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 8, padding: "5px 8px", background: "var(--surface)", color: "var(--ink)" }}>
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="1y">Last 1 year</option>
        </select>
        <button onClick={exportCsv} disabled={!rows.length} className="tap"
          style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 10.5, opacity: rows.length ? 1 : 0.5 }}>
          ⬇ CSV
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "9px 10px", flexWrap: "wrap", borderTop: "1px solid var(--line)" }}>
        {sCell("Trades", sum.n)}
        {sCell("Win rate", sum.winRate == null ? "—" : sum.winRate.toFixed(0) + "%")}
        {sCell("SL hit", sum.slHit, "var(--down)")}
        {sCell("TP hit", sum.tpHit, "var(--up)")}
        {sCell("P&L", (sum.pnl >= 0 ? "+" : "") + fmt(sum.pnl, market), chgColor(sum.pnl))}
        {sCell("Return", (sum.ret >= 0 ? "+" : "") + sum.ret.toFixed(1) + "%", chgColor(sum.ret))}
      </div>
      {rows.length ? (
        <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", borderTop: "1px solid var(--line)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={th}>#</th><th style={th}>Entry</th><th style={th}>Exit</th><th style={th}>Exit type</th>
                <th style={{ ...th, textAlign: "right" }}>Return</th>
                <th style={{ ...th, textAlign: "right" }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const e = dt(r.entryTime), x = dt(r.exitTime);
                return (
                  <tr key={i}>
                    <td style={{ ...td, color: "var(--muted)" }}>{i + 1}</td>
                    <td style={td}><span style={{ fontWeight: 800 }}>{e.d}</span> <span style={{ color: "var(--muted)" }}>{e.t}</span></td>
                    <td style={td}><span style={{ fontWeight: 800 }}>{x.d}</span> <span style={{ color: "var(--muted)" }}>{x.t}</span></td>
                    <td style={{ ...td, color: "var(--muted)" }}>{r.reason || "—"}</td>
                    <td style={{ ...td, textAlign: "right", color: (r.retPct || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{((r.retPct || 0) >= 0 ? "+" : "") + (r.retPct || 0).toFixed(2)}%</td>
                    <td style={{ ...td, textAlign: "right", color: (r.pnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{r.pnl == null ? "—" : (r.pnl >= 0 ? "+" : "") + fmt(r.pnl, market)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--muted)", padding: "12px 10px", borderTop: "1px solid var(--line)" }}>No trades in this range.</div>
      )}
    </div>
  );
}

function SampleStrategyCard({ s, onActivate, onClone, onEdit, onPersist, market = "IN", canBacktest = true, onConnect }) {
  const { loading, stats } = useBacktestStats(s);
  const [bt, setBt] = useState(false);
  const [size, setSize] = useState(((s.symbols && marketOf(s.symbols[0])) === "Crypto" || market === "Crypto") ? 200 : 1);
  const [sl, setSl] = useState(String((s.cfg && s.cfg.sl) || "0.5"));
  const [tp, setTp] = useState(String((s.cfg && s.cfg.tp) || "1.5"));
  const relSym0 = (s.symbols || []).find((x) => marketOf(x) === market) || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols && s.symbols[0]) || null;
  const [symSel, setSymSel] = useState(relSym0);
  const [tfSel, setTfSel] = useState((s.tf) || (s.cfg && s.cfg.tf) || "5m");
  const [showEdit, setShowEdit] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  useEffect(() => { setSymSel(relSym0); /* eslint-disable-next-line */ }, [relSym0]);
  const cfgTf = useMemo(() => ({ ...(s.cfg || {}), tf: tfSel, defs: ((s.cfg && s.cfg.defs) || []).map((d) => ({ ...d, tf: tfSel })) }), [s.cfg, tfSel]);
  // Persist SL/TP/symbol/timeframe changes to the user's own copy so they survive the session.
  const firstRef = useRef(true);
  useEffect(() => { if (firstRef.current) { firstRef.current = false; return; } onPersist && onPersist(s.id, { sl, tp, symbol: symSel, tf: tfSel }); /* eslint-disable-next-line */ }, [sl, tp, symSel, tfSel]);

  const Stat = ({ k, v, c }) => (
    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>Created by {creatorOf(s)} · {(s.symbols || []).join(" · ")}</div>
        </div>
        <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--primary-soft)", color: "var(--primary)", flex: "0 0 auto" }}>SAMPLE</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Backtesting on real prices…</div>
      ) : !stats ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Data currently unavailable</div>
      ) : stats.trades === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
          This strategy did not trigger a single trade over {btPeriodStr(stats)} of {stats.tf || "5m"} candles. That is a real result, not missing data.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Stat k="WIN RATE" v={stats.winRate.toFixed(0) + "%"} />
            <button type="button" onClick={() => setShowTrades((v) => !v)} className="tap" title="Tap to see the list of trades"
              style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", background: "var(--elev)", borderRadius: 11, padding: "9px 10px", border: "1px solid " + (showTrades ? "var(--primary)" : "var(--line)") }}>
              <div style={{ fontSize: 9, color: "var(--primary)", fontWeight: 800, letterSpacing: ".03em", display: "flex", alignItems: "center", gap: 3 }}>
                TRADES <ChevronDown size={9} style={{ transform: showTrades ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: "var(--ink)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{stats.trades}</div>
            </button>
            <Stat k="P&L" v={(stats.pnl >= 0 ? "+" : "") + fmt(stats.pnl, market)} c={chgColor(stats.pnl)} />
            <Stat k="RETURN" v={pct(stats.retPct, 1)} c={chgColor(stats.retPct)} />
            <Stat k="MAX DD" v={stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—"} c={stats.maxDD > 0 ? "var(--down)" : "var(--muted)"} />
          </div>
          <CardTradeLog tradeList={stats.tradeList} market={market} open={showTrades} />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
            Backtested on {btPeriodStr(stats)} of real {stats.tf || "5m"} candles across {stats.symbols} symbol{stats.symbols === 1 ? "" : "s"}.
            {stats.trades < 10 && " That is a thin sample — treat it as weak evidence."}
            {" "}A backtest is scored with hindsight; it is not a forecast.
          </div>
        </>
      )}

      <DeploySizeField market={market} value={size} onChange={setSize} />
      <StratSLTP sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardIndicatorOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} onApply={(defs, newTf) => { onPersist && onPersist(s.id, { defs, tf: newTf }); setTfSel(newTf); }} />

      {/* User edit — Symbol + Timeframe. */}
      <button onClick={() => setShowEdit((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: showEdit ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>
        <SlidersHorizontal size={13} /> {showEdit ? "Hide" : "Change Symbol/Timeframe"}
      </button>
      {showEdit && <CardSymTfPanel market={market} sym={symSel} setSym={setSymSel} tf={tfSel} setTf={setTfSel} />}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setBt((v) => !v)}
          className="tap disp"
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: bt ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
        >
          <Activity size={14} /> Test
        </button>
        {onClone && (
          <button onClick={() => onClone(s)} className="tap disp"
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            <Copy size={14} /> Clone
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(s)} className="tap disp" title="Edit rules & indicators (admin)" aria-label="Edit rules"
            style={{ flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
            <Pencil size={15} />
          </button>
        )}
        {onActivate && (
          <button onClick={() => onActivate(s, size, { sl, tp, tf: tfSel, symbol: symSel })} className="tap disp"
            style={{ flex: "1 1 120px", minWidth: 110, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>
            Use
          </button>
        )}
      </div>

      {bt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={cfgTf} defaultSym={symSel || undefined} defaultTf={tfSel} blocked={!canBacktest} onConnect={onConnect} />
        </div>
      )}
    </div>
  );
}

/* Premium strategy card — locked. Shows only the name + a short description, with a
   backtest and an activate toggle. No rules are revealed and it cannot be edited or
   copied as a template. */
function PremiumStrategyCard({ s, active, onToggle, onEdit, onPersist, onClone, market = "IN", canBacktest = true, onConnect }) {
  const { loading, stats } = useBacktestStats(s);
  const [bt, setBt] = useState(false);
  const [size, setSize] = useState(((s.symbols && marketOf(s.symbols[0])) === "Crypto" || market === "Crypto") ? 200 : 1);
  const [sl, setSl] = useState(String((s.cfg && s.cfg.sl) || "0.5"));
  const [tp, setTp] = useState(String((s.cfg && s.cfg.tp) || "1.5"));
  /* Show a symbol relevant to the CURRENT market. Premium strategies are shared across
     markets, so under Crypto we surface a crypto symbol, not the Indian one they were saved
     with. Fall back to the first symbol of this market's universe. */
  const relSyms = (s.symbols || []).filter((x) => marketOf(x) === market);
  const relSym = relSyms[0] || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols && s.symbols[0]) || null;
  const shownSyms = relSyms.length ? relSyms : (relSym ? [relSym] : []);
  // User-editable symbol + timeframe. The timeframe re-times every indicator in the cfg used for
  // backtest / optimise / deploy.
  const [symSel, setSymSel] = useState(relSym);
  const [tfSel, setTfSel] = useState((s.tf) || (s.cfg && s.cfg.tf) || "5m");
  const [showEdit, setShowEdit] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  useEffect(() => { setSymSel(relSym); /* eslint-disable-next-line */ }, [relSym]);
  const cfgTf = useMemo(() => ({ ...(s.cfg || {}), tf: tfSel, defs: ((s.cfg && s.cfg.defs) || []).map((d) => ({ ...d, tf: tfSel })) }), [s.cfg, tfSel]);
  // Persist SL/TP/symbol/timeframe edits to the user's own copy so they survive the session.
  const firstRef = useRef(true);
  useEffect(() => { if (firstRef.current) { firstRef.current = false; return; } onPersist && onPersist(s.id, { sl, tp, symbol: symSel, tf: tfSel }); /* eslint-disable-next-line */ }, [sl, tp, symSel, tfSel]);

  const Stat = ({ k, v, c }) => (
    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>Created by {creatorOf(s)}{shownSyms.length ? " · " + shownSyms.join(" · ") : ""}</div>
          {s.desc && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{s.desc}</div>}
        </div>
        <span className="pill gold-border" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 9px", color: "var(--gold)", flex: "0 0 auto", whiteSpace: "nowrap" }}>★ PREMIUM</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Backtesting on real prices…</div>
      ) : stats && stats.trades > 0 ? (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Stat k="WIN RATE" v={stats.winRate.toFixed(0) + "%"} />
            <button type="button" onClick={() => setShowTrades((v) => !v)} className="tap" title="Tap to see the list of trades"
              style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", background: "var(--elev)", borderRadius: 11, padding: "9px 10px", border: "1px solid " + (showTrades ? "var(--primary)" : "var(--line)") }}>
              <div style={{ fontSize: 9, color: "var(--primary)", fontWeight: 800, letterSpacing: ".03em", display: "flex", alignItems: "center", gap: 3 }}>
                TRADES <ChevronDown size={9} style={{ transform: showTrades ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: "var(--ink)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{stats.trades}</div>
            </button>
            <Stat k="RETURN" v={pct(stats.retPct, 1)} c={chgColor(stats.retPct)} />
            <Stat k="MAX DD" v={stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—"} c={stats.maxDD > 0 ? "var(--down)" : "var(--muted)"} />
          </div>
          <CardTradeLog tradeList={stats.tradeList} market={market} open={showTrades} />
        </>
      ) : null}

      <DeploySizeField market={market} value={size} onChange={setSize} />
      <StratSLTP sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardIndicatorOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} onApply={(defs, newTf) => { onPersist && onPersist(s.id, { defs, tf: newTf }); setTfSel(newTf); }} />

      {/* User edit — Symbol + Timeframe (rules stay hidden; admin edits rules via the pencil below). */}
      <button onClick={() => setShowEdit((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: showEdit ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>
        <SlidersHorizontal size={13} /> {showEdit ? "Hide" : "Change Symbol/Timeframe"}
      </button>
      {showEdit && <CardSymTfPanel market={market} sym={symSel} setSym={setSymSel} tf={tfSel} setTf={setTfSel} />}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setBt((v) => !v)}
          className="tap disp"
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: bt ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
        >
          <Activity size={14} /> Backtest
        </button>
        {onClone && (
          <button onClick={() => onClone(s)} className="tap disp" title="Make an editable copy (rules stay locked)"
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            <Copy size={14} /> Clone
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(s)} className="tap disp" title="Edit rules & indicators (admin)" aria-label="Edit rules"
            style={{ flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 11, padding: "10px 12px", cursor: "pointer" }}>
            <Pencil size={15} />
          </button>
        )}
        <button
          onClick={() => onToggle(symSel, size, { sl, tp, tf: tfSel })}
          className="tap disp"
          style={{ flex: "1 1 120px", minWidth: 110, border: "1px solid " + (active ? "var(--up)" : "var(--primary)"), background: active ? "var(--up-soft)" : "var(--primary)", color: active ? "var(--up)" : "var(--on-primary)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {active ? "✓ Activated" : "Activate"}
        </button>
      </div>

      {bt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={cfgTf} defaultSym={symSel || undefined} defaultTf={tfSel} blocked={!canBacktest} onConnect={onConnect} />
        </div>
      )}
    </div>
  );
}

/* Manager for strategies armed for real-money auto-buy — filtered to the CURRENT market,
   with each strategy's name, live P&L, and pause/cancel. An admin can flip the whole engine
   between LIVE and DRY-RUN here (no server env change needed). */
/* Inline SL/TP editor for a live position — two small inputs and a Save that appears only when a value
   changed. Used by both the Real Live and Virtual Live rows. */
function SlTpEditor({ sl, tp, onSave }) {
  const [s, setS] = useState(sl != null ? String(sl) : "");
  const [t, setT] = useState(tp != null ? String(tp) : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setS(sl != null ? String(sl) : ""); setT(tp != null ? String(tp) : ""); }, [sl, tp]);
  const dirty = String(sl == null ? "" : sl) !== s || String(tp == null ? "" : tp) !== t;
  const box = { width: 42, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 6, padding: "3px 2px", fontWeight: 800, fontSize: 10.5, color: "var(--ink)" };
  const save = async () => { setSaving(true); try { await onSave({ sl: s === "" ? 0 : Number(s), tp: t === "" ? 0 : Number(t) }); } finally { setSaving(false); } };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
      <input value={s} onChange={(e) => setS(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={box} aria-label="Stop loss %" />
      <span style={{ fontSize: 8.5, color: "var(--down)", fontWeight: 800 }}>% SL</span>
      <input value={t} onChange={(e) => setT(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={box} aria-label="Take profit %" />
      <span style={{ fontSize: 8.5, color: "var(--up)", fontWeight: 800 }}>% TP</span>
      {dirty && <button onClick={save} disabled={saving} className="tap" style={{ border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 6, padding: "3px 8px", fontSize: 9, fontWeight: 800 }}>{saving ? "…" : "Save"}</button>}
    </div>
  );
}

function LiveAutoBuys({ userId, market = "IN", isAdmin = false, adminKey = "" }) {
  const [data, setData] = useState({ strategies: [], engineLive: false });
  const [busy, setBusy] = useState(false);
  const refresh = () => { if (userId) loadAutoBuys(userId).then(setData); };
  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [userId]);
  // Only strategies for the market you're on (a crypto auto-buy doesn't show under Indian) AND that
  // actually hold a LIVE position right now — "Live" means in a FILLED trade, not merely armed and
  // waiting. Matching the Virtual "Live" (open>0), we require a real fill, since the server's
  // `inPosition` flag alone was surfacing every armed strategy here.
  const holdsPosition = (s) => s.inPosition && (s.lastOrderStatus === "filled" || s.lastOrderStatus === "partial");
  const live = (data.strategies || []).filter((s) => (s.status === "active" || s.status === "paused") && (s.market || "Crypto") === market && holdsPosition(s));
  if (!userId || !live.length) return null;
  const doPause = async (s) => {
    const nowActive = s.status === "active";
    // Optimistic: flip the row immediately so Pause/Start responds instantly, then confirm with the server.
    setData((d) => ({ ...d, strategies: (d.strategies || []).map((x) => x.id === s.id ? { ...x, status: nowActive ? "paused" : "active" } : x) }));
    await pauseAutoBuy(userId, s.id, nowActive);
    refresh();
  };
  const doCancel = async (s) => {
    setData((d) => ({ ...d, strategies: (d.strategies || []).filter((x) => x.id !== s.id) }));   // optimistic remove
    await cancelAutoBuy(userId, s.id);
    refresh();
  };
  /* Stop = CLOSE the position now: a reduce-only market SELL that flattens it at the broker, then stops
     the strategy. Real money moves, so we confirm first. */
  const doClose = async (s) => {
    if (typeof window !== "undefined" && !window.confirm(`Close ${s.name || s.symbol} now?\n\nThis places a market SELL to flatten the position at ${s.broker}. This cannot be undone.`)) return;
    setData((d) => ({ ...d, strategies: (d.strategies || []).map((x) => x.id === s.id ? { ...x, inPosition: false, status: "cancelled" } : x) }));
    try { const r = await closeAutoBuy(userId, s.id); if (r && r.dryRun) alert("Engine is in dry-run — position marked closed, no real order was placed."); }
    catch (e) { alert(String(e.message || e)); }
    refresh();
  };
  /* Persist a new SL/TP to the strategy AND its open managed position (exit engine acts on it). */
  const doUpdate = async (s, { sl, tp }) => {
    setData((d) => ({ ...d, strategies: (d.strategies || []).map((x) => x.id === s.id ? { ...x, sl, tp } : x) }));
    try { await updateAutoBuy(userId, s.id, { sl, tp }); } catch (e) { alert(String(e.message || e)); }
    refresh();
  };
  const toggleLive = async () => {
    if (!isAdmin || !adminKey) return;
    setBusy(true);
    await setAutoBuyLive(adminKey, !data.engineLive);
    setBusy(false); refresh();
  };
  const ccy = market === "Crypto" || market === "US" ? "$" : "₹";
  /* Newest ENTRY SIGNAL first — a strategy that just filled/fired sits at the top. Fall back
     through the timestamps the server may carry so ordering is stable even for older rows. */
  const sigAt = (s) => s.filledAt || s.lastFillAt || s.lastEntryAt || s.lastSignalAt || s.entryAt || s.updatedAt || s.createdAt || 0;
  /* STATUS ORDER — filled first, then rejected, then a recent exit, then everything waiting.
       0 Entry triggered · Order filled   1 Entry triggered · Order rejected
       2 Exit triggered (exited in the last 60 min)   3 Waiting for entry */
  const exitedRecently = (s) => { const t = s.lastExitAt || s.exitAt || 0; return t && (Date.now() - t) < 60 * 60 * 1000; };
  const statusRank = (s) => (s.lastOrderStatus === "filled" && s.inPosition) ? 0 : s.lastOrderStatus === "rejected" ? 1 : exitedRecently(s) ? 2 : 3;
  const liveSorted = [...live].sort((a, b) => statusRank(a) - statusRank(b) || sigAt(b) - sigAt(a));
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12, border: "1px solid var(--down)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Bolt size={15} color="var(--down)" />
        <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Real Live</div>
        {isAdmin && adminKey
          ? <button onClick={toggleLive} disabled={busy} className="tap disp" style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, padding: "4px 10px", borderRadius: 999, border: "1px solid " + (data.engineLive ? "var(--down)" : "var(--line)"), background: data.engineLive ? "var(--down-soft)" : "var(--elev)", color: data.engineLive ? "var(--down)" : "var(--muted)" }}>{busy ? "…" : (data.engineLive ? "● TRADING LIVE — tap to pause" : "DRY-RUN — tap to GO LIVE")}</button>
          : <span className="pill" style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, padding: "3px 8px", background: data.engineLive ? "var(--down-soft)" : "var(--elev)", color: data.engineLive ? "var(--down)" : "var(--muted)" }}>{data.engineLive ? "TRADING LIVE" : "DRY-RUN"}</span>}
      </div>
      {!data.engineLive && <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>{isAdmin ? "Dry-run — logs entries but places no real orders. Tap the badge above to go live." : "Engine is in dry-run — logs entries but places no real orders yet."}</div>}
      <CollapsibleList items={liveSorted} initial={5} reverse={false} render={(s) => {
        /* A position is only REALLY open when the broker actually FILLED the order. An order can
           be accepted then rejected (e.g. insufficient balance) — in that case there is no position
           and so no P&L. We show live P&L (and % return) ONLY when truly filled; otherwise P&L is 0
           and the row shows the real order status instead of a phantom number. */
        const filled = s.lastOrderStatus === "filled" && s.inPosition;
        const pnl = filled ? (s.livePnl || 0) : 0;
        const retPct = filled && s.notional ? (pnl / s.notional) * 100 : null;
        const placed = ["pending", "open", "accepted", "working"].includes(s.lastOrderStatus);
        const exited = !filled && s.lastOrderStatus !== "rejected" && !placed && exitedRecently(s);
        return (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{s.name || s.symbol} {s.status === "paused" && <span style={{ color: "var(--muted)", fontWeight: 700 }}>· paused</span>}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{s.symbol} · {s.broker}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{ccy}{s.notional} / trade</div>
            {/* Editable SL/TP — persisted to the strategy + its open position (exit engine acts on it). */}
            <SlTpEditor sl={s.sl} tp={s.tp} onSave={(v) => doUpdate(s, v)} />
            {/* Order status of the last attempt — a rejected order shows WHY (e.g. insufficient
                balance), so it's never mistaken for a silent no-op. */}
            {s.lastOrderStatus === "rejected" && (
              <div style={{ fontSize: 10, color: "var(--down)", fontWeight: 700, marginTop: 3, lineHeight: 1.4 }}>⚠ Entry triggered · Order rejected{s.lastError ? ` — ${s.lastError}` : ""}</div>
            )}
            {s.lastOrderStatus === "partial" && (
              <div style={{ fontSize: 10, color: "#B87514", fontWeight: 700, marginTop: 3 }}>◑ Partially filled{s.lastError ? ` — ${s.lastError}` : ""}</div>
            )}
            {filled && (
              <div style={{ fontSize: 9.5, color: "var(--up)", fontWeight: 700, marginTop: 3 }}>● Entry triggered · Order filled</div>
            )}
            {!filled && placed && (
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, marginTop: 3 }}>◔ Order placed — awaiting fill</div>
            )}
            {exited && (
              <div style={{ fontSize: 9.5, color: "var(--primary)", fontWeight: 700, marginTop: 3 }}>↩ Exit triggered</div>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {filled
              ? <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: pnl >= 0 ? "var(--up)" : "var(--down)" }}>{pnl >= 0 ? "+" : ""}{ccy}{Math.abs(pnl).toFixed(2)}</div>
                  {retPct != null && <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: pnl >= 0 ? "var(--up)" : "var(--down)" }}>{retPct >= 0 ? "+" : ""}{retPct.toFixed(2)}%</div>}
                </div>
              : s.lastOrderStatus === "rejected"
                ? <div style={{ textAlign: "right" }}><div style={{ fontSize: 9.5, color: "var(--down)", fontWeight: 800 }}>rejected</div><div className="mono" style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)" }}>{ccy}0.00</div></div>
                : placed
                  ? <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>awaiting fill</div>
                  : exited
                    ? <div style={{ fontSize: 9.5, color: "var(--primary)", fontWeight: 800 }}>exited</div>
                    : <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }} title="Buys automatically when your entry rule fires on live candles.">waiting for entry</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", justifyContent: "flex-end" }}>
              <button onClick={() => doPause(s)} className="tap" style={{ flex: "0 0 auto", whiteSpace: "nowrap", border: "1px solid " + (s.status === "active" ? "var(--line)" : "var(--up)"), background: s.status === "active" ? "transparent" : "var(--up-soft)", color: s.status === "active" ? "var(--muted)" : "var(--up)", borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 800 }}>{s.status === "active" ? "❚❚ Pause" : "▶ Start"}</button>
              <button onClick={() => doClose(s)} className="tap" title="Close the position now (market sell) and stop the strategy" style={{ flex: "0 0 auto", whiteSpace: "nowrap", border: "1px solid var(--down)", background: "var(--down-soft)", color: "var(--down)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 2 }}><X size={10} /> Stop &amp; sell</button>
            </div>
          </div>
        </div>
        );
      }} />
    </div>
  );
}

/* Renders a list of deployed strategies newest-first, collapsed to the latest few with a
   "Show all" toggle so a long deployment history doesn't fill the whole screen. */
function CollapsibleList({ items, render, initial = 3, reverse = true }) {
  const [open, setOpen] = useState(false);
  const ordered = reverse ? [...items].reverse() : [...items];
  const shown = open ? ordered : ordered.slice(0, initial);
  return (
    <>
      {shown.map(render)}
      {ordered.length > initial && (
        <button onClick={() => setOpen((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 2, marginBottom: 12, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 11, padding: "10px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
          {open ? "Show less" : `Show all (${ordered.length})`}
        </button>
      )}
    </>
  );
}

/* MY COPIES card — a user's editable copy of a Premium strategy. Rules & indicators are HIDDEN
   (locked); the user can rename it, change symbol / timeframe / SL / TP, optimise, deploy and delete. */
function CopyStrategyCard({ s, active, onToggle, onPersist, onDelete, market = "IN", canBacktest = true, onConnect }) {
  const { loading, stats } = useBacktestStats(s);
  const [bt, setBt] = useState(false);
  const [name, setName] = useState(s.name || "");
  const [size, setSize] = useState(s.qty != null ? s.qty : (market === "Crypto" ? 200 : 1));
  const [sl, setSl] = useState(String((s.cfg && s.cfg.sl) || "0.5"));
  const [tp, setTp] = useState(String((s.cfg && s.cfg.tp) || "1.5"));
  const relSym0 = (s.symbols || []).find((x) => marketOf(x) === market) || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols && s.symbols[0]) || null;
  const [symSel, setSymSel] = useState(relSym0);
  const [tfSel, setTfSel] = useState((s.tf) || (s.cfg && s.cfg.tf) || "5m");
  const [showEdit, setShowEdit] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const cfgTf = useMemo(() => ({ ...(s.cfg || {}), tf: tfSel, defs: ((s.cfg && s.cfg.defs) || []).map((d) => ({ ...d, tf: tfSel })) }), [s.cfg, tfSel]);
  const firstRef = useRef(true);
  useEffect(() => { if (firstRef.current) { firstRef.current = false; return; } onPersist && onPersist(s.id, { name: name.trim() || s.name, sl, tp, symbol: symSel, tf: tfSel }); /* eslint-disable-next-line */ }, [name, sl, tp, symSel, tfSel]);
  const Stat = ({ k, v, c }) => (
    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Copy name" className="no-ring disp" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "7px 9px", fontSize: 13.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Copy of {s.sourceName || "a premium strategy"} · rules locked</div>
        </div>
        <div style={{ display: "flex", gap: 6, flex: "0 0 auto", alignItems: "center" }}>
          <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--elev)", color: "var(--primary)", border: "1px solid var(--line)" }}>COPY</span>
          {onDelete && <button onClick={() => onDelete(s)} className="tap" title="Delete copy" style={{ border: "none", background: "transparent", padding: 2 }}><Trash2 size={15} color="var(--down)" /></button>}
        </div>
      </div>

      {loading ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Backtesting on real prices…</div>
        : stats && stats.trades > 0 ? (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Stat k="WIN RATE" v={stats.winRate.toFixed(0) + "%"} />
              <button type="button" onClick={() => setShowTrades((v) => !v)} className="tap" title="Tap to see the list of trades"
                style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", background: "var(--elev)", borderRadius: 11, padding: "9px 10px", border: "1px solid " + (showTrades ? "var(--primary)" : "var(--line)") }}>
                <div style={{ fontSize: 9, color: "var(--primary)", fontWeight: 800, letterSpacing: ".03em", display: "flex", alignItems: "center", gap: 3 }}>
                  TRADES <ChevronDown size={9} style={{ transform: showTrades ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, marginTop: 3, color: "var(--ink)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{stats.trades}</div>
              </button>
              <Stat k="RETURN" v={pct(stats.retPct, 1)} c={chgColor(stats.retPct)} />
              <Stat k="MAX DD" v={stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—"} c={stats.maxDD > 0 ? "var(--down)" : "var(--muted)"} />
            </div>
            <CardTradeLog tradeList={stats.tradeList} market={market} open={showTrades} />
          </>
        ) : null}

      <DeploySizeField market={market} value={size} onChange={setSize} />
      <StratSLTP sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} setSl={setSl} setTp={setTp} />
      <CardIndicatorOptimizeButton cfg={cfgTf} sym={symSel} tf={tfSel} sl={sl} tp={tp} onApply={(defs, newTf) => { onPersist && onPersist(s.id, { defs, tf: newTf }); setTfSel(newTf); }} />

      <button onClick={() => setShowEdit((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: showEdit ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>
        <SlidersHorizontal size={13} /> {showEdit ? "Hide" : "Change Symbol/Timeframe"}
      </button>
      {showEdit && <CardSymTfPanel market={market} sym={symSel} setSym={setSymSel} tf={tfSel} setTf={setTfSel} />}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => setBt((v) => !v)} className="tap disp" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: bt ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12 }}>
          <Activity size={14} /> Backtest
        </button>
        <button onClick={() => onToggle(symSel, size, { sl, tp, tf: tfSel })} className="tap disp" style={{ flex: "1 1 120px", minWidth: 110, border: "1px solid " + (active ? "var(--up)" : "var(--primary)"), background: active ? "var(--up-soft)" : "var(--primary)", color: active ? "var(--up)" : "var(--on-primary)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap" }}>
          {active ? "✓ Deployed" : "Deploy"}
        </button>
      </div>

      {bt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={cfgTf} defaultSym={symSel || undefined} defaultTf={tfSel} blocked={!canBacktest} onConnect={onConnect} />
        </div>
      )}
    </div>
  );
}

/* One row of the strategy-comparison table. Reuses useBacktestStats — the SAME hook the premium
   cards use — so opening the table doesn't fire a fresh burst of history requests (results are
   already cached from the cards). Columns: trades / wins / losses / target-hits / SL-hits / return. */
function CompareRow({ s, td, opts, onReport, market = "IN", sym, onCreateCopy, copyExists, isActive, onToggleActive, bucket }) {
  const { loading, stats } = useBacktestStats(s, opts);
  const [open, setOpen] = useState(false);
  // Report finished stats up to the panel so it can export the whole table to CSV.
  useEffect(() => { if (onReport && !loading) onReport(s.name, stats); /* eslint-disable-next-line */ }, [loading, stats]);
  const c = (v) => ({ ...td, color: v >= 0 ? "var(--up)" : "var(--down)" });
  const canExpand = !loading && stats && stats.trades > 0 && (stats.tradeList || []).length > 0;
  const active = isActive ? isActive(s) : !!s.active;
  const created = !!(copyExists && sym && copyExists(s, sym));   // a copy for this symbol already exists
  return (
    <>
      <tr onClick={canExpand ? () => setOpen((v) => !v) : undefined} style={{ cursor: canExpand ? "pointer" : "default" }}>
        <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span>{canExpand && <span style={{ display: "inline-block", width: 12, color: "var(--muted)", fontSize: 9 }}>{open ? "▾" : "▸"}</span>} {s.name}</span>
            {/* NEW bucket → Create this strategy for the selected symbol (under My Copies).
                EXISTING bucket → Activate / Deactivate it. */}
            {bucket === "new" && onCreateCopy && sym ? (
              created
                ? <span className="pill" style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, padding: "3px 9px", background: "var(--up-soft, rgba(16,185,129,.12))", color: "var(--up)" }}>✓ Created</span>
                : <button onClick={(e) => { e.stopPropagation(); onCreateCopy(s, sym); }} className="tap disp" style={{ flexShrink: 0, border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 999, padding: "3px 10px", fontSize: 9.5, fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={11} /> Create</button>
            ) : (bucket !== "new" && onToggleActive && (
              <button onClick={(e) => { e.stopPropagation(); onToggleActive(s); }} className="tap disp" style={{
                flexShrink: 0, border: "1px solid " + (active ? "var(--down)" : "var(--up)"),
                background: active ? "var(--down-soft, rgba(232,72,85,.12))" : "var(--up-soft, rgba(16,185,129,.12))",
                color: active ? "var(--down)" : "var(--up)", borderRadius: 999, padding: "3px 10px", fontSize: 9.5, fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer",
              }}>{active ? "Deactivate" : "Activate"}</button>
            ))}
          </div>
        </td>
        {loading ? <td style={{ ...td, color: "var(--muted)" }} colSpan={9}>backtesting…</td>
          : !stats || !stats.trades ? <td style={{ ...td, color: "var(--muted)" }} colSpan={9}>{stats ? "no trades" : "no data"}</td>
          : <>
              <td style={td}>{stats.trades}</td>
              <td style={c(stats.pnl)}>{stats.pnl == null ? "—" : (stats.pnl >= 0 ? "+" : "") + fmt(stats.pnl, market)}</td>
              <td style={c(stats.retPct)}>{(stats.retPct >= 0 ? "+" : "") + (stats.retPct || 0).toFixed(1)}%</td>
              <td style={{ ...td, color: "var(--up)" }}>{stats.wins}</td>
              <td style={{ ...td, color: "var(--down)" }}>{stats.losses}</td>
              <td style={{ ...td, color: (stats.winRate ?? 0) >= 50 ? "var(--up)" : "var(--down)" }}>{stats.winRate != null ? stats.winRate.toFixed(0) + "%" : "—"}</td>
              <td style={{ ...td, color: "var(--up)" }}>{stats.tpHit}</td>
              <td style={{ ...td, color: "var(--down)" }}>{stats.slHit}</td>
              <td style={{ ...td, color: stats.maxDD > 0 ? "var(--down)" : "var(--muted)" }}>{stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—"}</td>
            </>}
      </tr>
      {open && canExpand && (
        <tr><td colSpan={10} style={{ padding: "0 8px 12px", background: "var(--elev)" }}>
          <TradeLog trades={stats.tradeList} market={market} />
        </td></tr>
      )}
    </>
  );
}
function ComparisonTable({ strats, market = "IN" }) {
  if (!strats.length) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No strategies to compare for this market.</div>;
  const th = { fontSize: 9, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", padding: "7px 5px", textAlign: "center", whiteSpace: "nowrap" };
  const td = { fontSize: 11.5, fontWeight: 700, padding: "8px 5px", textAlign: "center", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  return (
    <div className="card" style={{ padding: "6px 10px", marginBottom: 12, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 440 }}>
        <thead><tr>
          <th style={{ ...th, textAlign: "left" }}>Strategy</th>
          <th style={th}>Trades</th><th style={th}>Wins</th><th style={th}>Loss</th><th style={th}>Win %</th>
          <th style={th}>Target</th><th style={th}>SL Hit</th><th style={th}>Return</th><th style={th}>P&amp;L</th><th style={th}>Max DD</th>
        </tr></thead>
        <tbody>{strats.map((s) => <CompareRow key={s.id} s={s} td={td} market={market} />)}</tbody>
      </table>
    </div>
  );
}

/* One row per SYMBOL for a FIXED strategy (the "Per Strategy" view — the transpose of CompareRow).
   Reuses the exact same useBacktestStats hook, overriding the symbol. */
function SymbolRow({ strat, sym, td, opts, onReport, market = "IN", onCreateCopy, copyExists }) {
  const { loading, stats } = useBacktestStats(strat, { ...opts, sym });
  const [open, setOpen] = useState(false);
  useEffect(() => { if (onReport && !loading) onReport(sym, stats); /* eslint-disable-next-line */ }, [loading, stats]);
  const c = (v) => ({ ...td, color: v >= 0 ? "var(--up)" : "var(--down)" });
  const canExpand = !loading && stats && stats.trades > 0 && (stats.tradeList || []).length > 0;
  return (
    <>
      <tr onClick={canExpand ? () => setOpen((v) => !v) : undefined} style={{ cursor: canExpand ? "pointer" : "default" }}>
        <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
          {canExpand && <span style={{ display: "inline-block", width: 12, color: "var(--muted)", fontSize: 9 }}>{open ? "▾" : "▸"}</span>} {sym}
        </td>
        {loading ? <td style={{ ...td, color: "var(--muted)" }} colSpan={9}>backtesting…</td>
          : !stats || !stats.trades ? <td style={{ ...td, color: "var(--muted)" }} colSpan={9}>{stats ? "no trades" : "no data"}</td>
          : <>
              <td style={td}>{stats.trades}</td>
              <td style={c(stats.pnl)}>{stats.pnl == null ? "—" : (stats.pnl >= 0 ? "+" : "") + fmt(stats.pnl, market)}</td>
              <td style={c(stats.retPct)}>{(stats.retPct >= 0 ? "+" : "") + (stats.retPct || 0).toFixed(1)}%</td>
              <td style={{ ...td, color: "var(--up)" }}>{stats.wins}</td>
              <td style={{ ...td, color: "var(--down)" }}>{stats.losses}</td>
              <td style={{ ...td, color: (stats.winRate ?? 0) >= 50 ? "var(--up)" : "var(--down)" }}>{stats.winRate != null ? stats.winRate.toFixed(0) + "%" : "—"}</td>
              <td style={{ ...td, color: "var(--up)" }}>{stats.tpHit}</td>
              <td style={{ ...td, color: "var(--down)" }}>{stats.slHit}</td>
              <td style={{ ...td, color: stats.maxDD > 0 ? "var(--down)" : "var(--muted)" }}>{stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—"}</td>
            </>}
      </tr>
      {open && canExpand && (
        <tr><td colSpan={10} style={{ padding: "0 8px 12px", background: "var(--elev)" }}>
          {onCreateCopy && sym && (
            copyExists && copyExists(strat, sym)
              ? <div style={{ fontSize: 10, color: "var(--muted)", padding: "8px 2px 0", fontWeight: 700 }}>✓ Saved as “{strat.name} - {sym}” in My Copies.</div>
              : <button onClick={() => onCreateCopy(strat, sym)} className="tap disp" style={{ margin: "8px 0 2px", border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 9, padding: "7px 12px", fontWeight: 800, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Create strategy — {strat.name} - {sym}</button>
          )}
          <TradeLog trades={stats.tradeList} market={market} accent="#0EA5E9" />
        </td></tr>
      )}
    </>
  );
}

/* Backtest → CSV. `results` maps row label → stats (collected as each row finishes). `order` is the
   row order to emit. `labelHeader` is "Strategy" or "Symbol". */
const BT_COLS = ["Trades", "Wins", "Loss", "Win %", "Target", "SL Hit", "Return %", "P&L", "Max DD"];
const csvEsc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
function statCells(st) {
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
function exportBacktestCsv({ results, order, labelHeader, meta, filename }) {
  const lines = [];
  meta.forEach(([k, v]) => lines.push([csvEsc(k), csvEsc(v)].join(",")));
  if (meta.length) lines.push("");
  lines.push([labelHeader, ...BT_COLS].map(csvEsc).join(","));
  order.forEach((label) => lines.push([label, ...statCells(results[label])].map(csvEsc).join(",")));
  downloadCSV(filename, lines.join("\n"));
}

/* PER-STRATEGY ideal SL/TP for ONE symbol (Backtest "Per Symbol" view). For each strategy it
   grid-searches the ideal exits on the selected symbol and shows an Earlier-vs-Now table (win rate,
   SL/TP hits, P&L, return). "Apply all" writes each strategy's ideal back onto its config. */
const oPct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
const oWr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";
const oAmt = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(2);
const oCnt = (x) => (x == null || isNaN(x)) ? "—" : String(x);
/* A strategy "runs on" a symbol only when that symbol is in its configured symbol list. Symbol-agnostic
   strategies (none listed) are treated as universal. Used to scope the Per-Symbol optimiser so SOL-tuned
   SL/TP (or indicators) are only ever applied to the strategies that actually trade SOL — never pushed
   onto every strategy just because they were measured against SOL. */
function stratRunsOnSym(s, sym) {
  const syms = (s && (s.symbols || (s.symbol ? [s.symbol] : []))) || [];
  return syms.length ? syms.includes(sym) : true;
}

/* Segmented objective selector (Win rate | P&L) shared by the per-symbol optimisers. Styled as a
   toggle — a raised chip on a grey track — so it reads as a SELECTOR, not a call-to-action. */
function ObjSelect({ objective, onPick, accent = "#7C3AED" }) {
  const btn = (k, label) => (
    <button key={k} onClick={() => onPick(k)} className="tap" style={{ flex: 1, padding: "6px 12px", fontSize: 10.5, fontWeight: 800, border: "none", borderRadius: 7, cursor: "pointer", background: objective === k ? "var(--surface)" : "transparent", color: objective === k ? accent : "var(--muted)", boxShadow: objective === k ? "0 1px 3px rgba(0,0,0,.14)" : "none" }}>{label}</button>
  );
  return (
    <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, flex: "1 1 150px" }}>
      {btn("winrate", "Win rate")}{btn("pnl", "P&L")}
    </div>
  );
}

/* PER-SYMBOL / PER-STRATEGY exit optimiser. Two modes off the same table:
   • Per Symbol   — many strategies × ONE symbol (pass `strats` + `sym`); one row per strategy.
   • Per Strategy — ONE strategy × many symbols (pass `singleStrat` + `symList`); one row per SYMBOL,
     so you see the ideal SL/TP for EACH selected symbol, not one blended figure. */
function PerSymbolStrategyOptimizer({ strats, sym, tf, onApplyExits, onCreateCopy, copyExists, singleStrat, symList, days = 0, qty = null, amount = null, market = "IN" }) {
  const [objective, setObjective] = useState("pnl");
  const [state, setState] = useState({ loading: false, rows: null, ran: false });
  const [applied, setApplied] = useState(false);
  const [rrMin, setRrMin] = useState(1.5);   // minimum reward/risk floor for the optimiser
  const [maxSl, setMaxSl] = useState(0);     // optional cap: never recommend an SL above this (0 = off)
  const [sel, setSel] = useState(() => new Set());   // rows the user ticked (for bulk apply / create)
  const [view, setView] = useState("all");           // All | Apply (existing only) | Create (new only)
  // Clear stale results whenever the symbol, timeframe, strategy or symbol-set changes (e.g. switching
  // market Crypto → Indian) so old BTC rows don't linger under NIFTY50.
  useEffect(() => { setState({ loading: false, rows: null, ran: false }); setApplied(false); setSel(new Set()); setView("all");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [sym, tf, singleStrat && singleStrat.id, (symList || []).join(","), (strats || []).map((s) => s.id).join(",")]);
  const perStrat = !!singleStrat;            // "one strategy across symbols" mode
  // Build the list of {strategy, symbol} jobs to optimise — one per row.
  const jobs = perStrat
    ? (symList || []).map((sy) => ({ key: sy, name: sy, strat: singleStrat, cfg: singleStrat.cfg || {}, sym: sy }))
    : (strats || []).filter((s) => s.cfg && (s.cfg.entry || []).length > 0).map((s) => ({ key: s.id, name: s.name, strat: s, cfg: s.cfg, sym }));
  const title = perStrat ? `Optimize SL & TP — ${(singleStrat.name || "strategy")}` : `Optimize SL & TP — ${sym}`;
  const firstCol = perStrat ? "Symbol" : "Strategy";
  const run = async (obj = objective) => {
    if (!jobs.length) { setState({ loading: false, ran: true, rows: [] }); return; }
    setApplied(false);
    setState({ loading: true, rows: null, ran: true });
    // Candle cache per symbol so the client-side re-score fetches each symbol's history only once.
    const candleCache = {};
    const sizing = { qty, amount, market };
    const rows = await Promise.all(jobs.map(async (j) => {
      try {
        const res = await optimizeExits({ mode: j.cfg.mode === "metric" ? "metric" : undefined, defs: j.cfg.defs || [], entry: j.cfg.entry, tf, appSyms: [j.sym], currentSl: j.cfg.sl != null ? Number(j.cfg.sl) : null, currentTp: j.cfg.tp != null ? Number(j.cfg.tp) : null, objective: obj, rrMin, maxSl });
        const best = res && res.best ? res.best : null;
        // RE-SCORE Earlier (current cfg) and Now (cfg at the optimum SL/TP) with the SAME backtest
        // engine, sizing and period the results table uses — so the preview lines up with it.
        let current = res ? res.current : null, nowM = best;
        if (candleCache[j.sym] === undefined) candleCache[j.sym] = await loadBtCandles(j.sym, tf, days);
        const candles = candleCache[j.sym];
        if (candles && candles.length >= 30) {
          const cur = scoreCfg(j.cfg, candles, tf, sizing);
          if (cur) current = cur;
          if (best) { const nw = scoreCfg({ ...j.cfg, sl: best.sl, tp: best.tp }, candles, tf, sizing); if (nw) nowM = { ...best, ...nw }; }
        }
        return { j, best: nowM, current };
      } catch { return { j, best: null }; }
    }));
    setState({ loading: false, ran: true, rows });
    setSel(new Set(rows.filter((r) => r.best).map((r) => r.j.key)));   // pre-tick every result row
  };
  const pick = (obj) => { setObjective(obj); if (state.ran && !state.loading) run(obj); };
  const { loading, rows, ran } = state;
  const good = (rows || []).filter((r) => r.best);
  // A row "exists for this symbol" if the strategy already runs on it OR a copy was already saved for
  // it. APPLY only makes sense for those (there's a live strategy to write the SL/TP onto); CREATE only
  // makes sense for the rest (there's nothing yet, so we make a copy).
  // STRICT: a strategy "exists for this symbol" only if the symbol is genuinely in its symbols list (or
  // a copy was saved for it). We deliberately do NOT use stratRunsOnSym here — its "no symbol → matches
  // everything" fallback wrongly tagged symbol-less / other-symbol strategies as EXISTS on BTC.
  const existsForSym = (r) => ((r.j.strat.symbols || []).includes(r.j.sym)) || (copyExists && copyExists(r.j.strat, r.j.sym));
  // The All / Apply / Create tabs filter which rows the table shows: Apply = existing only, Create =
  // new only, All = everything.
  const visible = view === "apply" ? good.filter(existsForSym) : view === "create" ? good.filter((r) => !existsForSym(r)) : good;
  const toggle = (k) => setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allOn = visible.length > 0 && visible.every((r) => sel.has(r.j.key));
  const toggleAll = () => setSel((p) => { const n = new Set(p); if (allOn) visible.forEach((r) => n.delete(r.j.key)); else visible.forEach((r) => n.add(r.j.key)); return n; });
  const chosen = good.filter((r) => sel.has(r.j.key));
  const chosenExisting = chosen.filter(existsForSym);       // Apply targets these
  const chosenMissing = chosen.filter((r) => !existsForSym(r));   // Create targets these
  // Apply the optimised SL/TP only to ticked strategies that ALREADY exist for this symbol.
  const applySelected = () => { chosenExisting.forEach((r) => onApplyExits && onApplyExits(r.j.strat.id, r.best.sl, r.best.tp)); setApplied(true); };
  // Create a new copy only for ticked rows that DON'T yet exist for this symbol.
  const createSelected = () => { chosenMissing.forEach((r) => onCreateCopy && onCreateCopy(r.j.strat, r.j.sym)); };
  const sepL = { borderLeft: "2px solid var(--muted)" };
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 6px", textAlign: "center", whiteSpace: "nowrap" };
  const td = { fontSize: 11, fontWeight: 700, padding: "7px 6px", textAlign: "center", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  const grp = { ...th, background: "var(--elev)", padding: "6px 6px" };
  const metricCells = (m, key) => m ? [
    <td key={key + "w"} style={{ ...td, ...sepL }}>{oWr(m.winRate)}</td>,
    <td key={key + "s"} style={{ ...td, color: "var(--down)" }}>{oCnt(m.slHit)}</td>,
    <td key={key + "t"} style={{ ...td, color: "var(--up)" }}>{oCnt(m.tpHit)}</td>,
    <td key={key + "p"} style={{ ...td, color: (m.pnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{oAmt(m.pnl)}</td>,
    <td key={key + "r"} style={{ ...td, color: (m.retPct || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{oPct(m.retPct)}</td>,
  ] : [<td key={key + "e"} style={{ ...td, ...sepL, color: "var(--muted)" }} colSpan={5}>—</td>];
  return (
    <div style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--elev)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Filled CTA — the button that runs the optimiser. */}
        <button onClick={() => run()} disabled={loading || !jobs.length} className="tap disp" style={{ flex: "1 1 170px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "#7C3AED", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 800, cursor: jobs.length ? "pointer" : "not-allowed", opacity: (loading || !jobs.length) ? 0.6 : 1 }}>
          <Sparkles size={13} /> {loading ? `Optimising ${jobs.length}…` : title}
        </button>
        <ObjSelect objective={objective} onPick={pick} accent="#7C3AED" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}><RRMinSelect value={rrMin} onChange={setRrMin} /><MaxSlSelect value={maxSl} onChange={setMaxSl} /></div>
      {ran && !loading && (good.length === 0
        ? <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>{perStrat ? `Not enough past entry signals for ${singleStrat.name} on the selected symbols.` : `Not enough past entry signals on ${sym} to optimise these strategies.`}</div>
        : <div style={{ marginTop: 10 }}>
            {/* View filter — All shows every result, Apply shows only strategies that already exist for
               the symbol, Create shows only the ones that don't. */}
            <div style={{ display: "inline-flex", gap: 2, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 2, marginBottom: 8 }}>
              {[["all", `All · ${good.length}`], ["apply", `Existing · ${good.filter(existsForSym).length}`], ["create", `Create · ${good.filter((r) => !existsForSym(r)).length}`]].map(([k, lbl]) => (
                <button key={k} onClick={() => setView(k)} className="tap" style={{ border: "none", background: view === k ? "#7C3AED" : "transparent", color: view === k ? "#fff" : "var(--muted)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{lbl}</button>
              ))}
            </div>
            {/* Bulk actions on the TICKED rows — apply the ideal SL/TP to existing strategies, or create copies. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>{view === "apply" ? `${chosenExisting.length} selected` : view === "create" ? `${chosenMissing.length} selected` : `${chosenExisting.length} existing · ${chosenMissing.length} new`}</span>
              {onApplyExits && view === "apply" && <button onClick={applySelected} disabled={!chosenExisting.length || applied} className="tap" title={`Apply the optimised SL/TP to ${chosenExisting.length} strategy(ies) that already exist for ${sym}`} style={{ border: "none", background: applied ? "var(--up)" : "#7C3AED", color: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 800, opacity: (!chosenExisting.length || applied) ? 0.5 : 1 }}>{applied ? "✓ Applied" : `Apply Now · ${chosenExisting.length}`}</button>}
              {onCreateCopy && view === "create" && <button onClick={createSelected} disabled={!chosenMissing.length} className="tap disp" title={`Create ${chosenMissing.length} new copy(ies) for ${sym} that don't exist yet`} style={{ border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5, opacity: !chosenMissing.length ? 0.5 : 1 }}><Plus size={13} /> Create Now · {chosenMissing.length}</button>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 780, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 24 }} rowSpan={2}><input type="checkbox" checked={allOn} onChange={toggleAll} style={{ accentColor: "#7C3AED", width: 14, height: 14 }} /></th>
                    <th style={{ ...th, textAlign: "left" }} rowSpan={2}>{firstCol}</th>
                    <th style={{ ...grp, ...sepL, color: "#7C3AED" }} colSpan={3}>Optimum</th>
                    <th style={{ ...grp, ...sepL, color: "var(--muted)" }} colSpan={5}>Earlier</th>
                    <th style={{ ...grp, ...sepL, color: "var(--primary)" }} colSpan={5}>Now</th>
                  </tr>
                  <tr>
                    <th style={{ ...th, ...sepL, color: "var(--down)" }}>SL</th>
                    <th style={{ ...th, color: "var(--up)" }}>TP</th>
                    <th style={{ ...th, color: "var(--primary)" }}>P&L</th>
                    {["Win", "SL hit", "TP hit", "P&L", "Ret"].map((h, i) => <th key={"e" + h} style={i === 0 ? { ...th, ...sepL } : th}>{h}</th>)}
                    {["Win", "SL hit", "TP hit", "P&L", "Ret"].map((h, i) => <th key={"n" + h} style={i === 0 ? { ...th, ...sepL } : th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && <tr><td colSpan={14} style={{ ...td, color: "var(--muted)", fontWeight: 700, textAlign: "center", padding: "14px 6px" }}>{view === "apply" ? `No strategies exist for ${sym} yet — switch to Create to add some.` : `Every optimised strategy already exists for ${sym}.`}</td></tr>}
                  {visible.map((r) => {
                    const exists = existsForSym(r);
                    return (
                    <tr key={r.j.key}>
                      <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={sel.has(r.j.key)} onChange={() => toggle(r.j.key)} style={{ accentColor: "#7C3AED", width: 14, height: 14 }} /></td>
                      <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
                        {r.j.name}
                        {exists
                          ? <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: "var(--up)", background: "rgba(34,197,94,.12)", borderRadius: 999, padding: "1px 6px", verticalAlign: "middle" }}>EXISTS · {r.j.sym}</span>
                          : <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 6px", verticalAlign: "middle" }}>NEW · {r.j.sym}</span>}
                      </td>
                      <td style={{ ...td, ...sepL, color: "var(--down)", fontWeight: 800 }}>{r.best.sl}%</td>
                      <td style={{ ...td, color: "var(--up)", fontWeight: 800 }}>{r.best.tp}%</td>
                      {/* P&L AT THE OPTIMUM — same figure as the "Now" P&L, surfaced here for a quick read. */}
                      <td style={{ ...td, color: (r.best && (r.best.pnl || 0) >= 0) ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{oAmt(r.best && r.best.pnl)}</td>
                      {metricCells(r.current, "e")}
                      {metricCells(r.best, "n")}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>Green EXISTS rows already run on {sym} — Apply Now writes the SL/TP onto them. Grey NEW rows don't exist yet — Create Now saves them as copies. Optimum = ideal SL/TP · Earlier = current · Now = at the optimum. Backtested, not a guarantee.</div>
          </div>)}
    </div>
  );
}

/* PER-SYMBOL INDICATOR OPTIMISER — the "Optimize Indicators" analogue of PerSymbolStrategyOptimizer.
   For EVERY eligible strategy it searches the best indicator lengths + timeframe (≤1h) on the chosen
   symbol, shows Earlier vs Now (win rate / P&L / return) plus the per-indicator change, and applies all
   at once. */
function PerSymbolIndicatorOptimizer({ strats, sym, tf, onApplyIndicators, onCreateCopy, copyExists, singleStrat, symList, days = 0, qty = null, amount = null, market = "IN" }) {
  const [objective, setObjective] = useState("pnl");
  const [state, setState] = useState({ loading: false, rows: null, ran: false });
  const [applied, setApplied] = useState(false);
  const [lockTf, setLockTf] = useState(true);         // default ON — keep this tf fixed; tune only lengths
  const [sel, setSel] = useState(() => new Set());    // rows the user ticked (for bulk apply / create)
  const [view, setView] = useState("all");            // All | Apply (existing only) | Create (new only)
  const lockable = ["3m", "5m", "15m", "30m", "1h"].includes(String(tf));
  // Clear stale results when the symbol / timeframe / strategy set changes (e.g. market switch).
  useEffect(() => { setState({ loading: false, rows: null, ran: false }); setApplied(false); setSel(new Set()); setView("all");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [sym, tf, singleStrat && singleStrat.id, (symList || []).join(","), (strats || []).map((s) => s.id).join(",")]);
  const perStrat = !!singleStrat;
  const hasLen = (cfg) => (cfg && (cfg.defs || []).some((d) => Number(d && d.len) > 0));
  const jobs = perStrat
    ? (hasLen(singleStrat.cfg) ? (symList || []).map((sy) => ({ key: sy, name: sy, strat: singleStrat, cfg: singleStrat.cfg || {}, sym: sy })) : [])
    : (strats || []).filter((s) => s.cfg && (s.cfg.entry || []).length > 0 && hasLen(s.cfg)).map((s) => ({ key: s.id, name: s.name, strat: s, cfg: s.cfg, sym }));
  const title = perStrat ? `Optimize Indicators — ${(singleStrat.name || "strategy")}` : `Optimize Indicators — ${sym}`;
  const firstCol = perStrat ? "Symbol" : "Strategy";
  const iwr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";
  const ipct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
  const iamt = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(2);
  const run = async (obj = objective) => {
    if (!jobs.length) { setState({ loading: false, ran: true, rows: [] }); return; }
    setApplied(false);
    setState({ loading: true, rows: null, ran: true });
    const candleCache = {};   // key `${sym}|${tf}` → candles, so each (symbol, tf) is fetched once
    const getCandles = async (sy, t) => { const k = sy + "|" + t; if (candleCache[k] === undefined) candleCache[k] = await loadBtCandles(sy, t, days); return candleCache[k]; };
    const sizing = { qty, amount, market };
    const rows = await Promise.all(jobs.map(async (j) => {
      try {
        const res = await optimizeIndicators({ mode: j.cfg.mode === "metric" ? "metric" : undefined, defs: j.cfg.defs || [], entry: j.cfg.entry, tf, appSyms: [j.sym], currentSl: j.cfg.sl != null ? Number(j.cfg.sl) : null, currentTp: j.cfg.tp != null ? Number(j.cfg.tp) : null, objective: obj, lockTf: (lockTf && lockable) ? tf : null });
        const best = res && res.best ? res.best : null;
        // RE-SCORE Earlier (current indicators @ current tf) and Now (tuned indicators @ tuned tf) with
        // the SAME backtest engine, sizing and period as the results table so the preview lines up.
        let current = res ? res.current : null, nowM = best;
        const curCandles = await getCandles(j.sym, tf);
        if (curCandles && curCandles.length >= 30) { const cur = scoreCfg(j.cfg, curCandles, tf, sizing); if (cur) current = cur; }
        if (best) {
          const ntf = best.tf || tf;
          const nowCandles = await getCandles(j.sym, ntf);
          if (nowCandles && nowCandles.length >= 30) { const nw = scoreCfg({ ...j.cfg, defs: best.defs || j.cfg.defs, tf: ntf }, nowCandles, ntf, sizing); if (nw) nowM = { ...best, ...nw }; }
        }
        return { j, best: nowM, current, changes: (res && res.changes) || [] };
      } catch { return { j, best: null }; }
    }));
    setState({ loading: false, ran: true, rows });
    setSel(new Set(rows.filter((r) => r.best).map((r) => r.j.key)));   // pre-tick every result row
  };
  const pick = (obj) => { setObjective(obj); if (state.ran && !state.loading) run(obj); };
  const { loading, rows, ran } = state;
  const good = (rows || []).filter((r) => r.best);
  // Apply targets strategies that ALREADY exist for this symbol; Create targets the rest (see the
  // SL/TP optimiser for the full rationale) — so each action shows its own honest count.
  // STRICT: a strategy "exists for this symbol" only if the symbol is genuinely in its symbols list (or
  // a copy was saved for it). We deliberately do NOT use stratRunsOnSym here — its "no symbol → matches
  // everything" fallback wrongly tagged symbol-less / other-symbol strategies as EXISTS on BTC.
  const existsForSym = (r) => ((r.j.strat.symbols || []).includes(r.j.sym)) || (copyExists && copyExists(r.j.strat, r.j.sym));
  const visible = view === "apply" ? good.filter(existsForSym) : view === "create" ? good.filter((r) => !existsForSym(r)) : good;
  const toggle = (k) => setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allOn = visible.length > 0 && visible.every((r) => sel.has(r.j.key));
  const toggleAll = () => setSel((p) => { const n = new Set(p); if (allOn) visible.forEach((r) => n.delete(r.j.key)); else visible.forEach((r) => n.add(r.j.key)); return n; });
  const chosen = good.filter((r) => sel.has(r.j.key));
  const chosenExisting = chosen.filter(existsForSym);
  const chosenMissing = chosen.filter((r) => !existsForSym(r));
  // Apply the tuned indicators (lengths + tf) only to ticked strategies that already exist for the symbol.
  const applySelected = () => { chosenExisting.forEach((r) => onApplyIndicators && onApplyIndicators(r.j.strat.id, r.best.defs, r.best.tf)); setApplied(true); };
  const createSelected = () => { chosenMissing.forEach((r) => onCreateCopy && onCreateCopy(r.j.strat, r.j.sym)); };
  const sepL = { borderLeft: "2px solid var(--muted)" };
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 6px", textAlign: "center", whiteSpace: "nowrap" };
  const td = { fontSize: 11, fontWeight: 700, padding: "7px 6px", textAlign: "center", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  const grp = { ...th, background: "var(--elev)", padding: "6px 6px" };
  const mCells = (m, key) => m ? [
    <td key={key + "w"} style={{ ...td, ...sepL }}>{iwr(m.winRate)}</td>,
    <td key={key + "p"} style={{ ...td, color: (m.pnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{iamt(m.pnl)}</td>,
    <td key={key + "r"} style={{ ...td, color: (m.retPct || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{ipct(m.retPct)}</td>,
  ] : [<td key={key + "e"} style={{ ...td, ...sepL, color: "var(--muted)" }} colSpan={3}>—</td>];
  return (
    <div style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--elev)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Filled CTA — the button that runs the optimiser. */}
        <button onClick={() => run()} disabled={loading || !jobs.length} className="tap disp" style={{ flex: "1 1 170px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "#0EA5E9", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 800, cursor: jobs.length ? "pointer" : "not-allowed", opacity: (loading || !jobs.length) ? 0.6 : 1 }}>
          <Sparkles size={13} /> {loading ? `Optimising ${jobs.length}…` : title}
        </button>
        <ObjSelect objective={objective} onPick={pick} accent="#0EA5E9" />
      </div>
      {/* Lock timeframe — when on, only indicator lengths are tuned and this tf stays fixed. */}
      <label className="tap" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 10.5, fontWeight: 700, color: lockable ? "var(--ink)" : "var(--muted)", cursor: lockable ? "pointer" : "not-allowed" }}>
        <input type="checkbox" checked={lockTf && lockable} disabled={!lockable} onChange={(e) => setLockTf(e.target.checked)} style={{ accentColor: "#0EA5E9", width: 15, height: 15 }} />
        Lock timeframe to {tf} {lockable ? "(tune indicator lengths only)" : "(only ≤ 1h can be locked)"}
      </label>
      {ran && !loading && (good.length === 0
        ? <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>{perStrat ? (jobs.length ? `Not enough past entry signals for ${singleStrat.name} on the selected symbols.` : `${singleStrat.name} has no tunable indicator lengths.`) : `Not enough past entry signals on ${sym} to optimise these strategies' indicators.`}</div>
        : <div style={{ marginTop: 10 }}>
            {/* View filter — All shows every result, Apply shows only strategies that already exist for
               the symbol, Create shows only the ones that don't. CTA appears only under Apply / Create. */}
            <div style={{ display: "inline-flex", gap: 2, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 2, marginBottom: 8 }}>
              {[["all", `All · ${good.length}`], ["apply", `Existing · ${good.filter(existsForSym).length}`], ["create", `Create · ${good.filter((r) => !existsForSym(r)).length}`]].map(([k, lbl]) => (
                <button key={k} onClick={() => setView(k)} className="tap" style={{ border: "none", background: view === k ? "#0EA5E9" : "transparent", color: view === k ? "#fff" : "var(--muted)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{lbl}</button>
              ))}
            </div>
            {/* Bulk actions on the TICKED rows — apply the tuned indicators to existing strategies, or create copies. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>{view === "apply" ? `${chosenExisting.length} selected` : view === "create" ? `${chosenMissing.length} selected` : `${chosenExisting.length} existing · ${chosenMissing.length} new`}</span>
              {onApplyIndicators && view === "apply" && <button onClick={applySelected} disabled={!chosenExisting.length || applied} className="tap" title={`Apply the tuned indicators to ${chosenExisting.length} strategy(ies) that already exist for ${sym}`} style={{ border: "none", background: applied ? "var(--up)" : "#0EA5E9", color: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 800, opacity: (!chosenExisting.length || applied) ? 0.5 : 1 }}>{applied ? "✓ Applied" : `Apply Now · ${chosenExisting.length}`}</button>}
              {onCreateCopy && view === "create" && <button onClick={createSelected} disabled={!chosenMissing.length} className="tap disp" title={`Create ${chosenMissing.length} new copy(ies) for ${sym} that don't exist yet`} style={{ border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 9, padding: "7px 12px", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5, opacity: !chosenMissing.length ? 0.5 : 1 }}><Plus size={13} /> Create Now · {chosenMissing.length}</button>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 740, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 24 }} rowSpan={2}><input type="checkbox" checked={allOn} onChange={toggleAll} style={{ accentColor: "#0EA5E9", width: 14, height: 14 }} /></th>
                    <th style={{ ...th, textAlign: "left" }} rowSpan={2}>{firstCol}</th>
                    <th style={{ ...grp, ...sepL, color: "#0EA5E9" }} rowSpan={2}>Optimized indicators</th>
                    <th style={{ ...grp, ...sepL, color: "var(--muted)" }} colSpan={3}>Earlier</th>
                    <th style={{ ...grp, ...sepL, color: "var(--primary)" }} colSpan={3}>Now</th>
                  </tr>
                  <tr>
                    {["Win", "P&L", "Ret"].map((h, i) => <th key={"e" + h} style={i === 0 ? { ...th, ...sepL } : th}>{h}</th>)}
                    {["Win", "P&L", "Ret"].map((h, i) => <th key={"n" + h} style={i === 0 ? { ...th, ...sepL } : th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && <tr><td colSpan={12} style={{ ...td, color: "var(--muted)", fontWeight: 700, textAlign: "center", padding: "14px 6px" }}>{view === "apply" ? `No strategies exist for ${sym} yet — switch to Create to add some.` : `Every optimised strategy already exists for ${sym}.`}</td></tr>}
                  {visible.map((r) => {
                    const exists = existsForSym(r);
                    return (
                    <tr key={r.j.key}>
                      <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={sel.has(r.j.key)} onChange={() => toggle(r.j.key)} style={{ accentColor: "#0EA5E9", width: 14, height: 14 }} /></td>
                      <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>
                        {r.j.name}
                        {exists
                          ? <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: "var(--up)", background: "rgba(34,197,94,.12)", borderRadius: 999, padding: "1px 6px", verticalAlign: "middle" }}>EXISTS · {r.j.sym}</span>
                          : <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 6px", verticalAlign: "middle" }}>NEW · {r.j.sym}</span>}
                      </td>
                      <td style={{ ...td, ...sepL, textAlign: "left", whiteSpace: "normal", maxWidth: 220, fontWeight: 600, color: "var(--muted)", fontSize: 9.5 }}>{(r.changes && r.changes.length) ? r.changes.map((c) => `${c.name}: ${c.fromLen ?? "—"}@${c.fromTf}→${c.toLen}@${c.toTf}`).join(" · ") : `unchanged @ ${r.best.tf}`}</td>
                      {mCells(r.current, "e")}
                      {mCells(r.best, "n")}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>Green EXISTS rows already run on {sym} — Apply Now writes the tuned lengths + tf onto them. Grey NEW rows don't exist yet — Create Now saves them as copies. Earlier = current · Now = tuned (SL/TP held fixed). Backtested, not a guarantee.</div>
          </div>)}
    </div>
  );
}

/* INDICATOR OPTIMISER — the "Optimize Indicators" analogue of ExitOptimizer. Searches the indicator
   LENGTHS + a shared timeframe (≤1h) that maximise win rate or P&L on the strategy's own past entry
   signals, then reports Earlier vs Now and applies the tuned defs (+ tf) to the strategy on Apply.
   Props: { defs, entry, mode, tf, appSyms, currentSl, currentTp, onApply(defs, tf) } */
function IndicatorOptimizer({ defs, entry, mode, tf, appSyms, currentSl, currentTp, onApply }) {
  const [state, setState] = useState({ loading: false, res: null, ran: false, applied: false });
  const [objective, setObjective] = useState(null);   // null until the user picks an option
  const [lockTf, setLockTf] = useState(true);         // default ON — keep the timeframe fixed; tune only lengths
  const iwr = (x) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(0) + "%";
  const ipct = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(1) + "%";
  const iamt = (x) => (x == null || isNaN(x)) ? "—" : (x >= 0 ? "+" : "") + Number(x).toFixed(2);
  const icnt = (x) => (x == null || isNaN(x)) ? "—" : String(x);
  const numeric = (defs || []).some((d) => Number(d && d.len) > 0);
  const lockable = ["3m", "5m", "15m", "30m", "1h"].includes(String(tf));   // timeframes the optimiser searches
  const run = async (obj) => {
    setObjective(obj);
    if (!entry || !entry.length || !appSyms || !appSyms.length || !numeric) { setState({ loading: false, ran: true, res: { entries: 0 }, applied: false }); return; }
    setState({ loading: true, res: null, ran: true, applied: false });
    const res = await optimizeIndicators({ mode, defs, entry, tf, appSyms, currentSl, currentTp, objective: obj, lockTf: (lockTf && lockable) ? tf : null });
    setState({ loading: false, ran: true, res, applied: false });
  };
  const { loading, res, ran, applied } = state;
  const best = res && res.best;
  const cur = res && res.current;
  const changes = (res && res.changes) || [];
  const cellL = { fontSize: 9.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 };
  const num = { fontWeight: 800, fontSize: 12, color: "var(--ink)" };
  // Two options — each runs the optimiser for that objective (and highlights it).
  const optBtn = (k, label) => (
    <button key={k} onClick={() => run(k)} disabled={loading || !numeric} className="tap disp" title={!numeric ? "This strategy has no tunable indicator lengths" : undefined} style={{
      flex: 1, padding: "10px 8px", fontSize: 11.5, fontWeight: 800, borderRadius: 10, cursor: numeric ? "pointer" : "not-allowed",
      border: "1px solid " + (objective === k ? "#0EA5E9" : "var(--line)"),
      background: objective === k ? "#0EA5E9" : "var(--surface)",
      color: objective === k ? "#fff" : "var(--ink)", opacity: (loading || !numeric) ? 0.6 : 1,
    }}>{label}</button>
  );
  // Before vs After per indicator (name · length · timeframe).
  const beforeDefs = (defs || []).filter((d) => Number(d && d.len) > 0);
  const afterOf = (name) => (best && best.defs || []).find((d) => (d.name || d.type) === name);
  // Earlier vs Now metrics: Win rate, SL hit, TP hit, P&L, Return %.
  const rows = best ? [
    { k: "Win rate", e: cur ? iwr(cur.winRate) : "—", n: iwr(best.winRate) },
    { k: "SL hit", e: cur ? icnt(cur.slHit) : "—", n: icnt(best.slHit) },
    { k: "TP hit", e: cur ? icnt(cur.tpHit) : "—", n: icnt(best.tpHit) },
    { k: "P&L", e: cur ? iamt(cur.pnl) : "—", n: iamt(best.pnl), nColor: best.pnl >= 0 ? "var(--up)" : "var(--down)" },
    { k: "Return %", e: cur ? ipct(cur.retPct) : "—", n: ipct(best.retPct), nColor: best.retPct >= 0 ? "var(--up)" : "var(--down)" },
  ] : [];
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "5px 6px", textAlign: "left", whiteSpace: "nowrap" };
  const tdc = { fontSize: 11, fontWeight: 700, padding: "6px 6px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  return (
    <div style={{ marginTop: 6 }}>
      <div className="disp" style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color="#0EA5E9" /> Optimize Indicators
      </div>
      {/* Lock timeframe — when on, the optimiser only tunes indicator lengths and keeps this tf fixed. */}
      <label className="tap" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontSize: 10.5, fontWeight: 700, color: lockable ? "var(--ink)" : "var(--muted)", cursor: lockable ? "pointer" : "not-allowed" }}>
        <input type="checkbox" checked={lockTf && lockable} disabled={!lockable} onChange={(e) => setLockTf(e.target.checked)} style={{ accentColor: "#0EA5E9", width: 15, height: 15 }} />
        Lock timeframe to {tf} {lockable ? "(tune indicator lengths only)" : "(only ≤ 1h can be locked)"}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        {optBtn("winrate", "Optimize Win rate")}
        {optBtn("pnl", "Optimize P&L")}
      </div>
      {loading && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Searching indicator lengths &amp; timeframes on real candles…</div>}
      {ran && !loading && !best && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
          {!numeric ? "This strategy has no tunable indicator lengths (e.g. MACD/VWAP only)." : `Not enough historical signals to backtest this${res && res.entries != null ? ` (${res.entries} found)` : ""} — try a higher timeframe or more symbols. (Optimises on price history, not your own trades.)`}
        </div>
      )}
      {ran && !loading && best && (
        <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 11, padding: 11, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>Ideal indicators · {objective === "winrate" ? "max win rate" : "max P&L"}</div>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{best.trades} past trades</div>
          </div>

          {/* BEFORE vs AFTER — indicator values + timeframe. */}
          <div style={{ marginTop: 9, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Indicator</th>
                  <th style={{ ...th, textAlign: "center" }}>Before</th>
                  <th style={{ ...th, textAlign: "center" }}>After</th>
                </tr>
              </thead>
              <tbody>
                {beforeDefs.map((d) => {
                  const a = afterOf(d.name || d.type) || {};
                  const changed = String(d.len) !== String(a.len) || String(d.tf) !== String(a.tf);
                  return (
                    <tr key={d.name || d.type}>
                      <td style={{ ...tdc, fontWeight: 800 }}>{d.name || d.type} <span style={{ color: "var(--muted)", fontWeight: 600 }}>({d.type})</span></td>
                      <td className="mono" style={{ ...tdc, textAlign: "center", color: "var(--muted)" }}>{d.len} · {d.tf}</td>
                      <td className="mono" style={{ ...tdc, textAlign: "center", color: changed ? "#0EA5E9" : "var(--muted)", fontWeight: 800 }}>{a.len != null ? a.len : d.len} · {a.tf || best.tf}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {changes.length === 0 && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6 }}>No change — current settings are already optimal for this objective.</div>}

          {/* Earlier vs Now performance. */}
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
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>Backtested on past entries with the current SL/TP held fixed — not a guarantee. P&L is per 1 unit / contract.</div>
          {onApply && changes.length > 0 && (
            <button onClick={() => { onApply(best.defs, best.tf); setState((s) => ({ ...s, applied: true })); }} className="tap"
              style={{ marginTop: 10, width: "100%", border: "none", background: applied ? "var(--up)" : "#0EA5E9", color: "#fff", borderRadius: 9, padding: "9px 0", fontSize: 11.5, fontWeight: 800 }}>
              {applied ? "✓ Indicators applied" : "Apply optimized indicators"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ADMIN BACKTESTING PANEL — two views:
   • Per Symbol  : one symbol × many strategies (with a strategy multi-select filter, all by default).
   • Per Strategy: one strategy × many symbols (symbol multi-select, all by default) — the transpose.
   Both reuse useBacktestStats and only run on the "Backtest Now" tap, never automatically. */
function BacktestPanel({ strats, market = "IN", onApplyExits, onApplyIndicators, onCreateCopy, copyExists, isActive, onToggleActive }) {
  const DEF_SYM = { US: "SPX", IN: "NIFTY50", Crypto: "BTC", Commodity: "GOLD", FNO: "NIFTY50" };
  const [view, setView] = useState("perSymbol");   // perSymbol | perStrategy
  // Position sizing for absolute P&L: crypto = USD amount (default 100), everything else = quantity (default 1).
  const isCrypto = market === "Crypto";
  const [size, setSize] = useState(isCrypto ? "100" : "1");
  const [resBucket, setResBucket] = useState("existing");   // Existing | New tabs over the per-symbol results
  const sizing = () => (isCrypto ? { amount: Number(size) || 0, market } : { qty: Number(size) || 0, market });
  const symOptions = useMemo(() => (UNIVERSE[market] || []).map((s) => s.sym), [market]);
  const stratNames = useMemo(() => strats.map((s) => s.name), [strats]);
  const TF_OPTS = [["5m", "5 min"], ["15m", "15 min"], ["30m", "30 min"], ["1h", "1 hour"], ["1d", "1 day"]];
  const PERIODS = [[5, "5 days"], [30, "1 month"], [90, "3 months"], [180, "6 months"], [365, "1 year"]];
  const sel = { ...selStyle, flex: "1 1 0", minWidth: 0, fontSize: 12 };
  const th = { fontSize: 9, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", padding: "7px 5px", textAlign: "center", whiteSpace: "nowrap" };
  const td = { fontSize: 11.5, fontWeight: 700, padding: "8px 5px", textAlign: "center", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };

  // ---- Per Symbol: one symbol, many strategies (strategy multi-select filter, all by default) ----
  const [tf, setTf] = useState("5m");
  const [days, setDays] = useState(180);
  const [sym, setSym] = useState(DEF_SYM[market] || "NIFTY50");
  const [pickStrats, setPickStrats] = useState([]);           // [] = all strategies
  const [run, setRun] = useState(null);                       // committed { tf, days, sym, names }

  // ---- Per Strategy: one strategy, many symbols (symbol multi-select, all by default) ----
  const [pStratId, setPStratId] = useState(strats[0] ? strats[0].id : "");
  const [pTf, setPTf] = useState("5m");
  const [pDays, setPDays] = useState(180);
  const [pSyms, setPSyms] = useState([]);                     // [] = all symbols
  const [pRun, setPRun] = useState(null);                     // committed { tf, days, syms, id }

  // Collected per-row stats for CSV export (label -> stats). Cleared whenever a fresh run starts.
  const [results, setResults] = useState({});
  const report = useCallback((label, stats) => setResults((r) => (r[label] === stats ? r : { ...r, [label]: stats })), []);

  /* Column sorting. Click a header to sort by that stat; click again to flip direction. Rows are
     sorted on the stats collected in `results` (keyed by strategy name / symbol). Rows whose backtest
     hasn't produced stats yet (or that took no trades) always sink to the bottom. */
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const onSort = (k) => { if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc")); else { setSortKey(k); setSortDir(k === "label" ? "asc" : "desc"); } };
  const sortRows = (rows, nameOf) => {
    if (!sortKey) return rows;
    const valOf = (row) => {
      const nm = nameOf(row);
      if (sortKey === "label") return nm;
      const st = results[nm];
      return st && st[sortKey] != null ? st[sortKey] : null;
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = valOf(a), vb = valOf(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;   // missing stats always sink to the bottom
      if (vb == null) return -1;
      if (typeof va === "string") return dir * String(va).localeCompare(String(vb));
      return dir * (va - vb);
    });
  };
  const SortArrow = ({ k }) => {
    const active = sortKey === k;
    return <span style={{ fontSize: 7.5, marginLeft: 2, color: active ? "var(--primary)" : "var(--line)" }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>;
  };

  useEffect(() => {
    setSym(DEF_SYM[market] || "NIFTY50"); setRun(null); setPickStrats([]);
    setPRun(null); setPSyms([]); setPStratId(strats[0] ? strats[0].id : ""); setResults({});
    setSize(market === "Crypto" ? "100" : "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  // Qty / USD-amount input, rendered inside each tab's filter row.
  const sizeField = (
    <label style={{ flex: "1 1 30%", minWidth: 100 }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>{isCrypto ? "AMOUNT (USD)" : "QTY"}</div>
      <input value={size} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ ...sel, textAlign: "center" }} />
    </label>
  );

  const exportBtn = (onClick) => (
    <button onClick={onClick} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 9, padding: "6px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>⬇ Export CSV</button>
  );

  // Sortable columns: [statKey, label]. Click a header to sort; the ▼/▲ shows it's sortable + the direction.
  const HEAD_COLS = [["trades", "Trades"], ["pnl", "P&L"], ["retPct", "Return"], ["wins", "Wins"], ["losses", "Loss"], ["winRate", "Win %"], ["tpHit", "Target"], ["slHit", "SL Hit"], ["maxDD", "Max DD"]];
  const Head = () => (
    <thead><tr>
      <th style={{ ...th, textAlign: "left", cursor: "pointer", userSelect: "none" }} onClick={() => onSort("label")}>{view === "perSymbol" ? "Strategy" : "Symbol"}<SortArrow k="label" /></th>
      {HEAD_COLS.map(([k, l]) => (
        <th key={k} style={{ ...th, cursor: "pointer", userSelect: "none" }} onClick={() => onSort(k)}>{l}<SortArrow k={k} /></th>
      ))}
    </tr></thead>
  );

  const runSymRows = run ? strats.filter((s) => run.names.includes(s.name)) : [];
  /* A strategy "exists" for the backtested symbol if it already carries that symbol, or a copy of it
     for that symbol has already been created. Those go under EXISTING (Activate/Deactivate); the rest
     go under NEW (Create for this symbol). */
  const existsForSym = (s) => (run ? ((s.symbols || []).includes(run.sym) || !!(copyExists && copyExists(s, run.sym))) : false);
  const existingSymRows = runSymRows.filter(existsForSym);
  const newSymRows = runSymRows.filter((s) => !existsForSym(s));
  const pStrat = pRun ? strats.find((s) => s.id === pRun.id) : null;
  const curStrat = strats.find((s) => s.id === pStratId) || null;   // selected strategy (for the optimiser)
  const curCfg = curStrat && curStrat.cfg;

  return (
    <div className="fade">
      {/* View tabs */}
      <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginBottom: 12 }}>
        {[["perSymbol", "Per Symbol"], ["perStrategy", "Per Strategy"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: view === k ? "var(--primary)" : "transparent", color: view === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
        ))}
      </div>

      {view === "perSymbol" ? (
        <>
          <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 2px 10px", lineHeight: 1.5 }}>
            Backtest the chosen strategies on one symbol over the selected timeframe and period. Results are hindsight, not a promise.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 30%", minWidth: 100 }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>SYMBOL</div>
              <select aria-label="Symbol" value={sym} onChange={(e) => setSym(e.target.value)} style={sel}>{symOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </label>
            <label style={{ flex: "1 1 30%", minWidth: 100 }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>TIMEFRAME</div>
              <select aria-label="Timeframe" value={tf} onChange={(e) => setTf(e.target.value)} style={sel}>{TF_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label style={{ flex: "1 1 30%", minWidth: 100 }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>PERIOD</div>
              <select aria-label="Period" value={days} onChange={(e) => setDays(+e.target.value)} style={sel}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            {sizeField}
          </div>
          {/* Strategy filter — empty = all (Select All). */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>STRATEGIES</div>
            <MultiSelect label="Strategies" options={stratNames} value={pickStrats} onChange={setPickStrats} allLabel="All strategies" />
          </div>

          {/* Ideal SL/TP for EACH strategy on the selected symbol. */}
          {strats.length > 0 && (
            <PerSymbolStrategyOptimizer strats={pickStrats.length ? strats.filter((s) => pickStrats.includes(s.name)) : strats} sym={sym} tf={tf} days={days} qty={isCrypto ? null : Number(size)} amount={isCrypto ? Number(size) : null} market={market} onApplyExits={onApplyExits} onCreateCopy={onCreateCopy} copyExists={copyExists} />
          )}
          {/* Ideal INDICATORS (lengths + timeframe) for EACH strategy on the selected symbol. */}
          {strats.length > 0 && (
            <PerSymbolIndicatorOptimizer strats={pickStrats.length ? strats.filter((s) => pickStrats.includes(s.name)) : strats} sym={sym} tf={tf} days={days} qty={isCrypto ? null : Number(size)} amount={isCrypto ? Number(size) : null} market={market} onApplyIndicators={onApplyIndicators} onCreateCopy={onCreateCopy} copyExists={copyExists} />
          )}

          <button onClick={() => { setResults({}); setRun({ tf, days, sym, names: pickStrats.length ? pickStrats : stratNames, ...sizing() }); }} disabled={!strats.length} className="tap disp" style={{ width: "100%", marginBottom: 12, border: "none", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 800, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", background: strats.length ? "var(--primary)" : "var(--elev)", color: strats.length ? "var(--on-primary)" : "var(--muted)", cursor: strats.length ? "pointer" : "not-allowed" }}>
            <Activity size={16} /> Backtest Now
          </button>
          {!strats.length ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No premium strategies to backtest.</div>
            : !run ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px", textAlign: "center" }}>Pick a symbol, timeframe, period and strategies, then tap <b>Backtest Now</b>.</div> : (
            <div className="card" style={{ padding: "6px 10px", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 8px", gap: 8 }}>
                <div className="disp" style={{ fontSize: 12, fontWeight: 800 }}>{run.sym} · {run.tf} · {run.names.length} strategies</div>
                {exportBtn(() => exportBacktestCsv({ results, order: runSymRows.map((s) => s.name), labelHeader: "Strategy", meta: [["Symbol", run.sym], ["Timeframe", run.tf], ["Period (days)", run.days], [isCrypto ? "Amount (USD)" : "Qty", size]], filename: `matrix-backtest-${run.sym}-${run.tf}-${run.days}d.csv` }))}
              </div>
              {/* EXISTING vs NEW — two tabs side by side (default Existing). Existing = already runs on the
                  selected symbol (Activate/Deactivate). New = doesn't yet (Create it under My Copies). */}
              <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, margin: "6px 2px 8px" }}>
                {[["existing", "Existing", existingSymRows.length], ["new", "New", newSymRows.length]].map(([k, l, n]) => (
                  <button key={k} onClick={() => setResBucket(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: resBucket === k ? "var(--primary)" : "transparent", color: resBucket === k ? "var(--on-primary)" : "var(--muted)" }}>{l} · {n}</button>
                ))}
              </div>
              {(() => {
                const rows = resBucket === "new" ? newSymRows : existingSymRows;
                if (!rows.length) return <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 4px 8px", fontWeight: 600 }}>{resBucket === "new" ? `Every backtested strategy already runs on ${run.sym}.` : `No strategies run on ${run.sym} yet — check the New tab to create some.`}</div>;
                return (
                  <>
                    {resBucket === "new" && <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, padding: "0 2px 6px" }}>Not on {run.sym} yet — tap Create to add under My Copies.</div>}
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                      <Head />
                      <tbody>{sortRows(rows, (s) => s.name).map((s) => <CompareRow key={s.id + run.tf + run.days + run.sym} s={s} td={td} opts={{ tf: run.tf, days: run.days, sym: run.sym, qty: run.qty, amount: run.amount, market: run.market }} onReport={report} market={market} sym={run.sym} onCreateCopy={onCreateCopy} copyExists={copyExists} isActive={isActive} onToggleActive={onToggleActive} bucket={resBucket} />)}</tbody>
                    </table>
                  </>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 2px 10px", lineHeight: 1.5 }}>
            Backtest ONE strategy across many symbols over the selected timeframe and period. Results are hindsight, not a promise.
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>STRATEGY</div>
            <select aria-label="Strategy" value={pStratId} onChange={(e) => setPStratId(e.target.value)} style={{ ...sel, width: "100%" }}>
              {strats.length ? strats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">No strategies</option>}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 45%", minWidth: 110 }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>TIMEFRAME</div>
              <select aria-label="Timeframe" value={pTf} onChange={(e) => setPTf(e.target.value)} style={sel}>{TF_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label style={{ flex: "1 1 45%", minWidth: 110 }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>PERIOD</div>
              <select aria-label="Period" value={pDays} onChange={(e) => setPDays(+e.target.value)} style={sel}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            {sizeField}
          </div>
          {/* Symbol filter — empty = all (Select All). */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>SYMBOLS</div>
            <MultiSelect label="Symbols" options={symOptions} value={pSyms} onChange={setPSyms} allLabel="All symbols" />
          </div>

          {/* Ideal SL/TP + indicators for the selected strategy, computed PER SYMBOL (one row for each
              selected symbol) so you see the ideal for each symbol, not one blended figure. */}
          {curStrat && curCfg && (curCfg.entry || []).length > 0 && (() => {
            const syms = pSyms.length ? pSyms.slice(0, 8) : symOptions.slice(0, 8);
            return (<>
              <PerSymbolStrategyOptimizer singleStrat={curStrat} symList={syms} sym={syms[0]} tf={pTf} days={pDays} qty={isCrypto ? null : Number(size)} amount={isCrypto ? Number(size) : null} market={market} onApplyExits={onApplyExits} onCreateCopy={onCreateCopy} copyExists={copyExists} />
              <PerSymbolIndicatorOptimizer singleStrat={curStrat} symList={syms.slice(0, 5)} sym={syms[0]} tf={pTf} days={pDays} qty={isCrypto ? null : Number(size)} amount={isCrypto ? Number(size) : null} market={market} onApplyIndicators={onApplyIndicators} onCreateCopy={onCreateCopy} copyExists={copyExists} />
            </>);
          })()}

          <button onClick={() => { if (pStratId) { setResults({}); setPRun({ tf: pTf, days: pDays, syms: pSyms.length ? pSyms : symOptions, id: pStratId, ...sizing() }); } }} disabled={!strats.length || !pStratId} className="tap disp" style={{ width: "100%", marginBottom: 12, border: "none", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 800, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", background: (strats.length && pStratId) ? "var(--primary)" : "var(--elev)", color: (strats.length && pStratId) ? "var(--on-primary)" : "var(--muted)", cursor: (strats.length && pStratId) ? "pointer" : "not-allowed" }}>
            <Activity size={16} /> Backtest Now
          </button>

          {!strats.length ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No premium strategies to backtest.</div>
            : !pRun || !pStrat ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px", textAlign: "center" }}>Pick a strategy, timeframe, period and symbols, then tap <b>Backtest Now</b>.</div> : (
            <div className="card" style={{ padding: "6px 10px", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 8px", gap: 8 }}>
                <div className="disp" style={{ fontSize: 12, fontWeight: 800 }}>{pStrat.name} · {pRun.syms.length} symbols</div>
                {exportBtn(() => exportBacktestCsv({ results, order: pRun.syms, labelHeader: "Symbol", meta: [["Strategy", pStrat.name], ["Timeframe", pRun.tf], ["Period (days)", pRun.days], [isCrypto ? "Amount (USD)" : "Qty", size]], filename: `matrix-backtest-${(pStrat.name || "strategy").replace(/[^a-z0-9]+/gi, "_")}-${pRun.tf}-${pRun.days}d.csv` }))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <Head />
                <tbody>{sortRows(pRun.syms, (sy) => sy).map((sy) => <SymbolRow key={pStrat.id + pRun.tf + pRun.days + sy} strat={pStrat} sym={sy} td={td} opts={{ tf: pRun.tf, days: pRun.days, qty: pRun.qty, amount: pRun.amount, market: pRun.market }} onReport={report} market={market} onCreateCopy={onCreateCopy} copyExists={copyExists} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* P&L TAB — every strategy (active + inactive) for this market with its total P&L over a chosen
   window; tap one to see its trades (entry/exit time + per-trade P&L). Crypto P&L uses the USD-notional
   formula (qty is an amount, not a coin count), matching the fixed stratPerf. */
function StrategyPnLView({ strats, trades, market, onDelete }) {
  const [range, setRange] = useState(1);
  const [openId, setOpenId] = useState(null);
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
  const inMkt = (s) => !(s.symbols && s.symbols.length) || s.symbols.some((x) => marketOf(x) === market);
  const RANGES = [[1, "Today"], [7, "Last 7 days"], [30, "Last 30 days"], [180, "Last 6 months"]];
  const rows = strats.filter(inMkt).map((s) => ({ s, p: stratPerf(s, trades, range, priceOf) })).sort((a, b) => (b.p.pnl || 0) - (a.p.pnl || 0));
  const dt = (t) => (t ? new Date(t).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const tradesFor = (s) => (trades || []).filter((t) => (t.strategyId === s.id || t.strategy === s.name) && t.status !== "rejected" && (t.exitAt || t.entryAt || 0) >= Date.now() - range * 864e5).sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
  const tPnl = (t) => { const px = t.exit != null ? t.exit : priceOf(t.sym); if (t.entry == null || px == null) return null; return marketOf(t.sym) === "Crypto" ? (Number(t.qty) || 0) * ((px / t.entry) - 1) : (px - t.entry) * (Number(t.qty) || 1); };
  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 2px 4px" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 18 }}>Strategy P&amp;L</div>
        <select aria-label="Date range" value={range} onChange={(e) => setRange(+e.target.value)} style={{ ...selStyle, flex: "0 0 auto", width: "auto", fontSize: 12 }}>{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>No strategies in this market yet.</div>}
      {rows.map(({ s, p }) => (
        <div key={s.id} className="card" style={{ padding: 12, marginTop: 10 }}>
          <div onClick={() => setOpenId(openId === s.id ? null : s.id)} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{s.name || "Strategy"}{!s.active && <span style={{ color: "var(--muted)", fontWeight: 700 }}> · inactive</span>}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{(s.symbols || []).join(", ") || "—"} · {p.trades || 0} trades{p.winRate != null ? ` · ${p.winRate.toFixed(0)}% win` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: chgColor(p.pnl) }}>{p.pnl == null ? "—" : (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, market)}</div>
              {onDelete && openId === s.id && <button onClick={(e) => { e.stopPropagation(); onDelete(s); }} className="tap" title="Delete strategy" style={{ border: "none", background: "transparent", padding: 2, flexShrink: 0 }}><Trash2 size={14} color="var(--down)" /></button>}
              <ChevronDown size={15} style={{ transform: openId === s.id ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--muted)" }} />
            </div>
          </div>
          {openId === s.id && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              {tradesFor(s).length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>No trades in this period.</div>}
              {tradesFor(s).map((t, i) => { const pl = tPnl(t); return (
                <div key={t.id || i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : "none", fontSize: 11 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{t.sym} <span style={{ color: "var(--muted)", fontWeight: 600 }}>×{t.qty}</span></div>
                    <div style={{ color: "var(--muted)" }}>In {dt(t.entryAt)}</div>
                    <div style={{ color: "var(--muted)" }}>{t.exitAt ? "Out " + dt(t.exitAt) : "position open"}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 800, color: pl == null ? "var(--muted)" : chgColor(pl), textAlign: "right", flex: "0 0 auto" }}>{pl == null ? "—" : (pl >= 0 ? "+" : "") + fmt(pl, marketOf(t.sym))}</div>
                </div>
              ); })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
export default function Automation({ market = "IN", appMode = "virtual", onRecord, trades = [], strats = [], setStrats, onExitAll, onCloseStrategy = null, me = null, isAdmin = false, userId = null, brokerFor = null, adminKey = "", onConnectBroker = null }) {
  /* Backtesting Indian stocks needs real history, which — for compliance — can only come from the
     user's OWN connected broker (or the owner's house feed). Crypto (Delta) and US (Yahoo) have
     usable public/delayed feeds, so those don't require a broker. */
  const INDIAN_MKT = ["IN", "FNO", "Commodity"];
  const canBacktest = !INDIAN_MKT.includes(market) || isAdmin || (typeof brokerFor === "function" && !!brokerFor(market));
  // Which strategy is being armed for real-money auto-buy, and the form for it.
  const [liveStrat, setLiveStrat] = useState(null);
  const [liveAmt, setLiveAmt] = useState("");
  const [liveProduct, setLiveProduct] = useState("Intraday");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState(null);
  const AUTOBUY_BROKERS = ["delta", "coindcx", "zerodha", "fyers"];
  /* Which of the user's own strategies are ALREADY armed for real money — so the card shows a
     non-clickable "Real Live" instead of "Go Live" and can't be armed a second time. */
  const [armedReal, setArmedReal] = useState([]);
  const refreshArmed = () => { if (userId) loadAutoBuys(userId).then((d) => setArmedReal((d && d.strategies) || [])).catch(() => {}); };
  useEffect(() => { refreshArmed(); const t = setInterval(refreshArmed, 30000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [userId]);
  const isArmedReal = (s) => armedReal.some((a) => a && a.status !== "cancelled" && (a.name || "") === (s.name || "") && (!s.symbols || !s.symbols.length || a.symbol === s.symbols[0]));
  async function armLive(s) {
    setLiveMsg(null);
    const sym = (s.symbols && s.symbols[0]) || null;
    if (!sym) { setLiveMsg({ e: true, t: "Add a symbol to this strategy first (edit ⚙)." }); return; }
    const mkt = marketOf(sym) || market;
    const route = brokerFor ? brokerFor(mkt) : null;
    if (!route || !route.session) { setLiveMsg({ e: true, t: `Connect a broker for ${mkt} first.` }); return; }
    if (!AUTOBUY_BROKERS.includes(route.id)) { setLiveMsg({ e: true, t: `Auto-buy isn't supported on ${route.meta ? route.meta.name : route.id} yet.` }); return; }
    const bsym = brokerSymbol(sym, route.id);
    if (!bsym) { setLiveMsg({ e: true, t: `${route.id} can't trade ${sym} (no symbol mapping).` }); return; }
    const amt = Number(liveAmt);
    if (!(amt > 0)) { setLiveMsg({ e: true, t: "Enter an amount per trade." }); return; }
    setLiveBusy(true);
    try {
      const cfg = s.cfg && s.cfg.entry ? { defs: s.cfg.defs || [], entry: s.cfg.entry, exit: s.cfg.exit || [] } : null;
      if (!cfg) { setLiveMsg({ e: true, t: "This strategy has no builder entry rule to run on the server." }); setLiveBusy(false); return; }
      const r = await registerAutoBuy(route.session, userId, {
        name: s.name || null, symbol: sym, brokerSym: bsym, market: mkt, cfg,
        notional: amt, interval: s.tf || "5m", product: liveProduct,
        sl: s.cfg.sl || null, tp: s.cfg.tp || null, tsl: s.cfg.tsl || null,
      });
      setLiveMsg({ t: r.already ? "Already live — this strategy is already armed." : (r.live ? "Armed — the engine will trade this live." : "Armed (engine in dry-run until AUTO_BUY_LIVE is on).") });
      setLiveStrat(null); setLiveAmt(""); refreshArmed();
    } catch (e) { setLiveMsg({ e: true, t: String(e.message || e) }); }
    finally { setLiveBusy(false); }
  }
  const creator = me || "You";   // the "created by" tag for anything this user makes
  const [mode, setMode] = useState("plain");   // plain English is the default entry point
  const [defs, setDefs] = useState([
    { id: 1, type: "EMA", len: "50", tf: "5m", name: "EMA1" },
    { id: 2, type: "EMA", len: "200", tf: "5m", name: "EMA2" },
    { id: 3, type: "RSI", len: "14", tf: "5m", name: "RSI1" },
    { id: 4, type: "MACD", len: "", tf: "5m", name: "MACD1" },
  ]);
  const operands = useMemo(() => ["Price", "Volume", ...defOperands(defs)], [defs]);
  const [entryConds, setEntryConds] = useState([
    { la: "EMA1", op: ">", bType: "ind", b: "EMA2" },
    { la: "RSI1", op: "<", bType: "num", b: "70", gate: "AND" },
  ]);
  const [exitConds, setExitConds] = useState([
    { la: "MACD1.line", op: "crosses_below", bType: "ind", b: "MACD1.signal" },
    { la: "RSI1", op: ">", bType: "num", b: "70", gate: "OR" },
  ]);
  // Default risk per market: crypto is more volatile so it gets wider stops/targets.
  const defSL = (m) => (m === "Crypto" ? "2" : "1");     // Crypto SL 2% · Indian/US/Commodity SL 1%
  const defTP = (m) => (m === "Crypto" ? "5" : "3");     // Crypto TP 5% · Indian/US/Commodity TP 3%
  const [sl, setSl] = useState(defSL(market));
  const [tp, setTp] = useState(defTP(market));
  // When you switch market (fresh builder context), reset SL/TP to that market's default.
  useEffect(() => { setSl(defSL(market)); setTp(defTP(market)); /* eslint-disable-next-line */ }, [market]);
  const [capital, setCapital] = useState(market === "Crypto" ? "200" : "1");   // crypto: $ amount (default 200 — enough for ≥1 Delta contract); else quantity (default 1)

  /* Order-execution defaults for the automation. */
  const [buyType, setBuyType] = useState("Intraday");   // Intraday (MIS) | NRML
  const [entryType, setEntryType] = useState("Market"); // Market | Limit
  const [limitOffset, setLimitOffset] = useState("0.1"); // % away from signal price for a LIMIT
  const [maxTrades, setMaxTrades] = useState("5");      // max fresh entries per day
  const [maxReentries, setMaxReentries] = useState("5");// max re-entries after an exit
  const [tf, setTf] = useState("5m");
  // Default deploy symbol per market: Indian → NIFTY 50, US → S&P 500, Commodity → Gold, Crypto → BTC.
  const DEFAULT_DEPLOY_SYM = { IN: "NIFTY50", US: "SPX", Commodity: "GOLD", Crypto: "BTC", FNO: "NIFTY50" };
  const [deploySyms, setDeploySyms] = useState([DEFAULT_DEPLOY_SYM[market] || "NIFTY50"]);
  useEffect(() => { setDeploySyms([DEFAULT_DEPLOY_SYM[market] || "NIFTY50"]); /* eslint-disable-next-line */ }, [market]);
  const [symFilter, setSymFilter] = useState([]);
  /* Symbols for the market you are actually on. This was hardcoded to the F&O
     list, so on the US or Crypto tab the builder offered you Indian F&O names —
     symbols the strategy would then try (and fail) to trade in that wallet. */
  const DEPLOY_OPTIONS = useMemo(() => (
    (UNIVERSE[market] || []).map((s) => s.sym)
  ), [market]);
  const [pEntry, setPEntry] = useState("");
  const [pExit, setPExit] = useState("");
  const [stratName, setStratName] = useState("");
  const [editingId, setEditingId] = useState(null);       // when set, Save updates this strategy in place
  const [selectedTpl, setSelectedTpl] = useState(null);   // highlighted Strategy Idea (tap toggles)
  const [showBuilder, setShowBuilder] = useState(true);   // create-strategy panel open by default
  const [showBt, setShowBt] = useState(false);
  const [optLeg, setOptLeg] = useState({ enabled: false, expiry: "Current week", legs: [{ side: "BUY", type: "CE", mny: "ATM", lots: 1 }] });
  const [btOpen, setBtOpen] = useState(null);
  const [ledgerOpen, setLedgerOpen] = useState(null);   // strategy id whose trade ledger is open
  const [btTpl, setBtTpl] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [toast, setToast] = useState(null);
  const [dashBy, setDashBy] = useState("All");
  const [dashOpen, setDashOpen] = useState(false);          // collapsed by default (P&L only)
  const [dashPreset, setDashPreset] = useState("today");   // default Today (label shown even when collapsed)
  const [dashFrom, setDashFrom] = useState("");             // custom range (yyyy-mm-dd)
  const [dashTo, setDashTo] = useState("");
  const dashRange = useMemo(() => {
    const DAY = 86400000, now = Date.now(), d = new Date();
    switch (dashPreset) {
      case "today": { const s = new Date(); s.setHours(0, 0, 0, 0); return Math.max(1 / 24, (now - s.getTime()) / DAY); }
      case "7d": return 7;
      case "month": { const s = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return Math.max(1, (now - s) / DAY); }
      case "6m": return 180;
      case "12m": return 365;
      case "custom": { if (dashFrom) { const f = new Date(dashFrom + "T00:00:00").getTime(); return Math.max(1, (now - f) / DAY); } return 365; }
      default: return 365;
    }
  }, [dashPreset, dashFrom]);
  const DASH_PRESETS = [["today", "Today"], ["7d", "Last 7 days"], ["month", "This month"], ["6m", "Last 6 months"], ["12m", "Last 12 months"], ["custom", "Custom range"]];
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  function fireAlert(a) {
    /* This used to run a backtest over SIMULATED NIFTY candles and report the result
       as though it were a live signal — "Exit signal on NIFTY50 @ 23,412.55" — a
       number that came from a random walk, on a symbol the strategy might not even
       trade. The generator is gone; the honest message is that alerts are armed and
       the engine will fire when a real rule triggers on real candles. */
    const on = (a.symbols && a.symbols.length) ? a.symbols.join(", ") : "its symbols";
    const text = `${a.name}: alerts armed — you'll be notified when it triggers on ${on}`;
    setNotifs((p) => [{ id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...p].slice(0, 8));
    setToast(text);
  }

  // Plain-English → executable rules
  const eParsed = useMemo(() => parseRules(pEntry), [pEntry]);
  const xParsed = useMemo(() => parseRules(pExit), [pExit]);
  /* If the prose names a timeframe ("3 mins", "1 hour", "daily"), adopt it as the strategy tf so
     "MACD 3,10,16 (3 mins)" actually runs on 3m instead of the 5m default. */
  useEffect(() => {
    // A multi-timeframe prompt ("bullish on 3m + 5m + 15m") names several intervals. The strategy must
    // RUN on the smallest one so the larger ones can be aggregated up from it — pick the min, not the first.
    const all = [...detectAllTfs(pEntry), ...detectAllTfs(pExit)];
    const d = all.length ? all.reduce((a, b) => (tfMinutes(b) && tfMinutes(b) < tfMinutes(a) ? b : a)) : (detectTf(pEntry) || detectTf(pExit));
    if (d && d !== tf) setTf(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pEntry, pExit]);
  /* AI interpretation — the intelligent path. When the fast local parser can't fully read a
     prompt, Neo (LLM) converts it to structured rules, which we load into the visual builder. */
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState(null);
  const runAiInterpret = async () => {
    const entryTxt = pEntry.trim(), exitTxt = pExit.trim();
    if (!entryTxt && !exitTxt) { setAiMsg({ ok: false, t: "Type an entry (and optionally an exit) rule first." }); return; }
    setAiBusy(true); setAiMsg(null);
    try {
      const text = [entryTxt && `Entry: ${entryTxt}`, exitTxt && `Exit: ${exitTxt}`].filter(Boolean).join(". ");
      const ai = await aiInterpretStrategyAI(text);
      if (ai && ((ai.entry && ai.entry.length) || (ai.exit && ai.exit.length))) {
        const defsWithId = (ai.defs || []).map((d, i) => ({ id: Date.now() + i, type: d.type, len: String(d.len == null ? "" : d.len), tf: d.tf || tf, name: d.name, ...(d.winMin != null ? { winMin: Number(d.winMin) } : {}), ...(d.fast != null ? { fast: d.fast, slow: d.slow, signal: d.signal } : {}), ...(d.mult != null ? { mult: d.mult } : {}) }));
        setDefs(defsWithId);
        setEntryConds(ai.entry && ai.entry.length ? ai.entry : []);
        setExitConds(ai.exit && ai.exit.length ? ai.exit : []);
        // Neo also extracts a stop/target when the user states one ("exit at 5% return" → tp 5).
        if (ai.sl != null) setSl(String(ai.sl));
        if (ai.tp != null) setTp(String(ai.tp));
        setMode("builder");
        const sltp = (ai.tp != null || ai.sl != null) ? ` SL/TP set to ${ai.sl != null ? ai.sl : sl}%/${ai.tp != null ? ai.tp : tp}%.` : "";
        setAiMsg({ ok: true, t: "Neo interpreted your prompt into the builder below — review and deploy." + sltp });
      } else {
        setAiMsg({ ok: false, t: "Neo couldn't interpret that. Try describing the entry more concretely." });
      }
    } catch { setAiMsg({ ok: false, t: "Couldn't reach Neo just now — try again." }); }
    setAiBusy(false);
  };
  /* STRATEGY SUGGESTION. When the entry box reads like a brief ("suggest a strategy using Bollinger,
     MACD and RSI") rather than literal conditions, Neo DESIGNS a complete entry+exit system from the
     named indicators. Only offered when the literal parser found no entry conditions, so it never
     competes with a user writing explicit rules. One tap loads it into the editable builder below. */
  const suggestion = useMemo(() => (eParsed.conds.length === 0 && pEntry.trim() ? suggestStrategy(pEntry) : null), [pEntry, eParsed.conds.length]);
  /* Turn a suggested condition back into plain English the parser can RE-READ, so confirming a
     suggestion fills the entry/exit boxes with editable rules (not opaque tokens). Returns null for
     operands the text parser can't round-trip (Keltner / Stochastic / Supertrend) — those load into
     the visual builder instead, which holds the exact conditions regardless. */
  const OPWORD = { ">": ">", "<": "<", ">=": ">=", "<=": "<=", "==": "=", crosses_above: "crosses above", crosses_below: "crosses below" };
  const plainOperand = (op, defs) => {
    if (op === "CC.close") return "close"; if (op === "CC.open") return "open"; if (op === "CC.high") return "high"; if (op === "CC.low") return "low";
    if (/^BB\d*\.upper$/.test(op)) return "upper band"; if (/^BB\d*\.lower$/.test(op)) return "lower band"; if (/^BB\d*\.middle$/.test(op)) return "middle band";
    if (/^MACD\d*\.signal$/.test(op)) return "MACD signal"; if (/^MACD\d*\.hist$/.test(op)) return "MACD histogram"; if (/^MACD\d*\.line$/.test(op)) return "MACD line";
    if (/^RSI/.test(op)) return "RSI"; if (/^ADX/.test(op)) return "ADX"; if (/^VWAP/.test(op)) return "VWAP";
    if (op === "EMA_f" || op === "EMA_s") { const d = (defs || []).find((x) => x.name === op); return d ? "EMA " + d.len : "EMA"; }
    const em = op.match(/^(EMA|SMA)(\d+)$/); if (em) return em[1] + " " + em[2];
    return null;
  };
  const condsToPlain = (conds, defs) => {
    const parts = [];
    for (const c of conds) {
      const L = plainOperand(c.la, defs); if (L == null) return null;
      const R = c.bType === "num" ? c.b : plainOperand(c.b, defs); if (R == null) return null;
      parts.push((c.gate === "OR" ? "or " : parts.length ? "and " : "") + `${L} ${OPWORD[c.op] || c.op} ${R}`);
    }
    return parts.join(" ");
  };
  const applySuggestion = () => {
    if (!suggestion) return;
    const eTxt = condsToPlain(suggestion.entry, suggestion.defs);
    const xTxt = suggestion.exit.length ? condsToPlain(suggestion.exit, suggestion.defs) : "";
    if (suggestion.tf) setTf(suggestion.tf);
    if (eTxt != null && xTxt != null) {
      // Fully round-trippable — fill BOTH plain-English boxes so the user sees and can edit them.
      setPEntry("Buy when " + eTxt + ".");
      setPExit(xTxt ? "Exit when " + xTxt + "." : "");
      setMode("plain");
      setAiMsg({ ok: true, t: "Neo filled in the entry and exit rules below — edit anything, then deploy." });
    } else {
      // Has an indicator the text parser can't round-trip — load the exact rules into the builder.
      const withId = suggestion.defs.map((d, i) => ({ id: Date.now() + i, type: d.type, len: String(d.len == null ? "" : d.len), mult: d.mult, tf: suggestion.tf || tf, name: d.name }));
      setDefs(withId); setEntryConds(suggestion.entry); setExitConds(suggestion.exit); setMode("builder");
      setAiMsg({ ok: true, t: "Neo loaded the strategy into the builder below — review the entry & exit rows, then deploy." });
    }
  };
  const plainDefs = useMemo(() => { const d = []; [...eParsed.defs, ...xParsed.defs].forEach((x) => { if (x && !d.find((y) => y.name === x.name)) d.push(x); }); return d; }, [eParsed, xParsed]);
  const cfg = mode === "builder"
    ? { mode: "builder", tf, defs, entry: entryConds, exit: exitConds, sl, tp }
    : { mode: "builder", tf, defs: plainDefs.map((d) => ({ ...d, tf: d.tf || tf })), entry: eParsed.conds, exit: xParsed.conds, sl, tp };
  const condStr = (c) => `${c.la} ${c.op} ${c.b}`;
  const chain = (conds) => conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condStr(c)}`).join("");
  /* Render an indicator's ACTUAL settings so the code preview shows what Neo understood:
     MACD(3,10,16, tf=3m), BB(length=20, mult=2, …), RSI(length=21, …). Without this the params a
     user typed in brackets were captured but invisible, so it looked like they'd been ignored. */
  const indSig = (d, itf) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type);
    const args = [];
    if (d.type === "MACD") { if (d.fast || d.slow || d.signal) args.push(`${d.fast || 12},${d.slow || 26},${d.signal || 9}`); }
    else if ((cat ? cat.needsLen : d.len) && d.len) args.push(`length=${d.len}`);
    if (d.type === "BB" && d.mult) args.push(`mult=${d.mult}`);
    if (d.type === "Stoch") { if (d.smoothK) args.push(`smoothK=${d.smoothK}`); if (d.smoothD) args.push(`smoothD=${d.smoothD}`); }
    if (itf) args.push(`tf=${itf}`);
    return `${d.name} = ${d.type}(${args.join(", ")})`;
  };
  const defLines = defs.map((d) => indSig(d, d.tf)).join("\n");
  const plainDefLines = plainDefs.map((d) => indSig(d, tf)).join("\n");
  const unparsed = [...eParsed.unparsed, ...xParsed.unparsed];
  const code = mode === "builder"
    ? `# Indicators\n${defLines}\n\n# Entry\nif ${chain(entryConds)}:\n    enter_trade(stop_loss=${sl}%, take_profit=${tp}%)\n\n# Exit\nif ${chain(exitConds)}:\n    exit_trade()`
    : `# Timeframe: ${tf}\n# Indicators (auto-detected from your text)\n${plainDefLines || "# (none detected yet)"}\n\n# ENTRY\nif ${chainCode(eParsed.conds) || "<describe entry rules>"}:\n    enter_trade(stop_loss=${sl}%, take_profit=${tp}%)\n\n# EXIT\nif ${chainCode(xParsed.conds) || "<describe exit rules>"}:\n    exit_trade()`;

  /* The option leg travels WITH the strategy, not with a symbol — "when this fires, buy
     the ATM call" is a property of the strategy. */
  const saveStrategy = (makeActive) => {
    const name = stratName.trim();
    if (!name) { setToast("Give your strategy a name first."); return; }
    const symbols = deploySyms.length ? deploySyms : ["NIFTY50"];
    // Indian options are limit-only — never save a market order on an option strategy.
    const effEntryType = optLeg.enabled ? "Limit" : entryType;
    const base = { name, by: creator, cfg, opt: optLeg, qty: Math.max(1, parseInt(capital) || 1), buyType, entryType: effEntryType, limitOffset: effEntryType === "Limit" ? (parseFloat(limitOffset) || 0) : null, maxTrades: Math.max(1, parseInt(maxTrades) || 5), maxReentries: Math.max(0, parseInt(maxReentries) || 5), cap: parseInt(capital) || 1, symbols };
    if (editingId) {
      // Preserve Matrix authorship + premium status when an admin edits a sample/premium.
      setStrats((p) => p.map((x) => x.id === editingId ? { ...x, ...base, by: x.by === "Matrix" ? x.by : base.by, premium: x.premium, desc: x.desc, active: makeActive } : x));
      setEditingId(null);
      setToast(`${name} updated${makeActive ? " and live" : ""}.`);
    } else {
      const id = "u" + Date.now();
      setStrats((p) => [{ id, ...base, active: makeActive, alerts: false, created: Date.now() }, ...p]);
      setToast(makeActive
        ? `${name} is live on ${symbols.join(", ")} — it will place orders when its rules trigger.`
        : `${name} saved as a draft. Activate it to start trading.`);
    }
    setStratName(""); setShowBuilder(false);
    setStratTab("mine"); setTopTab("strategies");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  /* Load an existing strategy into the builder to edit its rules IN PLACE (Save updates it). */
  const loadForEdit = (s) => {
    const cfg = s.cfg || {};
    setMode(cfg.mode === "plain" ? "plain" : "builder");
    setShowBuilder(true);
    setDefs((cfg.defs || []).map((d, i) => ({ id: Date.now() + i, tf: d.tf || "1D", ...d })));
    setEntryConds((cfg.entry || []).map((c) => ({ ...c })));
    setExitConds((cfg.exit || []).map((c) => ({ ...c })));
    if (cfg.sl != null) setSl(String(cfg.sl));
    if (cfg.tp != null) setTp(String(cfg.tp));
    setStratName(s.name || "");
    setDeploySyms(s.symbols && s.symbols.length ? [s.symbols[0]] : []);
    if (s.qty != null) setCapital(String(s.qty));
    setEditingId(s.id);
    setTopTab("build");
    setToast(`Editing "${s.name}" — change it below, then Save.`);
    setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }, 40);
  };
  const activateTemplate = (t, syms, size) => {
    const symbols = syms && syms.length ? syms : ["NIFTY50"];
    const id = "t" + Date.now();
    const sz = size != null ? size : (market === "Crypto" ? 200 : 1);
    // by: creator — the moment YOU activate it, it is YOUR strategy and belongs under
    // "My strategies". It was previously tagged "Matrix", which filed the user's own
    // running strategies under the samples.
    setStrats((p) => [{ id, name: t.name, by: creator, active: true, alerts: false, cfg: t.cfg, tf: (t.cfg && t.cfg.tf) || "5m", cap: sz, qty: sz, symbols, created: Date.now() }, ...p]);
    setToast(`${t.name} is live on ${symbols.join(", ")} — it will place orders when its rules trigger.`);
    setStratTab("mine"); setTopTab("strategies");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /* "Use this strategy" on a sample/premium: the card-chosen SL/TP, and now the TIMEFRAME (which
     re-times every indicator) and symbol, ride along on the cfg when the user deploys it. */
  const withSLTP = (cfg, opts) => {
    if (!opts) return cfg;
    const c = { ...cfg };
    if (opts.sl != null) c.sl = String(opts.sl);
    if (opts.tp != null) c.tp = String(opts.tp);
    if (opts.tf) { c.tf = opts.tf; c.defs = (c.defs || []).map((d) => ({ ...d, tf: opts.tf })); }
    return c;
  };
  const useTemplateStrategy = (s, size, opts) => activateTemplate({ name: s.name, cfg: withSLTP(s.cfg, opts) }, (opts && opts.symbol) ? [opts.symbol] : s.symbols, size);

  /* Clone: drop an editable copy into "My strategies" (inactive), so you can tweak it
     before deploying. Works from Samples and from your own strategies. */
  const cloneStrategy = (s) => {
    const id = "c" + Date.now();
    // Default the copy's suffix to its SYMBOL (market-relevant one first), e.g. "Golden Cross - RELIANCE".
    const sym = (s.symbols || []).find((x) => marketOf(x) === market) || (s.symbols || [])[0];
    setStrats((p) => [
      { id, name: sym ? `${s.name} - ${sym}` : `${s.name} (copy)`, by: creator, active: false, alerts: false, cfg: s.cfg, cap: s.cap || 100000, symbols: (s.symbols || []).slice(), tf: s.tf, created: Date.now() },
      ...p,
    ]);
    setToast(`Cloned "${s.name}" into My strategies — edit it there.`);
    setStratTab("mine"); setTopTab("strategies");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /* Load a Strategy Idea (template) into the builder below: fills the indicators (Step 1)
     and the entry/exit signals (Step 2), plus stop-loss / target, ready to tweak. */
  const loadTemplate = (t) => {
    // Tapping the selected idea again clears the selection and the builder.
    if (selectedTpl === t.name) {
      setSelectedTpl(null);
      setDefs([]); setEntryConds([]); setExitConds([]); setStratName(""); setEditingId(null);
      setToast("Cleared — pick a Strategy Idea or build from scratch.");
      return;
    }
    const cfg = t.cfg || {};
    setMode("builder");
    setShowBuilder(true);
    // Every template indicator adopts the timeframe the user has selected in Step 1 (not the template's
    // own tf), so a 5-minute strategy doesn't silently load indicators on the daily chart.
    setDefs((cfg.defs || []).map((d, i) => ({ ...d, id: Date.now() + i, tf })));
    setEntryConds((cfg.entry || []).map((c) => ({ ...c })));
    setExitConds((cfg.exit || []).map((c) => ({ ...c })));
    if (cfg.sl != null) setSl(String(cfg.sl));
    if (cfg.tp != null) setTp(String(cfg.tp));
    setStratName(t.name);
    setSelectedTpl(t.name);
    setToast(`Loaded "${t.name}" — edit the indicators and signals below.`);
  };
  // Record simulated trades produced by an activated automation (deduped by id).
  // Activating a strategy places REAL positions at the live price with the strategy's
  // target/stop. The exit engine then closes them at real market prices. Nothing is
  // fabricated — no invented history, no simulated win/loss.
  /* recordAutomateTrades used to live here. It market-bought EVERY symbol the
     instant a strategy was activated, never evaluated the entry rule, and never
     sold anything. The rules were decoration. It is gone; hooks/useAutomation.js
     now evaluates the real rules against real candles once a minute and places
     both buys and sells. */

  const toggleActive = (id, relSym, size) => setStrats((p) => p.map((s) => s.id === id
    // When ACTIVATING, snap the strategy to a symbol relevant to the market you're on, so a
    // shared premium strategy deploys on (say) BTC under Crypto instead of an Indian stock,
    // and carry the per-trade size chosen on the card.
    ? { ...s, active: !s.active, ...(relSym && !s.active ? { symbols: [relSym] } : {}), ...(size != null && !s.active ? { qty: size, cap: size } : {}) }
    : s));
  /* MARKET-AWARE activation for shared PREMIUM strategies. `active` is a single flag, and a
     premium strategy carries a symbol from just one market. Activating it on the Indian tab used
     to leave it pointing at its crypto seed symbol, so it showed "Activated" in Premium but landed
     under Crypto's Active list, never IN/US. This deploys it ON THE CURRENT MARKET: activating
     (re)assigns this market's symbol so it always surfaces under this market's Deployed → Active.
     A second tap while it's active HERE deactivates it. */
  const activeInMarket = (s) => s.active && (!(s.symbols && s.symbols[0]) || marketOf(s.symbols[0]) === market);
  const togglePremiumHere = (id, relSym, size, opts) => setStrats((p) => p.map((s) => {
    if (s.id !== id) return s;
    if (activeInMarket(s)) return { ...s, active: false };
    return { ...s, active: true, cfg: withSLTP(s.cfg, opts), ...(opts && opts.tf ? { tf: opts.tf } : {}), ...(relSym ? { symbols: [relSym] } : {}), ...(size != null ? { qty: size, cap: size } : {}) };
  }));
  /* One-tap activate/deactivate used by the Backtest results rows. Deactivating just flips `active`
     off; activating snaps the strategy to a symbol relevant to the current market so it lands under
     this market's Deployed ▸ Active (mirrors bulkSetActive's per-item logic). */
  const toggleActiveHere = (s) => {
    if (!s) return;
    if (activeInMarket(s)) {
      setStrats((p) => p.map((x) => x.id === s.id ? { ...x, active: false } : x));
      setToast(`Deactivated ${s.name}`);
    } else {
      const relSym = (s.symbols || []).find((x) => marketOf(x) === market) || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols || [])[0];
      setStrats((p) => p.map((x) => x.id === s.id ? { ...x, active: true, ...(relSym ? { symbols: [relSym] } : {}) } : x));
      setToast(`Activated ${s.name}`);
    }
  };
  /* Bulk activate/deactivate every strategy in a section (Premium / Mine / My Copies). Activating snaps
     each to a symbol relevant to the current market and carries its saved qty. */
  const bulkSetActive = (items, on) => {
    const rows = (items || []).map((x) => (x && x.s) ? x.s : x);
    // Only touch the strategies that ACTUALLY need to change: activating skips ones already live in
    // this market; deactivating skips ones already off. So "Activate All" over 4 strategies where 3
    // are already active only flips the 1 that's off — and the toast reports that real number.
    const targets = rows.filter((s) => (on ? !activeInMarket(s) : activeInMarket(s)));
    if (!targets.length) { setToast(on ? "All selected strategies are already active." : "None of the selected strategies are active."); return; }
    if (on && typeof window !== "undefined" && !window.confirm(`Activate ${targets.length} strateg${targets.length > 1 ? "ies" : "y"}? They'll place orders when their rules trigger.`)) return;
    const ids = new Set(targets.map((s) => s.id));
    setStrats((p) => p.map((s) => {
      if (!ids.has(s.id)) return s;
      if (!on) return { ...s, active: false };
      // Activating snaps the strategy to a symbol in the CURRENT market (keeps its own if already here),
      // mirroring the single-card toggle so it lands under this market's Deployed ▸ Active.
      const relSym = (s.symbols || []).find((x) => marketOf(x) === market) || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols || [])[0];
      return { ...s, active: true, ...(relSym ? { symbols: [relSym] } : {}) };
    }));
    setToast(on ? `Activated ${targets.length} strateg${targets.length > 1 ? "ies" : "y"}` : `Deactivated ${targets.length} strateg${targets.length > 1 ? "ies" : "y"}`);
  };
  /* Two-button bar shown atop a strategy section. `items` is ALREADY scoped to the current market by
     the caller. Each button's count is the number it will actually change — inactive count for
     Activate, active count for Deactivate — so the numbers match what happens. */
  const BulkBar = ({ items }) => {
    const rows = (items || []).map((x) => (x && x.s) ? x.s : x);
    const offCount = rows.filter((s) => !activeInMarket(s)).length;   // will be activated
    const onCount = rows.filter((s) => activeInMarket(s)).length;     // will be deactivated
    return (
      <div style={{ display: "flex", gap: 8, margin: "4px 0 6px" }}>
        <button onClick={() => bulkSetActive(items, true)} disabled={!offCount} className="tap disp" style={{ flex: 1, borderRadius: 10, padding: "8px 6px", fontWeight: 800, fontSize: 11.5, border: "none", background: offCount ? "linear-gradient(120deg,var(--up),#0EA968)" : "var(--elev)", color: offCount ? "#fff" : "var(--muted)", cursor: offCount ? "pointer" : "not-allowed" }}>Activate All{offCount ? ` (${offCount})` : ""}</button>
        <button onClick={() => bulkSetActive(items, false)} disabled={!onCount} className="tap disp" style={{ flex: 1, borderRadius: 10, padding: "8px 6px", fontWeight: 800, fontSize: 11.5, border: "1px solid var(--line)", background: onCount ? "var(--surface)" : "var(--elev)", color: onCount ? "var(--ink)" : "var(--muted)", cursor: onCount ? "pointer" : "not-allowed" }}>Deactivate All{onCount ? ` (${onCount})` : ""}</button>
      </div>
    );
  };
  const toggleAlerts = (s) => { const willOn = !s.alerts; setStrats((p) => p.map((x) => x.id === s.id ? { ...x, alerts: willOn } : x)); if (willOn) fireAlert(s); };
  const updateStrat = (id, patch) => setStrats((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  /* Persist a card's SL/TP/symbol/timeframe edit onto the user's OWN copy of the strategy (per-user,
     saved with the rest of app state). The timeframe re-times every indicator. Rules are untouched. */
  const persistCard = (id, { sl, tp, symbol, tf, name, defs }) => setStrats((p) => p.map((s) => {
    if (s.id !== id) return s;
    const cfg = { ...(s.cfg || {}) };
    if (sl != null && sl !== "") cfg.sl = String(sl);
    if (tp != null && tp !== "") cfg.tp = String(tp);
    // Optimize Indicators writes new indicator lengths (and a tf) — set defs first so the tf remap below
    // keeps the tuned lengths and just stamps the timeframe onto them.
    if (defs) cfg.defs = defs.map((d) => ({ ...d }));
    if (tf) { cfg.tf = tf; cfg.defs = (cfg.defs || []).map((d) => ({ ...d, tf })); }
    return { ...s, cfg, ...(name != null ? { name } : {}), ...(symbol ? { symbols: [symbol] } : {}), ...(tf ? { tf } : {}) };
  }));
  /* Clone a PREMIUM strategy into the user's "My Copies" — rules stay hidden (locked); only its name,
     symbol, timeframe and SL/TP are editable. Copies never appear under "Mine". */
  const clonePremium = (s) => {
    const id = "cp" + Date.now();
    const dsz = market === "Crypto" ? 200 : 1;
    // Default the copy's suffix to its SYMBOL (market-relevant one first), matching the backtest "Create" naming.
    const sym = (s.symbols || []).find((x) => marketOf(x) === market) || (s.symbols || [])[0];
    setStrats((p) => [
      { id, name: sym ? `${s.name} - ${sym}` : `${s.name} (copy)`, by: creator, active: false, alerts: false, copy: true, locked: true, sourceName: s.name,
        cfg: { ...(s.cfg || {}) }, cap: s.cap || dsz, qty: s.qty || dsz, symbols: (s.symbols || []).slice(),
        tf: s.tf || (s.cfg && s.cfg.tf) || "5m", created: Date.now() },
      ...p,
    ]);
    setToast(`Copied "${s.name}" → My Copies. Rename it and set symbol / timeframe there.`);
    setStratTab("copies"); setTopTab("strategies");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  /* Materialise a strategy × SYMBOL combination the user explored in the backtest / optimiser but hasn't
     saved. Lands under My Copies named "{name} - {SYMBOL}", configured for that symbol. No-ops (with a
     nudge) if that exact copy already exists. */
  const copyNameFor = (strat, sym) => `${(strat && (strat.sourceName || strat.name)) || "Strategy"} - ${sym}`;
  const createCopyForSymbol = (strat, sym) => {
    if (!strat || !sym) return;
    const name = copyNameFor(strat, sym);
    // NOTE: deliberately do NOT switch tabs here — the user is optimising on the Backtesting screen and
    // should stay there. We just create the copy under Strategies ▸ My Copies and confirm with a toast.
    if (strats.some((x) => x.name === name)) { setToast(`"${name}" already exists in My Copies.`); return; }
    const id = "cp" + Date.now();
    const dsz = marketOf(sym) === "Crypto" ? 200 : 1;
    setStrats((p) => [
      { id, name, by: creator, active: false, alerts: false, copy: true, locked: !!(strat.locked), sourceName: strat.sourceName || strat.name,
        cfg: { ...(strat.cfg || {}) }, cap: strat.cap || dsz, qty: strat.qty || dsz, symbols: [sym],
        tf: strat.tf || (strat.cfg && strat.cfg.tf) || "5m", created: Date.now() },
      ...p,
    ]);
    setToast(`Created "${name}" → Strategies ▸ My Copies.`);
  };
  const [editStrat, setEditStrat] = useState(null);
  const TF_OPTS = ["3m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"];

  /* Crypto strategies trade a USD AMOUNT per trade, and the default is $200. Some older deployments
     (and IN/US seeds later run on a crypto symbol like BTC) carry a stale quantity-style size of 1,
     which is meaningless — and below Delta's minimum — in dollars. Normalize any crypto strategy whose
     amount is missing or under $10 up to the $200 default, once. The guard makes it self-terminating. */
  useEffect(() => {
    const isCrypto = (s) => s.market === "Crypto" || marketOf((s.symbols || [])[0]) === "Crypto";
    const stale = (s) => isCrypto(s) && (s.qty == null || Number(s.qty) < 10);
    if (strats.some(stale)) setStrats((p) => p.map((s) => (stale(s) ? { ...s, qty: 200, cap: 200 } : s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strats]);

  // dashboard aggregation — scoped to the selected market
  const amkt = market;
  const inMkt = (s) => !(s.symbols && s.symbols.length) || s.symbols.some((x) => marketOf(x) === amkt);
  const shown = strats.filter((s) => inMkt(s) && (dashBy === "All" || s.by === dashBy) && (symFilter.length === 0 || (s.symbols || []).some((x) => symFilter.includes(x))));
  const priceOfSym = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
  const perf = shown.map((s) => ({ s, p: stratPerf(s, trades, dashRange, priceOfSym) }));
  const agg = perf.reduce((a, { p }) => { a.trades += p.trades; a.wins += p.wins; a.pnl += (p.pnl || 0); a.cap += p.cap; a.annSum += p.annual; a.open += (p.open || 0); return a; }, { trades: 0, wins: 0, pnl: 0, cap: 0, annSum: 0, open: 0 });
  const activeCount = shown.filter((s) => s.active).length;
  const dWinRate = agg.trades ? agg.wins / agg.trades * 100 : 0;
  const dLosses = Math.max(0, agg.trades - agg.wins);
  const dRet = agg.cap ? agg.pnl / agg.cap * 100 : 0;
  const dAnn = perf.length ? agg.annSum / perf.length : 0;

  /* VIRTUAL PAPER AUTO-EXECUTION — the paper twin of the server's real-money auto-buy engine.
     In Virtual mode nothing else opens trades for a deployed Automate strategy, so 80 active
     strategies would sit "waiting for signal" forever and the dashboard would show 0 Automate
     trades. This loop scans each ACTIVE, non-paused, in-market strategy's ENTRY on its symbols and,
     when a symbol currently matches, records ONE paper trade per strategy per day (tagged
     "Automate") sized from the strategy's own capital/qty with its SL/TP. Long-only for now (short
     P&L needs sign-aware aggregation); real mode is left to the server engine. */
  // Latest trades, readable inside the scan loop without re-subscribing the effect — used to enforce
  // "one open position per strategy+symbol" (don't stack a new entry while the previous is still open).
  const tradesLiveRef = useRef([]);
  tradesLiveRef.current = trades || [];
  const hasOpenPaperPos = (sid, sym) => (tradesLiveRef.current || []).some((t) =>
    t.strategyId === sid && t.sym === sym && t.status !== "rejected" && t.entry != null && (t.exitAt == null || t.exit == null));
  useEffect(() => {
    if (appMode === "real" || !onRecord) return;
    let stop = false;
    const scan = async () => {
      if (stop || !marketOpen(market)) return;
      const cands = strats.filter((s) => s.active && !s.paused && !(s.side === "SELL" || s.short)
        && s.cfg && (s.cfg.entry || []).length > 0 && (s.symbols || []).some((x) => marketOf(x) === market));
      for (const s of cands) {
        if (stop) return;
        // ONE day = 864e5 ms (NOT the imported day-index `DAY`, which made this key roll every ~20s and
        // re-fire the strategy on every scan — stacking dozens of open positions).
        const gkey = `mx_autostrat_${s.id}_${market}_${Math.floor(Date.now() / 864e5)}`;
        if (lsGet(gkey, false)) continue;
        const syms = (s.symbols || []).filter((x) => marketOf(x) === market);
        if (!syms.length) continue;
        const tf = s.tf || (s.cfg && s.cfg.tf) || "5m";
        let matches = [];
        try {
          const sig = JSON.stringify({ e: s.cfg.entry, d: s.cfg.defs || [] });
          let hh = 5381; for (let i = 0; i < sig.length; i++) hh = ((hh * 33) ^ sig.charCodeAt(i)) >>> 0;
          matches = await scanScreener({ key: `strat:${s.id}:${(hh >>> 0).toString(36)}`, defs: s.cfg.defs || [], entry: s.cfg.entry, tf, appSyms: syms });
        } catch { matches = []; }
        if (stop) return;
        if (!matches || !matches.length) continue;
        const isCrypto = market === "Crypto";
        matches.forEach((m) => {
          // Don't open a second position for this strategy on a symbol it's already holding open.
          if (hasOpenPaperPos(s.id, m.sym)) return;
          const inst = ALL.find((a) => a.sym === m.sym);
          const price = (inst && inst.price) || m.entryPrice;
          if (!inst || !price) return;
          const notional = Number(s.qty || s.cap || (isCrypto ? 200 : 1));
          const qty = isCrypto ? +(notional / price).toFixed(6) : Math.max(1, Math.floor(notional / price) || 1);
          onRecord({
            id: `au-${s.id}-${m.sym}-${Date.now()}`, sym: m.sym, market, qty, side: "BUY",
            entry: price, entryAt: Date.now(), tradeType: "Automate", strategy: s.name, strategyId: s.id,
            sl: (s.cfg && s.cfg.sl != null) ? s.cfg.sl : null, tp: (s.cfg && s.cfg.tp != null) ? s.cfg.tp : null,
          });
        });
        lsSet(gkey, true);
      }
    };
    scan();
    const iv = setInterval(scan, 90000);   // re-scan every 90s to catch signals that fire later in the day
    return () => { stop = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, appMode, strats.map((s) => `${s.id}${s.active ? 1 : 0}${s.paused ? "p" : ""}`).join(",")]);
  /* Two kinds of strategy, and they are scored differently — deliberately.
       SAMPLE  (by "Matrix"): never traded, so no live record exists. Shown with a
                real 6-month BACKTEST on real candles, labelled as such.
       MINE    (created by the user): scored on their ACTUAL closed trades. A
                strategy with no closed trades shows "—", not a made-up win rate. */
  const [stratTab, setStratTab] = useState("deployed");   // sub-tab under "Strategies": deployed | sample | premium | public | mine
  const [lsSide, setLsSide] = useState("long");           // Long / Short filter shown above Activate All in every strategy type
  const [topTab, setTopTab] = useState("build");   // build | sample | premium | public | mine
  const [compareOpen, setCompareOpen] = useState(false);   // premium "Compare all" backtest table

  // ---- Public strategies (shared across users) ----
  const [publicList, setPublicList] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [pubSym, setPubSym] = useState("");   // symbol filter
  const [pubBy, setPubBy] = useState("");      // posted-by filter
  const refreshPublic = React.useCallback(() => {
    setPublicLoading(true);
    apiListPublicStrategies({ symbol: pubSym, by: pubBy }).then((l) => { setPublicList(Array.isArray(l) ? l : []); setPublicLoading(false); });
  }, [pubSym, pubBy]);
  useEffect(() => { if (topTab === "strategies" && stratTab === "public") refreshPublic(); }, [topTab, stratTab, refreshPublic]);
  const publishOwn = async (s) => {
    const r = await apiPublishStrategy({ id: "pub_" + s.id, name: s.name, symbols: s.symbols || [], cfg: s.cfg });
    if (r && r.ok) { updateStrat(s.id, { publicId: (r.strategy && r.strategy.id) || ("pub_" + s.id) }); setToast(`"${s.name}" is now public.`); if (stratTab === "public") refreshPublic(); }
    else setToast((r && r.error) || "Couldn't publish — make sure you're signed in.");
  };
  const unpublishOwn = async (s) => {
    if (s.publicId) await apiUnpublishStrategy(s.publicId);
    updateStrat(s.id, { publicId: null });
    setToast(`"${s.name}" removed from public.`);
    if (stratTab === "public") refreshPublic();
  };
  /* Delete a strategy (admin action on premium/sample/others' public, or your own). Removes it
     locally and, if it was public, unpublishes it too. */
  const deleteStrategy = async (s) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${s.name || "this strategy"}"?`)) return;
    if (s.publicId) { try { await apiUnpublishStrategy(s.publicId); } catch { /* ignore */ } }
    setStrats((p) => p.filter((x) => x.id !== s.id));
    setToast(`"${s.name || "Strategy"}" deleted.`);
    if (stratTab === "public") refreshPublic();
  };
  // Clone a public strategy into "My strategies" (editable, inactive).
  const clonePublic = (ps) => {
    const id = "c" + Date.now();
    setStrats((p) => [{ id, name: (ps.name || "Strategy") + " (copy)", by: creator, active: false, alerts: false, cfg: ps.data || ps.cfg || { mode: "builder" }, cap: 100000, symbols: ps.symbols || [], created: Date.now() }, ...p]);
    setToast(`Cloned "${ps.name}" into My strategies.`);
    setStratTab("mine"); setTopTab("strategies");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const publicByOptions = useMemo(() => Array.from(new Set(publicList.map((s) => s.owner_name).filter(Boolean))), [publicList]);
  const publicSymOptions = useMemo(() => Array.from(new Set(publicList.flatMap((s) => s.symbols || []))), [publicList]);
  const [activeTab, setActiveTab] = useState("active"); // active | inactive (inside My strategies)
  const [stratSymFilter, setStratSymFilter] = useState([]);   // symbol multi-select for the buckets ([] = All)
  const stratsRef = useRef(null);
  const sampleStrats = perf.filter(({ s }) => s.by === "Matrix" && !s.premium);
  // Premium strategies are shown in EVERY market (not market-filtered) and are locked:
  // name + description only, activate + backtest, no template/edit.
  const premiumStrats = strats.filter((s) => s.premium);
  // Long vs Short split — a strategy carries side:"SELL" on its short mirror. Each strategy tab
  // shows a "Long" group and a "Short" group so the two directions never mix together.
  const isShortStrat = (s) => s.side === "SELL" || (s.cfg && s.cfg.side === "SELL");
  const longOf  = (arr, sel = (x) => x) => arr.filter((x) => !isShortStrat(sel(x)));
  const shortOf = (arr, sel = (x) => x) => arr.filter((x) => isShortStrat(sel(x)));
  const perfSel = (x) => x.s;   // sampleStrats/mineOwn/myCopies items are { s, p }
  /* A strategy belongs to the market of the symbol it's deployed on. So a crypto strategy
     doesn't show under US. Strategies with no symbol yet appear in every market. */
  const stratInMarket = (s) => { const sy = (s.symbols || [])[0]; return !sy || marketOf(sy) === market; };
  // The Backtest optimiser considers EVERY strategy the user has for this market — premium, samples,
  // mine and copies (premium show in all markets, everything else is market-scoped). That's why the
  // "Existing" view can recognise the user's own BTC strategies, not only the premium catalogue.
  const allBucketStrats = strats.filter((s) => s.premium || stratInMarket(s));
  // "Mine" = ONLY strategies this user BUILT (not samples, premium, others' public, or copies of premium).
  const mineOwn      = perf.filter(({ s }) => s.by === creator && !s.copy && stratInMarket(s));
  const myStrats     = mineOwn;
  // "My Copies" = the user's copies of Premium strategies — rules hidden, name/symbol/tf/SL/TP editable.
  const myCopies     = perf.filter(({ s }) => s.copy && stratInMarket(s));
  // SYMBOL FILTER — a multi-select over every symbol used by this market's strategies. [] = All.
  // Applied to every bucket below (Deployed / Samples / Premium / Mine / Copies) so the user can narrow
  // each list to one or more symbols. `symOk` accepts either a raw strategy or a { s } perf item.
  const availSyms = [...new Set(allBucketStrats.flatMap((s) => s.symbols || []))].filter((x) => marketOf(x) === market).sort();
  const symOk = (x) => { const s = (x && x.s) ? x.s : x; return !stratSymFilter.length || (s.symbols || []).some((y) => stratSymFilter.includes(y)); };
  // Long/Short groups per tab (symbol-filtered).
  const sampleLong = longOf(sampleStrats, perfSel).filter(symOk), sampleShort = shortOf(sampleStrats, perfSel).filter(symOk);
  const premiumLong = longOf(premiumStrats).filter(symOk), premiumShort = shortOf(premiumStrats).filter(symOk);
  const mineLong = longOf(mineOwn, perfSel).filter(symOk), mineShort = shortOf(mineOwn, perfSel).filter(symOk);
  const copiesLong = longOf(myCopies, perfSel).filter(symOk), copiesShort = shortOf(myCopies, perfSel).filter(symOk);
  const emptyNote = { fontSize: 11.5, color: "var(--muted)", margin: "2px 2px 6px" };
  /* "Deployed" spans EVERY type (Mine, Premium, Sample, Public), split into Active
     (running now) and Inactive, each shown with its type + state tag — market-filtered.
     Every active/armed strategy shows here (including a just-activated premium that hasn't
     traded yet); the "Live" section separately shows only those holding a position. */
  const deployedActive   = strats.filter((s) => s.active && stratInMarket(s) && symOk(s)).map((s) => ({ s, p: stratPerf(s, trades, dashRange) }));
  const deployedInactive = strats.filter((s) => !s.active && stratInMarket(s) && symOk(s)).map((s) => ({ s, p: stratPerf(s, trades, dashRange) }));
  const myActive     = deployedActive;
  const myInactive   = deployedInactive;
  const byOptions = ["All", "Matrix", "You", "Community"];
  const dsel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 8px", fontSize: 11.5 };
  const fmtDate = (t) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

  const DStat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 0", minWidth: 0, background: "rgba(0,0,0,.05)", borderRadius: 14, padding: "10px 8px" }}>
      <div style={{ fontSize: 9, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em", whiteSpace: "nowrap" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 15, marginTop: 3, color: c || "#141416" }}>{v}</div>
    </div>
  );
  const MetricMini = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 74 }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  const StrategyCard = ({ s, p }) => {
    /* PERMISSIONS. Non-admins can only Edit/Clone/Publish their OWN strategies. Admins can also
       manage premium/sample and other people's public strategies (publish/unpublish/delete/clone). */
    const own = s.by === creator;
    const sampleOrPremium = s.premium || s.by === "Matrix";
    const canEdit = own || isAdmin;
    const canClone = own || isAdmin;
    const showPublishToggle = own || (isAdmin && sampleOrPremium);   // publish/unpublish
    const showUnpublishOnly = isAdmin && !own && !sampleOrPremium && !!s.publicId;  // admin: unpublish others' public
    // Owners can delete their OWN strategy; admins can delete anyone's (premium/sample + others' public).
    const canDelete = own || isAdmin;
    /* Open positions this strategy opened but hasn't exited yet -> "Entry triggered" + live P&L. */
    const openTrades = (trades || []).filter((t) => (t.strategyId === s.id || t.strategy === s.name) && t.entryAt != null && t.exitAt == null);
    const entryTriggered = openTrades.length > 0;
    const livePnl = openTrades.reduce((a, t) => {
      const st = ALL.find((x) => x.sym === t.sym);
      const cur = st && st.price != null ? st.price : t.entry;
      return a + (cur - t.entry) * (t.qty || 1);
    }, 0);
    const liveMkt = openTrades[0] ? (marketOf(openTrades[0].sym) || "IN") : "IN";
    return (
    <div className="card" style={{ padding: 15, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, flex: "0 0 auto", background: s.active ? "var(--up)" : "var(--muted)", boxShadow: s.active ? "0 0 0 4px var(--up-soft)" : "none" }} />
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Created by {creatorOf(s)} · started {fmtDate(s.created)} · {fmt(s.cap || 100000, "IN")}</div>
            {s.symbols && s.symbols.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                {s.symbols.slice(0, 4).map((sy) => <span key={sy} className="pill" style={{ fontSize: 9.5, fontWeight: 700, background: "var(--primary-soft)", color: "var(--primary)", padding: "2px 8px" }}>{sy}</span>)}
                {s.symbols.length > 4 && <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, alignSelf: "center" }}>+{s.symbols.length - 4}</span>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flex: "0 0 auto", alignItems: "center" }}>
          {entryTriggered && <span className="pill" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".03em", padding: "3px 8px", background: "var(--amber-soft, rgba(245,158,11,.15))", color: "var(--amber, #F59E0B)", border: "1px solid var(--amber, #F59E0B)", display: "inline-flex", alignItems: "center", gap: 3 }}>● ENTRY TRIGGERED</span>}
          <span className="pill" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".03em", padding: "3px 8px", background: s.active ? "var(--up-soft)" : "var(--elev)", color: s.active ? "var(--up)" : "var(--muted)", border: "1px solid var(--line)" }}>{s.active ? "ACTIVE" : "INACTIVE"}</span>
          {(() => {
            const t = s.premium ? "Premium" : s.by === "Matrix" ? "Sample" : s.publicId ? "Public" : "Mine";
            const c = { Premium: "var(--gold)", Sample: "var(--primary)", Public: "var(--up)", Mine: "var(--primary)" }[t];
            return <span className="pill" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".03em", padding: "3px 8px", background: "var(--elev)", color: c, border: "1px solid var(--line)" }}>{t.toUpperCase()}</span>;
          })()}
          {s.alerts && <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 8px", display: "flex", alignItems: "center", gap: 3 }}><Bell size={10} /> Alerts</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        {/* A strategy with no closed trades has NO win rate. stratPerf returns null
            rather than inventing one, so every figure here must handle null. */}
        <MetricMini k="Trades" v={p.trades} />
        <MetricMini k="Win rate" v={p.winRate == null ? "—" : p.winRate.toFixed(0) + "%"} />
        <MetricMini k="P&L" v={p.pnl == null ? "—" : (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, market)} c={chgColor(p.pnl)} />
        <MetricMini k="Returns" v={pct(p.retPct, 1)} c={chgColor(p.retPct)} />
        <MetricMini k="Stop-loss" v={(s.cfg && s.cfg.sl != null && s.cfg.sl !== "") ? s.cfg.sl + "%" : "—"} c="var(--down)" />
        <MetricMini k="Target" v={(s.cfg && s.cfg.tp != null && s.cfg.tp !== "") ? s.cfg.tp + "%" : "—"} c="var(--up)" />
      </div>
      {/* Deploy size — AMOUNT (USD) for crypto, QUANTITY for other markets. Default $10 / 1 qty. */}
      {(() => {
        const isC = market === "Crypto";
        const step = isC ? 10 : 1;
        const val = s.qty != null ? s.qty : (isC ? 200 : 1);
        const set = (n) => { const v = Math.max(isC ? 1 : 1, n); updateStrat(s.id, { qty: v, cap: v }); };
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{isC ? "Amount per trade (USD)" : "Quantity per trade"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => set(Number(val) - step)} className="tap" style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", fontWeight: 800 }}>−</button>
              {isC && <span className="mono" style={{ fontWeight: 800, fontSize: 12, color: "var(--muted)" }}>$</span>}
              <input value={val} onChange={(e) => { const n = isC ? parseFloat(e.target.value.replace(/[^0-9.]/g, "")) : parseInt(e.target.value.replace(/[^0-9]/g, ""), 10); set(Number.isFinite(n) && n > 0 ? n : 1); }} inputMode={isC ? "decimal" : "numeric"} className="mono no-ring" style={{ width: 56, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 12.5, background: "var(--elev)", color: "var(--ink)" }} />
              <button onClick={() => set(Number(val) + step)} className="tap" style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", fontWeight: 800 }}>+</button>
            </div>
          </div>
        );
      })()}
      {entryTriggered && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "9px 12px", borderRadius: 12, background: "var(--elev)", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Live P&amp;L · {openTrades.length} open</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: chgColor(livePnl) }}>{livePnl >= 0 ? "+" : ""}{fmt(livePnl, liveMkt)}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        {canEdit && <button onClick={() => setEditStrat(editStrat === s.id ? null : s.id)} className="tap" title="Edit symbols & timeframe" style={{ border: "1px solid " + (editStrat === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: editStrat === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: editStrat === s.id ? "var(--primary)" : "var(--ink)" }}><SlidersHorizontal size={14} /></button>}
        {canEdit && <button onClick={() => loadForEdit(s)} className="tap" title="Edit this strategy's rules in the builder" style={{ border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}><Pencil size={13} /> Edit</button>}
        <button onClick={() => toggleAlerts(s)} className="tap" title="Alert on entry/exit signal" style={{ border: "1px solid " + (s.alerts ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.alerts ? "var(--primary)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: s.alerts ? "var(--on-primary)" : "var(--ink)" }}><Bell size={14} /></button>
        <button onClick={() => setBtOpen(btOpen === s.id ? null : s.id)} className="tap" style={{ border: "1px solid " + (btOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: btOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: btOpen === s.id ? "var(--primary)" : "var(--ink)" }}><Activity size={13} /> Test</button>
        <button onClick={() => setLedgerOpen(ledgerOpen === s.id ? null : s.id)} className="tap" title="Every trade this strategy has taken" style={{ border: "1px solid " + (ledgerOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: ledgerOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: ledgerOpen === s.id ? "var(--primary)" : "var(--ink)" }}><ListChecks size={13} /> Trades</button>
        {canClone && <button onClick={() => cloneStrategy(s)} className="tap" title="Clone into a new editable strategy" style={{ border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: "var(--ink)" }}><Copy size={14} /></button>}
        {showPublishToggle
          ? <button onClick={() => (s.publicId ? unpublishOwn(s) : publishOwn(s))} className="tap" title={s.publicId ? "Remove from public" : "Make public"} style={{ border: "1px solid " + (s.publicId ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.publicId ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: s.publicId ? "var(--primary)" : "var(--ink)" }}><Globe size={13} /> {s.publicId ? "Public" : "Publish"}</button>
          : showUnpublishOnly
            ? <button onClick={() => unpublishOwn(s)} className="tap" title="Remove from public" style={{ border: "1px solid var(--primary)", borderRadius: 11, background: "var(--primary-soft)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: "var(--primary)" }}><Globe size={13} /> Unpublish</button>
            : null}
        {canDelete && <button onClick={() => deleteStrategy(s)} className="tap" title="Delete strategy" style={{ border: "1px solid var(--down)", borderRadius: 11, background: "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: "var(--down)" }}><Trash2 size={14} /></button>}
        <button onClick={() => toggleActive(s.id)} className="tap disp" style={{ flex: "1 1 100px", borderRadius: 11, background: s.active ? "var(--surface)" : "linear-gradient(120deg,var(--up),#0EA968)", color: s.active ? "var(--ink)" : "#fff", boxShadow: s.active ? "none" : "0 6px 16px rgba(16,185,129,.3)", padding: "7px 10px", display: "flex", gap: 5, alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, border: s.active ? "1px solid var(--line)" : "none" }}>
          {s.active ? <><Pause size={13} /> Deactivate</> : <><Play size={13} /> Activate</>}
        </button>
        {/* Real-money auto-buy: REAL mode only, and only for the user's OWN strategies. Once armed
            it shows a non-clickable "Real Live" badge so it can't be armed twice. In Virtual mode
            this is hidden entirely — paper strategies never place real orders. */}
        {appMode === "real" && (isArmedReal(s)
          ? <span className="pill" title="This strategy is live on your broker" style={{ border: "1px solid var(--down)", borderRadius: 11, background: "var(--down-soft)", color: "var(--down)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 800, cursor: "default" }}><Bolt size={13} /> ● Real Live</span>
          : <button onClick={() => { const opening = liveStrat !== s.id; setLiveStrat(opening ? s.id : null); setLiveMsg(null); if (opening) setLiveAmt(String(s.qty != null ? s.qty : (market === "Crypto" ? 200 : 1))); }} className="tap disp" title="Trade this strategy with real money" style={{ border: "1px solid var(--down)", borderRadius: 11, background: liveStrat === s.id ? "var(--down-soft)" : "var(--surface)", color: "var(--down)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 800 }}><Bolt size={13} /> Go Live</button>)}
      </div>
      {appMode === "real" && liveStrat === s.id && !isArmedReal(s) && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11.5, color: "var(--down)", fontWeight: 800, marginBottom: 6 }}>⚠ Real-money auto-buy</div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 10 }}>
            The server will place a REAL buy on your connected broker when this strategy's entry fires, and auto-exit it on your SL/TP/signal — even with the app closed. One position at a time.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={liveAmt} onChange={(e) => setLiveAmt(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount per trade" inputMode="decimal" className="no-ring mono" style={{ ...selStyle, flex: "1 1 120px", textAlign: "center" }} />
            <select value={liveProduct} onChange={(e) => setLiveProduct(e.target.value)} aria-label="Product" style={{ ...selStyle, flex: "1 1 110px" }}>
              <option value="Intraday">Intraday (MIS)</option>
              <option value="Delivery">NRML / Delivery</option>
            </select>
          </div>
          {liveMsg && <div style={{ fontSize: 11.5, marginTop: 8, fontWeight: 600, color: liveMsg.e ? "var(--down)" : "var(--up)" }}>{liveMsg.t}</div>}
          <button onClick={() => armLive(s)} disabled={liveBusy} className="tap disp glow" style={{ width: "100%", marginTop: 10, background: "linear-gradient(120deg,var(--down),#E0455E)", color: "#fff", border: "none", borderRadius: 11, padding: 11, fontWeight: 800, fontSize: 12.5 }}>{liveBusy ? "Arming…" : "Arm real-money auto-buy"}</button>
        </div>
      )}
      {editStrat === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Symbols</div>
          <MultiSelect label="Symbols" options={DEPLOY_OPTIONS} value={s.symbols || []} onChange={(v) => updateStrat(s.id, { symbols: v })} allLabel="Select…" />
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, margin: "12px 0 6px" }}>{market === "Crypto" ? "Amount to be deployed (per trade)" : "Capital deployed (quantity per trade)"}</div>
          <input
            value={String(s.qty ?? s.cap ?? 1)}
            onChange={(e) => { const n = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 1); updateStrat(s.id, { qty: n, cap: n }); }}
            inputMode="numeric" placeholder="100"
            className="no-ring mono"
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 14, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, margin: "12px 0 6px" }}>Timeframe</div>
          <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {TF_OPTS.map((x) => (
              <button key={x} onClick={() => updateStrat(s.id, { tf: x })} className="pill tap disp" style={{ flex: "0 0 auto", padding: "6px 13px", fontSize: 11.5, fontWeight: 700, border: "1px solid " + ((s.tf || "5m") === x ? "var(--primary)" : "var(--line)"), background: (s.tf || "5m") === x ? "var(--primary)" : "var(--surface)", color: (s.tf || "5m") === x ? "var(--on-primary)" : "var(--ink)" }}>{x}</button>
            ))}
          </div>
          {/* Optimize SL & TP and Optimize Indicators for this deployed strategy — applied to this
              strategy's own config (per-user), on its first symbol. */}
          {(() => {
            const eTf = s.tf || (s.cfg && s.cfg.tf) || "5m";
            const eCfg = { ...(s.cfg || {}), tf: eTf };
            const eSym = (s.symbols || [])[0];
            return (
              <div style={{ marginTop: 12 }}>
                <CardOptimizeButton cfg={eCfg} sym={eSym} tf={eTf} sl={(s.cfg && s.cfg.sl) || ""} tp={(s.cfg && s.cfg.tp) || ""}
                  setSl={(v) => updateStrat(s.id, { cfg: { ...(s.cfg || {}), sl: String(v) } })}
                  setTp={(v) => updateStrat(s.id, { cfg: { ...(s.cfg || {}), tp: String(v) } })} />
                <CardIndicatorOptimizeButton cfg={eCfg} sym={eSym} tf={eTf} sl={(s.cfg && s.cfg.sl) || ""} tp={(s.cfg && s.cfg.tp) || ""}
                  onApply={(defs, ntf) => updateStrat(s.id, { cfg: { ...(s.cfg || {}), defs: defs.map((d) => ({ ...d, tf: ntf })), tf: ntf }, tf: ntf })} />
              </div>
            );
          })()}
          <button onClick={() => setEditStrat(null)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 11, padding: 10, fontWeight: 700, fontSize: 12.5 }}>Done</button>
        </div>
      )}
      {ledgerOpen === s.id && (() => {
        // Every trade this strategy took (matched by id or name), newest first. Realized P&L only
        // for closed trades — no "missed P&L" estimate, per the product decision.
        const rows = (trades || []).filter((t) => (t.strategyId === s.id || t.strategy === s.name)).sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
        const mkt = (t) => marketOf(t.sym) || "IN";
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><ListChecks size={13} /> List of trades ({rows.length})</div>
            {rows.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>No trades yet — this strategy hasn't triggered.</div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
                  <thead>
                    <tr>
                      {["Symbol", "Side", "Entry", "Entry time", "Exit", "Exit time", "Exit type", "P&L"].map((h, hi) => (
                        <th key={h} style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: hi === 7 ? "right" : "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 60).map((t, i) => {
                      const closed = t.exitAt != null && t.exit != null && t.exitType !== "Open";
                      const dir = (t.side === "SELL" || t.short) ? -1 : 1;   // shorts profit when price falls
                      const pnl = closed ? (t.exit - t.entry) * (t.qty || 1) * dir : null;
                      const dtf = (ms) => ms ? new Date(ms).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
                      const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
                      return (
                        <tr key={t.id || i}>
                          <td style={{ ...td, fontWeight: 800 }}>{t.sym}</td>
                          <td style={{ ...td, color: dir < 0 ? "var(--down)" : "var(--up)" }}>{t.side || "BUY"}</td>
                          <td style={td}>{fmt(t.entry, mkt(t))}</td>
                          <td style={{ ...td, color: "var(--muted)" }}>{dtf(t.entryAt)}</td>
                          <td style={td}>{closed ? fmt(t.exit, mkt(t)) : <span style={{ color: "var(--primary)", fontWeight: 800 }}>Open</span>}</td>
                          <td style={{ ...td, color: "var(--muted)" }}>{closed ? dtf(t.exitAt) : "—"}</td>
                          <td style={{ ...td, color: "var(--muted)" }}>{closed ? (t.exitType || "Closed") : "—"}</td>
                          <td style={{ ...td, textAlign: "right", color: closed ? chgColor(pnl) : "var(--muted)" }}>{closed ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, mkt(t))}` : "open"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
      {btOpen === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg || { mode: "plain" }} defaultSym={(s.symbols && s.symbols[0]) || undefined} defaultTf={s.tf || "5m"} blocked={!canBacktest} onConnect={onConnectBroker} />
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>Automate with Neo</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{{ IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market]} strategies · track performance and manage automations.</div>

      {/* Automation Dashboard — moved ABOVE the deployed lists so the headline P&L is the first
          thing you see. Collapsed: a Win/Loss + P&L strip with an expand chevron. */}
      {!dashOpen ? (
        <button onClick={() => setDashOpen(true)} className="tap disp card flat" style={{ width: "100%", marginTop: 14, border: "1px solid var(--line)", outline: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.02), 0 10px 30px rgba(0,0,0,.28)", background: "var(--card-grad)", color: "var(--ink)", borderRadius: 24, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 10, opacity: .8, fontWeight: 700 }}>WIN / LOSS</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{agg.wins} : {dLosses}</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 10, opacity: .8, fontWeight: 700 }}>P&amp;L</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: agg.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{agg.pnl >= 0 ? "+" : ""}{fmt(agg.pnl, market)}</div>
          </div>
          <span style={{ marginLeft: "auto", display: "grid", placeItems: "center" }}><ChevronDown size={16} /></span>
        </button>
      ) : (
      <div className="card flat" style={{ marginTop: 14, padding: 18, border: "1px solid var(--line)", outline: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.02), 0 10px 30px rgba(0,0,0,.28)", background: "var(--card-grad)", color: "var(--ink)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Automation Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10.5, opacity: .85 }}>{(DASH_PRESETS.find(([v]) => v === dashPreset) || [null, "Today"])[1]}</span>
            <button onClick={() => setDashOpen(false)} className="tap" title="Collapse" style={{ flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid rgba(0,0,0,.12)", background: "rgba(0,0,0,.06)", color: "#141416", borderRadius: 10, padding: "5px" }}><ChevronUp size={15} /></button>
          </div>
        </div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 6, color: agg.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{agg.pnl >= 0 ? "+" : ""}{fmt(agg.pnl, market)}</div>
        <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>{activeCount} active of {shown.length} strategies · {agg.open} still open</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <DStat k="Returns %" v={(dRet >= 0 ? "+" : "") + dRet.toFixed(2) + "%"} c={dRet >= 0 ? "var(--up)" : "var(--down)"} />
          <DStat k="Win rate" v={agg.trades ? dWinRate.toFixed(0) + "%" : "—"} />
          <DStat k="Win / Loss" v={agg.wins + " : " + dLosses} />
          <DStat k="Trades" v={agg.trades} />
        </div>
        {(
          <>
            <div style={{ fontSize: 10, opacity: .7, fontWeight: 700, letterSpacing: ".04em", margin: "16px 0 7px" }}>FILTERS</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select aria-label="Created by" value={dashBy} onChange={(e) => setDashBy(e.target.value)} style={dsel}>{byOptions.map((o) => <option key={o} value={o}>Created by: {o}</option>)}</select>
              <select aria-label="Time period" value={dashPreset} onChange={(e) => setDashPreset(e.target.value)} style={dsel}>{DASH_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            {dashPreset === "custom" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="date" aria-label="From" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} className="no-ring mono" style={{ ...dsel, colorScheme: "light" }} />
                <input type="date" aria-label="To" value={dashTo} onChange={(e) => setDashTo(e.target.value)} className="no-ring mono" style={{ ...dsel, colorScheme: "light" }} />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <MultiSelect label="Symbol" options={DEPLOY_OPTIONS} value={symFilter} onChange={setSymFilter} />
            </div>
          </>
        )}
      </div>
      )}

      {/* Live Real Deployed — REAL mode only (real-money armed strategies). */}
      {appMode === "real" && <div style={{ marginTop: 14 }}><LiveAutoBuys userId={userId} market={market} isAdmin={isAdmin} adminKey={adminKey} /></div>}

      {/* Virtual Live Deployed — the paper-mode twin of "Live Real Deployed": every ACTIVE
          paper strategy for this market, with its simulated P&L. VIRTUAL mode only. */}
      {appMode !== "real" && (() => {
        /* Latest ENTRY first: a strategy that just opened a paper trade sits at the top. */
        const lastEntry = (s) => (trades || []).reduce((mx, t) => ((t.strategyId === s.id || t.strategy === s.name) && (t.entryAt || 0) > mx ? t.entryAt : mx), 0);
        const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
        const vd = strats.filter((s) => s.active && inMkt(s))
          .map((s) => ({ s, p: stratPerf(s, trades, dashRange, priceOf), e: lastEntry(s) }))
          // "Live" means a position is actually OPEN right now (entry fired, exit/SL/TP not yet). A
          // deployed strategy still waiting for its signal isn't live, so it doesn't belong here.
          .filter((x) => x.p && x.p.open > 0)
          .sort((a, b) => b.e - a.e);
        if (!vd.length) return null;
        /* PAPER controls, mirroring "Live Real Deployed": Pause keeps the strategy deployed but stops
           it taking new signals; Stop removes it from the deployed list (deactivates it). Both just
           flip flags on the local strategy — there's no broker involved in paper mode. */
        const vPause = (s) => setStrats((p) => p.map((x) => x.id === s.id ? { ...x, paused: !x.paused } : x));
        /* Stop = close the open paper position(s) at the live price (realising P&L), then deactivate. */
        const vStop = (s) => {
          if (typeof window !== "undefined" && !window.confirm(`Close ${s.name || (s.symbols && s.symbols[0]) || "this strategy"} now? This sells its open paper position at the live price.`)) return;
          if (onCloseStrategy) onCloseStrategy(s.id);
          else setStrats((p) => p.map((x) => x.id === s.id ? { ...x, active: false } : x));
        };
        /* Edit SL/TP → persisted onto the strategy's exit config so the paper exit engine uses them. */
        const vUpdate = (s, { sl, tp }) => setStrats((p) => p.map((x) => x.id === s.id ? { ...x, cfg: { ...(x.cfg || {}), sl: sl || null, tp: tp || null } } : x));
        return (
          <div className="card" style={{ padding: 14, marginTop: 12, border: "1px solid var(--primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Sparkles size={15} color="var(--primary)" />
              <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Virtual Live</div>
              <span className="pill" style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, padding: "3px 8px", background: "var(--elev)", color: "var(--muted)" }}>PAPER</span>
            </div>
            <CollapsibleList items={vd} initial={5} reverse={false} render={({ s, p }) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{s.name || (s.symbols && s.symbols[0]) || "Strategy"}{s.paused && <span style={{ color: "var(--muted)", fontWeight: 700 }}> · paused</span>}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{(s.symbols || []).join(", ") || "—"} · Created by {creatorOf(s)}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{p.positions} position{p.positions === 1 ? "" : "s"}{p.open ? ` · ${p.open} open` : ""}{p.winRate != null ? ` · ${p.winRate.toFixed(0)}% win` : ""}</div>
                  <SlTpEditor sl={s.cfg && s.cfg.sl != null ? s.cfg.sl : null} tp={s.cfg && s.cfg.tp != null ? s.cfg.tp : null} onSave={(v) => vUpdate(s, v)} />
                </div>
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {/* Show combined realised + unrealised P&L whenever the strategy holds ANY position. */}
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 800, color: chgColor(p.pnl) }}>{p.positions && p.pnl != null ? (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, market) : "—"}</div>
                    {p.positions && p.pnl != null
                      ? <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: chgColor(p.retPct) }}>{p.open ? "incl. live" : (p.retPct >= 0 ? "+" : "") + (p.retPct || 0).toFixed(2) + "%"}</div>
                      : <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{s.paused ? "paused" : "waiting for signal"}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => vPause(s)} className="tap" style={{ border: "1px solid " + (s.paused ? "var(--up)" : "var(--line)"), background: s.paused ? "var(--up-soft)" : "transparent", color: s.paused ? "var(--up)" : "var(--muted)", borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 800 }}>{s.paused ? "▶ Start" : "❚❚ Pause"}</button>
                    <button onClick={() => vStop(s)} className="tap" title="Sell the open paper position now and stop the strategy" style={{ border: "1px solid var(--down)", background: "var(--down-soft)", color: "var(--down)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 2 }}><X size={10} /> Stop &amp; sell</button>
                  </div>
                </div>
              </div>
            )} />
          </div>
        );
      })()}

      {/* TOP SELECTOR — one place to switch between building, samples, and your own. */}
      <div className="hide-scroll" style={{ display: "flex", gap: 7, marginTop: 18, overflowX: "auto" }}>
        {[["build", "Build"], ["strategies", "Strategies"], ["pnl", "P&L"], ["backtest", "Backtesting"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTopTab(k)}
            className="tap disp"
            style={{
              flex: 1, borderRadius: 10, padding: "10px 2px", fontWeight: 800, fontSize: 10.5,
              cursor: "pointer",
              border: "1px solid " + (topTab === k ? "var(--primary)" : "var(--line)"),
              background: topTab === k ? "var(--primary)" : "var(--surface)",
              color: topTab === k ? "var(--on-primary)" : "var(--ink)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BUILD ZONE — the builder is always expanded (no create/close toggle). */}
      {topTab === "build" && (<>
      {(
        <div className="fade">
          {/* how do you want to build it? */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            {[["builder", "🧩 Visual builder"], ["plain", "✍️ Plain English"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className="tap disp" style={{ flex: 1, padding: "12px 10px", borderRadius: 14, fontWeight: 700, fontSize: 12.5, border: "1px solid " + (mode === k ? "var(--primary)" : "var(--line)"), background: mode === k ? "var(--primary-soft)" : "var(--surface)", color: mode === k ? "var(--primary)" : "var(--ink)" }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 0", lineHeight: 1.5 }}>{mode === "plain" ? "Just describe your entry and exit rules in your own words — no indicators to pick. Matrix interprets them when you deploy." : "Pick indicators, then stack them into signals with AND / OR."}</div>

          {/* Strategy name — first thing, before the steps. */}
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            {/* Strategy name + Deploy-on symbol share ONE row (name flexes, symbol sits beside it). */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Strategy name{editingId ? " · editing" : ""}</div>
                <input value={stratName} onChange={(e) => setStratName(e.target.value)} placeholder="e.g. Momentum Rider" className="no-ring disp" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
              </div>
              <div style={{ flex: "0 0 132px" }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Deploy on</div>
                <select value={deploySyms[0] || ""} onChange={(e) => setDeploySyms(e.target.value ? [e.target.value] : [])} aria-label="Deploy symbol" style={{ ...selStyle, width: "100%" }}>
                  <option value="">Symbol…</option>
                  {DEPLOY_OPTIONS.map((sy) => <option key={sy} value={sy}>{sy}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>The strategy runs on this instrument.</div>
            {/* Options are only offered where they exist: any Indian/US/Commodity underlying, but in CRYPTO
                only BTC and ETH have a listed options market — so the "trade options" toggle is hidden for
                every other coin. */}
            {!(market === "Crypto" && !deploySyms.some((x) => x === "BTC" || x === "ETH")) && (
              <OptionLeg symbols={deploySyms.length ? deploySyms : ["NIFTY50"]} value={optLeg} onChange={setOptLeg} />
            )}
          </div>

          {mode === "builder" && (
            <>
              {/* Strategy Ideas (templates) — hidden while EDITING an existing strategy, so you
                  don't accidentally overwrite your own indicators by tapping a template. */}
              {!editingId && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "18px 2px 10px", display: "flex", alignItems: "center", gap: 7 }}><Sparkles size={14} color="var(--primary)" /> Strategy Ideas — pick a symbol, then activate</div>
                  <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2 }}>
                    {TEMPLATES.map((t) => (
                      <TemplateCard key={t.name} t={t} market={market} onActivate={activateTemplate} onToggleBt={(n) => setBtTpl(btTpl === n ? null : n)} btActive={btTpl === t.name} onLoad={loadTemplate} selected={selectedTpl === t.name} />
                    ))}
                  </div>
                </>
              )}
              {btTpl && (
                <div className="card" style={{ marginTop: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>Backtest · {btTpl} <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>· pick a stock or index</span></span>
                    <X size={18} className="tap" color="var(--muted)" onClick={() => setBtTpl(null)} />
                  </div>
                  <BacktestResult cfg={(TEMPLATES.find((x) => x.name === btTpl) || {}).cfg} defaultSym={DEPLOY_OPTIONS[0]} blocked={!canBacktest} onConnect={onConnectBroker} />
                </div>
              )}

              {/* Step 1 — define indicators */}
              <div className="card" style={{ marginTop: 16, padding: 16 }}>
                <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 1</span> Your indicators
                </div>
                <div className="gold-line" style={{ width: 40, margin: "10px 0 14px", borderRadius: 2 }} />
                {/* Timeframe — the default for every indicator. Changing it re-times all indicators to it,
                    just like the Plain-English builder's timeframe. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 800 }}>Timeframe</span>
                  <select aria-label="Timeframe" value={tf} onChange={(e) => { const v = e.target.value; setTf(v); setDefs((p) => p.map((d) => ({ ...d, tf: v }))); }} style={{ ...selStyle, flex: "0 0 auto", width: "auto", fontSize: 12.5, fontWeight: 700 }}>
                    {TFS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>applies to all indicators</span>
                </div>
                <IndicatorDefs defs={defs} setDefs={setDefs} defaultTf={tf} />
              </div>
            </>
          )}

          {/* Signals (builder) / plain-English description */}
          <div className="card" style={{ marginTop: 14, padding: 16 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
              {mode === "builder" ? <><span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 2</span> Signals</> : <><Sparkles size={16} color="var(--primary)" /> Describe your strategy</>}
            </div>
            <div className="gold-line" style={{ width: 40, margin: "10px 0 16px", borderRadius: 2 }} />

            {mode === "builder" ? (
              <>
                <CondBuilder2 label="Entry signal — combine indicators with AND / OR" conds={entryConds} setConds={setEntryConds} operands={operands} />
                <div className="silver-line" style={{ margin: "16px 0" }} />
                <CondBuilder2 label="Exit signal — when to close the position" conds={exitConds} setConds={setExitConds} operands={operands} />
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Timeframe</div>
                <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }}>
                  {[["3m", "3m"], ["5m", "5m"], ["15m", "15m"], ["30m", "30m"], ["1h", "1h"], ["4h", "4h"], ["1d", "1D"], ["1w", "1W"], ["1mo", "1M"]].map(([x, lbl]) => (
                    <button key={x} onClick={() => setTf(x)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 12, fontWeight: 700, border: "1px solid " + (tf === x ? "var(--primary)" : "var(--line)"), background: tf === x ? "var(--primary)" : "var(--surface)", color: tf === x ? "var(--on-primary)" : "var(--ink)" }}>{lbl}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Entry rules — in plain English</div>
                <textarea value={pEntry} onChange={(e) => setPEntry(e.target.value)} placeholder="e.g. EMA 21 > EMA 50 and RSI > 60 — or: bullish on 3m + 5m + 15m — or: price bounces off support, MACD crosses above signal, three white soldiers." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {eParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700, display: "flex", gap: 5 }}><Sparkles size={12} style={{ flex: "0 0 auto", marginTop: 1 }} /><span>Neo reads: buy when {neoReads(eParsed.conds)}.</span></div>}
                {suggestion && suggestion.indicators.length > 0 && (
                  <div style={{ marginTop: 8, border: "1px solid var(--primary)", background: "var(--primary-soft)", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--primary)" }}><Sparkles size={14} /> Neo suggests a {suggestion.bias === "reversal" ? "mean-reversion" : "momentum"} strategy</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink)", marginTop: 8, lineHeight: 1.55 }}><b>Buy when</b> {neoReads(suggestion.entry)}.</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink)", marginTop: 4, lineHeight: 1.55 }}><b>Exit when</b> {suggestion.exit.length ? neoReads(suggestion.exit) : "the stop-loss or target is hit"}.</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>Uses {suggestion.indicators.join(" · ")} · defaults you can edit after confirming</div>
                    <button onClick={applySuggestion} className="tap disp" style={{ marginTop: 10, width: "100%", border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 10, padding: 11, fontWeight: 800, fontSize: 13, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Check size={15} /> Confirm &amp; use this strategy</button>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "14px 0 6px" }}>Exit rules — in plain English</div>
                <textarea value={pExit} onChange={(e) => setPExit(e.target.value)} placeholder="e.g. RSI > 70 — or: EMA 21 crosses below EMA 50, price rejects at resistance, three black crows." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {xParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700, display: "flex", gap: 5 }}><Sparkles size={12} style={{ flex: "0 0 auto", marginTop: 1 }} /><span>Neo reads: exit when {neoReads(xParsed.conds)}.</span></div>}
                {[...new Set([...patternsInConds(eParsed.conds), ...patternsInConds(xParsed.conds)])].filter((k) => PATTERN_EXPLAIN[k]).map((k) => (
                  <div key={k} style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }}>
                    <b style={{ color: "var(--ink)" }}>How Neo detects a {k.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}:</b> {PATTERN_EXPLAIN[k]}
                  </div>
                ))}
                {unparsed.length > 0 && <div style={{ fontSize: 10.5, color: "#F59E42", marginTop: 8, fontWeight: 600, lineHeight: 1.5 }}>❓ Neo isn't sure what you mean by <b style={{ color: "var(--ink)" }}>“{unparsed.join("”, “")}”</b>. Did you mean an indicator condition (like “RSI &gt; 30” or “EMA 9 crosses above EMA 21”), a chart pattern (like “double bottom”), or a price level (support / resistance)? Rephrase it, or tap <b style={{ color: "var(--primary)" }}>Interpret with Neo</b> below to let Neo take a full pass.</div>}
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, display: "flex", gap: 6 }}><Sparkles size={13} color="var(--primary)" style={{ flex: "0 0 auto", marginTop: 1 }} /> Neo turns your words into executable rules on the <b style={{ margin: "0 3px" }}>{tf}</b> timeframe.</div>
                {/* Intelligent fallback: let Neo (AI) interpret anything the fast parser missed. */}
                <button onClick={runAiInterpret} disabled={aiBusy} className="tap disp" style={{ marginTop: 10, width: "100%", border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", justifyContent: "center", opacity: aiBusy ? 0.6 : 1 }}>
                  <Sparkles size={14} /> {aiBusy ? "Neo is interpreting…" : "Interpret with Neo"}
                </button>
                {aiMsg && <div style={{ fontSize: 10.5, marginTop: 6, fontWeight: 600, color: aiMsg.ok ? "var(--up)" : "#F59E42" }}>{aiMsg.ok ? "✓ " : "⚠ "}{aiMsg.t}</div>}
              </>
            )}

            <div className="disp" style={{ display: "flex", alignItems: "center", gap: 7, margin: "20px 0 14px", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 3</span> <span style={{ fontWeight: 700, fontSize: 14 }}>Risk &amp; orders</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <NumF label="Stop loss %" v={sl} set={setSl} />
              <NumF label="Take profit %" v={tp} set={setTp} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>{market === "Crypto" ? "Amount to be deployed" : "Quantity"}</div>
              <input value={capital} onChange={(e) => setCapital(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={market === "Crypto" ? "100" : "100000"} className="no-ring mono" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5 }}>{market === "Crypto" ? "Amount (in your wallet currency) spent on each entry." : "Number of shares (or lots, for options) placed on each entry."}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <SegF label="Buy Type" options={["Intraday", "NRML"]} value={buyType} set={setBuyType} />
              <SegF label="Order Type" options={["Market", "Limit"]} value={optLeg.enabled ? "Limit" : entryType} set={setEntryType} disabled={optLeg.enabled ? ["Market"] : []} />
            </div>
            {optLeg.enabled && (
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                Indian options are limit-only — market orders aren't permitted, so this strategy places a Limit order at the premium.
              </div>
            )}

            {entryType === "Limit" && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Limit offset %</div>
                <input
                  value={limitOffset}
                  onChange={(e) => setLimitOffset(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.1"
                  className="no-ring mono"
                  style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)", color: "var(--ink)", fontSize: 14 }}
                />
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
                  How far below the signal price to place a buy (and above it to place a sell). At 0.1%,
                  a buy signal at 100 places the limit at 99.90. The order fills only if price reaches it.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <NumF label="Max trades / day" v={maxTrades} set={(x) => setMaxTrades(String(x).replace(/[^0-9]/g, ""))} />
              <NumF label="Max re-entries" v={maxReentries} set={(x) => setMaxReentries(String(x).replace(/[^0-9]/g, ""))} />
            </div>

            <pre className="mono" style={{ fontSize: 11, background: "#0E0E18", color: "#C9D2FF", border: "1px solid #2A2A3D", borderRadius: 12, padding: 13, marginTop: 14, whiteSpace: "pre-wrap", lineHeight: 1.55, overflowX: "auto" }}>{code}</pre>

            <button onClick={() => setShowBt((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Activity size={16} color="var(--primary)" /> {showBt ? "Hide backtest" : "Backtest this strategy"}</button>
            {showBt && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <BacktestResult cfg={cfg} blocked={!canBacktest} onConnect={onConnectBroker} />
              </div>
            )}
            {/* Optimizers live OUTSIDE the backtest toggle so they're available in BOTH the Visual
                builder and Plain English (they run their own backtests server-side). They appear as
                soon as Neo has read an entry rule from your prose. */}
            {cfg.entry && cfg.entry.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                {/* Ideal SL/TP for this strategy — grid-search over its past entry signals. Apply fills
                    the Stop loss / Take profit fields above. */}
                <ExitOptimizer
                  defs={cfg.defs || []}
                  entry={cfg.entry}
                  tf={cfg.tf || "5m"}
                  appSyms={deploySyms.length ? deploySyms : DEPLOY_OPTIONS.slice(0, 3)}
                  currentSl={sl ? Number(sl) : null}
                  currentTp={tp ? Number(tp) : null}
                  onApply={(bsl, btp) => { setSl(String(bsl)); setTp(String(btp)); }}
                />
                {/* Optimize the indicator lengths + timeframe (≤1h) for the chosen objective. Apply
                    writes the tuned lengths and timeframe straight back into the builder above. */}
                <div style={{ height: 14 }} />
                <IndicatorOptimizer
                  defs={cfg.defs || []}
                  entry={cfg.entry}
                  tf={cfg.tf || "5m"}
                  appSyms={deploySyms.length ? deploySyms.slice(0, 4) : DEPLOY_OPTIONS.slice(0, 4)}
                  currentSl={sl ? Number(sl) : null}
                  currentTp={tp ? Number(tp) : null}
                  onApply={(nd, ntf) => { setDefs((nd || []).map((d, i) => ({ ...d, id: d.id || i + 1, tf: ntf }))); setTf(ntf); }}
                />
              </div>
            )}

            {/* Save */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => saveStrategy(false)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Check size={16} color="var(--primary)" /> {editingId ? "Update" : "Save strategy"}</button>
                <button onClick={() => saveStrategy(true)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Bolt size={16} /> {editingId ? "Update & deploy" : "Save & deploy"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal alerts */}
      {notifs.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 8px" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Signal alerts</span>
            <button onClick={() => setNotifs([])} className="tap" style={{ border: "none", background: "transparent", fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>Clear</button>
          </div>
          <div className="card" style={{ padding: 13, marginBottom: 4 }}>
            {notifs.map((nt) => (
              <div key={nt.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)" }}>
                <Bell size={13} color="var(--primary)" style={{ flex: "0 0 auto" }} />
                <span style={{ fontSize: 12, flex: 1 }}>{nt.text}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{nt.time}</span>
              </div>
            ))}
          </div>
        </>
      )}
      </>)}

      {/* SAMPLES + MY STRATEGIES — driven by the TOP selector now, not a second tab row. */}
      {topTab === "pnl" && <StrategyPnLView strats={strats} trades={trades} market={market} onDelete={deleteStrategy} />}

      {topTab === "backtest" && (
        <div style={{ marginTop: 16 }}>
          <BacktestPanel strats={allBucketStrats} market={market} onApplyExits={(id, sl, tp) => setStrats((p) => p.map((s) => s.id === id ? { ...s, cfg: { ...(s.cfg || {}), sl, tp } } : s))} onApplyIndicators={(id, defs, tf) => persistCard(id, { defs, tf })} onCreateCopy={createCopyForSymbol} copyExists={(strat, sym) => strats.some((x) => x.name === copyNameFor(strat, sym))} isActive={activeInMarket} onToggleActive={toggleActiveHere} />
        </div>
      )}

      {topTab === "strategies" && (<>
      {/* Sub-sections under Strategies — shown directly (no redundant "Strategies" heading). */}
      <div ref={stratsRef} className="hide-scroll" style={{ display: "flex", gap: 7, margin: "18px 0 14px", scrollMarginTop: 80, overflowX: "auto" }}>
        {[["deployed", "Deployed"], ["sample", "Samples"], ["premium", "Premium"], ["public", "Public"], ["mine", "Mine"], ["copies", "My Copies"]].map(([k, label]) => (
          <button key={k} onClick={() => setStratTab(k)} className="tap disp" style={{ flex: "0 0 auto", borderRadius: 999, padding: "7px 14px", fontWeight: 800, fontSize: 11.5, whiteSpace: "nowrap", border: "1px solid " + (stratTab === k ? "var(--primary)" : "var(--line)"), background: stratTab === k ? "var(--primary)" : "var(--surface)", color: stratTab === k ? "var(--on-primary)" : "var(--ink)" }}>{label}</button>
        ))}
      </div>

      {/* Symbol filter — narrows the visible cards in this bucket to one or more symbols (default All).
         Backtest has its own symbol control; Public has its own filter row, so skip both here. */}
      {stratTab !== "backtest" && stratTab !== "public" && availSyms.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <MultiSelect label="Symbols" options={availSyms} value={stratSymFilter} onChange={setStratSymFilter} allLabel="All symbols" />
        </div>
      )}

      {stratTab === "backtest" ? (
        <BacktestPanel strats={allBucketStrats} market={market} onApplyExits={(id, sl, tp) => setStrats((p) => p.map((s) => s.id === id ? { ...s, cfg: { ...(s.cfg || {}), sl, tp } } : s))} onApplyIndicators={(id, defs, tf) => persistCard(id, { defs, tf })} onCreateCopy={createCopyForSymbol} copyExists={(strat, sym) => strats.some((x) => x.name === copyNameFor(strat, sym))} isActive={activeInMarket} onToggleActive={toggleActiveHere} />
      ) : stratTab === "sample" ? (
        (() => {
          const renderS = ({ s }) => <SampleStrategyCard key={s.id} s={s} market={market} onActivate={useTemplateStrategy} onClone={cloneStrategy} onEdit={isAdmin ? loadForEdit : undefined} onPersist={persistCard} canBacktest={canBacktest} onConnect={onConnectBroker} />;
          if (!sampleLong.length && !sampleShort.length) return <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No sample strategies for this market.</div>;
          const sel = lsSide === "long" ? sampleLong : sampleShort;
          return (<>
            <LongShortToggle side={lsSide} setSide={setLsSide} longCount={sampleLong.length} shortCount={sampleShort.length} />
            <BulkBar items={sel} />
            {sel.length ? sel.map(renderS) : <div style={emptyNote}>No {lsSide} samples.</div>}
          </>);
        })()
      ) : stratTab === "premium" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 8px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, flex: 1 }}>
              Matrix's curated strategies — Long run standard; Short are their mirror setups (profit when the setup breaks down; shorting executes on crypto &amp; Indian options, paper elsewhere). Rules are locked.
            </div>
            <button onClick={() => setCompareOpen((v) => !v)} className="tap disp" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 5, border: "1px solid " + (compareOpen ? "var(--primary)" : "var(--line)"), background: compareOpen ? "var(--primary-soft)" : "var(--surface)", color: compareOpen ? "var(--primary)" : "var(--ink)", borderRadius: 10, padding: "7px 11px", fontWeight: 800, fontSize: 11.5 }}>
              <ListChecks size={14} /> {compareOpen ? "Hide table" : "Compare all"}
            </button>
          </div>
          {compareOpen && <ComparisonTable strats={premiumLong.filter((s) => (s.market || marketOf((s.symbols || [])[0])) === market)} market={market} />}
          {(!premiumLong.length && !premiumShort.length)
            ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No premium strategies available.</div>
            : (() => {
                const sel = lsSide === "long" ? premiumLong : premiumShort;
                return (<>
                  <LongShortToggle side={lsSide} setSide={setLsSide} longCount={premiumLong.length} shortCount={premiumShort.length} />
                  <BulkBar items={sel} />
                  {sel.length ? sel.map((s) => <PremiumStrategyCard key={s.id} s={s} active={activeInMarket(s)} market={market} onToggle={(rs, size, opts) => togglePremiumHere(s.id, rs, size, opts)} onEdit={isAdmin ? loadForEdit : undefined} onPersist={persistCard} onClone={clonePremium} canBacktest={canBacktest} onConnect={onConnectBroker} />) : <div style={emptyNote}>No {lsSide} strategies.</div>}
                </>);
              })()}
        </>
      ) : stratTab === "copies" ? (
        (() => {
          const renderC = ({ s }) => <CopyStrategyCard key={s.id} s={s} active={s.active} market={market} onToggle={(rs, size, opts) => togglePremiumHere(s.id, rs, size, opts)} onPersist={persistCard} onDelete={deleteStrategy} canBacktest={canBacktest} onConnect={onConnectBroker} />;
          if (!copiesLong.length && !copiesShort.length) return <div className="card" style={{ marginTop: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>No copies yet. Open <b style={{ color: "var(--ink)" }}>Premium</b> and tap <b style={{ color: "var(--ink)" }}>Clone</b> on any strategy to make an editable copy here.</div>;
          const sel = lsSide === "long" ? copiesLong : copiesShort;
          return (<>
            <LongShortToggle side={lsSide} setSide={setLsSide} longCount={copiesLong.length} shortCount={copiesShort.length} />
            <BulkBar items={sel} />
            {sel.length ? sel.map(renderC) : <div style={emptyNote}>No {lsSide} copies.</div>}
          </>);
        })()
      ) : stratTab === "public" ? (
        <>
          <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 2px 10px", lineHeight: 1.5 }}>
            Strategies shared by the community. Clone one to make it yours.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <select aria-label="Symbol filter" value={pubSym} onChange={(e) => setPubSym(e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, fontSize: 11.5 }}>
              <option value="">Symbol: All</option>
              {publicSymOptions.map((sy) => <option key={sy} value={sy}>{sy}</option>)}
            </select>
            <select aria-label="Posted by filter" value={pubBy} onChange={(e) => setPubBy(e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, fontSize: 11.5 }}>
              <option value="">Posted by: All</option>
              {publicByOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {publicLoading
            ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>Loading public strategies…</div>
            : publicList.length === 0
              ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No public strategies yet. Publish one of your own from the Mine tab.</div>
              : publicList.map((ps) => (
                <div key={ps.id} className="card" style={{ marginTop: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{ps.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>Created by {ps.owner_name || "user"}{(ps.symbols || []).length ? " · " + ps.symbols.join(" · ") : ""}</div>
                    </div>
                    <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--primary-soft)", color: "var(--primary)", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 4 }}><Globe size={11} /> PUBLIC</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setBtOpen(btOpen === ps.id ? null : ps.id)} className="tap disp" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5 }}><Activity size={14} /> Backtest</button>
                    <button onClick={() => clonePublic(ps)} className="tap disp" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5 }}><Copy size={14} style={{ verticalAlign: "-2px" }} /> Clone</button>
                  </div>
                  {btOpen === ps.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                      <BacktestResult cfg={ps.data || ps.cfg} defaultSym={(ps.symbols && ps.symbols[0]) || undefined} blocked={!canBacktest} onConnect={onConnectBroker} />
                    </div>
                  )}
                </div>
              ))}
        </>
      ) : stratTab === "deployed" ? (
        <>
          {/* DEPLOYED — every strategy (any type), split Active / Inactive. */}
          <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
            {[["active", `Active (${deployedActive.length})`], ["inactive", `Inactive (${deployedInactive.length})`]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className="tap disp"
                style={{
                  flex: 1, borderRadius: 10, padding: "8px 6px", fontWeight: 800, fontSize: 12, cursor: "pointer",
                  border: "1px solid " + (activeTab === k ? "var(--primary)" : "var(--line)"),
                  background: activeTab === k ? "var(--primary-soft)" : "var(--surface)",
                  color: activeTab === k ? "var(--primary)" : "var(--ink)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "active" ? (
            deployedActive.length === 0
              ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>None active.</div>
              : <>
                  {/* EXIT ALL — flattens every active strategy's open position at once. */}
                  <button
                    onClick={() => { if (onExitAll && (typeof window === "undefined" || window.confirm("Exit all open positions and stop every active strategy?"))) onExitAll(); }}
                    className="tap disp"
                    style={{ width: "100%", marginBottom: 12, padding: "11px", borderRadius: 11, border: "1px solid var(--down)", background: "transparent", color: "var(--down)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                  >
                    Exit all active strategies
                  </button>
                  <CollapsibleList items={deployedActive} render={({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>} />
                </>
          ) : (
            deployedInactive.length === 0
              ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>None inactive.</div>
              : <CollapsibleList items={deployedInactive} render={({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>} />
          )}
        </>
      ) : mineOwn.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>
          You haven't created a strategy yet. Build one from the Build tab, or start from a sample.
        </div>
      ) : (
        /* MINE — only strategies this user created; a Long / Short toggle above the bulk bar filters
           the list. Each card carries its own Active/Inactive tag. */
        (() => {
          const sel = lsSide === "long" ? mineLong : mineShort;
          return (<>
            <LongShortToggle side={lsSide} setSide={setLsSide} longCount={mineLong.length} shortCount={mineShort.length} />
            <BulkBar items={sel} />
            {sel.length ? <CollapsibleList items={sel} render={({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>} /> : <div style={emptyNote}>No {lsSide} strategies.</div>}
          </>);
        })()
      )}
      </>)}

      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", zIndex: 80, pointerEvents: "none" }}>
          <div className="card glow" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", maxWidth: 380, border: "1px solid var(--primary)" }}>
            <Bell size={16} color="var(--primary)" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
