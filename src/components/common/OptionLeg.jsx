import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { isOptionable, lotSize } from "../../domain/fno";

/**
 * OptionLeg — "when this strategy fires, trade OPTIONS instead of the stock."
 *
 * Now a MULTI-LEG builder: each leg is BUY/SELL · CALL/PUT · a moneyness (ITM 4 … ATM … OTM 4) ·
 * lots. So a user can build "Buy 1 ATM CALL and SELL 2 OTM PUT", or pick a ready-made strategy
 * (Bull Call Spread, Iron Condor, Straddle…) that fills the legs in for them.
 *
 * The strikes are NOT frozen here — they're a moneyness PREFERENCE resolved against the live chain
 * at the moment the signal fires (today's ATM, today's expiry). Storing an absolute strike would
 * mean trading whatever was ATM when you configured it, which after a big move is the wrong strike.
 */

/* Moneyness dropdown values -> {moneyness, steps}. steps 1..4 = how many strikes from ATM. */
export const MONEYNESS_OPTS = [
  ["ITM4", "ITM 4"], ["ITM3", "ITM 3"], ["ITM2", "ITM 2"], ["ITM1", "ITM 1"],
  ["ATM", "ATM"],
  ["OTM1", "OTM 1"], ["OTM2", "OTM 2"], ["OTM3", "OTM 3"], ["OTM4", "OTM 4"],
];
export const mnyToKey = (m, steps) => (m === "ATM" ? "ATM" : `${m}${Math.max(1, Math.min(4, steps || 1))}`);
export const keyToMny = (key) => {
  if (!key || key === "ATM") return { moneyness: "ATM", steps: 0 };
  const m = key.slice(0, 3), steps = Number(key.slice(3)) || 1;
  return { moneyness: m === "ITM" ? "ITM" : "OTM", steps };
};

/* Ready-made strategies — legs use the moneyness KEYS above (leg = {side,type,mny,lots}). */
export const OPT_STRATEGIES = {
  "Bull Call Spread": [{ side: "BUY", type: "CE", mny: "ATM" }, { side: "SELL", type: "CE", mny: "OTM1" }],
  "Bull Put Spread":  [{ side: "SELL", type: "PE", mny: "ATM" }, { side: "BUY", type: "PE", mny: "OTM1" }],
  "Bear Call Spread": [{ side: "SELL", type: "CE", mny: "ATM" }, { side: "BUY", type: "CE", mny: "OTM1" }],
  "Bear Put Spread":  [{ side: "BUY", type: "PE", mny: "ATM" }, { side: "SELL", type: "PE", mny: "OTM1" }],
  "Iron Condor":      [{ side: "SELL", type: "PE", mny: "OTM1" }, { side: "BUY", type: "PE", mny: "OTM2" }, { side: "SELL", type: "CE", mny: "OTM1" }, { side: "BUY", type: "CE", mny: "OTM2" }],
  "Straddle":         [{ side: "BUY", type: "CE", mny: "ATM" }, { side: "BUY", type: "PE", mny: "ATM" }],
  "Strangle":         [{ side: "BUY", type: "CE", mny: "OTM1" }, { side: "BUY", type: "PE", mny: "OTM1" }],
};

/* Read the current legs, migrating an OLD single-leg config ({type,moneyness,steps,lots}). */
function readLegs(value) {
  if (value && Array.isArray(value.legs) && value.legs.length) return value.legs;
  if (value && value.type) return [{ side: "BUY", type: value.type, mny: mnyToKey(value.moneyness, value.steps), lots: value.lots || 1 }];
  return [{ side: "BUY", type: "CE", mny: "ATM", lots: 1 }];
}

export default function OptionLeg({ symbols = [], value, onChange }) {
  const optionable = symbols.filter(isOptionable);
  const on = Boolean(value && value.enabled);

  if (!optionable.length) {
    return symbols.length ? (
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
        Options aren't available for {symbols.join(", ")} — no listed NSE lot size, so an option
        order couldn't be sized honestly.
      </div>
    ) : null;
  }

  const legs = readLegs(value);
  const set = (patch) => onChange({ ...(value || {}), ...patch });
  const setLegs = (next) => set({ legs: next });
  const updLeg = (i, patch) => setLegs(legs.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLeg = () => setLegs([...legs, { side: "BUY", type: "CE", mny: "ATM", lots: 1 }]);
  const delLeg = (i) => setLegs(legs.length > 1 ? legs.filter((_, j) => j !== i) : legs);
  const applyStrategy = (name) => { const t = OPT_STRATEGIES[name]; if (t) set({ legs: t.map((l) => ({ ...l, lots: 1 })), strategy: name }); };

  const lot = optionable.length === 1 ? lotSize(optionable[0]) : null;
  const pill = (active) => ({
    padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 9,
    border: "1px solid " + (active ? "var(--primary)" : "var(--line)"),
    background: active ? "var(--primary)" : "var(--surface)", color: active ? "#fff" : "var(--ink)",
  });
  const selStyle = { border: "1px solid var(--line)", borderRadius: 8, padding: "7px 4px", fontSize: 11.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)", minWidth: 0 };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
      <div onClick={() => set({ enabled: !on })} className="tap" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <span style={{ position: "relative", width: 34, height: 19, borderRadius: 19, flex: "0 0 auto", background: on ? "var(--primary)" : "var(--line)", transition: "background 180ms ease" }}>
          <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: 15, background: "#fff", transition: "left 180ms cubic-bezier(.2,.8,.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
        </span>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trade options instead of the stock</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{optionable.join(", ")} · strikes picked when the signal fires, not now</div>
        </div>
      </div>

      {on && (
        <div style={{ marginTop: 12, paddingLeft: 2 }}>
          {/* READY-MADE STRATEGIES */}
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>READY-MADE STRATEGY</div>
          <div className="hide-scroll" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {Object.keys(OPT_STRATEGIES).map((name) => (
              <button key={name} onClick={() => applyStrategy(name)} className="tap disp"
                style={{ ...pill(value?.strategy === name), fontSize: 11 }}>{name}</button>
            ))}
          </div>

          {/* EXPIRY */}
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>EXPIRY</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
            {["Current week", "Current month"].map((e) => (
              <button key={e} onClick={() => set({ expiry: e })} className="tap disp" style={{ ...pill((value?.expiry || "Current week") === e), flex: 1 }}>{e}</button>
            ))}
          </div>

          {/* LEGS */}
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>LEGS</div>
          <div style={{ display: "grid", gap: 8 }}>
            {legs.map((leg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--bg)", borderRadius: 10, padding: 6 }}>
                {/* BUY / SELL */}
                <button onClick={() => updLeg(i, { side: leg.side === "BUY" ? "SELL" : "BUY" })} className="tap disp"
                  style={{ flex: "0 0 auto", padding: "7px 9px", fontSize: 11, fontWeight: 800, borderRadius: 8, border: "1px solid " + (leg.side === "SELL" ? "var(--down)" : "var(--up)"), background: leg.side === "SELL" ? "var(--down-soft)" : "var(--up-soft)", color: leg.side === "SELL" ? "var(--down)" : "var(--up)" }}>
                  {leg.side}
                </button>
                {/* lots */}
                <input value={leg.lots || 1} inputMode="numeric" onChange={(e) => updLeg(i, { lots: Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 1) })} className="no-ring mono" style={{ ...selStyle, width: 34, textAlign: "center" }} />
                {/* CE / PE */}
                <select value={leg.type} onChange={(e) => updLeg(i, { type: e.target.value })} style={{ ...selStyle, flex: "0 0 62px" }}>
                  <option value="CE">CALL</option>
                  <option value="PE">PUT</option>
                </select>
                {/* moneyness ITM4..ATM..OTM4 */}
                <select value={leg.mny || "ATM"} onChange={(e) => updLeg(i, { mny: e.target.value })} style={{ ...selStyle, flex: "1 1 0" }}>
                  {MONEYNESS_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button onClick={() => delLeg(i)} disabled={legs.length === 1} className="tap" style={{ flex: "0 0 auto", border: "none", background: "transparent", padding: 2, opacity: legs.length === 1 ? 0.3 : 1 }}><Trash2 size={15} color="var(--down)" /></button>
              </div>
            ))}
          </div>
          <button onClick={addLeg} className="tap disp" style={{ marginTop: 8, border: "1px dashed var(--primary)", background: "transparent", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}>
            <Plus size={14} /> Add leg
          </button>

          {lot && (
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 10 }}>Lot size {lot} — each leg's lots × {lot} = contracts.</div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
            Strikes are chosen against the live chain when the entry rule fires — today's ATM and expiry.
            If the chain can't be loaded, the strategy does not trade rather than guessing a contract.
          </div>
        </div>
      )}
    </div>
  );
}
