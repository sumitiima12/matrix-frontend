import React, { useEffect, useState } from "react";

/**
 * Splash — the cold-open. A clean black-and-white reveal of the MatrixOne mark: the logo
 * scales and fades in with a soft sheen, holds briefly, then dissolves. No digital rain, no
 * message — just the logo appearing with a premium, minimal effect.
 *
 * Notes:
 *  - It never blocks the app: data fetches start behind it; this is an overlay, not a gate.
 *  - It respects `prefers-reduced-motion`: those users get a still logo, no animation.
 *  - Shown once per browser session (the caller gates on sessionStorage).
 */

const REVEAL = 900;    // logo scales/fades in
const HOLD = 650;      // sits fully visible
const FADE = 550;      // whole splash fades out

export default function MatrixRain({ onDone }) {
  const [phase, setPhase] = useState("in");   // in -> hold -> out -> gone

  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = setTimeout(() => { setPhase("gone"); onDone && onDone(); }, 1200);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setPhase("hold"), REVEAL);
    const t2 = setTimeout(() => setPhase("out"), REVEAL + HOLD);
    const t3 = setTimeout(() => { setPhase("gone"); onDone && onDone(); }, REVEAL + HOLD + FADE);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (phase === "gone") return null;

  const fadingOut = phase === "out";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE}ms ease`,
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes mx-logo-in {
          0%   { opacity: 0; transform: scale(0.82); filter: blur(6px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes mx-sheen {
          0%   { transform: translateX(-140%) skewX(-18deg); }
          100% { transform: translateX(140%)  skewX(-18deg); }
        }
        @keyframes mx-word-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* The mark — a clean scale + fade-in (no sheen; suits the outline ring) */}
        <div
          style={{
            width: 96,
            height: 96,
            animation: "mx-logo-in 900ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          <MLogoMono size={96} />
        </div>

        {/* Wordmark, monochrome, fades up just after the logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, animation: "mx-word-in 500ms ease 500ms both" }}>
          <span style={{ fontWeight: 800, fontSize: 26, letterSpacing: "0.01em", color: "#fff", fontFamily: "inherit" }}>Matrix</span>
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.34em", color: "rgba(255,255,255,.55)", marginTop: 3 }}>ONE</span>
        </div>
      </div>
    </div>
  );
}

/* A monochrome (black tile, white M) version of the mark for the black-and-white splash. */
function MLogoMono({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="MatrixOne">
      <circle cx="50" cy="50" r="47" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M32 66 V34 L50 54 L68 34 V66" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
