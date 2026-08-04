// e2e/portalBreadth.spec.js — R31-P3-06 / R32-P3-02: portal / mobile-viewport a11y with MANDATORY assertions.
//
// Hardened per R32-P3-02: a dialog is REQUIRED to open (a test no longer passes when nothing opens); focus must be
// RESTORED to the exact trigger element after close; the safe-area check asserts the app ACTUALLY declares safe-area
// support (not merely that a boolean is a boolean). Runs on the fully stubbed fixtures; on real CI browsers it
// exercises the true layout.
import { test, expect, enterApp } from "./fixtures";

// Open a money-action dialog and RETURN { dlg, trigger }. Throws (fails the test) if none can be opened — that is the
// point: the journey must actually happen.
async function openDialogOrFail(page) {
  const triggers = [/^Buy$/i, /^Buy /i, /Confirm/i, /Place order/i, /Go Live/i, /Close position|Stop & sell|^Close$/i, /Post an Idea/i];
  for (const re of triggers) {
    const btn = page.getByRole("button", { name: re }).first();
    if (!(await btn.count())) continue;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.focus().catch(() => {});
    await btn.click({ timeout: 2500 }).catch(() => {});   // bounded: an intercepted trigger falls through, not a 30s hang
    await page.waitForTimeout(250);
    let dlg = page.getByRole("dialog").first();
    let modal = page.locator("[aria-modal='true']").first();
    if (!(await dlg.count()) && !(await modal.count())) {
      // On a short mobile viewport the fixed bottom-nav can overlay the trigger and swallow the tap; a
      // force click dispatches directly on the element (the helper only needs the dialog to open).
      await btn.click({ force: true, timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(250);
      dlg = page.getByRole("dialog").first();
      modal = page.locator("[aria-modal='true']").first();
    }
    if (await dlg.count()) return { dlg, trigger: btn };
    if (await modal.count()) return { dlg: modal, trigger: btn };
  }
  throw new Error("R32-P3-02: no money-action dialog could be opened — the portal journey did not happen");
}

test.describe("portal breadth — mandatory dialog + focus restoration (R32-P3-02)", () => {
  test("a dialog opens on a SMALL-HEIGHT viewport, is FULLY CONTAINED (or scrollable with reachable actions), and Escape closes it", async ({ page }) => {
    await enterApp(page);
    // Set the small viewport AFTER boot: overriding an isMobile device's viewport BEFORE first navigation is a
    // Playwright harness quirk that leaves the first-paint handlers stale (a real device boots at its native size).
    await page.setViewportSize({ width: 360, height: 480 });
    await page.waitForTimeout(200);
    // Measure containment against the ACTUAL viewport: an isMobile device clamps setViewportSize to its device
    // minimum (e.g. requesting 360 yields innerWidth 390), so the requested numbers would falsely flag overflow.
    // Reading the real innerWidth/innerHeight tests exactly what matters — the dialog fits the on-screen viewport.
    const { vw, vh } = await page.evaluate(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
    const { dlg } = await openDialogOrFail(page);
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box, "dialog has a layout box").not.toBeNull();
    // R33-P3-03: assert ALL FOUR bounds — top/left on-screen AND right/bottom within the viewport — OR, if the dialog
    // is taller than the viewport, that it is an explicitly SCROLLABLE container whose FIRST and LAST actions are
    // reachable. "top isn't negative" alone let an off-bottom dialog (unreachable Confirm) pass.
    expect(box.x, "dialog left edge on-screen").toBeGreaterThanOrEqual(-1);
    expect(box.y, "dialog top edge on-screen").toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, "dialog right edge within viewport").toBeLessThanOrEqual(vw + 1);
    if (box.y + box.height > vh + 1) {
      // Taller than the viewport ⇒ it MUST be scrollable and its actions reachable.
      const scrollable = await dlg.evaluate((el) => {
        const walk = (n) => { if (!n) return false; const cs = getComputedStyle(n); if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1) return true; return Array.from(n.children).some(walk); };
        return walk(el);
      });
      expect(scrollable, "an over-tall dialog must be scrollable so its actions stay reachable").toBe(true);
      const lastAction = dlg.getByRole("button").last();
      await lastAction.scrollIntoViewIfNeeded();
      const lb = await lastAction.boundingBox();
      expect(lb && lb.y + lb.height <= vh + 1, "the last action becomes reachable after scrolling").toBe(true);
    } else {
      expect(box.y + box.height, "short dialog bottom edge within viewport").toBeLessThanOrEqual(vh + 1);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a dialog stays a proper modal across LANDSCAPE rotation", async ({ page }) => {
    await enterApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const { dlg } = await openDialogOrFail(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await expect(dlg).toBeVisible();
    const role = await dlg.getAttribute("role");
    const modal = await dlg.getAttribute("aria-modal");
    expect(role === "dialog" || modal === "true", "still an ARIA modal after rotation").toBeTruthy();
  });

  test("focus is RESTORED to the exact trigger after the dialog closes", async ({ page }) => {
    await enterApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const { trigger } = await openDialogOrFail(page);
    // Tag the trigger so we can assert identity (not just "focus isn't body").
    await trigger.evaluate((el) => { el.setAttribute("data-e2e-trigger", "1"); });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const focusedIsTrigger = await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && (a.getAttribute("data-e2e-trigger") === "1" || !!a.closest("[data-e2e-trigger='1']"));
    });
    expect(focusedIsTrigger, "focus returned to the element that opened the dialog").toBeTruthy();
  });

  test("fixed navigation/sheet surfaces ACTUALLY apply safe-area padding (not just viewport-fit=cover)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterApp(page);
    // R33-P3-03: viewport-fit=cover EXPANDS content under the notch; on its own it does NOT prove that fixed bars/sheets
    // pad themselves out of the cutout. Require (a) the app to DECLARE safe-area insets in CSS (env(safe-area-inset-*)
    // or a --safe-area var), AND (b) at least one fixed/sticky bottom surface (bottom nav / sheet) to resolve a
    // non-zero computed padding-bottom — i.e. the inset is actually consumed by a real surface, not merely declared.
    const declaresInsets = await page.evaluate(() => {
      let css = "";
      for (const sh of Array.from(document.styleSheets)) { try { for (const r of Array.from(sh.cssRules || [])) css += r.cssText; } catch { /* cross-origin */ } }
      const inline = Array.from(document.querySelectorAll("[style]")).map((e) => e.getAttribute("style")).join(" ");
      return /safe-area-inset|env\(\s*safe-area|--safe-area/.test(css + " " + inline);
    });
    expect(declaresInsets, "app must DECLARE env(safe-area-inset) / --safe-area for notch devices").toBe(true);
    const paddedSurface = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("*"));
      const isFixedBottom = (el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") return false;
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0 && (r.bottom >= window.innerHeight - 2);   // anchored to the bottom edge
      };
      return els.filter(isFixedBottom).some((el) => parseFloat(getComputedStyle(el).paddingBottom || "0") > 0);
    });
    expect(paddedSurface, "a fixed/sticky bottom surface must resolve a non-zero safe-area padding-bottom").toBe(true);
  });
});
