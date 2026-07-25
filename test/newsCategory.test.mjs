import test from "node:test";
import assert from "node:assert/strict";
import { NEWS_CATS, newsCatOf } from "../src/lib/newsCategory.js";

test("classifies earnings headlines", () => {
  assert.equal(newsCatOf("Acme Q3 revenue beats estimates, profit up 20%"), "Earnings");
  assert.equal(newsCatOf("Company raises full-year guidance"), "Earnings");
});

test("classifies analyst headlines", () => {
  assert.equal(newsCatOf("Morgan Stanley upgrades Acme to overweight"), "Analyst");
  assert.equal(newsCatOf("Analyst raises price target to $250"), "Analyst");
});

test("classifies deals / M&A headlines", () => {
  assert.equal(newsCatOf("Acme to acquire rival for $4 billion"), "Deals");
  assert.equal(newsCatOf("Startup raises $100M in Series C funding"), "Deals");
});

test("classifies product headlines", () => {
  assert.equal(newsCatOf("Acme unveils new flagship product"), "Product");
  assert.equal(newsCatOf("Company launches AI feature"), "Product");
});

test("falls back to Markets for anything unmatched", () => {
  assert.equal(newsCatOf("Shares drift lower in quiet trading"), "Markets");
  assert.equal(newsCatOf(""), "Markets");
  assert.equal(newsCatOf(null), "Markets");
});

test("every returned category is in the tab list (plus Markets fallback)", () => {
  const samples = ["Q1 profit", "analyst downgrade", "merger talks", "product launch", "random noise"];
  for (const s of samples) assert.ok(NEWS_CATS.includes(newsCatOf(s)));
});
