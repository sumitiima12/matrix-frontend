import React, { useEffect, useMemo, useRef, useState } from "react";
import { defOperands, chainCode, IND_CATALOG, TEMPLATES, detectTf } from "../domain/strategyLang";
import { backtest, parseRules } from "../domain/backtest";
import { stratPerf } from "../domain/strategies";
import { Activity, Bell, Bolt, Check, ChevronDown, ChevronUp, Copy, Globe, ListChecks, Pause, Pencil, Play, Plus, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BACKEND_URL } from "../config";
import { chgColor, clamp, fmt, pct } from "../lib/format";
import { useBacktestStats } from "../hooks/useBacktestStats";
import { SMAarr, EMAarr, RSIarr, MACDarr, BBarr, CCIarr, ATRarr, VWAParr, ADXarr, CF } from "../lib/series";
import { ALL, UNIVERSE, marketOf } from "../domain/universe";
import { apiListPublicStrategies, apiPublishStrategy, apiUnpublishStrategy, aiInterpretStrategyAI } from "../domain/api";
import { humanizeStrategy, humanizeCond, PATTERN_EXPLAIN, patternsInConds } from "../domain/strategyLang";
/* Neo's plain-English read-back of a set of conditions: "a Cup & Handle forms, and RSI is below 40". */
const neoReads = (conds) => (conds || []).map((c, i) => `${i ? (c.gate === "OR" ? "or " : "and ") : ""}${humanizeCond(c)}`).join(", ");
import { useCandles } from "../hooks/useCandles";
import OptionLeg from "../components/common/OptionLeg";
import MultiSelect from "../components/common/MultiSelect";
import { selStyle } from "../components/common/styles";
import { brokerSymbol } from "../domain/brokerSymbols";
import { registerAutoBuy, loadAutoBuys, pauseAutoBuy, cancelAutoBuy, setAutoBuyLive } from "../services/brokerService";

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
  /* THE DATE RANGE USED TO BE DECORATIVE.
     It computed `bars` = the number of DAYS between From and To, then sliced that many
     CANDLES — of whatever timeframe. On a 3-minute chart, "6 months" became 180 two-minute
     bars: about six hours of one session. The dates never filtered by date at all, and a
     strategy that would have traded plenty over six months reported zero trades.

     Now: filter by real timestamps, and compute indicators over the FULL history so a
     20-period Bollinger band isn't NaN for the entire window. */
  const { data: realData, loading: btLoading } = useCandles(sym, tf);

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
    () => (!cfg || cfg.mode === "plain" || !data ? null : backtest(cfg, data, startIdx)),
    [cfg, data, startIdx]
  );

  const bars = covered ? covered.inWindow : 0;
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
  const TF_COVER = { "1m": "1 day", "3m": "1 day", "5m": "5 days", "15m": "1 month", "30m": "1 month", "1h": "3 months", "4h": "6 months", "1d": "1 year" };
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
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Real market candles · past performance is not a prediction. Not financial advice.</div>
    </div>
  );
}

/* ============================== TRADE AUTOMATION ============================== */

const TFS = ["3m", "5m", "15m", "30m", "1h", "4h", "1D"];
const OPSET = [[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="], ["crosses_above", "⤴ crosses above"], ["crosses_below", "⤵ crosses below"], ["crossed_above_within", "⤴ crossed above (within N)"], ["crossed_below_within", "⤵ crossed below (within N)"]];

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
function IndicatorDefs({ defs, setDefs }) {
  const [openId, setOpenId] = useState(null);   // which indicator's settings panel is expanded
  const upd = (id, k, v) => setDefs((p) => p.map((d) => d.id === id ? { ...d, [k]: v } : d));
  const add = () => setDefs((p) => [...p, { id: Date.now(), type: "EMA", len: "20", tf: "1D", name: "IND" + (p.length + 1) }]);
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

function CondBuilder2({ label, conds, setConds, operands }) {
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
                color: value === o && !off ? "#fff" : "var(--ink)",
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

function SampleStrategyCard({ s, onActivate, onClone, onEdit, market = "IN" }) {
  const { loading, stats } = useBacktestStats(s);
  const [bt, setBt] = useState(false);
  const [size, setSize] = useState(market === "Crypto" ? 200 : 1);

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

      <DeploySizeField market={market} value={size} onChange={setSize} />

      {/* TEST BEFORE YOU ACTIVATE. The headline stats above are a fixed backtest; this
          is the interactive one — pick the symbol, timeframe and window yourself. It was
          only available on strategies you'd already deployed, which is backwards. */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setBt((v) => !v)}
          className="tap disp"
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: bt ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
        >
          <Activity size={14} /> Test
        </button>
        {onClone && (
          <button onClick={() => onClone(s)} className="tap disp"
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            <Copy size={14} /> Clone
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(s)} className="tap disp" title="Admin: edit this strategy"
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            <Pencil size={14} /> Edit
          </button>
        )}
        {onActivate && (
          <button onClick={() => onActivate(s, size)} className="tap disp"
            style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            Use
          </button>
        )}
      </div>

      {bt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg} defaultSym={(s.symbols && s.symbols[0]) || undefined} />
        </div>
      )}
    </div>
  );
}

/* Premium strategy card — locked. Shows only the name + a short description, with a
   backtest and an activate toggle. No rules are revealed and it cannot be edited or
   copied as a template. */
function PremiumStrategyCard({ s, active, onToggle, onEdit, market = "IN" }) {
  const { loading, stats } = useBacktestStats(s);
  const [bt, setBt] = useState(false);
  const [size, setSize] = useState(market === "Crypto" ? 200 : 1);
  /* Show a symbol relevant to the CURRENT market. Premium strategies are shared across
     markets, so under Crypto we surface a crypto symbol, not the Indian one they were saved
     with. Fall back to the first symbol of this market's universe. */
  const relSyms = (s.symbols || []).filter((x) => marketOf(x) === market);
  const relSym = relSyms[0] || ((UNIVERSE[market] || [])[0] || {}).sym || (s.symbols && s.symbols[0]) || null;
  const shownSyms = relSyms.length ? relSyms : (relSym ? [relSym] : []);

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
          {shownSyms.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{shownSyms.join(" · ")}</div>}
          {s.desc && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{s.desc}</div>}
        </div>
        <span className="pill gold-border" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 9px", color: "var(--gold)", flex: "0 0 auto", whiteSpace: "nowrap" }}>★ PREMIUM</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Backtesting on real prices…</div>
      ) : stats && stats.trades > 0 ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Stat k="WIN RATE" v={stats.winRate.toFixed(0) + "%"} />
          <Stat k="TRADES" v={stats.trades} />
          <Stat k="RETURN" v={pct(stats.retPct, 1)} c={chgColor(stats.retPct)} />
        </div>
      ) : null}

      <DeploySizeField market={market} value={size} onChange={setSize} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setBt((v) => !v)}
          className="tap disp"
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: bt ? "var(--elev)" : "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
        >
          <Activity size={14} /> Backtest
        </button>
        {onEdit && (
          <button onClick={() => onEdit(s)} className="tap disp" title="Admin: edit this strategy"
            style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            <Pencil size={14} /> Edit
          </button>
        )}
        <button
          onClick={() => onToggle(relSym, size)}
          className="tap disp"
          style={{ flex: 1, border: "1px solid " + (active ? "var(--up)" : "var(--primary)"), background: active ? "var(--up-soft)" : "var(--primary)", color: active ? "var(--up)" : "#fff", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
        >
          {active ? "✓ Activated" : "Activate"}
        </button>
      </div>

      {bt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg} defaultSym={relSym || undefined} />
        </div>
      )}
    </div>
  );
}

/* Manager for strategies armed for real-money auto-buy — filtered to the CURRENT market,
   with each strategy's name, live P&L, and pause/cancel. An admin can flip the whole engine
   between LIVE and DRY-RUN here (no server env change needed). */
function LiveAutoBuys({ userId, market = "IN", isAdmin = false, adminKey = "" }) {
  const [data, setData] = useState({ strategies: [], engineLive: false });
  const [busy, setBusy] = useState(false);
  const refresh = () => { if (userId) loadAutoBuys(userId).then(setData); };
  useEffect(() => { refresh(); const id = setInterval(refresh, 12000); return () => clearInterval(id); /* eslint-disable-next-line */ }, [userId]);
  // Only strategies for the market you're on (a crypto auto-buy doesn't show under Indian).
  const live = (data.strategies || []).filter((s) => (s.status === "active" || s.status === "paused") && (s.market || "Crypto") === market);
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
  const liveSorted = [...live].sort((a, b) => sigAt(b) - sigAt(a));
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12, border: "1px solid var(--down)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Bolt size={15} color="var(--down)" />
        <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Live Real Deployed</div>
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
        return (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{s.name || s.symbol} {s.status === "paused" && <span style={{ color: "var(--muted)", fontWeight: 700 }}>· paused</span>}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{s.symbol} · {s.broker}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{ccy}{s.notional} / trade · {s.tp ? `TP ${s.tp}% ` : ""}{s.sl ? `SL ${s.sl}%` : ""}</div>
            {/* Order status of the last attempt — a rejected order shows WHY (e.g. insufficient
                balance), so it's never mistaken for a silent no-op. */}
            {s.lastOrderStatus === "rejected" && (
              <div style={{ fontSize: 10, color: "var(--down)", fontWeight: 700, marginTop: 3, lineHeight: 1.4 }}>⚠ Order rejected{s.lastError ? ` — ${s.lastError}` : " — not filled"}</div>
            )}
            {s.lastOrderStatus === "partial" && (
              <div style={{ fontSize: 10, color: "#B87514", fontWeight: 700, marginTop: 3 }}>◑ Partially filled{s.lastError ? ` — ${s.lastError}` : ""}</div>
            )}
            {filled && (
              <div style={{ fontSize: 9.5, color: "var(--up)", fontWeight: 700, marginTop: 3 }}>● Filled — position open</div>
            )}
            {!filled && placed && (
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, marginTop: 3 }}>◔ Order placed — awaiting fill</div>
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
                  : <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }} title="Buys automatically when your entry rule fires on live candles.">waiting for entry</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => doPause(s)} className="tap" style={{ border: "1px solid " + (s.status === "active" ? "var(--line)" : "var(--up)"), background: s.status === "active" ? "transparent" : "var(--up-soft)", color: s.status === "active" ? "var(--muted)" : "var(--up)", borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 800 }}>{s.status === "active" ? "❚❚ Pause" : "▶ Start"}</button>
              <button onClick={() => doCancel(s)} className="tap" style={{ border: "1px solid var(--down)", background: "transparent", color: "var(--down)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}><X size={10} /> Stop</button>
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

export default function Automation({ market = "IN", appMode = "virtual", onRecord, trades = [], strats = [], setStrats, onExitAll, me = null, isAdmin = false, userId = null, brokerFor = null, adminKey = "" }) {
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
  useEffect(() => { refreshArmed(); const t = setInterval(refreshArmed, 20000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [userId]);
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
  const [deploySyms, setDeploySyms] = useState(["NIFTY50"]);
  const [symFilter, setSymFilter] = useState([]);
  /* Symbols for the market you are actually on. This was hardcoded to the F&O
     list, so on the US or Crypto tab the builder offered you Indian F&O names —
     symbols the strategy would then try (and fail) to trade in that wallet. */
  const DEPLOY_OPTIONS = useMemo(() => (
    (UNIVERSE[market] || []).map((s) => s.sym)
  ), [market]);
  const [pEntry, setPEntry] = useState("Buy when EMA 9 crosses above EMA 21 and RSI is above 55.");
  const [pExit, setPExit] = useState("Exit when RSI crosses above 85 or MACD histogram becomes negative or MACD line crosses below MACD signal line.");
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
  const [dashPreset, setDashPreset] = useState("12m");
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
    const d = detectTf(pEntry) || detectTf(pExit);
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
        const defsWithId = (ai.defs || []).map((d, i) => ({ id: Date.now() + i, type: d.type, len: String(d.len == null ? "" : d.len), tf, name: d.name }));
        setDefs(defsWithId);
        setEntryConds(ai.entry && ai.entry.length ? ai.entry : []);
        setExitConds(ai.exit && ai.exit.length ? ai.exit : []);
        setMode("builder");
        setAiMsg({ ok: true, t: "Neo interpreted your prompt into the builder below — review and deploy." });
      } else {
        setAiMsg({ ok: false, t: "Neo couldn't interpret that. Try describing the entry more concretely." });
      }
    } catch { setAiMsg({ ok: false, t: "Couldn't reach Neo just now — try again." }); }
    setAiBusy(false);
  };
  const plainDefs = useMemo(() => { const d = []; [...eParsed.defs, ...xParsed.defs].forEach((x) => { if (x && !d.find((y) => y.name === x.name)) d.push(x); }); return d; }, [eParsed, xParsed]);
  const cfg = mode === "builder"
    ? { mode: "builder", tf, defs, entry: entryConds, exit: exitConds, sl, tp }
    : { mode: "builder", tf, defs: plainDefs.map((d) => ({ ...d, tf })), entry: eParsed.conds, exit: xParsed.conds, sl, tp };
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
    setStratTab("mine"); setTopTab("mine");
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
    setStrats((p) => [{ id, name: t.name, by: creator, active: true, alerts: false, cfg: t.cfg, cap: sz, qty: sz, symbols, created: Date.now() }, ...p]);
    setToast(`${t.name} is live on ${symbols.join(", ")} — it will place orders when its rules trigger.`);
    setStratTab("mine"); setTopTab("mine");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /* "Use this strategy" on a sample: copy its rules and symbols into your own. */
  const useTemplateStrategy = (s, size) => activateTemplate({ name: s.name, cfg: s.cfg }, s.symbols, size);

  /* Clone: drop an editable copy into "My strategies" (inactive), so you can tweak it
     before deploying. Works from Samples and from your own strategies. */
  const cloneStrategy = (s) => {
    const id = "c" + Date.now();
    setStrats((p) => [
      { id, name: s.name + " (copy)", by: creator, active: false, alerts: false, cfg: s.cfg, cap: s.cap || 100000, symbols: (s.symbols || []).slice(), tf: s.tf, created: Date.now() },
      ...p,
    ]);
    setToast(`Cloned "${s.name}" into My strategies — edit it there.`);
    setStratTab("mine"); setTopTab("mine");
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
    setDefs((cfg.defs || []).map((d, i) => ({ id: Date.now() + i, tf: d.tf || "1D", ...d })));
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
  const togglePremiumHere = (id, relSym, size) => setStrats((p) => p.map((s) => {
    if (s.id !== id) return s;
    if (activeInMarket(s)) return { ...s, active: false };
    return { ...s, active: true, ...(relSym ? { symbols: [relSym] } : {}), ...(size != null ? { qty: size, cap: size } : {}) };
  }));
  const toggleAlerts = (s) => { const willOn = !s.alerts; setStrats((p) => p.map((x) => x.id === s.id ? { ...x, alerts: willOn } : x)); if (willOn) fireAlert(s); };
  const updateStrat = (id, patch) => setStrats((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  const [editStrat, setEditStrat] = useState(null);
  const TF_OPTS = ["3m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"];

  // dashboard aggregation — scoped to the selected market
  const amkt = market;
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
  const [topTab, setTopTab] = useState("build");   // build | sample | premium | public | mine

  // ---- Public strategies (shared across users) ----
  const [publicList, setPublicList] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [pubSym, setPubSym] = useState("");   // symbol filter
  const [pubBy, setPubBy] = useState("");      // posted-by filter
  const refreshPublic = React.useCallback(() => {
    setPublicLoading(true);
    apiListPublicStrategies({ symbol: pubSym, by: pubBy }).then((l) => { setPublicList(Array.isArray(l) ? l : []); setPublicLoading(false); });
  }, [pubSym, pubBy]);
  useEffect(() => { if (topTab === "public") refreshPublic(); }, [topTab, refreshPublic]);
  const publishOwn = async (s) => {
    const r = await apiPublishStrategy({ id: "pub_" + s.id, name: s.name, symbols: s.symbols || [], cfg: s.cfg });
    if (r && r.ok) { updateStrat(s.id, { publicId: (r.strategy && r.strategy.id) || ("pub_" + s.id) }); setToast(`"${s.name}" is now public.`); if (topTab === "public") refreshPublic(); }
    else setToast((r && r.error) || "Couldn't publish — make sure you're signed in.");
  };
  const unpublishOwn = async (s) => {
    if (s.publicId) await apiUnpublishStrategy(s.publicId);
    updateStrat(s.id, { publicId: null });
    setToast(`"${s.name}" removed from public.`);
    if (topTab === "public") refreshPublic();
  };
  // Clone a public strategy into "My strategies" (editable, inactive).
  const clonePublic = (ps) => {
    const id = "c" + Date.now();
    setStrats((p) => [{ id, name: (ps.name || "Strategy") + " (copy)", by: creator, active: false, alerts: false, cfg: ps.data || ps.cfg || { mode: "builder" }, cap: 100000, symbols: ps.symbols || [], created: Date.now() }, ...p]);
    setToast(`Cloned "${ps.name}" into My strategies.`);
    setStratTab("mine"); setTopTab("mine");
    setTimeout(() => stratsRef.current && stratsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const publicByOptions = useMemo(() => Array.from(new Set(publicList.map((s) => s.owner_name).filter(Boolean))), [publicList]);
  const publicSymOptions = useMemo(() => Array.from(new Set(publicList.flatMap((s) => s.symbols || []))), [publicList]);
  const [activeTab, setActiveTab] = useState("active"); // active | inactive (inside My strategies)
  const stratsRef = useRef(null);
  const sampleStrats = perf.filter(({ s }) => s.by === "Matrix" && !s.premium);
  // Premium strategies are shown in EVERY market (not market-filtered) and are locked:
  // name + description only, activate + backtest, no template/edit.
  const premiumStrats = strats.filter((s) => s.premium);
  /* A strategy belongs to the market of the symbol it's deployed on. So a crypto strategy
     doesn't show under US. Strategies with no symbol yet appear in every market. */
  const stratInMarket = (s) => { const sy = (s.symbols || [])[0]; return !sy || marketOf(sy) === market; };
  // "Mine" = ONLY strategies this user created (not samples, premium, or others' public).
  const mineOwn      = perf.filter(({ s }) => s.by === creator && stratInMarket(s));
  const myStrats     = mineOwn;
  /* "Deployed" spans EVERY type (Mine, Premium, Sample, Public), split into Active
     (running now) and Inactive, each shown with its type + state tag — market-filtered. */
  const deployedActive   = strats.filter((s) => s.active && stratInMarket(s)).map((s) => ({ s, p: stratPerf(s, trades, dashRange) }));
  const deployedInactive = strats.filter((s) => !s.active && stratInMarket(s)).map((s) => ({ s, p: stratPerf(s, trades, dashRange) }));
  const myActive     = deployedActive;
  const myInactive   = deployedInactive;
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
  const StrategyCard = ({ s, p }) => {
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
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>by {s.by} · started {fmtDate(s.created)} · {fmt(s.cap || 100000, "IN")}</div>
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
        <MetricMini k="P&L" v={p.pnl == null ? "—" : (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, "IN")} c={chgColor(p.pnl)} />
        <MetricMini k="Returns" v={pct(p.retPct, 1)} c={chgColor(p.retPct)} />
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
        <button onClick={() => setEditStrat(editStrat === s.id ? null : s.id)} className="tap" title="Edit symbols & timeframe" style={{ border: "1px solid " + (editStrat === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: editStrat === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: editStrat === s.id ? "var(--primary)" : "var(--ink)" }}><SlidersHorizontal size={14} /></button>
        <button onClick={() => loadForEdit(s)} className="tap" title="Edit this strategy's rules in the builder" style={{ border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}><Pencil size={13} /> Edit</button>
        <button onClick={() => toggleAlerts(s)} className="tap" title="Alert on entry/exit signal" style={{ border: "1px solid " + (s.alerts ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.alerts ? "var(--primary)" : "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: s.alerts ? "var(--on-primary)" : "var(--ink)" }}><Bell size={14} /></button>
        <button onClick={() => setBtOpen(btOpen === s.id ? null : s.id)} className="tap" style={{ border: "1px solid " + (btOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: btOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: btOpen === s.id ? "var(--primary)" : "var(--ink)" }}><Activity size={13} /> Test</button>
        <button onClick={() => setLedgerOpen(ledgerOpen === s.id ? null : s.id)} className="tap" title="Every trade this strategy has taken" style={{ border: "1px solid " + (ledgerOpen === s.id ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: ledgerOpen === s.id ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: ledgerOpen === s.id ? "var(--primary)" : "var(--ink)" }}><ListChecks size={13} /> Trades</button>
        <button onClick={() => cloneStrategy(s)} className="tap" title="Clone into a new editable strategy" style={{ border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", padding: "7px 10px", display: "grid", placeItems: "center", color: "var(--ink)" }}><Copy size={14} /></button>
        <button onClick={() => (s.publicId ? unpublishOwn(s) : publishOwn(s))} className="tap" title={s.publicId ? "Remove from public" : "Make public"} style={{ border: "1px solid " + (s.publicId ? "var(--primary)" : "var(--line)"), borderRadius: 11, background: s.publicId ? "var(--primary-soft)" : "var(--surface)", padding: "7px 11px", display: "flex", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 700, color: s.publicId ? "var(--primary)" : "var(--ink)" }}><Globe size={13} /> {s.publicId ? "Public" : "Publish"}</button>
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
          <button onClick={() => setEditStrat(null)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 11, padding: 10, fontWeight: 700, fontSize: 12.5 }}>Done</button>
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
              <div style={{ display: "grid", gap: 6 }}>
                {rows.slice(0, 40).map((t, i) => {
                  const closed = t.exitAt != null && t.exit != null;
                  const pnl = closed ? (t.exit - t.entry) * (t.qty || 1) : null;
                  return (
                    <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "7px 9px", background: "var(--elev)", borderRadius: 9 }}>
                      <span style={{ fontWeight: 800, flex: "0 0 auto" }}>{t.sym}</span>
                      <span style={{ color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(t.side || "BUY")} {t.qty || 1} @ {fmt(t.entry, mkt(t))}{closed ? ` → ${fmt(t.exit, mkt(t))}` : ""}</span>
                      <span className="mono" style={{ marginLeft: "auto", fontWeight: 800, flex: "0 0 auto", color: closed ? chgColor(pnl) : "var(--muted)" }}>
                        {closed ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, mkt(t))}` : "open"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
      {btOpen === s.id && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <BacktestResult cfg={s.cfg || { mode: "plain" }} defaultSym={(s.symbols && s.symbols[0]) || undefined} />
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>Automate with Neo</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{{ IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market]} strategies · track performance and manage automations.</div>

      {/* Live Real Deployed — REAL mode only (real-money armed strategies). */}
      {appMode === "real" && <div style={{ marginTop: 14 }}><LiveAutoBuys userId={userId} market={market} isAdmin={isAdmin} adminKey={adminKey} /></div>}

      {/* Virtual Live Deployed — the paper-mode twin of "Live Real Deployed": every ACTIVE
          paper strategy for this market, with its simulated P&L. VIRTUAL mode only. */}
      {appMode !== "real" && (() => {
        /* Latest ENTRY first: a strategy that just opened a paper trade sits at the top. */
        const lastEntry = (s) => (trades || []).reduce((mx, t) => ((t.strategyId === s.id || t.strategy === s.name) && (t.entryAt || 0) > mx ? t.entryAt : mx), 0);
        const vd = strats.filter((s) => s.active && inMkt(s))
          .map((s) => ({ s, p: stratPerf(s, trades, dashRange), e: lastEntry(s) }))
          .sort((a, b) => b.e - a.e);
        if (!vd.length) return null;
        return (
          <div className="card" style={{ padding: 14, marginTop: 12, border: "1px solid var(--primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Sparkles size={15} color="var(--primary)" />
              <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Virtual Live Deployed</div>
              <span className="pill" style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, padding: "3px 8px", background: "var(--elev)", color: "var(--muted)" }}>PAPER</span>
            </div>
            <CollapsibleList items={vd} initial={5} reverse={false} render={({ s, p }) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{s.name || (s.symbols && s.symbols[0]) || "Strategy"}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{(s.symbols || []).join(", ") || "—"} · by {s.by}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{p.trades} trades · {p.trades ? (p.wins / p.trades * 100).toFixed(0) : 0}% win</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 800, color: chgColor(p.pnl) }}>{p.trades ? (p.pnl >= 0 ? "+" : "") + fmt(p.pnl, market) : "—"}</div>
                  {p.trades && p.retPct != null
                    ? <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: chgColor(p.retPct) }}>{p.retPct >= 0 ? "+" : ""}{p.retPct.toFixed(2)}%</div>
                    : <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{p.trades ? "paper P&L" : "waiting for signal"}</div>}
                </div>
              </div>
            )} />
          </div>
        );
      })()}

      {/* Automation dashboard — collapsed by default (P&L + expand), expands to all details. */}
      <div className="card glow metal" style={{ marginTop: 18, padding: 18, border: "none", background: "var(--feature-grad)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 13, opacity: .9 }}>Automation P&amp;L</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 3, color: agg.pnl >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{agg.pnl >= 0 ? "+" : ""}{fmt(agg.pnl, "IN")}</div>
          </div>
          <button onClick={() => setDashOpen((v) => !v)} className="tap" title={dashOpen ? "Collapse" : "Expand"} style={{ flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.1)", color: "#fff", borderRadius: 10, padding: "7px" }}>
            {dashOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {dashOpen && (
          <>
            <div style={{ fontSize: 11, opacity: .85, marginTop: 10 }}>Across {shown.length} strategies</div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 12 }}>
              <DStat k="Active strategies" v={activeCount} />
              <DStat k="Trades executed" v={agg.trades} />
              <DStat k="Win rate" v={agg.trades ? dWinRate.toFixed(0) + "%" : "—"} />
              <DStat k="Returns %" v={(dRet >= 0 ? "+" : "") + dRet.toFixed(2) + "%"} c={dRet >= 0 ? "#9CFFD6" : "#FFB3BE"} />
            </div>
            <div style={{ fontSize: 10, opacity: .7, fontWeight: 700, letterSpacing: ".04em", margin: "16px 0 7px" }}>FILTERS</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select aria-label="Created by" value={dashBy} onChange={(e) => setDashBy(e.target.value)} style={dsel}>{byOptions.map((o) => <option key={o} value={o}>Created by: {o}</option>)}</select>
              <select aria-label="Time period" value={dashPreset} onChange={(e) => setDashPreset(e.target.value)} style={dsel}>{DASH_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            {dashPreset === "custom" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="date" aria-label="From" value={dashFrom} onChange={(e) => setDashFrom(e.target.value)} className="no-ring mono" style={{ ...dsel, colorScheme: "dark" }} />
                <input type="date" aria-label="To" value={dashTo} onChange={(e) => setDashTo(e.target.value)} className="no-ring mono" style={{ ...dsel, colorScheme: "dark" }} />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <MultiSelect label="Symbol" options={DEPLOY_OPTIONS} value={symFilter} onChange={setSymFilter} dark />
            </div>
          </>
        )}
      </div>

      {/* TOP SELECTOR — one place to switch between building, samples, and your own. */}
      <div style={{ display: "flex", gap: 7, marginTop: 18 }}>
        {[["build", "Build"], ["deployed", "Deployed"], ["sample", `Samples`], ["premium", `Premium`], ["public", "Public"], ["mine", `Mine`]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTopTab(k)}
            className="tap disp"
            style={{
              flex: 1, borderRadius: 10, padding: "10px 2px", fontWeight: 800, fontSize: 10.5,
              cursor: "pointer",
              border: "1px solid " + (topTab === k ? "var(--primary)" : "var(--line)"),
              background: topTab === k ? "var(--primary)" : "var(--surface)",
              color: topTab === k ? "#fff" : "var(--ink)",
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
            {[["builder", "🧩 Visual builder"], ["plain", "✍️ Write a Prompt"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className="tap disp" style={{ flex: 1, padding: "12px 10px", borderRadius: 14, fontWeight: 700, fontSize: 12.5, border: "1px solid " + (mode === k ? "var(--primary)" : "var(--line)"), background: mode === k ? "var(--primary-soft)" : "var(--surface)", color: mode === k ? "var(--primary)" : "var(--ink)" }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 0", lineHeight: 1.5 }}>{mode === "plain" ? "Just describe your entry and exit rules in your own words — no indicators to pick. Matrix interprets them when you deploy." : "Pick indicators, then stack them into signals with AND / OR."}</div>

          {/* Strategy name — first thing, before the steps. */}
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Strategy name{editingId ? " · editing" : ""}</div>
            <input value={stratName} onChange={(e) => setStratName(e.target.value)} placeholder="e.g. Momentum Rider" className="no-ring disp" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />

            {/* Deploy on — symbol, right under the name; then the Stock / Option toggle above Step 1. */}
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "14px 0 6px" }}>Deploy on — symbol</div>
            <select value={deploySyms[0] || ""} onChange={(e) => setDeploySyms(e.target.value ? [e.target.value] : [])} aria-label="Deploy symbol" style={{ ...selStyle, width: "100%" }}>
              <option value="">Choose a symbol…</option>
              {DEPLOY_OPTIONS.map((sy) => <option key={sy} value={sy}>{sy}</option>)}
            </select>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>The strategy runs on this instrument.</div>
            <OptionLeg symbols={deploySyms.length ? deploySyms : ["NIFTY50"]} value={optLeg} onChange={setOptLeg} />
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
                  <BacktestResult cfg={(TEMPLATES.find((x) => x.name === btTpl) || {}).cfg} defaultSym={DEPLOY_OPTIONS[0]} />
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
                <textarea value={pEntry} onChange={(e) => setPEntry(e.target.value)} placeholder="e.g. Buy when a cup and handle forms — or: Buy when price bounces off support and RSI is above 55." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {eParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700, display: "flex", gap: 5 }}><Sparkles size={12} style={{ flex: "0 0 auto", marginTop: 1 }} /><span>Neo reads: buy when {neoReads(eParsed.conds)}.</span></div>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "14px 0 6px" }}>Exit rules — in plain English</div>
                <textarea value={pExit} onChange={(e) => setPExit(e.target.value)} placeholder="e.g. Exit when price bounces off resistance, or when RSI crosses above 85." className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13, minHeight: 84, background: "var(--elev)", resize: "vertical", lineHeight: 1.5 }} />
                {xParsed.conds.length > 0 && <div style={{ fontSize: 10.5, color: "var(--up)", marginTop: 6, fontWeight: 700, display: "flex", gap: 5 }}><Sparkles size={12} style={{ flex: "0 0 auto", marginTop: 1 }} /><span>Neo reads: exit when {neoReads(xParsed.conds)}.</span></div>}
                {[...new Set([...patternsInConds(eParsed.conds), ...patternsInConds(xParsed.conds)])].filter((k) => PATTERN_EXPLAIN[k]).map((k) => (
                  <div key={k} style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px" }}>
                    <b style={{ color: "var(--ink)" }}>How Neo detects a {k.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}:</b> {PATTERN_EXPLAIN[k]}
                  </div>
                ))}
                {unparsed.length > 0 && <div style={{ fontSize: 10.5, color: "#F59E42", marginTop: 8, fontWeight: 600 }}>⚠ Neo couldn't read that part. Try describing an entry like a chart pattern, a support/resistance level, or an indicator condition.</div>}
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
                <BacktestResult cfg={cfg} />
              </div>
            )}

            {/* Save */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => saveStrategy(false)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Check size={16} color="var(--primary)" /> {editingId ? "Update" : "Save strategy"}</button>
                <button onClick={() => saveStrategy(true)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Bolt size={16} /> {editingId ? "Update & deploy" : "Save & deploy"}</button>
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
      {topTab !== "build" && (<>
      <div ref={stratsRef} className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "28px 2px 4px", scrollMarginTop: 80 }}>Strategies</div>
      <div className="gold-line" style={{ width: 44, margin: "0 0 14px 2px", borderRadius: 2 }} />


      {topTab === "sample" ? (
        sampleStrats.length === 0
          ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No sample strategies for this market.</div>
          : sampleStrats.map(({ s }) => <SampleStrategyCard key={s.id} s={s} market={market} onActivate={useTemplateStrategy} onClone={cloneStrategy} onEdit={isAdmin ? loadForEdit : undefined} />)
      ) : topTab === "premium" ? (
        <>
          <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 2px 4px", lineHeight: 1.5 }}>
            Matrix's curated strategies — available in every market. Activate to run them live, or backtest first. Their rules are locked.
          </div>
          {premiumStrats.length === 0
            ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>No premium strategies available.</div>
            : premiumStrats.map((s) => <PremiumStrategyCard key={s.id} s={s} active={activeInMarket(s)} market={market} onToggle={(rs, size) => togglePremiumHere(s.id, rs, size)} onEdit={isAdmin ? loadForEdit : undefined} />)}
        </>
      ) : topTab === "public" ? (
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
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>by {ps.owner_name || "user"}{(ps.symbols || []).length ? " · " + ps.symbols.join(" · ") : ""}</div>
                    </div>
                    <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--primary-soft)", color: "var(--primary)", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 4 }}><Globe size={11} /> PUBLIC</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setBtOpen(btOpen === ps.id ? null : ps.id)} className="tap disp" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 11, padding: "10px 13px", fontWeight: 800, fontSize: 12.5 }}><Activity size={14} /> Backtest</button>
                    <button onClick={() => clonePublic(ps)} className="tap disp" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5 }}><Copy size={14} style={{ verticalAlign: "-2px" }} /> Clone</button>
                  </div>
                  {btOpen === ps.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                      <BacktestResult cfg={ps.data || ps.cfg} defaultSym={(ps.symbols && ps.symbols[0]) || undefined} />
                    </div>
                  )}
                </div>
              ))}
        </>
      ) : topTab === "deployed" ? (
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
        /* MINE — only strategies this user created; each card carries its Active/Inactive tag. */
        <>
          <CollapsibleList items={mineOwn} render={({ s, p }) => <React.Fragment key={s.id}>{StrategyCard({ s, p })}</React.Fragment>} />
        </>
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
