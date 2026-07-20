# Matrix One — E2E tests (Playwright)

Browser click-through tests. **Every `/api/**` call is stubbed** (see `e2e/fixtures.js`), so a test
can never reach a real broker, Yahoo, FMP, or indianapi — no orders, no live data, no keys needed.
There's even an explicit test asserting no real broker/data host is ever contacted.

## One-time setup
```bash
cd matrix-frontend
npm install
npx playwright install chromium
```

## Run
```bash
npm run build          # tests run against the built app (vite preview serves dist on :4173)
npm run test:e2e       # headless
npm run test:e2e:ui    # interactive UI mode — best for tuning selectors
```

## What's covered
- **smoke.spec.js** — app boots past the splash/login gate into the dashboard; bottom nav renders; market tabs (Indian/US/Crypto) switch without errors.
- **flows.spec.js** — open a stock detail; Neo interprets a plain-English strategy prompt; the Delete-account confirmation shows its data-loss warning (and is cancelled, never confirmed); and a guard test proving no real broker/market host is called.

## How the stubbing works
`e2e/fixtures.js` extends Playwright's `test`:
1. Seeds `sessionStorage`/`localStorage` so the app opens straight into the dashboard as a guest.
2. Routes `**/api/**` to canned JSON (`mockFor`) — quotes, history, indicators, fundamentals, news, earnings, app-settings, broker status, etc.
3. Belt-and-suspenders: any request to a known broker/data domain is intercepted and returned empty.

## Notes
- The selectors use forgiving text/regex matches because the UI is dense. On the **first run**, a few may need tightening — run `test:e2e:ui`, watch which locator is ambiguous, and adjust.
- Add a spec per new feature: create `e2e/<feature>.spec.js`, `import { test, expect } from "./fixtures"`, and you inherit the stubbing automatically.
- These are safe to run in CI (headless, no real network).
