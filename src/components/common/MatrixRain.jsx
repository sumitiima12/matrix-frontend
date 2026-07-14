import React, { useEffect, useRef, useState } from "react";

/**
 * MatrixRain — the cold-open.
 *
 * Digital rain for ~1s, then it dissolves into the Matrix wordmark. Canvas, not
 * SVG: this is a few hundred glyphs redrawn every frame, which is exactly what a
 * canvas is for and exactly what the DOM is not.
 *
 * Two things it does NOT do:
 *
 *  - It does not block the app. Data fetching starts behind it on mount; the rain
 *    is an overlay on a live app, not a gate in front of a dead one. A splash that
 *    delays the first quote by a second is a splash that costs the user a second.
 *
 *  - It does not run for people who asked it not to. `prefers-reduced-motion` is
 *    respected: they get the wordmark, no animation. Flickering high-contrast glyphs
 *    are a genuine problem for photosensitive users, and this is decoration.
 *
 * Shown once per browser session, not on every re-render or route change.
 */

const GLYPHS = "01011010110100101アイウエオカキクケコサシスセソタチツテト0101";
const DURATION = 1000;      // rain
const FADE = 550;           // dissolve into the logo

export default function MatrixRain({ onDone }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("rain");   // rain -> logo -> gone

  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("logo");
      const t = setTimeout(() => { setPhase("gone"); onDone && onDone(); }, 700);
      return () => clearTimeout(t);
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const size = 14;
    const cols = Math.ceil(w / size);
    // Start each column at a random height so the rain is already falling when you
    // arrive, rather than everything starting from the top in a neat row.
    const drops = Array.from({ length: cols }, () => Math.random() * -40);

    let raf;
    const draw = () => {
      // Translucent black over the last frame: this is what leaves the trailing
      // comet tail behind each glyph. Clearing outright would give you rain with
      // no wake, which reads as noise rather than falling.
      ctx.fillStyle = "rgba(0, 8, 2, 0.10)";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `600 ${size}px "SF Mono", ui-monospace, monospace`;

      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * size;
        const y = drops[i] * size;

        // the leading glyph burns brighter than its tail
        ctx.fillStyle = Math.random() > 0.975 ? "#D6FFE4" : "#22C55E";
        ctx.fillText(ch, x, y);

        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    const t1 = setTimeout(() => setPhase("logo"), DURATION);
    const t2 = setTimeout(() => { setPhase("gone"); onDone && onDone(); }, DURATION + FADE);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#000502",
        display: "grid", placeItems: "center",
        opacity: phase === "logo" ? 0 : 1,
        transition: `opacity ${FADE}ms ease`,
        pointerEvents: phase === "logo" ? "none" : "auto",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          opacity: phase === "logo" ? 0 : 0.85,
          transition: "opacity 400ms ease",
        }}
      />

      {/* The wordmark resolves out of the rain. */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          opacity: phase === "logo" ? 1 : 0.92,
          transform: phase === "logo" ? "scale(1.04)" : "scale(1)",
          transition: "opacity 400ms ease, transform 700ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          className="disp"
          style={{
            fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em",
            color: "#E9FFF1",
            textShadow: "0 0 22px rgba(34,197,94,.65), 0 0 60px rgba(34,197,94,.35)",
          }}
        >
          ✦ Matrix
        </div>
        <div
          style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: ".34em",
            color: "#22C55E", marginTop: 8, textTransform: "uppercase",
          }}
        >
          Smart Trading
        </div>
      </div>
    </div>
  );
}
