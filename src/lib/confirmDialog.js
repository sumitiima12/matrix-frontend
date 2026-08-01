/**
 * confirmDialog — a promise-based, in-app replacement for window.confirm (P2-21).
 *
 * Native confirm() is unreliable inside mobile webviews / installed PWAs (some suppress it), which is
 * dangerous for a "close this real position?" gate — the dialog can silently not appear. This renders
 * a real in-app modal that always shows, matches the app theme, traps Escape/Enter, and resolves a
 * Promise<boolean>. Plain DOM (no React context) so it can be awaited from any handler:
 *
 *     if (!(await confirmDialog("Close the position now? This cannot be undone."))) return;
 *
 * Falls back to `true` only in non-browser contexts (SSR/tests), never silently on a real client.
 */
export function confirmDialog(message, { title = "Please confirm", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = true } = {}) {
  if (typeof document === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.55);animation:mxFade .12s ease";

    const card = document.createElement("div");
    card.style.cssText = "max-width:380px;width:100%;background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#e5e5e5);border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);font:inherit;font-size:14px;line-height:1.5";

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-weight:800;font-size:15px;margin-bottom:8px";

    const msg = document.createElement("div");
    msg.textContent = message;
    msg.style.cssText = "color:var(--ink-soft,#444);white-space:pre-line;margin-bottom:18px";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = cancelLabel;
    btnCancel.style.cssText = "border:1px solid var(--line,#ccc);background:transparent;color:var(--ink,#111);border-radius:11px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer";

    const btnOk = document.createElement("button");
    btnOk.textContent = confirmLabel;
    btnOk.style.cssText = `border:none;border-radius:11px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer;color:${danger ? "#fff" : "var(--on-primary,#fff)"};background:${danger ? "var(--down,#e5484d)" : "var(--primary,#6d4aff)"}`;

    const done = (val) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* noop */ }
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(true); }
    };

    btnCancel.onclick = () => done(false);
    btnOk.onclick = () => done(true);
    overlay.onclick = (e) => { if (e.target === overlay) done(false); };   // backdrop tap = cancel
    document.addEventListener("keydown", onKey, true);

    row.append(btnCancel, btnOk);
    card.append(h, msg, row);
    overlay.append(card);
    document.body.appendChild(overlay);
    setTimeout(() => { try { btnOk.focus(); } catch { /* noop */ } }, 0);
  });
}

/* Shared card/overlay styling so promptDialog + alertDialog match confirmDialog exactly. */
function makeShell(title, message) {
  const prevFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.55);animation:mxFade .12s ease";
  const card = document.createElement("div");
  card.style.cssText = "max-width:380px;width:100%;background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#e5e5e5);border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);font:inherit;font-size:14px;line-height:1.5";
  const h = document.createElement("div"); h.textContent = title; h.style.cssText = "font-weight:800;font-size:15px;margin-bottom:8px";
  const msg = document.createElement("div"); msg.textContent = message; msg.style.cssText = "color:var(--ink-soft,#444);white-space:pre-line;margin-bottom:18px";
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";
  card.append(h, msg);
  return { prevFocus, overlay, card, row };
}
const okBtn = (label, primary = true) => { const b = document.createElement("button"); b.textContent = label; b.style.cssText = `border:none;border-radius:11px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer;color:#fff;background:${primary ? "var(--primary,#6d4aff)" : "var(--down,#e5484d)"}`; return b; };
const cancelBtn = (label) => { const b = document.createElement("button"); b.textContent = label; b.style.cssText = "border:1px solid var(--line,#ccc);background:transparent;color:var(--ink,#111);border-radius:11px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer"; return b; };

/**
 * promptDialog — in-app replacement for window.prompt. Resolves the entered string, or null on cancel.
 * Same webview-reliability rationale as confirmDialog. Returns null in non-browser contexts.
 */
export function promptDialog(message, { title = "Enter a value", confirmLabel = "OK", cancelLabel = "Cancel", initial = "", password = false, placeholder = "" } = {}) {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const { prevFocus, overlay, card, row } = makeShell(title, message);
    const input = document.createElement("input");
    input.type = password ? "password" : "text"; input.value = initial; input.placeholder = placeholder;
    input.style.cssText = "width:100%;box-sizing:border-box;border:1px solid var(--line,#ccc);border-radius:11px;padding:10px 12px;font:inherit;font-size:14px;margin-bottom:18px;background:var(--surface,#fff);color:var(--ink,#111)";
    const btnCancel = cancelBtn(cancelLabel), btnOk = okBtn(confirmLabel, true);
    const done = (val) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* noop */ } resolve(val); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(input.value); } };
    btnCancel.onclick = () => done(null); btnOk.onclick = () => done(input.value);
    overlay.onclick = (e) => { if (e.target === overlay) done(null); };
    document.addEventListener("keydown", onKey, true);
    row.append(btnCancel, btnOk); card.insertBefore(input, card.childNodes[2] || null); card.append(row); overlay.append(card);
    document.body.appendChild(overlay);
    setTimeout(() => { try { input.focus(); input.select(); } catch { /* noop */ } }, 0);
  });
}

/**
 * alertDialog — in-app replacement for window.alert (a single-button notice). Resolves when dismissed.
 */
export function alertDialog(message, { title = "Notice", confirmLabel = "OK", danger = false } = {}) {
  if (typeof document === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const { prevFocus, overlay, card, row } = makeShell(title, message);
    const btnOk = okBtn(confirmLabel, !danger);
    const done = () => { document.removeEventListener("keydown", onKey, true); overlay.remove(); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* noop */ } resolve(); };
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(); } };
    btnOk.onclick = done; overlay.onclick = (e) => { if (e.target === overlay) done(); };
    document.addEventListener("keydown", onKey, true);
    row.append(btnOk); card.append(row); overlay.append(card);
    document.body.appendChild(overlay);
    setTimeout(() => { try { btnOk.focus(); } catch { /* noop */ } }, 0);
  });
}
