import React from "react";
import { CHART_TFS } from "../../lib/indicators";

/**
 * ChartToolbar — timeframe pills, candle/line switch, and the ƒx indicator button.
 * Pure presentation: it owns no chart state, it only reports changes upward.
 */
export default function ChartToolbar({
  tf, setTf,
  ctype, setCtype,
  onOpenIndicators,
  activeCount = 0,
  size = "md",
}) {
  const pad = size === "sm" ? "5px 11px" : "6px 12px";
  const fs = size === "sm" ? 11 : 11.5;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
      <div className="hide-scroll" style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1 }}>
        {CHART_TFS.map(([k, l]) => (
          <button
            key={k}
            onClick={(e) => { e.stopPropagation(); setTf(k); }}
            className="pill tap disp"
            style={{
              flex: "0 0 auto", padding: pad, fontSize: fs, fontWeight: 800,
              border: "1px solid " + (tf === k ? "var(--primary)" : "var(--line)"),
              background: tf === k ? "var(--primary)" : "var(--surface)",
              color: tf === k ? "var(--on-primary)" : "var(--muted)",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setCtype(ctype === "line" ? "candle" : "line"); }}
        className="pill tap disp"
        title={ctype === "line" ? "Show candles" : "Show line"}
        style={{ flex: "0 0 auto", padding: "6px 10px", fontSize: 11, fontWeight: 700, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
      >
        {ctype === "line" ? "◫" : "∿"}
      </button>

      {onOpenIndicators && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenIndicators(); }}
          className="pill tap disp"
          title="Indicators"
          style={{
            flex: "0 0 auto", padding: "6px 11px", fontSize: 11, fontWeight: 800,
            border: "1px solid " + (activeCount ? "var(--primary)" : "var(--line)"),
            background: activeCount ? "var(--primary-soft)" : "var(--surface)",
            color: activeCount ? "var(--primary)" : "var(--ink)",
          }}
        >
          ƒx{activeCount ? ` ${activeCount}` : ""}
        </button>
      )}
    </div>
  );
}
