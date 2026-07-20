// Shared test fixtures for the Matrix One E2E suite.
//
// THE SAFETY LAYER: `test` here extends Playwright's base test to (a) stub EVERY /api/** request
// with canned JSON, so a test can never reach a real broker, Yahoo, FMP, or indianapi; and
// (b) seed localStorage/sessionStorage so the app boots straight into the dashboard (past the
// splash and login gate) as a guest. If an endpoint isn't explicitly mocked it returns {} — the
// point is that NOTHING hits the network.
import { test as base, expect } from "@playwright/test";

// A tiny universe of fake quotes so the dashboard has something to render.
const QUOTES = [
  { sym: "RELIANCE.NS", name: "Reliance", price: 2900, chg: 1.2, currency: "INR" },
  { sym: "TCS.NS", name: "TCS", price: 3800, chg: -0.4, currency: "INR" },
  { sym: "INFY.NS", name: "Infosys", price: 1600, chg: 0.8, currency: "INR" },
  { sym: "AAPL", name: "Apple", price: 230, chg: 0.5, currency: "USD" },
  { sym: "BTC-USD", name: "Bitcoin", price: 68000, chg: 2.1, currency: "USD" },
];

const candles = () => {
  const out = []; let p = 100;
  for (let i = 0; i < 120; i++) { p += Math.sin(i / 6) * 2; out.push({ t: Date.now() - (120 - i) * 864e5, o: p, h: p + 1, l: p - 1, c: p, v: 1000 }); }
  return out;
};

const FUNDAMENTALS = {
  symbol: "RELIANCE.NS", name: "Reliance", currency: "INR", sector: "Energy",
  marketCap: 1.9e13, peTrailing: 24.5, pb: 2.1, roe: 0.14, profitMargin: 0.1, operatingMargin: 0.14,
  revenueGrowth: 0.09, debtToEquity: 40, dividendYield: 0.004, beta: 0.9, sectorPE: 22,
  peers: [{ name: "ONGC", price: 270, chg: 0.6, pe: 8.2 }, { name: "IOC", price: 170, chg: -0.3, pe: 6.1 }],
};

// Map a request pathname -> mock body.
function mockFor(pathname, url) {
  if (pathname.endsWith("/api/health")) return { ok: true, engines: [], db: "flat-file" };
  if (pathname.endsWith("/api/quote")) return { quotes: QUOTES };
  if (pathname.endsWith("/api/history")) return { candles: candles() };
  if (pathname.endsWith("/api/indicators")) return { indicators: QUOTES.map((q) => ({ sym: q.sym, rsi: 55, sma50: q.price * 0.98, sma200: q.price * 0.95, macd: 1, macdSignal: 0.5, adx: 24, atr: q.price * 0.02, support: q.price * 0.95, resistance: q.price * 1.05, vol: 1e6, avgVol: 8e5, high52: q.price * 1.3, low52: q.price * 0.7 })) };
  if (pathname.endsWith("/api/intraday")) return { intraday: {} };
  if (pathname.includes("/api/news")) return { news: [{ sym: "RELIANCE.NS", t: "Reliance posts record quarter", d: Date.now(), src: "Test", url: "#" }], count: 1 };
  if (pathname.endsWith("/api/fundamentals")) return FUNDAMENTALS;
  if (pathname.endsWith("/api/earnings")) return { upcoming: [{ sym: "AAPL", date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), epsEst: 1.5 }], recent: [{ sym: "TCS", date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10) }] };
  if (pathname.endsWith("/api/app-settings")) return { settings: { allowRealMode: false, allowBrokerConnect: { IN: false, US: false, Crypto: false, Commodity: false } } };
  if (pathname.endsWith("/api/broker/status")) return { brokers: {}, tradingEnabled: false, staticIp: "203.0.113.10" };
  if (pathname.endsWith("/api/broker/connect-info")) return { staticIp: "203.0.113.10" };
  if (pathname.endsWith("/api/public-strategies")) return { strategies: [] };
  if (pathname.endsWith("/api/ideas")) return { ideas: [] };
  if (pathname.endsWith("/api/trades")) return { trades: [] };
  if (pathname.endsWith("/api/autoexit") || pathname.endsWith("/api/autobuy")) return { positions: [], strategies: [], engineLive: false };
  if (pathname.endsWith("/api/state")) return { state: null };
  // Predefined, already-approved test account — login/register always succeed with a token so
  // the suite lands on the dashboard past the (real) admin-approval gate.
  if (pathname.endsWith("/api/login") || pathname.endsWith("/api/register")) {
    return { ok: true, userId: "9990000000", name: "E2E Tester", username: "e2e", email: null, token: "e2e.test.token", createdAt: Date.now() };
  }
  // Any write (order, session, etc.) — acknowledge without doing anything real.
  return { ok: true };
}

// Navigate to the app and get past the splash / login / onboarding / broker gates so a test
// lands on the actual dashboard. Robust to whichever gate appears: it clicks "Continue as guest",
// "Skip", "Maybe later", etc. if present, a couple of times.
export async function enterApp(page) {
  await page.goto("/");
  // Log in with the predefined test account (the stubbed /api/login always returns a token).
  const pinField = page.getByPlaceholder(/PIN/i).first();
  if (await pinField.count().catch(() => 0)) {
    try {
      await page.locator("input").first().fill("9990000000");   // mobile
      await pinField.fill("1234");
      await page.getByText(/LOGIN \/ SIGN UP/i).first().click();
      await page.waitForTimeout(700);
    } catch { /* fall through to dismissals */ }
  }
  // Dismiss any onboarding / prompt sheets that follow login.
  for (let pass = 0; pass < 3; pass++) {
    let acted = false;
    for (const re of [/^Skip$/i, /Maybe later/i, /Not now/i, /Later/i, /Got it/i]) {
      const el = page.getByText(re).first();
      if (await el.count().catch(() => 0)) { try { await el.click({ timeout: 1500 }); acted = true; await page.waitForTimeout(250); } catch {} }
    }
    if (!acted) break;
  }
  await page.waitForTimeout(400);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    // 1. Pre-seed a guest session so the app is inclined to skip gates where it can.
    await page.addInitScript(() => {
      try { sessionStorage.setItem("mx_splash_seen", "1"); } catch {}
      try { localStorage.setItem("mx_auth", "1"); localStorage.setItem("mx_mode", "virtual"); localStorage.setItem("mx_theme", "light"); } catch {}
    });
    // 2. Stub EVERY /api/** call — no real network, ever.
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockFor(url.pathname, url)) });
    });
    // 3. Fail loudly if anything tries to reach a real broker/data host.
    await page.route(/(finance\.yahoo|financialmodelingprep|indianapi|fyers|delta|api\.kite|dhan)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await use(page);
  },
});

export { expect };
