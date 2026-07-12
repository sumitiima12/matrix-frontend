/**
 * lib/patterns.js — chart-pattern shapes and timeframe bar counts.
 *
 * NOTE: `pts` are ILLUSTRATIVE glyphs used to draw the little pattern icon on a
 * card. They are NOT price data and are never used in any calculation — the
 * pattern a stock is actually assigned comes from techSignal(), which reads real
 * price action. Kept as data, away from both UI and business logic.
 */
const PATTERNS = {
  cup: { label: "Cup & Handle", pts: [[0, 28], [9, 32], [18, 50], [30, 62], [44, 64], [58, 62], [68, 50], [76, 34], [82, 28], [88, 40], [93, 34], [100, 14]] },
  triangle: { label: "Ascending Triangle", pts: [[0, 56], [12, 28], [24, 50], [40, 30], [56, 48], [72, 32], [86, 44], [100, 14]] },
  flag: { label: "Bull Flag", pts: [[0, 64], [16, 18], [28, 30], [40, 40], [52, 30], [64, 42], [76, 32], [88, 42], [100, 10]] },
  breakout: { label: "Breakout", pts: [[0, 50], [12, 44], [24, 54], [36, 42], [48, 52], [60, 44], [72, 38], [82, 28], [100, 8]] },
  doubleBottom: { label: "Double Bottom", pts: [[0, 30], [14, 56], [26, 38], [38, 58], [52, 42], [62, 56], [74, 36], [88, 22], [100, 10]] },
};
/** Bars to render per timeframe on the compact charts. */
const TF_N = { "3m": 40, "5m": 36, "30m": 30, "1h": 28, "4h": 24, "1d": 22 };

export { PATTERNS, TF_N };
