/**
 * domain/tags.js — the technical tag engine.
 *
 * Every tag here is a claim about the market, so every tag must be TRUE and must
 * carry the real number that makes it true. That number is the `evidence` field,
 * and it is what the "Why?" panel quotes. A tag with no evidence is not a tag.
 *
 * Two rules this file exists to enforce:
 *
 *  1. EVENTS ARE NOT STATES. "Golden Cross" means the 50-DMA actually crossed
 *     above the 200-DMA, recently. It does NOT mean the 50 is merely above the
 *     200 — a stock three years into an uptrend would otherwise be tagged
 *     "Golden Cross" every day for three years. The cross is detected server-side
 *     from real candles (see goldenCross in server.js), which returns BARS SINCE
 *     it happened. We only tag it inside GOLDEN_CROSS_WINDOW.
 *
 *  2. MISSING DATA PRODUCES NO TAG. Never a neutral tag, never a default. If the
 *     indicator is null the stock simply does not carry that tag.
 */

/** A cross older than this is just "above the 200-DMA" — not news. */
export const GOLDEN_CROSS_WINDOW = 20;      // trading days

/** Volume is "spiking" at 2x its own 20-day average. */
export const VOLUME_SPIKE_X = 2;

/** Within this % of a level counts as "near" it. */
const NEAR_PCT = 2;

const tag = (id, label, tone, evidence) => ({ id, label, tone, evidence });

/**
 * All technical tags that are TRUE for this instrument, strongest first.
 * @returns {Array<{id, label, tone, evidence}>}
 */
export function computeTags(s) {
  if (!s || !s.hasData) return [];
  const t = [];

  /* ---- Trend events (need the candle series; computed server-side) ---- */

  if (s.goldenCross != null && s.goldenCross <= GOLDEN_CROSS_WINDOW) {
    t.push(tag("golden-cross", "Golden Cross", "bull",
      s.goldenCross === 0 ? "50-DMA crossed above 200-DMA today"
                          : `50-DMA crossed above 200-DMA ${s.goldenCross} session${s.goldenCross === 1 ? "" : "s"} ago`));
  }

  if (s.deathCross != null && s.deathCross <= GOLDEN_CROSS_WINDOW) {
    t.push(tag("death-cross", "Death Cross", "bear",
      `50-DMA crossed below 200-DMA ${s.deathCross} session${s.deathCross === 1 ? "" : "s"} ago`));
  }

  if (s.bullFlag) {
    t.push(tag("bull-flag", "Bull Flag", "bull",
      `${s.bullFlag.poleMovePct}% impulse, then ${s.bullFlag.consolidationBars} sessions of tight consolidation holding the upper half`));
  }

  if (s.higherHigh === true && s.higherLow === true) {
    t.push(tag("higher-high", "Higher High", "bull", "Last swing high and swing low are both above the ones before"));
  } else if (s.higherHigh === true) {
    t.push(tag("higher-high", "Higher High", "bull", "Latest swing high is above the previous swing high"));
  }

  /* ---- Trend state (snapshot indicators) ---- */

  if (s.price != null && s.sma200 != null && s.price > s.sma200) {
    const above = ((s.price / s.sma200 - 1) * 100).toFixed(1);
    t.push(tag("above-200", "Above 200-DMA", "bull", `Price is ${above}% above the 200-day average (${s.sma200})`));
  }

  if (s.adx != null && s.adx >= 25) {
    t.push(tag("strong-trend", "Strong Trend", "bull", `ADX is ${s.adx} — above 25, so the trend has real force behind it`));
  }

  if (s.macd != null && s.macdSignal != null && s.macd > s.macdSignal) {
    t.push(tag("momentum", "Momentum", "bull", `MACD (${s.macd}) is above its signal line (${s.macdSignal})`));
  }

  /* ---- Levels ---- */

  if (s.price != null && s.resistance != null && s.price > s.resistance) {
    t.push(tag("breakout", "Breakout", "bull", `Price ${s.price} is above the 60-session high of ${s.resistance}`));
  } else if (s.price != null && s.resistance != null && near(s.price, s.resistance)) {
    t.push(tag("near-resistance", "Near Resistance", "warn", `Price is within ${NEAR_PCT}% of the 60-session high (${s.resistance})`));
  }

  if (s.price != null && s.support != null && near(s.price, s.support)) {
    t.push(tag("near-support", "Near Support", "bull", `Price is within ${NEAR_PCT}% of the 60-session low (${s.support})`));
  }

  /* ---- Volume ---- */

  if (s.vol != null && s.avgVol) {
    const x = s.vol / s.avgVol;
    if (x >= VOLUME_SPIKE_X) {
      t.push(tag("volume-spike", "Volume Spike", "bull", `${x.toFixed(1)}x its own 20-day average volume`));
    }
  }

  /* ---- RSI: three mutually exclusive readings ---- */

  if (s.rsi != null) {
    if (s.rsi >= 70) t.push(tag("overbought", "Overbought", "warn", `RSI ${s.rsi} — above 70`));
    else if (s.rsi <= 30) t.push(tag("oversold", "Oversold", "warn", `RSI ${s.rsi} — below 30`));
    else if (s.rsi >= 50) t.push(tag("rsi-bullish", "RSI Bullish", "bull", `RSI ${s.rsi} — in the bullish half of the range`));
  }

  return t;
}

function near(price, level) {
  return Math.abs((price - level) / level) * 100 <= NEAR_PCT;
}

/** The single most meaningful tag — used where there is only room for one. */
export function primaryTag(s) {
  const t = computeTags(s);
  if (!t.length) return null;
  const rank = ["golden-cross", "bull-flag", "breakout", "death-cross", "higher-high",
                "volume-spike", "strong-trend", "near-support", "momentum",
                "above-200", "rsi-bullish", "overbought", "oversold", "near-resistance"];
  return [...t].sort((a, b) => rank.indexOf(a.id) - rank.indexOf(b.id))[0];
}
