import React, { useEffect, useState } from "react";
import { getEntryHalt, setEntryHalt } from "../../services/brokerService";
import { confirmDialog } from "../../lib/confirmDialog";

/**
 * EntryKillSwitch — one-tap pause of all NEW real entries (auto-buy + screener auto-buy), server-side.
 *
 * This is the emergency stop that DOESN'T over-reach: it halts new entries only, so your open positions
 * keep their stop-loss / target managed by the exit engine, and resuming is one tap (no broker
 * re-connect / re-login, unlike disconnecting the broker). Self-contained — loads its own state, so it
 * can be dropped anywhere in real mode with no prop wiring.
 */
export default function EntryKillSwitch() {
  const [halted, setHalted] = useState(null);   // null = loading
  const [busy, setBusy] = useState(false);

  useEffect(() => { let ok = true; getEntryHalt().then((v) => ok && setHalted(v)).catch(() => ok && setHalted(false)); return () => { ok = false; }; }, []);

  const toggle = async () => {
    const next = !halted;
    if (next && !(await confirmDialog(
      "Pause all NEW real entries now?\n\nAuto-buy and screener auto-buy will stop opening positions. Your OPEN positions keep their stop-loss / target running. Resume anytime in one tap.",
      { title: "Pause new entries", confirmLabel: "Pause entries" }
    ))) return;
    setBusy(true);
    try { setHalted(await setEntryHalt(next)); } catch { /* leave state; user can retry */ } finally { setBusy(false); }
  };

  if (halted === null) return null;   // don't flash a wrong state while loading
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={halted}
      className="tap disp"
      style={{
        width: "100%", marginBottom: 12, padding: "11px", borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: "pointer",
        border: "1px solid " + (halted ? "var(--up)" : "var(--down)"),
        background: halted ? "var(--up-soft)" : "transparent",
        color: halted ? "var(--up)" : "var(--down)", opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "…" : halted ? "▶ Resume new entries" : "⏸ Pause new entries (kill switch)"}
    </button>
  );
}
