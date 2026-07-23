import React, { useEffect, useMemo, useState } from "react";
import { ALL, UNIVERSE } from "../../domain/universe";
import { CUR, chgColor, fmt, lsGet, lsSet } from "../../lib/format";
import { defOperands } from "../../domain/strategyLang";
import { scanScreener, marketOpen } from "../../domain/api";
import { CondBuilder2, IndicatorDefs, TFS } from "../../pages/Automation";
import { Play, Search } from "lucide-react";

/* CREATE YOUR OWN SCREENER — the second tab of "Popular Screeners".
   Same builder as Automate (indicators + entry/exit chains + timeframe), but instead of deploying a
   single strategy it (1) lets you pick a basket of symbols by checkbox, (2) set a per-symbol
   stop-loss, target and quantity, and (3) flip on "Screener Auto-Buy" — which, exactly like Smart
   Auto-Buy, places (paper or real, by app mode) a bracketed order once a day for every symbol in your
   basket that meets the entry trigger. Those orders are journalled as trade type "Screener Auto Buy",
   so their P&L rolls into the homepage Total alongside Manual, Auto-Buy and Automate. */

const TODAY = new Date().toISOString().slice(0, 10);
const DAY_KEY = TODAY.replace(/-/g, "");
/* Tiny stable hash so a changed config gets a different backend cache key (the scan is cached ~2min
   keyed on `key`+tf+symbols and does NOT hash the conditions itself). */
function sig(obj) {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}
const qtyDefault = (m) => (m === "Crypto" ? 200 : 1);   // crypto = USD amount, others = share/lot count
const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };

export default function CustomScreener({ market, mode = "virtual", onOpen, onBuy, onScreenerBuy, liveTick = 0 }) {
  const LSK = `mx_customscr_${market}`;
  // Persisted builder state (per market), so a screener you set up survives a reload.
  const saved = useMemo(() => lsGet(LSK, null) || {}, [LSK, market]);
  const [defs, setDefs] = useState(() => saved.defs || [{ id: Date.now(), type: "EMA", len: "20", tf: "5m", name: "EMA1" }]);
  const [entryConds, setEntryConds] = useState(() => saved.entry || [{ la: "Price", op: "crosses_above", bType: "ind", b: "EMA1", gate: "AND" }]);
  const [exitConds, setExitConds] = useState(() => saved.exit || [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA1", gate: "AND" }]);
  const [tf, setTf] = useState(() => saved.tf || "5m");
  const [selSyms, setSelSyms] = useState(() => saved.selSyms || []);
  const [ov, setOv] = useState(() => saved.ov || {});          // per-symbol { sl, tp, qty }
  const [autoOn, setAutoOn] = useState(() => lsGet(`${LSK}_auto`, false));
  const [period, setPeriod] = useState("today");
  const [matches, setMatches] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [ran, setRan] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  // Reload persisted state when the market changes (each market keeps its own screener).
  useEffect(() => {
    const s = lsGet(LSK, null) || {};
    setDefs(s.defs || [{ id: Date.now(), type: "EMA", len: "20", tf: "5m", name: "EMA1" }]);
    setEntryConds(s.entry || [{ la: "Price", op: "crosses_above", bType: "ind", b: "EMA1", gate: "AND" }]);
    setExitConds(s.exit || [{ la: "Price", op: "crosses_below", bType: "ind", b: "EMA1", gate: "AND" }]);
    setTf(s.tf || "5m");
    setSelSyms(s.selSyms || []);
    setOv(s.ov || {});
    setAutoOn(lsGet(`${LSK}_auto`, false));
    setMatches([]); setRan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  // Persist on every change.
  useEffect(() => { lsSet(LSK, { defs, entry: entryConds, exit: exitConds, tf, selSyms, ov }); }, [LSK, defs, entryConds, exitConds, tf, selSyms, ov]);

  const operands = useMemo(() => ["Price", "Volume", ...defOperands(defs)], [defs]);
  const symbolOptions = useMemo(() => (UNIVERSE[market] || []).map((s) => s.sym), [market]);
  const cur = CUR[market] || "₹";
  const isCrypto = market === "Crypto";
  const qtyLabel = isCrypto ? `AMT (${cur})` : "QTY";

  const cfg = useMemo(() => ({ mode: "builder", tf, defs, entry: entryConds, exit: exitConds }), [tf, defs, entryConds, exitConds]);
  const key = useMemo(() => "custom-" + market + "-" + sig({ defs, entry: entryConds, tf }), [market, defs, entryConds, tf]);

  const ovSL = (sym) => (ov[sym] && ov[sym].sl != null) ? ov[sym].sl : 0.4;
  const ovTP = (sym) => (ov[sym] && ov[sym].tp != null) ? ov[sym].tp : 1.0;
  const ovQty = (sym) => (ov[sym] && ov[sym].qty != null) ? ov[sym].qty : qtyDefault(market);
  const setOvField = (sym, field, val) => setOv((o) => ({ ...o, [sym]: { ...(o[sym] || {}), [field]: val === "" ? undefined : +val } }));

  const toggleSym = (sym) => setSelSyms((p) => p.includes(sym) ? p.filter((x) => x !== sym) : [...p, sym]);

  const runScan = async () => {
    if (!selSyms.length || !entryConds.length) return;
    setScanning(true); setRan(true);
    try {
      const list = await scanScreener({ key, defs, entry: entryConds, tf, appSyms: selSyms });
      setMatches(Array.isArray(list) ? list : []);
    } catch { setMatches([]); }
    setScanning(false);
  };

  // Re-scan on the shared live tick once a screener has been run at least once.
  useEffect(() => {
    if (!ran || !selSyms.length) return;
    let stop = false;
    scanScreener({ key, defs, entry: entryConds, tf, appSyms: selSyms })
      .then((list) => { if (!stop) setMatches(Array.isArray(list) ? list : []); })
      .catch(() => {});
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  // Live P&L across the symbols currently meeting entry, each sized by its per-symbol quantity.
  const livePnl = useMemo(() => matches.reduce((a, m) => {
    const curP = priceOf(m.sym);
    if (curP == null || !m.entryPrice) return a;
    const coin = isCrypto ? (m.entryPrice > 0 ? ovQty(m.sym) / m.entryPrice : 0) : ovQty(m.sym);
    return a + (curP - m.entryPrice) * coin;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [matches, ov, liveTick]);

  /* SCREENER AUTO-BUY. Once a day, for each symbol meeting entry, place a bracketed order via
     onScreenerBuy (which tags it "Screener Auto Buy"). Mirrors Smart Auto-Buy: paper or real by mode. */
  useEffect(() => {
    if (!autoOn || !onScreenerBuy || !matches.length) return;
    if (!marketOpen(market)) return;
    const k = `${LSK}_buy_${DAY_KEY}`;
    if (lsGet(k, false)) return;
    matches.forEach((m) => {
      const inst = ALL.find((a) => a.sym === m.sym);
      if (!inst) return;
      const price = priceOf(m.sym) || m.entryPrice;
      const qty = isCrypto ? +(ovQty(m.sym) / price).toFixed(6) : Math.max(1, Math.floor(ovQty(m.sym)));
      onScreenerBuy(inst, qty, { tp: ovTP(m.sym), sl: ovSL(m.sym), strategy: "My screener" });
    });
    lsSet(k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, market, matches.length]);

  const dt = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const inBox = { width: 46, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "5px 3px", fontWeight: 800, fontSize: 11.5, color: "var(--ink)" };
  const matchOf = (sym) => matches.find((m) => m.sym === sym);
  const Step = ({ n, title, hint }) => (
    <div style={{ margin: "16px 0 8px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}><span style={{ color: "var(--primary)" }}>{n}.</span> {title}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      {/* Header: Screener Auto-Buy toggle + date range + live P&L (same controls as the Popular tab). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label className="tap" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800 }}>
          <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(`${LSK}_auto`, v); }} style={{ width: 38, height: 22, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 2, left: autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
          </span>
          Screener Auto-Buy
        </label>
        <select aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ fontSize: 11.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 8px", background: "var(--elev)", color: "var(--ink)" }}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>LIVE P&amp;L</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: chgColor(livePnl) }}>{(livePnl >= 0 ? "+" : "") + fmt(livePnl, market)}</div>
        </div>
      </div>
      {autoOn && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, background: "var(--elev)", borderRadius: 9, padding: "7px 9px" }}>
          {mode === "real" ? "Live: places REAL bracketed orders" : "Paper: simulates orders in your virtual book"} once a day for every symbol below that meets your entry trigger, with its own stop-loss and target.
        </div>
      )}

      <Step n="1" title="Timeframe & indicators" hint="Candle size the screener runs on, plus any indicators you'll reference in the rules below." />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Timeframe</span>
        <select aria-label="Timeframe" value={tf} onChange={(e) => setTf(e.target.value)} style={{ fontSize: 12.5, fontWeight: 800, border: "1px solid var(--line)", borderRadius: 9, padding: "6px 10px", background: "var(--elev)", color: "var(--ink)" }}>
          {TFS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <IndicatorDefs defs={defs} setDefs={setDefs} />

      <Step n="2" title="Entry & exit rules" hint="Combine your indicators with AND / OR. A symbol qualifies when the ENTRY chain is true on the latest closed candle." />
      <CondBuilder2 label="Entry signal — when to buy" conds={entryConds} setConds={setEntryConds} operands={operands} />
      <div style={{ height: 12 }} />
      <CondBuilder2 label="Exit signal — when to close" conds={exitConds} setConds={setExitConds} operands={operands} />

      <Step n="3" title="Symbols to screen" hint="Tick every symbol you want scanned against your rules." />
      <button onClick={() => setPickOpen((o) => !o)} className="tap" style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: "space-between", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 700 }}>
        <span>{selSyms.length ? `${selSyms.length} symbol${selSyms.length > 1 ? "s" : ""} selected` : "Choose symbols…"}</span>
        <Search size={15} color="var(--muted)" />
      </button>
      {!!selSyms.length && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {selSyms.map((sym) => (
            <span key={sym} onClick={() => toggleSym(sym)} className="pill tap" style={{ fontSize: 10.5, fontWeight: 800, padding: "4px 9px", background: "var(--primary-soft)", color: "var(--primary)", display: "flex", gap: 4, alignItems: "center" }}>{sym} ✕</span>
          ))}
        </div>
      )}
      {pickOpen && (
        <div style={{ marginTop: 8, maxHeight: 210, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {symbolOptions.map((sym) => {
            const on = selSyms.includes(sym);
            return (
              <label key={sym} className="tap" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, padding: "5px 6px", borderRadius: 7, background: on ? "var(--primary-soft)" : "transparent" }}>
                <input type="checkbox" checked={on} onChange={() => toggleSym(sym)} style={{ accentColor: "var(--primary)", width: 15, height: 15 }} />
                <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</span>
              </label>
            );
          })}
        </div>
      )}

      {!!selSyms.length && (
        <>
          <Step n="4" title="Stop-loss, target & quantity per symbol" hint={`Defaults 0.4% SL / 1% TP · ${isCrypto ? "amount in " + cur : "quantity"} per trade.`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8.5, fontWeight: 800, color: "var(--muted)", padding: "0 2px" }}>
              <span style={{ flex: "1 1 0", minWidth: 0 }}>SYMBOL</span>
              <span style={{ width: 46, textAlign: "center", color: "var(--down)" }}>% SL</span>
              <span style={{ width: 46, textAlign: "center", color: "var(--up)" }}>% TP</span>
              <span style={{ width: 46, textAlign: "center" }}>{qtyLabel}</span>
            </div>
            {selSyms.map((sym) => {
              const m = matchOf(sym);
              return (
                <div key={sym} style={{ display: "flex", alignItems: "center", gap: 6, background: m ? "var(--up-soft)" : "var(--elev)", borderRadius: 9, padding: "7px 8px", border: m ? "1px solid var(--up)" : "1px solid transparent" }}>
                  <div style={{ flex: "1 1 0", minWidth: 0 }} onClick={() => { const st = ALL.find((a) => a.sym === sym); st && onOpen && onOpen(st); }} className="tap">
                    <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</div>
                    <div style={{ fontSize: 9, color: m ? "var(--up)" : "var(--muted)", fontWeight: 700 }}>
                      {m ? `● Entry ${dt(m.entryAt)} @ ${fmt(m.entryPrice, market)}` : ran ? "waiting for trigger" : "not scanned yet"}
                    </div>
                  </div>
                  <input value={ovSL(sym)} onChange={(e) => setOvField(sym, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                  <input value={ovTP(sym)} onChange={(e) => setOvField(sym, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                  <input value={ovQty(sym)} onChange={(e) => setOvField(sym, "qty", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <button onClick={runScan} disabled={!selSyms.length || scanning} className="tap disp" style={{ marginTop: 16, width: "100%", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, fontWeight: 800, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", background: selSyms.length ? "linear-gradient(120deg,var(--primary),var(--primary-2))" : "var(--elev)", color: selSyms.length ? "var(--on-primary)" : "var(--muted)", cursor: selSyms.length ? "pointer" : "not-allowed", opacity: selSyms.length ? 1 : 0.7 }}>
        <Play size={15} /> {scanning ? "Scanning…" : "Run screener"}
      </button>
      {ran && !scanning && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
          {matches.length ? `${matches.length} of ${selSyms.length} symbols meet the entry trigger right now.` : "No selected symbol meets the entry trigger right now — check back as the market moves."}
        </div>
      )}
    </div>
  );
}
