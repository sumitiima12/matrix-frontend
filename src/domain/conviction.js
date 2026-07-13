/**
 * domain/conviction.js — CONVICTION, not "signals".
 *
 * The product brief asks us to stop showing "BUY" and start showing
 *
 *      High Conviction Buy · 92%
 *      ✓ Breakout   ✓ MACD Cross   ✓ Above EMA 50   ✓ Volume 3×   ✓ RSI 62
 *      Target ₹1,240   Stop ₹1,080   Reward 8.2%   Risk 3.1%
 *
 * A percentage is a CLAIM. Three rules keep this one honest:
 *
 * 1. EVERY POINT IS EARNED BY A MEASURED FACT. The score is a weighted sum of
 *    factors that are actually true, each carrying the number that makes it true.
 *    There is no hand-tuned fudge and no random component.
 *
 * 2. COVERAGE IS PART OF THE NUMBER. If only three of the twelve factors can be
 *    evaluated because the rest of the data hasn't loaded, we CANNOT say 92% — we
 *    would be claiming a confidence we have not earned. The denominator is the
 *    weight we were actually able to assess, and below MIN_COVERAGE we refuse to
 *    emit a conviction at all and say why.
 *
 * 3. MISSING IS NOT BEARISH. A factor we cannot evaluate is excluded from both
 *    sides of the ratio. It is not scored as a failure — absence of evidence is
 *    not evidence of absence.
 *
 * The LEVELS mean what they say. If the evidence is thin, the honest output is
 * "Insufficient data", not a confident-sounding number.
 */

import { computeTags } from "./tags";
import { techSignal } from "./signals";

/** Below this share of assessable evidence we decline to score at all. */
export const MIN_COVERAGE = 0.5;

/**
 * The factor book. `test` returns:
 *    true  -> factor satisfied
 *    false -> factor assessable but NOT satisfied
 *    null  -> NOT ASSESSABLE (missing data) — excluded from the denominator
 */
const FACTORS = [
  {
    id: "golden-cross", label: "Golden Cross", weight: 12,
    test: (s) => (s.goldenCross == null ? null : s.goldenCross <= 20),
    why: (s) => `50-DMA crossed above the 200-DMA ${s.goldenCross} session${s.goldenCross === 1 ? "" : "s"} ago`,
  },
  {
    id: "breakout", label: "Breakout", weight: 12,
    test: (s) => (s.price == null || s.resistance == null ? null : s.price > s.resistance),
    why: (s) => `Price ${s.price} is above the 60-session high of ${s.resistance}`,
  },
  {
    id: "bull-flag", label: "Bull Flag", weight: 10,
    test: (s) => (s.bullFlag === undefined ? null : Boolean(s.bullFlag)),
    why: (s) => `${s.bullFlag.poleMovePct}% impulse then ${s.bullFlag.consolidationBars} sessions of tight consolidation`,
  },
  {
    id: "above-200", label: "Above 200-DMA", weight: 10,
    test: (s) => (s.price == null || s.sma200 == null ? null : s.price > s.sma200),
    why: (s) => `Price is ${((s.price / s.sma200 - 1) * 100).toFixed(1)}% above the 200-day average`,
  },
  {
    id: "strong-trend", label: "Strong Trend", weight: 10,
    test: (s) => (s.adx == null ? null : s.adx >= 25),
    why: (s) => `ADX ${s.adx} — above 25, the trend has force behind it`,
  },
  {
    id: "momentum", label: "MACD Cross", weight: 10,
    test: (s) => (s.macd == null || s.macdSignal == null ? null : s.macd > s.macdSignal),
    why: (s) => `MACD ${s.macd} is above its signal line ${s.macdSignal}`,
  },
  {
    id: "higher-high", label: "Higher High", weight: 8,
    test: (s) => (s.higherHigh == null ? null : s.higherHigh === true),
    why: () => "The latest swing high is above the previous swing high",
  },
  {
    id: "volume-spike", label: "Volume Spike", weight: 8,
    test: (s) => (s.vol == null || !s.avgVol ? null : s.vol / s.avgVol >= 2),
    why: (s) => `${(s.vol / s.avgVol).toFixed(1)}× its own 20-day average volume`,
  },
  {
    id: "rsi-bullish", label: "RSI Bullish", weight: 8,
    test: (s) => (s.rsi == null ? null : s.rsi >= 50 && s.rsi < 70),
    why: (s) => `RSI ${s.rsi} — in the bullish half, not yet overbought`,
  },
  {
    id: "near-support", label: "Near Support", weight: 6,
    test: (s) => (s.price == null || s.support == null ? null : Math.abs((s.price - s.support) / s.support) * 100 <= 2),
    why: (s) => `Price is within 2% of the 60-session low (${s.support}) — a defined place to be wrong`,
  },
];

/** Things that actively count AGAINST the case. Penalties, not absences. */
const PENALTIES = [
  {
    id: "death-cross", label: "Death Cross", weight: 15,
    test: (s) => (s.deathCross == null ? null : s.deathCross <= 20),
    why: (s) => `50-DMA crossed BELOW the 200-DMA ${s.deathCross} session${s.deathCross === 1 ? "" : "s"} ago`,
  },
  {
    id: "below-200", label: "Below 200-DMA", weight: 10,
    test: (s) => (s.price == null || s.sma200 == null ? null : s.price < s.sma200),
    why: (s) => `Price is ${((1 - s.price / s.sma200) * 100).toFixed(1)}% BELOW the 200-day average`,
  },
  {
    id: "overbought", label: "Overbought", weight: 8,
    test: (s) => (s.rsi == null ? null : s.rsi >= 70),
    why: (s) => `RSI ${s.rsi} — above 70, stretched`,
  },
  {
    id: "near-resistance", label: "Into Resistance", weight: 5,
    test: (s) => (s.price == null || s.resistance == null ? null : s.price <= s.resistance && Math.abs((s.price - s.resistance) / s.resistance) * 100 <= 2),
    why: (s) => `Price is pressing into the 60-session high (${s.resistance}) — overhead supply`,
  },
];

export const LEVELS = [
  { min: 75, label: "High Conviction Buy", tone: "strong" },
  { min: 55, label: "Moderate Buy",        tone: "good" },
  { min: 40, label: "Watch",               tone: "neutral" },
  { min: 0,  label: "Avoid",               tone: "bad" },
];

function levelFor(score) {
  return LEVELS.find((l) => score >= l.min) || LEVELS[LEVELS.length - 1];
}

/**
 * Conviction for one instrument.
 *
 * @returns {null | {
 *   score, level, tone, coverage,
 *   reasons:  [{id, label, evidence}],   // what earned the score
 *   against:  [{id, label, evidence}],   // what argues the other way
 *   missing:  [label],                   // what we could NOT assess
 *   entry, target, stop, rewardPct, riskPct, rr
 * }}
 * Returns null when there is not enough real data to make a claim.
 */
export function conviction(s) {
  if (!s || !s.hasData) return null;

  let earned = 0;
  let assessable = 0;
  const total = FACTORS.reduce((a, f) => a + f.weight, 0);

  const reasons = [];
  const missing = [];

  FACTORS.forEach((f) => {
    const r = f.test(s);
    if (r === null) { missing.push(f.label); return; }   // not assessable: excluded
    assessable += f.weight;
    if (r === true) {
      earned += f.weight;
      reasons.push({ id: f.id, label: f.label, evidence: safe(f.why, s) });
    }
  });

  // Coverage: how much of the evidence base we could actually look at.
  const coverage = total ? assessable / total : 0;
  if (coverage < MIN_COVERAGE) {
    return {
      score: null, level: "Insufficient data", tone: "neutral", coverage,
      reasons: [], against: [], missing,
      entry: s.price ?? null, target: null, stop: null, rewardPct: null, riskPct: null, rr: null,
      note: "Too little of the indicator set has loaded to put a number on this.",
    };
  }

  const against = [];
  PENALTIES.forEach((p) => {
    const r = p.test(s);
    if (r !== true) return;
    earned -= p.weight;
    against.push({ id: p.id, label: p.label, evidence: safe(p.why, s) });
  });

  const raw = (earned / assessable) * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const lv = levelFor(score);

  // REAL levels from the engine — support/resistance and ATR, never invented.
  const sig = techSignal(s);
  const entry = s.price ?? null;
  const target = sig && sig.target != null ? sig.target : null;
  const stop = sig && sig.stop != null ? sig.stop : null;
  const rewardPct = entry != null && target != null ? ((target / entry - 1) * 100) : null;
  const riskPct = entry != null && stop != null ? ((1 - stop / entry) * 100) : null;
  const rr = rewardPct != null && riskPct != null && riskPct > 0 ? +(rewardPct / riskPct).toFixed(2) : null;

  return {
    score, level: lv.label, tone: lv.tone, coverage,
    reasons, against, missing,
    entry, target, stop,
    rewardPct: rewardPct != null ? +rewardPct.toFixed(1) : null,
    riskPct: riskPct != null ? +riskPct.toFixed(1) : null,
    rr,
    tags: computeTags(s),
  };
}

function safe(fn, s) {
  try { return fn(s); } catch { return ""; }
}
