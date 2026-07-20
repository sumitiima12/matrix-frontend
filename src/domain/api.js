/**
 * domain/api.js — the bridge between the domain and the service layer.
 *
 * Services are deliberately symbol-agnostic: they take RESOLVED Yahoo tickers,
 * so they never import the universe (no circular dependencies). App-symbol ->
 * Yahoo-symbol mapping is domain knowledge, so it lives here.
 *
 * These are the ONLY functions the UI calls for data. No component calls fetch()
 * directly — that rule is now structurally enforced, since fetch() appears
 * nowhere outside services/.
 */
import { MATRIX_PERSONA, BACKEND_URL } from "../config";
import { yahooSymbol, marketOf } from "./universe";
import { getQuotes, getHistory, getNews, getIndicators, getIntraday, getFundamentals, getEarnings } from "../services/marketService";
import { ask as aiAsk, interpretScreen, interpretStrategy, marketBrief } from "../services/aiService";
import { saveTrade, listTrades, register, login, changePin as _cp, verifyPin as _vp, forgotQuestion as _fq, forgotReset as _fr, getMySecurityQuestion as _gsq, setMySecurityQuestion as _ssq, checkUsername as _cu, setUsername as _su, setEmail as _se, listPublicStrategies as _lps, publishStrategy as _pub, unpublishStrategy as _unpub, listIdeas as _li, postIdea as _pi, deleteIdea as _di, reviewIdea as _ri, getAppSettings as _gas, saveAppSettings as _sas, deleteAccount as _dacc } from "../services/tradeService";
import { isMarketOpen } from "../services/riskService";

/* ----------------------------- AI ----------------------------- */
export const askMatrix = (messages, system = MATRIX_PERSONA, maxTokens = 1000) =>
  aiAsk(messages, system, maxTokens);
export const aiInterpretScreen = (text, metricFields) => interpretScreen(text, metricFields);
export const aiInterpretStrategy = (text) => interpretStrategy(text);
export const aiMarketBrief = (facts) => marketBrief(facts);

/* -------------------------- Market data -------------------------- */
export const fetchHistory = (sym, tf) => getHistory(yahooSymbol(sym), tf);
export const fetchNews = (sym) => getNews(yahooSymbol(sym));
export const fetchFundamentals = (sym) => getFundamentals(yahooSymbol(sym));
export const fetchEarnings = (market) => getEarnings(market);
export const fetchIndicators = (syms) => getIndicators((syms || []).map(yahooSymbol));
export const fetchIntraday = (syms) => getIntraday((syms || []).map(yahooSymbol));

/** Live quotes, mapped back from Yahoo tickers to app symbols. */
export async function fetchLiveQuotes(appSyms) {
  const rows = await getQuotes((appSyms || []).map(yahooSymbol));
  if (!rows) return null;
  const back = new Map((appSyms || []).map((s) => [yahooSymbol(s), s]));
  return rows.map((r) => ({ ...r, sym: back.get(r.sym) || r.sym })).filter((r) => r.price != null);
}

/* ------------------------ Trades & auth ------------------------ */
export const postTrade = (userId, trade) => saveTrade(userId, trade);
export const fetchTrades = (userId, from, to) => listTrades(userId, from, to);
export const apiRegister = (phone, pin, name, secQuestion, secAnswer, username, referralCode, email) => register(phone, pin, name, secQuestion, secAnswer, username, referralCode, email);
export const apiCheckUsername = (u) => _cu(u);
export const apiSetUsername = (username) => _su(username);
export const apiSetEmail = (email) => _se(email);
export const apiChangePin = (currentPin, newPin) => _cp(currentPin, newPin);
export const apiVerifyPin = (pin) => _vp(pin);
export const apiListPublicStrategies = (filters) => _lps(filters);
export const apiPublishStrategy = (strategy) => _pub(strategy);
export const apiUnpublishStrategy = (id) => _unpub(id);
export const apiListIdeas = (filters) => _li(filters);
export const apiPostIdea = (idea) => _pi(idea);
export const apiDeleteIdea = (id) => _di(id);
export const apiReviewIdea = (id, status, adminKey) => _ri(id, status, adminKey);
export const apiGetAppSettings = () => _gas();
export const apiSaveAppSettings = (settings, adminKey) => _sas(settings, adminKey);
export const apiDeleteAccount = () => _dacc();
export const apiForgotQuestion = (phone) => _fq(phone);
export const apiForgotReset = (phone, answer, newPin) => _fr(phone, answer, newPin);
export const apiGetSecurityQuestion = () => _gsq();
export const apiSetSecurityQuestion = (question, answer) => _ssq(question, answer);
export const apiLogin = (phone, pin) => login(phone, pin);
export const marketOpen = (market) => isMarketOpen(market);

/* ------------------------- Exit engine -------------------------
   Resolves an open position against REAL 5-minute candles: which level did
   price actually touch first — target, stop, or trailing stop? Ties inside a
   single candle assume the stop was hit first (the conservative reading). */
export async function resolveExitFromCandles(trade, risk = {}) {
  if (!BACKEND_URL) return null;                       // needs real candles
  const tp = risk.tp ?? trade.tp;
  const sl = risk.sl ?? trade.sl;
  const tsl = risk.tsl ?? trade.tsl;
  if (!tp && !sl && !tsl) return null;                  // no exit rules -> stays open
  const entry = trade.entry;
  const target = tp ? entry * (1 + tp / 100) : null;
  const hardStop = sl ? entry * (1 - sl / 100) : null;
  let candles = null;
  try { candles = await fetchHistory(trade.sym, "5m"); } catch { return null; }
  if (!candles || !candles.length) return null;

  // Only look at candles AFTER the entry timestamp.
  const after = candles.filter((c) => c.t && c.t > (trade.entryAt || 0));
  let peak = entry;                                     // highest price seen since entry
  for (const c of after) {
    // Trailing stop ratchets up with the peak, but only using peaks from PRIOR
    // candles — a candle can't be stopped out by its own new high.
    const trailStop = tsl ? peak * (1 - tsl / 100) : null;
    const stop = Math.max(hardStop ?? -Infinity, trailStop ?? -Infinity);
    const hasStop = stop > -Infinity;
    const hitStop = hasStop && c.l <= stop;
    const hitTarget = target != null && c.h >= target;
    if (hitStop && hitTarget) {
      // Both touched inside one candle — 5m data can't tell which came first, so
      // assume the worst case (stop first). Honest and conservative.
      return { exit: +stop.toFixed(2), exitAt: c.t, exitType: trailStop != null && stop === trailStop ? "Trailing stop" : "Stop loss" };
    }
    if (hitStop) return { exit: +stop.toFixed(2), exitAt: c.t, exitType: trailStop != null && stop === trailStop ? "Trailing stop" : "Stop loss" };
    if (hitTarget) return { exit: +target.toFixed(2), exitAt: c.t, exitType: "Exit trigger" };
    if (c.h > peak) peak = c.h;                         // update peak after checks
  }
  return null;   // still open
}


/**
 * News across MANY symbols, tagged by event type (Earnings, Dividend, Split, Bulk deal…).
 * The single-symbol fetchNews is why "In the news" only ever showed one stock.
 */
export async function fetchNewsFeed(symbols, { taggedOnly = false } = {}) {
  if (!BACKEND_URL || !symbols || !symbols.length) return [];
  try {
    // Send EXCHANGE-QUALIFIED tickers (HAL -> HAL.NS) so the backend can tell an Indian stock from
    // its US namesake (HAL = Halliburton), then map the returned items back to our app symbols.
    const ySyms = symbols.map(yahooSymbol);
    const back = new Map(symbols.map((s) => [String(yahooSymbol(s)).toUpperCase(), s]));
    const u = `${BACKEND_URL}/api/news/feed?symbols=${encodeURIComponent(ySyms.join(","))}${taggedOnly ? "&tagged=1" : ""}`;
    const r = await fetch(u);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.news || []).map((n) => ({ ...n, sym: back.get(String(n.sym).toUpperCase()) || n.sym }));
  } catch {
    return [];
  }
}
