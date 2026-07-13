import React, { useState, useMemo, useRef, useEffect } from "react";
import { fetchFundamentals, fetchIndicators, fetchTrades, marketOpen, postTrade, resolveExitFromCandles, fetchLiveQuotes } from "./domain/api";
import {
  Search, User, Wallet, Home, Repeat, Lightbulb, Bot, Bolt, Briefcase,
  Star, TrendingUp, TrendingDown, X, ChevronRight, Send, Plus, Trash2,
  ArrowUpRight, ArrowDownRight, Sparkles, SlidersHorizontal, Check,
  Activity, Newspaper, Building2, Filter, Play, Pause, ChevronLeft, Zap, Sun, Moon, Bell, Pencil, Clock, LogIn, LogOut
} from "lucide-react";

/* ---- Modular layers (see product.md architecture) ----
   config    : environment
   lib/*     : pure maths & formatting (no I/O)
   services/*: all I/O + the Risk Engine (no UI, no React)
   hooks/*   : React bindings over the services
   This file now holds domain data (the universe) + UI, and is being
   progressively broken up further. Business logic lives in services/.        */
import { BACKEND_URL, MATRIX_PERSONA, TF_YF } from "./config";
import { CUR, MKT_LABEL, fmt, compact, clamp, hash, lcg, DAY, timeAgo, lsGet, lsSet, getUserId } from "./lib/format";
import { smaSeries, emaSeries as emaSeriesC, bollingerSeries, macdSeries, rsiSeries, OVERLAYS, CHART_TFS } from "./lib/indicators";
import { getQuotes, getHistory, getNews, getIndicators, getFundamentals } from "./services/marketService";
import { ask as aiAsk, interpretScreen, interpretStrategy, marketBrief } from "./services/aiService";
import { saveTrade as apiSaveTrade, listTrades, register as apiRegisterSvc, login as apiLoginSvc } from "./services/tradeService";
import { validateOrder, isMarketOpen, DEFAULT_LIMITS } from "./services/riskService";
import { analyzeStock } from "./services/aiService";
import { recTone } from "./services/researchService";
import { analyzeHolding, portfolioHealth, sectorExposure } from "./services/portfolioService";
import { analyzeJournal } from "./services/journalService";
import BuyButton from "./components/common/BuyButton";
import { PATTERNS, TF_N } from "./lib/patterns";
import { ALL, UNIVERSE, IN_STOCKS, US_STOCKS, CRYPTO, COMMODITY, FNO, marketOf, yahooSymbol, istParts, marketHoursLabel } from "./domain/universe";
import { makeFuture, lotSize, LOTS, currentExpiry } from "./domain/fno";
import { techSignal, dailyPicks } from "./domain/signals";
import Change from "./components/common/Change";
import AddBtn from "./components/common/AddBtn";
import Pop from "./components/common/Pop";
import Section from "./components/common/Section";
import VerdictTag from "./components/common/VerdictTag";
import Gauge from "./components/common/Gauge";
import StatGrid from "./components/common/StatGrid";
import BarBlock from "./components/common/BarBlock";
import ChartCard from "./components/common/ChartCard";
import TextCard from "./components/common/TextCard";
import CarouselCard from "./components/cards/CarouselCard";
import ListRow from "./components/cards/ListRow";
import Drawer from "./components/common/Drawer";
import WhyPanel from "./components/ai/WhyPanel";
import Block from "./components/common/Block";
import Spark from "./components/common/Spark";
import CapTag from "./components/common/CapTag";
import MiniRow from "./components/common/MiniRow";
import DashStat from "./components/common/DashStat";
import FilterChip from "./components/common/FilterChip";
import MultiSelect from "./components/common/MultiSelect";
import WatchAddButton from "./components/common/WatchAddButton";
import ResearchVerdict from "./components/ai/ResearchVerdict";
import HomeView from "./pages/Dashboard";
import DetailPage from "./pages/StockDetail";
import Portfolio from "./pages/PortfolioPage";
import TradeHistory from "./pages/Orders";
import Automation from "./pages/Automation";
import Screener from "./pages/Screener";
import Ideas from "./pages/Ideas";
import WatchlistView from "./pages/Watchlist";
import ChatPanel from "./pages/AIAssistant";
import TradeView from "./pages/Trade";
import ProfileSheet, { LoginScreen, Onboarding, LoginModal } from "./components/auth/Auth";
import SearchOverlay from "./components/common/SearchOverlay";
import MiniCandles from "./components/charts/MiniCandles";
import ProChart from "./components/charts/ProChart";
import PatternChart from "./components/charts/PatternChart";
import { useCandles } from "./hooks/useCandles";
import { useAuth } from "./hooks/useAuth";
import { useMarketData } from "./hooks/useMarketData";
import { usePortfolio } from "./hooks/usePortfolio";
import { useOrders } from "./hooks/useOrders";
import { useNotifications } from "./hooks/useNotifications";
import { getBroker } from "./services/broker/BrokerFactory";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from "recharts";

/* ============================== THEME / CSS ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');
.theme-dark{
  --bg:#0B0B0D; --surface:#151517; --elev:#1D1D20; --ink:#F4F4F6; --ink-soft:#C2C2C8;
  --muted:#86868E; --line:#28282C; --primary:#E8E8EC; --primary-2:#9A9AA2;
  --primary-soft:rgba(232,232,236,.12); --up:#22C55E; --up-soft:rgba(34,197,94,.14);
  --down:#EF4444; --down-soft:rgba(239,68,68,.14); --gold:#C9C9D0; --gold-soft:rgba(200,200,208,.14);
  --lime:#C9FF3D; --grid:rgba(180,180,190,.10); --back:#08080A; --amber:#F59E0B;
  --shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 24px 56px -22px rgba(0,0,0,.85), 0 8px 20px rgba(0,0,0,.4);
  --glow:0 16px 40px rgba(0,0,0,.5);
  --gold-grad:linear-gradient(120deg,#8A8A92,#D8D8DE 45%,#F4F4F6 55%,#A8A8B0);
  --silver-grad:linear-gradient(135deg,#6E6E78 0%,#C9C9D4 30%,#F4F4F8 50%,#B7B7C2 72%,#6E6E78 100%);
  --card-grad:linear-gradient(160deg,#17171A,#111113);
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:radial-gradient(120% 60% at 50% -10%, #1A1A1D 0%, #0E0E10 50%, #08080A 100%);
  --header-bg:rgba(11,11,13,.72);
  --on-primary:#141416;
}
.theme-light{
  --bg:#F7F7F8; --surface:#FFFFFF; --elev:#FBFBFC; --ink:#141416; --ink-soft:#55555C;
  --muted:#9A9AA2; --line:#ECECEE; --primary:#1A1A1D; --primary-2:#8A8A92;
  --primary-soft:#F1F1F3; --up:#10B981; --up-soft:#E6F7F0;
  --down:#EF4444; --down-soft:#FDECEC; --gold:#6E6E78; --gold-soft:#F1F1F3;
  --lime:#C9FF3D; --grid:rgba(20,20,25,.06); --back:#F1F1F3; --amber:#F59E0B;
  --shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 18px 44px -22px rgba(20,20,30,.16), 0 6px 16px rgba(20,20,30,.05);
  --glow:0 14px 32px rgba(20,20,30,.12);
  --gold-grad:linear-gradient(120deg,#9A9AA2,#C9C9D0 45%,#6E6E78);
  --silver-grad:linear-gradient(135deg,#9A9AA6 0%,#CFCFDA 30%,#FFFFFF 50%,#BFBFCC 72%,#9A9AA6 100%);
  --card-grad:linear-gradient(170deg,#FFFFFF,#FBFBFC);
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:linear-gradient(180deg,#FAFAFB 0%,#F5F5F7 100%);
  --header-bg:rgba(247,247,248,.8);
  --on-primary:#FFFFFF;
  --header-bg:rgba(255,255,255,.78);
}
*{box-sizing:border-box}
.mx{font-family:'Nunito',system-ui,sans-serif;color:var(--ink)}
.disp{font-family:'Quicksand','Nunito',sans-serif;letter-spacing:-.01em}
.mono{font-family:'Nunito',sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
.card{background:var(--card-grad);border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow)}
.flat{box-shadow:none}
.pill{border-radius:999px}
.hide-scroll::-webkit-scrollbar{display:none}
.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}
.tap{cursor:pointer;transition:transform .12s ease, box-shadow .12s ease, background .15s ease, opacity .15s}
.tap:active{transform:scale(.97)}
.glow{box-shadow:var(--glow)}
.metal{position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.06), 0 22px 48px -20px rgba(0,0,0,.72)}
.metal::before{content:"";position:absolute;top:0;left:-30%;width:35%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.10) 50%,transparent);transform:skewX(-16deg);pointer-events:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .3s ease both}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet{animation:sheetUp .28s cubic-bezier(.22,1,.36,1) both}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shine{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(160,160,170,.55) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2.6s infinite}
.gradtext{background:linear-gradient(120deg,var(--primary),var(--primary-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.gold-text{background:var(--gold-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.gold-line{height:1px;background:var(--gold-grad);opacity:.85}
.silver-line{height:1px;background:var(--silver-grad);opacity:.7}
.gold-border{border:1px solid transparent;background:linear-gradient(var(--surface),var(--surface)) padding-box, var(--gold-grad) border-box}
.glass{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
input,textarea,select{font-family:inherit;color:var(--ink)}
.no-ring:focus{outline:2px solid var(--primary);outline-offset:1px}
input::placeholder,textarea::placeholder{color:var(--muted)}
select option{background:var(--surface);color:var(--ink)}
`;

/* ============================== HELPERS ============================== */
// Seeded RNG. The first outputs of a raw Lehmer/LCG are strongly correlated with
// the seed (they skew high for typical seeds), so we warm it up before use —
// otherwise anything deciding an outcome on the first draw is badly biased.
// Guarded local storage (won't crash if storage is unavailable, e.g. in preview).


/* ============================== SMALL UI ============================== */


// Real headlines via the proxy (Yahoo / Moneycontrol / NewsAPI). Null in preview.
// Relative time from an ISO timestamp (real news carries real publish times).
// Map app timeframes → Yahoo range/interval (Yahoo lacks 3m/4h, so use nearest supported).

// REAL fundamentals + REAL institutional holders (Yahoo quoteSummary via backend).

// REAL indicators + volume, computed server-side from actual daily candles.

/* ================== REAL EXIT ENGINE (paper-trading) ==================
   Walks REAL intraday candles forward from the entry time and closes a position
   at whichever level is actually touched first — take-profit, stop-loss, or a
   trailing stop that ratchets up behind the highest price seen since entry.
   No random outcomes: exit price, exit time and P&L all come from market data.
   `risk` is read live from the holding, so edits in Portfolio take effect at once.
   Returns null when the position is still open (nothing touched yet).            */
// Trade history flat-file sync (no-ops gracefully without a backend).





export default function App() {
  // Theme persists across sessions — it reset to light on every reload before.
  const [theme, setTheme] = useState(() => lsGet("mx_theme", "light"));
  useEffect(() => { lsSet("mx_theme", theme); }, [theme]);
  const [guest, setGuest] = useState(false);
  const [onboardSkipped, setOnboardSkipped] = useState(false);
  const [profile, setProfile] = useState(null);
  const [repersonalise, setRepersonalise] = useState(false);
  const [tab, setTab] = useState("home");
  const [market, setMarket] = useState("IN");
  const [segment, setSegment] = useState("Stocks");
  /* ---- Composed state (all logic lives in hooks / services) ---- */
  const broker = useMemo(() => getBroker("paper"), []);          // swap for a real adapter later
  const { toast: buyToast, setToast: setBuyToast, notify } = useNotifications();
  const { auth, userId, isAuthed: signedIn, loginOpen, setLoginOpen, login: doLogin, logout: doLogout } = useAuth();
  // `authed` = has entered the app at all (guest OR signed in) — gates the login screen.
  const [authed, setAuthed] = useState(() => Boolean(lsGet("mx_auth", null)));
  const onAuthed = (a) => { doLogin(a); setAuthed(true); };
  const { portfolio, setPortfolio, walletMap, setWalletMap, adjustWallet, updateHolding, intel, health, sectors } = usePortfolio();
  const wallet = walletMap[market] ?? 1000000;
  const { trades, setTrades, recordTrade, recordBatch, placeOrder, riskLimits, setRiskLimits } =
    useOrders({ portfolio, setPortfolio, walletMap, adjustWallet, userId, broker, notify });
  const [histOpen, setHistOpen] = useState(false);
  const [hydratedUser, setHydratedUser] = useState(null);

  /* ---- Orders: the ONLY way to trade. Everything funnels through the pipeline:
         Risk Engine -> Broker Adapter -> Portfolio -> Journal -> Notifications ---- */
  const buyStock = (stock, qty = 1, opts = {}) => { placeOrder({ stock, side: "BUY", qty, opts }); return true; };
  const sellStock = (stock, qty = 1, opts = {}) => { placeOrder({ stock, side: "SELL", qty, opts }); return true; };
  const [priceSnap, setPriceSnap] = useState({});
  useEffect(() => {
    setPriceSnap((prev) => { const m = { ...prev }; portfolio.forEach((h) => { const s = ALL.find((a) => a.sym === h.sym); m[h.sym] = s ? s.price : (prev[h.sym] ?? h.buy); }); return m; });
  }, [portfolio]);
  const [watchlists, setWatchlists] = useState([{ id: "w1", name: "My Watchlist", syms: ["RELIANCE", "TCS"] }]);
  const [activeWl, setActiveWl] = useState("w1");
  // Load this user's saved data whenever the user changes (login / logout).
  useEffect(() => {
    const st = lsGet("mx_state_" + userId, null);
    setPortfolio((st && st.portfolio) || []);
    setWalletMap((st && st.walletMap) || { IN: 1000000, US: 1000000, Crypto: 1000000, FNO: 1000000, Commodity: 1000000 });
    const wl = (st && st.watchlists) || [{ id: "w1", name: "My Watchlist", syms: ["RELIANCE", "TCS"] }];
    setWatchlists(wl); setActiveWl(wl[wl.length - 1] ? wl[wl.length - 1].id : "w1");
    setProfile((st && st.profile) || null);
    setOnboardSkipped(!!(st && st.onboardSkipped));
    setTrades(lsGet("mx_trades_" + userId, []));
    setHydratedUser(userId);
    if (BACKEND_URL) fetchTrades(userId, 0, Date.now()).then((t) => { if (t && t.length) setTrades(t); }).catch(() => {});
  }, [userId]);
  // Persist per-user (only after this user's data has been hydrated, to avoid clobbering).
  useEffect(() => { if (hydratedUser === userId) lsSet("mx_state_" + userId, { portfolio, walletMap, watchlists, profile, onboardSkipped }); }, [portfolio, walletMap, watchlists, profile, onboardSkipped, hydratedUser, userId]);
  useEffect(() => { if (hydratedUser === userId) lsSet("mx_trades_" + userId, trades); }, [trades, hydratedUser, userId]);
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tradePreset, setTradePreset] = useState(null);
  const { live, liveAt, tick: liveTick } = useMarketData(market);

  /* ---- Watchlists ----
     `watch` is every symbol across every list — that is what the star on a card
     reflects. Toggling from a card adds to (or removes from) the ACTIVE list. */
  const watch = useMemo(() => [...new Set(watchlists.flatMap((w) => w.syms || []))], [watchlists]);

  const toggleWatch = (sym) => setWatchlists((ls) => {
    const inAny = ls.some((w) => (w.syms || []).includes(sym));
    if (inAny) return ls.map((w) => ({ ...w, syms: (w.syms || []).filter((x) => x !== sym) }));
    return ls.map((w) => (w.id === activeWl ? { ...w, syms: [...(w.syms || []), sym] } : w));
  });

  const addToWatch = (sym, wlId = activeWl) => setWatchlists((ls) => ls.map((w) => (
    w.id === wlId && !(w.syms || []).includes(sym) ? { ...w, syms: [...(w.syms || []), sym] } : w
  )));

  const createWatchlist = (name) => {
    const id = "w" + Date.now().toString(36);
    setWatchlists((ls) => [...ls, { id, name: (name || "").trim() || "New list", syms: [] }]);
    setActiveWl(id);
    return id;                       // WatchAddButton adds the symbol to this id
  };

  const deleteWatchlist = (id) => setWatchlists((ls) => {
    const next = ls.filter((w) => w.id !== id);
    const safe = next.length ? next : [{ id: "w1", name: "My Watchlist", syms: [] }];
    setActiveWl(safe[safe.length - 1].id);
    return safe;
  });

  /* ---- Navigation ----
     Tapping a card opens the DRAWER (a peek). Scrolling up inside the drawer
     promotes it to the full detail page; scrolling past the bottom of the detail
     page collapses it back to the card. See hooks/useScrollTransition. */
  /* The "Why?" sheet. ONE instance, opened from anywhere — a Pick, an Idea, a
     Trending card, a Portfolio suggestion. Every recommendation Matrix makes must
     be interrogable at the point it is made, not only after digging into a detail
     page. `whyCtx` records WHERE it was opened from, so the panel can say
     "Matrix's Pick for today" rather than leaving the user to guess. */
  const [why, setWhy] = useState(null);
  const openWhy = (s, ctx = null) => setWhy({ s, ctx });

  const openStock = (s) => setDrawer(s);
  const openDetail = (s) => { setDrawer(null); setDetail(s); };
  const goTrade = (s) => { setDrawer(null); setDetail(null); setTradePreset(s); setTab("trade"); };



  // personalised ordering for picks
  const list = useMemo(() => {
    let arr = [...UNIVERSE[market]];
    if (profile) {
      arr.sort((a, b) => {
        const score = (s) => (profile.caps.length && profile.caps.includes(s.cap) ? 3 : 0) + (profile.sectors.includes(s.sector) ? 3 : 0) + (profile.risk === "Aggressive" ? s.chg : profile.risk === "Conservative" ? -Math.abs(s.chg) + (s.cap === "Large" ? 2 : 0) : (s.rsi != null ? (s.rsi - 50) / 10 : 0));
        return score(b) - score(a);
      });
    }
    return arr;
  }, [market, profile]);

  const nav = [["home", Home, "Home"], ["ideas", Lightbulb, "Ideas"], ["ask", Bot, "Ask"], ["automation", Bolt, "Auto"], ["portfolio", Briefcase, "Portfolio"], ["watchlist", Star, "Watch"]];

  return (
    <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* fixed gradient backdrop so it stays behind scroll */}
      <div style={{ position: "fixed", inset: 0, background: "var(--app-bg, var(--bg))", zIndex: 0, pointerEvents: "none" }} />
      {!authed && <LoginScreen onGuest={() => { setGuest(true); setAuthed(true); }} onAuthed={(a) => { onAuthed(a); setGuest(false); setAuthed(true); }} />}
      {authed && hydratedUser === userId && (repersonalise || (!profile && !onboardSkipped)) && (
        <Onboarding
          initial={repersonalise ? profile : null}
          onDone={(p) => { setProfile(p); setRepersonalise(false); setOnboardSkipped(true); }}
          onSkip={() => { setOnboardSkipped(true); setRepersonalise(false); }}
        />
      )}

      <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 86 }}>
        {/* ambient glow */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 420, height: 320, background: "radial-gradient(circle, rgba(150,150,160,.12), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        {/* HEADER */}
        <div className="glass" style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--header-bg)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px", gap: 8 }}>
            <div onClick={() => { setTab("home"); setDetail(null); }} className="tap disp" style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span style={{ color: "var(--primary)", fontSize: 19 }}>✦</span>
              <span className="gradtext" style={{ fontWeight: 700, fontSize: 20 }}>Matrix</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 3 }}>
                <span className="pill" title={`${market} market ${marketOpen(market) ? "open" : "closed"} · ${marketHoursLabel(market)}. Prices refresh every minute.${live ? " Live Yahoo feed." : " Simulated feed — connect the proxy for real data."}`} style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".04em", padding: "2px 6px", display: "flex", alignItems: "center", gap: 3, background: marketOpen(market) ? "var(--up-soft)" : "var(--primary-soft)", color: marketOpen(market) ? "var(--up)" : "var(--muted)" }}>
                  <span style={{ width: 4, height: 4, borderRadius: 4, background: marketOpen(market) ? "var(--up)" : "var(--muted)" }} />{live ? "LIVE" : BACKEND_URL ? (marketOpen(market) ? "NO DATA" : "CLOSED") : "NO DATA"}
                </span>
                {liveAt && <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 700 }}>{new Date(liveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="tap pill" style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--elev)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={15} />}
              </button>
              <div onClick={() => setShowProfile(true)} className="tap pill gold-border" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <Wallet size={15} color="var(--gold)" />
              </div>
              <div onClick={() => setShowProfile(true)} className="tap glow" style={{ width: 34, height: 34, borderRadius: 11, background: "var(--feature-grad)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><User size={17} /></div>
            </div>
          </div>
          <div style={{ padding: "0 18px 14px" }}>
            <div onClick={() => setSearch(true)} className="tap" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", color: "var(--muted)", fontSize: 13.5 }}>
              <Search size={17} /> Search any stock, crypto or commodity…
            </div>
          </div>
          {!detail && ["home", "ideas", "automation", "portfolio"].includes(tab) && (
            <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 12px" }}>
              {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]].map(([k, l]) => (
                <button key={k} onClick={() => setMarket(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (market === k ? "var(--primary)" : "var(--line)"), background: market === k ? "var(--primary)" : "var(--surface)", color: market === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: "0 18px", position: "relative", zIndex: 1 }}>
          {detail ? (
            <DetailPage s={detail} onBack={() => setDetail(null)} watched={watch.includes(detail.sym)} toggleWatch={toggleWatch} onTrade={goTrade} onBuy={buyStock} />
          ) : (
            <>
              {tab === "home" && <HomeView market={market} setMarket={setMarket} segment={segment} setSegment={setSegment} list={list} onOpen={openStock} onBuy={buyStock} watch={watch} toggleWatch={toggleWatch} profile={profile} portfolio={portfolio} wallet={wallet} onGoPortfolio={() => { setDetail(null); setTab("portfolio"); }} onRecord={recordTrade} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} trades={trades} liveTick={liveTick} onWhy={openWhy} />}
              {tab === "trade" && <TradeView walletMap={walletMap} adjustWallet={adjustWallet} portfolio={portfolio} setPortfolio={setPortfolio} preset={tradePreset} market={market} recordTrade={recordTrade} />}
              {tab === "ideas" && <Ideas onOpen={openStock} onBuy={buyStock} market={market} onWhy={openWhy} />}
              {tab === "automation" && <Automation market={market} onRecord={recordTrade} onBuyReal={buyStock} trades={trades} />}
              {tab === "portfolio" && <Portfolio portfolio={portfolio} wallet={wallet} market={market} onGoHome={() => { setDetail(null); setTab("home"); }} onBuy={buyStock} onSell={sellStock} onUpdate={updateHolding} priceSnap={priceSnap} onWhy={openWhy} />}
              {tab === "watchlist" && <WatchlistView watchlists={watchlists} activeWl={activeWl} setActiveWl={setActiveWl} createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist} toggleWatch={toggleWatch} onOpen={openStock} />}
              {tab === "ask" && (
                <div className="fade">
                  <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Ask Matrix</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Your AI markets expert. Ask about any stock, sector or strategy.</div>
                  <div className="card" style={{ padding: 14, height: 520 }}>
                    <ChatPanel suggestions={["Is it a good time to buy Indian IT?", "Explain RSI vs MACD simply", "Build me a swing-trade checklist", "What sectors look strong now?"]} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* BOTTOM NAV
          Deliberately a DIRECT CHILD OF THE ROOT, not of the page wrapper.
          `position: fixed` is measured against the viewport ONLY if no ancestor
          creates a containing block — and a transform, filter or backdrop-filter
          on any ancestor does exactly that. The wrapper contains .glass
          (backdrop-filter), the .fade keyframes (transform) and <Pop>, any of
          which can silently re-anchor a fixed child and make the bar scroll away.
          Hoisting it here removes the possibility entirely. */}
      {!detail && (
        <div className="glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--header-bg)", borderTop: "1px solid var(--line)", borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px rgba(40,10,80,.3)", display: "flex", padding: "9px 4px 11px", zIndex: 100 }}>
          {nav.map(([k, Icon, label]) => (
            <button key={k} onClick={() => { setTab(k); setTradePreset(null); }} className="tap" style={{ flex: 1, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === k ? "var(--primary)" : "var(--muted)" }}>
              <Icon size={20} fill={k === "watchlist" && tab === k ? "var(--primary)" : "none"} />
              <span style={{ fontSize: 9.5, fontWeight: 700 }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {drawer && <Drawer s={drawer} onClose={() => setDrawer(null)} onDetails={openDetail} onBuy={buyStock} />}

      {why && (
        <WhyPanel
          s={why.s}
          market={marketOf(why.s.sym)}
          context={why.ctx}
          onClose={() => setWhy(null)}
          onOpenStock={openStock}
        />
      )}
      {search && <SearchOverlay onClose={() => setSearch(false)} onOpen={openStock} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} />}
      {showProfile && <ProfileSheet profile={profile} walletMap={walletMap} onClose={() => setShowProfile(false)} onTradeHistory={() => setHistOpen(true)} auth={auth} onLogin={() => setLoginOpen(true)} onLogout={doLogout} onPersonalise={() => setRepersonalise(true)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onAuthed={onAuthed} />}
      {histOpen && <TradeHistory userId={userId} trades={trades} onClose={() => setHistOpen(false)} />}
      {buyToast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", zIndex: 90, pointerEvents: "none" }}>
          <div className="card glow" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", maxWidth: 380, border: "1px solid " + (buyToast.e ? "var(--down)" : "var(--up)") }}>
            {buyToast.e ? <X size={16} color="var(--down)" /> : <Check size={16} color="var(--up)" />}
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{buyToast.t}</span>
          </div>
        </div>
      )}
    </div>
  );
}
