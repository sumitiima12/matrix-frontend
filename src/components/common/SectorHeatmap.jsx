import React, { useMemo } from "react";
import { Grid3x3 } from "lucide-react";

/**
 * SectorHeatmap — a live map of how each sector is moving right now.
 *
 * Groups the market's stocks by their (factual) sector metadata, averages the REAL day-change
 * across the names that actually have a live price, and renders one tile per sector coloured by
 * that average. No invented data: a sector with no priced constituents is skipped, not shown flat.
 * Tapping a tile calls onPick(sector) so the parent can filter to it.
 */
export default function SectorHeatmap({ list = [], market, onPick }) {
  const sectors = useMemo(() => {
    const HIDE = new Set(["cement"]);   // sectors excluded from the heatmap
    const byS = new Map();
    for (const s of list) {
      if (!s || s.isIndex || !s.sector || s.chg == null || s.price == null) continue;
      if (HIDE.has(String(s.sector).trim().toLowerCase())) continue;
      const g = byS.get(s.sector) || { sector: s.sector, sum: 0, n: 0, up: 0 };
      g.sum += s.chg; g.n += 1; if (s.chg >= 0) g.up += 1;
      byS.set(s.sector, g);
    }
    return [...byS.values()]
      .filter((g) => g.n >= 1)
      .map((g) => ({ ...g, avg: g.sum / g.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [list]);

  if (!sectors.length) return null;

  // Colour intensity scales with the magnitude of the move (capped at ±3% for full saturation).
  const tint = (avg) => {
    const mag = Math.min(1, Math.abs(avg) / 3);
    const a = 0.12 + mag * 0.5;
    return avg >= 0 ? `rgba(34,197,94,${a})` : `rgba(239,68,68,${a})`;
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Grid3x3 size={16} color="var(--primary)" /> Sector heatmap
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>Average move across each sector, live.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
        {sectors.map((g) => (
          <button
            key={g.sector}
            onClick={() => onPick && onPick(g.sector)}
            className="tap"
            style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 11px", background: tint(g.avg), cursor: onPick ? "pointer" : "default" }}
          >
            <div className="disp" style={{ fontWeight: 800, fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.sector}</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 15, marginTop: 3, color: g.avg >= 0 ? "var(--up)" : "var(--down)" }}>
              {g.avg >= 0 ? "+" : ""}{g.avg.toFixed(2)}%
            </div>
            <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>{g.up}/{g.n} up</div>
          </button>
        ))}
      </div>
    </div>
  );
}
