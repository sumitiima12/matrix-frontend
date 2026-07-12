import React, { useMemo, useState } from "react";
import { useCandles } from "../../hooks/useCandles";
import { smaSeries, emaSeries, bollingerSeries, macdSeries, rsiSeries, OVERLAYS } from "../../lib/indicators";
import ChartToolbar from "./ChartToolbar";
import IndicatorPanel from "./IndicatorPanel";

/**
 * ProChart — the stock detail page chart.
 *
 * REAL candles at 5m / 15m / 30m / 1h / 1D, candle or line, with stackable
 * overlays (EMA/SMA sets, Bollinger) and MACD / RSI sub-panels.
 *
 * All indicator maths comes from lib/indicators — this component only draws.
 */
export default function ProChart({ sym, defaultTf = "1d", height = 240 }) {
  const [tf, setTf] = useState(defaultTf);
  const [ctype, setCtype] = useState("candle");
  const [active, setActive] = useState(["ema21", "ema50"]);
  const [showMacd, setShowMacd] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [picker, setPicker] = useState(false);

  const { data, loading, error } = useCandles(sym, tf);
  const closes = useMemo(() => (data ? data.map((c) => c.c) : []), [data]);

  const lines = useMemo(() => {
    if (!closes.length) return [];
    const out = [];
    active.forEach((id) => {
      const o = OVERLAYS.find((x) => x.id === id);
      if (!o) return;
      if (o.kind === "ema") out.push({ id, color: o.color, label: o.label, vals: emaSeries(closes, o.n) });
      else if (o.kind === "sma") out.push({ id, color: o.color, label: o.label, vals: smaSeries(closes, o.n) });
      else if (o.kind === "bb") {
        const b = bollingerSeries(closes, o.n, 2);
        out.push({ id: id + "u", color: o.color, label: "BB upper", vals: b.up, dash: "3 3" });
        out.push({ id: id + "m", color: o.color, label: "BB mid", vals: b.mid });
        out.push({ id: id + "l", color: o.color, label: "BB lower", vals: b.lo, dash: "3 3" });
      }
    });
    return out;
  }, [closes, active]);

  const macd = useMemo(() => (showMacd && closes.length ? macdSeries(closes) : null), [closes, showMacd]);
  const rsi = useMemo(() => (showRsi && closes.length ? rsiSeries(closes) : null), [closes, showRsi]);

  const toggle = (id) => setActive((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const activeCount = active.length + (showMacd ? 1 : 0) + (showRsi ? 1 : 0);

  const toolbar = (
    <ChartToolbar
      tf={tf} setTf={setTf}
      ctype={ctype} setCtype={setCtype}
      onOpenIndicators={() => setPicker(true)}
      activeCount={activeCount}
    />
  );

  if (loading) {
    return <div>{toolbar}<div style={{ height, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Loading real candles…</div></div>;
  }
  if (!data || data.length < 3) {
    return (
      <div>
        {toolbar}
        <div style={{ height, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12, textAlign: "center", padding: "0 16px" }}>
          {error === "no-backend"
            ? "Connect the backend to load real price history."
            : "No price history available for this symbol at this timeframe."}
        </div>
      </div>
    );
  }

  const W = 700, H = height, padT = 10, padB = 10;
  const lows = data.map((d) => d.l);
  const highs = data.map((d) => d.h);
  const allVals = lines.flatMap((l) => l.vals.filter((v) => v != null));
  const min = Math.min(...lows, ...(allVals.length ? allVals : lows));
  const max = Math.max(...highs, ...(allVals.length ? allVals : highs));
  const span = max - min || 1;
  const yOf = (p) => padT + ((max - p) / span) * (H - padT - padB);
  const cw = W / data.length;
  const pts = (vals) => vals.map((v, k) => (v == null ? null : `${(k + 0.5) * cw},${yOf(v)}`)).filter(Boolean).join(" ");
  const up = data[data.length - 1].c >= data[0].o;
  const lineCol = up ? "var(--up)" : "var(--down)";

  return (
    <div>
      {toolbar}

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        {ctype === "line" ? (
          <polyline points={pts(data.map((d) => d.c))} fill="none" stroke={lineCol} strokeWidth="1.8" strokeLinejoin="round" />
        ) : (
          data.map((d, k) => {
            const x = (k + 0.5) * cw;
            const bull = d.c >= d.o;
            const col = bull ? "var(--up)" : "var(--down)";
            const yO = yOf(d.o), yC = yOf(d.c);
            return (
              <g key={k}>
                <line x1={x} y1={yOf(d.h)} x2={x} y2={yOf(d.l)} stroke={col} strokeWidth={Math.max(0.5, cw * 0.08)} />
                <rect x={x - cw * 0.32} y={Math.min(yO, yC)} width={Math.max(0.8, cw * 0.64)} height={Math.max(1, Math.abs(yC - yO))} fill={col} />
              </g>
            );
          })
        )}
        {lines.map((l) => (
          <polyline key={l.id} points={pts(l.vals)} fill="none" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash || undefined} opacity="0.95" />
        ))}
      </svg>

      {lines.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 7 }}>
          {lines.filter((l) => !l.id.endsWith("u") && !l.id.endsWith("l")).map((l) => (
            <span key={l.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>
              <span style={{ width: 10, height: 2, background: l.color, borderRadius: 2 }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {macd && (() => {
        const hs = macd.hist.filter((v) => v != null);
        const m = Math.max(...hs.map(Math.abs), 1e-6);
        const HH = 70, zero = HH / 2;
        const y = (v) => zero - (v / m) * (zero - 4);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>MACD (12, 26, 9)</div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH} preserveAspectRatio="none">
              <line x1="0" y1={zero} x2={W} y2={zero} stroke="var(--line)" strokeWidth="1" />
              {macd.hist.map((v, k) => (v == null ? null : (
                <rect
                  key={k}
                  x={(k + 0.5) * cw - cw * 0.3}
                  y={v >= 0 ? y(v) : zero}
                  width={Math.max(0.8, cw * 0.6)}
                  height={Math.max(0.8, Math.abs((v / m) * (zero - 4)))}
                  fill={v >= 0 ? "var(--up)" : "var(--down)"}
                  opacity="0.65"
                />
              )))}
              <polyline points={macd.line.map((v, k) => (v == null ? null : `${(k + 0.5) * cw},${y(v)}`)).filter(Boolean).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="1.4" />
              <polyline points={macd.signal.map((v, k) => (v == null ? null : `${(k + 0.5) * cw},${y(v)}`)).filter(Boolean).join(" ")} fill="none" stroke="#F59E0B" strokeWidth="1.4" />
            </svg>
          </div>
        );
      })()}

      {rsi && (() => {
        const HH = 64;
        const y = (v) => HH - (v / 100) * HH;
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>RSI (14)</div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH} preserveAspectRatio="none">
              <line x1="0" y1={y(70)} x2={W} y2={y(70)} stroke="var(--down)" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />
              <line x1="0" y1={y(30)} x2={W} y2={y(30)} stroke="var(--up)" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />
              <polyline points={rsi.map((v, k) => (v == null ? null : `${(k + 0.5) * cw},${y(v)}`)).filter(Boolean).join(" ")} fill="none" stroke="var(--primary-2)" strokeWidth="1.6" />
            </svg>
          </div>
        );
      })()}

      <IndicatorPanel
        open={picker}
        onClose={() => setPicker(false)}
        active={active}
        toggle={toggle}
        showMacd={showMacd} setShowMacd={setShowMacd}
        showRsi={showRsi} setShowRsi={setShowRsi}
      />
    </div>
  );
}
