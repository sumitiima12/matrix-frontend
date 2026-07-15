import { rsiSeries, macdSeries, smaSeries } from "../lib/indicators";

/**
 * Technical strength on a CHOSEN timeframe, computed from that timeframe's own candles.
 *
 * The daily gauge reads its RSI/MACD/SMA off the backend's daily indicators. A 5-minute
 * gauge cannot reuse those — a daily RSI of 62 says nothing about the last half hour. So
 * each timeframe recomputes from its own candles, and if there aren't enough bars to warm
 * the indicators up we return null and the UI says so, rather than showing a number
 * derived from twelve candles and calling it an RSI.
 *
 * Indicators are computed on the FULL series and read at the end — never on a slice.
 */
export function strengthFromCandles(candles) {
  if (!candles || candles.length < 35) return null;   // RSI(14) + MACD(26) need warm-up

  const close = candles.map((c) => c.c);
  const rsiArr = rsiSeries(close, 14);
  const macd = macdSeries(close, 12, 26, 9);
  const sma50 = smaSeries(close, 50);
  const sma20 = smaSeries(close, 20);

  const last = (a) => (a && a.length ? a[a.length - 1] : null);

  const rsi = last(rsiArr);
  const line = macd && macd.line ? last(macd.line) : null;
  const sig = macd && macd.signal ? last(macd.signal) : null;
  const s50 = last(sma50);
  const s20 = last(sma20);
  const price = close[close.length - 1];

  if (rsi == null) return null;

  /* Same shape as the daily verdict: momentum, trend and MACD, blended. Deliberately the
     same direction of travel as techStrength() so a bullish gauge means a bullish read on
     THIS timeframe — not a different formula that could contradict it. */
  let score = 50 + (rsi - 50) * 0.6;
  if (s50 != null) score += price > s50 ? 10 : -10;
  if (s20 != null && s50 != null) score += s20 > s50 ? 8 : -8;
  if (line != null && sig != null) score += line > sig ? 8 : -8;

  return {
    value: Math.max(3, Math.min(97, Math.round(score))),
    rsi: +rsi.toFixed(1),
    macd: line != null ? +line.toFixed(2) : null,
    macdSignal: sig != null ? +sig.toFixed(2) : null,
    sma20: s20 != null ? +s20.toFixed(2) : null,
    sma50: s50 != null ? +s50.toFixed(2) : null,
    bars: candles.length,
  };
}

/** The timeframes offered on the strength gauge. Every one is backed by real candles. */
export const STRENGTH_TFS = ["5m", "30m", "1h", "4h", "1d", "1w", "1mo"];
