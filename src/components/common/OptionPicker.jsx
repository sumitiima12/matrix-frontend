import React, { useMemo, useState } from "react";
import { useOptionChain } from "../../hooks/useOptionChain";
import {
  strikeLadder, atmStrike, strikeFor, findContract, labelExpiries, expiryLabel, qtyFromLots,
} from "../../domain/options";
import { fmt } from "../../lib/format";

/**
 * OptionPicker — buy a real option contract by hand.
 *
 * Every choice is constrained to what the BROKER says exists. The expiry list is theirs,
 * the strikes are theirs, the symbol is theirs. Nothing is assembled from parts — a symbol
 * built from a wrong expiry rule or a wrong strike interval still LOOKS like a symbol, and
 * the exchange will happily fill it on a contract you never intended to trade.
 *
 * The resolved contract is shown in full before you can confirm. You should always be able
 * to see exactly what you are about to buy.
 */
export default function OptionPicker({ underlying, spot, userId, onPick }) {
  const { chain, loading, error } = useOptionChain(underlying, userId, true);

  const [expiry, setExpiry] = useState(null);
  const [type, setType] = useState("CE");
  const [moneyness, setMoneyness] = useState("ATM");
  const [steps, setSteps] = useState(1);
  const [lots, setLots] = useState(1);

  const expiries = useMemo(() => labelExpiries(chain ? chain.expiries : []), [chain]);
  const exp = expiry || (expiries[0] && expiries[0].raw) || null;

  // Prefer the broker's own spot — it is the number their chain is centred on.
  const px = (chain && chain.spot != null) ? chain.spot : spot;

  const ladder = useMemo(
    () => (chain ? strikeLadder(chain.contracts, exp, type) : []),
    [chain, exp, type]
  );
  const atm = atmStrike(ladder, px);
  const strike = strikeFor(ladder, px, type, moneyness, steps);
  const contract = chain ? findContract(chain.contracts, exp, strike, type) : null;
  const lotSize = (contract && contract.lot) || (chain && chain.lot) || null;
  const qty = qtyFromLots(lots, lotSize);

  const pill = (on) => ({
    padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 10,
    border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
    background: on ? "var(--primary)" : "var(--surface)",
    color: on ? "#fff" : "var(--ink)",
  });

  if (loading) {
    return <div style={{ fontSize: 12.5, color: "var(--muted)", padding: 12 }}>Loading the option chain from your broker…</div>;
  }

  /* No chain -> no options. We say why, and stop. Building a symbol ourselves is the one
     thing we will not do. */
  if (error || !chain) {
    return (
      <div className="card" style={{ padding: 14, marginTop: 10, background: "var(--elev)" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--down)" }}>Options unavailable</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>
          {error || "Could not load the option chain."}
          <br />
          Option symbols have to come from your broker's live contract list. We won't build one
          ourselves — a strike or expiry that's slightly wrong doesn't get rejected, it gets filled
          on the wrong contract.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* EXPIRY — the broker's real dates. The label can go stale; the date cannot, so we
          always show it. */}
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>EXPIRY</div>
      <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>
        {expiries.slice(0, 6).map((e) => (
          <button key={e.raw} onClick={() => setExpiry(e.raw)} className="tap disp"
            style={{ ...pill(exp === e.raw), flex: "0 0 auto", textAlign: "left", lineHeight: 1.3 }}>
            <div>{e.label || expiryLabel(e.raw)}</div>
            {e.label && <div style={{ fontSize: 9.5, opacity: 0.8, fontWeight: 600 }}>{expiryLabel(e.raw)}</div>}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>TYPE</div>
      <div style={{ display: "flex", gap: 7 }}>
        {[["CE", "CALL"], ["PE", "PUT"]].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className="tap disp"
            style={{
              ...pill(type === k), flex: 1,
              background: type === k ? (k === "CE" ? "var(--up)" : "var(--down)") : "var(--surface)",
              borderColor: type === k ? (k === "CE" ? "var(--up)" : "var(--down)") : "var(--line)",
            }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>MONEYNESS</div>
      <div style={{ display: "flex", gap: 7 }}>
        {["ITM", "ATM", "OTM"].map((m) => (
          <button key={m} onClick={() => setMoneyness(m)} className="tap disp" style={{ ...pill(moneyness === m), flex: 1 }}>
            {m}
          </button>
        ))}
      </div>

      {moneyness !== "ATM" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>Strikes from ATM</span>
          <button onClick={() => setSteps((s) => Math.max(1, s - 1))} className="tap"
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>–</button>
          <span className="mono" style={{ fontWeight: 800, minWidth: 18, textAlign: "center" }}>{steps}</span>
          <button onClick={() => setSteps((s) => Math.min(20, s + 1))} className="tap"
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>+</button>
          {/* ITM/OTM are OPPOSITE directions for calls and puts. Spelled out, because
              getting it backwards buys the inverse of your thesis. */}
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {type === "CE"
              ? (moneyness === "OTM" ? "call OTM = strike above spot" : "call ITM = strike below spot")
              : (moneyness === "OTM" ? "put OTM = strike below spot" : "put ITM = strike above spot")}
          </span>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>QUANTITY (LOTS)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setLots((l) => Math.max(1, l - 1))} className="tap"
          style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>–</button>
        <span className="mono" style={{ fontWeight: 800, fontSize: 15, minWidth: 26, textAlign: "center" }}>{lots}</span>
        <button onClick={() => setLots((l) => Math.min(50, l + 1))} className="tap"
          style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>+</button>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
          {lotSize ? `× ${lotSize} = ${qty} contracts` : "lot size unknown — cannot size this order"}
        </span>
      </div>

      {/* THE RESOLVED CONTRACT, in full. You should never confirm an order without seeing
          the exact instrument it will hit. */}
      <div className="card" style={{ marginTop: 14, padding: 13, background: "var(--elev)" }}>
        {!contract ? (
          <div style={{ fontSize: 12, color: "var(--down)", fontWeight: 600, lineHeight: 1.5 }}>
            No listed contract at that strike.
            {strike == null && ladder.length
              ? " The chain doesn't extend that many strikes from ATM — reduce the step count."
              : ""}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: ".04em" }}>YOU WILL TRADE</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 14, marginTop: 4, wordBreak: "break-all" }}>
              {contract.symbol}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)" }}>
              <span>Strike <b style={{ color: "var(--ink)" }}>{contract.strike}</b>{atm != null && contract.strike === atm ? " (ATM)" : ""}</span>
              <span>Spot <b style={{ color: "var(--ink)" }}>{px != null ? fmt(px, "IN") : "—"}</b></span>
              <span>Expiry <b style={{ color: "var(--ink)" }}>{expiryLabel(contract.expiry)}</b></span>
              {contract.ltp != null && <span>Premium <b style={{ color: "var(--ink)" }}>{fmt(contract.ltp, "IN")}</b></span>}
            </div>
            {contract.ltp != null && qty != null && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                Order value ≈ <b style={{ color: "var(--ink)" }}>{fmt(contract.ltp * qty, "IN")}</b> ({lots} lot{lots > 1 ? "s" : ""} × {lotSize})
              </div>
            )}
          </>
        )}
      </div>

      <button
        disabled={!contract || qty == null || contract.ltp == null}
        onClick={() => onPick && onPick({ contract, qty, lots, lotSize, type, moneyness, expiry: exp })}
        className="tap disp"
        style={{
          width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: "none",
          background: contract && qty != null && contract.ltp != null ? (type === "CE" ? "var(--up)" : "var(--down)") : "var(--line)",
          color: "#fff", fontWeight: 800, fontSize: 14,
          cursor: contract && qty != null && contract.ltp != null ? "pointer" : "not-allowed",
        }}
      >
        {!contract || qty == null
          ? "Select a valid contract"
          : contract.ltp == null
            ? "No live premium — can't price this order"
            : `Buy ${lots} lot${lots > 1 ? "s" : ""} · ${moneyness} ${type === "CE" ? "CALL" : "PUT"}`}
      </button>
    </div>
  );
}
