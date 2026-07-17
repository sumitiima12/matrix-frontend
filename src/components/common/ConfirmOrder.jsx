import React, { useEffect, useState } from "react";
import { AlertTriangle, Minus, Plus, X } from "lucide-react";
import { fmt, pct } from "../../lib/format";
import OptionPicker from "./OptionPicker";
import { isOptionable } from "../../domain/fno";

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
export default function ConfirmOrder({ order, wallet, onConfirm, onCancel, userId }) {
  const { s, qty: initialQty, side, market, lot = 1 } = order || {};

  // Quantity is EDITABLE here. The confirmation step is the last place you can
  // still change your mind about size, so making it read-only meant cancelling
  // and starting over just to buy two instead of one.
  const [qty, setQty] = useState(initialQty || 1);
  useEffect(() => { setQty(initialQty || 1); }, [initialQty, order && order.s && order.s.sym]);

  /* Stop-loss / take-profit (%), PRE-FILLED from the pick's or idea's suggestion when the
     buy was launched from one of those cards. Editable, and applied to the position on
     confirm. Blank = no automatic exit for that leg. */
  const sugSl = order && order.opts && order.opts.sl != null ? String(order.opts.sl) : "";
  const sugTp = order && order.opts && order.opts.tp != null ? String(order.opts.tp) : "";
  const [sl, setSl] = useState(sugSl);
  const [tp, setTp] = useState(sugTp);
  useEffect(() => { setSl(sugSl); setTp(sugTp); }, [order && order.s && order.s.sym, sugSl, sugTp]);
  const prefilled = (sugSl !== "" || sugTp !== "");

  /* Delivery by default. Intraday is the one that can be closed out from under you,
     so it should be a choice you make, not one you inherit from a default. */
  const [product, setProduct] = useState("CNC");

  /* STOCK or OPTION. Offered on anything with a REAL NSE lot size — that IS what
     F&O-eligible means. There is no F&O market tab; an option bought here files under
     INDIAN, like the underlying it derives from. */
  const [instrument, setInstrument] = useState("stock");
  const canOption = side === "BUY" && isOptionable(s.sym);

    useEffect(() => { setProduct("CNC"); }, [order && order.s && order.s.sym]);

  if (!order) return null;

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

        {/* Stock vs Option. Options need a broker — the contract list is theirs. */}
        {canOption && (
          <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
            {[["stock", "Stock"], ["option", "Option"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setInstrument(k)}
                className="tap disp"
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                  border: "1px solid " + (instrument === k ? "var(--primary)" : "var(--line)"),
                  background: instrument === k ? "var(--primary)" : "var(--surface)",
                  color: instrument === k ? "#fff" : "var(--ink)",
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {canOption && instrument === "option" ? (
          <OptionPicker
            underlying={s.sym}
            spot={s.price}
            userId={userId}
            onPick={({ contract, qty, lots, lotSize }) =>
              onConfirm({
                instrument: "option",
                optionSymbol: contract.symbol,     // the BROKER's symbol, verbatim
                strike: contract.strike,
                optType: contract.type,
                expiry: contract.expiry,
                price: contract.ltp,               // the real premium, not the spot
                qty,                                // contracts, not lots
                lots,
                lotSize,
                product,
                market: "IN",                       // no F&O market — options are Indian
              })
            }
          />
        ) : (
        <>
        <div style={{ marginTop: 10 }}>
          <Row k="Action" v={side} c={side === "BUY" ? "var(--up)" : "var(--down)"} />
          {side === "BUY" && (
            <div style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 7 }}>Buy type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  ["CNC", "Delivery", "Hold as long as you like"],
                  ["MIS", "Intraday", market === "Crypto" ? "Auto-sells 23h45m after buy" : "Auto-sells 15 min before close"],
                ].map(([id, label, sub]) => (
                  <button
                    key={id}
                    onClick={() => setProduct(id)}
                    className="tap"
                    style={{
                      flex: 1, textAlign: "left", cursor: "pointer", borderRadius: 11, padding: "9px 11px",
                      border: product === id ? "1.5px solid var(--ink)" : "1px solid var(--line)",
                      background: product === id ? "var(--elev)" : "transparent",
                    }}
                  >
                    <div className="disp" style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)" }}>{label}</div>
                    <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              {lot > 1 ? `Quantity (lots of ${lot})` : "Quantity"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="tap"
                style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", cursor: qty <= 1 ? "not-allowed" : "pointer", opacity: qty <= 1 ? 0.45 : 1 }}
              >
                <Minus size={14} />
              </button>
              <input
                value={qty}
                onChange={(e) => {
                  const v = parseInt(String(e.target.value).replace(/[^0-9]/g, ""), 10);
                  setQty(Number.isFinite(v) && v > 0 ? v : 1);
                }}
                inputMode="numeric"
                aria-label="Quantity"
                className="mono no-ring"
                style={{ width: 56, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 4px", fontWeight: 800, fontSize: 13, background: "var(--elev)", color: "var(--ink)" }}
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
                className="tap"
                style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", display: "grid", placeItems: "center", cursor: "pointer" }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {lot > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Total units</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>{units}</span>
            </div>
          )}
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

        {/* Stop-loss / take-profit — pre-filled from the pick/idea suggestion when present. */}
        {side === "BUY" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
              Stop loss &amp; take profit (%)
              {prefilled && <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 7px", background: "var(--primary-soft)", color: "var(--primary)" }}>AUTO-FILLED</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", background: "var(--elev)" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>Stop loss %</div>
                <input value={sl} onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="—" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--down)", fontWeight: 800, fontSize: 15, marginTop: 2 }} />
              </div>
              <div style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", background: "var(--elev)" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>Take profit %</div>
                <input value={tp} onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="—" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--up)", fontWeight: 800, fontSize: 15, marginTop: 2 }} />
              </div>
            </div>
            {(sl !== "" || tp !== "") && price != null && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5, lineHeight: 1.45 }}>
                {sl !== "" ? `Auto-sell if it falls to ${fmt(price * (1 - (parseFloat(sl) || 0) / 100), market)}. ` : ""}
                {tp !== "" ? `Auto-sell if it rises to ${fmt(price * (1 + (parseFloat(tp) || 0) / 100), market)}.` : ""}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button onClick={onCancel} className="tap disp"
            style={{ flex: 1, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(qty, product, { sl: sl !== "" ? +sl : undefined, tp: tp !== "" ? +tp : undefined })}
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
        </>
        )}

        <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: 10, lineHeight: 1.45 }}>
          Paper trade. Virtual capital, filled at the real live price.
        </div>
      </div>
    </>
  );
}
