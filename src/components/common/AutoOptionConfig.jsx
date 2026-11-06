import React, { useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * AutoOptionConfig — the IN-only "trade the option instead of the stock" control shared by the automation
 * surfaces (Smart Auto-Buy, Screener, Ideas). When enabled, the SERVER engines buy the signal symbol's ATM
 * CALL (long signal) / PUT (short signal) instead of the stock, reusing the same planOptionLegs resolver the
 * Automate OptionLeg uses. Persists per market to `mx_auto_option_<market>` and notifies the auto-settings sync
 * so the server receives the config.
 *
 * `externalEnabled`: when a boolean is passed (Smart Auto-Buy, where the Stock/Future/Option capsule already is
 * the toggle), this control hides its own checkbox and follows that capsule — so there isn't a redundant second
 * "Trade as options" switch. When omitted (Screener / Ideas, which have no instrument capsule) it shows its own
 * enable checkbox.
 *
 * Scope: Indian only for now (the server resolves against the NSE option master). Real execution is gated on
 * the backend's certification flag — until then option entries run in PAPER even in Real mode. Everything here
 * SAVES automatically the moment you change it; there is no separate Save button.
 */
const MNY = [["ATM", "ATM"], ["OTM1", "OTM 1"], ["OTM2", "OTM 2"], ["ITM1", "ITM 1"]];
const EXPIRY = ["Current week", "Current month"];

export default function AutoOptionConfig({ market, externalEnabled = null }) {
  const key = `mx_auto_option_${market}`;
  const controlled = typeof externalEnabled === "boolean";
  const [cfg, setCfg] = useState(() => {
    const v = lsGet(key, null);
    const base = v && typeof v === "object" ? { enabled: !!v.enabled, mny: v.mny || "ATM", expiry: v.expiry || "Current week", lots: Math.max(1, Number(v.lots) || 1) }
                                            : { enabled: false, mny: "ATM", expiry: "Current week", lots: 1 };
    return controlled ? { ...base, enabled: externalEnabled } : base;
  });
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  const persist = (next) => {
    lsSet(key, next); notifyAutoSettingsChanged();
    setSaved(true); if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  };
  const save = (next) => { setCfg(next); persist(next); };

  // When driven by the instrument capsule, keep the stored `enabled` in sync with it (so the server engine turns
  // options on/off with the capsule, and the params below show/hide accordingly). Persist silently on real change.
  useEffect(() => {
    if (!controlled) return;
    setCfg((c) => {
      if (c.enabled === externalEnabled) return c;
      const next = { ...c, enabled: externalEnabled };
      lsSet(key, next); notifyAutoSettingsChanged();
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEnabled, controlled, key]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  if (market !== "IN") return null;   // NSE options only, for now

  const pill = (on) => ({
    flex: "0 0 auto", padding: "5px 11px", fontSize: 11, fontWeight: 800, cursor: "pointer", borderRadius: 999,
    border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
    background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--on-primary)" : "var(--ink)",
  });
  const savedBadge = saved ? <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--up)" }}>✓ Saved</span> : null;

  // Controlled (Smart Auto-Buy): no own checkbox — the Option capsule is the toggle. Show params only when on.
  if (controlled) {
    if (!cfg.enabled) return null;
    return (
      <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "var(--elev)", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>Options (CE/PE)</span>
          {savedBadge}
        </div>
        <OptionParams cfg={cfg} save={save} pill={pill} />
      </div>
    );
  }

  // Uncontrolled (Screener / Ideas): own enable checkbox + params.
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "var(--elev)", border: "1px solid var(--line)" }}>
      <label className="tap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>Trade as NSE options (CE/PE)</span>
          {savedBadge}
        </span>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ ...cfg, enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
      </label>
      {cfg.enabled && <div style={{ marginTop: 9 }}><OptionParams cfg={cfg} save={save} pill={pill} /></div>}
    </div>
  );
}

function OptionParams({ cfg, save, pill }) {
  return (
    <>
      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".03em", marginBottom: 5, marginTop: 7 }}>MONEYNESS</div>
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
        (today's strike + expiry). Saved automatically. Runs in paper until real option execution is certified.
      </div>
    </>
  );
}
