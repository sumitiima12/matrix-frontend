import React from "react";

/** Buy / Hold / Sell verdict pill. */
export default function VerdictTag({ v, size = 13 }) {
  const map = { Buy: ["var(--up-soft)", "var(--up)"], Sell: ["var(--down-soft)", "var(--down)"], Hold: ["rgba(245,158,66,.16)", "#F59E42"] };
  const [bg, fg] = map[v] || map.Hold;
  return <span className="pill disp" style={{ background: bg, color: fg, fontWeight: 700, fontSize: size, padding: "4px 12px" }}>{v}</span>;
}
