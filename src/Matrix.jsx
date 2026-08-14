import React, { useCallback, useState, useMemo, useRef, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";

/* Renders `position: fixed` UI (the bottom nav + bottom-sheet modals) as a DIRECT CHILD OF <body>, so it can
   NEVER be re-anchored by an ancestor that creates a containing block. A transform / filter / backdrop-filter /
   will-change / contain / perspective on ANY ancestor turns `position: fixed` into "fixed relative to that
   ancestor" — which silently makes the bottom bar scroll away and drops a bottom sheet below the fold (so a
   confirm dialog shows only its dark overlay). Portaling to <body>, inside a themed wrapper so the CSS variables
   still resolve, removes that entire class of bug. */
function Portal({ children, theme }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className={"mx theme-" + (theme || "light")}>{children}</div>, document.body);
}
import { fetchIndicators, fetchTrades, marketOpen, postTrade, resolveExitFromCandles, fetchLiveQuotes, apiGetAppSettings, apiSaveAppSettings, apiDeleteAccount, clearVirtualTrades } from "./domain/api";
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
import { getQuotes, getHistory, getNews, getIndicators } from "./services/marketService";
import { ask as aiAsk, interpretScreen, interpretStrategy, marketBrief } from "./services/aiService";
import { saveTrade as apiSaveTrade, listTrades, register as apiRegisterSvc, login as apiLoginSvc, setOnUnauthorized, getAuthToken, saveState as apiSaveState, loadState as apiLoadState } from "./services/tradeService";
import { validateOrder, isMarketOpen, DEFAULT_LIMITS } from "./services/riskService";
import { analyzeStock } from "./services/aiService";
import { recTone } from "./services/researchService";
import { analyzeHolding, portfolioHealth, sectorExposure } from "./services/portfolioService";
import { analyzeJournal } from "./services/journalService";
import BuyButton, { BuyGateContext } from "./components/common/BuyButton";
import { PATTERNS, TF_N } from "./lib/patterns";
import { promptDialog, confirmDialog } from "./lib/confirmDialog";   // in-app prompt/confirm (reliable in webviews/PWA)
import { ALL, UNIVERSE, IN_STOCKS, US_STOCKS, CRYPTO, COMMODITY, marketOf, yahooSymbol, istParts, marketHoursLabel } from "./domain/universe";
import { SEED_STRATS } from "./domain/strategies";
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
import ErrorBoundary from "./components/common/ErrorBoundary";
import WalletSheet from "./components/common/WalletSheet";
import ConfirmOrder from "./components/common/ConfirmOrder";
import BrokerSheet from "./components/common/BrokerSheet";
import { brokerSymbol } from "./domain/brokerSymbols";
import { brokerPlaceOrder, brokerIntentStatus, registerAutoExit, reconcileRealTrades, updateAutoBuy, BROKER_MARKETS, loadBrokerCapabilities, orderTypesOf } from "./services/brokerService";
import { OrderLifecycleStore, deriveIntentKey, interpretResult, classifyError, reconcileAction, ORDER_STATES, planClose } from "./services/orderLifecycle";
import MatrixRain from "./components/common/MatrixRain";
import MLogo from "./components/common/MLogo";
import NeoIcon from "./components/common/NeoIcon";
import headerLogo from "./assets/brand/header-logo.png";
import headerLogoDark from "./assets/brand/header-logo-dark.png";
import Wordmark from "./components/common/Wordmark";
import { Footer, LegalOverlay } from "./components/common/LegalPages";
import Toggle from "./components/common/Toggle";
import { useBroker } from "./hooks/useBroker";
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
import PopularScreeners from "./components/home/PopularScreeners";
/* lazyWithRetry — after a new deploy, an already-open tab still holds the OLD index.js, which
   references chunk filenames (PortfolioPage-<hash>.js) that Vercel has since replaced. The
   dynamic import then 404s: "Failed to fetch dynamically imported module." We catch that once
   and hard-reload to pull the fresh index + chunk hashes; a sessionStorage guard prevents any
   reload loop, and we clear it on the next successful load so future deploys can reload again. */
function lazyWithRetry(importer) {
  return React.lazy(async () => {
    try {
      const m = await importer();
      try { sessionStorage.removeItem("mx_chunk_reload"); } catch {}
      return m;
    } catch (err) {
      let already = false;
      try { already = sessionStorage.getItem("mx_chunk_reload") === "1"; } catch {}
      if (!already) {
        try { sessionStorage.setItem("mx_chunk_reload", "1"); } catch {}
        window.location.reload();
        return new Promise(() => {});   // stay in Suspense until the reload happens
      }
      throw err;                         // genuine failure after a fresh load — let the boundary show it
    }
  });
}
const DetailPage = lazyWithRetry(() => import("./pages/StockDetail"));
const Portfolio = lazyWithRetry(() => import("./pages/PortfolioPage"));
const TradeHistory = lazyWithRetry(() => import("./pages/Orders"));
const Automation = lazyWithRetry(() => import("./pages/Automation"));
const Screener = lazyWithRetry(() => import("./pages/Screener"));
const Ideas = lazyWithRetry(() => import("./pages/Ideas"));
const WatchlistView = lazyWithRetry(() => import("./pages/Watchlist"));
import ChatPanel from "./pages/AIAssistant";
const TradeView = lazyWithRetry(() => import("./pages/Trade"));
import AdminPanel from "./components/common/AdminPanel";
import { adminCheck, adminIsAdminUser } from "./services/adminService";
import ProfileSheet, { LoginScreen, Onboarding, LoginModal, SetUsernameModal } from "./components/auth/Auth";
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
import { useAutomation } from "./hooks/useAutomation";
import { useSquareOff } from "./hooks/useSquareOff";
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
  --shadow:0 22px 46px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.4);
  --glow:0 16px 40px rgba(0,0,0,.5);
  --gold-grad:linear-gradient(120deg,#8A8A92,#D8D8DE 45%,#F4F4F6 55%,#A8A8B0);
  --silver-grad:linear-gradient(135deg,#6E6E78 0%,#C9C9D4 30%,#F4F4F8 50%,#B7B7C2 72%,#6E6E78 100%);
  --card-grad:linear-gradient(165deg, #202024, #151517);
  --card-border:linear-gradient(160deg, rgba(255,255,255,.40), rgba(255,255,255,.05) 42%, rgba(0,0,0,.30));
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:radial-gradient(90% 48% at 96% 108%, #17171a 0%, rgba(23,23,26,0) 60%), linear-gradient(180deg,#121214 0%, #0a0a0b 100%);
  --header-bg:#0B0B0D;
  --on-primary:#141416;
}
.theme-light{
  --bg:#F7F7F8; --surface:#FFFFFF; --elev:#FBFBFC; --ink:#141416; --ink-soft:#55555C;
  --muted:#9A9AA2; --line:#ECECEE; --primary:#1A1A1D; --primary-2:#8A8A92;
  --primary-soft:#F1F1F3; --up:#10B981; --up-soft:#E6F7F0;
  --down:#EF4444; --down-soft:#FDECEC; --gold:#6E6E78; --gold-soft:#F1F1F3;
  --lime:#C9FF3D; --grid:rgba(20,20,25,.06); --back:#F1F1F3; --amber:#F59E0B;
  --shadow:0 20px 42px rgba(35,38,55,.13), 0 4px 12px rgba(35,38,55,.07);
  --glow:0 14px 32px rgba(20,20,30,.10);
  --gold-grad:linear-gradient(120deg,#9A9AA2,#C9C9D0 45%,#6E6E78);
  --silver-grad:linear-gradient(135deg,#9A9AA6 0%,#CFCFDA 30%,#FFFFFF 50%,#BFBFCC 72%,#9A9AA6 100%);
  --card-grad:linear-gradient(165deg, #ffffff, #f7f8fb);
  --card-border:linear-gradient(160deg, #ffffff, rgba(150,153,163,.5) 48%, rgba(96,99,110,.36));
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:radial-gradient(115% 55% at 22% -6%, #ffffff 0%, rgba(255,255,255,0) 55%), radial-gradient(120% 66% at 96% 106%, #eef0f5 0%, rgba(238,240,245,0) 62%), linear-gradient(180deg,#fbfbfd 0%, #eff1f5 100%);
  --header-bg:rgba(247,247,248,.8);
  --on-primary:#FFFFFF;
  --header-bg:#FFFFFF;
}
*{box-sizing:border-box}
.mx{font-family:'Nunito',system-ui,sans-serif;color:var(--ink)}
.disp{font-family:'Quicksand','Nunito',sans-serif;letter-spacing:-.01em}
.mono{font-family:'Nunito',sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
/* UX-4 — shared TYPOGRAPHY SCALE. A single modular scale (≈1.22 ratio) so headings/labels/values are sized
   from one system instead of ad-hoc px. Theme-independent, defined on the app root so any component can use
   var(--fs-*) or the .t-* utilities. .num aligns digits (tabular) without forcing a different font. */
.mx{--fs-2xs:10px;--fs-xs:11px;--fs-sm:12.5px;--fs-md:14px;--fs-lg:16.5px;--fs-xl:20px;--fs-2xl:26px;
    --lh-tight:1.2;--lh-normal:1.45}
.t-2xs{font-size:var(--fs-2xs)}.t-xs{font-size:var(--fs-xs)}.t-sm{font-size:var(--fs-sm)}
.t-md{font-size:var(--fs-md)}.t-lg{font-size:var(--fs-lg)}.t-xl{font-size:var(--fs-xl)}.t-2xl{font-size:var(--fs-2xl)}
.num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
.card{background:var(--card-grad) padding-box,var(--card-border) border-box;border:1px solid transparent;border-radius:28px;box-shadow:var(--shadow)}
/* Design-system pastel section tints (light mode only). Soft Technicolor washes + a glossy top sheen,
   keeping the metallic hairline. Opt-in per section via className. Dark mode is never tinted. */
.theme-light .tint-blue{background:linear-gradient(150deg,rgba(255,255,255,.6),rgba(255,255,255,0) 46%) padding-box,linear-gradient(165deg,rgba(236,245,252,1),#D9EDF8) padding-box,var(--card-border) border-box !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),var(--shadow)}
.theme-light .tint-green{background:linear-gradient(150deg,rgba(255,255,255,.6),rgba(255,255,255,0) 46%) padding-box,linear-gradient(165deg,rgba(240,248,246,1),#E4F1EE) padding-box,var(--card-border) border-box !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),var(--shadow)}
.theme-light .tint-lavender{background:linear-gradient(150deg,rgba(255,255,255,.6),rgba(255,255,255,0) 46%) padding-box,linear-gradient(165deg,rgba(238,236,250,1),#DEDAF4) padding-box,var(--card-border) border-box !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),var(--shadow)}
.flat{box-shadow:var(--shadow)}
.pill{border-radius:999px}
.hide-scroll::-webkit-scrollbar{display:none}
.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}
.tap{cursor:pointer;transition:transform .12s ease, box-shadow .12s ease, background .15s ease, opacity .15s}
.tap:active{transform:scale(.97)}
.glow{box-shadow:var(--glow)}
.metal{position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.06), 0 22px 48px -20px rgba(0,0,0,.72)}
.metal::before{content:"";position:absolute;top:0;left:-30%;width:35%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.10) 50%,transparent);transform:skewX(-16deg);pointer-events:none}
.metalblack{position:relative;overflow:hidden;background:linear-gradient(160deg,#333438 0%,#2B2B2B 45%,#232325 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.04), 0 16px 40px rgba(0,0,0,.45);}
.metalblack::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);pointer-events:none;}
.metalblack::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%,rgba(255,255,255,.04),transparent 55%);pointer-events:none;}
/* Homepage cards — premium metallic treatment: edge highlight + rim light + edge reflection (box-shadow), specular highlight (::before). */
/* Home cards use the mockup recipe verbatim: translucent glass fill + metallic border-box edge + big soft
   drop shadow (all from the theme vars via base .card) + a top-left specular sheen. We only add the glass
   blur + the ::before highlight here; we must NOT re-set border/box-shadow or it flattens the card. */
/* No backdrop-filter here: over the app's radial-graphite background the blur samples the bright top-left glow
   and smears an uneven metallic streak across each card. The mockup's elegance is an EVEN translucent fill, so
   we let --card-grad show flat. Just the specular ::before highlight + the base metallic hairline + shadow. */
.home-metal .card{position:relative}
.home-metal .card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(130% 80% at 18% -12%, rgba(255,255,255,.07), rgba(255,255,255,0) 44%)}
/* Matrix's Picks — soft light-grey cards (dark text), theme-aware. */
.pickcard{background:#F1F1F3 !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75), 0 1px 2px rgba(20,20,30,.06), 0 14px 30px -14px rgba(20,20,30,.24) !important;border:1px solid #E7E7EA !important}
.theme-dark .pickcard{background:#202024 !important;border:1px solid #2c2c30 !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.02), 0 12px 32px rgba(0,0,0,.42) !important}
.theme-light .home-metal .card::before{background:radial-gradient(130% 80% at 18% -12%, rgba(255,255,255,.55), rgba(255,255,255,0) 46%)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .3s ease both}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
/* Bottom-sheet drawers never cover the top 20% of the screen. */
.sheet{animation:sheetUp .28s cubic-bezier(.22,1,.36,1) both;max-height:80vh !important;overflow-y:auto}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shine{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(160,160,170,.55) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2.6s infinite}
.skel{border-radius:14px;background:linear-gradient(90deg,var(--elev),var(--line),var(--elev));background-size:200% 100%;animation:shimmer 1.4s linear infinite}
.gradtext{background:linear-gradient(120deg,var(--ink),var(--muted));-webkit-background-clip:text;background-clip:text;color:transparent}
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





/**
 * Merge the current SEED_STRATS (samples + premium) into a user's SAVED strategy list.
 *
 * Strategies are persisted per user, and the seed only ran the first time. So when we
 * ship new curated strategies (or add the premium flag), existing users never see them —
 * their saved list is frozen at whatever the seed was on their first visit. This reconciles
 * on every load: it refreshes every seed strategy's curated fields (name, rules, premium,
 * description) while preserving the user's runtime state (active/alerts/symbols), adds any
 * new seed strategies, and keeps the user's own strategies untouched.
 */
function seededStrats(saved) {
  const savedArr = Array.isArray(saved) ? saved : [];
  const byId = new Map(savedArr.map((s) => [s.id, s]));
  const seedIds = new Set(SEED_STRATS.map((s) => s.id));
  const merged = SEED_STRATS.map((seed) => {
    const prev = byId.get(seed.id);
    if (!prev) return { ...seed };
    // Refresh curated fields (rules, name, description) from the seed, but PRESERVE the user's own
    // runtime state (active/alerts/symbols) AND their SL/TP + timeframe edits — those are per-user
    // overrides that must survive the session, not reset to the seed default.
    const utf = prev.tf || (prev.cfg && prev.cfg.tf) || seed.tf || (seed.cfg && seed.cfg.tf);
    const cfg = { ...(seed.cfg || {}) };
    if (prev.cfg && prev.cfg.sl != null) cfg.sl = prev.cfg.sl;
    if (prev.cfg && prev.cfg.tp != null) cfg.tp = prev.cfg.tp;
    // Preserve the user's tuned INDICATOR lengths (from "Optimize Indicators") so they survive a
    // reload — otherwise the defs would reset to the seed's default lengths every session.
    if (prev.cfg && Array.isArray(prev.cfg.defs) && prev.cfg.defs.length) cfg.defs = prev.cfg.defs.map((d) => ({ ...d }));
    if (utf) { cfg.tf = utf; cfg.defs = (cfg.defs || []).map((d) => ({ ...d, tf: utf })); }
    return { ...seed, cfg, active: !!prev.active, alerts: !!prev.alerts, symbols: prev.symbols && prev.symbols.length ? prev.symbols : seed.symbols, cap: prev.cap || seed.cap, tf: utf };
  });
  const userOwn = savedArr.filter((s) => !seedIds.has(s.id));
  return [...userOwn, ...merged];
}

function AppInner() {
  // Theme persists across sessions — it reset to light on every reload before.
  const [theme, setTheme] = useState(() => lsGet("mx_theme", "dark"));
  useEffect(() => { lsSet("mx_theme", theme); }, [theme]);
  // Neo FAB auto-hides while scrolling so it never covers the card you're reading, and fades back ~500ms
  // after you stop. A fixed button over full-width cards otherwise always occludes content (UI audit P0).
  const [fabHide, setFabHide] = useState(false);
  useEffect(() => {
    let t;
    const onScroll = () => { setFabHide(true); clearTimeout(t); t = setTimeout(() => setFabHide(false), 500); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, []);
  const [onboardSkipped, setOnboardSkipped] = useState(false);
  const [profile, setProfile] = useState(null);
  /* Auto-Buy on/off PER MARKET. Lifted here (was local to the dashboard, so it reset on
     every reload) and persisted with the rest of the app state — server-side for logged-in
     users, so it survives closing the app. */
  const [autoOnMap, setAutoOnMap] = useState({ IN: false, US: false, Crypto: false, Commodity: false, FNO: false });
  /* Per-market Smart Auto-Buy capital — lifted here and persisted with the app state (server-side
     for logged-in users) so it survives reloads and other devices, instead of quietly reverting
     to the default. Seeded from the old localStorage key for a smooth migration. */
  const [deployCapMap, setDeployCapMap] = useState(() => { const v = lsGet("mx_deploy_capital", {}); return (v && typeof v === "object") ? v : {}; });
  const [remoteHydrated, setRemoteHydrated] = useState(false);   // has the server copy loaded?
  const stateSaveTimer = useRef(null);
  /* Server-side house price feeds (FYERS for Indian equities, Delta for crypto) — reported by
     /api/health. Used to show, per market, whether prices are already live even without the
     user personally connecting a broker. */
  const [houseFeeds, setHouseFeeds] = useState({ fyers: false, delta: true });
  useEffect(() => {
    if (!BACKEND_URL) return;
    fetch(`${BACKEND_URL}/api/health`).then((r) => r.json()).then((d) => setHouseFeeds({ fyers: !!d.fyersHouseFeed, delta: true })).catch(() => {});
  }, []);
  const [repersonalise, setRepersonalise] = useState(false);
  const [tab, setTab] = useState("home");
  const [market, setMarket] = useState("Crypto");
  const [segment, setSegment] = useState("Stocks");
  /* Land at the TOP of every page. Switching tabs used to inherit the previous page's
     scroll position — so tapping Auto could drop you into the middle of the builder.
     (Detail pages get the same treatment via a second effect below, once `detail` is
     declared.) */
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* noop */ } }, [tab]);
  /* ---- Composed state (all logic lives in hooks / services) ---- */
  const broker = useMemo(() => getBroker("paper"), []);          // swap for a real adapter later
  const { toast: buyToast, setToast: setBuyToast, notify } = useNotifications();
  const { auth, userId, isAuthed: signedIn, loginOpen, setLoginOpen, login: doLogin, logout: doLogout } = useAuth();
  // `authed` = has entered the app at all (guest OR signed in) — gates the login screen.
  const [authed, setAuthed] = useState(() => Boolean(lsGet("mx_auth", null)));
  /* A brand-new sign-up skips the personalisation questionnaire and lands straight on the
     homepage. We flag it here; the per-user hydration effect reads the flag and marks
     onboarding as skipped for this account. */
  const freshSignupRef = useRef(false);
  // R20-P1-01: serialize real order submissions that DON'T go through the confirm sheet (instant buy, homepage
  // auto-buy, screener auto-buy). Maps an in-flight intent key → the stable clientRequestId used for that
  // submission, so a rapid double-tap / repeated signal callback / rerender race can't fire two real orders,
  // and a genuine retry reuses the same idempotency identity.
  /* R22-C04: order-intent identity must survive a RELOAD, not just a promise. Ambiguous intents (broker outcome
     unknown) are mirrored to localStorage; on mount we rehydrate them so a retry after a refresh reuses the SAME
     idempotency key (the server dedupes/replays) instead of minting a new one that could double the order. */
  /* P3-05: the ONE durable order-lifecycle store, shared by EVERY real-order surface (confirm drawer, options,
     instant, screener). Intents are namespaced by the authenticated user (no shared global blob), persisted so a
     retry after reload reuses the SAME idempotency key, and only cleared on a conclusive outcome. */
  const orderStoreRef = useRef(null);
  if (!orderStoreRef.current) orderStoreRef.current = new OrderLifecycleStore(userId);
  useEffect(() => { orderStoreRef.current.setUser(userId); }, [userId]);
  const onAuthed = (a, opts) => { doLogin(a); setAuthed(true); if (opts && opts.fresh) freshSignupRef.current = true; };
  const { portfolio, setPortfolio, walletMap, setWalletMap, adjustWallet, updateHolding, intel, health, sectors } = usePortfolio();

  /* Every wallet top-up, timestamped. Without this the equity curve cannot know
     WHEN money arrived, and a deposit made yesterday would otherwise be smeared
     backwards across the whole history, overstating what the portfolio was worth
     last month. Recorded from now on; see useEquityCurve for how pre-ledger
     top-ups are handled (folded into a derived opening balance, not invented). */
  /* The cold-open. Once per browser session — a splash on every route change is a
     tax, not a flourish. It renders OVER the app, so quotes are already loading
     behind it; it never delays the first price. */
  const [splash, setSplash] = useState(() => {
    try { return !sessionStorage.getItem("mx_splash_seen"); } catch { return true; }
  });
  const endSplash = useCallback(() => {
    try { sessionStorage.setItem("mx_splash_seen", "1"); } catch { /* private mode */ }
    setSplash(false);
  }, []);

  /* VIRTUAL vs REAL.
     Virtual  = paper wallet, virtual capital, filled at the real live price.
     Real     = the user's actual broker account. Real holdings, real money.
     Default is Virtual, always, and the mode is NOT remembered across sessions —
     waking up in Real mode because of a tap you made yesterday is exactly the kind
     of thing that costs somebody money. You opt in each time. */
  const [mode, setModeRaw] = useState(() => (lsGet("mx_mode") === "real" ? "real" : "virtual"));
  const setMode = useCallback((v) => { lsSet("mx_mode", v); setModeRaw(v); }, []);
  const [confirmReal, setConfirmReal] = useState(false);   // arming Real needs a deliberate yes

  const [deposits, setDeposits] = useState([]);

  const [brokerOpen, setBrokerOpen] = useState(false);
  const [brokerMktFilter, setBrokerMktFilter] = useState(null);   // limit the broker sheet to one market
  const openBrokers = (mkt) => { setShowProfile(false); setBrokerMktFilter(mkt || null); setBrokerOpen(true); };
  const [brokerPrompt, setBrokerPrompt] = useState(false);   // shown once, after onboarding

  /* A connected broker overwrites the delayed Yahoo prices with live ones, in place.
     Nothing downstream changes — the numbers just stop being 15 minutes old.

     We count broker ticks ourselves: useMarketData's tick is read-only, and the memos
     keyed on it (Hot Stocks, Picks) would otherwise freeze while live broker prices
     changed underneath them. */
  const [brokerTicks, setBrokerTicks] = useState(0);

  const {
    connected: brokerLive, broker: liveBroker, connect: connectBroker, disconnect: disconnectBroker,
    lastTick: brokerTick, real: realPortfolio, realErr, realLoading, refreshPortfolio, session: brokerSession,
    brokerFor, marketMap: brokerMarketMap, connectedBrokers, reconnectHints,
    serverBrokerFor,
  } = useBroker({ onTick: () => setBrokerTicks((t) => t + 1), userId });

  /* DAILY RECONNECT NUDGE. Broker tokens expire every morning (SEBI). Rather than silently sliding a
     previously-connected user onto delayed Yahoo prices, we surface a one-tap "reconnect" banner.
     Held back a few seconds after mount so auto-resume (for users whose creds are on the server) can
     reconnect first and never see it. Dismissible for the rest of the day. */
  const [reconnectReady, setReconnectReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReconnectReady(true), 4000); return () => clearTimeout(t); }, []);
  const [reconnectDismissed, setReconnectDismissed] = useState(() => {
    try { return localStorage.getItem("mx_reconnect_dismissed") === new Date().toDateString(); } catch { return false; }
  });
  const reconnectHint = reconnectReady && !reconnectDismissed && reconnectHints && reconnectHints[0] ? reconnectHints[0] : null;
  const dismissReconnect = () => { try { localStorage.setItem("mx_reconnect_dismissed", new Date().toDateString()); } catch { /* ignore */ } setReconnectDismissed(true); };

  /* Real mode is only reachable with a broker attached. If the broker drops (token
     expired — they expire daily), fall straight back to Virtual rather than leaving
     the user in a "Real" mode that has no account behind it. */
  useEffect(() => {
    // Only fall back to Virtual if there is NO broker behind this account at all — neither a live per-device session
    // NOR server-held creds. On a fresh device the session handle resumes a moment after login; bouncing on the raw
    // `!brokerLive` alone is exactly what made Real work on mobile but not the laptop. Server creds keep Real available
    // across devices while the session resumes; order placement still requires a live routed session.
    const hasAnyBroker = brokerLive || (serverBrokerFor && (serverBrokerFor("IN") || serverBrokerFor("US") || serverBrokerFor("Crypto") || serverBrokerFor("Commodity")));
    if (mode === "real" && !hasAnyBroker) {
      setMode("virtual");
      setBuyToast({ t: "Broker disconnected — back to Virtual mode", e: true });
    }
  }, [mode, brokerLive, serverBrokerFor]);

  useEffect(() => {
    // Re-pull whenever the market changes too, so the Real portfolio matches the tab
    // (Crypto -> Delta holdings, Indian -> FYERS holdings, …).
    if (mode === "real" && brokerLive) refreshPortfolio(market);
  }, [mode, brokerLive, market, refreshPortfolio]);

  /* Strategies live at APP ROOT, not inside the Automation page. They used to be
     page-local state, so they were thrown away the moment you navigated to Home —
     an "always-on" strategy that only existed while you were looking at it. */
  const [strats, setStrats] = useState(SEED_STRATS);

  const wallet = walletMap[market] ?? 1000000;
  const { trades, setTrades, recordTrade, recordBatch, closeTrade, updateTradeRow, placeOrder, riskLimits, setRiskLimits, riskSaveStatus } =
    useOrders({ portfolio, setPortfolio, walletMap, adjustWallet, userId, broker, notify });
  const [histOpen, setHistOpen] = useState(false);
  // Persistent ACTIVITY LOG — toasts vanish; this keeps the last 50 actions/results (orders,
  // rejects, connects, arms) so you can verify "did that go through?" after the fact.
  const [activity, setActivity] = useState(() => { try { return JSON.parse(localStorage.getItem("mx_activity") || "[]"); } catch { return []; } });
  const [activityOpen, setActivityOpen] = useState(false);
  useEffect(() => {
    if (!buyToast || !buyToast.t) return;
    if (buyToast.transient) return;   // passive background status toasts are shown but never logged as an action
    setActivity((prev) => {
      // Don't log a duplicate of the most recent entry (a repeated identical status shouldn't stack up).
      if (prev[0] && prev[0].text === buyToast.t && Date.now() - (prev[0].at || 0) < 6 * 3600 * 1000) return prev;
      const next = [{ at: Date.now(), text: buyToast.t, err: !!buyToast.e }, ...prev].slice(0, 50);
      try { localStorage.setItem("mx_activity", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [buyToast]);
  const clearActivity = () => { setActivity([]); try { localStorage.removeItem("mx_activity"); } catch {} };
  const [hydratedUser, setHydratedUser] = useState(null);

  /* ---- Orders: the ONLY way to trade. Everything funnels through the pipeline:
         Risk Engine -> Broker Adapter -> Portfolio -> Journal -> Notifications ---- */
  /* MANUAL orders go through a confirmation sheet. AUTOMATED ones do not: a
     strategy you already armed is not a decision you are making right now, and a
     confirm dialog you cannot answer (because you are asleep) would simply stop it
     from ever firing. So automation calls placeOrder directly, via *Now below. */
  const [confirmOrder, setConfirmOrder] = useState(null);
  // P3-05: the confirm drawer stays MOUNTED until the broker outcome is known. `confirmBusy` disables a repeat
  // submit while placing/reconciling; `confirmNote` surfaces an ambiguous ("outcome unknown") state in the drawer.
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmNote, setConfirmNote] = useState(null);
  // R42-P2-04: server-owned broker capability matrix (incl. per-broker supported order types) so the confirm drawer
  // renders only certified order types for the connected broker. Loaded once; fail-open (backend still enforces).
  const [brokerCaps, setBrokerCaps] = useState({ capabilities: {}, orderTypes: {} });
  useEffect(() => { loadBrokerCapabilities().then((c) => c && setBrokerCaps(c)).catch(() => {}); }, []);

  /* Buying — even a VIRTUAL/paper buy — requires a signed-in account. A guest who taps
     Buy is sent to the login screen instead of placing an order, so paper trades always
     belong to a real user id (and carry over across devices once they sign in). */
  const requireLogin = () => {
    if (auth) return true;
    setBuyToast({ t: "Log in to trade — buying needs an account." });
    setLoginOpen(true);
    return false;
  };
  /* COMPLIANCE GATE: virtual (paper) trading is admin-gated per market group, both default OFF.
     Indian (NSE/BSE/MCX) is restricted under SEBI's May-2024 norms; Global (US+crypto) is a
     separate opt-in. A non-admin can only place a virtual buy where the admin has enabled it. */
  const virtualBlocked = (mkt) => {
    if (effAdmin || mode !== "virtual") return false;
    const m = marketOf(mkt) || market;
    const av = (appSettings && appSettings.allowVirtual) || { IN: false, Global: false };
    const group = (m === "IN" || m === "Commodity") ? "IN" : "Global";
    return !av[group];
  };
  /* Whether the Buy button should even be SHOWN for a symbol. A non-admin has no legal way
     to buy in a market where paper trading is admin-disabled AND they have no broker connected
     for that market — so we hide Buy entirely rather than show a button that always errors.
     Connecting a broker (real trade) OR the admin enabling virtual for the group brings it back. */
  const canBuy = (sym) => {
    if (effAdmin) return true;
    const m = marketOf(sym) || market;
    const av = (appSettings && appSettings.allowVirtual) || { IN: false, Global: false };
    const group = (m === "IN" || m === "Commodity") ? "IN" : "Global";
    if (av[group]) return true;                     // paper trading enabled for this group
    // Real path: needs BOTH a connected broker for this market AND Real mode allowed for it.
    // A broker connected but Real mode off for that market → no Buy button.
    return canRealMode(m) && Boolean(brokerFor && brokerFor(m));
  };
  const buyStock  = (stock, qty = 1, opts = {}) => {
    if (!requireLogin()) return false;
    const mkt = marketOf(stock.sym) || market;
    if (virtualBlocked(mkt)) { setBuyToast({ t: (mkt === "IN" || mkt === "Commodity") ? "Paper trading isn't available for Indian markets. Connect your broker to trade for real." : "Virtual trading isn't enabled for this market.", e: true }); return false; }
    setConfirmNote(null);   // clear any stale "outcome unknown" note from a PRIOR order when opening a fresh drawer
    setConfirmOrder({ s: stock, qty, side: "BUY",  opts, market: mkt, lot: opts.lot || 1, actionId: newActionId() }); return true;
  };
  const sellStock = (stock, qty = 1, opts = {}) => { setConfirmNote(null); setConfirmOrder({ s: stock, qty, side: "SELL", opts, market: opts.market || marketOf(stock.sym) || market, lot: opts.lot || 1, actionId: newActionId() }); return true; };

  /* AUTO-BUY places orders WITHOUT the per-trade confirm drawer. In Real mode the first
     time it's about to fire we show a single heads-up (see Dashboard), then never again.
     Auto-sell on SL/TP is already handled by the exit monitor in useOrders. */
  const autoBuyNow = (stock, qty = 1, opts = {}) => buyStockNow(stock, qty, { ...opts, tradeType: "Auto Buy" });
  /* SCREENER AUTO-BUY — same mechanics as Auto-Buy (no confirm sheet, SL/TP armed, real or paper by
     mode), but journalled under its own trade type so its P&L is attributable separately on the
     dashboard and in history. Fired by the homepage "Popular Screeners" carousels and by any
     user-built "Create your own screener". */
  const screenerBuyNow = (stock, qty = 1, opts = {}) => buyStockNow(stock, qty, { ...opts, tradeType: "Screener Auto Buy" });
  /* Place a REAL market order WITHOUT the confirm sheet (for instant/auto buys). Routes by
     market to the connected broker, attaches SL/TP, and hands exits to the engine. Used when
     the app is in REAL mode so instant buys and Auto-Buy actually move real money. */
  const placeRealMarketOrder = async (s, side, q, prod, opts = {}) => {
    const mkt = marketOf(s.sym) || s.market || market;
    const route = brokerFor(mkt);
    if (!route) { setBuyToast({ t: `No broker connected for ${MKT_LABEL[mkt] || mkt} — cannot place a real order`, e: true }); return { ok: false, state: ORDER_STATES.REJECTED, reason: "no broker" }; }
    const bsym = brokerSymbol(s.sym, route.id);
    if (!bsym) { setBuyToast({ t: `${route.meta.name} can't trade ${s.sym} — no symbol mapping`, e: true }); return { ok: false, state: ORDER_STATES.REJECTED, reason: "no symbol mapping" }; }
    const brokerName = route.meta.name;   // the ACTUALLY-ROUTED broker for this market — never liveBroker.name
    /* P3-05: the ONE durable intent state machine. deriveIntentKey folds in product + every protection leg so
       two deliberately-different orders aren't collapsed, while rapid identical taps DO collapse. A caller with
       its own durable identity (candle-keyed auto/screener buy) passes opts.intentKey/opts.clientRequestId. */
    const intentKey = opts.intentKey || deriveIntentKey({ brokerId: route.id, brokerSym: bsym, side, qty: q, product: prod, sl: opts.sl, tp: opts.tp, tsl: opts.tsl, strategy: opts.strategy, orderType: opts.orderType, limitPrice: opts.limitPrice, triggerPrice: opts.triggerPrice, target: opts.target, stopLoss: opts.stopLoss });
    const begun = orderStoreRef.current.beginSubmit(intentKey, { clientRequestId: opts.clientRequestId || null, mint: newActionId });
    if (begun.blocked) { setBuyToast({ t: "That order is already being placed — please wait.", e: true }); return { ok: false, state: ORDER_STATES.SUBMITTING, blocked: true, brokerName }; }
    const reqId = begun.reqId;
    opts = { ...opts, clientRequestId: reqId };
    try {
      const isDelta = route.id === "delta";
      // SL/TP/exits apply to BOTH longs and shorts — the backend mirrors the levels by side.
      const wantExit = (opts.sl > 0 || opts.tp > 0 || opts.tsl > 0 || !!opts.strategy);
      const useEngine = wantExit && (!isDelta || opts.tsl > 0 || !!opts.strategy);
      const r = await brokerPlaceOrder(route.session, userId, {
        symbol: bsym, side, qty: q, orderType: opts.orderType || "MARKET", product: prod || "CNC",
        entryPrice: s.price ?? undefined,
        // Advanced order-type params (from the manual order-options panel). Undefined ⇒ a plain Market order.
        limitPrice: opts.limitPrice > 0 ? opts.limitPrice : undefined,
        triggerPrice: opts.triggerPrice > 0 ? opts.triggerPrice : undefined,
        target: opts.target > 0 ? opts.target : undefined,
        stopLoss: opts.stopLoss > 0 ? opts.stopLoss : undefined,
        slPct: opts.sl > 0 ? opts.sl : undefined,
        tpPct: opts.tp > 0 ? opts.tp : undefined,
        tslPct: opts.tsl > 0 ? opts.tsl : undefined,
        autoExit: useEngine || opts.autoExit || undefined,
        strategy: opts.strategy || undefined,
        // R27-P2-02: unambiguous strategy NAME (distinct from the exit-config `strategy` field) so the server
        // can stamp durable attribution on the authoritative fill — the Screener/Automate card matches on it.
        strategyName: opts.strategy || undefined,
        // R27-P1-02: a reduce-only CLOSE must be flagged so the server treats it as an exit (exempt from
        // new-entry gates) and sets the broker-native reduce-only flag — never opening/reversing exposure.
        reduceOnly: opts.reduceOnly || undefined,
        // C01: the ENTRY order id of the position being closed, so the server books the exit against the right
        // open position (immutable exit leg + realized P&L) instead of creating a phantom opposite entry.
        entryOrderId: opts.entryOrderId || undefined,
        // ONE stable idempotency key for this intent — reused verbatim on any retry/reload so the server
        // dedupes/replays the single order rather than placing a second.
        clientRequestId: reqId,
        riskLimits,   // user's opt-in caps (off by default) — the server check enforces them
      }, true);
      const status = r.status || "filled";                          // filled | partial | PENDING | REJECTED | FILLED
      const { state, confirmedFilled } = interpretResult(r);
      const statusLc = String(status).toLowerCase();
      // SELF-REVIEW fix: only treat a CONFIRMED fill as a position. A PENDING/rejected-after-accept order
      // must NOT be journaled with a live entry price (that was a phantom position with fake P&L).
      const fillQty = Number(r.filledQty) > 0 ? Number(r.filledQty) : (confirmedFilled ? q : 0);
      const fillPx = Number(r.avgPrice) > 0 ? Number(r.avgPrice) : (s.price ?? undefined);
      let t;
      if (state === ORDER_STATES.PENDING || state === ORDER_STATES.ACCEPTED) t = `Real ${side.toLowerCase()} order PLACED on ${brokerName} — awaiting fill; verify in your broker`;
      else if (state === ORDER_STATES.REJECTED) t = `Real ${side.toLowerCase()} order REJECTED on ${brokerName}`;
      else if (state === ORDER_STATES.CANCELLED) t = `Real ${side.toLowerCase()} order CANCELLED on ${brokerName}`;
      else if (state === ORDER_STATES.UNKNOWN) t = `Real ${side.toLowerCase()} order sent to ${brokerName} — outcome unknown; verify in your broker`;
      else t = `Real ${side.toLowerCase()} ${state === ORDER_STATES.PARTIAL ? `PARTIALLY filled (${fillQty}/${q})` : "filled"} on ${brokerName}`;
      // SL/TP feedback — and, crucially, WARN when the user asked for a stop but it was NOT armed
      // (e.g. FYERS entry still pending, or a short we can't manage), so they don't assume protection.
      if (opts.sl > 0 || opts.tp > 0) {
        if (isDelta && r.bracket && r.bracket.placed) t += " · SL/TP set";
        else if (r.autoExitId) t += " · auto-exit armed";
        else if (r.autoExitNote || !confirmedFilled) t += " · ⚠ SL/TP NOT armed — set it in your broker";
      }
      // C01: a REDUCE-ONLY close is an EXIT, never a new position — do NOT journal an entry-semantics row for it
      // (that was the phantom opposite-side position). The server authoritatively closes/reduces the referenced
      // open row and books realized P&L (the browser can't write onto a server-authored row anyway); the caller
      // (closePositionRow) updates the local view for immediate feedback and reconciles on the next fetch.
      /* R32-P3-03: real trade HISTORY must be rendered only from SERVER-AUTHORED records. When a backend is present
         (production), we do NOT write a client-authored real row into the persistent trades model at all — the toast
         above is the transient order-intent feedback, and the authoritative row arrives via refreshPortfolio +
         fetchTrades below (server dedupes/canonicalises by orderId). Only in a no-backend/local build do we keep the
         local row so the demo still shows something. This removes the duplicate/local-truth display interval. */
      if (!opts.reduceOnly && !BACKEND_URL) {
        // Journal the real order with its FILL STATUS. For an unconfirmed order we record it WITHOUT an entry
        // price (mirrors the reject path) so no phantom open position or P&L is created.
        try {
          recordTrade({
            id: `real-${r.orderId || Date.now()}`, sym: s.sym, market: mkt, qty: confirmedFilled ? fillQty : q, side,
            short: side === "SELL" || undefined, broker: route.id,   // stamp broker so reconcile can attribute precisely
            ...(confirmedFilled ? { entry: fillPx } : {}), entryAt: Date.now(), tradeType: opts.tradeType || "Manual",
            // R27-P2-02: carry the strategy attribution so a real Screener/Automate fill stays tied to its card
            // (card P&L + Live Positions match on t.strategy). strategyId is preferred (immutable) when present.
            ...(opts.strategy ? { strategy: opts.strategy } : {}), ...(opts.strategyId ? { strategyId: opts.strategyId } : {}),
            real: true, status, orderId: r.orderId || null, tp: opts.tp || undefined, sl: opts.sl || undefined,
            // R31-P3-03: mark this as a CLIENT-authored display projection, not authoritative truth. The server
            // writes the authoritative real row (canonicalised by orderId); this local row exists only for instant
            // feedback and is SUPERSEDED by the server row on the next reconcile (dedupe prefers serverAuthored).
            clientAuthored: true,
          });
        } catch {}
      }
      // A broker RESPONSE is conclusive for the client intent → release the key (memory + persisted).
      orderStoreRef.current.settleTerminal(intentKey);
      setBuyToast({ t, e: state === ORDER_STATES.REJECTED }); refreshPortfolio();
      // R27-P1-01: return the broker-verified fill facts so a CLOSE caller only books an exit on a real fill.
      return { ok: state !== ORDER_STATES.REJECTED, state, orderId: r.orderId || null, brokerName, statusLc, confirmedFilled: !!confirmedFilled, filledQty: fillQty, avgPrice: fillPx };
    } catch (e) {
      const { conclusive, state, reason } = classifyError(e);
      /* Only a CONCLUSIVE broker rejection means nothing executed — release the key so a fresh order (new id) is
         allowed. An AMBIGUOUS failure (timeout / 5xx / idempotency in-flight / risk-lock) is NOT a rejection: the
         SAME reqId is retained as `unknown`, a retry reuses it (server dedupes/replays), and we prompt to
         reconcile rather than mint a new action that could double the order. Never labelled "Broker rejected". */
      if (conclusive) {
        orderStoreRef.current.settleTerminal(intentKey);
        try { recordTrade({ id: `rej-${Date.now()}-${s.sym}`, sym: s.sym, market: mkt, qty: q, side, short: side === "SELL" || undefined, broker: route.id, entryAt: Date.now(), tradeType: opts.tradeType || "Manual", real: true, status: "rejected", rejectReason: reason }); } catch {}
        setBuyToast({ t: `Order rejected: ${reason}`, e: true });
        return { ok: false, state, reason, brokerName };
      }
      orderStoreRef.current.markUnknown(intentKey, reqId, route.id);
      setBuyToast({ t: `Couldn't confirm your ${side.toLowerCase()} order on ${brokerName} — outcome unknown; check your broker before retrying. A retry reuses the same order (no duplicate).`, e: true });
      return { ok: false, state: ORDER_STATES.UNKNOWN, reason, brokerName };
    }
  };
  const buyStockNow  = (stock, qty = 1, opts = {}) => {
    if (!auth) { setBuyToast({ t: "Log in to trade — buying needs an account." }); setLoginOpen(true); return false; }
    // A Sell/short intent (crypto & Indian options) rides in on opts.side; everything else is a BUY.
    const side = opts.side === "SELL" ? "SELL" : "BUY";
    // REAL mode -> real broker order (auto-buy included) through the ONE durable lifecycle; RETURN its promise so
    // callers (the confirm drawer / option picker) can AWAIT the true outcome instead of assuming success.
    // Otherwise the paper book — a plain boolean; paper never touches the real-order lifecycle.
    if (mode === "real") return placeRealMarketOrder(stock, side, qty, opts.product || "CNC", opts);
    if (virtualBlocked(marketOf(stock.sym) || market)) { setBuyToast({ t: "Paper trading isn't enabled for this market.", e: true }); return false; }
    placeOrder({ stock, side, qty, opts }); return true;
  };
  const sellStockNow = (stock, qty = 1, opts = {}) => { placeOrder({ stock, side: "SELL", qty, opts }); return true; };
  /* Close ONE open position from a Live Positions list (Screener / Automate cards). In real mode it fires a
     reduce-only broker flatten through the ONE durable lifecycle (same as Automate's "Stop & sell"); in paper
     mode it just books the exit. Either way the originating journal row is marked exited so it leaves the live
     list. `flatten` is the opposite side of the position (SELL closes a long, BUY covers a short). */
  const closePositionRow = async (trade) => {
    if (!trade || trade.exitAt != null) return;
    const stock = ALL.find((a) => a.sym === trade.sym) || { sym: trade.sym, price: trade.entry, market: trade.market || market };
    const qty = Number(trade.qty) || 0;
    const mkt = marketOf(trade.sym) || trade.market || market;
    if (mode === "real") {
      /* R27-P1-01: a REAL close is a broker action, not a local write. Confirm, AWAIT the reduce-only order,
         and only book the exit on a BROKER-CONFIRMED fill (at the real fill price/qty). On reject / pending /
         partial / unknown we KEEP the position visible and tell the user to verify — never a false "Closed". */
      if (qty <= 0) { setBuyToast({ t: "Nothing to close for this position.", e: true }); return; }
      const ok = await confirmDialog(`Close ${trade.sym} now? This places a reduce-only market order on your broker.`, { title: "Close position", confirmLabel: "Close" });
      if (!ok) return;
      const flatten = (trade.side === "SELL" || trade.short) ? "BUY" : "SELL";
      let res;
      try {
        res = await placeRealMarketOrder(stock, flatten, qty, trade.product || "CNC", { tradeType: trade.tradeType || "Screener Auto Buy", reduceOnly: true, market: mkt, strategy: trade.strategy || undefined, strategyId: trade.strategyId || undefined, entryOrderId: trade.orderId || undefined });
      } catch { res = null; }
      // R28/M07: the full-vs-partial-vs-unconfirmed decision is the pure, unit-tested planClose() — the live path
      // and the tests share ONE implementation so a partial fill can never be mis-booked as a full close.
      const plan = planClose({ qty, price: stock.price, entry: trade.entry }, res);
      if (plan.action === "full") {
        closeTrade(trade, plan.exitPx, "Manual");
        setBuyToast({ t: `Closed ${trade.sym} — broker-confirmed at ${fmt(plan.exitPx, mkt)}` });
      } else if (plan.action === "partial") {
        // A PARTIAL close must NOT mark the whole position closed. Reduce the tracked qty by the amount actually
        // filled and keep the residual OPEN so the exposure isn't hidden; the user can close the rest.
        updateTradeRow(trade.id, { qty: plan.residualQty });
        setBuyToast({ t: `Partially closed ${trade.sym} (${plan.closedQty}/${qty} at ${fmt(plan.exitPx, mkt)}) — ${plan.residualQty} still open. Close again to flatten.` });
      } else {
        // Unconfirmed: placeRealMarketOrder already surfaced the reject/pending/unknown reason; the position stays visible.
        setBuyToast({ t: `Close not confirmed for ${trade.sym} — it stays open until your broker confirms the exit. Verify in your broker.`, e: true });
      }
      return;
    }
    // Paper: book the exit at the live price (display-only journal).
    const px = stock && stock.price != null ? stock.price : trade.entry;
    closeTrade(trade, px, "Manual");
    setBuyToast({ t: `Closed ${trade.sym} position` });
  };
  /* Edit a live position's SL / TP from a Live Positions list. R27-P2-01: in REAL mode this must be an
     AUTHORITATIVE broker action — it only claims success after the server confirms, and a real row with no
     server-managed id is refused (protection lives at the broker) rather than faking a UI-only success. */
  const updatePositionRisk = async (trade, patch) => {
    if (!trade || !trade.id) return;
    // Validate levels: a blank clears; anything else must be a positive number.
    const clean = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
    const next = {};
    if (patch.sl !== undefined) { const v = clean(patch.sl); if (v === undefined) { setBuyToast({ t: "Stop-loss % must be a positive number.", e: true }); return; } next.sl = v; }
    if (patch.tp !== undefined) { const v = clean(patch.tp); if (v === undefined) { setBuyToast({ t: "Target % must be a positive number.", e: true }); return; } next.tp = v; }
    const managedId = trade.managedId || trade.autoBuyId || null;
    if (mode === "real") {
      if (!managedId) { setBuyToast({ t: `${trade.sym} isn't a server-managed position — set SL/TP in your broker app. Not changed here.`, e: true }); return; }
      try {
        await updateAutoBuy(userId, managedId, next);   // throws on non-ok / error envelope
        updateTradeRow(trade.id, next);
        setBuyToast({ t: `SL/TP updated at your broker for ${trade.sym}` });
      } catch (e) {
        setBuyToast({ t: `Couldn't update SL/TP at your broker for ${trade.sym} — unchanged. ${String(e.message || "")}`.trim(), e: true });
      }
      return;
    }
    // Paper: journal-only edit (paper exit monitor reads these levels).
    updateTradeRow(trade.id, next);
    setBuyToast({ t: `Updated SL/TP for ${trade.sym}` });
  };
  /* INC-3 / ARCH-4: on load (and when auth changes) reconcile any AMBIGUOUS order intents left in localStorage
     after a timeout/reload. Ask the server what became of each idempotency key: a terminal outcome clears the
     pending state (and a confirmed fill refreshes the portfolio); an unresolved one is left so it stays
     reconcilable. Never re-submits an order — read-only resolution. */
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    /* R24-P2-06: each unresolved intent is polled with BOUNDED backoff until it reaches a terminal state, instead
       of a single one-shot check. A read failure or an in_flight/unknown/none result keeps the intent BLOCKED
       (never cleared) so a duplicate submit stays impossible; only a broker-proven succeeded/rejected clears it.
       Read-only — an order is never resubmitted here. */
    const DELAYS = [0, 4000, 8000, 16000];   // 4 attempts over ~28s
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const store = orderStoreRef.current;
      let warnedUnknown = false;
      for (const { intentKey, reqId } of store.persisted()) {
        let resolved = false;
        for (const delay of DELAYS) {
          if (cancelled) return;
          if (delay) await wait(delay);
          if (cancelled) return;
          const res = await brokerIntentStatus(userId, reqId).catch(() => null);
          if (!res) continue;                                  // read failed → NOT proof of absence; keep blocked, retry
          const action = reconcileAction(res);
          if (action === "clear-success") {
            store.settleTerminal(intentKey);
            setBuyToast({ t: "A pending order was confirmed at your broker — your history is up to date." });
            refreshPortfolio(); resolved = true; break;
          }
          if (action === "clear-retryable") { store.settleTerminal(intentKey); resolved = true; break; }
          // retain-blocked (in_flight / unknown / none) → keep polling with backoff
        }
        if (!resolved && !warnedUnknown) {
          warnedUnknown = true;
          // `transient`: this is a passive background re-check that runs on every app open — show it once as a
          // toast, but do NOT append it to the Activity log. Otherwise a single stuck intent stacks up a fresh
          // "still unknown" entry every session (the bug the user saw). The Activity log records ACTIONS, not
          // repeated status polls.
          setBuyToast({ t: "An earlier order's outcome is still unknown — we're checking your broker. It won't be resubmitted automatically.", transient: true });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, userId]);
  /* Arm a stop-loss / take-profit / trailing-stop on an EXISTING real holding (from My
     Portfolio in real mode). Resolves the broker symbol, then registers a server auto-exit so
     the engine sells reduce-only when a level is hit. Entry defaults to the holding's avg cost. */
  const armRealExit = async (holding, risk = {}) => {
    const mkt = marketOf(holding.sym) || holding.market || market;
    const route = brokerFor(mkt);
    if (!route) { setBuyToast({ t: `No broker connected for ${MKT_LABEL[mkt] || mkt}`, e: true }); return false; }
    const bsym = brokerSymbol(holding.sym, route.id);
    if (!bsym) { setBuyToast({ t: `${route.meta.name} can't map ${holding.sym}`, e: true }); return false; }
    if (!(risk.sl > 0) && !(risk.tp > 0) && !(risk.tsl > 0)) { setBuyToast({ t: "Set a stop-loss, target or trailing stop first", e: true }); return false; }
    try {
      await registerAutoExit(userId, {
        broker: route.id, symbol: holding.sym, brokerSym: bsym, qty: holding.qty,
        entry: holding.avg != null ? holding.avg : holding.ltp, market: mkt,
        sl: risk.sl, tp: risk.tp, tsl: risk.tsl, product: "CNC",
      });
      setBuyToast({ t: `Stop/target armed for ${holding.sym} — the exit engine will sell when hit.` });
      return true;
    } catch (e) { setBuyToast({ t: `Couldn't arm exit: ${String(e.message || e)}`, e: true }); return false; }
  };

  /* THE AUTOMATION LOOP. Evaluates every active strategy's entry/exit rules
     against real candles once a minute and places real orders through the normal
     pipeline. Automated orders skip the confirm dialog on purpose. */
  const autoPositions = useAutomation({
    strats,
    onBuy: (s, q, opts = {}) => buyStockNow(s, q, { ...opts, tradeType: "Automate" }),
    onSell: (s, q, opts = {}) => sellStockNow(s, q, { ...opts, tradeType: "Automate" }),
    userId,
    /* R14-P1-01: the browser automation loop is VIRTUAL-ONLY. Real automation runs solely on the backend
       auto-buy/auto-exit engine (armed via Go Live). Running this loop in Real mode would let BOTH engines
       see the same signal and place separate real BUYs, and its onSell routes through the paper order path
       (buying real but exiting on paper). Gating to virtual makes the backend the single live executor. */
    enabled: !!auth && mode === "virtual",
  });

  /* EXIT ALL. Flattens every OPEN automation position at the live price, then deactivates
     all active strategies so nothing re-enters. Two distinct actions — closing what's open,
     and stopping what would open next — because deactivating alone would leave live
     positions running untended. */
  const exitAllStrategies = () => {
    const open = (autoPositions && autoPositions.current) || {};
    let exited = 0;
    Object.entries(open).forEach(([key, pos]) => {
      if (!pos || key.startsWith("__")) return;               // skip counter/bookkeeping keys
      const sym = pos.optSymbol || key.split("|")[1];
      const stock = ALL.find((a) => a.sym === sym) || { sym, price: pos.entry, isOpt: !!pos.optSymbol, lot: pos.lotSize };
      if (pos.qty > 0) { sellStockNow(stock, pos.qty, { tradeType: "Automate", market: "IN" }); exited++; }
      delete open[key];
    });
    if (autoPositions) autoPositions.current = open;
    setStrats((p) => p.map((s) => s.active ? { ...s, active: false } : s));
    setBuyToast({ t: exited ? `Exited ${exited} open position${exited > 1 ? "s" : ""} and stopped all strategies` : "All strategies stopped" });
  };

  /* RECONCILE WITH DELTA — one tap to self-heal the dashboard: drops phantom OPEN real crypto records
     Delta doesn't actually hold (e.g. rejected/never-filled orders the client optimistically recorded),
     then reloads the journal from the server. Display-only — never touches real holdings. */
  const reconcileWithDelta = async () => {
    const r = await reconcileRealTrades(userId);   // throws on error; callers surface it
    if (BACKEND_URL) { try { const t = await fetchTrades(userId, 0, Date.now()); setTrades(t || []); } catch { /* keep current */ } }
    setBuyToast({ t: r.removed ? `Reconciled with Delta — dropped ${r.removed} phantom record${r.removed > 1 ? "s" : ""} Delta doesn't hold.` : "Reconciled — your records already match Delta." });
    return r;   // returned so the Profile drawer can show its own inline count
  };

  /* Close (sell) every OPEN paper position for ONE strategy at the live price, then deactivate just
     that strategy. Powers the Virtual Live "Stop & sell" button. */
  const exitStrategyPositions = (stratId) => {
    const open = (autoPositions && autoPositions.current) || {};
    let exited = 0;
    Object.entries(open).forEach(([key, pos]) => {
      if (!pos || key.startsWith("__")) return;
      if (String(key.split("|")[0]) !== String(stratId)) return;
      const sym = pos.optSymbol || key.split("|")[1];
      const stock = ALL.find((a) => a.sym === sym) || { sym, price: pos.entry, isOpt: !!pos.optSymbol, lot: pos.lotSize };
      if (pos.qty > 0) { sellStockNow(stock, pos.qty, { tradeType: "Automate", market: marketOf(sym) || market }); exited++; }
      delete open[key];
    });
    if (autoPositions) autoPositions.current = open;
    setStrats((p) => p.map((s) => s.id === stratId ? { ...s, active: false } : s));
    setBuyToast({ t: exited ? `Closed ${exited} open position${exited > 1 ? "s" : ""} and stopped the strategy` : "Strategy stopped" });
    return exited;
  };

  /* Intraday positions close themselves — 15 min before the bell, or 23h45m after
     entry for crypto. Paper only: a REAL intraday position is the broker's to square
     off, and doing it twice would sell a position we do not hold. */
  useSquareOff({
    portfolio,
    onSell: (sym, qty) => sellStockNow(ALL.find((a) => a.sym === sym), qty),
    enabled: !!auth && mode === "virtual",
    notify: (t) => setBuyToast({ t }),
  });

  /* Wake the backend the moment the app opens. Render's free tier sleeps after 15
     minutes, and the first request then pays a ~30s cold start — which is why the
     screener's AI call "timed out" while Groq itself answers in under a second.
     A cheap /health ping on load means the server is awake before you need it. */
  useEffect(() => {
    if (!BACKEND_URL) return;
    fetch(`${BACKEND_URL}/health`).catch(() => {});
  }, []);

  /* Finish the broker OAuth handshake. Zerodha comes back with ?request_token=, FYERS with ?auth_code=,
     Schwab with the standard ?code=, and Dhan's partner consent with ?tokenId=. We strip it from the URL
     immediately afterwards — a token in the address bar ends up in history and referrer headers. */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get("request_token") || p.get("auth_code") || p.get("code") || p.get("tokenId");
    if (!token) return;
    const oauthState = p.get("state") || undefined;   // CSRF nonce the broker echoed back (fyers/schwab)
    // R7-P1-02: resolve the broker from the TRUSTED state we stored at login (so Schwab's ?code= isn't
    // mis-routed as FYERS). Fall back to the param shape only if the stored broker is unavailable.
    let which = null;
    try { which = oauthState ? sessionStorage.getItem("mx_oauth_bk_" + oauthState) : null; } catch { which = null; }
    if (!which) which = p.get("request_token") ? "zerodha" : p.get("tokenId") ? "dhan" : p.get("code") && !p.get("auth_code") ? "schwab" : "fyers";
    connectBroker(which, token, undefined, undefined, oauthState)
      .then(() => setBuyToast({ t: "Broker connected — prices are now live" }))
      .catch((e) => setBuyToast({ t: String(e.message || e), e: true }))
      .finally(() => window.history.replaceState({}, "", window.location.pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Takes the quantity from the sheet, NOT the one we opened with — the user can
     change it there, and ignoring that would place a different order than the one
     they confirmed. */
  /* THE FORK. A Virtual order hits the paper wallet. A Real order goes to the broker
     and moves actual money. These must never cross: a real fill that also debits the
     paper wallet would corrupt the paper P&L, and a paper fill that reached the broker
     would be a trade the user never agreed to. One branch each, no shared path. */
  const runConfirmedOrder = async (finalQty, product, risk) => {
    if (!confirmOrder) return;
    const { s, qty, side, opts: baseOpts } = confirmOrder;
    // The confirm sheet can override the pre-filled stop-loss / take-profit (%).
    const opts = risk ? { ...baseOpts, ...risk } : baseOpts;

    /* The confirm sheet calls back in one of two shapes:
         stock  -> (finalQty, product)
         option -> (orderObject), carrying the BROKER's own contract symbol, already
                   resolved against the live chain, with quantity converted from lots to
                   contracts. We never build that symbol ourselves. */
    const isOptOrder = finalQty && typeof finalQty === "object";
    const o = isOptOrder ? finalQty : null;

    const q = isOptOrder ? o.qty : (finalQty || qty);
    const prod = (isOptOrder ? o.product : product) || "CNC";

    if (isOptOrder) {
      if (o.price == null) {
        setBuyToast({ t: "No live premium for that contract — refusing to price the order", e: true });
        setConfirmOrder(null);
        return;
      }
      const optStock = {
        ...s,
        sym: o.optionSymbol,
        name: `${s.sym} ${o.strike} ${o.optType === "CE" ? "CALL" : "PUT"}`,
        price: o.price,                    // the premium, not the spot
        under: s.sym,
        isOpt: true,
        lot: o.lotSize,
        strike: o.strike,
        optType: o.optType,
        expiry: o.expiry,
      };
      if (mode === "real") {
        /* P3-05: an option order rides the SAME durable lifecycle as a stock (buyStockNow → placeRealMarketOrder).
           AWAIT the true outcome — never flash "Bought" before the broker confirms. The drawer stays mounted until
           we know; an ambiguous outcome keeps it open with a note and never auto-resubmits. */
        setConfirmBusy(true);
        const res = await buyStockNow(optStock, q, { ...opts, product: prod, market: "IN", tradeType: opts.tradeType || "Manual" });
        setConfirmBusy(false);
        if (res && res.blocked) return;                                        // a submit is already in flight — no dup
        if (res && res.state === ORDER_STATES.UNKNOWN) { setConfirmNote("Order outcome unknown — checking your broker. It won't be resubmitted; a retry reuses the same order."); return; }
        setConfirmOrder(null); setConfirmNote(null);
        return;
      }
      // Virtual paper option — separate book, never the real lifecycle.
      buyStockNow(optStock, q, { ...opts, product: prod, market: "IN", tradeType: opts.tradeType || "Manual" });
      setBuyToast({ t: `Bought ${o.lots} lot${o.lots > 1 ? "s" : ""} · ${o.optionSymbol}` });
      setConfirmOrder(null);
      return;
    }


    if (mode === "real") {
      /* P3-05: EVERY real stock order goes through the ONE durable lifecycle (placeRealMarketOrder). It routes by
         market, mints/reuses ONE idempotency key (here: the drawer's stable actionId), interprets the outcome,
         journals it, and toasts with the ACTUALLY-ROUTED broker name. We keep the drawer MOUNTED until the outcome
         is known and DISABLE a repeat submit while placing — no context is destroyed before the broker replies, a
         timeout is never mislabelled "Broker rejected", and an ambiguous outcome stays reconcilable. */
      setConfirmBusy(true);
      const res = await placeRealMarketOrder(s, side, q, prod, { ...opts, clientRequestId: confirmOrder.actionId || undefined });
      setConfirmBusy(false);
      if (res && res.blocked) return;                                          // already submitting — keep drawer, no dup
      if (res && res.state === ORDER_STATES.UNKNOWN) { setConfirmNote("Order outcome unknown — checking your broker. It won't be resubmitted; a retry reuses the same order."); return; }
      setConfirmOrder(null); setConfirmNote(null);
      return;
    }

    placeOrder({ stock: s, side, qty: q, opts: { ...opts, product: prod, market: confirmOrder.market || opts.market } });   // virtual: paperer wallet
    setConfirmOrder(null);
  };
  const [priceSnap, setPriceSnap] = useState({});
  useEffect(() => {
    setPriceSnap((prev) => { const m = { ...prev }; portfolio.forEach((h) => { const s = ALL.find((a) => a.sym === h.sym); m[h.sym] = s ? s.price : (prev[h.sym] ?? h.buy); }); return m; });
  }, [portfolio]);
  const [watchlists, setWatchlists] = useState([{ id: "w1", name: "My Watchlist", syms: ["RELIANCE", "TCS"] }]);
  const [activeWl, setActiveWl] = useState("w1");
  // Load this user's saved data whenever the user changes (login / logout).
  useEffect(() => {
    const freshSignup = freshSignupRef.current;
    const apply = (s) => {
      setPortfolio((s && s.portfolio) || []);
      setWalletMap((s && s.walletMap) || { IN: 1000000, US: 1000000, Crypto: 1000000, Commodity: 1000000 });
      setDeposits((s && s.deposits) || []);
      setStrats(seededStrats(s && s.strats));
      const wl = (s && s.watchlists) || [{ id: "w1", name: "My Watchlist", syms: ["RELIANCE", "TCS"] }];
      setWatchlists(wl); setActiveWl(wl[wl.length - 1] ? wl[wl.length - 1].id : "w1");
      setProfile((s && s.profile) || null);
      // Fresh sign-ups skip onboarding; everyone else uses their saved flag.
      setOnboardSkipped(freshSignup ? true : !!(s && s.onboardSkipped));
      setAutoOnMap((s && s.autoOnMap) || { IN: false, US: false, Crypto: false, Commodity: false, FNO: false });
      if (s && s.deployCapMap && typeof s.deployCapMap === "object") setDeployCapMap(s.deployCapMap);
    };
    const local = lsGet("mx_state_" + userId, null);
    apply(local);
    freshSignupRef.current = false;
    setTrades(lsGet("mx_trades_" + userId, []));
    setHydratedUser(userId);
    setRemoteHydrated(false);
    /* SERVER-SIDE state for logged-in users: the source of truth across devices/sessions.
       Onboarding answers, strategy active flags and Auto-Buy on/off all live here, so they
       survive closing the app or signing in on another browser. Guests stay local-only. */
    if (BACKEND_URL && auth && getAuthToken()) {
      apiLoadState().then((remote) => {
        if (remote && typeof remote === "object" && Object.keys(remote).length) {
          const merged = { ...(local || {}), ...remote };
          if (!freshSignup) apply(merged);          // don't override a brand-new signup's skip
          try { lsSet("mx_state_" + userId, merged); } catch { /* ignore */ }
        }
        setRemoteHydrated(true);
      }).catch(() => setRemoteHydrated(true));
    } else {
      setRemoteHydrated(true);
    }
    if (BACKEND_URL) fetchTrades(userId, 0, Date.now()).then((t) => { if (t && t.length) setTrades(t); }).catch(() => {});
    /* R16-P2-02/03: the risk policy is now HYDRATED FROM the server (authoritative) inside useOrders, keyed
       per user. We must NOT push local/default caps up on login — doing so overwrote the server policy and
       leaked one user's caps to the next on a shared browser. Saving happens only on an explicit edit. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  // Persist per-user: localStorage always; the server too (debounced) once the remote copy
  // has loaded, so we never overwrite the server with empty local state on first paint.
  useEffect(() => {
    if (hydratedUser !== userId) return;
    const snap = { portfolio, walletMap, watchlists, profile, onboardSkipped, deposits, strats, autoOnMap, deployCapMap };
    lsSet("mx_state_" + userId, snap);
    if (BACKEND_URL && auth && getAuthToken() && remoteHydrated) {
      clearTimeout(stateSaveTimer.current);
      // 4s debounce (was 1.2s): the server copy only needs to be eventually-consistent, and localStorage
      // already holds the live copy — a longer debounce collapses bursts of edits into one write, cutting
      // DB data-transfer during active use without any user-visible difference.
      stateSaveTimer.current = setTimeout(() => { apiSaveState(userId, snap).catch(() => {}); }, 4000);
    }
  }, [portfolio, walletMap, watchlists, profile, onboardSkipped, deposits, strats, autoOnMap, deployCapMap, hydratedUser, userId, remoteHydrated, auth]);
  useEffect(() => { if (hydratedUser === userId) lsSet("mx_trades_" + userId, trades); }, [trades, hydratedUser, userId]);
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  /* Opening or closing a stock detail page also lands at the top. */
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* noop */ } }, [detail]);
  const [search, setSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [legalPage, setLegalPage] = useState(null);   // "terms" | "privacy" | "disclaimer" | "faq" | null
  /* A 401 from any data call means the token is missing/expired — prompt a re-login. Also
     covers the one-time migration: users logged in before tokens existed have mx_auth but
     no token, so their first authed call 401s and this brings up the login modal once. */
  useEffect(() => { setOnUnauthorized(() => { if (auth) setLoginOpen(true); }); }, [auth, setLoginOpen]);
  useEffect(() => { if (auth && !getAuthToken()) setLoginOpen(true); }, [auth, setLoginOpen]);
  const [isAdminUser, setIsAdminUser] = useState(false);   // is this account an admin at all
  /* Admin vs user experience. An admin's LAST choice sticks: once they switch to admin mode
     it stays on across logins until they manually switch back to user mode (persisted locally,
     re-gated by the server's isAdminUser check so a non-admin can never flip it on). */
  const [adminMode, setAdminMode] = useState(() => { try { return localStorage.getItem("mx_admin_mode") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("mx_admin_mode", adminMode ? "1" : "0"); } catch { /* private mode */ } }, [adminMode]);
  const effAdmin = isAdminUser && adminMode;               // gates every admin-only affordance
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  /* GLOBAL admin-controlled gates: may members use Real mode / connect brokers per market.
     Default locked (No/No) until an admin turns them on. Loaded once; refreshed after a save. */
  const [appSettings, setAppSettings] = useState(null);
  useEffect(() => { let alive = true; apiGetAppSettings().then((s) => { if (alive) setAppSettings(s); }); return () => { alive = false; }; }, []);
  const saveAppSettings = useCallback(async (next) => {
    setAppSettings(next);                                   // optimistic
    // The server write needs the admin key. Use the in-memory key, or the one cached when the
    // admin authenticated (mx_admin_auth) — otherwise the POST 403s and the change silently reverts.
    let key = adminKey;
    if (!key) { try { const c = JSON.parse(localStorage.getItem("mx_admin_auth") || "null"); if (c && c.key) key = c.key; } catch { /* ignore */ } }
    if (!key) { setBuyToast({ t: "Open the Admin console once (enter your admin key) to save permissions.", e: true }); return; }
    try {
      const r = await apiSaveAppSettings(next, userId, key);
      if (r && r.settings) setAppSettings(r.settings);
      else if (r && r.error) setBuyToast({ t: "Settings not saved: " + r.error, e: true });
    } catch { setBuyToast({ t: "Settings not saved — check your connection.", e: true }); }
  }, [adminKey, userId]);
  // What THIS user may do, given the gates (admins are never restricted). Real mode is now
  // per-market, like broker-connect: the admin can allow Real on Crypto but not on Indian.
  /* Real mode is allowed when: you're an admin; the admin has enabled Real for this market group; OR you have a
     broker connected for this market (a live session on THIS device OR server-held creds resumable on any device).
     The last clause is the important one: if you've linked your own broker for a market, you can trade Real on it —
     it also means the toggle shows and STAYS on across devices instead of bouncing back to Virtual. Order placement
     still requires a live routed session, so surfacing the option early never fires an order without a real session. */
  const canRealMode = useCallback((mkt = market) => {
    const m = marketOf(mkt) || mkt;
    // Real mode appears ONLY where a broker actually covers this market — a live session on this device OR server-held
    // creds (so it works across devices). Broker presence is the SOLE gate: no admin bypass, no settings override. A
    // Delta (crypto) connection surfaces Real on Crypto only; US/Indian/Commodity stay Virtual until a broker for that
    // market is connected. Order placement still needs a live routed session, so nothing fires without one.
    return Boolean((brokerFor && brokerFor(m)) || (serverBrokerFor && serverBrokerFor(m)));
  }, [market, brokerFor, serverBrokerFor]);
  const canConnectMarket = useCallback((mkt) => effAdmin || Boolean(appSettings && appSettings.allowBrokerConnect && appSettings.allowBrokerConnect[mkt]), [effAdmin, appSettings]);
  /* The Indian market is shown to a non-admin only if they've connected an Indian broker (their
     own live NSE feed) OR the admin has enabled "show Indian without broker" (delayed BSE feed). */
  const indianVisible = effAdmin || Boolean(brokerFor && brokerFor("IN")) || Boolean(appSettings && appSettings.showIndianWithoutBroker);
  /* US is admin-only until the admin turns on "Show US market". Commodity is Indian MCX, so it rides
     with Indian visibility — when Indian is hidden, Commodity hides too. Crypto is always visible. */
  const usVisible = effAdmin || Boolean(appSettings && appSettings.showUSMarket);
  const commodityVisible = indianVisible;
  const marketVisible = useCallback((m) => ({ IN: indianVisible, US: usVisible, Crypto: true, Commodity: commodityVisible }[m] ?? true), [indianVisible, usVisible, commodityVisible]);
  // If the user is sitting on a market they can no longer see, snap them to a visible one.
  // Wait for app-settings before bouncing off a market: on first paint appSettings is null, so indianVisible is
  // briefly false and a returning Indian user would be flipped to Crypto (which is always visible, so it never
  // flips back). Only re-home the market once settings are known.
  useEffect(() => { if (appSettings && !marketVisible(market)) setMarket(indianVisible ? "IN" : "Crypto"); }, [appSettings, marketVisible, market, indianVisible]);
  /* If a member is (or was) in Real mode but the admin has turned Real off for the market they're
     on, snap them back to Virtual — a stored "real" preference must not override a live admin lock. */
  useEffect(() => { if (appSettings && !canRealMode(market) && mode === "real") setMode("virtual"); }, [appSettings, canRealMode, market, mode, setMode]);
  /* Open the admin console: prompt for the key, verify with the backend (which checks the
     key AND that this userId is an admin), and only then mount the panel. The key lives in
     memory for the session only. */
  useEffect(() => {
    let alive = true;
    if (userId) adminIsAdminUser(userId).then((v) => { if (alive) setIsAdminUser(v); });
    else setIsAdminUser(false);
    return () => { alive = false; };
  }, [userId]);

  const openAdmin = async () => {
    /* P2-07 — the admin key is kept ONLY in memory (React state) for the session, never written to
       localStorage. Persisting it made a long-lived secret readable by any XSS; now a page reload just
       re-prompts. Within a session we reuse the in-memory key so it's entered at most once. Admin is
       double-gated server-side anyway (verified token uid in ADMIN_USER_IDS AND the key). */
    if (adminKey) {
      const ok = await adminCheck(userId, adminKey);
      if (ok) { setAdminOpen(true); setShowProfile(false); return; }
      setAdminKey("");                              // stale — fall through to re-prompt
    }
    // Clean up any admin key a previous build may have left in storage.
    try { localStorage.removeItem("mx_admin_auth"); } catch { /* ignore */ }
    const key = await promptDialog("Enter the admin key to open the admin console.", { title: "Admin key", confirmLabel: "Unlock", password: true, placeholder: "Admin key" });
    if (!key) return;
    const ok = await adminCheck(userId, key);
    if (!ok) { setBuyToast({ t: "Not authorized for admin.", e: true }); return; }
    setAdminKey(key);                               // in-memory only, this session
    setAdminOpen(true);
    setShowProfile(false);
  };
  const [tradePreset, setTradePreset] = useState(null);
  const { live, liveAt, tick: marketTick, src: liveSrc } = useMarketData(market);

  /* One tick for the whole app, advancing on EITHER feed. Downstream memos key on
     this; if they keyed only on the Yahoo tick they would sit frozen while a live
     broker feed updated prices in place. */
  const liveTick = marketTick + brokerTicks;

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
  /* True while the onboarding flow owns the screen. The bottom tab bar is fixed and
     was covering onboarding's own CTA — it has no business sitting on top of a
     full-screen flow the user cannot navigate away from anyway. */
  // Wait for the server copy before deciding to show onboarding — otherwise a returning
  // user briefly has no profile locally and gets re-asked questions they already answered.
  const onboarding = authed && hydratedUser === userId && remoteHydrated && (repersonalise || (!profile && !onboardSkipped));

  /* Once onboarding is done, offer the broker — once, ever. This is the moment the
     user first looks at a price, and the moment it matters that it is 15 minutes
     old. Nagging on every launch would be a dark pattern; asking once is service. */
  useEffect(() => {
    if (onboarding || !authed || !profile || brokerLive) return;
    if (lsGet("mx_broker_prompted_" + userId)) return;
    const t = setTimeout(() => {
      setBrokerPrompt(true);
      lsSet("mx_broker_prompted_" + userId, true);
    }, 900);
    return () => clearTimeout(t);
  }, [onboarding, authed, profile, brokerLive, userId]);

  const [walletOpen, setWalletOpen] = useState(false);
  const [why, setWhy] = useState(null);
  const openWhy = (s, ctx = null) => setWhy({ s, ctx });

  /* P2-19 — Escape dismisses the top-most open overlay, so every modal/sheet/drawer is keyboard-
     closable (previously only a tap on the backdrop or an X worked). Ordered most-modal first. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (confirmOrder) return setConfirmOrder(null);
      if (why) return setWhy(null);
      if (search) return setSearch(false);
      if (walletOpen) return setWalletOpen(false);
      if (brokerOpen) return setBrokerOpen(false);
      if (adminOpen) return setAdminOpen(false);
      if (activityOpen) return setActivityOpen(false);
      if (brokerPrompt) return setBrokerPrompt(false);
      if (showProfile) return setShowProfile(false);
      if (detail) return setDetail(null);
      if (drawer) return setDrawer(null);
      if (histOpen) return setHistOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOrder, why, search, walletOpen, brokerOpen, adminOpen, activityOpen, brokerPrompt, showProfile, detail, drawer, histOpen]);

  const openStock = (s) => setDrawer(s);
  const openDetail = (s) => { setDrawer(null); setDetail(s); };
  const goTrade = (s) => { setDrawer(null); setDetail(null); setTradePreset(s); setTab("trade"); };



  // personalised ordering for picks
  const list = useMemo(() => {
    let arr = [...UNIVERSE[market]];
    if (profile) {
      arr.sort((a, b) => {
        /* No cap tier: market cap came from fundamentals, which has no feed. */
        const score = (s) => ((profile.sectors || []).includes(s.sector) ? 3 : 0) + (profile.risk === "Aggressive" ? s.chg : profile.risk === "Conservative" ? -Math.abs(s.chg) : (s.rsi != null ? (s.rsi - 50) / 10 : 0));
        return score(b) - score(a);
      });
    }
    return arr;
  }, [market, profile]);

  // Neo is no longer a bottom-bar tab — it's a floating chatbot button (see below), so the bar has room.
  const nav = [["home", Home, "Home"], ["ideas", Lightbulb, "Ideas"], ["portfolio", Briefcase, "Portfolio"], ["automation", Bolt, "Auto"], ["screener", SlidersHorizontal, "Screen"], ["orders", Clock, "Orders"]];

  /* The Automate page must show the P&L for the CURRENT mode, exactly like the homepage Total does: in Real mode
     only real automate trades count; in Virtual mode only the paper ones. Passing an unfiltered mix made the
     dashboard show virtual paper P&L (e.g. +$571) even while in Real mode, disagreeing with the homepage's
     Automate = $0. The virtual paper engine (Automation.jsx) only runs in Virtual mode and only reads paper
     trades for its open-position dedupe, so this filtering is safe for it. */
  const automateTrades = useMemo(
    () => (trades || []).filter((t) => (mode === "real" ? t.real === true : t.real !== true)),
    [trades, mode],
  );

  return (
    <BuyGateContext.Provider value={canBuy}>
    <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* fixed gradient backdrop so it stays behind scroll */}
      <div style={{ position: "fixed", inset: 0, background: "var(--app-bg, var(--bg))", zIndex: 0, pointerEvents: "none" }} />
      {!authed && <LoginScreen onAuthed={(a, opts) => { onAuthed(a, opts); setAuthed(true); }} />}
      {authed && auth && !auth.username && getAuthToken() && (
        <SetUsernameModal onDone={(username) => onAuthed({ ...auth, username })} />
      )}
      {onboarding && (
        <Onboarding
          theme={theme}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 8px", gap: 8 }}>
            <div onClick={() => { setTab("home"); setDetail(null); }} className="tap disp" style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 7, minWidth: 0, marginRight: "auto" }}>
              <Wordmark height={28} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* Balance — in REAL mode this is your broker's actual cash (never the paper
                  wallet), tinted red so real money is never mistaken for virtual capital.
                  Hidden entirely when virtual trading is disabled for this market (non-admin):
                  there is no paper wallet to show, so the pill would only mislead. */}
              {!virtualBlocked(market) && (
              <button onClick={() => (mode === "real" ? setBrokerOpen(true) : setWalletOpen(true))} aria-label={mode === "real" ? "Real balance" : "Virtual wallet"} className="tap pill gold-border" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", whiteSpace: "nowrap", flexShrink: 0, background: "transparent", cursor: "pointer", borderColor: mode === "real" ? "var(--down)" : undefined }}>
                <Wallet size={15} color={mode === "real" ? "var(--down)" : "var(--gold)"} />
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: mode === "real" ? "var(--down)" : "var(--ink)" }}>
                  {mode === "real"
                    ? ((brokerFor(market) && realPortfolio && realPortfolio.cash != null)
                        ? ((market === "Crypto" || market === "US") ? "$" : "₹") + Number(realPortfolio.cash).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: Math.abs(Number(realPortfolio.cash)) < 1 ? 4 : 1 })
                        : "—")   /* no broker for THIS market -> no real cash; never fall back to the paper/other-market balance */
                    : compact(wallet, market)}
                </span>
              </button>
              )}
              {/* Activity log — recent actions & their outcomes (orders, rejects, connects). */}
              <button onClick={() => setActivityOpen(true)} aria-label="Activity" className="tap" style={{ position: "relative", border: "1px solid var(--line)", background: "transparent", borderRadius: 10, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                <Clock size={16} color="var(--muted)" />
                {activity.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--primary)", color: "var(--on-primary)", fontSize: 8.5, fontWeight: 800, display: "grid", placeItems: "center" }}>{activity.length > 9 ? "9+" : activity.length}</span>}
              </button>
              {/* Profile: the icon, with a label below — "Login" for a guest, the username
                  (or name) once signed in. Tapping opens the profile sheet either way. */}
              <div onClick={() => setShowProfile(true)} className="tap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, cursor: "pointer" }}>
                <div className="glow" style={{ width: 34, height: 34, borderRadius: 11, background: "var(--feature-grad)", display: "grid", placeItems: "center", color: "#fff" }}><User size={17} /></div>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: "var(--muted)", maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {auth ? (auth.username || auth.name || "Account") : "Login"}
                </span>
              </div>
            </div>
          </div>

          {/* SLIM STATUS STRIP — feed, mode, theme, last tick.
              These were crowded into the title row where the app name lives. They are
              status, not identity: they belong on their own line where they can be read
              at a glance and where the mode switch is a real switch, not a chip. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px 10px", flexWrap: "wrap" }}>
            {/* WHERE THIS MARKET'S PRICE COMES FROM. Per market, not per app: a broker
                covers some markets and not others (Zerodha prices NIFTY, not BTC). Saying
                "LIVE" app-wide while Yahoo quietly served crypto would be a lie you'd size
                a position on. */}
            {brokerLive && liveBroker && liveBroker.markets.includes(market) ? (
              <span
                className="pill tap"
                onClick={() => setBrokerOpen(true)}
                title={`Real-time feed from ${liveBroker.name}.`}
                style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".04em", padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, background: "var(--up-soft)", color: "var(--up)", cursor: "pointer" }}
              >
                <span style={{ width: 4, height: 4, borderRadius: 4, background: "var(--up)" }} />
                LIVE · {liveBroker.name.toUpperCase()}
              </span>
            ) : live && liveSrc ? (
              /* Server-side house feed (FYERS for Indian equities, Delta for crypto) — a REAL
                 real-time feed for every user, no personal broker connection needed. */
              <span
                className="pill tap"
                onClick={() => setBrokerOpen(true)}
                title={liveSrc === "fyers" ? "Real-time NSE prices via FYERS (server feed) — no delay." : "Real-time crypto prices via Delta Exchange (server feed)."}
                style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".04em", padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, background: "var(--up-soft)", color: "var(--up)", cursor: "pointer" }}
              >
                <span style={{ width: 4, height: 4, borderRadius: 4, background: "var(--up)" }} />
                Live
              </span>
            ) : live ? (
              <span
                className="pill tap"
                onClick={() => setBrokerOpen(true)}
                title={brokerLive ? `Your ${liveBroker ? liveBroker.name : "broker"} feed does not cover ${market}. Yahoo is delayed ~15 minutes.` : "Yahoo Finance — delayed ~15 minutes on NSE. Connect a broker for a real-time feed."}
                style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".04em", padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, background: "var(--primary-soft)", color: "var(--primary)", cursor: "pointer" }}
              >
                <span style={{ width: 4, height: 4, borderRadius: 4, background: "var(--primary)" }} />
                LIVE (15m DELAY)
              </span>
            ) : (
              <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".04em", padding: "3px 7px", display: "flex", alignItems: "center", gap: 4, background: "var(--elev)", color: "var(--muted)" }}>
                <span style={{ width: 4, height: 4, borderRadius: 4, background: "var(--muted)" }} />
                {marketOpen(market) ? "No live data" : "Market closed"}
              </span>
            )}

            {/* VIRTUAL / REAL. Red when armed — this one spends real money. Hidden entirely for
                members when the admin hasn't allowed Real mode: no toggle, no way to switch. */}
            {canRealMode(market) && (
              <Toggle
                on={mode === "real"}
                offLabel="VIRTUAL"
                onLabel="REAL"
                onColor="var(--down)"
                label="Virtual or Real trading"
                onChange={(next) => {
                  if (!next) { setMode("virtual"); return; }        // leaving Real is always free
                  // Real needs a LIVE broker. It's per-market for ORDER ROUTING (a real order only goes to
                  // the broker that covers that market — enforced at placement), but entering Real must not
                  // dead-end a user who IS connected just because they're viewing a tab their broker doesn't
                  // cover. So: if the current market is covered, go straight to the confirm; otherwise jump to
                  // a market this broker DOES cover and confirm there. Only a user with NO live broker at all
                  // is asked to connect one.
                  // A live session OR server-held creds for this market is enough to ENTER Real (the session resumes
                  // across devices a moment after login). Order placement still requires a live routed session.
                  const hasHere = (m) => brokerFor(m) || (serverBrokerFor && serverBrokerFor(m));
                  if (hasHere(market)) { setConfirmReal(true); return; }
                  const covered = ["IN", "US", "Crypto", "Commodity"].find((m) => hasHere(m));
                  if (covered) {
                    setMarket(covered);
                    setBuyToast({ t: `Switched to ${MKT_LABEL[covered] || covered} — the market your connected broker covers.` });
                    setConfirmReal(true);
                    return;
                  }
                  setBuyToast({ t: `Connect a broker to trade Real.`, e: true });
                }}
              />
            )}

            {/* Right cluster, sitting directly under the profile icon: last tick + the light/dark toggle,
               vertically aligned with each other. */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {(brokerTick || liveAt) && (
                <span className="mono" style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>
                  {new Date(brokerTick || liveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle light or dark mode" aria-pressed={theme === "dark"} title="Light / dark mode" className="tap" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 999, width: 58, height: 30, padding: 3, display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0, position: "relative" }}>
                <span style={{ position: "absolute", top: 3, left: theme === "dark" ? 3 : 30, width: 24, height: 24, borderRadius: 999, background: theme === "dark" ? "#26262b" : "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,.28)", display: "grid", placeItems: "center", transition: "left .18s ease" }}>
                  {theme === "dark" ? <Moon size={13} color="#e7e7ea" /> : <Sun size={13} color="#8a6d1f" />}
                </span>
                <Sun size={12} color="var(--muted)" style={{ position: "absolute", left: 9, opacity: theme === "dark" ? .5 : 0 }} />
                <Moon size={12} color="var(--muted)" style={{ position: "absolute", right: 9, opacity: theme === "dark" ? 0 : .5 }} />
              </button>
            </div>
          </div>

          {/* DAILY RECONNECT NUDGE — a broker connected on a prior day whose token has since expired.
              One tap re-opens the broker sheet (already filtered to a market it covers) to log in again. */}
          {reconnectHint && (
            <div style={{ margin: "0 18px 12px", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--primary-soft)", border: "1px solid var(--primary)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: "var(--primary)", flex: "0 0 auto" }} />
              <span style={{ fontSize: 11.5, color: "var(--ink)", fontWeight: 600, lineHeight: 1.4, flex: 1 }}>
                Your {reconnectHint.name} login expired for today. Reconnect for live prices.
              </span>
              <button onClick={() => { const m = (BROKER_MARKETS[reconnectHint.id] || [])[0] || null; openBrokers(m); }}
                className="tap disp" style={{ flex: "0 0 auto", border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 9, padding: "7px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>
                Log in with {reconnectHint.name}
              </button>
              <button onClick={dismissReconnect} aria-label="Dismiss" className="tap" style={{ flex: "0 0 auto", border: "none", background: "transparent", color: "var(--muted)", padding: 2, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Search + Watch share one row — Watch moved here from the market-chips row so the chips stay clean. */}
          <div style={{ padding: "0 18px 14px", display: "flex", gap: 8, alignItems: "center" }}>
            <div onClick={() => setSearch(true)} className="tap" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", color: "var(--muted)", fontSize: 13.5 }}>
              <Search size={17} style={{ flex: "0 0 auto" }} /> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Search any stock, crypto or commodity…</span>
            </div>
            {!detail && ["home", "ideas", "automation", "portfolio", "screener", "watchlist"].includes(tab) && (
              <button onClick={() => { setHistOpen(false); setTab("watchlist"); setTradePreset(null); }} className="pill tap disp" style={{ flex: "0 0 auto", padding: "11px 13px", fontWeight: 700, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 14, border: "1px solid " + (tab === "watchlist" ? "var(--primary)" : "var(--line)"), background: tab === "watchlist" ? "var(--primary)" : "var(--surface)", color: tab === "watchlist" ? "var(--on-primary)" : "var(--ink)" }}><Star size={14} fill={tab === "watchlist" ? "var(--on-primary)" : "none"} /> Watch</button>
            )}
          </div>
          {!detail && ["home", "ideas", "automation", "portfolio", "screener", "watchlist"].includes(tab) && (
            <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 12px" }}>
              {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["Commodity", "🪙 Commodity"]].filter(([k]) => marketVisible(k)).map(([k, l]) => (
                <button key={k} onClick={() => { setMarket(k); if (tab === "watchlist") { setHistOpen(false); setTab("home"); } }} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (market === k ? "var(--primary)" : "var(--line)"), background: market === k ? "var(--primary)" : "var(--surface)", color: market === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: "0 18px", position: "relative", zIndex: 1 }}>
          {/* key per tab/detail: a crash in one page no longer latches the boundary for every
              other tab — switching tabs remounts a fresh boundary and clears the error. */}
          <ErrorBoundary key={detail ? "detail" : tab} name={detail ? "Stock detail" : tab}>
          <Suspense fallback={<div style={{ padding: 16 }}><div className="skel" style={{ height: 128, marginBottom: 12 }} /><div className="skel" style={{ height: 84, marginBottom: 12 }} /><div className="skel" style={{ height: 84 }} /></div>}>
          {detail ? (
            <DetailPage s={detail} onBack={() => setDetail(null)} watched={watch.includes(detail.sym)} toggleWatch={toggleWatch} onTrade={goTrade} onBuy={buyStock} canBuy={canBuy} />
          ) : (
            <>
              {tab === "home" && <HomeView market={market} setMarket={setMarket} segment={segment} onAutoBuy={autoBuyNow} onScreenerBuy={screenerBuyNow} isAdmin={effAdmin} mode={mode} setSegment={setSegment} list={list} onOpen={openStock} onBuy={buyStock} canBuy={canBuy} hideDash={(market === "IN" || market === "Commodity") && virtualBlocked(market)} watch={watch} toggleWatch={toggleWatch} profile={profile} portfolio={portfolio} realPortfolio={realPortfolio} onRefreshReal={() => refreshPortfolio(market)} wallet={wallet} onGoPortfolio={() => { setDetail(null); setTab("portfolio"); }} onRecord={recordTrade} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} trades={trades} liveTick={liveTick} onWhy={openWhy} autoOnMap={autoOnMap} setAutoOnMap={setAutoOnMap} deployCapMap={deployCapMap} setDeployCapMap={setDeployCapMap} onOpenScreener={() => { setDetail(null); setTab("screener"); }} strategies={strats} onGoDeployed={() => { setDetail(null); setTab("automation"); }} brokerName={(brokerFor(market) && brokerFor(market).meta ? brokerFor(market).meta.name : (liveBroker ? liveBroker.name : null))} />}
              {tab === "trade" && <TradeView walletMap={walletMap} adjustWallet={adjustWallet} portfolio={portfolio} setPortfolio={setPortfolio} preset={tradePreset} market={market} recordTrade={recordTrade} />}
              {tab === "ideas" && <Ideas onOpen={openStock} onBuy={buyStock} canBuy={canBuy} market={market} onWhy={openWhy} me={auth ? (auth.username || null) : null} isAdmin={effAdmin} adminKey={adminKey} signupAt={auth ? (auth.createdAt || null) : null} />}
              {tab === "automation" && <Automation market={market} appMode={mode} onRecord={recordTrade} trades={automateTrades} strats={strats} setStrats={setStrats} onExitAll={exitAllStrategies} onCloseStrategy={exitStrategyPositions} onClosePosition={closePositionRow} onUpdatePosition={updatePositionRisk} onReconcileDelta={reconcileWithDelta} me={auth ? (auth.username || null) : null} isAdmin={effAdmin} userId={userId} brokerFor={brokerFor} adminKey={adminKey} onConnectBroker={() => openBrokers(market)} />}
              {tab === "screener" && <div style={{ padding: "10px 14px 96px" }}><PopularScreeners variant="full" market={market} mode={mode} list={list} isAdmin={effAdmin} onOpen={openStock} onBuy={buyStock} onAutoBuy={autoBuyNow} onScreenerBuy={screenerBuyNow} onClosePosition={closePositionRow} onUpdatePosition={updatePositionRisk} liveTick={liveTick} trades={trades} /></div>}
              {tab === "portfolio" && <Portfolio mode={mode} realPortfolio={realPortfolio} realErr={realErr} realLoading={realLoading} onRefreshReal={() => refreshPortfolio(market)} realAvailable={!!brokerFor(market)} userId={userId} brokerName={(brokerFor(market) && brokerFor(market).meta ? brokerFor(market).meta.name : (liveBroker ? liveBroker.name : null))} portfolio={portfolio} wallet={wallet} market={market} onGoHome={() => { setDetail(null); setTab("home"); }} onBuy={buyStock} canBuy={canBuy} onSell={sellStock} onUpdate={updateHolding} onArmRealExit={armRealExit} priceSnap={priceSnap} onWhy={openWhy} onOpen={openStock} onRemove={(sym) => { setPortfolio((prev) => prev.filter((h) => h.sym !== sym)); setBuyToast({ t: `${sym} removed` }); }} />}
              {tab === "watchlist" && <WatchlistView watchlists={watchlists} activeWl={activeWl} setActiveWl={setActiveWl} createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist} toggleWatch={toggleWatch} onOpen={openStock} />}
              {tab === "ask" && (
                <div className="fade">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                    <div>
                      <div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Ask Neo</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Your AI markets expert. Ask about any stock, sector or strategy.</div>
                    </div>
                    <button onClick={() => setTab("home")} className="tap" title="Close chat" aria-label="Close chat" style={{ flexShrink: 0, border: "none", background: "var(--elev)", borderRadius: 11, width: 36, height: 36, display: "grid", placeItems: "center", color: "var(--ink)" }}><X size={18} /></button>
                  </div>
                  <div className="card" style={{ padding: 14, height: 520 }}>
                    <ChatPanel suggestions={["Is it a good time to buy Indian IT?", "Explain RSI vs MACD simply", "Build me a swing-trade checklist", "What sectors look strong now?"]} />
                  </div>
                </div>
              )}
              <Footer onOpen={(pg) => setLegalPage(pg)} />
            </>
          )}
          </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {legalPage && <LegalOverlay page={legalPage} onClose={() => setLegalPage(null)} />}

      {/* BOTTOM NAV
          Deliberately a DIRECT CHILD OF THE ROOT, not of the page wrapper.
          `position: fixed` is measured against the viewport ONLY if no ancestor
          creates a containing block — and a transform, filter or backdrop-filter
          on any ancestor does exactly that. The wrapper contains .glass
          (backdrop-filter), the .fade keyframes (transform) and <Pop>, any of
          which can silently re-anchor a fixed child and make the bar scroll away.
          Hoisting it here removes the possibility entirely. */}
      {/* The bottom bar hides whenever ANY sheet is open. A nav bar floating over a drawer
          is both visually wrong and a real hazard: the tap targets overlap the sheet's own
          controls, so a thumb reaching for "Buy" can land on "Watch". */}
      {!detail && !onboarding && !drawer && !confirmOrder && !walletOpen && !brokerOpen && !search && !showProfile && (
        <Portal theme={theme}>
          <nav aria-label="Main navigation" className="glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--header-bg)", borderTop: "1px solid var(--line)", borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px rgba(40,10,80,.3)", display: "flex", padding: "8px 2px calc(13px + env(safe-area-inset-bottom, 0px))", zIndex: 100 }}>
            {nav.map(([k, Icon, label]) => {
              const current = k === "orders" ? histOpen : (tab === k && !histOpen);
              return (
                <button key={k} aria-current={current ? "page" : undefined} onClick={() => { if (k === "orders") { setHistOpen(true); return; } setHistOpen(false); setTab(k); setTradePreset(null); }} className="tap" style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 1px", minHeight: 46, color: current ? "var(--primary)" : "var(--muted)" }}>
                  <Icon size={17} fill={k === "watchlist" && tab === k ? "var(--primary)" : "none"} />
                  <span style={{ fontSize: 8.5, fontWeight: 700, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                </button>
              );
            })}
          </nav>
        </Portal>
      )}

      {/* NEO — floating chatbot button, bottom-right, just above the bottom bar. Replaces the old Neo
          tab. Sits inside a centered 460-wide track so it hugs the app's right edge, not the viewport. */}
      {!detail && !onboarding && !drawer && !confirmOrder && !walletOpen && !brokerOpen && !search && !showProfile && tab !== "ask" && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)", maxWidth: 460, margin: "0 auto", zIndex: 105, display: "flex", justifyContent: "flex-end", paddingRight: 16, pointerEvents: "none" }}>
          <button onClick={() => { setHistOpen(false); setTab("ask"); setTradePreset(null); }} aria-label="Ask Neo" className="tap" style={{ pointerEvents: fabHide ? "none" : "auto", opacity: fabHide ? 0 : 1, transform: fabHide ? "translateY(14px) scale(.85)" : "none", transition: "opacity .2s ease, transform .2s ease", width: 56, height: 56, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, var(--primary), var(--primary-2))", boxShadow: "0 8px 24px rgba(40,10,80,.4)", display: "grid", placeItems: "center", color: "var(--on-primary)" }}>
            <NeoIcon size={28} />
          </button>
        </div>
      )}

      {drawer && <Drawer s={drawer} onClose={() => setDrawer(null)} onDetails={openDetail} onBuy={buyStock} canBuy={canBuy} />}

      {why && (
        <WhyPanel
          s={why.s}
          market={marketOf(why.s.sym)}
          context={why.ctx}
          onClose={() => setWhy(null)}
          onOpenStock={openStock}
        />
      )}
      {/* ARMING REAL MODE. Deliberately a full stop, not a toast. From here on, a
          tap on Buy spends actual money — that deserves a sentence and a decision,
          not a silently flipped switch. */}
      {confirmReal && (
        <Portal theme={theme}>
          <div onClick={() => setConfirmReal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 190 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 191, padding: "20px 20px 26px", boxShadow: "0 -16px 44px rgba(0,0,0,.35)" }}>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800, color: "var(--down)" }}>Switch to Real money?</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
              In Real mode, orders are sent to <b style={{ color: "var(--ink)" }}>{liveBroker ? liveBroker.name : "your broker"}</b> and
              executed against your actual account with your actual money. Your Portfolio will show your real
              holdings, not the paper ones.
              <br /><br />
              Your virtual wallet and paper trade history are kept separately and are not affected.
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
              <button onClick={() => setConfirmReal(false)} className="tap disp"
                style={{ flex: 1.3, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                Stay in Virtual
              </button>
              <button onClick={() => { setMode("real"); setConfirmReal(false); setBuyToast({ t: "Real mode — orders now go to your broker" }); }} className="tap disp"
                style={{ flex: 1, border: "none", background: "var(--down)", color: "#fff", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                Use Real
              </button>
            </div>
          </div>
        </Portal>
      )}

      {activityOpen && (
        <Portal theme={theme}>
          <div onClick={() => setActivityOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 150 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 151, padding: "18px 18px 24px", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 -16px 44px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="disp" style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}><Clock size={17} /> Activity</div>
              <div style={{ display: "flex", gap: 8 }}>
                {activity.length > 0 && <button onClick={clearActivity} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 9, padding: "5px 10px", fontWeight: 800, fontSize: 11 }}>Clear</button>}
                <button onClick={() => setActivityOpen(false)} aria-label="Close" className="tap" style={{ border: "none", background: "var(--elev)", borderRadius: 9, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer" }}><X size={15} /></button>
              </div>
            </div>
            <div className="hide-scroll" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {activity.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>No recent activity yet. Orders, rejects and connections will appear here.</div>
              ) : (() => {
                // Collapse consecutive identical entries (same text + same success/error) into one row with a
                // ×N badge, so a repeating "outcome unknown" doesn't stack ten times and bury everything else.
                const grouped = [];
                for (const a of activity) {
                  const last = grouped[grouped.length - 1];
                  if (last && last.text === a.text && !!last.err === !!a.err) { last.count++; if (a.at > last.at) last.at = a.at; }
                  else grouped.push({ ...a, count: 1 });
                }
                return grouped;
              })().map((a, i) => {
                // Connection / unknown-outcome errors are the recurring pain point — give them a next step
                // (open the broker sheet, where the honest verify status + IP-whitelist fix hint live) instead
                // of leaving the user only with a worry.
                const connErr = a.err && /outcome unknown|couldn't confirm|couldn.t read your|couldn.t reach|whitelist|not working|connection/i.test(a.text || "");
                return (
                <div key={a.at + "-" + i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: "var(--elev)", border: "1px solid " + (a.err ? "rgba(232,72,85,.35)" : "var(--line)") }}>
                  {a.err ? <X size={15} color="var(--down)" style={{ flex: "0 0 auto", marginTop: 1 }} /> : <Check size={15} color="var(--up)" style={{ flex: "0 0 auto", marginTop: 1 }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.4 }}>{a.text}{a.count > 1 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, padding: "1px 5px" }}>×{a.count}</span>}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{new Date(a.at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    {connErr && (
                      <button onClick={() => { setActivityOpen(false); setBrokerOpen(true); }} className="tap disp"
                        style={{ marginTop: 8, border: "1px solid var(--down)", background: "var(--down-soft)", color: "var(--down)", borderRadius: 9, padding: "5px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>
                        Check connection
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </Portal>
      )}

      {splash && <MatrixRain onDone={endSplash} />}

      {brokerPrompt && !brokerOpen && (
        <Portal theme={theme}>
          <div onClick={() => setBrokerPrompt(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 148 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 149, padding: "20px 20px 26px", boxShadow: "0 -16px 44px rgba(0,0,0,.3)" }}>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800 }}>Connect your broker</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 7, lineHeight: 1.55 }}>
              Right now your prices come from Yahoo, which is <b style={{ color: "var(--ink)" }}>delayed about 15 minutes</b> on
              NSE. Connect Zerodha or FYERS and Matrix switches to a real-time feed — plus real open interest and market depth.
              <br /><br />
              Your trades stay on virtual capital either way. This is about the data, not your money.
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button onClick={() => setBrokerPrompt(false)} className="tap disp"
                style={{ flex: 1, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                Not now
              </button>
              <button onClick={() => { setBrokerPrompt(false); setBrokerOpen(true); }} className="tap disp"
                style={{ flex: 1.4, border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                Connect broker
              </button>
            </div>
          </div>
        </Portal>
      )}

      {brokerOpen && (
        <ErrorBoundary name="Broker">
          <BrokerSheet
            userId={userId}
            connectedIds={connectedBrokers}
            marketMap={brokerMarketMap}
            marketFilter={brokerMktFilter}
            isAdmin={effAdmin}
            canConnectMarket={canConnectMarket}
            onDisconnect={(bid) => { disconnectBroker(bid); setBuyToast({ t: "Broker disconnected — that market falls back to delayed prices" }); }}
            onClose={() => { setBrokerOpen(false); setBrokerMktFilter(null); }}
            onConnect={async (id, token, extra, mkt) => {
              // Delta connects with no OAuth token; the server signs with its own keys.
              // `extra` carries bring-your-own credentials for Dhan / IND Money / Angel One.
              // `mkt` (when connecting for a specific market) makes this the preferred driver.
              await connectBroker(id, token, extra, mkt);
              setBuyToast({ t: "Broker connected" });
            }}
          />
        </ErrorBoundary>
      )}
      {confirmOrder && (
        <ErrorBoundary name="Order confirmation">
          <ConfirmOrder
            order={confirmOrder}
            wallet={walletMap[confirmOrder.market] ?? 0}
            mode={mode}
            brokerName={(brokerFor(confirmOrder.market) && brokerFor(confirmOrder.market).meta ? brokerFor(confirmOrder.market).meta.name : (liveBroker ? liveBroker.name : null))}
            supportedOrderTypes={mode === "real" ? orderTypesOf(brokerCaps, (brokerFor(confirmOrder.market) && brokerFor(confirmOrder.market).id) || (liveBroker && liveBroker.id)) : null}
            onConfirm={runConfirmedOrder}
            busy={confirmBusy}
            note={confirmNote}
            onCancel={() => { if (!confirmBusy) { setConfirmOrder(null); setConfirmNote(null); } }}
          />
        </ErrorBoundary>
      )}
      {walletOpen && (
        <WalletSheet
          walletMap={walletMap}
          onAdd={(mkt, amt) => {
            adjustWallet(mkt, amt);
            setDeposits((d) => [...d, { at: Date.now(), market: mkt, amount: amt }]);
            setBuyToast({ t: `Added ${fmt(amt, mkt)} to your ${MKT_LABEL[mkt] || mkt} wallet` });
          }}
          onReset={() => {
            setWalletMap({ IN: 1000000, US: 1000000, Crypto: 1000000, Commodity: 1000000 });
            setDeposits([]);   // the ledger describes the wallets; reset both or neither
            setBuyToast({ t: "All wallets reset to their starting balance" });
          }}
          onClose={() => setWalletOpen(false)}
        />
      )}
      {search && (
        <ErrorBoundary name="Search">
          <SearchOverlay onClose={() => setSearch(false)} onOpen={openStock} />
        </ErrorBoundary>
      )}
      {showProfile && <ProfileSheet onAdmin={effAdmin ? openAdmin : undefined} isAdminUser={isAdminUser} adminMode={adminMode} onToggleAdminMode={() => setAdminMode((v) => !v)} onBroker={openBrokers} brokerName={liveBroker ? liveBroker.name : null} profile={profile} walletMap={walletMap} portfolio={portfolio} trades={trades} deposits={deposits} market={market} onClose={() => setShowProfile(false)} onTradeHistory={() => setHistOpen(true)} auth={auth} onLogin={() => setLoginOpen(true)} onLogout={() => { doLogout(); setProfile(null); setOnboardSkipped(false); setAuthed(false); setLoginOpen(false); }} onPersonalise={() => setRepersonalise(true)} onUsernameChanged={(u) => onAuthed({ ...auth, username: u })} onEmailChanged={(em) => onAuthed({ ...auth, email: em })} marketBrokers={brokerMarketMap} houseFeeds={houseFeeds} onDisconnectBroker={(bid) => { disconnectBroker(bid); setBuyToast({ t: "Broker disconnected" }); }} appSettings={appSettings} onSaveAppSettings={saveAppSettings} riskLimits={riskLimits} riskSaveStatus={riskSaveStatus} onSaveRiskLimits={(rl) => setRiskLimits(rl)} onDeleteAccount={async () => { try { await apiDeleteAccount(); } catch { /* proceed to sign out regardless */ } setShowProfile(false); doLogout(); setProfile(null); setOnboardSkipped(false); setAuthed(false); setBuyToast({ t: "Your account and all data have been deleted." }); }} onReconcileDelta={reconcileWithDelta} onClearVirtual={async () => { const r = await clearVirtualTrades(); setTrades((prev) => { const kept = (prev || []).filter((t) => t.real === true); try { lsSet("mx_trades_" + userId, kept); } catch (e) { /* cache best-effort */ } return kept; }); setBuyToast({ t: "Virtual trades cleared." }); return r; }} />}
      {adminOpen && <AdminPanel userId={userId} adminKey={adminKey} onClose={() => setAdminOpen(false) /* keep key in memory so admin actions (idea approval) work this session */} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onAuthed={onAuthed} />}
      {histOpen && (
        <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 150, display: "grid", placeItems: "center", background: "rgba(0,0,0,.4)", color: "#fff", fontSize: 13 }}>Loading…</div>}>
          <TradeHistory userId={userId} trades={trades} market={market} mode={mode} heldSyms={(portfolio || []).map((h) => h.sym)} onClose={() => setHistOpen(false)} />
        </Suspense>
      )}
      {buyToast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", zIndex: 90, pointerEvents: "none" }}>
          <div className="card glow" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", maxWidth: 380, border: "1px solid " + (buyToast.e ? "var(--down)" : "var(--up)") }}>
            {buyToast.e ? <X size={16} color="var(--down)" /> : <Check size={16} color="var(--up)" />}
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{buyToast.t}</span>
          </div>
        </div>
      )}
    </div>
    </BuyGateContext.Provider>
  );
}

/**
 * The root ErrorBoundary.
 *
 * Every other boundary in the app sits INSIDE App — so a throw in App's own render
 * (a bad import, an undefined at module scope, a hook that blows up) had nothing
 * above it to catch it, and the deploy went white with no message. That is the
 * worst possible failure: no page, no error, nothing to debug.
 *
 * main.jsx imports this default export, so it keeps working untouched.
 */
/* R19-P1-02: one cryptographically-random id per order INTENT, minted when the confirm sheet opens and reused
   for every retry of that action until a terminal broker outcome — the server's idempotency key. */
function newActionId() {
  try { if (globalThis.crypto && globalThis.crypto.randomUUID) return `mx_${globalThis.crypto.randomUUID()}`; } catch { /* fall through */ }
  return `mx_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
export default function App() {
  return (
    <ErrorBoundary name="Matrix">
      <AppInner />
    </ErrorBoundary>
  );
}
