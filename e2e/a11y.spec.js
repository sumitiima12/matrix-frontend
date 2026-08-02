// e2e/a11y.spec.js — self-contained accessibility checks.
//
// Runs on the SAME fully-stubbed fixtures as the rest of the suite (no real network, boots straight to
// the dashboard), so it's runnable offline with `npm run test:e2e`. Dependency-free — it asserts core
// ARIA landmarks and that interactive controls expose an accessible name, rather than pulling an
// external axe engine. Extend this spec as more of the UI gains a11y coverage.
import { test, expect, enterApp } from "./fixtures";

test.describe("accessibility", () => {
  test("bottom navigation is a labelled landmark whose items all have accessible names", async ({ page }) => {
    await enterApp(page);
    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).toBeVisible();
    const items = nav.getByRole("button");
    const n = await items.count();
    expect(n, "bottom nav should render tab buttons").toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const btn = items.nth(i);
      const name = ((await btn.getAttribute("aria-label")) || (await btn.innerText()) || "").trim();
      expect(name.length, `nav button ${i} must expose an accessible name (aria-label or text)`).toBeGreaterThan(0);
    }
  });

  test("key header controls expose accessible names", async ({ page }) => {
    await enterApp(page);
    // These are icon-only buttons — they MUST carry an aria-label to be usable by screen readers.
    await expect(page.getByRole("button", { name: /toggle light or dark mode/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /virtual wallet|real balance/i })).toBeVisible();
  });
});
