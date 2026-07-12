import React from "react";
import { Check, ChevronRight } from "lucide-react";

/**
 * Filter chip with dropdown.
 */

export default function FilterChip({ label, options, sel, setter, colors, open, setOpen }) {
  const isOpen = open === label;
  const toggle = (v) => setter(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : label); }} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 12px", fontSize: 11.5, fontWeight: 700, border: "1px solid " + (sel.length ? "var(--primary)" : "var(--line)"), background: sel.length ? "var(--primary-soft)" : "var(--surface)", color: sel.length ? "var(--primary)" : "var(--ink)", display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
        {label}{sel.length ? ` (${sel.length})` : ""}<ChevronRight size={13} style={{ transform: "rotate(90deg)" }} />
      </button>
      {isOpen && (
        <div onClick={(e) => { e.stopPropagation(); setOpen(null); }} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.45)", zIndex: 95, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 14px", flex: "0 0 auto" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flex: "0 0 auto" }}>
              <span className="disp" style={{ fontWeight: 800, fontSize: 15 }}>{label}</span>
              {sel.length > 0 && <button onClick={() => setter([])} className="tap disp" style={{ border: "none", background: "transparent", color: "var(--primary)", fontWeight: 700, fontSize: 12.5 }}>Clear</button>}
            </div>
            <div style={{ overflowY: "auto", marginTop: 10, flex: 1 }}>
              {options.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)", padding: 16, textAlign: "center" }}>No {label.toLowerCase()} options in your history yet.</div> : options.map((o) => {
                const on = sel.includes(o);
                return (
                  <button key={o} onClick={() => toggle(o)} className="tap disp" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 6px", border: "none", borderBottom: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontSize: 13.5, fontWeight: 600, textAlign: "left" }}>
                    <span style={{ width: 19, height: 19, borderRadius: 6, border: "1.5px solid " + (on ? "var(--primary)" : "var(--line)"), background: on ? "var(--primary)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>{on && <Check size={13} color="var(--on-primary)" />}</span>
                    <span style={{ color: colors ? colors(o) : "var(--ink)" }}>{o}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setOpen(null)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 13, padding: 13, fontWeight: 800, fontSize: 13.5, flex: "0 0 auto" }}>Done{sel.length ? ` · ${sel.length} selected` : ""}</button>
          </div>
        </div>
      )}
    </>
  );
}

/* JournalPanel — the Trading Journal. Every stat and every insight is derived
   from the user's ACTUAL trades by journalService. Nothing is invented, and
   patterns are suppressed entirely until there's enough evidence. */
