import React from "react";

/**
 * InstrumentTypePicker — a small Stock / Future / Option chooser for the automation config surfaces
 * (Smart Auto-Buy, Screener, Automate). It records the user's INTENT per strategy/surface.
 *
 * IMPORTANT (gated by design): today the automation ENGINES only execute STOCK. Future/Option are surfaced as a
 * clearly-labelled PREVIEW so the choice is captured and visible, but a strategy set to Future/Option still runs on
 * the underlying stock until derivative auto-execution lands (futures-expiry resolution + per-market option-premium
 * feeds). This avoids a silent, half-working money path. Manual paper FUTURES already work from the stock drawer.
 */

const OPTS = [
  ["STOCK", "Stock"],
  ["FUTURE", "Future"],
  ["OPTION", "Option"],
];

export default function InstrumentTypePicker({ value = "STOCK", onChange, compact = false }) {
  const v = value || "STOCK";
  const isDeriv = v === "FUTURE" || v === "OPTION";
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        {OPTS.map(([k, lbl]) => {
          const on = v === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange && onChange(k)}
              className="tap disp"
              style={{
                flex: compact ? "0 0 auto" : 1,
                padding: compact ? "5px 12px" : "7px 12px",
                fontSize: 12, fontWeight: 800, cursor: "pointer", borderRadius: 10,
                border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
                background: on ? "var(--primary)" : "var(--surface)",
                color: on ? "var(--on-primary)" : "var(--ink)",
              }}
            >
              {lbl}
            </button>
          );
        })}
      </div>
      {/* FUTURE stays a preview (automated futures execution isn't wired). OPTION is handled by the option-config
          panel shown below this picker (moneyness/expiry/lots), so it gets no "coming soon" note here. */}
      {v === "FUTURE" && (
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>
          Preview — automated futures execution is coming, so this strategy runs on the underlying stock until then
          (your choice here is saved). To trade futures now, open any stock and use its <b style={{ color: "var(--ink)" }}>Trade options</b> panel.
        </div>
      )}
    </div>
  );
}
