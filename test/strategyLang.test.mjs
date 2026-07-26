import test from "node:test";
import assert from "node:assert/strict";
import { detectTf, parseMomentum, interpretText } from "../src/domain/strategyLang.js";

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

/* Neo interpreter — percentage-move phrasings the user reported Neo couldn't read. */
test("interpretText: 'up 10% from last day close' => DayChangePrevClose >= 10", () => {
  const r = interpretText("enter when a stock is already up by 10% atleast from last day close");
  const c = r.conds.find((x) => x.la === "DayChangePrevClose");
  assert.ok(c, "expected a DayChangePrevClose condition; got " + JSON.stringify(r.conds));
  assert.ok(c.op === ">" || c.op === ">=");
  assert.equal(c.b, "10");
  assert.ok(r.defs.some((d) => d.type === "DayChangePrevClose"));
  assert.equal(r.unparsed.length, 0);
});

test("interpretText: 'up 2% in last 5 mins' => PriceChange > 2 with winMin 5", () => {
  const r = interpretText("stock is up by 2% in last 5 mins");
  const c = r.conds.find((x) => x.la === "PriceChange");
  assert.ok(c, "expected a PriceChange condition; got " + JSON.stringify(r.conds));
  assert.equal(c.op, ">");
  assert.equal(c.b, "2");
  const d = r.defs.find((x) => x.type === "PriceChange");
  assert.ok(d && Number(d.winMin) === 5, "expected winMin 5; got " + JSON.stringify(d));
});

test("interpretText: 'down 3% today' => DayChange < -3", () => {
  const r = interpretText("price is down 3% today");
  const c = r.conds.find((x) => x.la === "DayChange");
  assert.ok(c, JSON.stringify(r.conds));
  assert.equal(c.op, "<");
  assert.equal(c.b, "-3");
});
