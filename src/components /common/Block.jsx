import React from "react";

/**
 * Small labelled value block.
 */

export default function Block({ title, icon, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>{icon}{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/* ============================== STOCK DETAIL PAGE ============================== */
