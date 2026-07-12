import React, { useState } from "react";
import { Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { fmt } from "../lib/format";
import { ALL, marketOf } from "../domain/universe";
import Change from "../components/common/Change";

/**
 * Watchlist — multi-list watchlists.
 */

export default function WatchlistView({ watchlists, activeWl, setActiveWl, createWatchlist, deleteWatchlist, toggleWatch, onOpen }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const active = watchlists.find((w) => w.id === activeWl) || watchlists[0];
  const items = (active?.syms || []).map((sym) => ALL.find((a) => a.sym === sym)).filter(Boolean);
  const submit = () => { createWatchlist(name); setName(""); setAdding(false); };
  return (
    <div className="mx fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Watchlists</div>
        <button onClick={() => setAdding(!adding)} className="tap pill disp glow" style={{ background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> New list</button>
      </div>

      {adding && (
        <div className="card" style={{ marginTop: 12, padding: 12, display: "flex", gap: 8 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Watchlist name (e.g. High Beta)" className="no-ring" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, background: "var(--surface)" }} />
          <button onClick={submit} className="tap disp" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 700 }}>Create</button>
        </div>
      )}

      {/* list chips */}
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 14, paddingBottom: 2 }}>
        {watchlists.map((w) => (
          <button key={w.id} onClick={() => setActiveWl(w.id)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (w.id === activeWl ? "var(--primary)" : "var(--line)"), background: w.id === activeWl ? "var(--primary)" : "var(--surface)", color: w.id === activeWl ? "var(--on-primary)" : "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
            {w.name} <span style={{ opacity: .8, fontSize: 11 }}>{w.syms.length}</span>
          </button>
        ))}
      </div>

      {active && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 2px 4px" }}>
          <span className="disp" style={{ fontWeight: 700, fontSize: 15 }}>{active.name}</span>
          {watchlists.length > 1 && (
            <button onClick={() => deleteWatchlist(active.id)} className="tap" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--down)", display: "flex", gap: 4, alignItems: "center" }}><Trash2 size={13} /> Delete list</button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 10, padding: 30, textAlign: "center", color: "var(--muted)" }}>
          <Star size={28} color="var(--muted)" /><div style={{ marginTop: 8, fontSize: 13.5 }}>This list is empty. Tap the + on any stock to add it here.</div>
        </div>
      ) : items.map((s) => {
        const m = marketOf(s.sym);
        return (
          <div key={s.sym} onClick={() => onOpen(s)} className="card tap" style={{ marginTop: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{s.name}</div></div>
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10 }}>
                <div><div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{fmt(s.price, m)}</div><Change v={s.chg} /></div>
                <button onClick={(e) => { e.stopPropagation(); toggleWatch(s.sym); }} className="tap" title="Remove" style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--down)", display: "grid", placeItems: "center" }}><X size={15} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 8, display: "flex", gap: 5 }}><Sparkles size={13} style={{ flex: "0 0 auto", marginTop: 1 }} />{s.pickReason || ""}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== IDEAS ============================== */
// Ideas are regenerated daily from the strongest technical setups across markets.
/* Trade ideas — published by MATRIX only. Entry is the live price; the target and
   stop come from the SAME real engine as the picks (real support/resistance + ATR).
   No user-generated ideas, no invented handles, no random levels.            */
