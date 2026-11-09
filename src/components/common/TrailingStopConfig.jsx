import React, { useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * TrailingStopConfig — the per-market "Trailing stop-loss" control shared by the automation surfaces (Smart
 * Auto-Buy, Screener, Ideas, Automate). When enabled, the SERVER exit monitor ratchets each position's stop up by
 * `pct`% for every `pct`% the symbol moves in the position's favour (never loosening it), on top of the hard stop.
 * Persists per market to `mx_auto_trailing_<market>` and notifies the auto-settings sync so the server receives it.
 *
 * Default: ON at 1% for every market except Indian (equities are noisier intraday). On first mount with nothing
 * stored, the default is persisted so the server engine gets it even if the user never touches the control.
 */
export default function TrailingStopConfig({ market }) {
  const key = `mx_auto_trailing_${market}`;
  const [cfg, setCfg] = useState(() => {
    const v = lsGet(key, null);
    if (v && typeof v === "object") return { enabled: v.enabled !== false, pct: Number(v.pct) > 0 ? Number(v.pct) : 1 };
    return { enabled: market !== "IN", pct: 1 };   // on by default everywhere except IN
  });
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  const persist = (next) => {
    lsSet(key, next); notifyAutoSettingsChanged();
    setSaved(true); if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };
  const save = (next) => { setCfg(next); persist(next); };

  // Persist the default on first mount when nothing is stored, so the server engine applies it without the user
  // having to toggle anything.
  useEffect(() => {
    if (lsGet(key, null) == null) { lsSet(key, cfg); notifyAutoSettingsChanged(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--elev)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ ...cfg, enabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Trailing stop-loss</span>
        {saved && <span style={{ fontSize: 10.5, color: "var(--up)", fontWeight: 700 }}>✓ Saved</span>}
      </label>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
        Moves the stop up by {cfg.pct}% for every {cfg.pct}% the symbol moves in your favour — locks in gains, never loosens.
      </div>
      {cfg.enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Trail %</span>
          <input
            value={String(cfg.pct)}
            onChange={(e) => { const v = Math.max(0.1, Math.min(10, Number(String(e.target.value).replace(/[^0-9.]/g, "")) || 1)); save({ ...cfg, pct: v }); }}
            inputMode="decimal"
            className="no-ring mono"
            style={{ width: 60, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 8px", fontWeight: 800, fontSize: 12.5, background: "var(--surface)", color: "var(--primary)" }}
          />
        </div>
      )}
    </div>
  );
}
