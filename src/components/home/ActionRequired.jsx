import React, { useState } from "react";
import { AlertTriangle, ChevronRight, CheckCircle2, X } from "lucide-react";

/**
 * ActionRequired — ONE consolidated "things that need you" hub for the homepage.
 *
 * Instead of scattering warnings across cards (a disconnected-broker note here, a paused-strategy
 * badge there), every account-level problem shows up in a single sleek, collapsed section at the top
 * of Home. Collapsed by default; the header shows the count + the worst severity colour. Renders
 * NOTHING when there's nothing to act on, so a healthy account sees a clean homepage.
 *
 * `items` is a pre-built list; the homepage decides what's active. Each item:
 *   { key, label, detail?, tone: "crit"|"warn"|"info", action?: { label, onClick } }
 */
const TONE = {
  crit: { fg: "var(--down)", bg: "rgba(239,68,68,.09)", dot: "var(--down)" },
  warn: { fg: "var(--amber)", bg: "rgba(245,158,11,.10)", dot: "var(--amber)" },
  info: { fg: "var(--muted)", bg: "var(--elev)", dot: "var(--muted)" },
};
const RANK = { crit: 0, warn: 1, info: 2 };

export default function ActionRequired({ items = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [dismissed, setDismissed] = useState(() => new Set());   // keys the user has cleared this session
  const dismiss = (k) => setDismissed((prev) => { const n = new Set(prev); n.add(k); return n; });
  const list = (items || []).filter(Boolean).filter((it) => !dismissed.has(it.key));
  if (!list.length) return null;

  // Header colour = the worst severity present.
  const worst = list.reduce((w, it) => (RANK[it.tone] < RANK[w] ? it.tone : w), "info");
  const t = TONE[worst] || TONE.info;

  return (
    <div style={{ margin: "0 0 14px", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--surface)" }}>
      {/* Sleek collapsed header — accent bar + count, tap to expand. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
          border: "none", background: "var(--elev)", padding: "11px 14px", borderLeft: `3px solid ${t.dot}`,
        }}
      >
        <AlertTriangle size={16} color={t.fg} style={{ flex: "0 0 auto" }} />
        <span className="disp" style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>Action required</span>
        <span className="pill" style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: t.dot, color: "#fff" }}>{list.length}</span>
        <ChevronRight size={16} color="var(--muted)" style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
      </button>

      {open && (
        <div style={{ padding: "4px 0 6px" }}>
          {list.map((it) => {
            const tt = TONE[it.tone] || TONE.info;
            return (
              <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
                <span style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: 999, background: tt.dot }} />
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>{it.label}</div>
                  {it.detail && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginTop: 1, lineHeight: 1.4 }}>{it.detail}</div>}
                </div>
                {it.action && (
                  <button onClick={it.action.onClick} className="tap disp"
                    style={{ flex: "0 0 auto", border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 9, padding: "6px 12px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {it.action.label}
                  </button>
                )}
                {/* Dismiss — clears this item for the session (it returns if the underlying condition persists on reload). */}
                <button onClick={() => dismiss(it.key)} aria-label="Dismiss" title="Dismiss" className="tap"
                  style={{ flex: "0 0 auto", border: "none", background: "transparent", color: "var(--muted)", borderRadius: 8, padding: 4, cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Tiny "all clear" pill some callers may want when they'd rather show a positive state than nothing.
   Not used by default (the section hides entirely when empty) but exported for reuse. */
export function AllClear() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 14, borderRadius: 12, background: "rgba(34,197,94,.08)", border: "1px solid var(--line)" }}>
      <CheckCircle2 size={15} color="var(--up)" />
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>All clear — nothing needs your attention.</span>
    </div>
  );
}
