/* R24-P2-07: 4h/multi-hour aggregation must KEEP a legitimate closing-session bar (short only because the
   exchange session ended) while still dropping a genuinely still-forming current bar. */
import test from "node:test";
import assert from "node:assert/strict";
import { aggregate } from "../src/services/marketService.js";

// Build 60-minute candles for one NSE session on a fixed past date (session ended long ago).
// NSE 09:15–15:30 IST = 03:45–10:00 UTC. Anchor = 225 (09:15 IST). A 4h bar spans 09:15–13:15, then the
// closing bar spans 13:15–15:30 (2h15 → only ~2 hourly samples).
function nseHour(dateUTC, hUTC, min = 0) {
  const t = Date.UTC(2026, 6, 1, hUTC, min) / 1000;   // seconds
  return { t, o: 100, h: 101, l: 99, c: 100, v: 10 };
}
const NOW = Date.UTC(2026, 6, 2, 0, 0);   // the day AFTER — the session is long closed

test("R24-P2-07: the NSE 13:15–15:30 closing bar is kept (session ended, not still forming)", () => {
  // Hourly candles across the session: 03:45? use hourly grid 04:00..09:00 UTC (09:30..14:30 IST) + closing.
  const candles = [
    nseHour(1, 4), nseHour(1, 5), nseHour(1, 6), nseHour(1, 7),   // first 4h bucket (09:15-anchored window)
    nseHour(1, 8), nseHour(1, 9),                                 // closing partial bucket (only 2 samples)
  ];
  const out = aggregate(candles, 4, 60, 225, NOW);
  // Two aggregated bars: the full 4h and the short closing bar — the closing bar must NOT be dropped.
  assert.ok(out.length >= 2, `closing session bar kept (got ${out.length} bars)`);
});

test("R24-P2-07: a genuinely still-forming current bar IS dropped", () => {
  const base = Date.now();
  // Anchor 0 (crypto/epoch). 4x 1h candles at :00 of the last 4 hours, all recent; the last bucket is the
  // CURRENT window and still receiving candles → its short tail must be dropped.
  const hourMs = 3600 * 1000;
  const curBucketStart = Math.floor(base / (4 * hourMs)) * (4 * hourMs);
  const candles = [
    { t: (curBucketStart - hourMs) / 1000, o: 1, h: 1, l: 1, c: 1, v: 1 },   // previous full-ish bucket sample
    { t: (curBucketStart + 60000) / 1000, o: 1, h: 1, l: 1, c: 1, v: 1 },     // current bucket, 1 sample, fresh
  ];
  const out = aggregate(candles, 4, 60, 0, base + 90000);   // now is just after the fresh candle → still forming
  // The current still-forming bucket (1 sample, window not elapsed, fresh) is dropped.
  const lastStart = curBucketStart;
  assert.ok(!out.some((b) => (b.t < 1e12 ? b.t * 1000 : b.t) === lastStart), "still-forming current bar dropped");
});

test("R25-M02: a STALE incomplete current-session bar is dropped (not shown as complete)", () => {
  // NSE, current session, a data outage: the last sample is OLD but the session hasn't closed and the window
  // hasn't elapsed → the bar is incomplete and must be DROPPED (the old staleness heuristic would have KEPT it).
  const closeFn = (ms) => { // NSE close 15:30 IST = 10:00 UTC
    const s = ".NS"; return /\.NS$/.test(s) ? 10 * 60 : null;
  };
  const c1 = Date.UTC(2026, 6, 1, 4, 0) / 1000;   // 09:30 IST
  const c2 = Date.UTC(2026, 6, 1, 5, 0) / 1000;   // 10:30 IST (last sample — feed then went stale)
  const NOW_MID = Date.UTC(2026, 6, 1, 7, 0);     // 12:30 IST — still mid-session, window (03:45–07:45) not elapsed
  const out = aggregate([{ t: c1, o: 1, h: 1, l: 1, c: 1, v: 1 }, { t: c2, o: 1, h: 1, l: 1, c: 1, v: 1 }], 4, 60, 225, NOW_MID, closeFn);
  assert.strictEqual(out.length, 0, "stale incomplete mid-session bar dropped (not presented as closed)");
});

test("M01 (R27): the completed NSE closing 4h bar is KEPT at 15:31 IST (wall-clock past close), last candle intra-session", () => {
  // The bug: at 15:31 IST the finished closing bar was dropped until its 17:15 clock window, because the code
  // compared the LAST CANDLE's time-of-day (15:00 IST < 15:30) to close instead of NOW vs the dated close.
  const closeFn = () => 10 * 60;                   // NSE close 15:30 IST = 10:00 UTC = 600 min
  const c1 = Date.UTC(2026, 6, 1, 8, 15) / 1000;   // 13:45 IST — inside the closing 4h bucket (13:15-anchored)
  const c2 = Date.UTC(2026, 6, 1, 9, 30) / 1000;   // 15:00 IST — a legitimate intra-session candle (start < close)
  const NOW_1531 = Date.UTC(2026, 6, 1, 10, 1);    // 15:31 IST — one minute AFTER the 15:30 close
  const out = aggregate([{ t: c1, o: 1, h: 1, l: 1, c: 1, v: 1 }, { t: c2, o: 1, h: 1, l: 1, c: 1, v: 1 }], 4, 60, 225, NOW_1531, closeFn);
  assert.ok(out.length >= 1, `closing bar kept at 15:31 IST (got ${out.length} bars)`);
});

test("R25-M02: the same NSE session bar IS kept once the session has closed", () => {
  const closeFn = () => 10 * 60;                 // NSE 10:00 UTC close
  const c1 = Date.UTC(2026, 6, 1, 4, 0) / 1000;
  const c2 = Date.UTC(2026, 6, 1, 10, 30) / 1000; // 16:00 IST — after the 15:30 close
  const NOW_MID = Date.UTC(2026, 6, 1, 11, 0);    // window 03:45–07:45 elapsed anyway, but session-ended also true
  const out = aggregate([{ t: c1, o: 1, h: 1, l: 1, c: 1, v: 1 }, { t: c2, o: 1, h: 1, l: 1, c: 1, v: 1 }], 4, 60, 225, NOW_MID, closeFn);
  assert.ok(out.length >= 1, "a completed session bar is kept");
});
