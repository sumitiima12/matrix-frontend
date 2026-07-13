import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { fmt, pct } from "../../lib/format";

/**
 * ConfirmOrder — the "are you sure" step before any MANUAL buy or sell.
 *
 * Shown for every manual order. Deliberately NOT shown for automated strategy
 * fills: a strategy you already armed is not a decision you are making now, and
 * a confirm dialog you cannot answer (because you're asleep) would just block it.
 *
 * It shows the REAL numbers the order will execute against — quantity, live price,
 * total value, and what it does to your wallet. If the total exceeds the wallet,
 * it says so here rather than letting the risk engine reject it after the tap.
 */
export default function ConfirmOrder({ order, wallet, onConfirm, onCancel }) {
  if (!order) return null;

  const { s, qty, side, market, lot = 1 } = order;
  const price = s.price;
  const units = qty * (lot || 1);
  const total = price != null ? price * units : null;
  const short = total != null && side === "BUY" && total > wallet;
  const after = total != null ? (side === "BUY" ? wallet - total : wallet + total) : null;

  const Row = ({ k, v, c }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{k}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: c || "var(--ink)" }}>{v}</span>
    </div>
  );

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 140 }} />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto",
          background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 141,
          padding: "16px 18px 26px", boxShadow: "0 -16px 44px rgba(0,0,0,.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 800 }}>
            Confirm {side === "BUY" ? "buy" : "sell"}
          </div>
          <button onClick={onCancel} aria-label="Cancel order" className="tap"
            style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
          <span className="disp" style={{ fontWeight: 800, fontSize: 16 }}>{s.sym}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <Row k="Action" v={side} c={side === "BUY" ? "var(--up)" : "var(--down)"} />
          <Row k={lot > 1 ? `Quantity (${qty} lot${qty === 1 ? "" : "s"} × ${lot})` : "Quantity"} v={units} />
          <Row k="Live price" v={fmt(price, market)} />
          <Row k="Order value" v={total != null ? fmt(total, market) : "—"} />
          <Row k="Wallet after" v={after != null ? fmt(after, market) : "—"} c={short ? "var(--down)" : undefined} />
        </div>

        {price == null && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, padding: 11, borderRadius: 11, background: "var(--elev)" }}>
            <AlertTriangle size={15} color="var(--down)" style={{ flex: "0 0 auto", marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
              There is no live price for {s.sym} right now, so this order cannot be filled at a real price.
            </span>
          </div>
        )}

        {short && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, padding: 11, borderRadius: 11, background: "var(--elev)" }}>
            <AlertTriangle size={15} color="var(--down)" style={{ flex: "0 0 auto", marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
              This is {fmt(total - wallet, market)} more than your {market} wallet holds. Add funds or reduce the quantity.
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button onClick={onCancel} className="tap disp"
            style={{ flex: 1, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={price == null || short}
            className="tap disp"
            style={{
              flex: 1.4, border: "none", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5,
              cursor: price == null || short ? "not-allowed" : "pointer",
              opacity: price == null || short ? 0.45 : 1,
              background: side === "BUY" ? "var(--up)" : "var(--down)",
              color: "#fff",
            }}
          >
            {side === "BUY" ? "Buy" : "Sell"} {units} {units === 1 ? "unit" : "units"}
          </button>
        </div>

        <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: 10, lineHeight: 1.45 }}>
          Paper trade. Virtual capital, filled at the real live price.
        </div>
      </div>
    </>
  );
}
