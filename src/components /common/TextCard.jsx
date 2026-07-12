import React from "react";
import { Sparkles } from "lucide-react";

/** Titled text block. */
export default function TextCard({ title, children, accent }) {
  return <div className="card" style={{ marginTop: 12, padding: 14, background: accent ? "linear-gradient(160deg,var(--primary-soft),var(--surface))" : "var(--surface)" }}>
    <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, display: "flex", gap: 6, alignItems: "center" }}>{accent && <Sparkles size={14} color="var(--primary)" />}{title}</div>
    <p style={{ fontSize: 13, lineHeight: 1.6, margin: "7px 0 0" }}>{children}</p>
  </div>;
}
