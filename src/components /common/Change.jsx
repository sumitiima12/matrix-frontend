import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/** The ±% pill. Single responsibility: render a signed percentage. */
export default function Change({ v, big }) {
  const up = v >= 0;
  return (
    <span className="mono" style={{ color: up ? "var(--up)" : "var(--down)", fontWeight: 700, fontSize: big ? 15 : 12.5, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <ArrowUpRight size={big ? 16 : 13} /> : <ArrowDownRight size={big ? 16 : 13} />}
      {up ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}
