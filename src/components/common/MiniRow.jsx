import React from "react";
import { fmt } from "../../lib/format";
import BuyButton from "./BuyButton";
import Change from "../../components/common/Change";

/**
 * Compact instrument row.
 */

export default function MiniRow({ s, market, onOpen, extra, onBuy }) {
  return (
    <div className="card tap" onClick={() => onOpen(s)} style={{ padding: 14, minWidth: 158, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{s.sym}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", maxWidth: 96, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
        </div>
        {onBuy && (
          <div onClick={(e) => e.stopPropagation()} style={{ flex: "0 0 auto" }}>
            <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 2 }}>
        <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{fmt(s.price, market)}</span>
        <Change v={s.chg} />
      </div>
      {extra && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{extra}</div>}
    </div>
  );
}
