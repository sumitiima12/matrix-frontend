/* Phase 1 of server-side automation: mirror the user's auto-trading settings (screener on/off, Smart-Auto-Buy
   capital/symbols/product, Ideas capital) to the backend so the server-side engines can run them 24/7 regardless
   of whether the app is open. The client keeps writing to localStorage for instant UX; this ADDITIONALLY pushes a
   structured blob to /api/auto-settings whenever something changes. Nothing here places orders. */
import { BACKEND_URL } from "../config";
import { getAuthToken } from "./tradeService";
import { lsGet } from "../lib/format";

const tokenHdr = () => { const t = (() => { try { return getAuthToken(); } catch { return null; } })(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const MARKETS = ["IN", "US", "Crypto", "Commodity", "USStockTokens", "FNO"];
const MODES = ["virtual", "real"];

/* Read every `mx_scrauto_<key>_<market>[_sell]` flag out of localStorage into { market: { "<key>[:sell]": bool } }.
   Only `true` values are kept — an absent/false screener simply isn't in the blob. */
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
      (out[market] = out[market] || {})[key + (sell ? ":sell" : "")] = true;
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
  for (const market of MARKETS) {
    for (const mode of MODES) {
      const sabOn = !!autoOnMap[`${market}:${mode}`];
      if (sabOn) {
        (smartAutoBuy[market] = smartAutoBuy[market] || {})[mode] = {
          enabled: true,
          capital: deployCapMap[market] != null ? Number(deployCapMap[market]) : null,
          product: prodMap[market] || null,
        };
      }
      const ideaOn = !!lsGet(`mx_ideas_autobuy_${market}`, false);
      if (ideaOn) {
        (ideas[market] = ideas[market] || {})[mode] = {
          enabled: true,
          capital: Number(lsGet(`mx_ideas_cap_${market}`, 0)) || null,
        };
      }
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
