import React from "react";
import { PATTERNS } from "../../lib/patterns";

/** Draws the small illustrative pattern glyph (not price data). */
export default function PatternChart({ type }) {
  const P = PATTERNS[type] || PATTERNS.breakout;
  const H = 84, W = 100, pad = 6;
  const yOf = (v) => H - pad - (v / 70) * (H - 2 * pad);
  const line = P.pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${yOf(p[1]).toFixed(1)}`).join(" ");
  const area = `${line} L100 ${H} L0 ${H} Z`;
  const entryV = P.pts[Math.floor(P.pts.length * 0.7)][1];
  const targetV = P.pts[P.pts.length - 1][1];
  const id = "pg" + type;
  return (
    <div style={{ position: "relative", marginTop: 12, borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C6CFF" stopOpacity="0.45" /><stop offset="100%" stopColor="#7C6CFF" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" x2={W} y1={yOf(targetV)} y2={yOf(targetV)} stroke="#1FE08C" strokeWidth="0.7" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={yOf(entryV)} y2={yOf(entryV)} stroke="#A99BFF" strokeWidth="0.7" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="#A99BFF" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span className="pill" style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 800, background: "rgba(124,108,255,.9)", color: "#fff", padding: "3px 9px" }}>📈 {P.label}</span>
      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: "#1FE08C", background: "var(--surface)", padding: "2px 7px", borderRadius: 8 }}>Target</span>
      <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: "var(--primary-2)", background: "var(--surface)", padding: "2px 7px", borderRadius: 8 }}>Entry</span>
    </div>
  );
}
