import React, { useEffect, useRef, useState } from "react";
import Wordmark from "./Wordmark";

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

const REVEAL = 900;    // icon scales/fades in
const HOLD = 1600;     // sits fully visible while the shimmer sweeps a couple of times
const FADE = 700;      // whole splash fades out

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
          0%   { opacity: 0; transform: scale(0.80); filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes mx-word-in {
          0%   { opacity: 0; transform: translateY(10px); letter-spacing: .06em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0; }
        }
        @keyframes mx-shimmer {
          0%   { background-position: 220% 0; }
          100% { background-position: -120% 0; }
        }
        @keyframes mx-glow {
          0%,100% { opacity: .35; transform: scale(1); }
          50%     { opacity: .7;  transform: scale(1.12); }
        }
      `}</style>

      {/* The centred wordmark — no M mark, no shimmer. Just a clean scale/fade-in. */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "mx-logo-in 900ms cubic-bezier(.2,.7,.2,1) both" }}>
        <Wordmark height={56} color="#fff" />
      </div>
    </div>
  );
}
