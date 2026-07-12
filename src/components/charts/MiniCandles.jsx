import React, { useState } from "react";
import { compact } from "../../lib/format";
import { useCandles } from "../../hooks/useCandles";
import { PATTERNS, TF_N } from "../../lib/patterns";
import ChartToolbar from "./ChartToolbar";

/**
 * MiniCandles — the compact chart used on cards and in the stock drawer.
 *
 * REAL candles only. If history isn't available it says so; it never draws an
 * invented price path.
 */
export default function MiniCandles({
  sym, defaultTf = "1d", height = 130, showTf = true, pattern, staticChart = false,
}) {
  const [tf, setTf] = useState(defaultTf);
  const [ctype, setCtype] = useState("line");
  const { data, loading, error } = useCandles(sym, tf, TF_N[tf] || 26);

  if (loading) {
    return <div style={{ height, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 11.5 }}>Loading chart…</div>;
  }
  if (!data || !data.length) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 11.5, textAlign: "center", padding: "0 12px" }}>
        {error === "no-backend" ? "Connect the backend for live charts" : "Chart unavailable for this symbol"}
      </div>
    );
  }

  const W = 340, H = height, padT = 8, padB = 8;
  const min = Math.min(...data.map((d) => d.l));
  const max = Math.max(...data.map((d) => d.h));
  const span = max - min || 1;
  const yOf = (p) => padT + ((max - p) / span) * (H - padT - padB);
  const cw = W / data.length;

  const patLabel = pattern && PATTERNS[pattern] ? PATTERNS[pattern].label : pattern;
  const up = data[data.length - 1].c >= data[0].o;
  const lineCol = up ? "var(--up)" : "var(--down)";
  const linePts = data.map((d, k) => `${(k + 0.5) * cw},${yOf(d.c)}`).join(" ");
  const areaPts = `0,${H} ${linePts} ${W},${H}`;
  const gid = "mcg" + String(sym).replace(/\W/g, "") + tf;

  return (
    <div>
      <div style={{ position: "relative" }}>
        {patLabel && (
          <span className="pill" style={{ position: "absolute", top: 6, left: 6, zIndex: 2, fontSize: 9.5, fontWeight: 800, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 8px" }}>
            ◫ {patLabel}
          </span>
        )}
        <span className="pill" style={{ position: "absolute", top: 6, right: 6, zIndex: 2, fontSize: 8, fontWeight: 800, background: "var(--up-soft)", color: "var(--up)", padding: "2px 6px" }}>● REAL</span>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          {ctype === "line" ? (
            <>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineCol} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={lineCol} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={areaPts} fill={`url(#${gid})`} />
              <polyline points={linePts} fill="none" stroke={lineCol} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            data.map((d, k) => {
              const x = (k + 0.5) * cw;
              const bull = d.c >= d.o;
              const col = bull ? "var(--up)" : "var(--down)";
              const yO = yOf(d.o), yC = yOf(d.c);
              return (
                <g key={k}>
                  <line x1={x} y1={yOf(d.h)} x2={x} y2={yOf(d.l)} stroke={col} strokeWidth="1" />
                  <rect x={x - cw * 0.3} y={Math.min(yO, yC)} width={cw * 0.6} height={Math.max(1.5, Math.abs(yC - yO))} fill={col} rx="1" />
                </g>
              );
            })
          )}
        </svg>
      </div>

      {showTf && !staticChart && (
        <div style={{ marginTop: 8 }}>
          <ChartToolbar tf={tf} setTf={setTf} ctype={ctype} setCtype={setCtype} size="sm" />
        </div>
      )}
    </div>
  );
}
