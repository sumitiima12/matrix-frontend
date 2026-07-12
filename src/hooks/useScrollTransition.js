import { useCallback, useEffect, useRef, useState } from "react";

/**
 * hooks/useScrollTransition.js — the "Netflix" scroll gesture.
 *
 * One idea, two uses: when the user reaches a scroll boundary and KEEPS pulling,
 * that gesture means "change this surface's state", not "scroll further".
 *
 *   Stock detail page — keep scrolling past the bottom -> minimise back into the
 *                       carousel card it opened from.
 *   Stock drawer      — keep scrolling past the bottom -> expand into the full
 *                       detail page. No drag handle, no button.
 *
 * Why a hook: this is behaviour, not markup. The drawer and the detail page look
 * nothing alike but want the identical gesture, and a future full-screen chart or
 * news reader will want it too. Keeping it here means no page re-implements it.
 *
 * Design decisions worth knowing:
 *  - Overscroll DISTANCE is accumulated rather than firing on the first event, so
 *    a flick or a momentum bounce can't trigger it by accident. `threshold` is
 *    that distance.
 *  - `progress` (0..1) is returned so the caller can drive a live transform. The
 *    surface visibly shrinks as you pull instead of snapping at the end — that
 *    feedback is what makes the gesture discoverable in the first place.
 *  - Works with an inner scroll container (pass `ref`) OR window scrolling (omit
 *    it): the detail page scrolls the window, the drawer scrolls a div.
 *  - Releasing before the threshold springs back.
 */
export function useScrollTransition({ ref, threshold = 120, onTrigger, enabled = true } = {}) {
  const [progress, setProgress] = useState(0);
  const accum = useRef(0);
  const fired = useRef(false);

  const reset = useCallback(() => {
    accum.current = 0;
    fired.current = false;
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const el = ref?.current || null;      // inner container, or window when absent
    const target = el || window;

    const metrics = () => {
      if (el) return { top: el.scrollTop, view: el.clientHeight, full: el.scrollHeight };
      const d = document.documentElement;
      return {
        top: window.scrollY || d.scrollTop || 0,
        view: window.innerHeight,
        full: Math.max(d.scrollHeight, document.body.scrollHeight),
      };
    };

    /** At the bottom edge, where continuing to pull becomes meaningful. */
    const atBottom = () => {
      const { top, view, full } = metrics();
      if (full <= view + 4) return true;          // too short to scroll at all
      return top + view >= full - 2;              // 2px tolerance for sub-pixel layouts
    };

    const fire = () => {
      if (fired.current) return;
      fired.current = true;
      onTrigger?.();
      setTimeout(reset, 80);                      // let the caller animate / unmount
    };

    const setFrom = (distance) => {
      accum.current = Math.max(0, distance);
      const p = Math.min(1, accum.current / threshold);
      setProgress(p);
      if (p >= 1) fire();
    };

    /* -------------------------- wheel / trackpad -------------------------- */
    const onWheel = (e) => {
      if (!atBottom()) { if (accum.current) reset(); return; }
      if (e.deltaY > 0) setFrom(accum.current + e.deltaY);
      else if (accum.current) reset();
    };

    /* ------------------------------- touch ------------------------------- */
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e) => {
      startY = e.touches[0].clientY;
      tracking = atBottom();
    };

    const onTouchMove = (e) => {
      if (!tracking) {
        if (atBottom()) { startY = e.touches[0].clientY; tracking = true; }   // scrolled into the edge mid-gesture
        return;
      }
      if (!atBottom()) { reset(); tracking = false; return; }

      const dy = startY - e.touches[0].clientY;   // finger moving up => positive
      if (dy > 0) {
        if (e.cancelable) e.preventDefault();     // stop rubber-band eating the gesture
        setFrom(dy);                              // 1:1 with the finger — feels direct
      } else if (accum.current) {
        reset();
      }
    };

    const onTouchEnd = () => {
      tracking = false;
      if (!fired.current) reset();                // released early -> spring back
    };

    const onScroll = () => { if (!atBottom() && accum.current) reset(); };

    target.addEventListener("wheel", onWheel, { passive: true });
    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: false });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      target.removeEventListener("wheel", onWheel);
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("scroll", onScroll);
    };
  }, [ref, threshold, onTrigger, enabled, reset]);

  return { progress, reset };
}
