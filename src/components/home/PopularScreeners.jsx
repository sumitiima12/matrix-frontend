import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { CondBuilder2, IndicatorDefs, TFS, TradeLog } from "../builder/BuilderKit";
import { useBacktestStats } from "../../hooks/useBacktestStats";
import { defOperands } from "../../domain/strategyLang";
import { Pencil, SlidersHorizontal, Sparkles, ChevronRight, Activity } from "lucide-react";

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

  /* Momentum screeners on the price-change / day-change operands.
     1) enter on a >2% move over the last 5 minutes, exit when the last-5-min move turns below -1%.
     2) enter when the day is up >10% (vs previous close), exit when the last-5-min move drops below -2%. */
  {
    key: "price-surge-5m", name: "5-Min Price Surge", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "PriceChange", name: "PriceChange", winMin: 5, len: "1" }],
    entry: [{ la: "PriceChange", op: ">", b: "2", bType: "num" }],
    exit: [{ la: "PriceChange", op: "<", b: "-1", bType: "num" }],
  },
  {
    key: "day-gainer-10", name: "Big Daily Gainer", tf: "5m", sl: "1", tp: "3",
    defs: [{ type: "DayChangePrevClose", name: "DayChangePrevClose" }, { type: "PriceChange", name: "PriceChange", winMin: 5, len: "1" }],
    entry: [{ la: "DayChangePrevClose", op: ">", b: "10", bType: "num" }],
    exit: [{ la: "PriceChange", op: "<", b: "-2", bType: "num" }],
  },
];

/* R35-P4-01: display names that appear on MORE THAN ONE screener in the catalog. A legacy trade row with no stable
   screenerKey can't be safely attributed to either same-named screener, so per-screener totals quarantine it. */
const AMBIGUOUS_SCREENER_NAMES = new Set(
  Object.entries(SCREENERS.reduce((m, s) => { m[s.name] = (m[s.name] || 0) + 1; return m; }, {}))
    .filter(([, n]) => n > 1).map(([name]) => name),
);

/* Screeners that ship ACTIVE (Auto-Buy on) for a new user — they show under "Active Screeners" on the
   home page out of the box. The auto-buy toggle's stored value overrides this once the user flips it,
   so turning one off (or on) is remembered; the default only applies while the key is untouched. */
const DEFAULT_ACTIVE_KEYS = ["swing-catcher", "bollinger-mean-reversion", "support-resistance"];
const autoKeyFor = (key, market, short) => `mx_scrauto_${key}_${market}${short ? "_sell" : ""}`;
const isScreenerActive = (key, market, short) => lsGet(autoKeyFor(key, market, short), DEFAULT_ACTIVE_KEYS.includes(key));

/* Backtest stats + List of Trades for a screener card — the same numbers the Automate strategy cards
   show, by running the screener's rules over its symbols (capped for cost). Mounted lazily (only when
   the user expands the section) so 13 cards don't all backtest on load. */
function ScreenerStats({ screenerKey, market, defs, entry, exit, sl, tp, tf, symbols, short = false }) {
  const pseudo = useMemo(() => ({ id: `scr-${screenerKey}-${market}${short ? "-sell" : ""}`, cfg: { mode: "builder", defs, entry, exit, sl, tp, tf, side: short ? "SELL" : undefined, short: !!short }, symbols, tf, cap: 100000, side: short ? "SELL" : undefined, short: !!short }),
    [screenerKey, market, defs, entry, exit, sl, tp, tf, symbols, short]);
  const { loading, stats } = useBacktestStats(pseudo, {});
  if (loading) return <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 2px" }}>Backtesting…</div>;
  if (!stats || !stats.trades) return <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 2px" }}>{stats ? "No trades in the backtest window." : "No data to backtest."}</div>;
  const cell = (label, val, col) => (
    <div style={{ background: "var(--elev)", borderRadius: 8, padding: "6px 8px", minWidth: 0 }}>
      <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: col || "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
        {cell("Trades", stats.trades)}
        {cell("Win %", stats.winRate != null ? stats.winRate.toFixed(0) + "%" : "—", (stats.winRate ?? 0) >= 50 ? "var(--up)" : "var(--down)")}
        {/* R32-P3-04: named "Return / Notional" because the denominator is peak concurrent NOTIONAL, not broker
            margin/capital-at-risk. For leveraged instruments (FNO, options shorts, crypto futures) the reserved
            capital is smaller than notional, so this understates leveraged return — comparing across asset types
            should account for that. An honest label beats a misleading "Return". */}
        {cell("Return / Notional", (stats.retPct >= 0 ? "+" : "") + (stats.retPct || 0).toFixed(1) + "%", stats.retPct >= 0 ? "var(--up)" : "var(--down)")}
        {cell("P&L", stats.pnl == null ? "—" : (stats.pnl >= 0 ? "+" : "") + fmt(Number(Number(stats.pnl).toFixed(2)), market), (stats.pnl || 0) >= 0 ? "var(--up)" : "var(--down)")}
        {cell("Max DD", stats.maxDD != null ? (stats.maxDD > 0 ? "-" + fmt(stats.maxDD, market) : fmt(0, market)) : "—", "var(--down)")}
        {cell("Symbols", stats.symbols || 0)}
      </div>
      <TradeLog trades={stats.tradeList} market={market} showSym />
      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>Backtested on {symbols.length} symbol{symbols.length === 1 ? "" : "s"} — hindsight, not a guarantee.</div>
    </div>
  );
}

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

const capDefault = (m) => (m === "US" || m === "Crypto") ? "100" : "10000";   // US/Crypto: 100 (USD); Indian/Commodity: 10,000 (₹)
// Per-symbol quantity default: crypto is a USD notional (100), everything else is 1 unit/share.
const qtyDefaultFor = (m) => (m === "Crypto" ? 500 : 1);   // crypto = USD notional (default $500)
const GRAD = "radial-gradient(circle at 45% 34%, rgba(255,255,255,.5), transparent 55%), linear-gradient(135deg, #EDF3F4 0%, #E7EFF2 55%, #DFE8EC 100%)";

function ScreenerRow({ screener, market, mode = "virtual", trades = [], isAdmin = false, onOpen, onBuy, onAutoBuy, onScreenerBuy, onClosePosition, liveTick = 0, side = "BUY" }) {
  const short = side === "SELL";
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a ? a.price : null; };
  const [matches, setMatches] = useState([]);
  const autoKey = autoKeyFor(screener.key, market, short);
  const [autoOn, setAutoOn] = useState(() => lsGet(autoKey, DEFAULT_ACTIVE_KEYS.includes(screener.key)));
  const [period, setPeriod] = useState("today");
  const [showTrades, setShowTrades] = useState(false);   // expandable List of Trades (tap the P&L)
  const [showLivePos, setShowLivePos] = useState(false);   // expandable Live Positions (tap "Live Positions X")
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
  // The symbol BASKET (auto-selected / hand-picked symbols) is PER MARKET — a crypto auto-select must
  // not carry its BTC/ETH picks into US. Stored separately from the (global) admin rule overrides, keyed
  // by screener + market + side. Falls back to the admin-curated basket in `ovr` when unset for a market.
  const basketKey = `mx_scrbasket_${screener.key}_${market}${short ? "_sell" : ""}`;
  const [basket, setBasket] = useState(() => lsGet(basketKey, null));
  const eSel = (basket && Array.isArray(basket.selSyms)) ? basket.selSyms : [];
  // Auto-Select ran and NOTHING qualified → an intentional EMPTY basket ("None"), not "show the whole
  // market". Distinguishes "no basket set" (scan everything) from "auto-select found none" (scan nothing).
  const eNone = !!(basket && basket.selNone);
  const eOv = (ovr && ovr.ov) || {};
  const published = !(ovr && ovr.published === false);
  const cfgSig = useMemo(() => JSON.stringify({ d: eDefs, e: eEntry, t: eTf, s: eSel, n: eNone }), [eDefs, eEntry, eTf, eSel, eNone]);
  const saveEdit = () => {
    const next = {
      name: (edit.name || "").trim() || screener.name,
      sl: +edit.sl || 0.4, tp: +edit.tp || 1.0,
      defs: edit.defs, entry: edit.entry, exit: edit.exit, tf: edit.tf || screener.tf,
      selSyms: edit.selSyms || [], ov: edit.ov || {}, published: edit.published !== false,
    };
    setOvr(next); lsSet(EDK, next);
    // The symbol basket is per-market — write the admin's edited basket to THIS market's basket too.
    const nb = { selSyms: edit.selSyms || [], selNone: false };
    setBasket(nb); lsSet(basketKey, nb);
    setEdit(null);
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
  // User-tunable Auto-Select thresholds (defaults: win rate > 50%, return > 10%). Persisted per screener.
  const critKey = `mx_scrcrit_${screener.key}`;
  const [winMin, setWinMin] = useState(() => lsGet(critKey + "_w", 45));
  const [retMin, setRetMin] = useState(() => lsGet(critKey + "_r", 5));
  const [autoSel, setAutoSel] = useState({ running: false, done: false, n: 0, total: 0, kept: 0, win: 45, ret: 5 });
  // Inline symbol basket editor (available to everyone, via the pencil on the card).
  const [symEdit, setSymEdit] = useState(false);
  const setSelSyms = (v) => { const nb = { selSyms: v, selNone: false }; setBasket(nb); lsSet(basketKey, nb); };
  /* When the MARKET (or Buy/Sell side) changes, reload THIS market's basket and reset the auto-select
     UI — otherwise a crypto run's "Kept 2 of 44 / Re-run" state and picks leak onto US. */
  useEffect(() => {
    setBasket(lsGet(basketKey, null));
    setAutoSel({ running: false, done: false, n: 0, total: 0, kept: 0, win: 45, ret: 5 });
    setSymEdit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketKey]);

  /* Card-level DEFAULT SL/TP + optimizers — available to everyone. The SL/TP the user types (or an
     optimiser applies) is stored on the screener's override so the card's auto-buy uses it. */
  const [optOpen, setOptOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [slDraft, setSlDraft] = useState(String(defSL));
  const [tpDraft, setTpDraft] = useState(String(defTP));
  const writeSLTP = (sl, tp) => { const next = { ...(ovr || {}), sl, tp }; setOvr(next); lsSet(EDK, next); };
  const applyExits = (sl, tp) => { setSlDraft(String(sl)); setTpDraft(String(tp)); writeSLTP(sl, tp); };
  const applyIndicators = (nd, ntf) => { const next = { ...(ovr || {}), defs: nd, tf: ntf }; setOvr(next); lsSet(EDK, next); };
  const optSyms = (n) => (eSel.length ? eSel : (UNIVERSE[market] || []).map((s) => s.sym)).slice(0, n);
  const runAutoSelect = async () => {
    const syms = (UNIVERSE[market] || []).map((s) => s.sym);
    if (!syms.length || autoSel.running) return;
    const wMin = Number(winMin) || 0, rMin = Number(retMin) || 0;
    lsSet(critKey + "_w", wMin); lsSet(critKey + "_r", rMin);
    setAutoSel({ running: true, done: false, n: 0, total: syms.length, kept: 0, win: wMin, ret: rMin });
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
          return (stats && stats.n >= 2 && stats.winRate > wMin && stats.totalRet > rMin) ? sym : null;
        } catch { return null; }
      }));
      res.forEach((s) => { if (s) winners.push(s); });
      processed += batch.length;
      setAutoSel((st) => ({ ...st, n: Math.min(processed, syms.length), kept: winners.length }));
    }
    // When nothing qualifies, set an intentional EMPTY basket ("None") — show no symbols, NOT the whole market.
    const nb = { selSyms: winners, selNone: winners.length === 0 };
    setBasket(nb); lsSet(basketKey, nb);
    setAutoSel({ running: false, done: true, n: syms.length, total: syms.length, kept: winners.length, win: wMin, ret: rMin });
  };
  const clearAutoSelect = () => { const nb = { selSyms: [], selNone: false }; setBasket(nb); lsSet(basketKey, nb); setAutoSel({ running: false, done: false, n: 0, total: 0, kept: 0, win: 45, ret: 5 }); };

  /* Live scan for THIS market's universe. Screeners run on 5-MINUTE candles, so re-scanning on every
     liveTick (which fires every few seconds from price/broker polling) is pointless AND was hammering
     the backend — with several active screeners mounted it produced a storm of /api/screener-scan calls
     that the server rate-limited (429), which in turn starved real order calls. So the scan now runs on
     mount + config/basket change, then on a 60s interval — never off liveTick. */
  useEffect(() => {
    let stop = false;
    const runScan = () => {
      // None (auto-select found nothing) → scan no symbols. Else curated basket if set, else the market.
      const syms = eNone ? [] : (eSel.length ? eSel : (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 40));
      setCapital(lsGet(capKey, capDefault(market)));
      setAutoOn(lsGet(autoKey, DEFAULT_ACTIVE_KEYS.includes(screener.key)));
      if (!syms.length) { setMatches([]); return; }
      let h = 0; for (let i = 0; i < cfgSig.length; i++) h = (h * 31 + cfgSig.charCodeAt(i)) | 0;
      scanScreener({ key: `${screener.key}:${(h >>> 0).toString(36)}`, defs: eDefs, entry: eEntry, tf: eTf, appSyms: syms })
        .then((list) => { if (!stop) setMatches(Array.isArray(list) ? list : []); })
        .catch(() => { if (!stop) setMatches([]); });
    };
    runScan();
    const id = setInterval(runScan, 60000);   // 5-min-candle screeners → 60s polling is ample; kills the 429 storm
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, cfgSig, eNone, eSel.join(",")]);

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
  /* R34-P3-04 — OWNERSHIP by immutable identity, not display name. Two screeners can share a display name (or the same
     name reused across markets), which would let one screener's trades leak into another's P&L / stats / live positions
     (the same class of bug fixed for the BTC/BAJAJFINSV strategy card). Match on the screener's stable `key` when the
     trade carries one (`t.screenerKey`), and ALWAYS require the trade's market to equal this card's market. Fall back
     to the display name ONLY for legacy rows that predate screenerKey stamping, still market-scoped. */
  const ownsTrade = useCallback((t) => {
    if (!t) return false;
    if ((marketOf(t.sym) || t.market || "IN") !== market) return false;   // market is a hard guard, never name-only
    // Stable-key match is authoritative for every trade placed since keys were stamped.
    if (t.screenerKey != null && screener.key != null) return String(t.screenerKey) === String(screener.key);
    // R35-P4-01: LEGACY row (no screenerKey). Attribute by display name ONLY when that name is UNAMBIGUOUS across the
    // screener catalog. If two screeners share this display name, an unkeyed legacy row can't be assigned to either, so
    // it is QUARANTINED (excluded from per-screener totals) rather than double-counted — it still appears in
    // account-wide history elsewhere.
    if (AMBIGUOUS_SCREENER_NAMES.has(screener.name)) return false;
    return t.strategy === dispName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screener.key, screener.name, dispName, market]);

  const periodPnl = useMemo(() => {
    const isReal = mode === "real";
    return (trades || []).reduce((a, t) => {
      if (!ownsTrade(t)) return a;                           // only THIS screener's trades (by key + market)
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
  }, [trades, ownsTrade, mode, periodFrom, liveTick]);

  /* Does THIS screener have any trades in the active mode? Used so its P&L stays visible even after the
     user turns Auto-Buy OFF — turning the toggle off stops NEW entries, but the screener's realised/open
     P&L (and any positions still live from earlier) should still be shown, not hidden. */
  const hasScreenerTrades = useMemo(() => {
    const isReal = mode === "real";
    return (trades || []).some((t) => ownsTrade(t) && (isReal ? !!t.real : !t.real) && t.status !== "rejected" && t.entry != null);
  }, [trades, ownsTrade, mode]);

  /* TRADE STATS for THIS screener — mirrors the strategy-card stats (Trades, Wins, Loss, Win rate). Scoped
     to this screener's trades in the active mode, within the selected period window. Wins/Loss are counted on
     CLOSED trades only (an open trade has no realised result yet); win rate = wins / closed. Shorts are
     P&L-inverted, same as periodPnl. */
  const screenerStats = useMemo(() => {
    const isReal = mode === "real";
    const mine = (trades || []).filter((t) =>
      ownsTrade(t) && (isReal ? !!t.real : !t.real)
      && t.status !== "rejected" && t.entry != null
      && (t.exitAt == null || t.exit == null || (t.exitAt || t.entryAt || 0) >= periodFrom));
    const closed = mine.filter((t) => t.exitAt != null && t.exit != null);
    let wins = 0, losses = 0;
    for (const t of closed) {
      const dir = (t.side === "SELL" || t.short) ? -1 : 1;
      const p = (t.exit - t.entry) * (t.qty || 0) * dir;
      if (p > 0) wins++; else if (p < 0) losses++;
    }
    const decided = wins + losses;
    return { trades: mine.length, wins, losses, winRate: decided ? Math.round((wins / decided) * 100) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, ownsTrade, mode, periodFrom, liveTick]);

  /* LIVE POSITIONS for THIS screener — its own OPEN trades (entry booked, no exit yet) in the active mode.
     The card subtitle shows the count ("Live Positions X") and tapping it expands this list. */
  const livePositions = useMemo(() => {
    const isReal = mode === "real";
    return (trades || []).filter((t) => ownsTrade(t) && (isReal ? !!t.real : !t.real)
      && t.status !== "rejected" && t.entry != null && (t.exitAt == null || t.exit == null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, ownsTrade, mode, liveTick]);
  // How many symbols this screener is live on: its curated basket, else the whole market (0 when None).
  const liveSymbolCount = eNone ? 0 : (eSel.length ? eSel.length : (UNIVERSE[market] || []).length);

  /* AUTO-BUY. When the toggle is on, place today's matched symbols once per day (paper unless in real
     mode), each with the card's SL/TP — mirroring Smart Auto-Buy. */
  useEffect(() => {
    if (!autoOn || !(onScreenerBuy || onAutoBuy || onBuy) || !matches.length) return;
    if (!marketOpen(market)) return;
    const key = `mx_scrbuy_${screener.key}_${market}_${mode}${short ? "_sell" : ""}_${Math.floor(Date.now() / 864e5)}`;   // fresh day index (module `DAY` never rolls in a long session)
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
      (onScreenerBuy || onAutoBuy || onBuy)(inst, qty, { tp: cardTP(m.sym), sl: cardSL(m.sym), strategy: dispName, screenerKey: screener.key, market, ...(short ? { side: "SELL", short: true } : {}) });
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {/* Live Positions X — tappable, expands the card to show this screener's open positions. */}
            <button type="button" onClick={() => setShowLivePos((v) => !v)} className="tap" style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: livePositions.length ? "var(--primary)" : "var(--muted)" }}>
              Live Positions <span className="mono">{livePositions.length}</span>
              {livePositions.length > 0 && <span style={{ display: "inline-block", transform: showLivePos ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 8 }}>▾</span>}
            </button>
            <span style={{ color: "var(--line)" }}>·</span>
            {/* Symbols count — the screener's scan universe (its selected basket, or the whole market when none
                is selected). M04: labelled so it's not mistaken for matching/open-position count. */}
            <span title="Symbols this screener scans — its selected basket, or the whole market universe when none is selected. Not the number currently matching or held." style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}><span className="mono" style={{ color: "var(--ink)" }}>{liveSymbolCount}</span> Symbols</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: "var(--ink)" }}>
            <span onClick={() => { const v = !autoOn; setAutoOn(v); lsSet(autoKey, v); }} style={{ width: 36, height: 21, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: autoOn ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
            </span>
            Auto-Buy
          </label>
          {isAdmin && <button onClick={() => edit ? setEdit(null) : startEdit()} className="tap" title="Edit screener (admin)" style={{ border: "none", background: "transparent", padding: 2, flexShrink: 0 }}><Pencil size={14} color="var(--muted)" /></button>}
        </div>
      </div>

      {/* LIVE POSITIONS (expandable) — this screener's own open positions, each with a Close button that
          flattens it (reduce-only broker sell in real mode) and books the exit. */}
      {showLivePos && (
        <div style={{ marginTop: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 8 }}>
          {livePositions.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "4px 2px" }}>No live positions for this screener.</div>
          ) : livePositions.map((t) => {
            const px = priceOf(t.sym) != null ? priceOf(t.sym) : t.entry;
            const dir = (t.side === "SELL" || t.short) ? -1 : 1;
            const pnl = (Number(px) - Number(t.entry)) * Number(t.qty || 0) * dir;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderTop: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="disp" style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>{t.sym}{(t.side === "SELL" || t.short) ? <span style={{ color: "var(--down)", fontSize: 9, marginLeft: 4 }}>SHORT</span> : null}</div>
                  <div style={{ fontSize: 9, color: "var(--muted)" }}>Entry <span className="mono">{fmt(t.entry, market)}</span> · Now <span className="mono">{fmt(px, market)}</span></div>
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: pnl >= 0 ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}>{(pnl >= 0 ? "+" : "") + fmt(pnl, market)}</div>
                {onClosePosition && (
                  <button onClick={() => onClosePosition(t)} className="tap" title="Close this position now" style={{ flexShrink: 0, border: "1px solid var(--down)", background: "var(--down-soft, rgba(232,72,85,.12))", color: "var(--down)", borderRadius: 8, padding: "4px 9px", fontSize: 10, fontWeight: 800 }}>Close</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AUTO-SELECT SYMBOLS — backtest the whole market and keep only symbols that clear the user's
          win-rate and return thresholds (defaults: > 50% and > 10%). Those become the screener's basket. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {/* Editable criteria */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          Win % &gt;
          <input value={winMin} onChange={(e) => setWinMin(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" disabled={autoSel.running} className="no-ring mono" style={inBox} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          Return % &gt;
          <input value={retMin} onChange={(e) => setRetMin(e.target.value.replace(/[^0-9.-]/g, ""))} inputMode="decimal" disabled={autoSel.running} className="no-ring mono" style={inBox} />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button onClick={runAutoSelect} disabled={autoSel.running} className="tap disp" style={{
          flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)",
          borderRadius: 10, padding: "8px 12px", fontSize: 11.5, fontWeight: 800, cursor: autoSel.running ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: autoSel.running ? 0.7 : 1,
        }}>
          <Sparkles size={13} color="var(--primary)" />
          {autoSel.running ? `Backtesting… ${autoSel.n}/${autoSel.total}` : "Auto-Select Symbols"}
        </button>
        {(eSel.length > 0 || eNone) && !autoSel.running && (
          <button onClick={clearAutoSelect} className="tap disp" title="Clear the auto-selected basket (scan the whole market again)" style={{ flexShrink: 0, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 10, padding: "8px 11px", fontSize: 11, fontWeight: 800 }}>Clear</button>
        )}
      </div>
      {autoSel.done && !autoSel.running && (
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, marginTop: 5 }}>
          {autoSel.kept > 0
            ? `Kept ${autoSel.kept} of ${autoSel.total} symbols (win rate > ${autoSel.win}% and return > ${autoSel.ret}% on ${eTf} backtest).`
            : `No symbols met win rate > ${autoSel.win}% and return > ${autoSel.ret}% — selected None. Lower the thresholds and re-run, or tap Clear to scan the whole market.`}
        </div>
      )}

      {/* Selected-symbols count + pencil to edit the basket by hand (available to everyone). */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)" }}>Symbols: <span style={{ color: "var(--ink)" }}>{eNone ? "None selected" : eSel.length ? `${eSel.length} selected` : "Whole market"}</span></span>
        <button onClick={() => setSymEdit((v) => !v)} className="tap" title="Edit selected symbols" style={{ border: "1px solid var(--line)", background: symEdit ? "var(--primary-soft)" : "transparent", borderRadius: 8, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <Pencil size={12} color={symEdit ? "var(--primary)" : "var(--muted)"} /> <span style={{ fontSize: 10, fontWeight: 800, color: symEdit ? "var(--primary)" : "var(--muted)" }}>Edit</span>
        </button>
      </div>
      {symEdit && (
        <div style={{ marginTop: 8 }}>
          <MultiSelect label="Symbols" options={(UNIVERSE[market] || []).map((s) => s.sym)} value={eSel} onChange={setSelSyms} allLabel="Whole market" />
        </div>
      )}

      {/* DEFAULT SL/TP (editable) + Optimize SL & TP + Optimize Indicators — available to everyone. */}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setOptOpen((v) => !v)} className="tap disp" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: optOpen ? "var(--primary-soft)" : "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 12px", fontSize: 11.5, fontWeight: 800 }}>
          <SlidersHorizontal size={13} color="var(--primary)" /> Default SL/TP & Optimize {optOpen ? "▲" : "▼"}
        </button>
        {optOpen && (
          <div style={{ marginTop: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: "var(--down)" }}>Default SL %
                <input value={slDraft} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setSlDraft(v); writeSLTP(Number(v) || defSL, Number(tpDraft) || defTP); }} inputMode="decimal" className="no-ring mono" style={inBox} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: "var(--up)" }}>Default TP %
                <input value={tpDraft} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setTpDraft(v); writeSLTP(Number(slDraft) || defSL, Number(v) || defTP); }} inputMode="decimal" className="no-ring mono" style={inBox} />
              </label>
            </div>
            <ExitOptimizer defs={eDefs} entry={eEntry} tf={eTf} appSyms={optSyms(8)} currentSl={defSL} currentTp={defTP} short={short} onApply={(sl, tp) => applyExits(sl, tp)} />
            <div style={{ height: 8 }} />
            <IndicatorOptimizer defs={eDefs} entry={eEntry} tf={eTf} appSyms={optSyms(6)} currentSl={defSL} currentTp={defTP} short={short} onApply={(nd, ntf) => applyIndicators(nd, ntf)} />
          </div>
        )}
      </div>

      {/* #6: BACKTEST lives behind its own explicit button — tapping it runs the historical backtest. The card's real
          stats/trades (the P&L pill + its expandable List of Trades below) come from ACTUAL screener trades, never a
          backtest, so viewing them never triggers a backtest. Lazy: backtests only when this is opened. */}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setStatsOpen((v) => !v)} className="tap disp" title="Run a historical backtest of this screener" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: statsOpen ? "var(--primary-soft)" : "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 12px", fontSize: 11.5, fontWeight: 800 }}>
          <Activity size={13} color="var(--primary)" /> Backtest {statsOpen ? "▲" : "▼"}
        </button>
        {statsOpen && (
          <div style={{ marginTop: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <ScreenerStats screenerKey={screener.key} market={market} defs={eDefs} entry={eEntry} exit={(ovr && ovr.exit) || screener.exit || []} sl={defSL} tp={defTP} tf={eTf} short={short} symbols={eSel.length ? eSel.slice(0, 10) : (UNIVERSE[market] || []).map((s) => s.sym).slice(0, 6)} />
          </div>
        )}
      </div>

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
              <div style={{ fontSize: 9.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 }}>Defaults: {market === "Crypto" ? "$500 amount" : "qty 1"} · 0.4% SL · 1% TP. {market === "Crypto" ? "Crypto amount is USD notional." : ""}</div>
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
            short={short}
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
            short={short}
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

      {/* CAPITAL DEPLOYED — only relevant while Auto-Buy is live, so it's the one field gated to the toggle.
         Editing it only stages a DRAFT — a Save button appears while it differs from the deployed value, so a
         stray keystroke never silently resizes live auto-buys. */}
      {autoOn && (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, background: "var(--surface)", border: "1px solid " + (String(capDraft) !== String(capital) ? "var(--primary)" : "var(--line)"), borderRadius: 9, padding: "7px 11px" }}>
        <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, flexShrink: 0 }}>CAPITAL DEPLOYED ({cur})</span>
        <input value={capDraft} onChange={(e) => setCapDraft(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="no-ring mono" style={{ flex: "1 1 0", minWidth: 0, background: "transparent", border: "none", color: "var(--ink)", fontSize: 14, fontWeight: 800, textAlign: "right" }} />
        {String(capDraft) !== String(capital) && (
          <button onClick={() => { const v = capDraft || capDefault(market); setCapDraft(v); setCapital(v); lsSet(capKey, v); }} className="tap disp" style={{ flexShrink: 0, border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 7, padding: "5px 12px", fontSize: 10.5, fontWeight: 800 }}>Save</button>
        )}
      </div>
      )}
      {/* P&L — shown whenever the screener is live OR has ever traded (in this mode), so its performance stays
         visible after Auto-Buy is turned off. Date range (left) + P&L (right); P&L doubles as the trade-list toggle. */}
      {(autoOn || hasScreenerTrades) && (
      <>
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
          <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: chgColor(periodPnl), textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{(periodPnl >= 0 ? "+" : "") + fmt(Number(Number(periodPnl).toFixed(2)), market)}</div>
        </button>
      </div>
      {/* Trade stats — mirrors the strategy cards: Trades, Wins, Loss, Win rate (P&L shown above). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
        {[
          { k: "Trades", v: String(screenerStats.trades), c: "var(--ink)" },
          { k: "Wins", v: String(screenerStats.wins), c: "var(--pos, #16a34a)" },
          { k: "Loss", v: String(screenerStats.losses), c: "var(--neg, #dc2626)" },
          { k: "Win rate", v: screenerStats.winRate == null ? "—" : screenerStats.winRate + "%", c: "var(--ink)" },
        ].map((s) => (
          <div key={s.k} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "5px 6px", textAlign: "center", minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>{s.k}</div>
          </div>
        ))}
      </div>
      <ScreenerTradeList trades={trades} strategyName={dispName} screenerKey={screener.key} nameAmbiguous={AMBIGUOUS_SCREENER_NAMES.has(screener.name)} mode={mode} market={market} periodFrom={periodFrom} priceOf={priceOf} open={showTrades} />
      </>
      )}
    </div>
  );
}

/* SCREENER DASHBOARD — the Automate-style performance header for the Screener tab. Aggregates every
   "Screener Auto Buy" trade in the current market (excluding rejects): realised P&L on closed trades plus
   unrealised P&L on still-open ones (against the live price), with Win/Loss and return-on-deployed. Mirrors
   the Automate dashboard so the two feel consistent. */
/* Shared trade/position table for a dashboard drill-down. `rows` are trade objects already scoped to the
   selected market + order type. Columns match the product spec: Symbol, Amount, entry date/time, entry price,
   exit price, exit date/time, exit type, P&L, Return. Set onlyOpen to render just the live positions. */
export function DashTradeTable({ rows = [], market, priceOf, onlyOpen = false, cap = 0 }) {
  const dt = (ms) => { if (!ms) return { d: "—", t: "" }; const x = new Date(ms); return { d: x.toLocaleDateString("en-GB"), t: x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }; };
  const list = useMemo(() => {
    const mapped = (rows || []).map((t) => {
      const isOpen = t.exitAt == null || t.exit == null;
      const cur = isOpen ? (priceOf(t.sym) != null ? priceOf(t.sym) : t.entry) : t.exit;
      const dir = (t.side === "SELL" || t.short) ? -1 : 1;
      const qty = Number(t.qty || 0);
      const pnl = (Number(cur) - Number(t.entry)) * qty * dir;
      const retPct = Number(t.entry) ? ((Number(cur) / Number(t.entry)) - 1) * 100 * dir : 0;
      return { sym: t.sym, amount: Number(t.entry) * qty, entryAt: t.entryAt, entry: Number(t.entry), exit: isOpen ? null : Number(t.exit), exitAt: isOpen ? null : t.exitAt, exitType: isOpen ? "Open" : (t.exitType || "Closed"), pnl, retPct, open: isOpen };
    }).filter((r) => (onlyOpen ? r.open : true)).sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
    return cap > 0 ? mapped.slice(0, cap) : mapped;
  }, [rows, priceOf, onlyOpen, cap]);
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  // #3: freeze the Symbol column so it stays put while the wide table scrolls horizontally.
  const thSticky = { ...th, position: "sticky", left: 0, background: "var(--surface)", zIndex: 2 };
  const tdSticky = { ...td, fontWeight: 800, position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 };
  const exportCsv = () => {
    const head = ["Symbol", "Capital Deployed", "Entry Date", "Entry Time", "Entry Price", "Exit Price", "Exit Date", "Exit Time", "Exit Type", "P&L", "Return %"];
    const rowsCsv = list.map((r) => { const e = dt(r.entryAt), x = dt(r.exitAt); return [r.sym, r.amount.toFixed(2), e.d, e.t, r.entry, r.exit == null ? "" : r.exit, r.open ? "" : x.d, r.open ? "" : x.t, r.exitType, r.pnl.toFixed(2), r.retPct.toFixed(2)]; });
    const csv = [head, ...rowsCsv].map((cols) => cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    try { const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } catch { /* download best-effort */ }
  };
  if (!list.length) return <div style={{ fontSize: 11, color: "var(--muted)", padding: "10px 4px" }}>{onlyOpen ? "No open positions." : "No trades in the selected period."}</div>;
  return (
    <div style={{ marginTop: 8 }}>
      {!onlyOpen && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" onClick={exportCsv} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 8, padding: "4px 10px", fontWeight: 800, fontSize: 10.5, cursor: "pointer" }}>Export CSV</button>
        </div>
      )}
    <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
        <thead><tr>
          <th style={thSticky}>Symbol</th><th style={{ ...th, textAlign: "right" }}>Capital Deployed</th><th style={th}>Entry</th>
          <th style={{ ...th, textAlign: "right" }}>Entry px</th><th style={{ ...th, textAlign: "right" }}>Exit px</th>
          <th style={th}>Exit</th><th style={th}>Exit type</th>
          <th style={{ ...th, textAlign: "right" }}>P&amp;L</th><th style={{ ...th, textAlign: "right" }}>Return</th>
        </tr></thead>
        <tbody>
          {list.map((r, i) => { const e = dt(r.entryAt), x = dt(r.exitAt); return (
            <tr key={i}>
              <td style={tdSticky}>{r.sym}</td>
              <td style={{ ...td, textAlign: "right" }}>{fmt(r.amount, market)}</td>
              <td style={td}><span style={{ fontWeight: 800 }}>{e.d}</span> <span style={{ color: "var(--muted)" }}>{e.t}</span></td>
              <td style={{ ...td, textAlign: "right" }}>{fmt(r.entry, market)}</td>
              <td style={{ ...td, textAlign: "right" }}>{r.exit == null ? "—" : fmt(r.exit, market)}</td>
              <td style={td}>{r.open ? <span style={{ color: "var(--primary)", fontWeight: 800 }}>Open</span> : <><span style={{ fontWeight: 800 }}>{x.d}</span> <span style={{ color: "var(--muted)" }}>{x.t}</span></>}</td>
              <td style={{ ...td, color: r.exitType === "Stop loss" || r.exitType === "Trailing stop" ? "var(--down)" : r.exitType === "Exit trigger" ? "var(--up)" : "var(--muted)" }}>{r.exitType}</td>
              <td style={{ ...td, textAlign: "right", color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{(r.pnl >= 0 ? "+" : "") + fmt(r.pnl, market)}</td>
              <td style={{ ...td, textAlign: "right", color: r.retPct >= 0 ? "var(--up)" : "var(--down)" }}>{(r.retPct >= 0 ? "+" : "") + r.retPct.toFixed(2)}%</td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function ScreenerDashboard({ trades = [], market }) {
  const [drill, setDrill] = useState(null);      // null | 'trades' | 'open'
  const [rangeDays, setRangeDays] = useState(() => lsGet("mx_scr_dash_range", 0));   // 0 = Today; else last N days
  const setRange = (d) => { setRangeDays(d); lsSet("mx_scr_dash_range", d); };
  const since = rangeDays === 0 ? new Date().setHours(0, 0, 0, 0) : Date.now() - rangeDays * 864e5;
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a && a.price != null ? a.price : null; };
  const pnlOf = (t, px) => {
    const dir = (t.side === "SELL" || t.short) ? -1 : 1;
    return ((Number(px) - Number(t.entry)) * Number(t.qty || 0)) * dir;
  };
  // Market + Screener order type + DATE RANGE. An OPEN position is always shown (it's live now); a closed trade is
  // included only if its exit (or entry) falls inside the selected window.
  const mine = (trades || []).filter((t) =>
    t && (t.tradeType === "Screener Auto Buy") && (t.market || "") === market && t.status !== "rejected" && Number(t.entry) > 0
    && ((t.exitAt == null || t.exit == null) || (Number(t.exitAt || t.entryAt || 0) >= since)));
  const closed = mine.filter((t) => t.exitAt != null && t.exit != null);
  const open = mine.filter((t) => t.exitAt == null || t.exit == null);
  const realised = closed.reduce((a, t) => a + pnlOf(t, t.exit), 0);
  const unreal = open.reduce((a, t) => { const px = priceOf(t.sym); return a + (px != null ? pnlOf(t, px) : 0); }, 0);
  const pnl = realised + unreal;
  const wins = closed.filter((t) => pnlOf(t, t.exit) > 0).length;
  const losses = Math.max(0, closed.length - wins);
  const winRate = closed.length ? (wins / closed.length) * 100 : null;
  const invested = mine.reduce((a, t) => a + Number(t.entry) * Number(t.qty || 0), 0);
  /* R31-P3-04: the return-% DENOMINATOR is the PEAK CONCURRENT reserved capital — the most this screener ever had at
     risk at one time — NOT the sum of every entry's notional. Summing all entries double-counts capital that was
     RE-USED after a position closed (e.g. ten sequential ₹1k trades on a ₹1k sleeve is 1× capital deployed, not
     ₹10k), which inflates the denominator and understates the true return on capital. We sweep entry/exit events in
     time order, track simultaneously-reserved notional, and take its peak; an open position reserves capital through
     now. Releases are processed before reservations at the same instant so a close→reopen handoff doesn't count
     twice. Falls back to summed notional only in the degenerate no-timeline case. */
  const peakReservedCapital = (() => {
    const evts = [];
    for (const t of mine) {
      const n = Number(t.entry) * Number(t.qty || 0);
      if (!(n > 0)) continue;
      const start = Number(t.entryAt) || 0;
      const end = t.exitAt != null ? Number(t.exitAt) : Number.MAX_SAFE_INTEGER;   // still open ⇒ reserved through now
      evts.push({ ts: start, d: n }, { ts: end, d: -n });
    }
    evts.sort((a, b) => (a.ts - b.ts) || (a.d - b.d));   // at equal ts, releases (−) before reservations (+)
    let cur = 0, peak = 0;
    for (const e of evts) { cur += e.d; if (cur > peak) peak = cur; }
    return peak;
  })();
  const retDenom = peakReservedCapital > 0 ? peakReservedCapital : invested;
  const ret = retDenom > 0 ? (pnl / retDenom) * 100 : null;
  // Always render (even with no trades yet) so the Screener dashboard is visible; it just shows zeros.
  const up = pnl >= 0;
  // Automate-style DStat tile.
  const Tile = ({ k, v, c, onClick, active }) => (
    <button onClick={onClick} disabled={!onClick} className={onClick ? "tap" : undefined}
      style={{ flex: "1 1 0", minWidth: 0, textAlign: "left", background: active ? "var(--primary-soft)" : "rgba(0,0,0,.05)", border: active ? "1px solid var(--primary)" : "1px solid transparent", borderRadius: 12, padding: "9px 8px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 9, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em", whiteSpace: "nowrap" }}>{k}{onClick ? " ›" : ""}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14, marginTop: 3, color: c || "var(--ink)" }}>{v}</div>
    </button>
  );
  return (
    <div className="card flat" style={{ padding: 16, marginBottom: 10, border: "1px solid var(--line)", background: "var(--card-grad, var(--elev))", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Screener Dashboard</div>
        <select value={rangeDays} onChange={(e) => setRange(Number(e.target.value))} className="no-ring"
          style={{ fontSize: 11.5, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 8px", background: "var(--surface)", color: "var(--ink)" }}>
          <option value={0}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={182}>6 months</option>
          <option value={3650}>All time</option>
        </select>
      </div>
      {/* Headline P&L + subline — mirrors the Automation Dashboard. */}
      <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 6, color: up ? "var(--up)" : "var(--down)" }}>{up ? "+" : ""}{fmt(pnl, market)}</div>
      <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>{open.length} live position{open.length === 1 ? "" : "s"} · {mine.length} trade{mine.length === 1 ? "" : "s"} in {market}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Tile k="Returns %" v={ret == null ? "—" : (ret >= 0 ? "+" : "") + ret.toFixed(2) + "%"} c={ret == null ? undefined : (ret >= 0 ? "var(--up)" : "var(--down)")} />
        <Tile k="Win rate" v={winRate == null ? "—" : winRate.toFixed(0) + "%"} />
        <Tile k="Win / Loss" v={`${wins} : ${losses}`} />
        <Tile k="Trades" v={mine.length} onClick={() => setDrill(drill === "trades" ? null : "trades")} active={drill === "trades"} />
      </div>

      {/* Clicking Trades → full list scoped to Screener trades in this market. */}
      {drill === "trades" && <DashTradeTable rows={mine} market={market} priceOf={priceOf} />}
    </div>
  );
}

/* One editable Live-Position row. SL / TP are inline-editable (like Automate's Real Deployed): the value
   commits on blur / Enter via onUpdatePosition. No Exit px / Exit / Exit-type columns (those are for
   closed trades). */
function LivePosRow({ t, market, td, onClosePosition, onUpdatePosition }) {
  const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a && a.price != null ? a.price : null; };
  const dt = (ms) => { if (!ms) return { d: "—", t: "" }; const x = new Date(ms); return { d: x.toLocaleDateString("en-GB"), t: x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }; };
  const [slDraft, setSlDraft] = useState(t.sl != null ? String(t.sl) : "");
  const [tpDraft, setTpDraft] = useState(t.tp != null ? String(t.tp) : "");
  useEffect(() => { setSlDraft(t.sl != null ? String(t.sl) : ""); setTpDraft(t.tp != null ? String(t.tp) : ""); }, [t.sl, t.tp]);
  const px = priceOf(t.sym) != null ? priceOf(t.sym) : t.entry;
  const dir = (t.side === "SELL" || t.short) ? -1 : 1;
  const qty = Number(t.qty || 0);
  const pnl = (Number(px) - Number(t.entry)) * qty * dir;
  const retPct = Number(t.entry) ? ((Number(px) / Number(t.entry)) - 1) * 100 * dir : 0;
  const e = dt(t.entryAt);
  const riskBox = { width: 44, textAlign: "center", border: "1px solid var(--line)", background: "var(--elev)", borderRadius: 7, padding: "3px 4px", fontWeight: 800, fontSize: 10.5, color: "var(--ink)" };
  const commit = (field, v) => { if (onUpdatePosition) onUpdatePosition(t, { [field]: v === "" ? null : Number(v) }); };
  return (
    <tr>
      <td style={{ ...td, fontWeight: 800, position: "sticky", left: 0, zIndex: 1, background: "var(--surface)" }}>{t.sym}{(t.side === "SELL" || t.short) ? <span style={{ color: "var(--down)", fontSize: 8, marginLeft: 4 }}>SHORT</span> : null}</td>
      <td style={{ ...td, color: "var(--muted)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{t.strategy || "—"}</td>
      <td style={{ ...td, textAlign: "right" }}>{fmt(Number(t.entry) * qty, market)}</td>
      <td style={td}><span style={{ fontWeight: 800 }}>{e.d}</span> <span style={{ color: "var(--muted)" }}>{e.t}</span></td>
      <td style={{ ...td, textAlign: "right" }}>{fmt(t.entry, market)}</td>
      <td style={{ ...td, textAlign: "right" }}>{fmt(px, market)}</td>
      <td style={{ ...td, textAlign: "right", color: pnl >= 0 ? "var(--up)" : "var(--down)" }}>{(pnl >= 0 ? "+" : "") + fmt(pnl, market)}</td>
      <td style={{ ...td, textAlign: "right", color: retPct >= 0 ? "var(--up)" : "var(--down)" }}>{(retPct >= 0 ? "+" : "") + retPct.toFixed(2)}%</td>
      <td style={{ ...td, textAlign: "center" }}>
        <input value={slDraft} onChange={(ev) => setSlDraft(ev.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => commit("sl", slDraft)} onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} inputMode="decimal" title="Stop-loss %" className="no-ring mono" style={riskBox} />
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        <input value={tpDraft} onChange={(ev) => setTpDraft(ev.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => commit("tp", tpDraft)} onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} inputMode="decimal" title="Target %" className="no-ring mono" style={riskBox} />
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        {onClosePosition && <button onClick={() => onClosePosition(t)} className="tap" title="Close this position now" style={{ border: "1px solid var(--down)", background: "var(--down-soft, rgba(232,72,85,.12))", color: "var(--down)", borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 800 }}>Close</button>}
      </td>
    </tr>
  );
}

/* SEPARATE Live Positions section — sits BELOW the dashboard. One row per open Screener Auto-Buy position
   with a Screener-name column, editable SL/TP and a Close button; no Exit px / Exit / Exit-type columns.
   Up to 5 shown, then See all. */
function ScreenerLivePositions({ trades = [], market, onClosePosition, onUpdatePosition }) {
  const [seeAll, setSeeAll] = useState(false);
  const open = useMemo(() => (trades || []).filter((t) =>
    t && t.tradeType === "Screener Auto Buy" && (t.market || "") === market && t.status !== "rejected"
    && Number(t.entry) > 0 && (t.exitAt == null || t.exit == null))
    .sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0)), [trades, market]);
  if (!open.length) return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Live Positions <span style={{ color: "var(--muted)" }}>· 0</span></div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>No live screener positions right now.</div>
    </div>
  );
  const rows = seeAll ? open : open.slice(0, 5);
  const th = { fontSize: 8.5, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", padding: "6px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 10.5, fontWeight: 700, padding: "6px 7px", borderTop: "1px solid var(--line)", whiteSpace: "nowrap" };
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>Live Positions <span style={{ color: "var(--muted)" }}>· {open.length}</span></div>
        {open.length > 5 && <button onClick={() => setSeeAll((v) => !v)} className="tap" style={{ border: "none", background: "none", color: "var(--primary)", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>{seeAll ? "Show less" : "See all"}</button>}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
          <thead><tr>
            <th style={{ ...th, position: "sticky", left: 0, zIndex: 3, background: "var(--surface)" }}>Symbol</th><th style={th}>Screener</th><th style={{ ...th, textAlign: "right" }}>Amount</th>
            <th style={th}>Entry</th><th style={{ ...th, textAlign: "right" }}>Entry px</th><th style={{ ...th, textAlign: "right" }}>Current px</th>
            <th style={{ ...th, textAlign: "right" }}>P&amp;L</th><th style={{ ...th, textAlign: "right" }}>Return</th>
            <th style={{ ...th, textAlign: "center" }}>SL %</th><th style={{ ...th, textAlign: "center" }}>TP %</th><th style={{ ...th, textAlign: "center" }}>Close</th>
          </tr></thead>
          <tbody>
            {rows.map((t) => <LivePosRow key={t.id} t={t} market={market} td={td} onClosePosition={onClosePosition} onUpdatePosition={onUpdatePosition} />)}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>SL/TP are editable. Close flattens the position now (reduce-only broker sell in real mode) and books the exit. P&L is estimated.</div>
    </div>
  );
}

export default function PopularScreeners({ market, mode = "virtual", list = [], isAdmin = false, onOpen, onBuy, onAutoBuy, onScreenerBuy, onClosePosition, onUpdatePosition, liveTick = 0, trades = [], variant = "full", onOpenScreener }) {
  const [tab, setTab] = useState(variant === "active" ? "popular" : "custom");   // full page defaults to Build-a-screener
  const [dir, setDir] = useState("buy");   // Buy (long) | Sell (short) for Popular Screeners
  const [editing, setEditing] = useState(null);   // a saved screener loaded into the builder for editing
  const [showAllActive, setShowAllActive] = useState(false);   // homepage: collapse Active Screeners to 2 + "Show all"
  // Not for Commodity (thin universe / no 5m intraday screening there).
  if (market === "Commodity") return null;
  const startEdit = (scr) => { setEditing(scr); setTab("custom"); };

  /* HOMEPAGE variant — only the ACTIVE screeners (Auto-Buy on), compact, with a link to the full
     Screener tab. Active = the auto-buy toggle is on; 3 ship active for new users. */
  if (variant === "active") {
    const activeScreeners = SCREENERS.filter((s) => isScreenerActive(s.key, market, false));
    return (
      <Section title="Active Screeners" icon={<SlidersHorizontal size={17} color="var(--primary)" />}>
        {activeScreeners.length === 0
          ? <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, padding: "4px 2px 10px" }}>No active screeners yet. Open the Screener tab to browse and activate them.</div>
          : (<>
              {(showAllActive ? activeScreeners : activeScreeners.slice(0, 2)).map((s) => (
                <ScreenerRow key={s.key} screener={s} market={market} mode={mode} trades={trades} isAdmin={isAdmin} onOpen={onOpen} onBuy={onBuy} onAutoBuy={onAutoBuy} onScreenerBuy={onScreenerBuy} onClosePosition={onClosePosition} liveTick={liveTick} side="BUY" />
              ))}
              {activeScreeners.length > 2 && (
                <button onClick={() => setShowAllActive((v) => !v)} className="tap disp" style={{ marginTop: 4, width: "100%", border: "none", background: "transparent", color: "var(--primary)", fontWeight: 800, fontSize: 12, padding: "6px", cursor: "pointer" }}>
                  {showAllActive ? "Show less" : `Show all (${activeScreeners.length})`}
                </button>
              )}
            </>)}
        {onOpenScreener && (
          <button onClick={onOpenScreener} className="tap disp" style={{ marginTop: 10, width: "100%", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--primary)", borderRadius: 11, padding: "10px 12px", fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Open Screener <ChevronRight size={15} />
          </button>
        )}
      </Section>
    );
  }
  return (
    <Section title="Screener" icon={<SlidersHorizontal size={17} color="var(--primary)" />}>
      {/* Automate-style performance dashboard for Screener Auto-Buy trades in this market. */}
      <ScreenerDashboard trades={trades} market={market} />
      {/* Live Positions — its OWN section below the dashboard (Screener column, editable SL/TP, Close). */}
      <ScreenerLivePositions trades={trades} market={market} onClosePosition={onClosePosition} onUpdatePosition={onUpdatePosition} />
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
          <ScreenerRow key={s.key + dir} screener={s} market={market} mode={mode} trades={trades} isAdmin={isAdmin} onOpen={onOpen} onBuy={onBuy} onAutoBuy={onAutoBuy} onScreenerBuy={onScreenerBuy} onClosePosition={onClosePosition} liveTick={liveTick} side={dir === "sell" ? "SELL" : "BUY"} />
        ))}
      </>}
      {tab === "custom" && <CustomScreener market={market} mode={mode} list={list} onOpen={onOpen} onScreenerBuy={onScreenerBuy} liveTick={liveTick} editing={editing} onDoneEditing={() => setEditing(null)} />}
      {tab === "mine" && <MyScreeners market={market} mode={mode} list={list} trades={trades} onOpen={onOpen} onScreenerBuy={onScreenerBuy} onEdit={startEdit} liveTick={liveTick} />}
    </Section>
  );
}
