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
          capital: deployCapMap[market] != null ? Number(deployCapMap[market]) : null,
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
        capital: Number(lsGet(`mx_ideas_cap_${market}`, 0)) || null,
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
