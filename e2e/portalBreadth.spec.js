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
    await btn.focus().catch(() => {});
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);
    const dlg = page.getByRole("dialog").first();
    if (await dlg.count()) return { dlg, trigger: btn };
    const modal = page.locator("[aria-modal='true']").first();
    if (await modal.count()) return { dlg: modal, trigger: btn };
  }
  throw new Error("R32-P3-02: no money-action dialog could be opened — the portal journey did not happen");
}

test.describe("portal breadth — mandatory dialog + focus restoration (R32-P3-02)", () => {
  test("a dialog opens on a SMALL-HEIGHT viewport, stays on-screen, and Escape closes it", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 480 });
    await enterApp(page);
    const { dlg } = await openDialogOrFail(page);
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box, "dialog has a layout box").not.toBeNull();
    expect(box.y, "dialog top is not pushed off-screen").toBeGreaterThanOrEqual(-1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a dialog stays a proper modal across LANDSCAPE rotation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterApp(page);
    const { dlg } = await openDialogOrFail(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await expect(dlg).toBeVisible();
    const role = await dlg.getAttribute("role");
    const modal = await dlg.getAttribute("aria-modal");
    expect(role === "dialog" || modal === "true", "still an ARIA modal after rotation").toBeTruthy();
  });

  test("focus is RESTORED to the exact trigger after the dialog closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterApp(page);
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

  test("the app ACTUALLY declares iOS safe-area support (env insets or viewport-fit=cover)", async ({ page }) => {
    await enterApp(page);
    const usesSafeArea = await page.evaluate(() => {
      let css = "";
      for (const sh of Array.from(document.styleSheets)) {
        try { for (const r of Array.from(sh.cssRules || [])) css += r.cssText; } catch { /* cross-origin */ }
      }
      const inline = Array.from(document.querySelectorAll("[style]")).map((e) => e.getAttribute("style")).join(" ");
      const meta = document.querySelector('meta[name="viewport"]');
      const viewportFit = !!(meta && /viewport-fit=cover/.test(meta.getAttribute("content") || ""));
      return /safe-area-inset|env\(\s*safe-area/.test(css + " " + inline) || viewportFit;
    });
    expect(usesSafeArea, "app must declare safe-area insets or viewport-fit=cover for notch devices").toBe(true);
  });
});
