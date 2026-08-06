import React, { useState, useContext } from "react";
import { Minus, Plus } from "lucide-react";
import { fmt } from "../../lib/format";

/* Global buy-eligibility gate. Provider (in Matrix) supplies canBuy(sym) -> boolean.
   When it returns false the whole buy control is hidden: a non-admin has no legal way to
   trade that market (paper trading admin-disabled AND no broker connected for it). */
export const BuyGateContext = React.createContext(null);

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
export default function BuyButton({ s, market = "IN", onBuy, opts = {}, lot = 1, variant = "solid", label = "Buy", fullWidth = false, allowSell = true, only = null, advanced = false }) {
  /* CRYPTO trades by AMOUNT (USD), not share quantity: you buy "$10 of BTC", and we convert
     amount → units at the live price (a small fill-price variation is expected and fine).
     Everything else trades by quantity/lots as before. */
  const gate = useContext(BuyGateContext);
  const isCrypto = market === "Crypto";
  const step = isCrypto ? 10 : (lot || 1);        // crypto steps in $10, else by lot
  const [val, setVal] = useState(step);            // amount ($) for crypto, else quantity

  const light = variant === "light";
  const priced = s?.price > 0;   // must be a real positive price, else qty maths (amount/price) blows up

  /* ADVANCED ORDER OPTIONS (opt-in via `advanced`). Product = INTRADAY|NRML|CNC (position type — hidden for
     crypto, which has no product). Order type = Market|Limit|SL (stop-loss)|SL-L (stop-limit)|Bracket, with
     the conditional price fields each needs, plus an optional trailing stop. Defaults keep behaviour identical
     to before (Market + delivery) so a card that doesn't opt in sends nothing extra. */
  const [showAdv, setShowAdv] = useState(false);
  const [product, setProduct] = useState("CNC");           // CNC (delivery) | INTRADAY | NRML
  const [ordType, setOrdType] = useState("MARKET");          // MARKET|LIMIT|SL|SL-L|BRACKET
  const [limitPx, setLimitPx] = useState("");
  const [trigPx, setTrigPx] = useState("");
  const [brkTarget, setBrkTarget] = useState("");           // bracket take-profit %
  const [brkStop, setBrkStop] = useState("");               // bracket stop-loss %
  const [tslOn, setTslOn] = useState(false);
  const [tslPct, setTslPct] = useState("");                 // trailing stop %
  const advBox = { fontSize: 11, fontWeight: 700, border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 8, padding: "5px 7px", color: "var(--ink)" };
  const segBtn = (on) => ({ flex: 1, padding: "5px 0", fontSize: 10.5, fontWeight: 800, borderRadius: 7, border: "none", cursor: "pointer", background: on ? "var(--primary)" : "var(--surface)", color: on ? "#fff" : "var(--muted)" });
  // For crypto the "total" spent is the amount itself; for stocks it's price × qty.
  const total = priced ? (isCrypto ? (Number(val) || 0) : s.price * (Number(val) || 0)) : null;

  const dec = (e) => { e.stopPropagation(); setVal((q) => Math.max(step, (Number(q) || step) - step)); };
  const inc = (e) => { e.stopPropagation(); setVal((q) => (Number(q) || 0) + step); };

  // SELL (short) is offered only where the app supports it: CRYPTO (Delta futures) and INDIAN OPTIONS.
  // Stocks and commodities stay Buy-only.
  // `allowSell=false` hides Sell entirely (e.g. Trending). `only` forces a single side: "buy" or
  // "sell" (e.g. Top Picks show Buy for bullish, Sell for bearish). If "sell" is asked but the
  // instrument can't be shorted, we fall back to Buy so there's always an action.
  const canShort = isCrypto || Boolean(s?.isOpt);
  const wantSell = only === "sell";
  const showSell = (wantSell || only == null) && allowSell && canShort;
  const showBuy = only == null ? true : (only === "buy" || (wantSell && !canShort));
  const commit = (side) => (e) => {
    e.stopPropagation();
    if (!onBuy || !priced) return;
    const amount = Number(val) || 0;
    if (amount <= 0) return;
    // Crypto: convert the dollar amount to units at the live price. Fractional is allowed.
    const qty = isCrypto ? +(amount / s.price).toFixed(6) : amount;
    if (!Number.isFinite(qty) || qty <= 0) return;   // never send a NaN/Infinity qty to an order
    /* Advanced order options ride along in opts (the parent forwards them to /api/broker/order). Only sent when
       the advanced panel is enabled; otherwise the order stays a plain Market order, unchanged. Bracket sends its
       protective legs as target/stopLoss (percent); a trailing stop rides as tslPct on any order type. */
    const adv = advanced ? {
      product: isCrypto ? undefined : product,
      orderType: ordType,
      ...((ordType === "LIMIT" || ordType === "SL-L") && Number(limitPx) > 0 ? { limitPrice: Number(limitPx) } : {}),
      ...((ordType === "SL" || ordType === "SL-L") && Number(trigPx) > 0 ? { triggerPrice: Number(trigPx) } : {}),
      ...(ordType === "BRACKET" && Number(brkTarget) > 0 ? { target: Number(brkTarget) } : {}),
      ...(ordType === "BRACKET" && Number(brkStop) > 0 ? { stopLoss: Number(brkStop) } : {}),
      ...(tslOn && Number(tslPct) > 0 ? { tsl: Number(tslPct), autoExit: true } : {}),
    } : {};
    onBuy(s, qty, { ...opts, ...adv, amount: isCrypto ? amount : undefined, ...(side === "SELL" ? { side: "SELL", short: true } : {}) });
    setVal(step);
  };

  // Hidden entirely when the user can't legally buy this instrument's market.
  if (gate && s && s.sym && !gate(s.sym)) return null;

  const stepBtn = {
    width: 22, height: 22, borderRadius: 6, border: "none", flex: "0 0 auto",
    display: "grid", placeItems: "center", cursor: "pointer",
    background: light ? "rgba(255,255,255,.18)" : "var(--surface)",
    color: light ? "#fff" : "var(--ink)",
  };

  return (
    <div style={{ display: advanced ? "flex" : "contents", flexDirection: "column", gap: 8, width: fullWidth ? "100%" : undefined }}>
      {advanced && (
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%" }}>
          <button onClick={() => setShowAdv((v) => !v)} className="tap" style={{ border: "none", background: "transparent", color: "var(--primary)", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "2px 0" }}>
            {showAdv ? "Hide order options ▲" : "Order options ▾"}
          </button>
          {showAdv && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6, padding: 9, border: "1px solid var(--line)", borderRadius: 10, background: "var(--elev)" }}>
              {!isCrypto && (
                <div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>PRODUCT</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[["Intraday", "INTRADAY"], ["NRML", "NRML"], ["Delivery", "CNC"]].map(([lbl, v]) => (
                      <button key={v} onClick={() => setProduct(v)} style={segBtn(product === v)}>{lbl}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>ORDER TYPE</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[["Market", "MARKET"], ["Limit", "LIMIT"], ["Stop-Loss", "SL"], ["Stop-Limit", "SL-L"], ["Bracket", "BRACKET"]].map(([lbl, v]) => (
                    <button key={v} onClick={() => setOrdType(v)} style={{ ...segBtn(ordType === v), flex: "0 0 auto", padding: "5px 9px" }}>{lbl}</button>
                  ))}
                </div>
              </div>
              {(ordType === "SL" || ordType === "SL-L") && (
                <input type="number" placeholder="Trigger price" value={trigPx} onChange={(e) => setTrigPx(e.target.value)} style={advBox} />
              )}
              {(ordType === "LIMIT" || ordType === "SL-L") && (
                <input type="number" placeholder="Limit price" value={limitPx} onChange={(e) => setLimitPx(e.target.value)} style={advBox} />
              )}
              {ordType === "BRACKET" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" placeholder="Target %" value={brkTarget} onChange={(e) => setBrkTarget(e.target.value)} style={{ ...advBox, flex: 1 }} />
                  <input type="number" placeholder="Stop-loss %" value={brkStop} onChange={(e) => setBrkStop(e.target.value)} style={{ ...advBox, flex: 1 }} />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, color: "var(--ink)", cursor: "pointer" }}>
                <input type="checkbox" checked={tslOn} onChange={(e) => setTslOn(e.target.checked)} />
                Trailing stop
                {tslOn && <input type="number" placeholder="%" value={tslPct} onChange={(e) => setTslPct(e.target.value)} style={{ ...advBox, width: 64, marginLeft: "auto" }} />}
              </label>
            </div>
          )}
        </div>
      )}
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

      {showBuy && (
      <button
        onClick={commit("BUY")}
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
        {label}
      </button>
      )}

      {/* SELL (short) — crypto & Indian options only. */}
      {showSell && (
        <button
          onClick={commit("SELL")}
          disabled={!priced}
          className="tap disp"
          title={priced ? `Short ${isCrypto ? `$${val} of` : `${val} ×`} ${s.sym}` : "No live price yet"}
          style={{
            padding: fullWidth ? "10px 16px" : "6px 13px",
            borderRadius: fullWidth ? 11 : 9,
            border: "none",
            fontSize: fullWidth ? 13 : 11.5,
            fontWeight: 800, whiteSpace: "nowrap",
            flex: fullWidth ? "1 1 auto" : "0 0 auto",
            cursor: priced ? "pointer" : "not-allowed",
            background: priced ? "var(--down)" : (light ? "rgba(255,255,255,.14)" : "var(--elev)"),
            color: priced ? "#fff" : "var(--muted)",
            opacity: priced ? 1 : 0.75,
          }}
        >
          Sell
        </button>
      )}
    </div>
    </div>
  );
}
