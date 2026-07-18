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
  /* CRYPTO trades by AMOUNT (USD), not share quantity: you buy "$10 of BTC", and we convert
     amount → units at the live price (a small fill-price variation is expected and fine).
     Everything else trades by quantity/lots as before. */
  const isCrypto = market === "Crypto";
  const step = isCrypto ? 10 : (lot || 1);        // crypto steps in $10, else by lot
  const [val, setVal] = useState(step);            // amount ($) for crypto, else quantity

  const light = variant === "light";
  const priced = s?.price != null;
  // For crypto the "total" spent is the amount itself; for stocks it's price × qty.
  const total = priced ? (isCrypto ? (Number(val) || 0) : s.price * (Number(val) || 0)) : null;

  const dec = (e) => { e.stopPropagation(); setVal((q) => Math.max(step, (Number(q) || step) - step)); };
  const inc = (e) => { e.stopPropagation(); setVal((q) => (Number(q) || 0) + step); };

  const commit = (e) => {
    e.stopPropagation();
    if (!onBuy || !priced) return;
    const amount = Number(val) || 0;
    if (amount <= 0) return;
    // Crypto: convert the dollar amount to units at the live price. Fractional is allowed.
    const qty = isCrypto ? +(amount / s.price).toFixed(6) : amount;
    if (qty <= 0) return;
    onBuy(s, qty, { ...opts, amount: isCrypto ? amount : undefined });
    setVal(step);
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
        <button onClick={dec} className="tap" aria-label={isCrypto ? "Decrease amount" : "Decrease quantity"} style={stepBtn}>
          <Minus size={12} />
        </button>

        {isCrypto && <span className="mono" style={{ fontWeight: 800, fontSize: 12, color: light ? "#fff" : "var(--muted)", paddingLeft: 4 }}>$</span>}
        <input
          type="number"
          min={isCrypto ? 1 : step}
          step={step}
          value={val}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = isCrypto ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            setVal(Number.isFinite(v) && v > 0 ? v : "");
          }}
          onBlur={() => { if (!val || Number(val) < (isCrypto ? 1 : step)) setVal(step); }}
          className="mono"
          aria-label={isCrypto ? "Amount in USD" : "Quantity"}
          style={{
            width: isCrypto ? 42 : 34, textAlign: "center", fontWeight: 800, fontSize: 12,
            border: "none", outline: "none", background: "transparent",
            color: light ? "#fff" : "var(--ink)",
          }}
        />

        <button onClick={inc} className="tap" aria-label={isCrypto ? "Increase amount" : "Increase quantity"} style={stepBtn}>
          <Plus size={12} />
        </button>
      </div>

      <button
        onClick={commit}
        disabled={!priced}
        className="tap disp"
        title={priced ? (isCrypto ? `${label} $${val} of ${s.sym} (~${(Number(val) / s.price).toFixed(6)})` : `${label} ${val} × ${s.sym} = ${fmt(total, market)}`) : "No live price yet"}
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
        {/* Show the money at stake ON the button so it's visible before the confirm sheet. */}
        {priced ? `${label} · ${isCrypto ? "$" + (Number(val) || 0) : fmt(total, market)}` : label}
      </button>
    </div>
  );
}
