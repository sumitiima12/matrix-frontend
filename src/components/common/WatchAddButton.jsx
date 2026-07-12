import React, { useState } from "react";
import { Check, Plus } from "lucide-react";

/**
 * Add-to-watchlist picker.
 */

export default function WatchAddButton({ sym, watchlists = [], onAdd, onCreate, size = 30 }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const inAny = watchlists.some((w) => w.syms.includes(sym));
  return (
    <div style={{ position: "relative", flex: "0 0 auto" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} className="tap" title="Add to watchlist" style={{ width: size, height: size, borderRadius: 9, border: "1px solid " + (inAny ? "var(--primary)" : "var(--line)"), background: inAny ? "var(--primary-soft)" : "var(--surface)", color: inAny ? "var(--primary)" : "var(--muted)", display: "grid", placeItems: "center" }}>{inAny ? <Check size={16} /> : <Plus size={17} />}</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div className="card" style={{ position: "absolute", top: size + 5, right: 0, zIndex: 40, minWidth: 190, padding: 8, boxShadow: "0 12px 30px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, padding: "2px 6px 6px" }}>Add to watchlist</div>
            {watchlists.map((w, i) => { const has = w.syms.includes(sym); return (
              <button key={w.id} onClick={() => { onAdd(sym, w.id); setOpen(false); }} className="tap disp" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: 8, border: "none", background: "transparent", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: "1.5px solid " + (has ? "var(--primary)" : "var(--line)"), background: has ? "var(--primary)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>{has && <Check size={11} color="var(--on-primary)" />}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                {i === watchlists.length - 1 && <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 700 }}>latest</span>}
              </button>
            ); })}
            <div style={{ display: "flex", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list…" className="no-ring" style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 12, background: "var(--elev)", color: "var(--ink)" }} />
              <button onClick={() => { const id = onCreate ? onCreate(newName) : null; if (id) onAdd(sym, id); setNewName(""); setOpen(false); }} className="tap disp" style={{ border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 8, padding: "0 12px", fontWeight: 800, fontSize: 12 }}>Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
