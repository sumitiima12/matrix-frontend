import React, { useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * TrendGateConfig — "trade with the trend" gate. When ON, the server skips SHORT auto-entries while the market
 * benchmark is in an uptrend (price above its EMA) and skips LONGS in a downtrend (below the EMA). Momentum is an
 * extra filter: a sharp counter-move flips the read back to "flat". "Flat" never blocks; only NEW entries are gated,
 * never exits or open positions.
 *
 * SCOPED on/off, SHARED thresholds. `scope` picks which on/off this control toggles:
 *   • "global"  → the overall master (mx_auto_trendgate.enabled)
 *   • "automation" | "screener" | "ideas" | "smartbuy" → that trade type (mx_auto_trendgate_<scope>.enabled)
 * The server cascade resolves each entry as: overall master → per-type → per-item. Turning the overall OFF disables
 * everything; with it ON you can disable a single type. The EMA period + momentum % are SHARED (one set, stored on
 * the global key) and editable from every control, so you can tune them from any trade type's page.
 *
 * Default ON, 20-EMA / 1.5% momentum.
 */
const GKEY = "mx_auto_trendgate";   // the global key — holds the shared EMA/momentum thresholds (+ overall on/off)
const DEF = { enabled: true, emaPeriod: 20, momPct: 1.5 };
const SCOPE_LABEL = { global: "all auto-trading", automation: "Automation", screener: "Screener", ideas: "Ideas", smartbuy: "Smart Auto-Buy" };
const readThresholds = () => {
  const v = lsGet(GKEY, null);
  return {
    emaPeriod: (v && Number(v.emaPeriod) > 1) ? Number(v.emaPeriod) : 20,
    momPct: (v && Number(v.momPct) >= 0) ? Number(v.momPct) : 1.5,
  };
};

export default function TrendGateConfig({ scope = "global" }) {
  const key = scope === "global" ? GKEY : `mx_auto_trendgate_${scope}`;
  const [enabled, setEnabled] = useState(() => {
    const v = lsGet(key, null);
    return (v && typeof v === "object") ? v.enabled !== false : DEF.enabled;
  });
  const [thr, setThr] = useState(readThresholds);   // SHARED EMA/momentum (always from the global key)
  const [saved, setSaved] = useState(false);
  const t = useRef(null);
  const flash = () => { setSaved(true); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setSaved(false), 1500); };

  // Persist the per-scope on/off to THIS scope's key (thresholds live only on the global key, written below).
  const persistEnabled = (next) => {
    const base = scope === "global" ? readThresholds() : {};
    lsSet(key, { enabled: next, ...base });
    notifyAutoSettingsChanged(); flash();
  };
  const toggle = (next) => { setEnabled(next); persistEnabled(next); };

  // Persist the SHARED thresholds to the global key, preserving the overall on/off there.
  const persistThresholds = (nextThr) => {
    const g = lsGet(GKEY, null) || {};
    lsSet(GKEY, { enabled: g.enabled !== false, emaPeriod: nextThr.emaPeriod, momPct: nextThr.momPct });
    notifyAutoSettingsChanged(); flash();
  };
  const saveThr = (nextThr) => { setThr(nextThr); persistThresholds(nextThr); };

  // Seed the scope key on first mount if absent, so the server sees this type's on/off even if never touched.
  useEffect(() => { if (lsGet(key, null) == null) persistEnabled(enabled); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Keep the shared thresholds in sync if another control (another page) edited them.
  useEffect(() => {
    const onChange = () => setThr(readThresholds());
    window.addEventListener("mx-autosettings-changed", onChange);
    return () => window.removeEventListener("mx-autosettings-changed", onChange);
  }, []);

  const numBox = { width: 60, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 8px", fontWeight: 800, fontSize: 12.5, background: "var(--surface)", color: "var(--primary)" };
  const lbl = SCOPE_LABEL[scope] || scope;

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--elev)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trade with the trend <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 10.5 }}>· {lbl}</span></span>
        {saved && <span style={{ fontSize: 10.5, color: "var(--up)", fontWeight: 700 }}>✓ Saved</span>}
      </label>
      {/* SHARED thresholds — shown on every scope when this control is ON, so EMA/momentum can be tuned from anywhere.
          Editing them here changes the one shared setting used by every trade type. */}
      {enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>EMA period</span>
            <input value={String(thr.emaPeriod)} inputMode="numeric" className="no-ring mono" style={numBox}
              onChange={(e) => { const v = Math.max(2, Math.min(200, Math.round(Number(String(e.target.value).replace(/[^0-9]/g, "")) || 20))); saveThr({ ...thr, emaPeriod: v }); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Momentum %</span>
            <input value={String(thr.momPct)} inputMode="decimal" className="no-ring mono" style={numBox}
              onChange={(e) => { const v = Math.max(0, Math.min(25, Number(String(e.target.value).replace(/[^0-9.]/g, "")) || 0)); saveThr({ ...thr, momPct: v }); }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>shared across all types</span>
        </div>
      )}
    </div>
  );
}
