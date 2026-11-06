import React, { useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * AutoOptionConfig — the IN-only "trade the option instead of the stock" control shared by the automation
 * surfaces (Smart Auto-Buy, Screener, Ideas). When enabled, the SERVER engines buy the signal symbol's ATM
 * CALL (long signal) / PUT (short signal) instead of the stock, reusing the same planOptionLegs resolver the
 * Automate OptionLeg uses. Persists per market to `mx_auto_option_<market>` and notifies the auto-settings sync
 * so the server receives the config.
 *
 * Scope: Indian only for now (the server resolves against the NSE option master). Real execution is gated on
 * the backend's certification flag — until then option entries run in PAPER even in Real mode, surfaced via the
 * per-market skip reason. This control only records intent; it never places an order itself.
 */
const MNY = [["ATM", "ATM"], ["OTM1", "OTM 1"], ["OTM2", "OTM 2"], ["ITM1", "ITM 1"]];
const EXPIRY = ["Current week", "Current month"];

export default function AutoOptionConfig({ market }) {
  const key = `mx_auto_option_${market}`;
  const [cfg, setCfg] = useState(() => {
    const v = lsGet(key, null);
    return v && typeof v === "object" ? { enabled: !!v.enabled, mny: v.mny || "ATM", expiry: v.expiry || "Current week", lots: Math.max(1, Number(v.lots) || 1) }
                                      : { enabled: false, mny: "ATM", expiry: "Current week", lots: 1 };
  });
  if (market !== "IN") return null;   // NSE options only, for now

  const save = (next) => { setCfg(next); lsSet(key, next); notifyAutoSettingsChanged(); };
  const pill = (on) => ({
    flex: "0 0 auto", padding: "5px 11px", fontSize: 11, fontWeight: 800, cursor: "pointer", borderRadius: 999,
    border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
    background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--on-primary)" : "var(--ink)",
  });

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "var(--elev)", border: "1px solid var(--line)" }}>
      <label className="tap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>Trade as NSE options (CE/PE)</span>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ ...cfg, enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
      </label>
      {cfg.enabled && (
        <div style={{ marginTop: 9 }}>
          <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em", marginBottom: 5 }}>MONEYNESS</div>
          <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 9 }}>
            {MNY.map(([k, l]) => <button key={k} type="button" onClick={() => save({ ...cfg, mny: k })} className="tap disp" style={pill(cfg.mny === k)}>{l}</button>)}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em", marginBottom: 5 }}>EXPIRY</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
            {EXPIRY.map((e) => <button key={e} type="button" onClick={() => save({ ...cfg, expiry: e })} className="tap disp" style={{ ...pill(cfg.expiry === e), flex: 1 }}>{e}</button>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>Lots per entry</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => save({ ...cfg, lots: Math.max(1, cfg.lots - 1) })} className="tap disp" style={{ ...pill(false), width: 30, textAlign: "center", padding: "5px 0" }}>−</button>
              <span className="mono" style={{ minWidth: 22, textAlign: "center", fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{cfg.lots}</span>
              <button type="button" onClick={() => save({ ...cfg, lots: Math.min(50, cfg.lots + 1) })} className="tap disp" style={{ ...pill(false), width: 30, textAlign: "center", padding: "5px 0" }}>+</button>
            </div>
          </div>
          <div style={{ fontSize: 9.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 9 }}>
            Long signals buy a CALL, short signals buy a PUT, resolved against the live NSE chain when the signal fires
            (today's strike + expiry). Runs in paper until real option execution is certified.
          </div>
        </div>
      )}
    </div>
  );
}
