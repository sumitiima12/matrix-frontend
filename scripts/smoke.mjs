/**
 * Tiny pre-deploy smoke test.
 *
 * It server-renders the main pages with representative props — crucially in BOTH
 * "virtual" and "real" mode, and with a REAL-broker portfolio shaped the way the
 * backend actually sends it ({ holdings:[...], cash }). That is exactly the class of
 * bug that slipped through once (calling .filter on the portfolio object), so the
 * test renders the tree and fails loudly if any page throws during render.
 *
 * Run:  npm run smoke      (bundles with esbuild, then renders under Node)
 * Exit: 0 = all good, 1 = a page failed to render (do NOT deploy).
 */
import { build } from "esbuild";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => JSON.stringify(path.join(root, p));

// ---- 1. Minimal browser shims (set BEFORE the app modules execute) ----
const store = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { for (const k in m) delete m[k]; }, key: () => null, length: 0 }; };
// Some globals (e.g. navigator) are read-only getters in Node — force them with defineProperty.
const set = (k, v) => { try { globalThis[k] = v; } catch { try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); } catch {} } };
set("window", globalThis);
set("self", globalThis);
set("localStorage", store());
set("sessionStorage", store());
set("navigator", { userAgent: "node-smoke", language: "en" });
set("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
set("scrollTo", () => {});
set("requestAnimationFrame", (cb) => setTimeout(cb, 0));
set("cancelAnimationFrame", () => {});
set("innerWidth", 390); set("innerHeight", 844);
set("addEventListener", () => {}); set("removeEventListener", () => {});
set("fetch", () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") }));
const el = () => ({ style: {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, getContext: () => ({}), children: [], setProperty() {} });
set("document", { createElement: el, createElementNS: el, head: el(), body: el(), documentElement: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, cookie: "" });

// ---- 2. The render program (bundled so JSX + imports resolve) ----
const entry = `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomeView from ${P("src/pages/Dashboard.jsx")};
import Automation from ${P("src/pages/Automation.jsx")};

const realPortfolio = { holdings: [{ sym: "AAPL", qty: 2, avg: 100, value: 240, pnl: 40, market: "US" }], cash: 500 };
const noop = () => {};
const homeProps = (mode, market) => ({
  market, setMarket: noop, segment: "", setSegment: noop, list: [], onOpen: noop, onBuy: noop, onAutoBuy: noop,
  mode, watch: [], toggleWatch: noop, profile: {}, portfolio: [], realPortfolio, onRefreshReal: noop, wallet: 0,
  onGoPortfolio: noop, onRecord: noop, watchlists: [], addToWatch: noop, createWatchlist: noop, trades: [],
  liveTick: 0, onWhy: noop, autoOnMap: {}, setAutoOnMap: noop,
});
const autoProps = (appMode) => ({ market: "Crypto", appMode, onRecord: noop, trades: [], strats: [], setStrats: noop, onExitAll: noop, me: "tester", isAdmin: false, userId: "u1", brokerFor: () => null, adminKey: "" });

let failed = 0;
function check(name, element) {
  try { renderToStaticMarkup(element); console.log("  ✓", name); }
  catch (e) { failed++; console.error("  ✗", name, "->", (e && e.message) || e); }
}

console.log("Rendering pages…");
check("Home · virtual · US", React.createElement(HomeView, homeProps("virtual", "US")));
check("Home · real · US", React.createElement(HomeView, homeProps("real", "US")));
check("Home · real · Crypto", React.createElement(HomeView, homeProps("real", "Crypto")));
check("Home · virtual · IN", React.createElement(HomeView, homeProps("virtual", "IN")));
check("Automation · virtual", React.createElement(Automation, autoProps("virtual")));
check("Automation · real", React.createElement(Automation, autoProps("real")));
globalThis.__SMOKE_FAILED__ = failed;
`;

const res = await build({
  stdin: { contents: entry, resolveDir: root, loader: "js" },
  bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent",
  loader: { ".png": "empty", ".jpg": "empty", ".jpeg": "empty", ".svg": "empty", ".css": "empty", ".gif": "empty", ".webp": "empty" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env": '{"MODE":"production","PROD":true,"DEV":false,"VITE_API_URL":"","BASE_URL":"/"}',
  },
}).catch((e) => { console.error("SMOKE: bundle/compile failed —\n" + (e.message || e)); process.exit(1); });

// ---- 3. Execute the bundle in-process (shims already installed) ----
try {
  const code = res.outputFiles[0].text;
  new Function("require", "module", "exports", code)(require, { exports: {} }, {});
} catch (e) {
  console.error("SMOKE: page module threw at import time —\n" + (e.message || e));
  process.exit(1);
}

const failed = globalThis.__SMOKE_FAILED__ || 0;
if (failed) { console.error(`\nSMOKE FAILED: ${failed} page(s) crashed. Do NOT deploy.`); process.exit(1); }
console.log("\nSMOKE PASSED: all pages render in both modes.");
