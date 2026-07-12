import React, { useState } from "react";
import { ShoppingCart, Minus, Plus, X } from "lucide-react";
import { fmt } from "../../lib/format";

/**
 * BuyButton — the single buy control used on every card in the app.
 *
 * Replaces the old bare "+" icon, which bought a hidden quantity of 1 with no
 * confirmation. Now the user picks a quantity (default 1, freely editable) and
 * sees the order value before committing.
 *
 * The button owns NO trading logic. It collects an intent and calls onBuy();
 * the Risk Engine still gates the order downstream. One responsibility.
 *
 * @param s        the instrument
 * @param market   for currency formatting
 * @param onBuy    (stock, qty, opts) => boolean
 * @param opts     extra order options, e.g. { tp, sl, tradeType } from a pick
 * @param lot      lot size (F&O) — quantity steps in multiples of this
 * @param variant  "solid" (default) | "light" (for use on dark/gradient cards)
 */
export default function BuyButton({ s, market = "IN", onBuy, opts = {}, lot = 1, variant = "solid", label = "Buy" }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(lot || 1);

  const step = lot || 1;
  const total = (s?.price || 0) * qty;

  const commit = (e) => {
    e.stopPropagation();
    if (!onBuy || !qty || qty <= 0) return;
    onBuy(s, qty, opts);
    setOpen(false);
    setQty(step);
  };

  const light = variant === "light";

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="tap disp"
        title={`Buy ${s?.sym || ""}`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 12px", borderRadius: 10, fontSize: 11.5, fontWeight: 800,
          cursor: "pointer",
          border: light ? "1px solid rgba(255,255,255,.32)" : "none",
          background: light ? "rgba(255,255,255,.16)" : "var(--up)",
          color: "#fff",
        }}
      >
        <ShoppingCart size={13} /> {label}
      </button>
    );
  }

  // quantity picker
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: 5, borderRadius: 12,
        background: light ? "rgba(0,0,0,.28)" : "var(--elev)",
        border: light ? "1px solid rgba(255,255,255,.22)" : "1px solid var(--line)",
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setQty((q) => Math.max(step, q - step)); }}
        className="tap"
        style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: light ? "rgba(255,255,255,.16)" : "var(--surface)", color: light ? "#fff" : "var(--ink)", display: "grid", placeItems: "center", flex: "0 0 auto" }}
      >
        <Minus size={13} />
      </button>

      <input
        type="number"
        min={step}
        step={step}
        value={qty}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          setQty(Number.isFinite(v) && v > 0 ? v : "");
        }}
        onBlur={() => { if (!qty || qty < step) setQty(step); }}
        className="mono"
        style={{
          width: 46, textAlign: "center", fontWeight: 800, fontSize: 12.5,
          border: "none", outline: "none", borderRadius: 7, padding: "4px 2px",
          background: light ? "rgba(255,255,255,.12)" : "var(--surface)",
          color: light ? "#fff" : "var(--ink)",
        }}
      />

      <button
        onClick={(e) => { e.stopPropagation(); setQty((q) => (Number(q) || 0) + step); }}
        className="tap"
        style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: light ? "rgba(255,255,255,.16)" : "var(--surface)", color: light ? "#fff" : "var(--ink)", display: "grid", placeItems: "center", flex: "0 0 auto" }}
      >
        <Plus size={13} />
      </button>

      <button
        onClick={commit}
        className="tap disp"
        style={{ padding: "5px 11px", borderRadius: 9, border: "none", background: "var(--up)", color: "#fff", fontWeight: 800, fontSize: 11.5, whiteSpace: "nowrap", flex: "0 0 auto" }}
      >
        {label} · {fmt(total, market)}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setOpen(false); setQty(step); }}
        className="tap"
        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: light ? "rgba(255,255,255,.7)" : "var(--muted)", display: "grid", placeItems: "center", flex: "0 0 auto" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
