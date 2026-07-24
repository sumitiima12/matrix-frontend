import React, { useEffect, useMemo, useRef, useState } from "react";
import { ALL, UNIVERSE } from "../../domain/universe";
import { CUR, chgColor, fmt, lsGet, lsSet } from "../../lib/format";
import { METRICS, OPS, indValue, parseScreen } from "../../domain/screener";
import { marketOpen, aiInterpretScreen } from "../../domain/api";
import { selStyle } from "../common/styles";
import { addSavedScreener, updateSavedScreener } from "./SavedScreeners";
import { ChevronDown, ChevronUp, Filter, Plus, Save, Sparkles, Trash2 } from "lucide-react";

/* CREATE YOUR OWN SCREENER — the second tab of "Screener".
   Built on the SAME metric engine as the Screener that used to sit below Trending (RSI, EMA, MACD,
   day-change, … over each stock's live daily indicators), so the recommended presets and the
   vs-value / vs-indicator condition rows behave exactly as before. On top of that it adds: pick a
   basket of symbols (checkbox, Select all, collapsible), set a per-symbol stop-loss / target /
   quantity, and flip on "Screener Auto-Buy". When on, every symbol that satisfies your ENTRY rules is
   bought once a day (paper or real, by app mode) as trade type "Screener Auto Buy", with its own SL/TP. */

const TODAY = new Date().toISOString().slice(0, 10);
const DAY_KEY = TODAY.replace(/-/g, "");
const qtyDefault = (m) => (m === "Crypto" ? 200 : 1);   // crypto = USD amount, others = share/lot count

// Same four the old Screener offered — tap to load both entry (f) and a sensible exit (x).
const RECOMMENDED = [
  { label: "Momentum movers", f: [{ m: "rsi", o: ">", v: "60" }, { m: "chg", o: ">", v: "1" }], x: [{ m: "rsi", o: "<", v: "50" }] },
  { label: "Value with growth", f: [{ m: "pe", o: "<", v: "30" }, { m: "revGrowth", o: ">", v: "8" }], x: [{ m: "rsi", o: ">", v: "70" }] },
  { label: "Oversold bounce", f: [{ m: "rsi", o: "<", v: "35" }], x: [{ m: "rsi", o: ">", v: "55" }] },
  { label: "EMA 21 > EMA 50", f: [{ m: "ema20", o: ">", rhsType: "indicator", rhs: "ema50" }], x: [{ m: "ema20", o: "<", rhsType: "indicator", rhs: "ema50" }] },
];
const normF = (f) => ({ m: f.m, o: f.o || ">", rhsType: f.rhsType || (f.rhs ? "indicator" : "value"), v: f.v != null ? String(f.v) : "", rhs: f.rhs || "sma50" });
const cmp = (o, x, y) => o === ">" ? x > y : o === "<" ? x < y : o === ">=" ? x >= y : o === "<=" ? x <= y : Math.abs(x - y) < 1e-6;
const passes = (stock, conds) => conds.every((f) => {
  const x = indValue(stock, f.m);
  const y = f.rhsType === "indicator" ? indValue(stock, f.rhs) : parseFloat(f.v);
  if (x == null || isNaN(x) || y == null || isNaN(y)) return true;   // an unavailable metric never blocks a match
  return cmp(f.o, x, y);
});

/* Turn a plain-English screen into metric conditions — local parser first (instant, no backend), then
   Neo as a fallback. Returns an array of normalised conditions, or null if nothing could be read. */
async function interpretConds(text) {
  const res = parseScreen(text);
  const out = (res.conds || []).map(normF);
  if (res.dma) out.push(normF({ m: "sma50", o: ">", rhsType: "indicator", rhs: "sma200" }));
  if (res.dmaBear) out.push(normF({ m: "sma50", o: "<", rhsType: "indicator", rhs: "sma200" }));
  if (out.length) return out;
  const ai = await aiInterpretScreen(text).catch(() => null);
  return (ai && ai.length) ? ai.map(normF) : null;
}

/* One editable list of metric conditions (used for both Entry and Exit) — mirrors the old Screener row,
   including the "Or write a prompt" box below Add condition. */
function FilterRows({ conds, setConds, placeholder }) {
  const upd = (i, k, v) => setConds((p) => p.map((f, j) => j === i ? { ...f, [k]: v } : f));
  const add = () => setConds((p) => [...p, normF({ m: "ema20", o: ">", rhsType: "indicator", rhs: "ema50" })]);
  const del = (i) => setConds((p) => p.filter((_, j) => j !== i));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const runPrompt = async () => {
    if (!text.trim()) return;
    setBusy(true); setNote("Interpreting…");
    const c = await interpretConds(text).catch(() => null);
    setBusy(false);
    if (c && c.length) { setConds(c); setNote("Applied " + c.length + " condition" + (c.length > 1 ? "s" : "") + " from your prompt."); }
    else setNote("Couldn't read that — try wording it like \"RSI under 40 and MACD bullish\".");
  };
  return (
    <div>
      {conds.map((f, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 9, marginBottom: 8, background: "var(--elev)" }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <select aria-label="Metric" value={f.m} onChange={(e) => upd(i, "m", e.target.value)} style={{ ...selStyle, flex: 1, minWidth: 0 }}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Comparator" value={f.o} onChange={(e) => upd(i, "o", e.target.value)} style={{ ...selStyle, flex: "0 0 54px" }}>{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {(f.rhsType || "value") === "value"
              ? <input value={f.v} onChange={(e) => upd(i, "v", e.target.value)} style={{ ...selStyle, flex: "0 0 70px" }} className="no-ring" placeholder="value" />
              : <select aria-label="Compare against" value={f.rhs || "sma50"} onChange={(e) => upd(i, "rhs", e.target.value)} style={{ ...selStyle, flex: 1, minWidth: 0 }}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
            <button onClick={() => del(i)} disabled={conds.length === 1} className="tap" style={{ border: "none", background: "transparent", flex: "0 0 auto", opacity: conds.length === 1 ? 0.3 : 1 }}><Trash2 size={16} color="var(--down)" /></button>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 7 }}>
            <div className="pill" style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--line)", padding: 2 }}>
              {[["value", "vs value"], ["indicator", "vs indicator"]].map(([k, l]) => (
                <button key={k} onClick={() => upd(i, "rhsType", k)} className="pill tap" style={{ padding: "5px 9px", fontSize: 10, fontWeight: 800, border: "none", background: (f.rhsType || "value") === k ? "var(--primary)" : "transparent", color: (f.rhsType || "value") === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="tap" style={{ border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> Add condition</button>

      {/* Or write a prompt — plain-English, parsed into the conditions above. */}
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Or write a prompt</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder || "e.g. RSI under 40 and MACD bullish"} className="no-ring"
        style={{ width: "100%", marginTop: 6, border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 58, resize: "vertical", background: "var(--surface)", color: "var(--ink)" }} />
      <button onClick={runPrompt} disabled={busy || !text.trim()} className="tap disp" style={{ marginTop: 8, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, background: text.trim() ? "var(--primary)" : "var(--elev)", color: text.trim() ? "var(--on-primary)" : "var(--muted)", display: "flex", gap: 6, alignItems: "center", opacity: busy ? 0.6 : 1 }}><Sparkles size={14} /> {busy ? "Interpreting…" : "Apply prompt"}</button>
      {note && <div style={{ fontSize: 11, color: note.startsWith("Applied") ? "var(--up)" : "var(--muted)", marginTop: 7, fontWeight: 600, lineHeight: 1.5 }}>{note.startsWith("Applied") ? "✓ " : ""}{note}</div>}
    </div>
  );
}

export default function CustomScreener({ market, mode = "virtual", list = [], onOpen, onScreenerBuy, liveTick = 0, editing = null, onDoneEditing }) {
  const LSK = `mx_customscr_${market}`;
  const saved = useMemo(() => lsGet(LSK, null) || {}, [LSK, market]);
  const [entry, setEntry] = useState(() => (saved.entry || [{ m: "rsi", o: ">", v: "60" }]).map(normF));
  const [exit, setExit] = useState(() => (saved.exit || [{ m: "rsi", o: "<", v: "40" }]).map(normF));
  const [selSyms, setSelSyms] = useState(() => saved.selSyms || []);
  const [ov, setOv] = useState(() => saved.ov || {});
  const [autoOn, setAutoOn] = useState(() => lsGet(`${LSK}_auto`, false));
  const [period, setPeriod] = useState("today");
  const [selRec, setSelRec] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [ran, setRan] = useState(false);
  const [scrName, setScrName] = useState("");
  const [saveNote, setSaveNote] = useState(null);
  const entryPx = useRef({});   // sym -> { px, at } captured when a symbol first meets entry

  // Reload persisted state when the market changes.
  useEffect(() => {
    const s = lsGet(LSK, null) || {};
    setEntry((s.entry || [{ m: "rsi", o: ">", v: "60" }]).map(normF));
    setExit((s.exit || [{ m: "rsi", o: "<", v: "40" }]).map(normF));
    setSelSyms(s.selSyms || []);
    setOv(s.ov || {});
    setAutoOn(lsGet(`${LSK}_auto`, false));
    setSelRec(null); setRan(false); entryPx.current = {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  useEffect(() => { lsSet(LSK, { entry, exit, selSyms, ov }); }, [LSK, entry, exit, selSyms, ov]);

  // When an existing screener is opened for editing, load its config into the builder.
  useEffect(() => {
    if (!editing) return;
    setEntry((editing.entry || [{ m: "rsi", o: ">", v: "60" }]).map(normF));
    setExit((editing.exit || [{ m: "rsi", o: "<", v: "40" }]).map(normF));
    setSelSyms(editing.selSyms || []);
    setOv(editing.ov || {});
    setScrName(editing.name || "");
    setSelRec(null); setRan(true); setSaveNote(null); entryPx.current = {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing && editing.id]);

  const cur = CUR[market] || "₹";
  const isCrypto = market === "Crypto";
  const qtyLabel = isCrypto ? `AMT (${cur})` : "QTY";
  // Symbol universe for this market — INDIAVIX is not tradable, so it's excluded.
  const symbolOptions = useMemo(() => (UNIVERSE[market] || []).map((s) => s.sym).filter((s) => s !== "INDIAVIX"), [market]);
  const bySym = useMemo(() => { const m = new Map(); (list || []).forEach((s) => m.set(s.sym, s)); ALL.forEach((s) => { if (!m.has(s.sym)) m.set(s.sym, s); }); return m; }, [list]);
  const priceOf = (sym) => { const s = bySym.get(sym); return s ? s.price : null; };

  const ovSL = (sym) => (ov[sym] && ov[sym].sl != null) ? ov[sym].sl : 0.4;
  const ovTP = (sym) => (ov[sym] && ov[sym].tp != null) ? ov[sym].tp : 1.0;
  const ovQty = (sym) => (ov[sym] && ov[sym].qty != null) ? ov[sym].qty : qtyDefault(market);
  const setOvField = (sym, field, val) => setOv((o) => ({ ...o, [sym]: { ...(o[sym] || {}), [field]: val === "" ? undefined : +val } }));

  const allSelected = symbolOptions.length > 0 && selSyms.length === symbolOptions.length;
  const toggleSym = (sym) => setSelSyms((p) => p.includes(sym) ? p.filter((x) => x !== sym) : [...p, sym]);
  const toggleAll = () => setSelSyms(allSelected ? [] : symbolOptions.slice());

  // Which SELECTED symbols meet the ENTRY rules right now — recomputed live off the snapshot list.
  const matched = useMemo(() => selSyms.filter((sym) => { const s = bySym.get(sym); return s && passes(s, entry); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selSyms, entry, bySym, liveTick]);

  // Capture an entry price the first time a symbol qualifies; drop it when it stops qualifying.
  useEffect(() => {
    const now = Date.now();
    const set = new Set(matched);
    matched.forEach((sym) => { if (!entryPx.current[sym]) entryPx.current[sym] = { px: priceOf(sym), at: now }; });
    Object.keys(entryPx.current).forEach((sym) => { if (!set.has(sym)) delete entryPx.current[sym]; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const livePnl = useMemo(() => matched.reduce((a, sym) => {
    const info = entryPx.current[sym]; const curP = priceOf(sym);
    if (!info || info.px == null || curP == null) return a;
    const coin = isCrypto ? (info.px > 0 ? ovQty(sym) / info.px : 0) : ovQty(sym);
    return a + (curP - info.px) * coin;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [matched, ov, liveTick]);

  /* SCREENER AUTO-BUY — once a day, buy every symbol meeting entry with its own SL/TP/qty. */
  useEffect(() => {
    if (!autoOn || !onScreenerBuy || !matched.length) return;
    if (!marketOpen(market)) return;
    const k = `${LSK}_buy_${DAY_KEY}`;
    if (lsGet(k, false)) return;
    matched.forEach((sym) => {
      const inst = bySym.get(sym);
      if (!inst) return;
      const price = priceOf(sym);
      if (!price) return;
      const qty = isCrypto ? +(ovQty(sym) / price).toFixed(6) : Math.max(1, Math.floor(ovQty(sym)));
      onScreenerBuy(inst, qty, { tp: ovTP(sym), sl: ovSL(sym), strategy: "My screener" });
    });
    lsSet(k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, market, matched.length]);

  const applyRec = (r) => { setSelRec(r.label); setEntry(r.f.map(normF)); if (r.x) setExit(r.x.map(normF)); setScrName(r.label); setSaveNote(null); };
  const clearRec = () => { setSelRec(null); setScrName(""); };
  const saveScreener = () => {
    const name = scrName.trim();
    if (!name) { setSaveNote("Give your screener a name first."); return; }
    if (!selSyms.length) { setSaveNote("Select at least one symbol before saving."); return; }
    if (editing) {
      updateSavedScreener(editing.id, { name, market, entry, exit, ov, selSyms });
      setSaveNote(`Updated "${name}".`);
      onDoneEditing && onDoneEditing();
    } else {
      addSavedScreener({ name, market, entry, exit, ov, selSyms });
      setScrName(""); setSaveNote(`Saved "${name}" — find it under My Screeners.`);
    }
  };
  const dt = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const inBox = { width: 46, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "5px 3px", fontWeight: 800, fontSize: 11.5, color: "var(--ink)" };
  const isMatch = (sym) => matched.includes(sym);

  return (
    <div className="card" style={{ marginTop: 12, padding: 14 }}>
      {/* Screener Auto-Buy toggle. Date range + Live P&L live in Popular / My Screeners, not here. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label className="tap" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800 }}>
          <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(`${LSK}_auto`, v); }} style={{ width: 38, height: 22, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 2, left: autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
          </span>
          Screener Auto-Buy
        </label>
        {autoOn && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>LIVE P&amp;L</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: chgColor(livePnl) }}>{(livePnl >= 0 ? "+" : "") + fmt(livePnl, market)}</div>
          </div>
        )}
      </div>
      {autoOn && (
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, background: "var(--elev)", borderRadius: 9, padding: "7px 9px" }}>
          {mode === "real" ? "Live: places REAL bracketed orders" : "Paper: simulates orders in your virtual book"} once a day for every selected symbol that meets your entry rules, with its own stop-loss and target.
        </div>
      )}

      {/* Recommended presets */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "16px 2px 8px" }}>Recommended</div>
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {RECOMMENDED.map((r) => (
          <button key={r.label} onClick={() => selRec === r.label ? clearRec() : applyRec(r)} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid " + (selRec === r.label ? "var(--primary)" : "var(--line)"), background: selRec === r.label ? "var(--primary)" : "var(--surface)", color: selRec === r.label ? "var(--on-primary)" : "var(--ink)", fontSize: 12.5, fontWeight: selRec === r.label ? 800 : 600, padding: "9px 14px", whiteSpace: "nowrap" }}>{r.label}</button>
        ))}
      </div>

      {/* Entry rules */}
      <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, margin: "18px 0 8px" }}>Entry conditions <span style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)" }}>— when to buy</span></div>
      <FilterRows conds={entry} setConds={(u) => { setEntry(u); setSelRec(null); }} placeholder="e.g. RSI under 40 and MACD bullish and price above 50-DMA" />

      {/* Exit rules — only asked for (and required) when Auto-Buy is on. */}
      {autoOn && (
        <>
          <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, margin: "18px 0 8px" }}>Exit conditions <span style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)" }}>— when to close (required)</span></div>
          <FilterRows conds={exit} setConds={setExit} placeholder="e.g. RSI above 65 or price below 50-DMA" />
        </>
      )}

      {/* Symbol selection — collapsible, with Select all */}
      <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, margin: "18px 0 8px" }}>Symbols to screen</div>
      <button onClick={() => setPickOpen((o) => !o)} className="tap" style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: "space-between", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 700 }}>
        <span>{selSyms.length ? `${selSyms.length} symbol${selSyms.length > 1 ? "s" : ""} selected` : "Choose symbols…"}</span>
        {pickOpen ? <ChevronUp size={17} color="var(--muted)" /> : <ChevronDown size={17} color="var(--muted)" />}
      </button>
      {pickOpen && (
        <div style={{ marginTop: 8, maxHeight: 230, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}>
          {/* Select all — first row */}
          <label className="tap" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, padding: "6px 6px", borderBottom: "1px solid var(--line)", marginBottom: 4, color: "var(--ink)" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "var(--primary)", width: 15, height: 15 }} />
            Select all ({symbolOptions.length})
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
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
        </div>
      )}

      {/* Screened symbols. Always shown once symbols are picked; the SL/TP/quantity columns only appear
          when Auto-Buy is on (off = a plain list of which symbols meet entry). */}
      {!!selSyms.length && (
        <>
          <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, margin: "18px 0 4px" }}>{autoOn ? "Stop-loss, target & quantity" : "Screened symbols"}</div>
          {autoOn && <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>Defaults 0.4% SL / 1% TP · {isCrypto ? "amount in " + cur : "quantity"} per trade.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {autoOn && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8.5, fontWeight: 800, color: "var(--muted)", padding: "0 2px" }}>
                <span style={{ flex: "1 1 0", minWidth: 0 }}>SYMBOL</span>
                <span style={{ width: 46, textAlign: "center", color: "var(--down)" }}>% SL</span>
                <span style={{ width: 46, textAlign: "center", color: "var(--up)" }}>% TP</span>
                <span style={{ width: 46, textAlign: "center" }}>{qtyLabel}</span>
              </div>
            )}
            {selSyms.map((sym) => {
              const m = isMatch(sym); const info = entryPx.current[sym];
              return (
                <div key={sym} style={{ display: "flex", alignItems: "center", gap: 6, background: m ? "var(--up-soft)" : "var(--elev)", borderRadius: 9, padding: "7px 8px", border: m ? "1px solid var(--up)" : "1px solid transparent" }}>
                  <div style={{ flex: "1 1 0", minWidth: 0 }} onClick={() => { const st = bySym.get(sym); st && onOpen && onOpen(st); }} className="tap">
                    <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</div>
                    <div style={{ fontSize: 9, color: m ? "var(--up)" : "var(--muted)", fontWeight: 700 }}>
                      {m ? `● Entry ${dt(info && info.at)} @ ${fmt(info && info.px, market)}` : ran ? "not meeting entry" : "not scanned yet"}
                    </div>
                  </div>
                  {autoOn && <input value={ovSL(sym)} onChange={(e) => setOvField(sym, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />}
                  {autoOn && <input value={ovTP(sym)} onChange={(e) => setOvField(sym, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />}
                  {autoOn && <input value={ovQty(sym)} onChange={(e) => setOvField(sym, "qty", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />}
                </div>
              );
            })}
          </div>
        </>
      )}

      <button onClick={() => setRan(true)} disabled={!selSyms.length} className="tap disp" style={{ marginTop: 16, width: "100%", border: "none", borderRadius: 14, padding: 13, fontSize: 13.5, fontWeight: 800, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", background: selSyms.length ? "var(--primary)" : "var(--elev)", color: selSyms.length ? "var(--on-primary)" : "var(--muted)", cursor: selSyms.length ? "pointer" : "not-allowed", opacity: selSyms.length ? 1 : 0.7 }}>
        <Filter size={16} /> Run screener
      </button>
      {ran && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
          {matched.length ? `${matched.length} of ${selSyms.length} symbols meet your entry rules right now.` : "No selected symbol meets your entry rules right now — adjust the rules or check back as prices move."}
        </div>
      )}

      {/* Save / update this screener — appears under My Screeners. Name is required. */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>{editing ? `Edit screener` : "Save screener"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={scrName} onChange={(e) => { setScrName(e.target.value); setSaveNote(null); }} placeholder="Screener name (required)" className="no-ring" style={{ flex: "1 1 0", minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 11px", fontSize: 13, fontWeight: 600, background: "var(--surface)", color: "var(--ink)" }} />
          <button onClick={saveScreener} disabled={!scrName.trim()} className="tap disp" style={{ flex: "0 0 auto", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, display: "flex", gap: 6, alignItems: "center", background: scrName.trim() ? "var(--primary)" : "var(--elev)", color: scrName.trim() ? "var(--on-primary)" : "var(--muted)", cursor: scrName.trim() ? "pointer" : "not-allowed" }}><Save size={14} /> {editing ? "Update" : "Save"}</button>
          {editing && <button onClick={() => onDoneEditing && onDoneEditing()} className="tap disp" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--muted)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 800 }}>Cancel</button>}
        </div>
        {saveNote && <div style={{ fontSize: 11, color: (saveNote.startsWith("Saved") || saveNote.startsWith("Updated")) ? "var(--up)" : "var(--down)", marginTop: 7, fontWeight: 600 }}>{(saveNote.startsWith("Saved") || saveNote.startsWith("Updated")) ? "✓ " : ""}{saveNote}</div>}
      </div>
    </div>
  );
}
