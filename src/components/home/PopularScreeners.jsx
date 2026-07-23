import React, { useEffect, useMemo, useState } from "react";
import { ALL, UNIVERSE, marketOf } from "../../domain/universe";
import { CUR, DAY, chgColor, fmt, lsGet, lsSet } from "../../lib/format";
import { scanScreener, marketOpen } from "../../domain/api";
import Section from "../common/Section";
import CustomScreener from "./CustomScreener";
import { SlidersHorizontal } from "lucide-react";

/* THE THREE POPULAR SCREENERS. Each is a real strategy config (indicators + entry chain) evaluated live
   on 5-minute candles by the backend /api/screener-scan. A symbol appears in a carousel only while its
   latest closed candle satisfies that screener's ENTRY trigger. */
const SCREENERS = [
  {
    key: "bollinger-blast", name: "Bollinger Blast", tf: "5m",
    defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "CurrentCandle", len: "", name: "CC" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [
      { la: "CC.close", op: "crosses_above", b: "BB1.upper", bType: "ind" },
      { gate: "AND", la: "CC.close", op: ">", b: "CC.open", bType: "ind" },
      { gate: "AND", la: "RSI1", op: ">", b: "60", bType: "num" },
    ],
  },
  {
    key: "orb", name: "Opening Range Breakout", tf: "5m",
    defs: [{ type: "ORB", len: "15", name: "ORB1" }, { type: "CurrentCandle", len: "", name: "CC" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [
      { la: "CC.close", op: "crosses_above", b: "ORB1.high", bType: "ind" },
      { gate: "AND", la: "CC.close", op: ">", b: "CC.open", bType: "ind" },
      { gate: "AND", la: "RSI1", op: ">", b: "50", bType: "num" },
    ],
  },
  {
    key: "ema-sma-cross", name: "EMA SMA Cross", tf: "5m",
    defs: [{ type: "EMA", len: "13", name: "EMA13" }, { type: "SMA", len: "83", name: "SMA83" }, { type: "SMA", len: "50", name: "SMA50" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [
      { la: "EMA13", op: "crosses_above", b: "SMA83", bType: "ind" },
      { gate: "AND", la: "RSI1", op: ">", b: "50", bType: "num" },
    ],
  },
];

const capDefault = (m) => (m === "US" || m === "Crypto") ? "1000" : "100000";
const GRAD = "radial-gradient(circle at 45% 34%, rgba(255,255,255,.5), transparent 55%), linear-gradient(135deg, #EDF3F4 0%, #E7EFF2 55%, #DFE8EC 100%)";

function ScreenerRow({ screener, market, onOpen, onBuy, onAutoBuy, onScreenerBuy, liveTick = 0 }) {
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
  const [matches, setMatches] = useState([]);
  const [autoOn, setAutoOn] = useState(() => lsGet(`mx_scrauto_${screener.key}_${market}`, false));
  const [period, setPeriod] = useState("today");
  const [capital, setCapital] = useState(() => lsGet(`mx_scrcap_${market}`, capDefault(market)));
  const [ov, setOv] = useState({});   // per-symbol { sl, tp } override

  // Live scan for THIS market's universe.
  useEffect(() => {
    let stop = false;
    const syms = (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 40);
    setCapital(lsGet(`mx_scrcap_${market}`, capDefault(market)));
    setAutoOn(lsGet(`mx_scrauto_${screener.key}_${market}`, false));
    if (!syms.length) { setMatches([]); return undefined; }
    scanScreener({ key: screener.key, defs: screener.defs, entry: screener.entry, tf: screener.tf, appSyms: syms })
      .then((list) => { if (!stop) setMatches(Array.isArray(list) ? list : []); })
      .catch(() => { if (!stop) setMatches([]); });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, liveTick]);

  const capNum = Math.max(1, parseInt(capital) || Number(capDefault(market)));
  const perCap = capNum / Math.max(1, matches.length);
  const cardSL = (sym) => (ov[sym] && ov[sym].sl != null) ? ov[sym].sl : 0.4;
  const cardTP = (sym) => (ov[sym] && ov[sym].tp != null) ? ov[sym].tp : 1.0;
  const setCardOv = (sym, field, val) => setOv((o) => ({ ...o, [sym]: { ...(o[sym] || {}), [field]: val === "" ? undefined : +val } }));

  // Live P&L: each matched symbol treated as bought with perCap at its entry price.
  const livePnl = useMemo(() => matches.reduce((a, m) => {
    const cur = priceOf(m.sym);
    if (cur == null || !m.entryPrice) return a;
    const qty = m.entryPrice > 0 ? perCap / m.entryPrice : 0;
    return a + (cur - m.entryPrice) * qty;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, 0), [matches, perCap, liveTick]);

  /* AUTO-BUY. When the toggle is on, place today's matched symbols once per day (paper unless in real
     mode), each with the card's SL/TP — mirroring Smart Auto-Buy. */
  useEffect(() => {
    if (!autoOn || !(onScreenerBuy || onAutoBuy || onBuy) || !matches.length) return;
    if (!marketOpen(market)) return;
    const key = `mx_scrbuy_${screener.key}_${market}_${DAY}`;
    if (lsGet(key, false)) return;
    matches.forEach((m) => {
      const inst = ALL.find((a) => a.sym === m.sym);
      if (!inst) return;
      const price = priceOf(m.sym) || m.entryPrice;
      const qty = market === "Crypto" ? +(perCap / price).toFixed(6) : Math.max(1, Math.floor(perCap / price));
      (onScreenerBuy || onAutoBuy || onBuy)(inst, qty, { tp: cardTP(m.sym), sl: cardSL(m.sym), strategy: screener.name });
    });
    lsSet(key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, market, matches.length]);

  const dt = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const cur = CUR[market] || "₹";
  const inBox = { width: 42, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "4px 3px", fontWeight: 800, fontSize: 11, color: "var(--ink)" };

  // Hide a screener entirely while nothing meets its entry trigger — an empty carousel is just noise.
  if (!matches.length) return null;

  return (
    <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--elev)" }}>
      {/* Header — screener name (left), Auto-Buy toggle (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: "var(--ink)" }}>{screener.name}</div>
          <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>5m · {matches.length} live</div>
        </div>
        <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: "var(--ink)", flexShrink: 0 }}>
          <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(`mx_scrauto_${screener.key}_${market}`, v); }} style={{ width: 36, height: 21, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 2, left: autoOn ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
          </span>
          Auto-Buy
        </label>
      </div>

      {/* Carousel of matched symbols — full width, below the name */}
      <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2, marginTop: 10 }}>
        {matches.map((m) => {
          const st = ALL.find((a) => a.sym === m.sym);
          const price = st ? st.price : m.entryPrice;
          return (
            <div key={m.sym} onClick={() => st && onOpen && onOpen(st)} className="tap" style={{ flex: "0 0 auto", width: 160, background: "var(--surface)", borderRadius: 12, padding: 10, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>{m.sym}</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--ink)" }}>{fmt(price, market)}</span>
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>● Entry {dt(m.entryAt)} @ <span className="mono">{fmt(m.entryPrice, market)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                <input value={cardSL(m.sym)} onChange={(e) => setCardOv(m.sym, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                <span style={{ fontSize: 9.5, color: "var(--down)", fontWeight: 800 }}>% SL</span>
                <input value={cardTP(m.sym)} onChange={(e) => setCardOv(m.sym, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                <span style={{ fontSize: 9.5, color: "var(--up)", fontWeight: 800 }}>% TP</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — date range · capital · live P&L, all on one line below the cards */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <select aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ flex: "0 0 auto", fontSize: 10.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "7px 8px", background: "var(--surface)", color: "var(--ink)" }}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "5px 9px" }}>
          <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800, flexShrink: 0 }}>CAPITAL ({cur})</span>
          <input value={capital} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setCapital(v); lsSet(`mx_scrcap_${market}`, v); }} inputMode="numeric" className="no-ring mono" style={{ flex: "1 1 0", minWidth: 0, background: "transparent", border: "none", color: "var(--ink)", fontSize: 13.5, fontWeight: 800, textAlign: "right" }} />
        </div>
        <div style={{ flex: "0 0 auto", textAlign: "right" }}>
          <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800 }}>LIVE P&amp;L</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: chgColor(livePnl) }}>{(livePnl >= 0 ? "+" : "") + fmt(livePnl, market)}</div>
        </div>
      </div>
    </div>
  );
}

export default function PopularScreeners({ market, mode = "virtual", list = [], onOpen, onBuy, onAutoBuy, onScreenerBuy, liveTick = 0 }) {
  const [tab, setTab] = useState("custom");   // "custom" | "popular" — Create-your-own is the default
  // Not for Commodity (thin universe / no 5m intraday screening there).
  if (market === "Commodity") return null;
  return (
    <Section title="Screener" icon={<SlidersHorizontal size={17} color="var(--primary)" />}>
      {/* Popular | Create your own screener */}
      <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginBottom: 4 }}>
        {[["custom", "Create your own screener"], ["popular", "Popular"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="pill tap disp" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, border: "none", whiteSpace: "nowrap", background: tab === k ? "var(--primary)" : "transparent", color: tab === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
        ))}
      </div>

      {tab === "popular"
        ? SCREENERS.map((s) => (
            <ScreenerRow key={s.key} screener={s} market={market} onOpen={onOpen} onBuy={onBuy} onAutoBuy={onAutoBuy} onScreenerBuy={onScreenerBuy} liveTick={liveTick} />
          ))
        : <CustomScreener market={market} mode={mode} list={list} onOpen={onOpen} onScreenerBuy={onScreenerBuy} liveTick={liveTick} />}
    </Section>
  );
}
