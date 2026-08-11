import React, { useEffect, useState } from "react";
import { getEntryHalt, setEntryHalt } from "../../services/brokerService";
import { confirmDialog, alertDialog } from "../../lib/confirmDialog";

/**
 * EntryKillSwitch — one-tap pause of all NEW real entries (auto-buy + screener auto-buy), server-side.
 *
 * This is the emergency stop that DOESN'T over-reach: it halts new entries only, so your open positions
 * keep their stop-loss / target managed by the exit engine, and resuming is one tap (no broker
 * re-connect / re-login, unlike disconnecting the broker). Self-contained — loads its own state, so it
 * can be dropped anywhere in real mode with no prop wiring.
 */
export default function EntryKillSwitch({ compact = false }) {
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
    // Surface failures instead of silently doing nothing — a failed toggle (e.g. session expired) used to
    // look like the button was dead. Re-read the true state after, so the label reflects the server.
    try {
      await setEntryHalt(next);
      const v = await getEntryHalt();
      setHalted(v);
    } catch (e) {
      await alertDialog(String((e && e.message) || e || "Couldn't update — try again."), { title: next ? "Couldn't stop entries" : "Couldn't resume entries" });
    } finally { setBusy(false); }
  };

  if (halted === null) return null;   // don't flash a wrong state while loading
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={halted}
      className="tap disp"
      style={{
        width: "100%", marginBottom: compact ? 0 : 12,
        padding: compact ? "9px 12px" : "11px", borderRadius: 10, fontWeight: 800,
        fontSize: compact ? 11.5 : 13, cursor: "pointer", whiteSpace: "nowrap", textAlign: "center",
        border: "1px solid " + (halted ? "var(--up)" : "var(--down)"),
        background: halted ? "var(--up-soft)" : "transparent",
        color: halted ? "var(--up)" : "var(--down)", opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "…" : halted ? "▶ Resume New Entries" : "⏸ Stop New Entries"}
    </button>
  );
}
