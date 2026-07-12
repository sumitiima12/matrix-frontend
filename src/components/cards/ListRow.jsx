import React from "react";
import { BACKEND_URL } from "../../config";
import { fmt } from "../../lib/format";
import BuyButton from "../common/BuyButton";
import Change from "../../components/common/Change";

/**
 * The main instrument list row.
 */

export default function ListRow({ s, market, onOpen, right, onBuy }) {
  return (
    <div className="tap" onClick={() => onOpen(s)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>{s.sym}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(s.price, market)}</div>
        {right || <Change v={s.chg} />}
      </div>
      {onBuy && (
        <div onClick={(e) => e.stopPropagation()} style={{ flex: "0 0 auto" }}>
          <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} />
        </div>
      )}
    </div>
  );
}
/* carousel card: header (sym+price+change+add) plus a body slot */

/* ============================== ASK MATRIX (real Claude API) ============================== */
/* ============================== ASK MATRIX (backend proxy or in-app) ============================== */
// 🔴 REQUIRED: paste YOUR Render backend URL here (from your Render dashboard),
// e.g. "https://matrix-backend-ab12.onrender.com" — NO trailing slash.
// While this is "", the app runs in offline SIM mode (no live prices, no login,
// no Ask Matrix, no cross-device trade history).

/* ------- LIVE PRICES (Yahoo Finance via the backend proxy) -------
 * Yahoo can't be called straight from the browser (CORS + crumb auth), so live
 * quotes come through the proxy: app → /api/quote → Yahoo. When BACKEND_URL is
 * empty (this preview), the app stays on realistic simulated data. Map app
 * tickers → Yahoo tickers below. */
