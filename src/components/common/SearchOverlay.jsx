import ListRow from "../cards/ListRow";
import WatchAddButton from "./WatchAddButton";
import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { ALL, marketOf } from "../../domain/universe";

/**
 * Search overlay.
 */

export default function SearchOverlay({ onClose, onOpen, watchlists, addToWatch, createWatchlist }) {
  const [q, setQ] = useState("");
  const res = ALL.filter((s) => (s.sym + s.name).toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 70, maxWidth: 460, margin: "0 auto" }} className="mx">
      <div style={{ display: "flex", gap: 10, padding: 14, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        <Search size={20} color="var(--muted)" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any stock…" className="no-ring" style={{ flex: 1, border: "none", fontSize: 16, background: "transparent" }} />
        <X size={22} className="tap" onClick={onClose} color="var(--muted)" />
      </div>
      <div className="hide-scroll" style={{ overflowY: "auto", height: "calc(100% - 60px)", padding: "0 14px" }}>
        {res.map((s) => (
          <div key={s.sym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><ListRow s={s} market={marketOf(s.sym)} onOpen={(x) => { onOpen(x); }} /></div>
            <WatchAddButton sym={s.sym} watchlists={watchlists} onAdd={addToWatch} onCreate={createWatchlist} />
          </div>
        ))}
        {res.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 40, fontSize: 14 }}>No matches. Try “TCS”, “NVDA”, “BTC”…</div>}
      </div>
    </div>
  );
}

/* ============================== ONBOARDING ============================== */
