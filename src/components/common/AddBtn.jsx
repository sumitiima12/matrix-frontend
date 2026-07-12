import React from "react";
import { Check, Plus } from "lucide-react";

/** Watchlist toggle button. */
export default function AddBtn({ on, onClick, size = 28 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="tap" title={on ? "In watchlist" : "Add to watchlist"}
      style={{ width: size, height: size, borderRadius: 9, border: "1px solid " + (on ? "var(--primary)" : "var(--line)"), background: on ? "var(--primary)" : "var(--elev)", color: on ? "#fff" : "var(--primary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
      {on ? <Check size={Math.round(size * 0.55)} /> : <Plus size={Math.round(size * 0.6)} />}
    </button>
  );
}
