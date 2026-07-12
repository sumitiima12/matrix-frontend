import React from "react";

/** Semi-circular score gauge (0-100). */
export default function Gauge({ value, label }) {
  // semicircle 0..100; <40 bear, >64 bull
  const a = Math.PI * (1 - value / 100);
  const cx = 80, cy = 78, R = 64;
  const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
  const color = value >= 64 ? "var(--up)" : value <= 40 ? "var(--down)" : "#E8A33D";
  const word = value >= 64 ? "Bullish" : value <= 40 ? "Bearish" : "Neutral";
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="160" height="96" viewBox="0 0 160 96">
        <path d="M16 78 A64 64 0 0 1 144 78" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
        <path d="M16 78 A64 64 0 0 1 144 78" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={Math.PI * R} strokeDashoffset={Math.PI * R * (1 - value / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
        <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
      </svg>
      <div className="disp" style={{ fontWeight: 700, color, marginTop: -8 }}>{word}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label} · {value}/100</div>
    </div>
  );
}
