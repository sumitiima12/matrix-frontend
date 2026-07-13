import React, { useEffect, useMemo, useRef, useState } from "react";
import { useScrollTransition } from "../hooks/useScrollTransition";
import { Activity, Bot, Building2, ChevronLeft, Newspaper, Plus, Sparkles, Star } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BACKEND_URL } from "../config";
import { clamp, compact, fmt, timeAgo } from "../lib/format";
import { marketOf } from "../domain/universe";
import { techSignal } from "../domain/signals";
import { fetchHistory, fetchNews } from "../domain/api";
import { analyzeStock } from "../services/aiService";
import BarBlock from "../components/common/BarBlock";
import Change from "../components/common/Change";
import ChartCard from "../components/common/ChartCard";
import Gauge from "../components/common/Gauge";
import Pop from "../components/common/Pop";
import ResearchVerdict from "../components/ai/ResearchVerdict";
import TagRow from "../components/common/TagRow";
import StatGrid from "../components/common/StatGrid";
import TextCard from "../components/common/TextCard";
import ChatPanel from "./AIAssistant";

/**
 * Stock detail — the research terminal for a single instrument.
 */

function CandleChart({ data, market, sup0, res0 }) {
  const [sup, setSup] = useState(sup0);
  const [res, setRes] = useState(res0);
  const drag = useRef(null);
  const box = useRef(null);
  const W = data.length * 11, H = 260, padT = 8, padB = 8;
  const lows = data.map((d) => d.l), highs = data.map((d) => d.h);
  const min = Math.min(...lows, sup, res) * 0.996;
  const max = Math.max(...highs, sup, res) * 1.004;
  const yOf = (p) => padT + (max - p) / (max - min) * (H - padT - padB);
  const priceAt = (clientY) => {
    const r = box.current.getBoundingClientRect();
    const frac = clamp((clientY - r.top) / r.height, 0, 1);
    return max - (frac * H - padT) / (H - padT - padB) * (max - min);
  };
  const down = (e) => {
    const p = priceAt(e.clientY);
    drag.current = Math.abs(p - sup) < Math.abs(p - res) ? "sup" : "res";
    box.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    const p = +priceAt(e.clientY).toFixed(2);
    drag.current === "sup" ? setSup(p) : setRes(p);
  };
  const up = () => { drag.current = null; };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Drag the gold & silver lines to set your levels</span>
        <span style={{ fontSize: 11, display: "flex", gap: 10 }}>
          <span className="gold-text" style={{ fontWeight: 800 }}>R {fmt(res, market)}</span>
          <span style={{ color: "#B7B7C2", fontWeight: 800 }}>S {fmt(sup, market)}</span>
        </span>
      </div>
      <div ref={box} style={{ width: "100%", touchAction: "none", cursor: "ns-resize" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
          {data.map((d, k) => {
            const x = (k + 0.5) * 11, isUp = d.c >= d.o;
            const col = isUp ? "var(--up)" : "var(--down)";
            const yO = yOf(d.o), yC = yOf(d.c);
            return (
              <g key={d.i}>
                <line x1={x} x2={x} y1={yOf(d.h)} y2={yOf(d.l)} stroke={col} strokeWidth="1.2" />
                <rect x={x - 3} y={Math.min(yO, yC)} width="6" height={Math.max(2, Math.abs(yC - yO))} fill={col} rx="1" />
              </g>
            );
          })}
          {/* resistance */}
          <line x1="0" x2={W} y1={yOf(res)} y2={yOf(res)} stroke="var(--amber)" strokeWidth="1.4" strokeDasharray="6 4" />
          <rect x={W - 26} y={yOf(res) - 7} width="26" height="14" rx="3" fill="var(--amber)" />
          {/* support */}
          <line x1="0" x2={W} y1={yOf(sup)} y2={yOf(sup)} stroke="var(--primary-2)" strokeWidth="1.4" strokeDasharray="6 4" />
          <rect x={W - 26} y={yOf(sup) - 7} width="26" height="14" rx="3" fill="var(--primary-2)" />
        </svg>
      </div>
    </div>
  );
}

export default function DetailPage({ s, onBack, watched, toggleWatch, onTrade, onBuy }) {
  const market = marketOf(s.sym);

  /* Netflix-style close: keep scrolling past the end of the page and it shrinks
     back into the carousel card it came from. `collapse` (0..1) drives the live
     transform, so the page visibly recedes as you pull rather than snapping. */
  const { progress: collapse } = useScrollTransition({ threshold: 130, onTrigger: onBack });
  const hStart = useRef(null);
  const [dDrag, setDDrag] = useState(0);
  const onHTS = (e) => { if ((window.scrollY || document.documentElement.scrollTop || 0) <= 2) hStart.current = e.touches[0].clientY; };
  const onHTM = (e) => { if (hStart.current == null) return; const d = e.touches[0].clientY - hStart.current; if (d > 0) setDDrag(d); };
  const onHTE = () => { const d = dDrag; setDDrag(0); hStart.current = null; if (d > 90) onBack && onBack(); };
  const [tf, setTf] = useState(60);
  const [active, setActive] = useState("overview");
  const [chartType, setChartType] = useState("candles");
  const [deepBusy, setDeepBusy] = useState(false);
  const [analysis, setAnalysis] = useState(null);   // structured research verdict
  const [liveNews, setLiveNews] = useState(null);
  const [liveCandles, setLiveCandles] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    let stop = false; setLiveNews(null); setLiveCandles(null);
    if (BACKEND_URL) {
      fetchNews(s.sym).then((n) => { if (!stop && n && n.length) setLiveNews(n); }).catch(() => {});
      fetchHistory(s.sym, "1d").then((d) => { if (!stop && d && d.length > 4) setLiveCandles(d); }).catch(() => {});
    }
    return () => { stop = true; };
  }, [s]);
  // REAL quarterly revenue & earnings, as reported (Yahoo). null -> section hides.
  const rev = useMemo(() => (s.quarters || []).map((q) => ({ q: q.q, v: q.rev })), [s]);
  const ebd = useMemo(() => (s.quarters || []).map((q) => ({ q: q.q, v: q.earn })).filter((x) => x.v != null), [s]);
  // REAL candles only — no synthetic fallback anywhere in the detail page.
  const cdata = useMemo(() => {
    const n = Math.round(tf / 1.8);
    return liveCandles && liveCandles.length ? liveCandles.slice(-n).map((c, i) => ({ ...c, i: i + 1 })) : [];
  }, [tf, liveCandles]);
  const data = useMemo(() => (liveCandles || []).slice(-tf).map((c, i) => ({ i, p: c.c })), [liveCandles, tf]);
  /* No "Fundamentals" tab. Yahoo's quoteSummary — the only source we had for P/E,
     ROE, margins and quarterly revenue — refuses requests from datacenter IPs
     (verified: "yahoo: auth failed" from Render). No data source, no feature.
     Deleted rather than left as an empty panel or filled with plausible numbers. */
  const tabs = [["overview", "Overview"], ["tech", "Technicals"], ["news", "News"], ["ask", "Ask Matrix"]];
  const n = (v, suf = "") => (v == null ? "n/a" : v + suf);
  const ctx = `Stock: ${s.name} (${s.sym}), market ${market}. Price ${fmt(s.price, market)} (${s.chg >= 0 ? "+" : ""}${s.chg}% today). REAL indicators — RSI ${n(s.rsi)}, MACD ${n(s.macd)} (signal ${n(s.macdSignal)}), ADX ${n(s.adx)}, ATR ${n(s.atr)}, 50-DMA ${n(s.sma50)}, 200-DMA ${n(s.sma200)}, support ${n(s.support)}, resistance ${n(s.resistance)}, 52w ${n(s.low52)}-${n(s.high52)}, volume ${n(s.vol)} vs 20d avg ${n(s.avgVol)}. Only use the figures given; if something is n/a, say so rather than guessing.`;

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.dataset.sec); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [s]);

  const jump = (k) => { const el = refs.current[k]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  // Structured research verdict. The LLM reasons; the ENGINE owns the levels.
  async function askDeep() {
    if (deepBusy) return;
    setDeepBusy(true); setAnalysis(null);
    try {
      const verdict = await analyzeStock(s, techSignal(s), market);
      setAnalysis(verdict);
    } finally { setDeepBusy(false); }
  }

  const secStyle = { scrollMarginTop: 118, marginTop: 34 };
  const Heading = ({ icon, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>{icon}{children}</div>
      <div className="gold-line" style={{ width: 44, marginTop: 7, borderRadius: 2 }} />
    </div>
  );


  const collapseStyle = collapse > 0 ? {
    transform: `scale(${1 - collapse * 0.12}) translateY(${collapse * -26}px)`,
    opacity: 1 - collapse * 0.35,
    transition: "none",
  } : { transition: "transform .28s cubic-bezier(.22,1,.36,1), opacity .28s ease" };

  return (
    <div
      className="mx fade"
      style={{
        paddingBottom: 40,
        transformOrigin: "50% 0%",
        ...(dDrag > 0
          ? { transform: `translateY(${dDrag}px)`, transition: "none" }
          : collapseStyle),
      }}
    >
      <div className="glass" onTouchStart={onHTS} onTouchMove={onHTM} onTouchEnd={onHTE} style={{ position: "sticky", top: 0, background: "var(--header-bg)", zIndex: 20, paddingTop: 6, paddingBottom: 8, touchAction: "pan-x" }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 8px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center" }}><ChevronLeft size={20} /></button>
          <div style={{ textAlign: "center" }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>{s.sym}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{s.name}</div>
          </div>
          <button onClick={() => toggleWatch(s.sym)} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center" }}>
            <Star size={18} fill={watched ? "var(--primary)" : "none"} color={watched ? "var(--primary)" : "var(--muted)"} />
          </button>
        </div>
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10 }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => jump(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 12.5, fontWeight: 700, border: "1px solid " + (active === k ? "var(--primary)" : "var(--line)"), background: active === k ? "var(--primary)" : "var(--surface)", color: active === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
        <span className="mono" style={{ fontWeight: 800, fontSize: 30 }}>{fmt(s.price, market)}</span>
        <Change v={s.chg} big />
      </div>

      {/* REAL technical tags — every one true, every one backed by a number.
          Hover/long-press a tag to see the evidence. */}
      <div style={{ marginTop: 10 }}>
        <TagRow s={s} max={6} size="md" />
      </div>

      {/* OVERVIEW */}
      <div data-sec="overview" ref={(el) => (refs.current.overview = el)} style={{ scrollMarginTop: 118, marginTop: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["candles", "Candles"], ["area", "Area"]].map(([k, l]) => (
              <button key={k} onClick={() => setChartType(k)} className="pill tap disp" style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 13px", border: "1px solid " + (chartType === k ? "var(--primary)" : "var(--line)"), background: chartType === k ? "var(--primary)" : "transparent", color: chartType === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {[[24, "1M"], [40, "3M"], [60, "6M"]].map(([n, l]) => (
                <button key={l} onClick={() => setTf(n)} className="pill tap" style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", border: "none", background: tf === n ? "var(--primary-soft)" : "transparent", color: tf === n ? "var(--primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
          </div>
          {chartType === "candles" ? (
            <CandleChart key={s.sym + tf} data={cdata} market={market} sup0={s.support} res0={s.resistance} />
          ) : (
            <div style={{ height: 244 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                  <defs><linearGradient id="big" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} stopOpacity={0.3} /><stop offset="100%" stopColor={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <YAxis domain={["dataMin", "dataMax"]} hide />
                  <Tooltip formatter={(v) => fmt(v, market)} labelFormatter={() => ""} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} itemStyle={{ color: "var(--ink)" }} />
                  <ReferenceLine y={s.support} stroke="#C9C9D4" strokeDasharray="4 4" />
                  <ReferenceLine y={s.resistance} stroke="#A99BFF" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="p" stroke={s.chg >= 0 ? "#0FB97D" : "#FF4D67"} strokeWidth={2.4} fill="url(#big)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card" style={{ marginTop: 12, padding: 16, background: "linear-gradient(160deg,var(--primary-soft),var(--surface))" }}>
          <div className="disp" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={16} color="var(--primary)" /> Matrix's analysis</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
            {s.rsi == null ? "Live technicals are still loading for this symbol." : <>Technically, RSI is <b>{s.rsi}</b> with price {s.sma50 != null ? (s.price > s.sma50 ? "above" : "below") : "—"} the 50-DMA{s.sma50 != null && s.sma200 != null ? (s.sma50 > s.sma200 ? " and a bullish 50/200 structure" : " and a bearish 50/200 structure") : ""}.</>}
          </p>
          <button onClick={askDeep} disabled={deepBusy} className="tap disp glow" style={{ width: "100%", marginTop: 14, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", border: "none", borderRadius: 14, padding: 12, fontWeight: 700, fontSize: 13.5, display: "flex", gap: 7, alignItems: "center", justifyContent: "center", opacity: deepBusy ? 0.7 : 1 }}>
            <Sparkles size={16} /> {deepBusy ? "Generating deep analysis…" : "Deep Analysis"}
          </button>
        </div>
        {(analysis || deepBusy) && (
          <div style={{ marginTop: 12 }}>
            {deepBusy && !analysis
              ? <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Analysing real technicals, fundamentals and levels…</div>
              : <ResearchVerdict a={analysis} market={market} />}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => onBuy && onBuy(s, 1)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--up),#12B98A)", color: "#fff", border: "none", borderRadius: 16, padding: 14, fontWeight: 800, fontSize: 14.5, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Plus size={17} /> Buy</button>
          <button onClick={() => onTrade(s)} className="tap disp" style={{ flex: 1, background: "var(--elev)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, fontWeight: 700, fontSize: 14.5 }}>Trade…</button>
        </div>
      </div>

      {/* TECHNICALS */}
      <div data-sec="tech" ref={(el) => (refs.current.tech = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Activity size={18} color="var(--primary)" />}>Technicals</Heading>
          {s.rsi != null ? (
            <Gauge value={clamp(
              50 + (s.rsi - 50) * 0.6
                 + (s.sma50 != null && s.price > s.sma50 ? 10 : -10)
                 + (s.sma50 != null && s.sma200 != null && s.sma50 > s.sma200 ? 8 : -8)
                 + (s.macd != null && s.macdSignal != null && s.macd > s.macdSignal ? 8 : -8)
                 + (s.adx != null && s.adx > 25 ? 6 : 0), 5, 96) | 0} label="Technical strength (live)" />
          ) : null}
          <StatGrid rows={[
            ["RSI (14)", s.rsi + (s.rsi > 70 ? " · overbought" : s.rsi < 30 ? " · oversold" : " · neutral")],
            ["MACD", (s.macd >= 0 ? "+" : "") + s.macd + (s.macd >= 0 ? " · bullish" : " · bearish")],
            ["50-DMA", fmt(s.sma50, market)], ["200-DMA", fmt(s.sma200, market)],
            ["Support", fmt(s.support, market)], ["Resistance", fmt(s.resistance, market)],
            ["Trend", s.sma50 > s.sma200 ? "Golden-cross zone" : "Below 200-DMA"],
          ]} />
          <TextCard title="Technical summary">
            Price is trading {s.price > s.sma50 ? "above" : "below"} its 50-DMA and {s.price > s.sma200 ? "above" : "below"} its 200-DMA. RSI at {s.rsi} signals {s.rsi > 70 ? "stretched, overbought conditions" : s.rsi < 30 ? "oversold, possible bounce" : "balanced momentum"}; MACD is {s.macd >= 0 ? "positive" : "negative"}. Watch {fmt(s.support, market)} as support and {fmt(s.resistance, market)} as resistance.
          </TextCard>
          <TextCard title="Matrix's summary" accent>{s.rsi > 70 ? "Momentum is hot but extended — avoid chasing; buy dips toward support." : s.rsi < 30 ? "Oversold setup — high-risk traders can scalp a bounce with tight stops." : "Constructive, non-extended setup — trend continuation favoured while support holds."}</TextCard>
        </Pop>
      </div>

      {/* NEWS — real headlines only (Yahoo / NewsAPI via the backend). */}
      <div data-sec="news" ref={(el) => (refs.current.news = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Newspaper size={18} color="var(--primary)" />}>News</Heading>
          {liveNews && liveNews.length ? liveNews.map((n, i) => (
            <a key={i} href={n.url || undefined} target="_blank" rel="noreferrer" className="card" style={{ display: "block", padding: 14, marginBottom: 10, textDecoration: "none", color: "inherit" }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{timeAgo(n.d)}{n.src ? " · " + n.src : ""}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{n.t}</div>
            </a>
          )) : (
            <div className="card" style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              {BACKEND_URL ? "No recent headlines for this symbol." : "Connect the backend to load live headlines."}
            </div>
          )}
        </Pop>
      </div>

      {/* ASK */}
      <div data-sec="ask" ref={(el) => (refs.current.ask = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Bot size={18} color="var(--primary)" />}>Ask Matrix</Heading>
          <div className="card" style={{ padding: 14, height: 460 }}>
            <ChatPanel context={ctx} stock={s} suggestions={["Should I buy right now?", "Support & resistance levels?", "Is this a good time to enter?", "Bull vs bear case?"]} />
          </div>
        </Pop>
      </div>

      {/* The gesture is invisible unless we say so — one quiet line, no chrome. */}
      <div
        style={{
          textAlign: "center",
          padding: "24px 0 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--muted)",
          opacity: 0.45 + collapse * 0.55,
          letterSpacing: ".02em",
        }}
      >
        {collapse > 0.15 ? "Release to close" : "Keep scrolling to close"}
      </div>
    </div>
  );
}

/* ============================== HOME ============================== */
