import React, { useEffect, useMemo, useRef, useState } from "react";
import { useScrollTransition } from "../hooks/useScrollTransition";
import { Activity, Building2, ChevronLeft, Newspaper, Plus, Sparkles, Star } from "lucide-react";
import NeoIcon from "../components/common/NeoIcon";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { BACKEND_URL } from "../config";
import { clamp, compact, fmt, timeAgo } from "../lib/format";
import { marketOf } from "../domain/universe";
import { techSignal, techStrength } from "../domain/signals";
import { fundamentalRead, technicalRead } from "../domain/analysisFramework";
import { detectPattern, patternLine } from "../domain/patterns";
import { strengthFromCandles, STRENGTH_TFS } from "../domain/strength";
import { fetchHistory, fetchNews, fetchFundamentals } from "../domain/api";
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

function CandleChart({ data, market }) {
  const W = data.length * 11, H = 260, padT = 8, padB = 8;
  const RIGHT = 52;   // px gutter for the price axis
  const lows = data.map((d) => d.l), highs = data.map((d) => d.h);
  const min = Math.min(...lows) * 0.998;
  const max = Math.max(...highs) * 1.002;
  const span = (max - min) || 1;
  const yOf = (p) => padT + (max - p) / span * (H - padT - padB);
  if (!data.length) return null;

  // 5 evenly-spaced price gridlines / axis labels, top (max) to bottom (min).
  const TICKS = 5;
  const priceTicks = Array.from({ length: TICKS }, (_, i) => max - (span * i) / (TICKS - 1));
  const fmtD = (t) => { try { return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return ""; } };
  const hasT = data[0] && data[0].t;
  const midI = Math.floor(data.length / 2);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* price chart */}
        <div style={{ flex: 1, position: "relative", height: H, minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
            {priceTicks.map((p, i) => (
              <line key={"g" + i} x1="0" x2={W} y1={yOf(p)} y2={yOf(p)} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 5" />
            ))}
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
          </svg>
        </div>
        {/* right price axis — real price scale */}
        <div style={{ position: "relative", width: RIGHT, height: H, flex: "0 0 auto" }}>
          {priceTicks.map((p, i) => (
            <div key={"p" + i} className="mono" style={{ position: "absolute", right: 2, top: yOf(p), transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmt(p, market)}</div>
          ))}
        </div>
      </div>
      {/* bottom date axis — aligned under the chart, not the price gutter */}
      {hasT && (
        <div style={{ display: "flex", justifyContent: "space-between", marginRight: RIGHT, marginTop: 5, fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>
          <span>{fmtD(data[0].t)}</span>
          <span>{fmtD(data[midI].t)}</span>
          <span>{fmtD(data[data.length - 1].t)}</span>
        </div>
      )}
    </div>
  );
}

export default function DetailPage({ s, onBack, watched, toggleWatch, onTrade, onBuy, canBuy }) {
  const showBuy = !canBuy || canBuy(s.sym);
  const market = marketOf(s.sym);

  /* Netflix-style close: keep scrolling past the end of the page and it shrinks
     back into the carousel card it came from. `collapse` (0..1) drives the live
     transform, so the page visibly recedes as you pull rather than snapping. */
  /* Scroll-to-close gesture DISABLED: reaching the end of the page was minimising it
     back to the carousel, which read as the page "vanishing". The header back button
     is the deliberate way out now. Kept the hook wired (enabled:false) so `collapse`
     stays 0 and the layout is otherwise untouched. */
  const { progress: collapse } = useScrollTransition({ threshold: 130, onTrigger: onBack, enabled: false });
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
  const [strengthTf, setStrengthTf] = useState("5m");
  const [tfStrength, setTfStrength] = useState(null);
  const [tfLoading, setTfLoading] = useState(false);
  const [liveNews, setLiveNews] = useState(null);

  /* Pull the candles for whichever timeframe is selected and recompute the indicators from
     them. "1d" is excluded — it uses the verdict's own score, so the gauge and the
     Buy/Hold/Sell call cannot disagree. */
  useEffect(() => {
    if (strengthTf === "1d") { setTfStrength(null); return undefined; }
    let stop = false;
    setTfLoading(true);
    setTfStrength(null);
    fetchHistory(s.sym, strengthTf)
      .then((c) => { if (!stop) setTfStrength(strengthFromCandles(c)); })
      .catch(() => { if (!stop) setTfStrength(null); })
      .finally(() => { if (!stop) setTfLoading(false); });
    return () => { stop = true; };
  }, [s.sym, strengthTf]);
  const [liveCandles, setLiveCandles] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    let stop = false; setLiveNews(null); setLiveCandles(null);
    if (BACKEND_URL) {
      fetchNews(s.sym, s.name).then((n) => { if (!stop && n && n.length) setLiveNews(n); }).catch(() => {});
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
  // Real chart-pattern recognition from the live candles (Double Bottom, Bull Flag, H&S, …).
  const pattern = useMemo(() => detectPattern(liveCandles), [liveCandles]);
  // Framework-based reads (Zerodha/Oliver TA + FA): a multi-factor technical read and a
  // ratio-by-ratio fundamental verdict, both derived purely from the real values on hand.
  const techRead = useMemo(() => technicalRead(s, techSignal(s)), [s]);
  const TONE_C = { good: "var(--up)", bad: "var(--down)", warn: "var(--amber, #F59E42)", neutral: "var(--muted)" };
  /* No "Fundamentals" tab. Yahoo's quoteSummary — the only source we had for P/E,
     ROE, margins and quarterly revenue — refuses requests from datacenter IPs
     (verified: "yahoo: auth failed" from Render). No data source, no feature.
     Deleted rather than left as an empty panel or filled with plausible numbers. */
  const tabs = [["overview", "Overview"], ["tech", "Technicals"], ["news", "News"], ["ask", "Ask Neo"]];
  const n = (v, suf = "") => (v == null ? "n/a" : v + suf);
  const ctx = `Stock: ${s.name} (${s.sym}), market ${market}. Price ${fmt(s.price, market)} (${s.chg >= 0 ? "+" : ""}${s.chg}% today). REAL indicators — RSI ${n(s.rsi)}, MACD ${n(s.macd)} (signal ${n(s.macdSignal)}), ADX ${n(s.adx)}, ATR ${n(s.atr)}, 50-DMA ${n(s.sma50)}, 200-DMA ${n(s.sma200)}, support ${n(s.support)}, resistance ${n(s.resistance)}, 52w ${n(s.low52)}-${n(s.high52)}, volume ${n(s.vol)} vs 20d avg ${n(s.avgVol)}. Only use the figures given; if something is n/a, say so rather than guessing.`;

  // REAL fundamentals (Yahoo quoteSummary via backend). Crypto has none -> unavailable.
  const [fund, setFund] = useState(null);
  // Framework fundamental read — declared AFTER `fund` exists (referencing it earlier is a TDZ crash).
  const fundRead = useMemo(() => fundamentalRead(fund && !fund.unavailable ? fund : null), [fund]);
  useEffect(() => {
    let alive = true; setFund(null);
    if (market === "Crypto") { setFund({ unavailable: true }); return; }
    fetchFundamentals(s.sym).then((f) => { if (alive) setFund(f); }).catch(() => { if (alive) setFund({ unavailable: true }); });
    return () => { alive = false; };
  }, [s.sym, market]);

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
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sym}</div>
            {/* Price stays visible in the sticky header while you scroll the page. */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "center", marginTop: 1 }}>
              <span className="mono" style={{ fontWeight: 800, fontSize: 12.5 }}>{fmt(s.price, market)}</span>
              <Change v={s.chg} />
            </div>
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
            <CandleChart key={s.sym + tf} data={cdata} market={market} />
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
          <div className="disp" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={16} color="var(--primary)" /> Analysis</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
            {s.rsi == null ? "Live technicals are still loading for this symbol." : <>Technically, RSI is <b>{s.rsi}</b> with price {s.sma50 != null ? (s.price > s.sma50 ? "above" : "below") : "—"} the 50-DMA{s.sma50 != null && s.sma200 != null ? (s.sma50 > s.sma200 ? " and a bullish 50/200 structure" : " and a bearish 50/200 structure") : ""}.</>}
          </p>
          {pattern && <p style={{ fontSize: 12.5, fontWeight: 700, margin: "6px 0 0", color: pattern.dir === "bull" ? "var(--up)" : pattern.dir === "bear" ? "var(--down)" : "var(--muted)" }}>◆ {patternLine(pattern, (v) => fmt(v, market))}</p>}
          {/* Framework technical read — trend → momentum → volume → levels, each interpreted. */}
          {techRead && techRead.rows.length > 0 && (
            <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
              {techRead.rows.map((r) => (
                <div key={r.k} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
                  <span style={{ flex: "0 0 76px", color: "var(--muted)", fontWeight: 700 }}>{r.k}</span>
                  <span className="mono" style={{ flex: "0 0 auto", fontWeight: 800, color: TONE_C[r.tone] }}>{r.v}</span>
                  <span style={{ color: "var(--ink)", lineHeight: 1.4 }}>{r.read}</span>
                </div>
              ))}
            </div>
          )}
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
          {showBuy && <button onClick={() => onBuy && onBuy(s, 1)} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--up),#12B98A)", color: "#fff", border: "none", borderRadius: 16, padding: 14, fontWeight: 800, fontSize: 14.5, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}><Plus size={17} /> Buy</button>}
          <button onClick={() => onTrade(s)} className="tap disp" style={{ flex: 1, background: "var(--elev)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, fontWeight: 700, fontSize: 14.5 }}>Trade…</button>
        </div>

        {/* FUNDAMENTALS — real Yahoo quoteSummary. Only for equities; crypto has none. */}
        {market !== "Crypto" && (
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <div className="disp" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Building2 size={16} color="var(--primary)" /> Fundamentals</div>
            {fund == null ? (
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>Loading fundamentals…</div>
            ) : fund.unavailable ? (
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>Fundamentals aren’t available for this symbol right now.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {[
                    ["Market cap", fund.marketCap != null ? compact(fund.marketCap) : "—"],
                    ["P/E (TTM)", fund.peTrailing != null ? fund.peTrailing.toFixed(1) : "—"],
                    ["P/E (fwd)", fund.peForward != null ? fund.peForward.toFixed(1) : "—"],
                    ["P/B", fund.pb != null ? fund.pb.toFixed(1) : "—"],
                    ["EPS", fund.eps != null ? fund.eps.toFixed(2) : "—"],
                    ["ROE", fund.roe != null ? (fund.roe * 100).toFixed(1) + "%" : "—"],
                    ["Profit margin", fund.profitMargin != null ? (fund.profitMargin * 100).toFixed(1) + "%" : "—"],
                    ["Rev growth (yoy)", fund.revenueGrowth != null ? (fund.revenueGrowth * 100).toFixed(1) + "%" : "—"],
                    ["Debt / equity", fund.debtToEquity != null ? fund.debtToEquity.toFixed(0) : "—"],
                    ["Div yield", fund.dividendYield != null ? (fund.dividendYield * 100).toFixed(2) + "%" : "—"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, borderBottom: "1px solid var(--line)", paddingBottom: 4 }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span><span className="mono" style={{ fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                {(fund.sector || fund.industry) && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>{[fund.sector, fund.industry].filter(Boolean).join(" · ")}</div>
                )}
                {/* Framework fundamental read — verdict + a plain-English interpretation of each ratio. */}
                {fundRead && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{fundRead.verdict}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: fundRead.score >= 55 ? "var(--up)" : fundRead.score >= 40 ? "var(--amber, #F59E42)" : "var(--down)", background: "var(--elev)", borderRadius: 20, padding: "2px 9px" }}>{fundRead.score}/100</span>
                    </div>
                    {/* Fundamental-strength dial — the same gauge the Technicals section uses, so both
                        halves of the analysis read at a glance. */}
                    {fundRead.score != null && <Gauge value={fundRead.score} label="Fundamental strength" />}
                    <div style={{ display: "grid", gap: 7 }}>
                      {fundRead.rows.map((r) => (
                        <div key={r.k} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
                          <span style={{ flex: "0 0 96px", color: "var(--muted)", fontWeight: 700 }}>{r.k}</span>
                          <span className="mono" style={{ flex: "0 0 auto", fontWeight: 800, color: TONE_C[r.tone] }}>{r.v}</span>
                          <span style={{ color: "var(--ink)", lineHeight: 1.4 }}>{r.read}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Peer comparison — competitors from the fundamentals source. Ratios can be sparse,
                    so we show P/E only where real; the stock's own P/E leads for context. */}
                {Array.isArray(fund.peers) && fund.peers.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 8 }}>Peers</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--muted)", fontWeight: 800 }}>
                        <span style={{ flex: 1 }}>COMPANY</span><span style={{ flex: "0 0 54px", textAlign: "right" }}>P/E</span><span style={{ flex: "0 0 58px", textAlign: "right" }}>CHG</span>
                      </div>
                      {[{ name: fund.name + " (this)", pe: fund.peTrailing, chg: s.chg, self: true }, ...fund.peers].slice(0, 7).map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11.5, fontWeight: p.self ? 800 : 500 }}>
                          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: p.self ? "var(--primary)" : "var(--ink)" }}>{p.name}</span>
                          <span className="mono" style={{ flex: "0 0 54px", textAlign: "right" }}>{p.pe != null ? (+p.pe).toFixed(1) : "—"}</span>
                          <span className="mono" style={{ flex: "0 0 58px", textAlign: "right", color: p.chg == null ? "var(--muted)" : p.chg >= 0 ? "var(--up)" : "var(--down)" }}>{p.chg == null ? "—" : (p.chg >= 0 ? "+" : "") + (+p.chg).toFixed(2) + "%"}</span>
                        </div>
                      ))}
                    </div>
                    {fund.sectorPE != null && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Sector P/E: {(+fund.sectorPE).toFixed(1)}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* TECHNICALS */}
      <div data-sec="tech" ref={(el) => (refs.current.tech = el)} style={secStyle}>
        <Pop>
          <Heading icon={<Activity size={18} color="var(--primary)" />}>Technicals</Heading>
          {/* TIMEFRAME CHIPS. Each one recomputes the indicators from THAT timeframe's
              candles — a daily RSI tells you nothing about the last 30 minutes. "1d" uses
              the verdict's own score, so the gauge and the Buy/Hold/Sell call agree. */}
          <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 4 }}>
            {STRENGTH_TFS.map((t) => (
              <button
                key={t}
                onClick={() => setStrengthTf(t)}
                className="pill tap disp"
                style={{
                  flex: "0 0 auto", padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  border: "1px solid " + (strengthTf === t ? "var(--primary)" : "var(--line)"),
                  background: strengthTf === t ? "var(--primary)" : "var(--surface)",
                  color: strengthTf === t ? "#fff" : "var(--ink)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {strengthTf === "1d" ? (
            s.rsi != null ? <Gauge value={techStrength(s) ?? 50} label="Technical strength · 1d" /> : null
          ) : tfLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Loading {strengthTf} candles…
            </div>
          ) : tfStrength ? (
            <>
              <Gauge value={tfStrength.value} label={`Technical strength · ${strengthTf}`} />
              <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: -4 }}>
                RSI {tfStrength.rsi} · MACD {tfStrength.macd ?? "—"} · from {tfStrength.bars} real {strengthTf} candles
              </div>
            </>
          ) : (
            /* Not enough bars to warm RSI(14)/MACD(26) up. Showing a number computed from
               twelve candles and calling it an RSI would be worse than showing nothing. */
            <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>
              Not enough {strengthTf} history to compute indicators honestly.
            </div>
          )}
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
          <Heading icon={<NeoIcon size={18} />}>Ask Neo</Heading>
          <div className="card" style={{ padding: 14, height: 460 }}>
            <ChatPanel context={ctx} stock={s} suggestions={["Should I buy right now?", "Support & resistance levels?", "Is this a good time to enter?", "Bull vs bear case?"]} />
          </div>
        </Pop>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

/* ============================== HOME ============================== */
