import React, { useEffect, useRef, useState } from "react";

/**
 * Splash — the cold-open. Black-and-white digital rain (the classic Matrix cascade,
 * rendered in monochrome instead of green) falls behind the new twin-blade "M" mark,
 * which scales and fades in, holds, then the whole splash dissolves.
 *
 * Notes:
 *  - It never blocks the app: data fetches start behind it; this is an overlay, not a gate.
 *  - It respects `prefers-reduced-motion`: those users get a still logo, no rain, no animation.
 *  - Shown once per browser session (the caller gates on sessionStorage).
 */

const REVEAL = 900;    // logo scales/fades in
const HOLD = 1100;     // sits fully visible while the rain runs
const FADE = 650;      // whole splash fades out

export default function MatrixRain({ onDone }) {
  const [phase, setPhase] = useState("in");   // in -> hold -> out -> gone
  const canvasRef = useRef(null);

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

  // Black-and-white digital rain on a canvas.
  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (reduced || !canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Katakana + digits, the familiar Matrix glyph set.
    const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789".split("");
    const fontSize = 16;
    const cols = Math.ceil(W / fontSize);
    const drops = new Array(cols).fill(0).map(() => Math.random() * -H);

    let raf;
    const draw = () => {
      // Fade the previous frame to black — leaves greyscale trails.
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < cols; i++) {
        const x = i * fontSize + fontSize / 2;
        const y = drops[i];
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        // Bright white leading glyph, fading grey tail — monochrome, no green.
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(ch, x, y);
        ctx.fillStyle = "rgba(190,190,195,0.55)";
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y - fontSize);

        drops[i] = y > H + Math.random() * 200 ? Math.random() * -80 : y + fontSize;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

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
        overflow: "hidden",
      }}
    >
      {/* Black-and-white Matrix rain, behind the mark */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, opacity: 0.55 }} />
      {/* Vignette so the centre mark stays legible over the rain */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.92) 100%)" }} />

      <style>{`
        @keyframes mx-logo-in {
          0%   { opacity: 0; transform: scale(0.82); filter: blur(6px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes mx-word-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* The new twin-blade mark — scale + fade-in */}
        <div style={{ width: 104, height: 104, animation: "mx-logo-in 900ms cubic-bezier(.2,.7,.2,1) both" }}>
          <MLogoMono size={104} />
        </div>

        {/* Wordmark, monochrome, fades up just after the logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, animation: "mx-word-in 500ms ease 500ms both" }}>
          <span style={{ fontWeight: 800, fontSize: 28, letterSpacing: "0.16em", color: "#fff", fontFamily: "inherit" }}>MATRIX</span>
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.34em", color: "rgba(255,255,255,.6)", marginTop: 5 }}>ONE</span>
        </div>
      </div>
    </div>
  );
}

/* Monochrome (white metallic on black) twin-blade M for the black-and-white splash. */
function MLogoMono({ size = 104 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Matrix One">
      <defs>
        <linearGradient id="mx-splash-grad" x1="50" y1="6" x2="50" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.4" stopColor="#e9ebee" />
          <stop offset="0.68" stopColor="#b8bcc4" />
          <stop offset="1" stopColor="#8c9099" />
        </linearGradient>
        <linearGradient id="mx-splash-beam" x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mx-splash-dot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Moving shimmer band — bright in the middle, transparent at the edges */}
        <linearGradient id="mx-splash-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Clip the shimmer to the exact M silhouette */}
        <clipPath id="mx-splash-clip">
          <path d="M10 12 L50 34 L90 12 L90 74 L80 90 L66 74 L50 56 L34 74 L20 90 L10 74 Z" />
        </clipPath>
      </defs>
      <path
        d="M10 12 L50 34 L90 12 L90 74 L80 90 L66 74 L50 56 L34 74 L20 90 L10 74 Z"
        fill="url(#mx-splash-grad)"
        stroke="#3a3d44"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Shimmer sweep, confined to the M */}
      <g clipPath="url(#mx-splash-clip)">
        <polygon points="-46,-16 -20,-16 -4,116 -30,116" fill="url(#mx-splash-sheen)" opacity="0.85">
          <animateTransform attributeName="transform" type="translate" from="0 0" to="150 0" dur="2.2s" begin="0.35s" repeatCount="indefinite" />
        </polygon>
      </g>
      <rect x="49" y="6" width="2" height="88" fill="url(#mx-splash-beam)" />
      <circle cx="50" cy="45" r="10" fill="url(#mx-splash-dot)" />
      <circle cx="50" cy="45" r="3" fill="#ffffff" />
    </svg>
  );
}
