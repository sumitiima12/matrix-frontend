import React, { useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * TrendGateConfig — the GLOBAL "trade with the trend" switch for the auto engines (Screener, Ideas, Smart-Auto-Buy,
 * virtual Automate). When ON, the server skips LONG auto-entries while the market benchmark is in a clear downtrend
 * (price below its EMA AND momentum below −threshold) and skips SHORTS in a clear uptrend. "Flat" never blocks.
 *
 * Persisted to `mx_auto_trendgate` = { enabled, emaPeriod, momPct } and pushed to the server via the auto-settings
 * sync (settings.trendGate). Default ON, 20-EMA / 1.5% momentum. It's one global control (not per-market).
 */
const DEF = { enabled: true, emaPeriod: 20, momPct: 1.5 };

export default function TrendGateConfig() {
  const key = "mx_auto_trendgate";
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
  // Persist the default on first mount so the server applies it even if the user never opens this control.
  useEffect(() => { if (lsGet(key, null) == null) { lsSet(key, cfg); notifyAutoSettingsChanged(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const numBox = { width: 62, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 8px", fontWeight: 800, fontSize: 12.5, background: "var(--surface)", color: "var(--primary)" };

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--elev)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ ...cfg, enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trade with the trend</span>
        {saved && <span style={{ fontSize: 10.5, color: "var(--up)", fontWeight: 700 }}>✓ Saved</span>}
      </label>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
        Skips LONG auto-entries when the market is below its {cfg.emaPeriod}-EMA and down &gt;{cfg.momPct}% (and skips shorts in a clear uptrend). The Sell side keeps running in a downtrend.
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
