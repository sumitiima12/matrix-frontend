import React from "react";
import Pop from "./Pop";

/** Section header (title + optional icon and right slot) with its content. */
export default function Section({ title, icon, right, children }) {
  return (
    <Pop className="fade" style={{ marginTop: 48 }}>
      <div className="mx" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "0 2px" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>{icon}{title}</div>
        {right}
      </div>
      <div className="gold-line" style={{ width: 44, margin: "0 0 16px 2px", borderRadius: 2 }} />
      {children}
    </Pop>
  );
}
