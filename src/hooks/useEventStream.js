import { useEffect, useRef, useState } from "react";
import { isBackgrounded, isOnline, onPageStateChange } from "../services/dataCoordinator";

/**
 * useEventStream — subscribe to the backend money-path event stream (PERF-9).
 *
 * The backend pushes notices/order/position/risk/connection events over Server-Sent Events
 * (GET /api/stream) the instant they happen, instead of the browser polling on a timer. This hook
 * owns ONE EventSource for the app and hands each parsed event to `onEvent`.
 *
 * It is deliberately additive and fail-soft:
 *   • If SSE can't connect (or the browser lacks EventSource), `connected` stays false and the caller
 *     keeps its existing polling fallback — no events are lost, they just arrive on the old cadence.
 *   • While the tab is hidden or offline we close the stream (nothing to react to; don't hold a socket
 *     open in a backgrounded tab). When the tab is foregrounded again we reconnect and the caller should
 *     do one catch-up poll to bridge the gap.
 *   • Auth is cookie/session based on the same origin, so no token is placed in the URL.
 *
 * @param {object}   opts
 *   enabled   gate the whole thing (e.g. only when logged in).
 *   url       stream endpoint (default "/api/stream").
 *   onEvent   (evt) => void — called with each parsed event object ({ type, ... }).
 *   onReconnect optional () => void — fired when the stream (re)connects, so the caller can catch up.
 * @returns { connected }
 */
export function useEventStream({ enabled = true, url = "/api/stream", onEvent, onReconnect } = {}) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent); onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect); onReconnectRef.current = onReconnect;
  const esRef = useRef(null);

  useEffect(() => {
    const supported = typeof window !== "undefined" && typeof window.EventSource !== "undefined";
    if (!enabled || !supported) return undefined;

    let closed = false;

    const close = () => {
      if (esRef.current) { try { esRef.current.close(); } catch { /* ignore */ } esRef.current = null; }
      setConnected(false);
    };

    const open = () => {
      if (closed || esRef.current) return;
      if (isBackgrounded() || !isOnline()) return;      // don't hold a stream open in a hidden/offline tab
      let es;
      try { es = new EventSource(url, { withCredentials: true }); }
      catch { return; }                                  // fall back to polling
      esRef.current = es;
      es.onopen = () => { if (!closed) { setConnected(true); try { onReconnectRef.current && onReconnectRef.current(); } catch { /* ignore */ } } };
      es.onmessage = (e) => {
        if (closed || !e || !e.data) return;
        let evt; try { evt = JSON.parse(e.data); } catch { return; }
        if (evt && evt.type === "hello") return;         // handshake, not a domain event
        try { onEventRef.current && onEventRef.current(evt); } catch { /* ignore */ }
      };
      // On error the browser auto-reconnects using our `retry:` hint; if it hard-closes, drop to polling.
      es.onerror = () => { setConnected(false); if (es.readyState === 2) close(); };
    };

    open();

    // Match the coordinator's page-state model: close when hidden/offline, reopen when foregrounded.
    const offPage = onPageStateChange(({ hidden, online }) => {
      if (hidden || !online) close();
      else if (!esRef.current) open();
    });

    return () => { closed = true; offPage(); close(); };
  }, [enabled, url]);

  return { connected };
}

export default useEventStream;
