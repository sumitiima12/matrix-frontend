import React from "react";

/** Two-column key/value grid used across the detail page. */
export default function StatGrid({ rows }) {
  return <div className="card" style={{ marginTop: 12, padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
    {rows.map(([k, v], i) => (
      <div key={i} style={{ padding: 12, borderBottom: i < rows.length - 2 ? "1px solid var(--line)" : "none" }}>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{k}</div>
        <div className="disp" style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{v}</div>
      </div>
    ))}
  </div>;
}
