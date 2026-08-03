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
