import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { fmt } from "../../lib/format";

/**
 * BuyButton — the ONE buy control, rendered identically on every card.
 *
 * Layout is always:   [ − ][ qty ][ + ]  [ Buy ]
 *
 * The quantity is visible up front rather than hidden behind a first tap. The old
 * version was a two-step flow (tap Buy, then a picker appeared), so Matrix's Picks
 * and Trending rendered at different sizes depending on whether the picker happened
 * to be open. That is why they looked inconsistent.
 *
 * Owns NO trading logic: it collects an intent and calls onBuy(). The Risk Engine
 * still gates the order downstream.
 *
 * An instrument with no live price CANNOT be bought — the broker would have nothing
 * to fill against, and we will not invent a fill price. The button disables itself.
 *
 * @param s        the instrument
 * @param market   currency formatting
 * @param onBuy    (stock, qty, opts) => boolean
 * @param opts     extra order options, e.g. { tp, sl, tradeType } from a pick
 * @param lot      lot size (F&O) — quantity steps in multiples of this
 * @param variant  "solid" (default) | "light" (on dark/gradient cards)
 * @param fullWidth stretch to fill the card: [− qty +] on the left, [Buy] filling
 *                  the rest. Card sections (Picks, Ideas, Trending) use this so the
 *                  call to action is one consistent full-width bar.
 */
export default function BuyButton({ s, market = "IN", onBuy, opts = {}, lot = 1, variant = "solid", label = "Buy", fullWidth = false }) {
  const step = lot || 1;
  const [qty, setQty] = useState(step);

  const light = variant === "light";
  const priced = s?.price != null;
  const total = priced ? s.price * (Number(qty) || 0) : null;

  const dec = (e) => { e.stopPropagation(); setQty((q) => Math.max(step, (Number(q) || step) - step)); };
  const inc = (e) => { e.stopPropagation(); setQty((q) => (Number(q) || 0) + step); };

  const commit = (e) => {
    e.stopPropagation();
    if (!onBuy || !priced) return;
    const n = Number(qty) || 0;
    if (n <= 0) return;
    onBuy(s, n, opts);
    setQty(step);
  };

  const stepBtn = {
    width: 22, height: 22, borderRadius: 6, border: "none", flex: "0 0 auto",
    display: "grid", placeItems: "center", cursor: "pointer",
    background: light ? "rgba(255,255,255,.18)" : "var(--surface)",
    color: light ? "#fff" : "var(--ink)",
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: fullWidth ? "100%" : undefined,
        flex: fullWidth ? "1 1 auto" : "0 0 auto",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: fullWidth ? 4 : 3,
          borderRadius: fullWidth ? 11 : 9,
          flex: "0 0 auto",
          background: light ? "rgba(0,0,0,.24)" : "var(--elev)",
          border: light ? "1px solid rgba(255,255,255,.20)" : "1px solid var(--line)",
        }}
      >
        <button onClick={dec} className="tap" aria-label="Decrease quantity" style={stepBtn}>
          <Minus size={12} />
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
          onBlur={() => { if (!qty || Number(qty) < step) setQty(step); }}
          className="mono"
          aria-label="Quantity"
          style={{
            width: 34, textAlign: "center", fontWeight: 800, fontSize: 12,
            border: "none", outline: "none", background: "transparent",
            color: light ? "#fff" : "var(--ink)",
          }}
        />

        <button onClick={inc} className="tap" aria-label="Increase quantity" style={stepBtn}>
          <Plus size={12} />
        </button>
      </div>

      <button
        onClick={commit}
        disabled={!priced}
        className="tap disp"
        title={priced ? `${label} ${qty} × ${s.sym} = ${fmt(total, market)}` : "No live price yet"}
        style={{
          padding: fullWidth ? "10px 16px" : "6px 13px",
          borderRadius: fullWidth ? 11 : 9,
          border: "none",
          fontSize: fullWidth ? 13 : 11.5,
          fontWeight: 800, whiteSpace: "nowrap",
          flex: fullWidth ? "1 1 auto" : "0 0 auto",
          cursor: priced ? "pointer" : "not-allowed",
          background: priced ? "var(--up)" : (light ? "rgba(255,255,255,.14)" : "var(--elev)"),
          color: priced ? "#fff" : "var(--muted)",
          opacity: priced ? 1 : 0.75,
        }}
      >
        {label}
      </button>
    </div>
  );
}
