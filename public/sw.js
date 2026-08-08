/* MatrixOne service worker — Web Push receiver.
   Kept intentionally minimal: no offline caching (the app is online-first and money-touching, so we never
   want to serve a stale shell). Its only job is to receive push messages and route notification clicks. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "MatrixOne", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "MatrixOne";
  const urgent = data.severity === "urgent";   // ALERT-1: urgent alerts stay on screen and vibrate
  const options = {
    body: data.body || "",
    icon: "/matrixone-icon.png",
    badge: "/matrixone-icon.png",
    data: { url: data.url || "/", severity: data.severity || "info" },
    tag: data.tag || undefined,
    requireInteraction: urgent,               // urgent notifications don't auto-dismiss
    vibrate: urgent ? [200, 100, 200] : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(url); } catch { /* ignore */ } return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
