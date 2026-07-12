import React from "react";

/** Titled card wrapper for a chart. */
export default function ChartCard({ title, sub, children }) {
  return <div className="card" style={{ marginTop: 12, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
    </div>
    <div style={{ height: 150, marginTop: 8 }}>{children}</div>
  </div>;
}
