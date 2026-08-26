import React, { useState, useMemo } from "react";
import { resolveDerivative } from "../../services/brokerService";

/**
 * OptionSelector — shared, market-aware Future/Option contract picker.
 *
 * Picks a derivative (product type, CALL/PUT, strike-by-moneyness OR explicit strike, expiry, lots), resolves the
 * EXACT tradable contract server-side via /api/derivatives/resolve, and shows what will trade. It never places an
 * order itself: on confirm it hands the resolved contract back to the parent via onResolved(resolved), which owns
 * the order path. Works across IN / US / Crypto (BTC/ETH) / Commodity — the backend resolver picks the symbology.
 *
 * Props: market, underlying, spot (live price), mode ('virtual'|'real'), onResolved(resolved), onClose?
 */

const MONEYNESS = ["ITM4", "ITM3", "ITM2", "ITM1", "ATM", "OTM1", "OTM2", "OTM3", "OTM4"];
const EXPIRY_INTENTS = {
  IN: [["CURRENT_WEEK", "This week"], ["CURRENT_MONTH", "This month"]],
  US: [["TODAY", "Today"], ["TOMORROW", "Tomorrow"], ["CURRENT_WEEK", "This week"], ["CURRENT_MONTH", "This month"]],
  Crypto: [["TODAY", "Today"], ["TOMORROW", "Tomorrow"], ["PLUS_30D", "~30 days"], ["PLUS_90D", "~90 days"]],
  Commodity: [["CURRENT_MONTH", "This month"], ["NEXT_MONTH", "Next month"]],
};
const seg = { border: "1px solid var(--line)", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const on = { background: "var(--primary)", color: "var(--on-primary)", borderColor: "var(--primary)" };
const off = { background: "var(--surface)", color: "var(--muted)" };

export default function OptionSelector({ market = "IN", underlying = "", spot = null, mode = "virtual", onResolved, onClose }) {
  const intents = EXPIRY_INTENTS[market] || EXPIRY_INTENTS.IN;
  const [productType, setProductType] = useState("OPTION");
  const [optionType, setOptionType] = useState("CALL");
  const [side, setSide] = useState("BUY");                 // futures direction
  const [strikeMode, setStrikeMode] = useState("EXPLICIT");  // EXPLICIT works everywhere; MONEYNESS needs a live chain
  const [moneyness, setMoneyness] = useState("ATM");
  const [strike, setStrike] = useState("");
  const [expiryMode, setExpiryMode] = useState("INTENT");
  const [expiryIntent, setExpiryIntent] = useState(intents[0][0]);
  const [expiry, setExpiry] = useState("");                // YYYY-MM-DD
  const [lots, setLots] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [resolved, setResolved] = useState(null);

  const isOption = productType === "OPTION";
  const canResolve = useMemo(() => {
    if (!underlying) return false;
    if (isOption && strikeMode === "EXPLICIT" && !(Number(strike) > 0)) return false;
    if (isOption && strikeMode === "MONEYNESS" && !(Number(spot) > 0)) return false;
    if (expiryMode === "EXPLICIT" && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return false;
    return Number(lots) >= 1;
  }, [underlying, isOption, strikeMode, strike, spot, expiryMode, expiry, lots]);

  const doResolve = async () => {
    setBusy(true); setErr(null); setResolved(null);
    try {
      const body = {
        market, underlying: underlying.toUpperCase(), productType, mode, lots: Number(lots),
        spot: Number(spot) || undefined,
        ...(isOption ? { optionType } : { side }),
        ...(isOption && strikeMode === "EXPLICIT" ? { strike: Number(strike) } : {}),
        ...(isOption && strikeMode === "MONEYNESS" ? { moneyness } : {}),
        ...(expiryMode === "EXPLICIT" ? { expiry } : { expiryIntent }),
      };
      const r = await resolveDerivative(body);
      setResolved(r.resolved ? { ...r.resolved, realExecution: r.realExecution } : null);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const Row = ({ label, children }) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{children}</div>
    </div>
  );
  const Pill = ({ active, onClick, children }) => (
    <button type="button" onClick={onClick} className="tap disp" style={{ ...seg, ...(active ? on : off) }}>{children}</button>
  );

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 14 }}>{underlying || "—"} derivatives</div>
        {onClose && <button onClick={onClose} className="tap" style={{ border: "none", background: "transparent", color: "var(--muted)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Close</button>}
      </div>
      {spot != null && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Spot ~{Number(spot).toLocaleString()}</div>}

      <Row label="Type">
        <Pill active={productType === "OPTION"} onClick={() => { setProductType("OPTION"); setResolved(null); }}>Option</Pill>
        <Pill active={productType === "FUTURE"} onClick={() => { setProductType("FUTURE"); setResolved(null); }}>Future</Pill>
      </Row>

      {isOption ? (
        <>
          <Row label="Call / Put">
            <Pill active={optionType === "CALL"} onClick={() => { setOptionType("CALL"); setResolved(null); }}>Call</Pill>
            <Pill active={optionType === "PUT"} onClick={() => { setOptionType("PUT"); setResolved(null); }}>Put</Pill>
          </Row>
          <Row label="Strike">
            <Pill active={strikeMode === "EXPLICIT"} onClick={() => setStrikeMode("EXPLICIT")}>Exact</Pill>
            <Pill active={strikeMode === "MONEYNESS"} onClick={() => setStrikeMode("MONEYNESS")}>Moneyness</Pill>
          </Row>
          {strikeMode === "EXPLICIT" ? (
            <input value={strike} onChange={(e) => { setStrike(e.target.value.replace(/[^0-9.]/g, "")); setResolved(null); }} inputMode="decimal" placeholder="Strike price" className="no-ring mono" style={{ marginTop: 8, width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
          ) : (
            <Row label="Moneyness (needs live chain)">
              {MONEYNESS.map((m) => <Pill key={m} active={moneyness === m} onClick={() => { setMoneyness(m); setResolved(null); }}>{m}</Pill>)}
            </Row>
          )}
        </>
      ) : (
        <Row label="Direction">
          <Pill active={side === "BUY"} onClick={() => { setSide("BUY"); setResolved(null); }}>Buy</Pill>
          <Pill active={side === "SELL"} onClick={() => { setSide("SELL"); setResolved(null); }}>Sell</Pill>
        </Row>
      )}

      <Row label="Expiry">
        <Pill active={expiryMode === "INTENT"} onClick={() => setExpiryMode("INTENT")}>Preset</Pill>
        <Pill active={expiryMode === "EXPLICIT"} onClick={() => setExpiryMode("EXPLICIT")}>Exact date</Pill>
      </Row>
      {expiryMode === "INTENT" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
          {intents.map(([k, lbl]) => <Pill key={k} active={expiryIntent === k} onClick={() => { setExpiryIntent(k); setResolved(null); }}>{lbl}</Pill>)}
        </div>
      ) : (
        <input type="date" value={expiry} onChange={(e) => { setExpiry(e.target.value); setResolved(null); }} className="no-ring mono" style={{ marginTop: 8, width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
      )}

      <Row label="Lots / contracts">
        <input value={lots} onChange={(e) => { setLots(e.target.value.replace(/[^0-9]/g, "") || "1"); setResolved(null); }} inputMode="numeric" className="no-ring mono" style={{ width: 90, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 800, background: "var(--elev)", color: "var(--ink)" }} />
      </Row>

      <button onClick={doResolve} disabled={!canResolve || busy} className="tap disp" style={{ marginTop: 14, width: "100%", border: "none", borderRadius: 11, padding: "11px 12px", fontWeight: 800, fontSize: 13, background: "var(--primary)", color: "var(--on-primary)", opacity: (!canResolve || busy) ? 0.55 : 1, cursor: (!canResolve || busy) ? "default" : "pointer" }}>{busy ? "Resolving…" : "Resolve contract"}</button>

      {err && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--down)", lineHeight: 1.45 }}>Couldn’t resolve: {err}. {err.includes("chain") ? "Live option chains aren’t wired for this market yet — use Exact strike + date." : ""}</div>}

      {resolved && (
        <div style={{ marginTop: 12, background: "var(--surface)", border: "1px solid var(--up)", borderRadius: 12, padding: 12 }}>
          <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", wordBreak: "break-all" }}>{resolved.tradingSymbol}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            {resolved.optionType ? `${resolved.optionType} · strike ${resolved.strike} · ` : `${resolved.side || ""} · `}
            exp {resolved.expiry} · {resolved.lots} lot{resolved.lots === 1 ? "" : "s"}
            {resolved.contractMultiplier ? ` · ×${resolved.contractMultiplier}` : ""}
            {resolved.quantity != null ? ` · qty ${resolved.quantity}` : ""}
          </div>
          <div style={{ fontSize: 10, color: resolved.realExecution ? "var(--up)" : "var(--muted)", marginTop: 4, fontWeight: 700 }}>
            {mode === "real" ? (resolved.realExecution ? "Real execution enabled for this market." : "Preview only — real execution for this market isn’t validated yet.") : "Paper (virtual) — no real order."}
          </div>
          {onResolved && (
            <button onClick={() => onResolved(resolved)} className="tap disp" style={{ marginTop: 10, width: "100%", border: "none", borderRadius: 10, padding: "10px 12px", fontWeight: 800, fontSize: 12.5, background: "var(--up)", color: "#fff", cursor: "pointer" }}>Use this contract</button>
          )}
        </div>
      )}
    </div>
  );
}
