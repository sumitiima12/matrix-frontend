import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCandles } from "../../hooks/useCandles";
import { smaSeries, emaSeries, bollingerSeries, macdSeries, rsiSeries, heikinAshiSeries, vwapSeries, adxSeries, stochSeries, atrSeries, stdDevSeries, keltnerSeries, cprSeries, pivotSeries, ichimokuSeries, fibSeries, OVERLAYS, OVERLAY_COLORS } from "../../lib/indicators";
import { lsGet, lsSet } from "../../lib/format";
import ChartToolbar from "./ChartToolbar";
import IndicatorPanel from "./IndicatorPanel";

/**
 * ProChart — the stock detail chart.
 *
 * REAL candles at 5m / 15m / 30m / 1h / 1D, candle or line, with stackable overlays
 * (EMA/SMA sets, Bollinger) and MACD / RSI sub-panels.
 *
 * NEW HERE
 * --------
 *  - a TIME axis along the bottom (clock time on intraday, date on daily)
 *  - a PRICE axis down the right, on round numbers, with the last close called out
 *  - PINCH to zoom, DRAG to pan; the sub-panels track the same window
 *  - the CURRENT VALUE of every indicator, printed beside its name
 *
 * ONE SUBTLETY THAT MATTERS: indicators are computed on the FULL history and only
 * THEN sliced to the visible window. Computing them on the slice would leave a
 * 50-period EMA undefined for the first 50 bars you happen to be looking at, so the
 * line would visibly grow out of the left edge as you panned — the same warm-up
 * mistake that was under-counting backtest trades.
 */

const PREF_KEY = "mx_chart_prefs";
/* Overlays are now editable SPECS ({type,n,color}) instead of fixed preset ids, so a user can set
   an EMA to any length (like Automate's ⚙). MACD/RSI carry their own params too. */
const DEFAULT_PREFS = {
  overlays: [{ type: "ema", n: 21, color: "#EF4444" }, { type: "ema", n: 50, color: "#8B5CF6" }],
  macd: false, macdP: { fast: 12, slow: 26, signal: 9 },
  rsi: false, rsiN: 14,
  adx: false, adxN: 14,
  stoch: false, stochN: 14,
  atr: false, atrN: 14,
  sd: false, sdN: 20,
  vol: false, ctype: "candle",
};
/* Read prefs, migrating the OLD format (active: ["ema21", …]) to the new spec model. */
function readPrefs() {
  const raw = lsGet(PREF_KEY, {}) || {};
  const p = { ...DEFAULT_PREFS, ...raw };
  if (!Array.isArray(p.overlays)) {
    const ids = Array.isArray(raw.active) ? raw.active : [];
    const migrated = ids.map((id) => { const o = OVERLAYS.find((x) => x.id === id); return o ? { type: o.kind, n: o.n, color: o.color } : null; }).filter(Boolean);
    p.overlays = migrated.length ? migrated : DEFAULT_PREFS.overlays;
  }
  if (!p.macdP) p.macdP = { ...DEFAULT_PREFS.macdP };
  if (p.rsiN == null) p.rsiN = 14;
  if (p.adxN == null) p.adxN = 14;
  if (p.stochN == null) p.stochN = 14;
  if (p.atrN == null) p.atrN = 14;
  if (p.sdN == null) p.sdN = 20;
  return p;
}

const MIN_BARS = 15;      // furthest you can zoom in
const AXIS_W = 52;        // right-hand price gutter
const AXIS_H = 20;        // bottom time gutter

/** A candle's timestamp, at the granularity the timeframe deserves. */
function tickLabel(t, tf) {
  const d = new Date(t);
  const intraday = !["1d", "1D", "1wk", "1mo"].includes(tf);
  return intraday
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** Ticks on readable round numbers, not arbitrary fractions of the range. */
function priceTicks(min, max, count = 5) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const first = Math.ceil(min / step) * step;
  const out = [];
  for (let v = first; v <= max; v += step) out.push(v);
  return out.length ? out : [min, max];
}

const fmtPrice = (v) => {
  if (v == null || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 10000) return (v / 1000).toFixed(1) + "k";
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  return v.toFixed(3);
};

export default function ProChart({ sym, defaultTf = "1d", height = 240 }) {
  const saved = useMemo(() => readPrefs(), []);

  const [tf, setTf] = useState(defaultTf);
  const [ctype, setCtype] = useState(saved.ctype);
  const [overlays, setOverlays] = useState(saved.overlays);
  const [showMacd, setShowMacd] = useState(saved.macd);
  const [macdP, setMacdP] = useState(saved.macdP);
  const [showRsi, setShowRsi] = useState(saved.rsi);
  const [rsiN, setRsiN] = useState(saved.rsiN);
  const [showAdx, setShowAdx] = useState(saved.adx);
  const [adxN, setAdxN] = useState(saved.adxN);
  const [showStoch, setShowStoch] = useState(saved.stoch);
  const [stochN, setStochN] = useState(saved.stochN);
  const [showAtr, setShowAtr] = useState(saved.atr);
  const [atrN, setAtrN] = useState(saved.atrN);
  const [showSd, setShowSd] = useState(saved.sd);
  const [sdN, setSdN] = useState(saved.sdN);
  const [showVol, setShowVol] = useState(saved.vol);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    lsSet(PREF_KEY, { overlays, macd: showMacd, macdP, rsi: showRsi, rsiN, adx: showAdx, adxN, stoch: showStoch, stochN, atr: showAtr, atrN, sd: showSd, sdN, vol: showVol, ctype });
  }, [overlays, showMacd, macdP, showRsi, rsiN, showAdx, adxN, showStoch, stochN, showAtr, atrN, showSd, sdN, showVol, ctype]);

  const { data, loading, error } = useCandles(sym, tf);
  const closes = useMemo(() => (data ? data.map((c) => c.c) : []), [data]);
  const n = data ? data.length : 0;

  /* ── VIEWPORT ────────────────────────────────────────────────────────────── */
  const [view, setView] = useState(null);          // { start, count }

  useEffect(() => {
    if (!n) { setView(null); return; }
    const count = Math.min(n, 120);
    setView({ start: n - count, count });
  }, [n, sym, tf]);

  const clampView = useCallback((v) => {
    const count = Math.max(MIN_BARS, Math.min(n, Math.round(v.count)));
    const start = Math.max(0, Math.min(n - count, Math.round(v.start)));
    return { start, count };
  }, [n]);

  const svgRef = useRef(null);
  const gesture = useRef(null);

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e) => {
    if (!view) return;
    const t = e.touches;
    gesture.current = t.length >= 2
      ? { kind: "pinch", d0: dist(t), view: { ...view } }
      : { kind: "pan", x0: t[0].clientX, view: { ...view } };
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches;

    if (g.kind === "pinch" && t.length >= 2) {
      const factor = dist(t) / (g.d0 || 1);                 // fingers apart -> zoom in
      const count = g.view.count / factor;
      const anchor = g.view.start + g.view.count / 2;       // keep the middle bar put
      setView(clampView({ count, start: anchor - count / 2 }));
    } else if (g.kind === "pan" && t.length === 1) {
      const el = svgRef.current;
      const w = el ? el.clientWidth : 320;
      const barsPerPx = g.view.count / Math.max(1, w);
      const dx = t[0].clientX - g.x0;
      setView(clampView({ start: g.view.start - dx * barsPerPx, count: g.view.count }));
    }
  };

  const onTouchEnd = () => { gesture.current = null; };

  const onWheel = (e) => {
    if (!view) return;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const count = view.count / factor;
    const anchor = view.start + view.count / 2;
    setView(clampView({ count, start: anchor - count / 2 }));
  };

  /* ── INDICATORS on FULL history (proper warm-up), sliced only for drawing ── */
  const linesFull = useMemo(() => {
    if (!closes.length) return [];
    const out = [];
    overlays.forEach((o, i) => {
      const n = Math.max(1, Number(o.n) || 1);
      const key = `${o.type}${n}_${i}`;
      if (o.type === "ema") out.push({ id: key, color: o.color, label: `EMA ${n}`, vals: emaSeries(closes, n) });
      else if (o.type === "sma") out.push({ id: key, color: o.color, label: `SMA ${n}`, vals: smaSeries(closes, n) });
      else if (o.type === "vwap") out.push({ id: `vwap_${i}`, color: o.color, label: "VWAP", vals: vwapSeries(data || []) });
      else if (o.type === "bb") {
        const b = bollingerSeries(closes, n, Number(o.mult) || 2);
        out.push({ id: key + "u", color: o.color, label: `BB ${n} up`, vals: b.up, dash: "3 3" });
        out.push({ id: key + "m", color: o.color, label: `BB ${n} mid`, vals: b.mid });
        out.push({ id: key + "l", color: o.color, label: `BB ${n} low`, vals: b.lo, dash: "3 3" });
      } else if (o.type === "keltner") {
        const k = keltnerSeries(data || [], n, Number(o.mult) || 2);
        out.push({ id: key + "u", color: o.color, label: `Keltner up`, vals: k.up, dash: "4 3" });
        out.push({ id: key + "m", color: o.color, label: `Keltner mid`, vals: k.mid });
        out.push({ id: key + "l", color: o.color, label: `Keltner low`, vals: k.lo, dash: "4 3" });
      } else if (o.type === "cpr") {
        const c = cprSeries(data || []);
        out.push({ id: `cpr_tc_${i}`, color: o.color, label: "CPR TC", vals: c.tc, dash: "2 3" });
        out.push({ id: `cpr_p_${i}`, color: o.color, label: "CPR pivot", vals: c.pivot });
        out.push({ id: `cpr_bc_${i}`, color: o.color, label: "CPR BC", vals: c.bc, dash: "2 3" });
      } else if (o.type === "pivots") {
        const p = pivotSeries(data || []);
        out.push({ id: `pv_r2_${i}`, color: o.color, label: "R2", vals: p.R2, dash: "2 3" });
        out.push({ id: `pv_r1_${i}`, color: o.color, label: "R1", vals: p.R1, dash: "2 3" });
        out.push({ id: `pv_p_${i}`, color: o.color, label: "Pivot", vals: p.P });
        out.push({ id: `pv_s1_${i}`, color: o.color, label: "S1", vals: p.S1, dash: "2 3" });
        out.push({ id: `pv_s2_${i}`, color: o.color, label: "S2", vals: p.S2, dash: "2 3" });
      } else if (o.type === "ichimoku") {
        const ich = ichimokuSeries(data || []);
        out.push({ id: `ich_t_${i}`, color: "#EF4444", label: "Tenkan", vals: ich.tenkan });
        out.push({ id: `ich_k_${i}`, color: "#3B82F6", label: "Kijun", vals: ich.kijun });
        out.push({ id: `ich_a_${i}`, color: "#10B981", label: "Senkou A", vals: ich.senkouA, dash: "3 3" });
        out.push({ id: `ich_b_${i}`, color: "#F59E0B", label: "Senkou B", vals: ich.senkouB, dash: "3 3" });
      } else if (o.type === "fib") {
        const fib = fibSeries(data || [], Number(o.n) || 90);
        fib.forEach((lv, j) => out.push({ id: `fib_${i}_${j}`, color: o.color, label: `Fib ${(lv.ratio * 100).toFixed(1)}%`, vals: lv.vals, dash: j === 0 || j === fib.length - 1 ? undefined : "2 4" }));
      }
    });
    return out;
  }, [closes, overlays, data]);

  const macdFull = useMemo(() => (showMacd && closes.length ? macdSeries(closes, Number(macdP.fast) || 12, Number(macdP.slow) || 26, Number(macdP.signal) || 9) : null), [closes, showMacd, macdP]);
  const rsiFull = useMemo(() => (showRsi && closes.length ? rsiSeries(closes, Math.max(2, Number(rsiN) || 14)) : null), [closes, showRsi, rsiN]);
  const adxFull = useMemo(() => (showAdx && data ? adxSeries(data, Math.max(2, Number(adxN) || 14)) : null), [data, showAdx, adxN]);
  const stochFull = useMemo(() => (showStoch && data ? stochSeries(data, Math.max(2, Number(stochN) || 14)) : null), [data, showStoch, stochN]);
  const atrFull = useMemo(() => (showAtr && data ? atrSeries(data, Math.max(2, Number(atrN) || 14)) : null), [data, showAtr, atrN]);
  const sdFull = useMemo(() => (showSd && closes.length ? stdDevSeries(closes, Math.max(2, Number(sdN) || 20)) : null), [closes, showSd, sdN]);
  // Heikin-Ashi candles (computed on FULL history so the smoothing recursion is correct, then
  // sliced to the window just like the real candles). Only when that candle type is selected.
  const haFull = useMemo(() => (ctype === "heikin" && data ? heikinAshiSeries(data) : null), [data, ctype]);

  const activeCount = overlays.length + (showMacd ? 1 : 0) + (showRsi ? 1 : 0) + (showAdx ? 1 : 0) + (showStoch ? 1 : 0) + (showAtr ? 1 : 0) + (showSd ? 1 : 0) + (showVol ? 1 : 0);

  const toolbar = (
    <ChartToolbar
      tf={tf} setTf={setTf}
      ctype={ctype} setCtype={setCtype}
      onOpenIndicators={() => setPicker(true)}
      activeCount={activeCount}
    />
  );

  if (loading) {
    return <div>{toolbar}<div style={{ height, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Bringing it up…</div></div>;
  }
  if (!data || data.length < 3 || !view) {
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

  /* ── GEOMETRY over the visible window ────────────────────────────────────── */
  const { start, count } = view;
  const vis = data.slice(start, start + count);
  // What we DRAW as candles: Heikin-Ashi (smoothed) or the real candles. Line mode / the OHLC
  // header / overlays stay on the REAL prices — HA only changes the candle bodies.
  const drawn = ctype === "heikin" && haFull ? haFull.slice(start, start + count) : vis;
  const sliceOf = (arr) => (arr || []).slice(start, start + count);
  const atCursor = (arr) => {
    const v = (arr || [])[start + count - 1];
    return v == null || Number.isNaN(v) ? null : v;
  };

  const W = 700, H = height, padT = 10, padB = 10;
  const plotW = W - AXIS_W;
  const plotH = H - padT - padB;

  const lines = linesFull.map((l) => ({ ...l, vals: sliceOf(l.vals) }));

  const lows = drawn.map((d) => d.l);
  const highs = drawn.map((d) => d.h);
  const ov = lines.flatMap((l) => l.vals.filter((v) => v != null && !Number.isNaN(v)));
  const min = Math.min(...lows, ...(ov.length ? ov : lows));
  const max = Math.max(...highs, ...(ov.length ? ov : highs));
  const span = max - min || 1;

  const yOf = (p) => padT + ((max - p) / span) * plotH;
  const cw = plotW / vis.length;
  const poly = (vals, yFn) => vals
    .map((v, k) => (v == null || Number.isNaN(v) ? null : `${(k + 0.5) * cw},${yFn(v)}`))
    .filter(Boolean).join(" ");

  const last = vis[vis.length - 1];
  const up = last.c >= vis[0].o;
  const lineCol = up ? "var(--up)" : "var(--down)";

  const yTicks = priceTicks(min, max, 5);
  const every = Math.max(1, Math.floor(vis.length / 5));
  const xTicks = vis.map((d, i) => ({ d, i })).filter(({ i }) => i % every === 0);

  return (
    <div>
      {toolbar}

      {/* OHLC of the latest visible candle */}
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", fontSize: 10.5, color: "var(--muted)", fontWeight: 700, margin: "2px 2px 6px" }}>
        <span>O <span className="mono" style={{ color: "var(--ink)" }}>{fmtPrice(last.o)}</span></span>
        <span>H <span className="mono" style={{ color: "var(--ink)" }}>{fmtPrice(last.h)}</span></span>
        <span>L <span className="mono" style={{ color: "var(--ink)" }}>{fmtPrice(last.l)}</span></span>
        <span>C <span className="mono" style={{ color: lineCol }}>{fmtPrice(last.c)}</span></span>
        <span className="mono" style={{ marginLeft: "auto" }}>{vis.length} bars</span>
      </div>

      <div
        ref={svgRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        style={{ touchAction: "none", userSelect: "none", cursor: "grab" }}
      >
        <svg viewBox={`0 0 ${W} ${H + AXIS_H}`} width="100%" height={H + AXIS_H}>
          {/* gridlines + PRICE AXIS on the right */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1="0" y1={yOf(v)} x2={plotW} y2={yOf(v)} stroke="var(--line)" strokeWidth="0.6" opacity="0.55" />
              <text x={plotW + 6} y={yOf(v) + 3.5} fontSize="10" fill="var(--muted)" fontWeight="600">{fmtPrice(v)}</text>
            </g>
          ))}

          {/* TIME AXIS along the bottom */}
          {xTicks.map(({ d, i }) => (
            <text key={i} x={(i + 0.5) * cw} y={H + 13} fontSize="9.5" fill="var(--muted)" fontWeight="600" textAnchor="middle">
              {tickLabel(d.t, tf)}
            </text>
          ))}

          {/* last close, called out on the axis */}
          <line x1="0" y1={yOf(last.c)} x2={plotW} y2={yOf(last.c)} stroke={lineCol} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
          <rect x={plotW + 2} y={yOf(last.c) - 8} width={AXIS_W - 4} height="16" rx="3" fill={lineCol} />
          <text x={plotW + AXIS_W / 2} y={yOf(last.c) + 3.5} fontSize="9.5" fill="#fff" fontWeight="800" textAnchor="middle">{fmtPrice(last.c)}</text>

          {ctype === "line" ? (
            <polyline points={poly(vis.map((d) => d.c), yOf)} fill="none" stroke={lineCol} strokeWidth="1.8" strokeLinejoin="round" />
          ) : (
            drawn.map((d, k) => {
              const x = (k + 0.5) * cw;
              const col = d.c >= d.o ? "var(--up)" : "var(--down)";
              const yO = yOf(d.o), yC = yOf(d.c);
              return (
                <g key={k}>
                  <line x1={x} y1={yOf(d.h)} x2={x} y2={yOf(d.l)} stroke={col} strokeWidth={Math.max(0.5, cw * 0.12)} />
                  <rect x={x - cw * 0.32} y={Math.min(yO, yC)} width={Math.max(0.8, cw * 0.64)} height={Math.max(1, Math.abs(yC - yO))} fill={col} />
                </g>
              );
            })
          )}

          {lines.map((l) => (
            <polyline key={l.id} points={poly(l.vals, yOf)} fill="none" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash || undefined} opacity="0.95" />
          ))}
        </svg>
      </div>

      {/* legend WITH CURRENT VALUES */}
      {linesFull.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 7 }}>
          {linesFull.filter((l) => !l.id.endsWith("u") && !l.id.endsWith("l")).map((l) => (
            <span key={l.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>
              <span style={{ width: 10, height: 2, background: l.color, borderRadius: 2 }} />
              {l.label}
              <span className="mono" style={{ color: "var(--ink)" }}>{fmtPrice(atCursor(l.vals))}</span>
            </span>
          ))}
        </div>
      )}

      {macdFull && (() => {
        const hist = sliceOf(macdFull.hist);
        const lv = sliceOf(macdFull.line);
        const sv = sliceOf(macdFull.signal);
        const hs = hist.filter((v) => v != null && !Number.isNaN(v));
        if (!hs.length) return null;
        const m = Math.max(...hs.map(Math.abs), 1e-6);
        const HH = 70, zero = HH / 2;
        const y = (v) => zero - (v / m) * (zero - 4);
        const cH = atCursor(macdFull.hist), cL = atCursor(macdFull.line), cS = atCursor(macdFull.signal);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 9, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3, flexWrap: "wrap" }}>
              <span>MACD <span className="mono" style={{ color: "var(--primary)" }}>{cL == null ? "—" : cL.toFixed(2)}</span></span>
              <span>signal <span className="mono" style={{ color: "var(--amber)" }}>{cS == null ? "—" : cS.toFixed(2)}</span></span>
              <span>hist <span className="mono" style={{ color: cH == null ? "var(--muted)" : cH >= 0 ? "var(--up)" : "var(--down)" }}>{cH == null ? "—" : cH.toFixed(2)}</span></span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              <line x1="0" y1={zero} x2={plotW} y2={zero} stroke="var(--line)" strokeWidth="0.7" />
              {hist.map((v, k) => {
                if (v == null || Number.isNaN(v)) return null;
                const x = (k + 0.5) * cw, yy = y(v);
                return <rect key={k} x={x - cw * 0.3} y={Math.min(zero, yy)} width={Math.max(0.8, cw * 0.6)} height={Math.max(0.6, Math.abs(zero - yy))} fill={v >= 0 ? "var(--up)" : "var(--down)"} opacity="0.75" />;
              })}
              <polyline points={poly(lv, y)} fill="none" stroke="var(--primary)" strokeWidth="1.3" />
              <polyline points={poly(sv, y)} fill="none" stroke="var(--amber)" strokeWidth="1.3" />
            </svg>
          </div>
        );
      })()}

      {rsiFull && (() => {
        const vals = sliceOf(rsiFull);
        const HH = 66;
        const y = (v) => HH - 4 - (v / 100) * (HH - 8);
        const cur = atCursor(rsiFull);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>
              <span>RSI {rsiN}</span>
              <span className="mono" style={{ color: cur == null ? "var(--muted)" : cur >= 70 ? "var(--down)" : cur <= 30 ? "var(--up)" : "var(--ink)" }}>
                {cur == null ? "—" : cur.toFixed(1)}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              {[30, 50, 70].map((l) => (
                <g key={l}>
                  <line x1="0" y1={y(l)} x2={plotW} y2={y(l)} stroke="var(--line)" strokeWidth="0.6" strokeDasharray={l === 50 ? undefined : "3 3"} opacity="0.7" />
                  <text x={plotW + 6} y={y(l) + 3} fontSize="9" fill="var(--muted)" fontWeight="600">{l}</text>
                </g>
              ))}
              <polyline points={poly(vals, y)} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
            </svg>
          </div>
        );
      })()}

      {adxFull && (() => {
        const av = sliceOf(adxFull.adx);
        const pv = sliceOf(adxFull.pdi);
        const mv = sliceOf(adxFull.mdi);
        if (!av.some((v) => v != null)) return null;
        const HH = 66;
        const y = (v) => HH - 4 - (Math.min(100, v) / 100) * (HH - 8);
        const cur = atCursor(adxFull.adx);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 9, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3, flexWrap: "wrap" }}>
              <span>ADX {adxN} <span className="mono" style={{ color: cur == null ? "var(--muted)" : cur >= 25 ? "var(--primary)" : "var(--ink)" }}>{cur == null ? "—" : cur.toFixed(1)}</span></span>
              <span>+DI <span className="mono" style={{ color: "var(--up)" }}>{atCursor(adxFull.pdi) == null ? "—" : atCursor(adxFull.pdi).toFixed(1)}</span></span>
              <span>−DI <span className="mono" style={{ color: "var(--down)" }}>{atCursor(adxFull.mdi) == null ? "—" : atCursor(adxFull.mdi).toFixed(1)}</span></span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              {[25, 50].map((l) => (
                <g key={l}>
                  <line x1="0" y1={y(l)} x2={plotW} y2={y(l)} stroke="var(--line)" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.7" />
                  <text x={plotW + 6} y={y(l) + 3} fontSize="9" fill="var(--muted)" fontWeight="600">{l}</text>
                </g>
              ))}
              <polyline points={poly(pv, y)} fill="none" stroke="var(--up)" strokeWidth="1.2" opacity="0.8" />
              <polyline points={poly(mv, y)} fill="none" stroke="var(--down)" strokeWidth="1.2" opacity="0.8" />
              <polyline points={poly(av, y)} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
            </svg>
          </div>
        );
      })()}

      {stochFull && (() => {
        const kv = sliceOf(stochFull.k);
        const dv = sliceOf(stochFull.d);
        if (!kv.some((v) => v != null)) return null;
        const HH = 66;
        const y = (v) => HH - 4 - (v / 100) * (HH - 8);
        const cur = atCursor(stochFull.k);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 9, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>
              <span>Stoch {stochN} %K <span className="mono" style={{ color: cur == null ? "var(--muted)" : cur >= 80 ? "var(--down)" : cur <= 20 ? "var(--up)" : "var(--ink)" }}>{cur == null ? "—" : cur.toFixed(1)}</span></span>
              <span>%D <span className="mono" style={{ color: "var(--amber)" }}>{atCursor(stochFull.d) == null ? "—" : atCursor(stochFull.d).toFixed(1)}</span></span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              {[20, 50, 80].map((l) => (
                <g key={l}>
                  <line x1="0" y1={y(l)} x2={plotW} y2={y(l)} stroke="var(--line)" strokeWidth="0.6" strokeDasharray={l === 50 ? undefined : "3 3"} opacity="0.7" />
                  <text x={plotW + 6} y={y(l) + 3} fontSize="9" fill="var(--muted)" fontWeight="600">{l}</text>
                </g>
              ))}
              <polyline points={poly(kv, y)} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
              <polyline points={poly(dv, y)} fill="none" stroke="var(--amber)" strokeWidth="1.3" />
            </svg>
          </div>
        );
      })()}

      {(atrFull || sdFull) && [["ATR", atrFull, atrN], ["Std dev", sdFull, sdN]].filter(([, f]) => f).map(([label, arr, len]) => {
        const vals = sliceOf(arr);
        const hs = vals.filter((v) => v != null && !Number.isNaN(v));
        if (!hs.length) return null;
        const HH = 60, mx = Math.max(...hs), mn = Math.min(...hs), rng = (mx - mn) || 1;
        const y = (v) => HH - 4 - ((v - mn) / rng) * (HH - 8);
        const cur = atCursor(arr);
        return (
          <div key={label} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>
              <span>{label} {len}</span>
              <span className="mono" style={{ color: "var(--ink)" }}>{cur == null ? "—" : fmtPrice(cur)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              <polyline points={poly(vals, y)} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
            </svg>
          </div>
        );
      })}

      {showVol && (() => {
        const vols = vis.map((d) => d.v || 0);
        const maxV = Math.max(...vols, 1);
        const HH = 56;
        const cur = vols[vols.length - 1];
        const fmtVol = (v) => (v >= 1e7 ? (v / 1e7).toFixed(1) + "Cr" : v >= 1e5 ? (v / 1e5).toFixed(1) + "L" : v >= 1e3 ? (v / 1e3).toFixed(1) + "k" : String(Math.round(v)));
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>
              <span>Volume</span>
              <span className="mono" style={{ color: "var(--ink)" }}>{fmtVol(cur)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${HH}`} width="100%" height={HH}>
              {vis.map((d, k) => {
                const h = (vols[k] / maxV) * (HH - 6);
                const x = (k + 0.5) * cw;
                const col = d.c >= d.o ? "var(--up)" : "var(--down)";
                return <rect key={k} x={x - cw * 0.3} y={HH - Math.max(0.6, h)} width={Math.max(0.8, cw * 0.6)} height={Math.max(0.6, h)} fill={col} opacity="0.5" />;
              })}
            </svg>
          </div>
        );
      })()}

      <div style={{ fontSize: 9.5, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
        Pinch to zoom · drag to pan
      </div>

      {picker && (
        <IndicatorPanel
          overlays={overlays} setOverlays={setOverlays}
          ctype={ctype} setCtype={setCtype}
          showMacd={showMacd} setShowMacd={setShowMacd} macdP={macdP} setMacdP={setMacdP}
          showRsi={showRsi} setShowRsi={setShowRsi} rsiN={rsiN} setRsiN={setRsiN}
          showAdx={showAdx} setShowAdx={setShowAdx} adxN={adxN} setAdxN={setAdxN}
          showStoch={showStoch} setShowStoch={setShowStoch} stochN={stochN} setStochN={setStochN}
          showAtr={showAtr} setShowAtr={setShowAtr} atrN={atrN} setAtrN={setAtrN}
          showSd={showSd} setShowSd={setShowSd} sdN={sdN} setSdN={setSdN}
          showVol={showVol} setShowVol={setShowVol}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}
