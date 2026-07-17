import React, { useCallback, useState, useMemo, useRef, useEffect, Suspense } from "react";
import { fetchIndicators, fetchTrades, marketOpen, postTrade, resolveExitFromCandles, fetchLiveQuotes } from "./domain/api";
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
import BuyButton from "./components/common/BuyButton";
import { PATTERNS, TF_N } from "./lib/patterns";
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
import { brokerPlaceOrder } from "./services/brokerService";
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
const DetailPage = React.lazy(() => import("./pages/StockDetail"));
const Portfolio = React.lazy(() => import("./pages/PortfolioPage"));
const TradeHistory = React.lazy(() => import("./pages/Orders"));
const Automation = React.lazy(() => import("./pages/Automation"));
const Screener = React.lazy(() => import("./pages/Screener"));
const Ideas = React.lazy(() => import("./pages/Ideas"));
const WatchlistView = React.lazy(() => import("./pages/Watchlist"));
import ChatPanel from "./pages/AIAssistant";
const TradeView = React.lazy(() => import("./pages/Trade"));
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
  --shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 24px 56px -22px rgba(0,0,0,.85), 0 8px 20px rgba(0,0,0,.4);
  --glow:0 16px 40px rgba(0,0,0,.5);
  --gold-grad:linear-gradient(120deg,#8A8A92,#D8D8DE 45%,#F4F4F6 55%,#A8A8B0);
  --silver-grad:linear-gradient(135deg,#6E6E78 0%,#C9C9D4 30%,#F4F4F8 50%,#B7B7C2 72%,#6E6E78 100%);
  --card-grad:linear-gradient(160deg,#17171A,#111113);
  --feature-grad:linear-gradient(150deg,#33333a 0%,#232329 42%,#141417 78%,#0d0d10 100%);
  --app-bg:radial-gradient(120% 60% at 50% -10%, #1A1A1D 0%, #0E0E10 50%, #08080A 100%);
  --header-bg:#0B0B0D;
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
  --header-bg:#FFFFFF;
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
.metalblack{position:relative;overflow:hidden;background:linear-gradient(160deg,#333438 0%,#2B2B2B 45%,#232325 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.04), 0 16px 40px rgba(0,0,0,.45);}
.metalblack::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);pointer-events:none;}
.metalblack::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%,rgba(255,255,255,.04),transparent 55%);pointer-events:none;}
/* Homepage cards — premium metallic treatment: edge highlight + rim light + edge reflection (box-shadow), specular highlight (::before). */
.home-metal .card{position:relative;border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1.4px 0 rgba(255,255,255,.22), inset 0 0 0 1px rgba(255,255,255,.05), inset 0 -1px 0 rgba(255,255,255,.05), inset 24px 0 42px -34px rgba(255,255,255,.14), inset -24px 0 42px -34px rgba(255,255,255,.14), 0 24px 56px -22px rgba(0,0,0,.85), 0 8px 20px rgba(0,0,0,.4)}
.home-metal .card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(130% 80% at 18% -12%, rgba(255,255,255,.13), rgba(255,255,255,0) 46%)}
/* Matrix's Picks — soft light-grey cards (dark text), theme-aware. */
.pickcard{background:#F1F1F3 !important;box-shadow:0 1px 2px rgba(20,20,30,.05), 0 10px 24px -16px rgba(20,20,30,.18) !important;border:1px solid #E7E7EA !important}
.theme-dark .pickcard{background:#202024 !important;border:1px solid #2c2c30 !important}
.theme-light .home-metal .card{border-color:rgba(20,20,30,.10);box-shadow:inset 0 1.2px 0 rgba(255,255,255,.9), inset 0 0 0 1px rgba(255,255,255,.5), inset 0 -1px 0 rgba(20,20,30,.05), inset 24px 0 42px -34px rgba(255,255,255,.6), inset -24px 0 42px -34px rgba(255,255,255,.6), 0 18px 44px -22px rgba(20,20,30,.16), 0 6px 16px rgba(20,20,30,.05)}
.theme-light .home-metal .card::before{background:radial-gradient(130% 80% at 18% -12%, rgba(255,255,255,.7), rgba(255,255,255,0) 46%)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .3s ease both}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
/* Bottom-sheet drawers never cover the top 20% of the screen. */
.sheet{animation:sheetUp .28s cubic-bezier(.22,1,.36,1) both;max-height:80vh !important;overflow-y:auto}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shine{background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(160,160,170,.55) 50%,rgba(255,255,255,0) 100%);background-size:200% 100%;animation:shimmer 2.6s infinite}
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
    return prev
      ? { ...seed, active: !!prev.active, alerts: !!prev.alerts, symbols: prev.symbols && prev.symbols.length ? prev.symbols : seed.symbols, cap: prev.cap || seed.cap, tf: prev.tf || seed.tf }
      : { ...seed };
  });
  const userOwn = savedArr.filter((s) => !seedIds.has(s.id));
  return [...userOwn, ...merged];
}

function AppInner() {
  // Theme persists across sessions — it reset to light on every reload before.
  const [theme, setTheme] = useState(() => lsGet("mx_theme", "light"));
  useEffect(() => { lsSet("mx_theme", theme); }, [theme]);
  const [guest, setGuest] = useState(false);
  const [onboardSkipped, setOnboardSkipped] = useState(false);
  const [profile, setProfile] = useState(null);
  /* Auto-Buy on/off PER MARKET. Lifted here (was local to the dashboard, so it reset on
     every reload) and persisted with the rest of the app state — server-side for logged-in
     users, so it survives closing the app. */
  const [autoOnMap, setAutoOnMap] = useState({ IN: false, US: false, Crypto: false, Commodity: false, FNO: false });
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
  const [market, setMarket] = useState("IN");
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
    brokerFor, marketMap: brokerMarketMap, connectedBrokers,
  } = useBroker({ onTick: () => setBrokerTicks((t) => t + 1), userId });

  /* Real mode is only reachable with a broker attached. If the broker drops (token
     expired — they expire daily), fall straight back to Virtual rather than leaving
     the user in a "Real" mode that has no account behind it. */
  useEffect(() => {
    if (mode === "real" && !brokerLive) {
      setMode("virtual");
      setBuyToast({ t: "Broker disconnected — back to Virtual mode", e: true });
    }
  }, [mode, brokerLive]);

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
  const { trades, setTrades, recordTrade, recordBatch, placeOrder, riskLimits, setRiskLimits } =
    useOrders({ portfolio, setPortfolio, walletMap, adjustWallet, userId, broker, notify });
  const [histOpen, setHistOpen] = useState(false);
  const [hydratedUser, setHydratedUser] = useState(null);

  /* ---- Orders: the ONLY way to trade. Everything funnels through the pipeline:
         Risk Engine -> Broker Adapter -> Portfolio -> Journal -> Notifications ---- */
  /* MANUAL orders go through a confirmation sheet. AUTOMATED ones do not: a
     strategy you already armed is not a decision you are making right now, and a
     confirm dialog you cannot answer (because you are asleep) would simply stop it
     from ever firing. So automation calls placeOrder directly, via *Now below. */
  const [confirmOrder, setConfirmOrder] = useState(null);

  /* Buying — even a VIRTUAL/paper buy — requires a signed-in account. A guest who taps
     Buy is sent to the login screen instead of placing an order, so paper trades always
     belong to a real user id (and carry over across devices once they sign in). */
  const requireLogin = () => {
    if (auth) return true;
    setBuyToast({ t: "Log in to trade — buying needs an account." });
    setLoginOpen(true);
    return false;
  };
  const buyStock  = (stock, qty = 1, opts = {}) => { if (!requireLogin()) return false; setConfirmOrder({ s: stock, qty, side: "BUY",  opts, market: marketOf(stock.sym) || market, lot: opts.lot || 1 }); return true; };
  const sellStock = (stock, qty = 1, opts = {}) => { setConfirmOrder({ s: stock, qty, side: "SELL", opts, market: opts.market || marketOf(stock.sym) || market, lot: opts.lot || 1 }); return true; };

  /* AUTO-BUY places orders WITHOUT the per-trade confirm drawer. In Real mode the first
     time it's about to fire we show a single heads-up (see Dashboard), then never again.
     Auto-sell on SL/TP is already handled by the exit monitor in useOrders. */
  const autoBuyNow = (stock, qty = 1, opts = {}) => buyStockNow(stock, qty, { ...opts, tradeType: "Auto Buy" });
  const buyStockNow  = (stock, qty = 1, opts = {}) => { if (!auth) { setBuyToast({ t: "Log in to trade — buying needs an account." }); setLoginOpen(true); return false; } placeOrder({ stock, side: "BUY",  qty, opts }); return true; };
  const sellStockNow = (stock, qty = 1, opts = {}) => { placeOrder({ stock, side: "SELL", qty, opts }); return true; };

  /* THE AUTOMATION LOOP. Evaluates every active strategy's entry/exit rules
     against real candles once a minute and places real orders through the normal
     pipeline. Automated orders skip the confirm dialog on purpose. */
  const autoPositions = useAutomation({
    strats,
    onBuy: (s, q, opts = {}) => buyStockNow(s, q, { ...opts, tradeType: "Automate" }),
    onSell: (s, q, opts = {}) => sellStockNow(s, q, { ...opts, tradeType: "Automate" }),
    userId,
    enabled: !!auth,
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

  /* Finish the broker OAuth handshake. Zerodha comes back with ?request_token=,
     FYERS with ?auth_code=. We strip it from the URL immediately afterwards — a
     token sitting in the address bar ends up in history and in referrer headers. */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get("request_token") || p.get("auth_code");
    if (!token) return;
    const which = p.get("request_token") ? "zerodha" : "fyers";
    connectBroker(which, token)
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
      buyStockNow(optStock, q, { ...opts, product: prod, market: "IN", tradeType: opts.tradeType || "Manual" });
      setBuyToast({ t: `Bought ${o.lots} lot${o.lots > 1 ? "s" : ""} · ${o.optionSymbol}` });
      setConfirmOrder(null);
      return;
    }


    if (mode === "real") {
      /* ROUTE BY MARKET. With FYERS, Schwab and Delta connected at once, "the broker" is
         ambiguous — an Indian buy must go to the Indian broker even while the US and crypto
         feeds are also live. Sending a NIFTY order to Schwab would be rejected at best, and
         filled on some unrelated instrument at worst. */
      const mkt = marketOf(s.sym) || s.market || market;
      const route = brokerFor(mkt);

      if (!route) {
        setBuyToast({ t: `No broker connected for ${MKT_LABEL[mkt] || mkt} — cannot place a real order`, e: true });
        setConfirmOrder(null);
        return;
      }

      const bsym = brokerSymbol(s.sym, route.id);
      if (!bsym) {
        setBuyToast({ t: `${route.meta.name} can't trade ${s.sym} — no symbol mapping`, e: true });
        setConfirmOrder(null);
        return;
      }
      setConfirmOrder(null);
      try {
        const r = await brokerPlaceOrder(
          route.session, userId,
          {
            symbol: bsym, side, qty: q, orderType: "MARKET", product: prod,
            // Native exchange-side SL/TP so exits fire even with the app closed.
            entryPrice: s.price ?? undefined,
            slPct: (side === "BUY" && opts.sl > 0) ? opts.sl : undefined,
            tpPct: (side === "BUY" && opts.tp > 0) ? opts.tp : undefined,
          },
          true,                                 // explicit live confirmation
        );
        let t = `Real ${side.toLowerCase()} sent to ${liveBroker.name} — order ${r.orderId}`;
        const bk = r.bracket;
        const wantsProtection = side === "BUY" && (opts.sl > 0 || opts.tp > 0);
        if (wantsProtection) {
          if (bk && bk.placed) {
            t += " · SL/TP set on exchange";
          } else if (bk && !bk.placed) {
            // Broker supports brackets but this one didn't attach — say so plainly.
            setBuyToast({ t: `Order filled, but SL/TP was NOT set — add it in ${liveBroker.name} (${bk.message})`, e: true }); refreshPortfolio(); return;
          } else {
            // Broker has no auto-bracket yet (FYERS, Zerodha, Dhan, …). Never let the user
            // believe a stop exists when it doesn't.
            setBuyToast({ t: `Order filled. ${liveBroker.name} doesn't auto-set SL/TP yet — please add it manually in ${liveBroker.name}.`, e: true }); refreshPortfolio(); return;
          }
        }
        setBuyToast({ t });
        refreshPortfolio();
      } catch (e) {
        setBuyToast({ t: `Broker rejected the order: ${String(e.message || e)}`, e: true });
      }
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
  }, [userId]);
  // Persist per-user: localStorage always; the server too (debounced) once the remote copy
  // has loaded, so we never overwrite the server with empty local state on first paint.
  useEffect(() => {
    if (hydratedUser !== userId) return;
    const snap = { portfolio, walletMap, watchlists, profile, onboardSkipped, deposits, strats, autoOnMap };
    lsSet("mx_state_" + userId, snap);
    if (BACKEND_URL && auth && getAuthToken() && remoteHydrated) {
      clearTimeout(stateSaveTimer.current);
      stateSaveTimer.current = setTimeout(() => { apiSaveState(userId, snap).catch(() => {}); }, 1200);
    }
  }, [portfolio, walletMap, watchlists, profile, onboardSkipped, deposits, strats, autoOnMap, hydratedUser, userId, remoteHydrated, auth]);
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
  /* Admin vs user experience. Admins DEFAULT to the normal user experience — no console,
     no edit/delete controls — and flip a toggle in their profile to enter admin mode. */
  const [adminMode, setAdminMode] = useState(false);
  const effAdmin = isAdminUser && adminMode;               // gates every admin-only affordance
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");
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
    const key = typeof window !== "undefined" ? window.prompt("Admin key:") : "";
    if (!key) return;
    const ok = await adminCheck(userId, key);
    if (!ok) { setBuyToast({ t: "Not authorized for admin.", e: true }); return; }
    setAdminKey(key);
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

  const openStock = (s) => setDrawer(s);
  const openDetail = (s) => { setDrawer(null); setDetail(s); };
  const goTrade = (s) => { setDrawer(null); setDetail(null); setTradePreset(s); setTab("trade"); };



  // personalised ordering for picks
  const list = useMemo(() => {
    let arr = [...UNIVERSE[market]];
    if (profile) {
      arr.sort((a, b) => {
        /* No cap tier: market cap came from fundamentals, which has no feed. */
        const score = (s) => (profile.sectors.includes(s.sector) ? 3 : 0) + (profile.risk === "Aggressive" ? s.chg : profile.risk === "Conservative" ? -Math.abs(s.chg) : (s.rsi != null ? (s.rsi - 50) / 10 : 0));
        return score(b) - score(a);
      });
    }
    return arr;
  }, [market, profile]);

  const nav = [["home", Home, "Home"], ["ideas", Lightbulb, "Ideas"], ["portfolio", Briefcase, "Portfolio"], ["automation", Bolt, "Auto"], ["ask", NeoIcon, "Neo"], ["watchlist", Star, "Watch"]];

  return (
    <div className={"mx theme-" + theme} style={{ background: "var(--app-bg, var(--bg))", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* fixed gradient backdrop so it stays behind scroll */}
      <div style={{ position: "fixed", inset: 0, background: "var(--app-bg, var(--bg))", zIndex: 0, pointerEvents: "none" }} />
      {!authed && <LoginScreen onGuest={() => { setGuest(true); setAuthed(true); }} onAuthed={(a, opts) => { onAuthed(a, opts); setGuest(false); setAuthed(true); }} />}
      {authed && !guest && auth && !auth.username && getAuthToken() && (
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
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              {/* The wallet icon opens the WALLET, not the profile sheet. */}
              <button onClick={() => setWalletOpen(true)} aria-label="Wallet" className="tap pill gold-border" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", whiteSpace: "nowrap", flexShrink: 0, background: "transparent", cursor: "pointer" }}>
                <Wallet size={15} color="var(--gold)" />
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>{compact(wallet)}</span>
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
                {marketOpen(market) ? "NO DATA" : "CLOSED"}
              </span>
            )}

            {/* VIRTUAL / REAL. Red when armed — this one spends real money. */}
            <Toggle
              on={mode === "real"}
              offLabel="VIRTUAL"
              onLabel="REAL"
              onColor="var(--down)"
              label="Virtual or Real trading"
              onChange={(next) => {
                if (!next) { setMode("virtual"); return; }        // leaving Real is always free
                if (!brokerLive) { setBrokerOpen(true); return; } // no broker, no Real
                setConfirmReal(true);                              // entering Real needs a yes
              }}
            />

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
              {(brokerTick || liveAt) && (
                <span className="mono" style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 700 }}>
                  {new Date(brokerTick || liveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <Toggle
                on={theme === "dark"}
                onChange={(next) => setTheme(next ? "dark" : "light")}
                label="Dark mode"
                onColor="var(--ink)"
              />
              {theme === "dark" ? <Moon size={12} color="var(--muted)" /> : <Sun size={12} color="var(--muted)" />}
            </div>
          </div>

          <div style={{ padding: "0 18px 14px" }}>
            <div onClick={() => setSearch(true)} className="tap" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", color: "var(--muted)", fontSize: 13.5 }}>
              <Search size={17} /> Search any stock, crypto or commodity…
            </div>
          </div>
          {!detail && ["home", "ideas", "automation", "portfolio"].includes(tab) && (
            <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 12px" }}>
              {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["Commodity", "🪙 Commodity"]].map(([k, l]) => (
                <button key={k} onClick={() => setMarket(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, border: "1px solid " + (market === k ? "var(--primary)" : "var(--line)"), background: market === k ? "var(--primary)" : "var(--surface)", color: market === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: "0 18px", position: "relative", zIndex: 1 }}>
          <ErrorBoundary name={detail ? "Stock detail" : tab}>
          <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</div>}>
          {detail ? (
            <DetailPage s={detail} onBack={() => setDetail(null)} watched={watch.includes(detail.sym)} toggleWatch={toggleWatch} onTrade={goTrade} onBuy={buyStock} />
          ) : (
            <>
              {tab === "home" && <HomeView market={market} setMarket={setMarket} segment={segment} onAutoBuy={autoBuyNow} mode={mode} setSegment={setSegment} list={list} onOpen={openStock} onBuy={buyStock} watch={watch} toggleWatch={toggleWatch} profile={profile} portfolio={portfolio} wallet={wallet} onGoPortfolio={() => { setDetail(null); setTab("portfolio"); }} onRecord={recordTrade} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} trades={trades} liveTick={liveTick} onWhy={openWhy} autoOnMap={autoOnMap} setAutoOnMap={setAutoOnMap} />}
              {tab === "trade" && <TradeView walletMap={walletMap} adjustWallet={adjustWallet} portfolio={portfolio} setPortfolio={setPortfolio} preset={tradePreset} market={market} recordTrade={recordTrade} />}
              {tab === "ideas" && <Ideas onOpen={openStock} onBuy={buyStock} market={market} onWhy={openWhy} me={auth ? (auth.username || null) : null} isAdmin={effAdmin} signupAt={auth ? (auth.createdAt || null) : null} />}
              {tab === "automation" && <Automation market={market} onRecord={recordTrade} trades={trades} strats={strats} setStrats={setStrats} onExitAll={exitAllStrategies} me={auth ? (auth.username || null) : null} isAdmin={effAdmin} />}
              {tab === "portfolio" && <Portfolio mode={mode} realPortfolio={realPortfolio} realErr={realErr} realLoading={realLoading} onRefreshReal={() => refreshPortfolio(market)} realAvailable={!!brokerFor(market)} brokerName={(brokerFor(market) && brokerFor(market).meta ? brokerFor(market).meta.name : (liveBroker ? liveBroker.name : null))} portfolio={portfolio} wallet={wallet} market={market} onGoHome={() => { setDetail(null); setTab("home"); }} onBuy={buyStock} onSell={sellStock} onUpdate={updateHolding} priceSnap={priceSnap} onWhy={openWhy} onOpen={openStock} onRemove={(sym) => { setPortfolio((prev) => prev.filter((h) => h.sym !== sym)); setBuyToast({ t: `${sym} removed` }); }} />}
              {tab === "watchlist" && <WatchlistView watchlists={watchlists} activeWl={activeWl} setActiveWl={setActiveWl} createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist} toggleWatch={toggleWatch} onOpen={openStock} />}
              {tab === "ask" && (
                <div className="fade">
                  <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Ask Neo</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Your AI markets expert. Ask about any stock, sector or strategy.</div>
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
        <div className="glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto", background: "var(--header-bg)", borderTop: "1px solid var(--line)", borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px rgba(40,10,80,.3)", display: "flex", padding: "11px 6px 16px", zIndex: 100 }}>
          {nav.map(([k, Icon, label]) => (
            <button key={k} onClick={() => { setTab(k); setTradePreset(null); }} className="tap" style={{ flex: 1, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 2px", minHeight: 52, color: tab === k ? "var(--primary)" : "var(--muted)" }}>
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
      {/* ARMING REAL MODE. Deliberately a full stop, not a toast. From here on, a
          tap on Buy spends actual money — that deserves a sentence and a decision,
          not a silently flipped switch. */}
      {confirmReal && (
        <>
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
              <button onClick={() => { setMode("real"); setConfirmReal(false); setBuyToast({ t: "Real mode — orders now go to your broker", e: true }); }} className="tap disp"
                style={{ flex: 1, border: "none", background: "var(--down)", color: "#fff", borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                Use Real
              </button>
            </div>
          </div>
        </>
      )}

      {splash && <MatrixRain onDone={endSplash} />}

      {brokerPrompt && !brokerOpen && (
        <>
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
        </>
      )}

      {brokerOpen && (
        <ErrorBoundary name="Broker">
          <BrokerSheet
            userId={userId}
            connectedIds={connectedBrokers}
            marketMap={brokerMarketMap}
            marketFilter={brokerMktFilter}
            isAdmin={effAdmin}
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
            onConfirm={runConfirmedOrder}
            onCancel={() => setConfirmOrder(null)}
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
      {showProfile && <ProfileSheet onAdmin={effAdmin ? openAdmin : undefined} isAdminUser={isAdminUser} adminMode={adminMode} onToggleAdminMode={() => setAdminMode((v) => !v)} onBroker={openBrokers} brokerName={liveBroker ? liveBroker.name : null} profile={profile} walletMap={walletMap} portfolio={portfolio} trades={trades} deposits={deposits} market={market} onClose={() => setShowProfile(false)} onTradeHistory={() => setHistOpen(true)} auth={auth} onLogin={() => setLoginOpen(true)} onLogout={() => { doLogout(); setGuest(false); setProfile(null); setOnboardSkipped(false); setAuthed(false); setLoginOpen(false); }} onPersonalise={() => setRepersonalise(true)} onUsernameChanged={(u) => onAuthed({ ...auth, username: u })} onEmailChanged={(em) => onAuthed({ ...auth, email: em })} marketBrokers={brokerMarketMap} houseFeeds={houseFeeds} onDisconnectBroker={(bid) => { disconnectBroker(bid); setBuyToast({ t: "Broker disconnected" }); }} />}
      {adminOpen && <AdminPanel userId={userId} adminKey={adminKey} onClose={() => { setAdminOpen(false); setAdminKey(""); }} />}
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
export default function App() {
  return (
    <ErrorBoundary name="Matrix">
      <AppInner />
    </ErrorBoundary>
  );
}
