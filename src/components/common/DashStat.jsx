import React from "react";

/**
 * Dashboard stat tile.
 */

export default function DashStat({ k, v, pos }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, opacity: .8 }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: pos ? "#9CFFD6" : "#FFB3BE" }}>{v}</div>
    </div>
  );
}

/* Real, current headlines — one card per symbol, fetched from the backend
   (Yahoo Finance news, or NewsAPI when NEWS_API_KEY is set). Nothing hardcoded. */
