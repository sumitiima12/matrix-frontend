import React, { useEffect, useMemo, useRef, useState } from "react";
import { ALL } from "../../domain/universe";
import { CUR, DAY, chgColor, fmt, lsGet, lsSet } from "../../lib/format";
import { indValue } from "../../domain/screener";
import { marketOpen } from "../../domain/api";
import { Pencil, Trash2 } from "lucide-react";

/* MY SCREENERS — the carousels for screeners the user built and saved under "Create your own screener".
   Each is scanned with the SAME metric engine as the builder (indicator snapshots over the live list),
   rendered like the Popular Screeners: matched symbols as cards, a per-screener Auto-Buy toggle, and a
   date-range + Live P&L footer. When nothing meets entry, only the name and (when Auto-Buy is on) the
   P&L + date range show. */

export const SAVED_KEY = "mx_saved_screeners";
export const loadSaved = () => { const v = lsGet(SAVED_KEY, []); return Array.isArray(v) ? v : []; };
export const saveSaved = (arr) => lsSet(SAVED_KEY, arr);
/** Append a screener. Returns the new id. */
export function addSavedScreener(scr) {
  const all = loadSaved();
  const id = "scr_" + Date.now();
  all.unshift({ id, createdAt: Date.now(), ...scr });
  saveSaved(all);
  return id;
}
/** Update an existing screener in place (by id). */
export function updateSavedScreener(id, patch) {
  const all = loadSaved().map((s) => s.id === id ? { ...s, ...patch, id, updatedAt: Date.now() } : s);
  saveSaved(all);
}

const qtyDefault = (m) => (m === "Crypto" ? 200 : 1);
const cmp = (o, x, y) => o === ">" ? x > y : o === "<" ? x < y : o === ">=" ? x >= y : o === "<=" ? x <= y : Math.abs(x - y) < 1e-6;
const passes = (stock, conds) => (conds || []).every((f) => {
  const x = indValue(stock, f.m);
  const y = f.rhsType === "indicator" ? indValue(stock, f.rhs) : parseFloat(f.v);
  if (x == null || isNaN(x) || y == null || isNaN(y)) return true;
  return cmp(f.o, x, y);
});

function SavedRow({ scr, market, mode, list, onOpen, onScreenerBuy, onDelete, onEdit, liveTick = 0 }) {
  const bySym = useMemo(() => { const m = new Map(); (list || []).forEach((s) => m.set(s.sym, s)); ALL.forEach((s) => { if (!m.has(s.sym)) m.set(s.sym, s); }); return m; }, [list]);
  const priceOf = (sym) => { const s = bySym.get(sym); return s ? s.price : null; };
  const [autoOn, setAutoOn] = useState(() => lsGet(`mx_savedauto_${scr.id}`, false));
  const [period, setPeriod] = useState("today");
  const [ov, setOv] = useState(scr.ov || {});
  const entryPx = useRef({});
  const isCrypto = market === "Crypto";
  const cur = CUR[market] || "₹";

  const ovSL = (sym) => (ov[sym] && ov[sym].sl != null) ? ov[sym].sl : 0.4;
  const ovTP = (sym) => (ov[sym] && ov[sym].tp != null) ? ov[sym].tp : 1.0;
  const ovQty = (sym) => (ov[sym] && ov[sym].qty != null) ? ov[sym].qty : qtyDefault(market);
  const setOvField = (sym, field, val) => setOv((o) => {
    const next = { ...o, [sym]: { ...(o[sym] || {}), [field]: val === "" ? undefined : +val } };
    const all = loadSaved().map((s) => s.id === scr.id ? { ...s, ov: next } : s); saveSaved(all);
    return next;
  });

  const matched = useMemo(() => (scr.selSyms || []).filter((sym) => { const s = bySym.get(sym); return s && passes(s, scr.entry); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bySym, liveTick]);

  useEffect(() => {
    const now = Date.now(); const set = new Set(matched);
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

  useEffect(() => {
    if (!autoOn || !onScreenerBuy || !matched.length) return;
    if (!marketOpen(market)) return;
    const k = `mx_savedbuy_${scr.id}_${DAY}`;
    if (lsGet(k, false)) return;
    matched.forEach((sym) => {
      const inst = bySym.get(sym); if (!inst) return;
      const price = priceOf(sym); if (!price) return;
      const qty = isCrypto ? +(ovQty(sym) / price).toFixed(6) : Math.max(1, Math.floor(ovQty(sym)));
      onScreenerBuy(inst, qty, { tp: ovTP(sym), sl: ovSL(sym), strategy: scr.name });
    });
    lsSet(k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, market, matched.length]);

  const dt = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const inBox = { width: 42, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "4px 3px", fontWeight: 800, fontSize: 11, color: "var(--ink)" };

  return (
    <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--elev)" }}>
      {/* Header — name (left), Auto-Buy toggle + delete (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: "var(--ink)" }}>{scr.name}</div>
          <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>{(scr.selSyms || []).length} symbols · {matched.length} live</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: "var(--ink)" }}>
            <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(`mx_savedauto_${scr.id}`, v); }} style={{ width: 36, height: 21, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: autoOn ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </span>
            Auto-Buy
          </label>
          {onEdit && <button onClick={() => onEdit(scr)} className="tap" title="Edit screener" style={{ border: "none", background: "transparent", padding: 2, flexShrink: 0 }}><Pencil size={14} color="var(--muted)" /></button>}
          <button onClick={() => onDelete(scr.id)} className="tap" title="Delete screener" style={{ border: "none", background: "transparent", padding: 2, flexShrink: 0 }}><Trash2 size={15} color="var(--down)" /></button>
        </div>
      </div>

      {/* Matched symbols — vertical list, one below the other */}
      {matched.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {matched.map((sym) => {
            const st = bySym.get(sym); const price = st ? st.price : null; const info = entryPx.current[sym];
            return (
              <div key={sym} style={{ background: "var(--surface)", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 11px" }}>
                <div onClick={() => st && onOpen && onOpen(st)} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span className="disp" style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{sym}</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{fmt(price, market)}</span>
                </div>
                <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>● Entry {dt(info && info.at)} @ <span className="mono">{fmt(info && info.px, market)}</span></div>
                {autoOn && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                    <input value={ovSL(sym)} onChange={(e) => setOvField(sym, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                    <span style={{ fontSize: 9.5, color: "var(--down)", fontWeight: 800 }}>% SL</span>
                    <input value={ovTP(sym)} onChange={(e) => setOvField(sym, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                    <span style={{ fontSize: 9.5, color: "var(--up)", fontWeight: 800 }}>% TP</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>No symbols currently matching the entry criteria.</div>
      )}

      {/* Footer — date range + Live P&L (only when Auto-Buy is on) */}
      {autoOn && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <select aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ flex: "0 0 auto", fontSize: 10.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "7px 8px", background: "var(--surface)", color: "var(--ink)" }}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="6m">Last 6 months</option>
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ flex: "0 0 auto", textAlign: "right" }}>
          <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800 }}>LIVE P&amp;L</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: chgColor(livePnl) }}>{(livePnl >= 0 ? "+" : "") + fmt(livePnl, market)}</div>
        </div>
      </div>
      )}
    </div>
  );
}

export default function MyScreeners({ market, mode = "virtual", list = [], onOpen, onScreenerBuy, onEdit, liveTick = 0 }) {
  const [items, setItems] = useState(() => loadSaved());
  // Re-read whenever the tab is shown (component mounts) or the market changes.
  useEffect(() => { setItems(loadSaved()); }, [market]);
  const mine = items.filter((s) => (s.market || "IN") === market);
  const remove = (id) => { const all = loadSaved().filter((s) => s.id !== id); saveSaved(all); setItems(all); };

  if (!mine.length) {
    return (
      <div className="card" style={{ marginTop: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>
        No saved screeners yet for {market}. Build one under <b style={{ color: "var(--ink)" }}>Create your own screener</b> and tap <b style={{ color: "var(--ink)" }}>Save screener</b> — it'll appear here.
      </div>
    );
  }
  return (
    <>
      {mine.map((scr) => (
        <SavedRow key={scr.id} scr={scr} market={market} mode={mode} list={list} onOpen={onOpen} onScreenerBuy={onScreenerBuy} onDelete={remove} onEdit={onEdit} liveTick={liveTick} />
      ))}
    </>
  );
}
