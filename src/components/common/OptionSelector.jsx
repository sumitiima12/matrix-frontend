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
// US dailies (TOMORROW) only exist for the index products — not single-stock options.
const US_DAILY_UNDERLYINGS = new Set(["SPX", "NDX"]);
// MCX commodity contract variants — same underlying metal, different exchange lot size. These are the "symbols"
// the product asked for (Gold Petal / Guinea / Mini, Silver Mini); the backend keys them Commodity:{CODE}:FUTURE
// and carries each verified lot size, so they belong here in the contract picker, not the spot universe.
const COMMODITY_CONTRACTS = [
  ["GOLD", "Gold · 1 kg"],
  ["GOLDMINI", "Gold Mini · 100 g"],
  ["GOLDGUINEA", "Gold Guinea · 8 g"],
  ["GOLDPETAL", "Gold Petal · 1 g"],
  ["SILVER", "Silver · 30 kg"],
  ["SILVERMINI", "Silver Mini · 5 kg"],
];
// Product default lots: 1 lot everywhere except crypto (100), per the product spec. Broker qty is always lots × the
// instrument's lot size, resolved server-side (never assumed here).
const DEFAULT_LOTS = { IN: 1, US: 1, Commodity: 1, Crypto: 100 };
const seg = { border: "1px solid var(--line)", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const on = { background: "var(--primary)", color: "var(--on-primary)", borderColor: "var(--primary)" };
const off = { background: "var(--surface)", color: "var(--muted)" };

export default function OptionSelector({ market = "IN", underlying = "", spot = null, mode = "virtual", onResolved, onClose }) {
  const [productType, setProductType] = useState("STOCK");  // default STOCK per spec; user opts into FUTURE/OPTION
  const [optionType, setOptionType] = useState("CALL");
  const [side, setSide] = useState("BUY");                 // futures direction
  const [strikeMode, setStrikeMode] = useState("EXPLICIT");  // EXPLICIT works everywhere; MONEYNESS needs a live chain
  const [moneyness, setMoneyness] = useState("ATM");
  const [strike, setStrike] = useState("");
  const [expiryMode, setExpiryMode] = useState("INTENT");
  const [expiry, setExpiry] = useState("");                // YYYY-MM-DD
  const [lots, setLots] = useState(DEFAULT_LOTS[market] || 1);   // 1 lot (100 for crypto), per spec
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [resolved, setResolved] = useState(null);
  // Commodity: pick which MCX contract variant (each a distinct exchange lot size). Elsewhere the underlying is fixed.
  const [commContract, setCommContract] = useState(() => {
    const u = String(underlying || "").toUpperCase();
    return COMMODITY_CONTRACTS.find(([k]) => k === u) ? u : "GOLD";
  });
  const effUnderlying = market === "Commodity" ? commContract : String(underlying || "").toUpperCase();

  // Expiry presets for this market/underlying — US "tomorrow" (dailies) only for SPX/NDX index options.
  const intents = useMemo(() => {
    const base = EXPIRY_INTENTS[market] || EXPIRY_INTENTS.IN;
    if (market === "US") return base.filter(([k]) => k !== "TOMORROW" || US_DAILY_UNDERLYINGS.has(effUnderlying));
    return base;
  }, [market, effUnderlying]);
  const [expiryIntent, setExpiryIntent] = useState((EXPIRY_INTENTS[market] || EXPIRY_INTENTS.IN)[0][0]);
  // Derive a valid preset without mutating state during render: if the current pick fell out of the list (e.g. the
  // underlying switched away from an index and lost "tomorrow"), fall back to the first listed preset.
  const safeIntent = intents.find(([k]) => k === expiryIntent) ? expiryIntent : intents[0][0];

  const isOption = productType === "OPTION";
  const isStock = productType === "STOCK";
  const canResolve = useMemo(() => {
    if (!effUnderlying) return false;
    if (isStock) return true;                                // stock: nothing else to resolve
    if (isOption && strikeMode === "EXPLICIT" && !(Number(strike) > 0)) return false;
    if (isOption && strikeMode === "MONEYNESS" && !(Number(spot) > 0)) return false;
    if (expiryMode === "EXPLICIT" && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return false;
    return Number(lots) >= 1;
  }, [effUnderlying, isStock, isOption, strikeMode, strike, spot, expiryMode, expiry, lots]);

  const doResolve = async () => {
    setBusy(true); setErr(null); setResolved(null);
    // STOCK needs no contract resolution — the tradable symbol IS the underlying. Echo it locally rather than
    // calling the derivatives resolver (which only resolves futures/options).
    if (isStock) {
      setResolved({ tradingSymbol: effUnderlying, market, productType: "STOCK", side, lots: 1, realExecution: false });
      setBusy(false); return;
    }
    try {
      const body = {
        market, underlying: effUnderlying, productType, mode, lots: Number(lots),
        spot: Number(spot) || undefined,
        ...(isOption ? { optionType } : { side }),
        ...(isOption && strikeMode === "EXPLICIT" ? { strike: Number(strike) } : {}),
        ...(isOption && strikeMode === "MONEYNESS" ? { moneyness } : {}),
        ...(expiryMode === "EXPLICIT" ? { expiry } : { expiryIntent: safeIntent }),
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
        <div className="disp" style={{ fontWeight: 800, fontSize: 14 }}>{effUnderlying || "—"}{isStock ? "" : " derivatives"}</div>
        {onClose && <button onClick={onClose} className="tap" style={{ border: "none", background: "transparent", color: "var(--muted)", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Close</button>}
      </div>
      {spot != null && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Spot ~{Number(spot).toLocaleString()}</div>}

      <Row label="Type">
        <Pill active={productType === "STOCK"} onClick={() => { setProductType("STOCK"); setResolved(null); }}>Stock</Pill>
        <Pill active={productType === "FUTURE"} onClick={() => { setProductType("FUTURE"); setLots(DEFAULT_LOTS[market] || 1); setResolved(null); }}>Future</Pill>
        <Pill active={productType === "OPTION"} onClick={() => { setProductType("OPTION"); setLots(DEFAULT_LOTS[market] || 1); setResolved(null); }}>Option</Pill>
      </Row>

      {market === "Commodity" && !isStock && (
        <Row label="Contract">
          {COMMODITY_CONTRACTS.map(([k, lbl]) => <Pill key={k} active={commContract === k} onClick={() => { setCommContract(k); setResolved(null); }}>{lbl}</Pill>)}
        </Row>
      )}

      {isStock ? null : isOption ? (
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

      {!isStock && (
        <>
          <Row label="Expiry">
            <Pill active={expiryMode === "INTENT"} onClick={() => setExpiryMode("INTENT")}>Preset</Pill>
            <Pill active={expiryMode === "EXPLICIT"} onClick={() => setExpiryMode("EXPLICIT")}>Exact date</Pill>
          </Row>
          {expiryMode === "INTENT" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
              {intents.map(([k, lbl]) => <Pill key={k} active={safeIntent === k} onClick={() => { setExpiryIntent(k); setResolved(null); }}>{lbl}</Pill>)}
            </div>
          ) : (
            <input type="date" value={expiry} onChange={(e) => { setExpiry(e.target.value); setResolved(null); }} className="no-ring mono" style={{ marginTop: 8, width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
          )}

          <Row label="Lots / contracts">
            <input value={lots} onChange={(e) => { setLots(e.target.value.replace(/[^0-9]/g, "") || "1"); setResolved(null); }} inputMode="numeric" className="no-ring mono" style={{ width: 90, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 800, background: "var(--elev)", color: "var(--ink)" }} />
            <span style={{ alignSelf: "center", fontSize: 10.5, color: "var(--muted)" }}>broker qty = lots × lot size (resolved on confirm)</span>
          </Row>
        </>
      )}

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
