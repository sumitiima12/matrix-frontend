import React, { useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * TrendGateConfig — "trade with the trend" gate. When ON, the server skips LONG auto-entries while the market
 * benchmark is in a clear downtrend (price below its EMA AND momentum below −threshold) and skips SHORTS in a clear
 * uptrend. "Flat" never blocks; it only gates NEW entries, never exits or open positions.
 *
 * SCOPED. `scope` picks which level this control edits:
 *   • "global"  → the overall default for all auto-trading (mx_auto_trendgate)
 *   • "automation" | "screener" | "ideas" | "smartbuy" → that trade type (mx_auto_trendgate_<scope>)
 * The server resolves each entry as: per-item → per-type → global → built-in default. So you can turn the overall
 * gate OFF but leave it ON for, say, Automation (the type setting overrides the global one).
 *
 * Default ON, 20-EMA / 1.5% momentum.
 */
const DEF = { enabled: true, emaPeriod: 20, momPct: 1.5 };
const SCOPE_LABEL = { global: "all auto-trading", automation: "Automation", screener: "Screener", ideas: "Ideas", smartbuy: "Smart Auto-Buy" };

export default function TrendGateConfig({ scope = "global" }) {
  const key = scope === "global" ? "mx_auto_trendgate" : `mx_auto_trendgate_${scope}`;
  const [cfg, setCfg] = useState(() => {
    const v = lsGet(key, null);
    if (v && typeof v === "object") return { enabled: v.enabled !== false, emaPeriod: Number(v.emaPeriod) > 1 ? Number(v.emaPeriod) : 20, momPct: Number(v.momPct) >= 0 ? Number(v.momPct) : 1.5 };
    return { ...DEF };
  });
  const [saved, setSaved] = useState(false);
  const t = useRef(null);
  const persist = (next) => {
    lsSet(key, next); notifyAutoSettingsChanged();
    setSaved(true); if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setSaved(false), 1500);
  };
  const save = (next) => { setCfg(next); persist(next); };
  useEffect(() => { if (lsGet(key, null) == null) { lsSet(key, cfg); notifyAutoSettingsChanged(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const numBox = { width: 60, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 8px", fontWeight: 800, fontSize: 12.5, background: "var(--surface)", color: "var(--primary)" };
  const lbl = SCOPE_LABEL[scope] || scope;

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--elev)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ ...cfg, enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trade with the trend <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 10.5 }}>· {lbl}</span></span>
        {saved && <span style={{ fontSize: 10.5, color: "var(--up)", fontWeight: 700 }}>✓ Saved</span>}
      </label>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
        Skips LONG {scope === "global" ? "auto-entries" : lbl + " entries"} when the market is below its {cfg.emaPeriod}-EMA and down &gt;{cfg.momPct}% (and skips shorts in a clear uptrend).{scope !== "global" ? " Overrides the overall setting." : ""}
      </div>
      {cfg.enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>EMA period</span>
            <input value={String(cfg.emaPeriod)} inputMode="numeric" className="no-ring mono" style={numBox}
              onChange={(e) => { const v = Math.max(2, Math.min(200, Math.round(Number(String(e.target.value).replace(/[^0-9]/g, "")) || 20))); save({ ...cfg, emaPeriod: v }); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Momentum %</span>
            <input value={String(cfg.momPct)} inputMode="decimal" className="no-ring mono" style={numBox}
              onChange={(e) => { const v = Math.max(0, Math.min(25, Number(String(e.target.value).replace(/[^0-9.]/g, "")) || 0)); save({ ...cfg, momPct: v }); }} />
          </div>
        </div>
      )}
    </div>
  );
}
