import React, { useEffect, useMemo, useRef, useState } from "react";
import { defOperands, chainCode, IND_CATALOG, TEMPLATES } from "../domain/strategyLang";
import { backtest, parseRules } from "../domain/backtest";
import { stratPerf } from "../domain/strategies";
import { Activity, Bell, Bolt, Check, Pause, Play, Plus, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BACKEND_URL } from "../config";
import { chgColor, clamp, fmt, pct } from "../lib/format";
import { useBacktestStats } from "../hooks/useBacktestStats";
import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, CF } from "../lib/series";
import { ALL, FNO, UNIVERSE, marketOf } from "../domain/universe";
import { aiInterpretStrategy } from "../domain/api";
import { useCandles } from "../hooks/useCandles";
import MultiSelect from "../components/common/MultiSelect";
import { selStyle } from "../components/common/styles";

/**
 * Automation — visual strategy builder, plain-English rules, and backtesting on REAL candles.
 */


function BacktestResult({ cfg, defaultSym }) {
  // Default to the symbol the strategy is ACTIVATED on. Backtesting a NIFTY50
  // strategy against RELIANCE by default tests something you never deployed.
  const [sym, setSym] = useState(defaultSym || "RELIANCE");
  useEffect(() => { if (defaultSym) setSym(defaultSym); }, [defaultSym]);
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(Date.now() - 180 * 864e5));
  const [to, setTo] = useState(iso(Date.now()));
  const [preset, setPreset] = useState("6m");
  const [tf, setTf] = useState("1d");
  const BT_TF = [["1m", "1 min"], ["3m", "3 min"], ["5m", "5 min"], ["15m", "15 min"], ["30m", "30 min"], ["1h", "1 hour"], ["4h", "4 hours"], ["1d", "1 day"]];
  const PRESETS = { "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730 };
  const applyPreset = (k) => { setPreset(k); if (k !== "custom") { setFrom(iso(Date.now() - PRESETS[k] * 864e5)); setTo(iso(Date.now())); } };
  const stock = ALL.find((a) => a.sym === sym) || ALL[0];
  const bars = useMemo(() => { const d = (new Date(to) - new Date(from)) / 864e5; return clamp(Math.round(d > 0 ? d : 120), 20, 400); }, [from, to]);
  // REAL candles for the backtest — no synthetic price paths.
  const { data: realData, loading: btLoading } = useCandles(sym, tf);
  const data = useMemo(() => (realData ? realData.slice(-bars) : null), [realData, bars]);
  const res = useMemo(() => (!cfg || cfg.mode === "plain" || !data ? null : backtest(cfg, data)), [cfg, data]);
  // No cfg at all -> the template lookup missed. Say so; do not throw a white screen.
  if (!cfg) {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>This strategy has no runnable configuration to backtest.</div>;
  }
  if (cfg.mode === "plain") {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>Plain-English rules are parsed on the backend at deploy time — switch to the visual builder to run a backtest.</div>;
  }
  if (btLoading) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>Loading real price history…</div>;
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
        <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: "auto" }}>{bars} bars · sim</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>Candle timeframe</div>
        <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>
          {BT_TF.map(([k, l]) => (
            <button key={k} onClick={() => setTf(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "6px 11px", fontSize: 11, fontWeight: 700, border: "1px solid " + (tf === k ? "var(--primary)" : "var(--line)"), background: tf === k ? "var(--primary)" : "var(--surface)", color: tf === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
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
      {res.trades.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {res.trades.slice(-4).reverse().map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 2px", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Bar {t.entryIdx} → {t.exitIdx} <span className="pill" style={{ fontSize: 9, background: "var(--bg)", padding: "1px 7px", marginLeft: 4 }}>{t.reason}</span></span>
              <span className="mono" style={{ fontWeight: 800, color: t.ret >= 0 ? "var(--up)" : "var(--down)" }}>{(t.ret * 100 >= 0 ? "+" : "") + (t.ret * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Simulated bars · indicative only, not financial advice.</div>
    </div>
  );
}

/* ============================== TRADE AUTOMATION ============================== */

const TFS = ["3m", "5m", "15m", "30m", "1h", "4h", "1D"];
const OPSET = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="], ["crosses_above", "⤴ crosses above"], ["crosses_below", "⤵ crosses below"]];

function TemplateCard({ t, onActivate, onToggleBt, btActive, market = "IN" }) {
  // Only symbols that belong to the market you are looking at.
  const symbolOptions = useMemo(() => {
    if (market === "FNO") return FNO.map((s) => s.sym);
    return (UNIVERSE[market] || []).map((s) => s.sym);
  }, [market]);
  const [syms, setSyms] = useState([]);
  return (
    <div className="card" style={{ flex: "0 0 auto", width: 250, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="disp" style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
        <span className="pill" style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 700, padding: "2px 8px" }}>{t.tag}</span>
      </div>
      <pre className="mono" style={{ fontSize: 10, background: "var(--bg)", borderRadius: 12, padding: 10, marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{t.code}</pre>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, margin: "10px 0 6px" }}>Symbol to activate on</div>
      {/* One symbol, from THIS market. The old picker was a multi-select over a
          fixed cross-market list, so TSLA and NVDA showed up while you were on
          Indian equity — symbols the strategy could never sensibly trade. */}
      <select
        value={syms[0] || ""}
        onChange={(e) => setSyms(e.target.value ? [e.target.value] : [])}
        aria-label="Symbol to activate this strategy on"
        style={{ ...selStyle, width: "100%" }}
      >
        <option value="">Choose a symbol…</option>
        {symbolOptions.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button disabled={!syms.length} onClick={() => syms.length && onActivate(t, syms)} className="tap pill" style={{ flex: 1, border: "none", background: syms.length ? "linear-gradient(120deg,var(--primary),var(--primary-2))" : "var(--elev)", color: syms.length ? "var(--on-primary)" : "var(--muted)", fontWeight: 700, fontSize: 11.5, padding: 9, cursor: syms.length ? "pointer" : "not-allowed", opacity: syms.length ? 1 : 0.7 }}>Activate</button>
        <button onClick={() => onToggleBt(t.name)} className="tap pill" style={{ flex: "0 0 auto", border: "1px solid " + (btActive ? "var(--primary)" : "var(--line)"), background: btActive ? "var(--primary-soft)" : "var(--surface)", fontWeight: 700, fontSize: 11.5, padding: "9px 11px", color: btActive ? "var(--primary)" : "var(--ink)", display: "flex", gap: 4, alignItems: "center" }}><Activity size={13} /> Test</button>
      </div>
    </div>
  );
}

function IndicatorDefs({ defs, setDefs }) {
  const upd = (id, k, v) => setDefs((p) => p.map((d) => d.id === id ? { ...d, [k]: v } : d));
  const add = () => setDefs((p) => [...p, { id: Date.now(), type: "EMA", len: "20", tf: "1D", name: "IND" + (p.length + 1) }]);
  return (
    <div>
      {defs.map((d) => {
        const cat = IND_CATALOG.find((c) => c.type === d.type) || {};
        return (
          <div key={d.id} style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", marginBottom: 8 }}>
            <select aria-label="Select option" value={d.type} onChange={(e) => upd(d.id, "type", e.target.value)} style={{ ...selStyle, flex: "1 1 0", minWidth: 0, padding: "9px 4px" }}>{IND_CATALOG.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}</select>
            <input value={cat.needsLen ? d.len : "—"} onChange={(e) => upd(d.id, "len", e.target.value)} disabled={!cat.needsLen} placeholder="len" className="no-ring mono" style={{ ...selStyle, flex: "0 0 40px", minWidth: 0, textAlign: "center", padding: "9px 2px", opacity: cat.needsLen ? 1 : 0.4 }} />
            <select aria-label="Select option" value={d.tf} onChange={(e) => upd(d.id, "tf", e.target.value)} style={{ ...selStyle, flex: "0 0 56px", minWidth: 0, padding: "9px 2px" }}>{TFS.map((t) => <option key={t}>{t}</option>)}</select>
            <input value={d.name} onChange={(e) => upd(d.id, "name", e.target.value)} placeholder="name" className="no-ring disp" style={{ ...selStyle, flex: "1 1 0", minWidth: 0, fontWeight: 700, padding: "9px 6px" }} />
            <button onClick={() => setDefs((p) => p.filter((x) => x.id !== d.id))} className="tap" style={{ border: "none", background: "transparent", flex: "0 0 auto", padding: 2 }}><Trash2 size={15} color="var(--down)" /></button>
          </div>
        );
      })}
      <button onClick={add} className="tap" style={{ marginTop: 4, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add indicator</button>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Tip: name them (e.g. EMA1, MACD1). Only these appear in your signals below.</div>
    </div>
  );
}

function CondBuilder2({ label, conds, setConds, operands }) {
  const upd = (i, k, v) => setConds((p) => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const add = () => setConds((p) => [...p, { la: operands[0] || "Price", op: "<", bType: "num", b: "30", gate: "AND" }]);
  const del = (i) => setConds((p) => p.filter((_, j) => j !== i).map((c, j) => { if (j === 0) { const { gate, ...rest } = c; return rest; } return c; }));
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {conds.map((c, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          {i > 0 && (
            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
              {["AND", "OR"].map((g) => (
                <button key={g} onClick={() => upd(i, "gate", g)} className="pill tap disp" style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 14px", border: "1px solid var(--line)", background: (c.gate || "AND") === g ? "var(--primary)" : "transparent", color: (c.gate || "AND") === g ? "var(--on-primary)" : "var(--muted)" }}>{g}</button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", background: "var(--bg)", borderRadius: 12, padding: 8 }}>
            <select aria-label="Select option" value={c.la} onChange={(e) => upd(i, "la", e.target.value)} style={{ ...selStyle, flex: "1 1 104px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
            <select aria-label="Select option" value={c.op} onChange={(e) => upd(i, "op", e.target.value)} style={{ ...selStyle, flex: "1 1 96px" }}>{OPSET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 2, flex: "0 0 auto" }}>
              {[["ind", "Ind"], ["num", "#"]].map(([k, l]) => (
                <button key={k} onClick={() => upd(i, "bType", k)} className="pill tap" style={{ fontSize: 10.5, fontWeight: 800, padding: "4px 9px", border: "none", background: c.bType === k ? "var(--primary)" : "transparent", color: c.bType === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
            {c.bType === "ind"
              ? <select aria-label="Select option" value={c.b} onChange={(e) => upd(i, "b", e.target.value)} style={{ ...selStyle, flex: "1 1 104px" }}>{operands.map((o) => <option key={o}>{o}</option>)}</select>
              : <input value={c.b} onChange={(e) => upd(i, "b", e.target.value)} className="no-ring mono" style={{ ...selStyle, flex: "1 1 64px", textAlign: "center" }} />}
            <button onClick={() => del(i)} disabled={conds.length === 1} className="tap" style={{ border: "none", background: "transparent", opacity: conds.length === 1 ? 0.3 : 1 }}><Trash2 size={15} color="var(--down)" /></button>
          </div>
        </div>
      ))}
      <button onClick={add} className="tap" style={{ marginTop: 10, border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={14} /> Add condition</button>
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
function SampleStrategyCard({ s, onActivate }) {
  const { loading, stats } = useBacktestStats(s);

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
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {(s.symbols || []).join(" · ")}
          </div>
        </div>
        <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--primary-soft)", color: "var(--primary)", flex: "0 0 auto" }}>SAMPLE</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Backtesting on real prices…</div>
      ) : !stats ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Data currently unavailable</div>
      ) : stats.trades === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
          This strategy did not trigger a single trade in the last {stats.months} month{stats.months === 1 ? "" : "s"}. That is a real result, not missing data.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Stat k="WIN RATE" v={stats.winRate.toFixed(0) + "%"} />
            <Stat k="TRADES" v={stats.trades} />
            <Stat k="P&L" v={(stats.pnl >= 0 ? "+" : "") + fmt(stats.pnl, "IN")} c={chgColor(stats.pnl)} />
            <Stat k="RETURN" v={pct(stats.retPct, 1)} c={chgColor(stats.retPct)} />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
            Backtested on the last {stats.months} month{stats.months === 1 ? "" : "s"} of real daily candles across {stats.symbols} symbol{stats.symbols === 1 ? "" : "s"}.
            {stats.months < 6 && " Only 1 month of history was available, so this is a thin sample — treat it as weak evidence."}
            {" "}A backtest is scored with hindsight; it is not a forecast.
          </div>
        </>
      )}

      {onActivate && (
        <button onClick={() => onActivate(s)} className="tap disp"
          style={{ width: "100%", marginTop: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
          Use this strategy
        </button>
      )}
    </div>
  );
}

export default function Automation({ market = "IN", onRecord, trades = [], strats = [], setStrats }) {
  const [mode, setMode] = useState("builder");
  const [defs, setDefs] = useState([
    { id: 1, type: "EMA", len: "50", tf: "1D", name: "EMA1" },
    { id: 2, type: "EMA", len: "200", tf: "1D", name: "EMA2" },
    { id: 3, type: "RSI", len: "14", tf: "15m", name: "RSI1" },
    { id: 4, type: "MACD", len: "", tf: "3m", name: "MACD1" },
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
  const [sl, setSl] = useState("3");
  const [tp, setTp] = useState("8");
  const [capital, setCapital] = useState("100000");
  const [tf, setTf] = useState("5m");
  const [deploySyms, setDeploySyms] = useState(["NIFTY50"]);
  const [symFilter, setSymFilter] = useState([]);
  /* Symbols for the market you are actually on. This was hardcoded to the F&O
     list, so on the US or Crypto tab the builder offered you Indian F&O names —
     symbols the strategy would then try (and fail) to trade in that wallet. */
  const DEPLOY_OPTIONS = useMemo(() => (
    market === "FNO" ? FNO.map((s) => s.sym) : (UNIVERSE[market] || []).map((s) => s.sym)
  ), [market]);
  const [pEntry, setPEntry] = useState("Buy when EMA 9 crosses above EMA 21 and RSI is above 55.");
  const [pExit, setPExit] = useState("Exit when RSI crosses above 85 or MACD histogram becomes negative or MACD line crosses below MACD signal line.");
  const [aiStrat, setAiStrat] = useState(null); const [aiStratBusy, setAiStratBusy] = useState(false);
  const aiInterpret = async () => {
    setAiStratBusy(true); setAiStrat(null);
    const out = await aiInterpretStrategy(`ENTRY: ${pEntry}\nEXIT: ${pExit}`);
    setAiStratBusy(false);
    if (out) { setAiStrat(out); const sm = out.match(/STOP:\s*(\d+)/i); const tm = out.match(/TARGET:\s*(\d+)/i); if (sm) setSl(sm[1]); if (tm) setTp(tm[1]); }
    else setAiStrat("Couldn't reach the AI interpreter — this needs the backend deployed with a Groq (or other) key. The local parser still handles common phrasings.");
  };

  const [stratName, setStratName] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBt, setShowBt] = useState(false);
  const [btOpen, setBtOpen] = useState(null);
  const [btTpl, setBtTpl] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [toast, setToast] = useState(null);
  const [dashBy, setDashBy] = useState("All");
  const [dashRange, setDashRange] = useState(365);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  function fireAlert(a) {
    let text;
    try {
      const data = candles("NIFTY50", 23450, 0.62, 80);
      const bt = a.cfg && a.cfg.mode !== "plain" ? backtest(a.cfg, data) : null;
      const last = bt && bt.trades.length ? bt.trades[bt.trades.length - 1] : null;
      const kind = last ? (["Signal", "TP", "SL", "EOD"].includes(last.reason) ? "Exit" : "Entry") : null;
      text = last ? `${a.name}: ${kind} signal on NIFTY50 @ ${last.exit.toFixed(2)}` : `${a.name}: alerts armed — watching for entry/exit signals`;
    } catch { text = `${a.name}: alerts armed`; }
    setNotifs((p) => [{ id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...p].slice(0, 8));
    setToast(text);
  }

  // Plain-English → executable rules
  const eParsed = useMemo(() => parseRules(pEntry), [pEntry]);
  const xParsed = useMemo(() => parseRules(pExit), [pExit]);
  const plainDefs = useMemo(() => { const d = []; [...eParsed.defs, ...xParsed.defs].forEach((x) => { if (x && !d.find((y) => y.name === x.name)) d.push(x); }); return d; }, [eParsed, xParsed]);
  const cfg = mode === "builder"
    ? { mode: "builder", tf, defs, entry: entryConds, exit: exitConds, sl, tp }
    : { mode: "builder", tf, defs: plainDefs.map((d) => ({ ...d, tf })), entry: eParsed.conds, exit: xParsed.conds, sl, tp };
  const condStr = (c) => `${c.la} ${c.op} ${c.b}`;
  const chain = (conds) => conds.map((c, i) => `${i ? " " + (c.gate || "AND") + " " : ""}${condStr(c)}`).join("");
  const defLines = defs.map((d) => {
    const cat = IND_CATALOG.find((c) => c.type === d.type);
    const args = [];
    if (cat?.needsLen && d.len) args.push(`length=${d.len}`);
    args.push(`tf=${d.tf}`);
    return `${d.name} = ${d.type}(${args.join(", ")})`;
  }).join("\n");
  const plainDefLines = plainDefs.map((d) => `${d.name} = ${d.type}(${d.len ? "length=" + d.len + ", " : ""}tf=${tf})`).join("\n");
  const unparsed = [...eParsed.unparsed, ...xParsed.unparsed];
  const code = mode === "builder"
    ? `# Indicators\n${defLines}\n\n# Entry\nif ${chain(entryConds)}:\n    enter_trade(stop_loss=${sl}%, take_profit=${tp}%)\n\n# Exit\nif ${chain(exitConds)}:\n    exit_trade()`
    : `# Timeframe: ${tf}\n# Indicators (auto-detected from your text)\n${plainDefLines || "# (none detected yet)"}\n\n# ENTRY\nif ${chainCode(eParsed.conds) || "<describe entry rules>"}:\n    enter_trade(stop_loss=${sl}%, take_profit=${tp}%)\n\n# EXIT\nif ${chainCode(xParsed.conds) || "<describe exit rules>"}:\n    exit_trade()`;

  const saveStrategy = (makeActive) => {
    const name = stratName.trim() || (mode === "builder" ? "Custom strategy" : "Plain-English strategy");
    const id = "u" + Date.now();
    const symbols = deploySyms.length ? deploySyms : ["NIFTY50"];
    const strat = { id, name, by: "You", active: makeActive, alerts: false, cfg, cap: parseInt(capital) || 100000, symbols, created: Date.now() };
    setStrats((p) => [strat, ...p]);
    setStratName(""); setShowBuilder(false);
    setToast(makeActive
      ? `${name} is live on ${symbols.join(", ")} — it will place orders when its rules trigger.`
      : `${name} saved as a draft. Activate it to start trading.`);
    setStratTab("mine");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const activateTemplate = (t, syms) => {
    const symbols = syms && syms.length ? syms : ["NIFTY50"];
    const id = "t" + Date.now();
    // by: "You" — the moment YOU activate it, it is YOUR strategy and belongs under
    // "My strategies". It was previously tagged "Matrix", which filed the user's own
    // running strategies under the samples.
    setStrats((p) => [{ id, name: t.name, by: "You", active: true, alerts: false, cfg: t.cfg, cap: 100000, symbols, created: Date.now() }, ...p]);
    setToast(`${t.name} is live on ${symbols.join(", ")} — it will place orders when its rules trigger.`);
    setStratTab("mine");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /* "Use this strategy" on a sample: copy its rules and symbols into your own. */
  const useTemplateStrategy = (s) => activateTemplate({ name: s.name, cfg: s.cfg }, s.symbols);
  // Record simulated trades produced by an activated automation (deduped by id).
  // Activating a strategy places REAL positions at the live price with the strategy's
  // target/stop. The exit engine then closes them at real market prices. Nothing is
  // fabricated — no invented history, no simulated win/loss.
  /* recordAutomateTrades used to live here. It market-bought EVERY symbol the
     instant a strategy was activated, never evaluated the entry rule, and never
     sold anything. The rules were decoration. It is gone; hooks/useAutomation.js
     now evaluates the real rules against real candles once a minute and places
     both buys and sells. */

  const toggleActive = (id) => setStrats((p) => p.map((s) => s.id === id ? { ...s, active: !s.active } : s));
  const toggleAlerts = (s) => { const willOn = !s.alerts; setStrats((p) => p.map((x) => x.id === s.id ? { ...x, alerts: willOn } : x)); if (willOn) fireAlert(s); };
  const updateStrat = (id, patch) => setStrats((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  const [editStrat, setEditStrat] = useState(null);
  const TF_OPTS = ["3m", "5m", "10m", "15m", "30m", "1h", "1D"];

  // dashboard aggregation — scoped to the selected market
  const amkt = market === "FNO" ? "IN" : market;
  const inMkt = (s) => !(s.symbols && s.symbols.length) || s.symbols.some((x) => marketOf(x) === amkt);
  const shown = strats.filter((s) => inMkt(s) && (dashBy === "All" || s.by === dashBy) && (symFilter.length === 0 || (s.symbols || []).some((x) => symFilter.includes(x))));
  const perf = shown.map((s) => ({ s, p: stratPerf(s, trades, dashRange) }));
  const agg = perf.reduce((a, { p }) => { a.trades += p.trades; a.wins += p.wins; a.pnl += p.pnl; a.cap += p.cap; a.annSum += p.annual; return a; }, { trades: 0, wins: 0, pnl: 0, cap: 0, annSum: 0 });
  const activeCount = shown.filter((s) => s.active).length;
  const dWinRate = agg.trades ? agg.wins / agg.trades * 100 : 0;
  const dRet = agg.cap ? agg.pnl / agg.cap * 100 : 0;
  const dAnn = perf.length ? agg.annSum / perf.length : 0;
  /* Two kinds of strategy, and they are scored differently — deliberately.
       SAMPLE  (by "Matrix"): never traded, so no live record exists. Shown with a
                real 6-month BACKTEST on real candles, labelled as such.
       MINE    (created by the user): scored on their ACTUAL closed trades. A
                strategy with no closed trades shows "—", not a made-up win rate. */
  const [stratTab, setStratTab] = useState("sample");
  const stratsRef = useRef(null);
  const sampleStrats = perf.filter(({ s }) => s.by === "Matrix");
  const myStrats     = perf.filter(({ s }) => s.by !== "Matrix");
  const myActive     = myStrats.filter(({ s }) => s.active);
  const myInactive   = myStrats.filter(({ s }) => !s.active);
  const byOptions = ["All", "Matrix", "You", "Community"];
  const dsel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 8px", fontSize: 11.5 };
  const fmtDate = (t) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

  const DStat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 28%", minWidth: 88, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ fontSize: 9.5, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 15, marginTop: 3, color: c || "#fff" }}>{v}</div>
    </div>
  );
  const MetricMini = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 74 }}>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  const StrategyCard = ({ s, p }) => (
    <div className="card" style={{ padding: 15, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, flex: "0 0 auto", background: s.active ? "var(--up)" : "var(--muted)", boxShadow: s.active ? "0 0 0 4px var(--up-soft)" : "none" }} />
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>by {s.by} · started {fmtDate(s.created)} · {fmt(s.cap || 100000, "IN")}</div>
            {s.symbols && s.symbols.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                {s.symbols.slice(0, 4).map((sy) => <span key={sy} className="pill" style={{ fontSize: 9.5, fontWeight: 700, background: "var(--primary-soft)", color: "var(--primary)", padding: "2px 8px" }}>{sy}</span>)}
                {s.symbols.length > 4 && <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, alignSelf: "center" }}>+{s.symbols.length - 4}</span>}
              </div>
            )}
          </div>
        </div>
        {s.alerts && <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 8px", display: "flex", alignItems: "center", gap: 3, flex: "0 0 auto" }}><Bell size={10} /> Alerts</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        {/* A strategy with no closed trades has NO win rate. stratPerf returns null
            rather than inventing one, so every figure here must handle null. */}
        <MetricMini k="Trades" v={p.trades} />
        <MetricMini k="Win rate" v={p.winRate == null ? "—" : p.winRate.toFixed(0) + "%"} />
        <MetricMini k="P&L" v={p.pnl == null ? "—" : (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, "IN")} c={chgColor(p.pnl)} />
        <MetricMini k="Returns" v={pct(p.retPct, 1)} c={chgColor(p.retPct)} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
        <button onClick={() => setEditStrat(editStrat === s.id ? null : s.id)} className="tap" title="Edit symbols & timeframe" style={{ border: "1px solid " + (editStrat === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: editStrat === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: editStrat === s.id ? "var(--primary)" : "var(--ink)" }}><SlidersHorizontal size={14} /></button>
        <button onClick={() => toggleAlerts(s)} className="tap" title="Alert on entry/exit signal" style={{ border: "1px solid " + (s.alerts ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.alerts ? "var(--primary)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: s.alerts ? "var(--on-primary)" : "var(--ink)" }}><Bell size={14} /></button>
        <button onClick={() => setBtOpen(btOpen === s.id ? null : s.id)} className="tap" style={{ border: "1px solid " + (btOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: btOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: btOpen === s.id ? "var(--primary)" : "var(--ink)" }}><Activity size={13} /> Test</button>
        <button onClick={() => toggleActive(s.id)} className="tap disp" style={{ flex: 1, borderRadius: 11, background: s.active ? "var(--surface)" : "linear-gradient(120deg,var(--up),#0EA968)", color: s.active ? "var(--ink)" : "#fff", boxShadow: s.active ? "none" : "0 6px 16px rgba(16,185,129,.3)", padding: "7px 10px", display: "flex", gap: 5, alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, border: s.active ? "1px solid var(--line)" : "none" }}>
          {s.active ? <><Pause size={13} /> Deactivate</> : <><Play size={13} /> Activate</>}
        </button>
      </div>
      {editStrat === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Symbols</div>
          <MultiSelect label="Symbols" options={DEPLOY_OPTIONS} value={s.symbols || []} onChange={(v) => updateStrat(s.id, { symbols: v })} allLabel="Select…" />
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, margin: "12px 0 6px" }}>Timeframe</div>
          <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {TF_OPTS.map((x) => (
              <button key={x} onClick={() => updateStrat(s.id, { tf: x })} className="pill tap disp" style={{ flex: "0 0 auto", padding: "6px 13px", fontSize: 11.5, fontWeight: 700, border: "1px solid " + ((s.tf || "5m") === x ? "var(--primary)" : "var(--line)"), background: (s.tf || "5m") === x ? "var(--primary)" : "var(--surface)", color: (s.tf || "5m") === x ? "var(--on-primary)" : "var(--ink)" }}>{x}</button>
            ))}
          </div>
          <button onClick={() => setEditStrat(null)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 11, padding: 10, fontWeight: 700, fontSize: 12.5 }}>Done</button>
        </div>
      )}
      {btOpen === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg || { mode: "plain" }} defaultSym={(s.symbols && s.symbols[0]) || undefined} />
        </div>
      )}
    </div>
  );

  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>Automate with Neo</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{{ IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market]} strategies · track performance and manage automations.</div>

      {/* Automation dashboard */}
      <div className="card glow metal" style={{ marginTop: 18, padding: 18, border: "none", background: "var(--feature-grad)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Automation Dashboard</div>
          <span style={{ fontSize: 10.5, opacity: .85 }}>last {dashRange >= 365 ? "12 months" : dashRange + "d"}</span>
        </div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 8 }}>{dRet >= 0 ? "+" : ""}{fmt(agg.pnl, "IN")}</div>
        <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>Total P&amp;L across {shown.length} strategies</div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 }}>
          <DStat k="Active strategies" v={activeCount} />
          <DStat k="Trades executed" v={agg.trades} />
          <DStat k="Win rate" v={agg.trades ? dWinRate.toFixed(0) + "%" : "—"} />
          <DStat k="P&L total" v={(agg.pnl >= 0 ? "+" : "") + fmt(agg.pnl, "IN")} c={agg.pnl >= 0 ? "#9CFFD6" : "#FFB3BE"} />
          <DStat k="Returns %" v={(dRet >= 0 ? "+" : "") + dRet.toFixed(2) + "%"} c={dRet >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <select aria-label="Select option" value={dashBy} onChange={(e) => setDashBy(e.target.value)} style={dsel}>{byOptions.map((o) => <option key={o} value={o}>Created by: {o}</option>)}</select>
          <select aria-label="Select option" value={dashRange} onChange={(e) => setDashRange(+e.target.value)} style={dsel}><option value={30}>30d</option><option value={90}>3m</option><option value={180}>6m</option><option value={365}>12m</option></select>
        </div>
        <div style={{ marginTop: 8 }}>
          <MultiSelect label="Symbol" options={DEPLOY_OPTIONS} value={symFilter} onChange={setSymFilter} dark />
        </div>
      </div>

      {/* Create a new automated strategy */}
      <button onClick={() => setShowBuilder((v) => !v)} className="tap disp glow" style={{ width: "100%", marginTop: 16, background: showBuilder ? "var(--surface)" : "linear-gradient(120deg,var(--primary),var(--primary-2))", color: showBuilder ? "var(--ink)" : "#fff", border: showBuilder ? "1px solid var(--line)" : "none", borderRadius: 16, padding: 15, fontWeight: 700, fontSize: 14.5, display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
        {showBuilder ? <><X size={17} /> Close builder</> : <><Plus size={18} /> Create a New Automated Strategy</>}
      </button>

      {showBuilder && (
        <div className="fade">
          {/* how do you want to build it? */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            {[["builder", "🧩 Visual builder"], ["plain", "✍️ Plain English"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className="tap disp" style={{ flex: 1, padding: "12px 10px", borderRadius: 14, fontWeight: 700, fontSize: 12.5, border: "1px solid " + (mode === k ? "var(--primary)" : "var(--line)"), background: mode === k ? "var(--primary-soft)" : "var(--surface)", color: mode === k ? "var(--primary)" : "var(--ink)" }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 0", lineHeight: 1.5 }}>{mode === "plain" ? "Just describe your entry and exit rules in your own words — no indicators to pick. Matrix interprets them when you deploy." : "Pick indicators, then stack them into signals with AND / OR."}</div>

          {mode === "builder" && (
            <>
              {/* Strategy Ideas (templates) */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "18px 2px 10px", display: "flex", alignItems: "center", gap: 7 }}><Sparkles size={14} color="var(--primary)" /> Strategy Ideas — pick a symbol, then activate</div>
              <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2 }}>
                {TEMPLATES.map((t) => (
                  <TemplateCard key={t.name} t={t} market={market} onActivate={activateTemplate} onToggleBt={(n) => setBtTpl(btTpl === n ? null : n)} btActive={btTpl === t.name} />
                ))}
              </div>
              {btTpl && (
                <div className="card" style={{ marginTop: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>Backtest · {btTpl} <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>· pick a stock or index</span></span>
                    <X size={18} className="tap" color="var(--muted)" onClick={() => setBtTpl(null)} />
                  </div>
                  <BacktestResult cfg={(TEMPLATES.find((x) => x.name === btTpl) || {}).cfg} defaultSym={(syms && syms[0]) || undefined} />
                </div>
              )}

              {/* Step 1 — define indicators */}
              <div className="card" style={{ marginTop: 16, padding: 16 }}>
                <div className="disp" style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="pill gold-text" style={{ fontWeight: 800, fontSize: 12 }}>STEP 1</span> Your indicators
                </div>
                <div className="gold-line" style={{ width: 40, margin: "10px 0 14px", borderRadius: 2 }} />
                <IndicatorDefs defs={defs} setDefs={setDefs} />
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
                <CondBuilder2 label="Exit signal" conds={exitConds} setConds={setExitConds} operands={operands} />
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Timeframe</div>
                <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }}>
                  {["3m", "5m", "10m", "15m", "30m", "1h", "1D"].map((x) => (
                    <button key={x} onClick={() => setTf(x)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 12, fontWeight: 700, border: "1px solid " + (tf === x ? "var(--primary)" : "var(--line)"), background: tf === x ? "var(--primary)" : "var(--surface)", color: tf === x ? "var(--on-primary)" : "var(--ink)" }}>{x}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Entry rules — in plain English</div>
                <textarea value={pEntry} onChange={(e) => setPEntry(e.target.value)} placeholder="e.g. Buy when EMA 9 crosses above EMA 21 and RSI is above 55." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {eParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700 }}>✓ Parsed: {chainCode(eParsed.conds)}</div>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "14px 0 6px" }}>Exit rules — in plain English</div>
                <textarea value={pExit} onChange={(e) => setPExit(e.target.value)} placeholder="e.g. Exit when RSI crosses above 85 or MACD histogram becomes negative or MACD line crosses below MACD signal line." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {xParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700 }}>✓ Parsed: {chainCode(xParsed.conds)}</div>}
                {unparsed.length > 0 && <div style={{ fontSize: 10.5, color: "#F59E42", marginTop: 8, fontWeight: 600 }}>⚠ Couldn't parse: "{unparsed.join('", "')}". Try phrasing like "RSI crosses above 85" or "EMA 9 crosses above SMA 39" — or let AI interpret it below.</div>}
                <button onClick={aiInterpret} disabled={aiStratBusy} className="tap disp" style={{ marginTop: 10, background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 12, padding: "9px 14px", fontWeight: 800, fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center", opacity: aiStratBusy ? 0.6 : 1 }}><Sparkles size={14} /> {aiStratBusy ? "Interpreting…" : "Interpret with AI (Groq)"}</button>
                {aiStrat && <div className="card" style={{ marginTop: 10, padding: 12, background: "var(--elev)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{aiStrat}</div>}
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, display: "flex", gap: 6 }}><Sparkles size={13} color="var(--primary)" style={{ flex: "0 0 auto", marginTop: 1 }} /> Matrix converts your text into the executable code below on the <b style={{ margin: "0 3px" }}>{tf}</b> timeframe — recognises RSI, MACD (line/signal/histogram), EMA/SMA(n), Bollinger bands, ADX, CCI, VWAP, volume, price, with crosses-above/below, greater/less-than and becomes-positive/negative.</div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <NumF label="Stop loss %" v={sl} set={setSl} />
              <NumF label="Take profit %" v={tp} set={setTp} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Capital deployed (₹)</div>
              <input value={capital} onChange={(e) => setCapital(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="100000" className="no-ring mono" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5 }}>Sizes this strategy's P&amp;L. Default ₹1,00,000.</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Deploy on — symbol(s)</div>
              <MultiSelect label="Symbols" options={DEPLOY_OPTIONS} value={deploySyms} onChange={setDeploySyms} allLabel="Select…" />
              {deploySyms.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {deploySyms.map((sy) => (
                  <span key={sy} className="pill" style={{ fontSize: 11, fontWeight: 700, background: "var(--primary-soft)", color: "var(--primary)", padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}>{sy}<X size={12} className="tap" onClick={() => setDeploySyms((p) => p.filter((x) => x !== sy))} /></span>
                ))}
              </div>}
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>The strategy runs on these instruments. Default NIFTY50.</div>
            </div>
            <pre className="mono" style={{ fontSize: 11, background: "#0E0E18", color: "#C9D2FF", border: "1px solid #2A2A3D", borderRadius: 12, padding: 13, marginTop: 14, whiteSpace: "pre-wrap", lineHeight: 1.55, overflowX: "auto" }}>{code}</pre>

            <button onClick={() => setShowBt((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Activity size={16} color="var(--primary)" /> {showBt ? "Hide backtest" : "Backtest this strategy"}</button>
            {showBt && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <BacktestResult cfg={cfg} />
              </div>
            )}

            {/* Save */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Strategy name</div>
              <input value={stratName} onChange={(e) => setStratName(e.target.value)} placeholder="e.g. My Nifty swing setup" className="no-ring disp" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => saveStrategy(false)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Check size={16} color="var(--primary)" /> Save strategy</button>
                <button onClick={() => saveStrategy(true)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Bolt size={16} /> Save &amp; deploy</button>
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

      {/* Strategies — Sample (Matrix-authored) vs My strategies (yours) */}
      <div ref={stratsRef} className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "28px 2px 4px", scrollMarginTop: 80 }}>Strategies</div>
      <div className="gold-line" style={{ width: 44, margin: "0 0 14px 2px", borderRadius: 2 }} />

      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {[["sample", `Sample strategies (${sampleStrats.length})`], ["mine", `My strategies (${myStrats.length})`]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStratTab(k)}
            className="tap disp"
            style={{
              flex: 1, borderRadius: 11, padding: "10px 8px", fontWeight: 800, fontSize: 12.5, cursor: "pointer",
              border: "1px solid " + (stratTab === k ? "var(--primary)" : "var(--line)"),
              background: stratTab === k ? "var(--primary-soft)" : "var(--surface)",
              color: stratTab === k ? "var(--primary)" : "var(--ink)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {stratTab === "sample" ? (
        sampleStrats.length === 0
          ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No sample strategies for this filter.</div>
          : sampleStrats.map(({ s }) => <SampleStrategyCard key={s.id} s={s} onActivate={useTemplateStrategy} />)
      ) : myStrats.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          You haven't created a strategy yet. Build one below, or start from a sample.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--up)", letterSpacing: ".04em", margin: "14px 2px 10px", display: "flex", alignItems: "center", gap: 6 }}>● ACTIVE <span style={{ color: "var(--muted)", fontWeight: 700 }}>({myActive.length})</span></div>
          {myActive.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>None active.</div>
            : myActive.map(({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>)}

          <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", letterSpacing: ".04em", margin: "16px 2px 10px", display: "flex", alignItems: "center", gap: 6 }}>● INACTIVE <span style={{ fontWeight: 700 }}>({myInactive.length})</span></div>
          {myInactive.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>None inactive.</div>
            : myInactive.map(({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>)}
        </>
      )}

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
