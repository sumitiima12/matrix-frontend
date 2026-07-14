import React from "react";
import { isOptionable, lotSize } from "../../domain/fno";

/**
 * OptionLeg — "when this strategy fires, trade the OPTION, not the stock."
 *
 * This is a preference, not a contract. The actual contract is resolved at the moment the
 * strategy fires, against the broker's live chain: today's expiry, today's strikes,
 * today's ATM. Storing a symbol here would mean trading a strike that was ATM whenever you
 * happened to configure the strategy — and after a 400-point move, ATM is somewhere else
 * entirely.
 *
 * Only offered on names with a REAL NSE lot size. There is no default lot size, so a name
 * we don't have one for simply cannot be sized, and we say so rather than guessing.
 */
export default function OptionLeg({ symbols = [], value, onChange }) {
  const optionable = symbols.filter(isOptionable);
  const on = Boolean(value && value.enabled);

  // Nothing in this strategy has listed options — say so instead of showing dead controls.
  if (!optionable.length) {
    return symbols.length ? (
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
        Options aren't available for {symbols.join(", ")} — no listed NSE lot size, so an option
        order couldn't be sized honestly.
      </div>
    ) : null;
  }

  const set = (k, v) => onChange({ ...(value || {}), [k]: v });

  const pill = (active) => ({
    padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 9,
    border: "1px solid " + (active ? "var(--primary)" : "var(--line)"),
    background: active ? "var(--primary)" : "var(--surface)",
    color: active ? "#fff" : "var(--ink)",
  });

  const lots = Number(value?.lots) || 1;
  const type = value?.type === "PE" ? "PE" : "CE";
  const moneyness = value?.moneyness || "ATM";
  const lot = optionable.length === 1 ? lotSize(optionable[0]) : null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
      <div
        onClick={() => set("enabled", !on)}
        className="tap"
        style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
      >
        <span
          style={{
            position: "relative", width: 34, height: 19, borderRadius: 19, flex: "0 0 auto",
            background: on ? "var(--primary)" : "var(--line)", transition: "background 180ms ease",
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: 15,
            background: "#fff", transition: "left 180ms cubic-bezier(.2,.8,.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }} />
        </span>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trade options instead of the stock</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {optionable.join(", ")} · the contract is picked when the signal fires, not now
          </div>
        </div>
      </div>

      {on && (
        <div style={{ marginTop: 12, paddingLeft: 2 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>EXPIRY</div>
          <div style={{ display: "flex", gap: 7 }}>
            {["Current week", "Current month"].map((e) => (
              <button key={e} onClick={() => set("expiry", e)} className="tap disp"
                style={{ ...pill((value?.expiry || "Current week") === e), flex: 1 }}>
                {e}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>TYPE</div>
          <div style={{ display: "flex", gap: 7 }}>
            {[["CE", "CALL"], ["PE", "PUT"]].map(([k, l]) => (
              <button key={k} onClick={() => set("type", k)} className="tap disp"
                style={{
                  ...pill(type === k), flex: 1,
                  background: type === k ? (k === "CE" ? "var(--up)" : "var(--down)") : "var(--surface)",
                  borderColor: type === k ? (k === "CE" ? "var(--up)" : "var(--down)") : "var(--line)",
                }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>MONEYNESS</div>
          <div style={{ display: "flex", gap: 7 }}>
            {["ITM", "ATM", "OTM"].map((m) => (
              <button key={m} onClick={() => set("moneyness", m)} className="tap disp"
                style={{ ...pill(moneyness === m), flex: 1 }}>
                {m}
              </button>
            ))}
          </div>

          {moneyness !== "ATM" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Strikes from ATM</span>
              <button onClick={() => set("steps", Math.max(1, (Number(value?.steps) || 1) - 1))} className="tap"
                style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>–</button>
              <span className="mono" style={{ fontWeight: 800, minWidth: 16, textAlign: "center" }}>{Number(value?.steps) || 1}</span>
              <button onClick={() => set("steps", Math.min(10, (Number(value?.steps) || 1) + 1))} className="tap"
                style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>+</button>
              {/* ITM/OTM are OPPOSITE directions for calls and puts. Spell it out —
                  getting it backwards buys the inverse of the thesis. */}
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {type === "CE"
                  ? (moneyness === "OTM" ? "above spot" : "below spot")
                  : (moneyness === "OTM" ? "below spot" : "above spot")}
              </span>
            </div>
          )}

          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", margin: "12px 0 6px" }}>LOTS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => set("lots", Math.max(1, lots - 1))} className="tap"
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>–</button>
            <span className="mono" style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: "center" }}>{lots}</span>
            <button onClick={() => set("lots", Math.min(50, lots + 1))} className="tap"
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>+</button>
            {lot && (
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                × {lot} = {lots * lot} contracts
              </span>
            )}
          </div>

          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
            When the entry rule fires, the strike is chosen against the live chain — today's ATM,
            today's expiry. If the chain can't be loaded, the strategy does not trade rather than
            guessing a contract.
          </div>
        </div>
      )}
    </div>
  );
}
