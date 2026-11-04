/* Phase 1 of server-side automation: mirror the user's auto-trading settings (screener on/off, Smart-Auto-Buy
   capital/symbols/product, Ideas capital) to the backend so the server-side engines can run them 24/7 regardless
   of whether the app is open. The client keeps writing to localStorage for instant UX; this ADDITIONALLY pushes a
   structured blob to /api/auto-settings whenever something changes. Nothing here places orders. */
import { BACKEND_URL } from "../config";
import { getAuthToken } from "./tradeService";
import { lsGet } from "../lib/format";
import { UNIVERSE } from "../domain/universe";

const tokenHdr = () => { const t = (() => { try { return getAuthToken(); } catch { return null; } })(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const MARKETS = ["IN", "US", "Crypto", "Commodity", "USStockTokens", "FNO"];
const MODES = ["virtual", "real"];
// Default per-trade capital when the user hasn't explicitly saved one (mirrors the UI's shown default), so the
// server engine never sees "no capital set" just because the value was left at its default.
const capDefault = (m) => ((m === "US" || m === "Crypto" || m === "USStockTokens") ? 1000 : 100000);

/* Read every enabled screener's FULL config out of localStorage into
   { market: { "<key>[:sell]": { enabled, defs, entry, tf, sl, tp, symbols, notional, short, modes } } }.
   The screener card writes `mx_scrcfg_<key>_<market>[_sell]` (its defs/entry/tf/sl/tp/basket/capital/mode) on
   every toggle so the server engine can run the exact same scan. Only enabled screeners are included. */
function collectScreeners() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k && k.match(/^mx_scrauto_(.+?)_(IN|US|Crypto|Commodity|USStockTokens|FNO)(_sell)?$/);
      if (!m) continue;
      let v = false; try { v = JSON.parse(localStorage.getItem(k)); } catch { v = false; }
      if (v !== true) continue;
      const [, key, market, sell] = m;
      const cfg = lsGet(`mx_scrcfg_${key}_${market}${sell ? "_sell" : ""}`, null);
      if (!cfg || !Array.isArray(cfg.entry) || !cfg.entry.length) continue;   // no runnable cfg → skip (server can't scan it)
      (out[market] = out[market] || {})[key + (sell ? ":sell" : "")] = {
        enabled: true, defs: cfg.defs || [], entry: cfg.entry, tf: cfg.tf || "5m",
        sl: cfg.sl != null ? Number(cfg.sl) : null, tp: cfg.tp != null ? Number(cfg.tp) : null,
        symbols: Array.isArray(cfg.symbols) ? cfg.symbols : [], capital: Number(cfg.capital) || 0,
        short: !!(sell || cfg.short), modes: cfg.modes || (cfg.mode ? { [cfg.mode]: true } : {}),
      };
    }
  } catch { /* storage unavailable — empty blob */ }
  return out;
}

/* Build the full settings blob the server stores. `live` carries the React-state values the DOM owns right now
   (Smart-Auto-Buy on/off map + deploy-capital map) that aren't in localStorage; screeners/ideas/product are read
   straight from localStorage. */
export function collectAutoSettings({ autoOnMap = {}, deployCapMap = {} } = {}) {
  const prodMap = lsGet("mx_autobuy_product", {}) || {};
  const smartAutoBuy = {}, ideas = {};
  const symsOf = (market) => ((UNIVERSE[market] || []).map((s) => s.sym));
  for (const market of MARKETS) {
    // Smart-Auto-Buy: on/off is per market+mode (autoOnMap key). Symbols = the market universe (server ranks).
    for (const mode of MODES) {
      if (autoOnMap[`${market}:${mode}`]) {
        (smartAutoBuy[market] = smartAutoBuy[market] || {})[mode] = {
          enabled: true,
          capital: deployCapMap[market] != null ? Number(deployCapMap[market]) : capDefault(market),
          product: prodMap[market] || null,
          symbols: symsOf(market),
        };
      }
    }
    // Ideas: a single per-market on/off that applies to the mode it was enabled in (stored alongside).
    if (lsGet(`mx_ideas_autobuy_${market}`, false)) {
      const mode = lsGet(`mx_ideas_mode_${market}`, "virtual") === "real" ? "real" : "virtual";
      (ideas[market] = ideas[market] || {})[mode] = {
        enabled: true,
        capital: Number(lsGet(`mx_ideas_cap_${market}`, 0)) || capDefault(market),
        symbols: symsOf(market),
      };
    }
  }
  return { screeners: collectScreeners(), smartAutoBuy, ideas };
}

export async function pushAutoSettings(settings) {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/auto-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tokenHdr() },
      body: JSON.stringify({ settings }),
    });
    return r.ok ? await r.json().catch(() => null) : null;
  } catch { return null; }
}

export async function fetchAutoSettings() {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/auto-settings`, { headers: { ...tokenHdr() } });
    const d = r.ok ? await r.json().catch(() => ({})) : {};
    return d.settings || null;
  } catch { return null; }
}

/* Toggle handlers that write straight to localStorage (screeners, ideas) can't be observed by React, so they
   fire this event; the app-level sync listens for it and re-pushes the blob. */
export function notifyAutoSettingsChanged() {
  try { window.dispatchEvent(new Event("mx-autosettings-changed")); } catch { /* non-browser */ }
}

/* Last server-side auto-engine outcome per market/source — for the "why no trades" indicator. */
export async function fetchAutoStatus() {
  if (!BACKEND_URL) return null;
  try {
    const r = await fetch(`${BACKEND_URL}/api/auto-status`, { headers: { ...tokenHdr() } });
    const d = r.ok ? await r.json().catch(() => ({})) : {};
    return d.status || null;
  } catch { return null; }
}

/* Turn a raw engine reason code into a short human line. */
export function autoReasonText(reason) {
  const map = {
    placed: "firing — entries placed",
    "market-closed": "market closed — fires during session hours",
    "no-qualifying-pick": "no strong pick today (needs a ≥2.5 setup)",
    "no-screener-match": "no screener matches right now",
    "no-idea-today": "no ideas published today",
    "no-symbols": "no symbols configured",
    "no-idea-price": "idea had no usable price",
    "amount-too-small": "per-trade amount below the broker minimum — raise capital",
    "no-capital-set": "set a capital amount",
    "already-today": "already entered today",
    "already-open": "already holding this position",
    "no-broker-session": "broker not connected for this market",
    "fill-unverified-broker": "this broker isn't enabled for unattended auto",
    capability: "this broker isn't certified for unattended auto",
    "reconciliation-locked": "paused — reconcile with your broker",
    "risk-read-failed": "couldn't read risk state this cycle",
    "account-unverifiable": "couldn't verify broker account this cycle",
    "daily-loss-limit": "daily-loss limit hit — paused for the session",
    "account-inactive": "account not active (blocked/unapproved)",
    "commodity-real-needs-derivative-route": "commodity real auto isn't wired yet (paper only)",
    "short-not-supported": "auto-short only supported on Delta",
    "bad-input": "no price/amount available",
    "dry-run": "preview mode (live orders disabled on the server)",
  };
  if (!reason) return "waiting for the next run";
  if (reason.startsWith("risk:")) return "blocked by risk checks: " + reason.slice(5);
  if (reason.startsWith("error:")) return "error: " + reason.slice(6);
  return map[reason] || reason;
}
