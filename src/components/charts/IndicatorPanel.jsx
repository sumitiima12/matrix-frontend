import React from "react";
import { Check } from "lucide-react";
import { OVERLAYS } from "../../lib/indicators";

/**
 * IndicatorPanel — the bottom-sheet picker for chart overlays and sub-panels.
 *
 * Overlays are driven entirely by the OVERLAYS registry in lib/indicators, so
 * adding an indicator never means editing this component.
 */
export default function IndicatorPanel({
  open = true, onClose,
  active = [], toggle,
  showMacd, setShowMacd,
  showRsi, setShowRsi,
  showVol, setShowVol,
  ctype, setCtype,
}) {
  if (open === false) return null;

  const Row = ({ checked, onClick, swatch, children }) => (
    <button
      onClick={onClick}
      className="tap disp"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "11px 4px", border: "none", borderBottom: "1px solid var(--line)",
        background: "transparent", color: "var(--ink)", fontSize: 13.5, fontWeight: 600, textAlign: "left",
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 6, flexShrink: 0,
        border: "1.5px solid " + (checked ? "var(--primary)" : "var(--line)"),
        background: checked ? "var(--primary)" : "transparent",
        display: "grid", placeItems: "center",
      }}>
        {checked && <Check size={12} color="var(--on-primary)" />}
      </span>
      {swatch && <span style={{ width: 12, height: 2.5, background: swatch, borderRadius: 2, flexShrink: 0 }} />}
      <span>{children}</span>
    </button>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.45)", zIndex: 95, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet card"
        style={{ width: "100%", maxWidth: 460, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "72vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 14px" }} />
        <div className="disp" style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Chart settings</div>

        {/* Candle type — Regular / Heikin Ashi / Line. */}
        {setCtype && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Candle type</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["candle", "Regular"], ["heikin", "Heikin Ashi"], ["line", "Line"]].map(([k, l]) => (
                <button key={k} onClick={() => setCtype(k)} className="pill tap disp"
                  style={{ flex: 1, padding: "8px 6px", fontSize: 11.5, fontWeight: 800, borderRadius: 10,
                    border: "1px solid " + (ctype === k ? "var(--primary)" : "var(--line)"),
                    background: ctype === k ? "var(--primary)" : "var(--surface)",
                    color: ctype === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>Overlays &amp; panels</div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {OVERLAYS.map((o) => (
            <Row key={o.id} checked={active.includes(o.id)} onClick={() => toggle(o.id)} swatch={o.color}>
              {o.label}
            </Row>
          ))}
          <Row checked={showMacd} onClick={() => setShowMacd(!showMacd)}>
            MACD (12,26,9) <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>· sub-panel</span>
          </Row>
          <Row checked={showRsi} onClick={() => setShowRsi(!showRsi)}>
            RSI (14) <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>· sub-panel</span>
          </Row>
          {setShowVol && (
            <Row checked={showVol} onClick={() => setShowVol(!showVol)}>
              Volume <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>· sub-panel</span>
            </Row>
          )}
        </div>

        <button
          onClick={onClose}
          className="tap disp"
          style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 13, padding: 13, fontWeight: 800, fontSize: 13.5 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
