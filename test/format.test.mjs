import test from "node:test";
import assert from "node:assert/strict";
import { fmt, compact, clamp, setCommodityCurrency, commodityIsINR, CUR } from "../src/lib/format.js";

test("fmt: currency symbol per market", () => {
  assert.ok(fmt(100, "IN").startsWith("₹"));
  assert.ok(fmt(100, "US").startsWith("$"));
  assert.ok(fmt(100, "Crypto").startsWith("$"));
});

test("fmt: handles null / NaN", () => {
  assert.equal(fmt(null, "IN"), "—");
  assert.equal(fmt(NaN, "US"), "—");
});

test("fmt: keeps sub-dollar precision for cheap assets", () => {
  const s = fmt(0.000123, "Crypto");
  assert.ok(/0\.000123/.test(s), s);
});

test("setCommodityCurrency flips commodity to INR and back", () => {
  setCommodityCurrency("USD");
  assert.equal(commodityIsINR(), false);
  assert.ok(fmt(71000, "Commodity").startsWith("$"));

  setCommodityCurrency("INR");
  assert.equal(commodityIsINR(), true);
  assert.equal(CUR.Commodity, "₹");
  assert.ok(fmt(71000, "Commodity").startsWith("₹"));

  setCommodityCurrency("USD");   // reset so test order can't leak
  assert.ok(fmt(71000, "Commodity").startsWith("$"));
});

test("compact: Cr / L / K Indian scale", () => {
  assert.equal(compact(15000000), "1.50 Cr");
  assert.equal(compact(250000), "2.50 L");
  assert.equal(compact(1500), "1.5K");
});

test("clamp bounds a value", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});
