import test from "node:test";
import assert from "node:assert/strict";
import {
  smaSeries, emaSeries, bollingerSeries, macdSeries, rsiSeries,
  heikinAshiSeries, vwapSeries, adxSeries, stochSeries,
  atrSeries, stdDevSeries, keltnerSeries, cprSeries, pivotSeries, ichimokuSeries, fibSeries,
} from "../src/lib/indicators.js";

// A small synthetic candle series (steady uptrend then a pullback) for the OHLC-based indicators.
function candles(closes) {
  return closes.map((c, i) => ({ t: i * 60000, o: c - 0.5, h: c + 1, l: c - 1, c, v: 100 + i }));
}
const CLOSES = [10, 11, 12, 13, 14, 15, 16, 15, 14, 15, 16, 17, 18, 19, 20];

test("smaSeries: leading nulls then the correct average", () => {
  const s = smaSeries([2, 4, 6, 8], 2);
  assert.equal(s[0], null);
  assert.equal(s[1], 3);
  assert.equal(s[2], 5);
  assert.equal(s[3], 7);
});

test("emaSeries: warms up over n, then tracks price", () => {
  const e = emaSeries(CLOSES, 5);
  for (let i = 0; i < 4; i++) assert.equal(e[i], null);
  assert.ok(e[4] != null);
  assert.ok(e[e.length - 1] > e[4]);   // rose with the uptrend
});

test("bollingerSeries: mid == SMA and bands straddle it", () => {
  const b = bollingerSeries(CLOSES, 5, 2);
  const i = CLOSES.length - 1;
  assert.ok(Math.abs(b.mid[i] - smaSeries(CLOSES, 5)[i]) < 1e-9);
  assert.ok(b.up[i] > b.mid[i]);
  assert.ok(b.lo[i] < b.mid[i]);
});

test("rsiSeries: pure uptrend pins RSI at 100", () => {
  const up = Array.from({ length: 20 }, (_, i) => 10 + i);
  const r = rsiSeries(up, 14);
  assert.equal(Math.round(r[r.length - 1]), 100);
});

test("rsiSeries stays within 0..100", () => {
  const r = rsiSeries(CLOSES, 5).filter((v) => v != null);
  assert.ok(r.every((v) => v >= 0 && v <= 100));
});

test("macdSeries: line/signal/hist align and hist = line - signal", () => {
  const m = macdSeries(CLOSES, 3, 6, 3);
  const i = CLOSES.length - 1;
  assert.ok(m.line[i] != null && m.signal[i] != null);
  assert.ok(Math.abs(m.hist[i] - (m.line[i] - m.signal[i])) < 1e-9);
});

test("heikinAshiSeries: haClose is the OHLC average, aligned to input", () => {
  const cs = candles(CLOSES);
  const ha = heikinAshiSeries(cs);
  assert.equal(ha.length, cs.length);
  const k = 3;
  assert.ok(Math.abs(ha[k].c - (cs[k].o + cs[k].h + cs[k].l + cs[k].c) / 4) < 1e-9);
});

test("vwapSeries: within the price range and defined from bar 0", () => {
  const cs = candles(CLOSES);
  const v = vwapSeries(cs);
  assert.equal(v.length, cs.length);
  assert.ok(v[0] != null);
  const lo = Math.min(...cs.map((c) => c.l)), hi = Math.max(...cs.map((c) => c.h));
  assert.ok(v.every((x) => x >= lo && x <= hi));
});

test("adxSeries: returns adx/+DI/-DI in 0..100 once warmed up", () => {
  const cs = candles(Array.from({ length: 40 }, (_, i) => 10 + i));   // strong trend
  const a = adxSeries(cs, 14);
  const last = a.adx.filter((v) => v != null).pop();
  assert.ok(last != null && last >= 0 && last <= 100);
  const pdi = a.pdi.filter((v) => v != null).pop();
  assert.ok(pdi > a.mdi.filter((v) => v != null).pop());   // uptrend -> +DI dominates
});

test("stochSeries: %K and %D within 0..100", () => {
  const cs = candles(CLOSES);
  const s = stochSeries(cs, 5, 3);
  const k = s.k.filter((v) => v != null);
  assert.ok(k.every((v) => v >= 0 && v <= 100));
  assert.ok(s.d.filter((v) => v != null).length > 0);
});

test("atrSeries: positive and aligned", () => {
  const cs = candles(CLOSES);
  const a = atrSeries(cs, 5);
  const last = a.filter((v) => v != null).pop();
  assert.ok(last > 0);
});

test("stdDevSeries: zero for a flat series, positive otherwise", () => {
  const flat = new Array(10).fill(5);
  assert.equal(stdDevSeries(flat, 5).pop(), 0);
  assert.ok(stdDevSeries(CLOSES, 5).filter((v) => v != null).pop() > 0);
});

test("keltnerSeries: upper > mid > lower", () => {
  const cs = candles(Array.from({ length: 40 }, (_, i) => 100 + i));
  const k = keltnerSeries(cs, 20, 2, 10);
  const i = cs.length - 1;
  assert.ok(k.up[i] > k.mid[i] && k.mid[i] > k.lo[i]);
});

test("cprSeries: TC >= pivot >= BC and derived from prior bar", () => {
  const cs = candles(CLOSES);
  const c = cprSeries(cs);
  const i = 5;
  const p = cs[i - 1];
  assert.ok(Math.abs(c.pivot[i] - (p.h + p.l + p.c) / 3) < 1e-9);
  assert.ok(c.tc[i] >= c.pivot[i] && c.pivot[i] >= c.bc[i]);
});

test("pivotSeries: R2 > R1 > P > S1 > S2", () => {
  const cs = candles(CLOSES);
  const p = pivotSeries(cs);
  const i = 5;
  assert.ok(p.R2[i] > p.R1[i] && p.R1[i] > p.P[i] && p.P[i] > p.S1[i] && p.S1[i] > p.S2[i]);
});

test("ichimokuSeries: tenkan/kijun defined once warmed up", () => {
  const cs = candles(Array.from({ length: 60 }, (_, i) => 100 + i));
  const ich = ichimokuSeries(cs);
  assert.ok(ich.tenkan[cs.length - 1] != null);
  assert.ok(ich.kijun[cs.length - 1] != null);
  assert.ok(ich.senkouB[cs.length - 1] != null);
});

test("fibSeries: 7 levels spanning swing high→low", () => {
  const cs = candles(CLOSES);
  const f = fibSeries(cs, 15);
  assert.equal(f.length, 7);
  assert.ok(f[0].price > f[f.length - 1].price);   // 0% at the high, 100% at the low
});
