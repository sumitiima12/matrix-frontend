import React, { useEffect, useRef } from "react";

/** Scroll-linked scale/opacity wrapper — the app's signature subtle motion. */
export default function Pop({ children, style, className, amount = 0.03 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const center = r.top + r.height / 2;
      const dist = Math.min(1, Math.abs(center - vh / 2) / (vh / 2));
      const t = 1 - dist;
      el.style.transform = `scale(${(1 - amount + amount * t * 2).toFixed(3)})`;
      el.style.opacity = (0.62 + 0.38 * t).toFixed(3);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [amount]);
  return <div ref={ref} className={className} style={{ transition: "transform .18s ease, opacity .18s ease", willChange: "transform, opacity", ...style }}>{children}</div>;
}
