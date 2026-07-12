import React from "react";

/**
 * Market-cap tag.
 */

export default function CapTag({ c }) {
  return <span className="pill" style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 10.5, fontWeight: 600, padding: "2px 8px" }}>{c} Cap</span>;
}

/* ============================== STOCK ROW / CARD ============================== */
// "+" with a watchlist picker — adds to the latest list by default, any list on choice.
