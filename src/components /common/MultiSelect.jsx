import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Multi-select control.
 */

export default function MultiSelect({ label, options, value, onChange, allLabel = "All", dark }) {
  const [open, setOpen] = useState(false);
  const txt = dark ? "var(--on-primary)" : "var(--ink)";
  const summary = value.length === 0 ? allLabel : value.length === 1 ? value[0] : value.length + " selected";
  const chipBtn = (sel, on, key, lbl) => (
    <button key={key} onClick={on} className="tap pill" style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", border: "1px solid " + (sel ? "var(--primary)" : dark ? "rgba(255,255,255,.28)" : "var(--line)"), background: sel ? "var(--primary)" : dark ? "rgba(255,255,255,.1)" : "var(--surface)", color: sel ? "#fff" : txt }}>{lbl}</button>
  );
  const bg = dark ? "rgba(255,255,255,.12)" : "var(--elev)";
  const bd = dark ? "rgba(255,255,255,.28)" : "var(--line)";
  return (
    <div style={{ width: "100%" }}>
      <button onClick={() => setOpen((v) => !v)} className="tap disp" style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: bg, border: "1px solid " + bd, borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 700, color: txt }}>
        <span>{label}: {summary}</span><ChevronRight size={15} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {chipBtn(value.length === 0, () => onChange([]), "__all", allLabel)}
          {options.map((o) => chipBtn(value.includes(o), () => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]), o, o))}
        </div>
      )}
    </div>
  );
}
// Deterministic performance for a strategy over a chosen window (days).
