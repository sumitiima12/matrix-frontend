import React, { useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { notifyAutoSettingsChanged } from "../../services/autoSettingsService";

/**
 * EngineMasterSwitch — a master on/off that pauses or resumes ALL auto-entries for one engine (Automation, Ideas,
 * …) in a single toggle, without having to untoggle each strategy/market. Open positions and their exits keep
 * running; only NEW entries are paused. Persists to `storageKey` and syncs to the server via autoSettings, where the
 * matching engine checks it (e.g. automationMaster / ideasMaster). Mirrors the Screener master switch.
 *
 * Props: storageKey (e.g. "mx_auto_master"), label (e.g. "Automation engine").
 */
export default function EngineMasterSwitch({ storageKey, label }) {
  const [on, setOn] = useState(() => lsGet(storageKey, true) !== false);
  const toggle = () => { const v = !on; setOn(v); lsSet(storageKey, v); notifyAutoSettingsChanged(); };
  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--elev)" }}>
      <label className="tap" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <span onClick={toggle} style={{ width: 36, height: 21, borderRadius: 999, background: on ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
        </span>
        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{label} {on ? "running" : "paused"}</span>
        {!on && <span style={{ fontSize: 10, color: "var(--down)", fontWeight: 800 }}>· no new entries</span>}
      </label>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>Master switch — pauses or resumes new auto-entries for every item here. Open positions and their exits are unaffected.</div>
    </div>
  );
}
