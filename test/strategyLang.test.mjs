import test from "node:test";
import assert from "node:assert/strict";
import { detectTf, parseMomentum } from "../src/domain/strategyLang.js";

test("detectTf parses minutes / hours / daily / weekly", () => {
  assert.equal(detectTf("macd crosses above signal 3 mins"), "3m");
  assert.equal(detectTf("rsi over 70 on 15 minute chart"), "15m");
  assert.equal(detectTf("breakout on 4 hours"), "4h");
  assert.equal(detectTf("buy on the daily chart"), "1D");
  assert.equal(detectTf("weekly trend up"), "1W");
  assert.equal(detectTf("no timeframe here"), null);
});

test("detectTf treats '1 day' as 1D and '3 days' as 3D", () => {
  assert.equal(detectTf("1 day"), "1D");
  assert.equal(detectTf("3 days"), "3D");
});

test("parseMomentum: ratio form 'price / previous candle close > 1.02' => +2% up", () => {
  const m = parseMomentum("current price / price of previous candle close > 1.02 on 5 mins");
  assert.equal(m.dir, "up");
  assert.equal(m.tf, "5m");
  assert.ok(Math.abs(m.pct - 2) < 1e-6);
});

test("parseMomentum: plain english 'jumped 2% in 5 mins'", () => {
  const m = parseMomentum("price jumped 2% in 5 mins");
  assert.equal(m.dir, "up");
  assert.equal(m.pct, 2);
  assert.equal(m.tf, "5m");
});

test("parseMomentum: downward move", () => {
  const m = parseMomentum("stock dropped 3% today");
  assert.equal(m.dir, "down");
  assert.equal(m.pct, 3);
});

test("parseMomentum: default timeframe is 1d when unspecified", () => {
  const m = parseMomentum("price surged 5%");
  assert.equal(m.tf, "1d");
});

test("parseMomentum: returns null when there is no momentum phrase", () => {
  assert.equal(parseMomentum("rsi below 30"), null);
  assert.equal(parseMomentum(""), null);
});
