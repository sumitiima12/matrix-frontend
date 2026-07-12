import React from "react";
import { fmt } from "../../lib/format";
import Change from "../common/Change";
import BuyButton from "../common/BuyButton";

/**
 * CarouselCard — the horizontally-scrolling stock card used across the home page.
 *
 * Composes Change + BuyButton. Owns no logic: it renders an instrument
 * and reports intent (open / watch / buy) upward.
 */
export default function CarouselCard({
  s, market, onOpen, children, width = 250, watched, toggleWatch, onBuy,
}) {
  return (
    <div className="card tap" onClick={() => onOpen(s)} style={{ flex: "0 0 auto", width, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sym}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
        </div>
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          <div className="mono" style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>{fmt(s.price, market)}</div>
          <Change v={s.chg} />
        </div>
      </div>

      {children}

      {/* Explicit quantity — replaces the old bare "+" that silently bought 1. */}
      {onBuy && (
        <div style={{ marginTop: 11, display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
          <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth />
        </div>
      )}
    </div>
  );
}
