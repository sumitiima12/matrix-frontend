import React, { useState } from "react";
import { lsGet, lsSet } from "../../lib/format";
import { X } from "lucide-react";

/**
 * IntroCard — a one-time, dismissible "how this works" card on Home. It orients a first-time trader in ~20
 * seconds: Virtual vs Real, the markets, and what the four automation engines each do. Shows once (a localStorage
 * flag), can be reopened from Profile later if we wire that, and never blocks the UI.
 */
const ROWS = [
  ["🧪 → 💵", "Virtual vs Real", "Start in Virtual (paper money, no risk). Flip to Real to trade your connected broker. Each keeps its own wallet and history."],
  ["🌐", "Five markets", "Indian, US, Crypto, US Tokens, Commodity — pick one up top; everything below is scoped to it."],
  ["⚡", "Smart Auto-Buy", "Buys Matrix's top-ranked picks for the market once a day, each with a target and stop."],
  ["🔎", "Screeners", "Your rules scan the market and auto-buy any symbol that matches."],
  ["💡", "Ideas", "Neo's daily chart setups — auto-buy the strongest, or buy any one yourself."],
  ["🤖", "Automate", "Build or deploy strategies that trade on their own rules and manage their own exits."],
];

export default function IntroCard() {
  const [shown, setShown] = useState(() => !lsGet("mx_seen_intro", false));
  if (!shown) return null;
  const dismiss = () => { lsSet("mx_seen_intro", true); setShown(false); };
  return (
    <div className="card glow" style={{ marginTop: 12, padding: 16, border: "1px solid var(--line)", borderRadius: 18, position: "relative", background: "var(--card-grad)" }}>
      <button onClick={dismiss} aria-label="Dismiss" className="tap" style={{ position: "absolute", top: 10, right: 10, border: "none", background: "var(--elev)", borderRadius: 9, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--muted)" }}><X size={15} /></button>
      <div className="disp" style={{ fontWeight: 800, fontSize: 16, paddingRight: 32 }}>Welcome to MatrixOne</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>Your AI co-pilot for trading across markets — here's the 20-second tour.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 14 }}>
        {ROWS.map(([ic, title, body]) => (
          <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, lineHeight: 1.2, flex: "0 0 auto", width: 26, textAlign: "center" }}>{ic}</span>
            <div style={{ minWidth: 0 }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{title}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5, marginTop: 1 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={dismiss} className="tap disp" style={{ marginTop: 14, width: "100%", border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 12, padding: "11px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Got it — let's go</button>
    </div>
  );
}
