import React, { useEffect, useMemo, useState } from "react";
import { ALL, UNIVERSE, marketOf, yahooSymbol } from "../../domain/universe";
import { CUR, DAY, chgColor, fmt, lsGet, lsSet } from "../../lib/format";
import { scanScreener, marketOpen } from "../../domain/api";
import { getHistory } from "../../services/marketService";
import { backtest } from "../../domain/backtest";
import Section from "../common/Section";
import CustomScreener from "./CustomScreener";
import MyScreeners from "./SavedScreeners";
import ExitOptimizer from "./ExitOptimizer";
import IndicatorOptimizer from "./IndicatorOptimizer";
import MultiSelect from "../common/MultiSelect";
import ScreenerTradeList from "./ScreenerTradeList";
import { CondBuilder2, IndicatorDefs, TFS } from "../../pages/Automation";
import { defOperands } from "../../domain/strategyLang";
import { Pencil, SlidersHorizontal, Sparkles } from "lucide-react";

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

  /* Premium-strategy screeners — entry + exit chains lifted verbatim from the matching Premium
     strategies in Automate. SL/TP are NOT copied from the strategies: every Popular screener uses a
     uniform 1% stop / 3% target (screener.sl / screener.tp below feed the card's default SL/TP). */
  {
    key: "support-resistance", name: "Support & Resistance", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "LastNCandles", len: "10", name: "SW" }],
    entry: [{ la: "Price", op: "<=", b: "SW.low", bType: "ind" }],
    exit: [{ la: "Price", op: ">=", b: "SW.high", bType: "ind" }],
  },
  {
    key: "bollinger-mean-reversion", name: "Bollinger Mean Reversion", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "BB", len: "20", name: "BB1" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [{ la: "Price", op: "<=", b: "BB1.lower", bType: "ind" }, { gate: "AND", la: "RSI1", op: "<", b: "35", bType: "num" }],
    exit: [{ la: "Price", op: ">=", b: "BB1.middle", bType: "ind" }],
  },
  {
    key: "swing-catcher", name: "Swing Catcher", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "LastNCandles", len: "5", name: "SW" }],
    entry: [{ la: "Price", op: "<=", b: "SW.low", bType: "ind" }],
    exit: [{ la: "Price", op: ">=", b: "SW.high", bType: "ind" }],
  },
  {
    key: "multi-timeframe-momentum", name: "Multi-Timeframe Momentum", tf: "3m", sl: "1", tp: "3",
    defs: [
      { type: "EMA", len: "9", tf: "3m", name: "E3f" }, { type: "EMA", len: "21", tf: "3m", name: "E3s" },
      { type: "EMA", len: "9", tf: "5m", name: "E5f" }, { type: "EMA", len: "21", tf: "5m", name: "E5s" },
      { type: "EMA", len: "9", tf: "15m", name: "E15f" }, { type: "EMA", len: "21", tf: "15m", name: "E15s" }],
    entry: [{ la: "E3f", op: ">", b: "E3s", bType: "ind" }, { gate: "AND", la: "E5f", op: ">", b: "E5s", bType: "ind" }, { gate: "AND", la: "E15f", op: ">", b: "E15s", bType: "ind" }],
    exit: [{ la: "E3f", op: "crosses_below", b: "E3s", bType: "ind" }],
  },
  {
    key: "alphax-nexus", name: "AlphaX Nexus", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "Volume", len: "", name: "Volume" }, { type: "SMA", len: "20", name: "VMA" }],
    entry: [{ la: "EMA_f", op: ">", b: "EMA_m", bType: "ind" }, { gate: "AND", la: "EMA_m", op: ">", b: "EMA_s", bType: "ind" }, { gate: "AND", la: "Volume", op: ">", b: "VMA", bType: "ind" }],
    exit: [{ la: "EMA_f", op: "crosses_below", b: "EMA_m", bType: "ind" }],
  },
  {
    key: "ema-zone-inversion", name: "EMA Zone Inversion", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "EMA", len: "33", name: "EMA1" }, { type: "EMA", len: "50", name: "EMA2" }, { type: "EMA", len: "200", name: "EMA3" }],
    entry: [{ la: "EMA1", op: ">", b: "EMA2", bType: "ind" }, { gate: "AND", la: "EMA2", op: ">", b: "EMA3", bType: "ind" }, { gate: "AND", la: "Price", op: "crosses_above", b: "EMA1", bType: "ind" }],
    exit: [{ la: "Price", op: "crosses_below", b: "EMA1", bType: "ind" }],
  },
  {
    key: "alphax-prism", name: "AlphaX Prism", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "RSI", len: "14", name: "RSI1" }, { type: "ADX", len: "14", name: "ADX1" }],
    entry: [{ la: "EMA_f", op: ">", b: "EMA_m", bType: "ind" }, { gate: "AND", la: "EMA_m", op: ">", b: "EMA_s", bType: "ind" }, { gate: "AND", la: "RSI1", op: ">", b: "50", bType: "num" }, { gate: "AND", la: "ADX1", op: ">", b: "20", bType: "num" }],
    exit: [{ la: "RSI1", op: ">", b: "75", bType: "num" }, { gate: "OR", la: "Price", op: "crosses_below", b: "EMA_m", bType: "ind" }],
  },
  {
    key: "vwap-reclaim", name: "VWAP Reclaim", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "VWAP", len: "", name: "VWAP1" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [{ la: "Price", op: "crosses_above", b: "VWAP1", bType: "ind" }, { gate: "AND", la: "RSI1", op: ">", b: "50", bType: "num" }],
    exit: [{ la: "Price", op: "crosses_below", b: "VWAP1", bType: "ind" }],
  },
  {
    key: "golden-cross-adx", name: "Golden Cross + ADX", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "EMA", len: "50", name: "EMA50" }, { type: "EMA", len: "200", name: "EMA200" }, { type: "ADX", len: "14", name: "ADX1" }],
    entry: [{ la: "EMA50", op: ">", b: "EMA200", bType: "ind" }, { gate: "AND", la: "ADX1", op: ">", b: "20", bType: "num" }],
    exit: [{ la: "EMA50", op: "crosses_below", b: "EMA200", bType: "ind" }],
  },
  {
    key: "triple-ema-dual-momentum", name: "Triple-EMA Dual Momentum", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "EMA", len: "21", name: "EMA_f" }, { type: "EMA", len: "50", name: "EMA_m" }, { type: "EMA", len: "200", name: "EMA_s" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [{ la: "EMA_f", op: ">", b: "EMA_m", bType: "ind" }, { gate: "AND", la: "EMA_m", op: ">", b: "EMA_s", bType: "ind" }, { gate: "AND", la: "RSI1", op: ">", b: "55", bType: "num" }],
    exit: [{ la: "Price", op: "crosses_below", b: "EMA_m", bType: "ind" }],
  },
  {
    key: "vwap-trend-pullback", name: "VWAP Trend Pullback", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "VWAP", len: "", name: "VWAP1" }, { type: "EMA", len: "50", name: "EMA50" }, { type: "RSI", len: "14", name: "RSI1" }],
    entry: [{ la: "Price", op: ">", b: "EMA50", bType: "ind" }, { gate: "AND", la: "Price", op: "crosses_above", b: "VWAP1", bType: "ind" }, { gate: "AND", la: "RSI1", op: ">", b: "50", bType: "num" }],
    exit: [{ la: "Price", op: "crosses_below", b: "EMA50", bType: "ind" }],
  },
];

/* Buy (long) vs Sell (short) toggle — mirrors the Automate Samples/Premium toggle. In "Sell"
   mode a Popular screener shorts its matches instead of buying them (same setup, opposite side). */
function ScreenerDirToggle({ dir, setDir }) {
  return (
    <div style={{ display: "flex", gap: 6, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, margin: "8px 0 4px" }}>
      {[["buy", "Buy", "var(--up)"], ["sell", "Sell", "var(--down)"]].map(([k, label, col]) => (
        <button key={k} onClick={() => setDir(k)} className="tap disp" style={{
          flex: 1, borderRadius: 9, padding: "8px 4px", fontWeight: 800, fontSize: 12, cursor: "pointer", border: "none",
          background: dir === k ? col : "transparent", color: dir === k ? "#fff" : "var(--muted)",
        }}>{label}</button>
      ))}
    </div>
  );
}

const capDefault = (m) => (m === "US" || m === "Crypto") ? "1000" : "100000";
// Per-symbol quantity default: crypto is a USD notional (100), everything else is 1 unit/share.
const qtyDefaultFor = (m) => (m === "Crypto" ? 100 : 1);
const GRAD = "radial-gradient(circle at 45% 34%, rgba(255,255,255,.5), transparent 55%), linear-gradient(135deg, #EDF3F4 0%, #E7EFF2 55%, #DFE8EC 100%)";

function ScreenerRow({ screener, market, mode = "virtual", trades = [], isAdmin = false, onOpen, onBuy, onAutoBuy, onScreenerBuy, liveTick = 0, side = "BUY" }) {
  const short = side === "SELL";
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
  const [matches, setMatches] = useState([]);
  const autoKey = `mx_scrauto_${screener.key}_${market}${short ? "_sell" : ""}`;
  const [autoOn, setAutoOn] = useState(() => lsGet(autoKey, false));
  const [period, setPeriod] = useState("today");
  const [showTrades, setShowTrades] = useState(false);   // expandable List of Trades (tap the P&L)
  // Capital-deployed is PER SCREENER (keyed by screener.key + market + side), not one shared value —
  // editing it on one card must not move every other card's capital.
  const capKey = `mx_scrcap_${screener.key}_${market}${short ? "_sell" : ""}`;
  const [capital, setCapital] = useState(() => lsGet(capKey, capDefault(market)));
  // Draft value for the capital input — the deployed capital only changes when the user hits Save,
  // so a stray keystroke doesn't silently resize live auto-buys.
  const [capDraft, setCapDraft] = useState(capital);
  useEffect(() => { setCapDraft(capital); }, [capital]);
  const [ov, setOv] = useState({});   // per-symbol { sl, tp } override
  // Admin-editable overrides for this Popular screener: display name, default SL/TP, and the actual
  // scan rules (indicators + entry/exit chains + timeframe). Absent fields fall back to the built-in.
  const EDK = `mx_popedit_${screener.key}`;
  const [edit, setEdit] = useState(null);   // null | { name, sl, tp, defs, entry, exit, tf } while the panel is open
  const [ovr, setOvr] = useState(() => lsGet(EDK, {}));
  const dispName = ((ovr && ovr.name) || screener.name) + (short ? " -Sell" : "");
  const defSL = (ovr && ovr.sl != null) ? ovr.sl : (screener.sl != null ? +screener.sl : 0.4);
  const defTP = (ovr && ovr.tp != null) ? ovr.tp : (screener.tp != null ? +screener.tp : 1.0);
  // Effective scan config — admin's edited rules if present, else the built-in screener definition.
  const eDefs = (ovr && ovr.defs) || screener.defs;
  const eEntry = (ovr && ovr.entry) || screener.entry;
  const eTf = (ovr && ovr.tf) || screener.tf;
  // Admin curation: an explicit symbol basket, per-symbol qty/SL/TP overrides, and a publish flag.
  const eSel = (ovr && Array.isArray(ovr.selSyms)) ? ovr.selSyms : [];
  const eOv = (ovr && ovr.ov) || {};
  const published = !(ovr && ovr.published === false);
  const cfgSig = useMemo(() => JSON.stringify({ d: eDefs, e: eEntry, t: eTf, s: eSel }), [eDefs, eEntry, eTf, eSel]);
  const saveEdit = () => {
    const next = {
      name: (edit.name || "").trim() || screener.name,
      sl: +edit.sl || 0.4, tp: +edit.tp || 1.0,
      defs: edit.defs, entry: edit.entry, exit: edit.exit, tf: edit.tf || screener.tf,
      selSyms: edit.selSyms || [], ov: edit.ov || {}, published: edit.published !== false,
    };
    setOvr(next); lsSet(EDK, next); setEdit(null);
  };
  const startEdit = () => setEdit({
    name: dispName, sl: defSL, tp: defTP, tf: eTf,
    defs: (eDefs || []).map((d) => ({ ...d, id: d.id || Date.now() + Math.random(), tf: d.tf || eTf || "5m" })),
    entry: (eEntry || []).map((c) => ({ ...c })),
    exit: ((ovr && ovr.exit) || screener.exit || []).map((c) => ({ ...c })),
    selSyms: [...eSel], ov: { ...eOv }, published,
  });
  const editOperands = useMemo(() => ["Price", "Volume", ...defOperands((edit && edit.defs) || [])], [edit]);

  /* AUTO-SELECT SYMBOLS — backtest this screener's rules (entry/exit + the card's SL/TP) over EVERY
     symbol in the current market, and keep only the ones with win rate > 50% AND total return > 10%.
     The winners become this screener's curated basket (selSyms), so the live scan and Auto-Buy then
     only consider those symbols. Requires ≥2 backtested trades so a single lucky trade can't qualify. */
  const [autoSel, setAutoSel] = useState({ running: false, done: false, n: 0, total: 0, kept: 0 });
  const runAutoSelect = async () => {
    const syms = (UNIVERSE[market] || []).map((s) => s.sym);
    if (!syms.length || autoSel.running) return;
    setAutoSel({ running: true, done: false, n: 0, total: syms.length, kept: 0 });
    const cfg = { defs: eDefs, entry: eEntry, exit: (ovr && ovr.exit) || screener.exit || [], sl: defSL, tp: defTP, tf: eTf };
    const winners = [];
    let processed = 0;
    const CHUNK = 6;   // small parallel batches — fast but doesn't hammer the backend
    for (let i = 0; i < syms.length; i += CHUNK) {
      const batch = syms.slice(i, i + CHUNK);
      const res = await Promise.all(batch.map(async (sym) => {
        try {
          const candles = await getHistory(yahooSymbol(sym), eTf, true);
          if (!candles || candles.length < 30) return null;
          const { stats } = backtest(cfg, candles, 1, eTf);
          return (stats && stats.n >= 2 && stats.winRate > 50 && stats.totalRet > 10) ? sym : null;
        } catch { return null; }
      }));
      res.forEach((s) => { if (s) winners.push(s); });
      processed += batch.length;
      setAutoSel((st) => ({ ...st, n: Math.min(processed, syms.length), kept: winners.length }));
    }
    const next = { ...(ovr || {}), selSyms: winners };
    setOvr(next); lsSet(EDK, next);
    setAutoSel({ running: false, done: true, n: syms.length, total: syms.length, kept: winners.length });
  };
  const clearAutoSelect = () => { const next = { ...(ovr || {}), selSyms: [] }; setOvr(next); lsSet(EDK, next); setAutoSel({ running: false, done: false, n: 0, total: 0, kept: 0 }); };

  // Live scan for THIS market's universe.
  useEffect(() => {
    let stop = false;
    // Admin-curated basket if set, else the market's universe (capped for cost).
    const syms = eSel.length ? eSel : (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 40);
    setCapital(lsGet(capKey, capDefault(market)));
    setAutoOn(lsGet(autoKey, false));
    if (!syms.length) { setMatches([]); return undefined; }
    let h = 0; for (let i = 0; i < cfgSig.length; i++) h = (h * 31 + cfgSig.charCodeAt(i)) | 0;
    scanScreener({ key: `${screener.key}:${(h >>> 0).toString(36)}`, defs: eDefs, entry: eEntry, tf: eTf, appSyms: syms })
      .then((list) => { if (!stop) setMatches(Array.isArray(list) ? list : []); })
      .catch(() => { if (!stop) setMatches([]); });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, liveTick, cfgSig]);

  const capNum = Math.max(1, parseInt(capital) || Number(capDefault(market)));
  const perCap = capNum / Math.max(1, matches.length);
  // Effective SL/TP/qty: the user's on-card tweak (session), else the admin's saved per-symbol override,
  // else the default. A curated basket carries explicit per-symbol quantities.
  const cardSL = (sym) => (ov[sym] && ov[sym].sl != null) ? ov[sym].sl : (eOv[sym] && eOv[sym].sl != null) ? eOv[sym].sl : defSL;
  const cardTP = (sym) => (ov[sym] && ov[sym].tp != null) ? ov[sym].tp : (eOv[sym] && eOv[sym].tp != null) ? eOv[sym].tp : defTP;
  const cardQty = (sym) => (eOv[sym] && eOv[sym].qty != null) ? eOv[sym].qty : qtyDefaultFor(market);
  const useBasketQty = eSel.length > 0;   // curated basket → explicit per-symbol qty (not capital-split)
  const setCardOv = (sym, field, val) => setOv((o) => ({ ...o, [sym]: { ...(o[sym] || {}), [field]: val === "" ? undefined : +val } }));

  // PERIOD P&L — total (realised + open) P&L of THIS screener's own auto-buy trades over the range
  // picked in the left dropdown (Today / 7d / 30d / 6m), not just the unrealised value of whatever is
  // matching right now. Trades are the ones this card placed: tradeType "Screener Auto Buy",
  // strategy === dispName, scoped to this market + mode. Short (Sell) trades are P&L-inverted.
  const periodFrom = useMemo(() => {
    const now = Date.now();
    const D = 864e5;   // one day in ms (NOT the imported day-index `DAY`, which would be ~2 minutes)
    if (period === "today") return new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    if (period === "7d") return now - 7 * D;
    if (period === "30d") return now - 30 * D;
    if (period === "6m") return now - 182 * D;
    return 0;
  }, [period]);
  const periodPnl = useMemo(() => {
    const isReal = mode === "real";
    return (trades || []).reduce((a, t) => {
      if (t.strategy !== dispName) return a;                 // only THIS screener's trades
      if (isReal ? !t.real : !!t.real) return a;             // scope to the active mode
      if (t.status === "rejected" || t.entry == null) return a;
      const closed = t.exitAt != null && t.exit != null;
      // Include: closed trades that closed inside the window, OR anything still open.
      if (closed && (t.exitAt || t.entryAt || 0) < periodFrom) return a;
      const cur = closed ? t.exit : (priceOf(t.sym) != null ? priceOf(t.sym) : t.entry);
      const dir = (t.side === "SELL" || t.short) ? -1 : 1;   // shorts profit when price falls
      // P&L = price move × quantity held. t.qty is the amount of the asset (coins / shares / lots) for
      // BOTH crypto and everything else, so this is uniform. The old crypto branch wrongly treated qty
      // as a USD notional and multiplied by the return fraction, which for a sub-cent coin blew a
      // $1,000 stop up into a -$300k figure (qty × -100%).
      const p = (cur - t.entry) * (t.qty || 0) * dir;
      return a + p;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, dispName, mode, market, periodFrom, liveTick]);

  /* AUTO-BUY. When the toggle is on, place today's matched symbols once per day (paper unless in real
     mode), each with the card's SL/TP — mirroring Smart Auto-Buy. */
  useEffect(() => {
    if (!autoOn || !(onScreenerBuy || onAutoBuy || onBuy) || !matches.length) return;
    if (!marketOpen(market)) return;
    const key = `mx_scrbuy_${screener.key}_${market}${short ? "_sell" : ""}_${DAY}`;
    if (lsGet(key, false)) return;
    matches.forEach((m) => {
      const inst = ALL.find((a) => a.sym === m.sym);
      if (!inst) return;
      const price = priceOf(m.sym) || m.entryPrice;
      // Curated basket → the admin's explicit per-symbol qty (crypto qty is a USD notional → coins).
      // Otherwise fall back to the capital-split behaviour.
      const notional = useBasketQty ? cardQty(m.sym) : perCap;
      const qty = market === "Crypto" ? +(notional / price).toFixed(6) : Math.max(1, Math.floor(useBasketQty ? cardQty(m.sym) : (perCap / price)));
      // In "Sell" mode the screener SHORTS its matches instead of buying (same setup, opposite side).
      (onScreenerBuy || onAutoBuy || onBuy)(inst, qty, { tp: cardTP(m.sym), sl: cardSL(m.sym), strategy: dispName, ...(short ? { side: "SELL", short: true } : {}) });
    });
    lsSet(key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, market, matches.length]);

  const dt = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const cur = CUR[market] || "₹";
  const inBox = { width: 42, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "4px 3px", fontWeight: 800, fontSize: 11, color: "var(--ink)" };

  // Unpublished screeners are hidden from regular users; admins still see them (with a badge) so they
  // can edit and re-publish.
  if (!published && !isAdmin) return null;

  return (
    <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--elev)", opacity: published ? 1 : 0.75 }}>
      {/* Header — screener name (left), Auto-Buy toggle + admin edit (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
            {dispName}
            {!published && <span className="pill" style={{ fontSize: 8, fontWeight: 800, padding: "2px 7px", background: "var(--down-soft, rgba(232,72,85,.14))", color: "var(--down)" }}>UNPUBLISHED</span>}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>{eTf} · {matches.length} live{eSel.length ? ` · ${eSel.length} symbols` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: "var(--ink)" }}>
            <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(`mx_scrauto_${screener.key}_${market}`, v); }} style={{ width: 36, height: 21, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: autoOn ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </span>
            Auto-Buy
          </label>
          {isAdmin && <button onClick={() => edit ? setEdit(null) : startEdit()} className="tap" title="Edit screener (admin)" style={{ border: "none", background: "transparent", padding: 2, flexShrink: 0 }}><Pencil size={14} color="var(--muted)" /></button>}
        </div>
      </div>

      {/* AUTO-SELECT SYMBOLS — backtest the whole market and keep only symbols with win rate > 50%
          and return > 10%. Those become this screener's basket. Available to everyone. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <button onClick={runAutoSelect} disabled={autoSel.running} className="tap disp" style={{
          flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)",
          borderRadius: 10, padding: "8px 12px", fontSize: 11.5, fontWeight: 800, cursor: autoSel.running ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: autoSel.running ? 0.7 : 1,
        }}>
          <Sparkles size={13} color="var(--primary)" />
          {autoSel.running ? `Backtesting… ${autoSel.n}/${autoSel.total}` : (eSel.length ? "Re-run Auto-Select Symbols" : "Auto-Select Symbols")}
        </button>
        {eSel.length > 0 && !autoSel.running && (
          <button onClick={clearAutoSelect} className="tap disp" title="Clear the auto-selected basket (scan the whole market again)" style={{ flexShrink: 0, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 10, padding: "8px 11px", fontSize: 11, fontWeight: 800 }}>Clear</button>
        )}
      </div>
      {autoSel.done && !autoSel.running && (
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, marginTop: 5 }}>
          {autoSel.kept > 0
            ? `Kept ${autoSel.kept} of ${autoSel.total} symbols (win rate > 50% and return > 10% on ${eTf} backtest).`
            : `No symbols met win rate > 50% and return > 10% — showing the whole market instead.`}
        </div>
      )}

      {/* Admin edit panel — name, default SL/TP, timeframe, indicators and entry/exit rules. */}
      {isAdmin && edit && (
        <div style={{ marginTop: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, color: "var(--ink)" }}>
          <input value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} placeholder="Screener name" className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 9px", fontSize: 12.5, fontWeight: 600, background: "var(--elev)", color: "var(--ink)", marginBottom: 8 }} />
          {/* Publish toggle — unpublished screeners are hidden from users. */}
          <label className="tap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 9, background: "var(--elev)" }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{edit.published !== false ? "Published" : "Unpublished"} <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 10.5 }}>— {edit.published !== false ? "visible to users" : "hidden from users"}</span></span>
            <span onClick={() => setEdit((s) => ({ ...s, published: !(s.published !== false) }))} style={{ width: 40, height: 23, borderRadius: 999, background: edit.published !== false ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: edit.published !== false ? 19 : 2, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800 }}>Default SL%</span>
            <input value={edit.sl} onChange={(e) => setEdit((s) => ({ ...s, sl: e.target.value.replace(/[^0-9.]/g, "") }))} inputMode="decimal" className="no-ring mono" style={inBox} />
            <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800 }}>Default TP%</span>
            <input value={edit.tp} onChange={(e) => setEdit((s) => ({ ...s, tp: e.target.value.replace(/[^0-9.]/g, "") }))} inputMode="decimal" className="no-ring mono" style={inBox} />
            <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginLeft: 4 }}>TF</span>
            <select value={edit.tf || "5m"} onChange={(e) => setEdit((s) => ({ ...s, tf: e.target.value }))} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "5px 6px", fontSize: 11.5, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }}>{TFS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>

          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, margin: "6px 0 6px" }}>Indicators</div>
          <IndicatorDefs defs={edit.defs || []} setDefs={(u) => setEdit((s) => ({ ...s, defs: typeof u === "function" ? u(s.defs || []) : u }))} />

          <div style={{ height: 12 }} />
          <CondBuilder2 label="Entry signal — when a symbol qualifies" conds={edit.entry || []} setConds={(u) => setEdit((s) => ({ ...s, entry: typeof u === "function" ? u(s.entry || []) : u }))} operands={editOperands} />
          <div style={{ height: 12 }} />
          <CondBuilder2 label="Exit signal — when to close" conds={edit.exit || []} setConds={(u) => setEdit((s) => ({ ...s, exit: typeof u === "function" ? u(s.exit || []) : u }))} operands={editOperands} />

          {/* Symbol basket — pick specific symbols (like Build a screener). Empty = scan the whole market.
              Each chosen symbol gets its own quantity / SL / TP. */}
          <div style={{ height: 14 }} />
          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>Symbols</div>
          <MultiSelect label="Symbols" options={(UNIVERSE[market] || []).map((s) => s.sym)} value={edit.selSyms || []} onChange={(v) => setEdit((s) => ({ ...s, selSyms: v }))} allLabel="Whole market" />
          {(edit.selSyms || []).length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8.5, color: "var(--muted)", fontWeight: 800, paddingLeft: 2 }}>
                <span style={{ flex: 1 }}>SYMBOL</span>
                <span style={{ width: 52, textAlign: "center" }}>{market === "Crypto" ? "AMT $" : "QTY"}</span>
                <span style={{ width: 48, textAlign: "center" }}>SL %</span>
                <span style={{ width: 48, textAlign: "center" }}>TP %</span>
              </div>
              {(edit.selSyms || []).map((sym) => {
                const row = (edit.ov || {})[sym] || {};
                const setF = (field, val) => setEdit((s) => ({ ...s, ov: { ...(s.ov || {}), [sym]: { ...((s.ov || {})[sym] || {}), [field]: val === "" ? undefined : +val } } }));
                return (
                  <div key={sym} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="disp" style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</span>
                    <input value={row.qty != null ? row.qty : qtyDefaultFor(market)} onChange={(e) => setF("qty", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ ...inBox, width: 52 }} />
                    <input value={row.sl != null ? row.sl : (edit.sl || 0.4)} onChange={(e) => setF("sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ ...inBox, width: 48 }} />
                    <input value={row.tp != null ? row.tp : (edit.tp || 1.0)} onChange={(e) => setF("tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ ...inBox, width: 48 }} />
                  </div>
                );
              })}
              <div style={{ fontSize: 9.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 }}>Defaults: {market === "Crypto" ? "$100 amount" : "qty 1"} · 0.4% SL · 1% TP. {market === "Crypto" ? "Crypto amount is USD notional." : ""}</div>
            </div>
          )}

          {/* Ideal SL/TP for this Popular screener — grid-search over its entry rule's past signals.
              Apply drops the ideal pair into the default SL/TP above (Save changes to publish it). */}
          <div style={{ height: 12 }} />
          <ExitOptimizer
            defs={edit.defs}
            entry={edit.entry}
            tf={edit.tf || screener.tf}
            appSyms={(edit.selSyms && edit.selSyms.length) ? edit.selSyms.slice(0, 8) : (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 8)}
            currentSl={edit.sl}
            currentTp={edit.tp}
            onApply={(sl, tp) => setEdit((s) => ({ ...s, sl, tp }))}
          />

          {/* Optimize the indicator LENGTHS (+ timeframe ≤1h) this screener uses. Apply writes the tuned
              indicators + timeframe straight back into the editor above (Save changes to publish). */}
          <div style={{ height: 10 }} />
          <IndicatorOptimizer
            defs={edit.defs}
            entry={edit.entry}
            tf={edit.tf || screener.tf}
            appSyms={(edit.selSyms && edit.selSyms.length) ? edit.selSyms.slice(0, 6) : (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 6)}
            currentSl={edit.sl}
            currentTp={edit.tp}
            onApply={(nd, ntf) => setEdit((s) => ({ ...s, defs: nd, tf: ntf }))}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={saveEdit} className="tap disp" style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 800, background: "var(--primary)", color: "var(--on-primary)" }}>Save changes</button>
            <button onClick={() => { setOvr({}); lsSet(EDK, {}); setEdit(null); }} className="tap disp" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--muted)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 800 }}>Reset to default</button>
          </div>
        </div>
      )}

      {/* Matched symbols — vertical list, one below the other. Empty → a note. */}
      {matches.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {matches.map((m) => {
            const st = ALL.find((a) => a.sym === m.sym);
            const price = st ? st.price : m.entryPrice;
            return (
              <div key={m.sym} style={{ background: "var(--surface)", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 11px" }}>
                <div onClick={() => st && onOpen && onOpen(st)} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span className="disp" style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{m.sym}</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{fmt(price, market)}</span>
                </div>
                <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>● Entry {dt(m.entryAt)} @ <span className="mono">{fmt(m.entryPrice, market)}</span></div>
                {autoOn && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                    <input value={cardSL(m.sym)} onChange={(e) => setCardOv(m.sym, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                    <span style={{ fontSize: 9.5, color: "var(--down)", fontWeight: 800 }}>% SL</span>
                    <input value={cardTP(m.sym)} onChange={(e) => setCardOv(m.sym, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={inBox} />
                    <span style={{ fontSize: 9.5, color: "var(--up)", fontWeight: 800 }}>% TP</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>No symbols currently matching the entry criteria.</div>
      )}

      {/* Footer — date range · capital · live P&L. Only shown when Auto-Buy is on (off = a plain discovery list). */}
      {autoOn && (
      <>
      {/* Capital on its OWN full-width row. Editing it only stages a DRAFT — a Save button appears while
         it differs from the deployed value, so a stray keystroke never silently resizes live auto-buys. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, background: "var(--surface)", border: "1px solid " + (String(capDraft) !== String(capital) ? "var(--primary)" : "var(--line)"), borderRadius: 9, padding: "7px 11px" }}>
        <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, flexShrink: 0 }}>CAPITAL DEPLOYED ({cur})</span>
        <input value={capDraft} onChange={(e) => setCapDraft(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="no-ring mono" style={{ flex: "1 1 0", minWidth: 0, background: "transparent", border: "none", color: "var(--ink)", fontSize: 14, fontWeight: 800, textAlign: "right" }} />
        {String(capDraft) !== String(capital) && (
          <button onClick={() => { const v = capDraft || capDefault(market); setCapDraft(v); setCapital(v); lsSet(capKey, v); }} className="tap disp" style={{ flexShrink: 0, border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 7, padding: "5px 12px", fontSize: 10.5, fontWeight: 800 }}>Save</button>
        )}
      </div>
      {/* Date range (left) + P&L (right) — P&L now has room and doubles as the List-of-Trades toggle. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <select aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ flex: "0 0 auto", fontSize: 10.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "7px 8px", background: "var(--surface)", color: "var(--ink)" }}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="6m">Last 6 months</option>
        </select>
        <div style={{ flex: "1 1 0" }} />
        <button type="button" onClick={() => setShowTrades((v) => !v)} className="tap" title="Tap to see the list of trades" style={{ flex: "0 0 auto", textAlign: "right", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ fontSize: 8.5, color: "var(--primary)", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>P&amp;L <span style={{ display: "inline-block", transform: showTrades ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 8 }}>▾</span></div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: chgColor(periodPnl), textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{(periodPnl >= 0 ? "+" : "") + fmt(periodPnl, market)}</div>
        </button>
      </div>
      <ScreenerTradeList trades={trades} strategyName={dispName} mode={mode} market={market} periodFrom={periodFrom} priceOf={priceOf} open={showTrades} />
      </>
      )}
    </div>
  );
}

export default function PopularScreeners({ market, mode = "virtual", list = [], isAdmin = false, onOpen, onBuy, onAutoBuy, onScreenerBuy, liveTick = 0, trades = [] }) {
  const [tab, setTab] = useState("custom");   // "custom" | "popular" | "mine" — Build-a-screener is the default
  const [dir, setDir] = useState("buy");   // Buy (long) | Sell (short) for Popular Screeners
  const [editing, setEditing] = useState(null);   // a saved screener loaded into the builder for editing
  // Not for Commodity (thin universe / no 5m intraday screening there).
  if (market === "Commodity") return null;
  const startEdit = (scr) => { setEditing(scr); setTab("custom"); };
  return (
    <Section title="Screener" icon={<SlidersHorizontal size={17} color="var(--primary)" />}>
      {/* Build a screener | Popular Screeners | My Screeners */}
      <div className="hide-scroll" style={{ display: "flex", marginBottom: 4, overflowX: "auto" }}>
        <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3 }}>
          {[["custom", "Build a screener"], ["popular", "Popular Screeners"], ["mine", "My Screeners"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); if (k !== "custom") setEditing(null); }} className="pill tap disp" style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, border: "none", whiteSpace: "nowrap", background: tab === k ? "var(--primary)" : "transparent", color: tab === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "popular" && <>
        <ScreenerDirToggle dir={dir} setDir={setDir} />
        {dir === "sell" && <div style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 2px 8px" }}>Sell mode shorts each match instead of buying it. Shorting executes on crypto and Indian options; elsewhere it runs in paper.</div>}
        {SCREENERS.map((s) => (
          <ScreenerRow key={s.key + dir} screener={s} market={market} mode={mode} trades={trades} isAdmin={isAdmin} onOpen={onOpen} onBuy={onBuy} onAutoBuy={onAutoBuy} onScreenerBuy={onScreenerBuy} liveTick={liveTick} side={dir === "sell" ? "SELL" : "BUY"} />
        ))}
      </>}
      {tab === "custom" && <CustomScreener market={market} mode={mode} list={list} onOpen={onOpen} onScreenerBuy={onScreenerBuy} liveTick={liveTick} editing={editing} onDoneEditing={() => setEditing(null)} />}
      {tab === "mine" && <MyScreeners market={market} mode={mode} list={list} trades={trades} onOpen={onOpen} onScreenerBuy={onScreenerBuy} onEdit={startEdit} liveTick={liveTick} />}
    </Section>
  );
}
