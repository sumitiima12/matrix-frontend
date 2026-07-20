/**
 * domain/analysisFramework.js — framework-based fundamental & technical interpretation.
 *
 * Encodes the standard analytical frameworks (Zerodha Varsity FA/TA + Oliver "Fundamental and
 * Technical Analysis"): ratio-by-ratio thresholds with a verdict on the fundamental side, and a
 * multi-factor trend/momentum/volume/level read on the technical side. Pure functions over the
 * data the app already fetches — no invented numbers: a metric that isn't present is skipped,
 * never guessed, so the read only ever states what the real values support.
 *
 * Every fundamental metric returns { k (label), v (formatted), read (one-line interpretation),
 * tone: "good"|"warn"|"bad"|"neutral", w (weight) }. tones roll up into a 0–100 score + verdict.
 */

const pct = (x, dp = 1) => (x == null ? null : (x * 100).toFixed(dp) + "%");
const num = (x, dp = 2) => (x == null ? null : (+x).toFixed(dp));

/* ─────────────────────────── FUNDAMENTAL ─────────────────────────── */
/**
 * @param f fundamentals: { peTrailing, pb, roe(frac), profitMargin(frac), operatingMargin(frac),
 *          revenueGrowth(frac), debtToEquity(×100 => 100 == D/E 1.0), dividendYield(frac),
 *          beta, marketCap, sectorPE }
 */
export function fundamentalRead(f) {
  if (!f) return null;
  const rows = [];
  const add = (k, v, read, tone, w = 1) => { if (v != null) rows.push({ k, v, read, tone, w }); };

  // Valuation — P/E, ideally vs the sector (Zerodha: a stock is only "cheap"/"expensive" relative
  // to its peers and its own growth, never in the absolute).
  if (f.peTrailing != null) {
    const pe = f.peTrailing;
    let read, tone;
    if (f.sectorPE != null && f.sectorPE > 0) {
      const r = pe / f.sectorPE;
      if (r < 0.8) { read = `Trades at a discount to the sector P/E of ${num(f.sectorPE, 1)} — value on offer if growth holds.`; tone = "good"; }
      else if (r <= 1.2) { read = `Roughly in line with the sector P/E of ${num(f.sectorPE, 1)} — fairly valued.`; tone = "neutral"; }
      else { read = `Commands a premium to the sector P/E of ${num(f.sectorPE, 1)} — the market expects above-average growth.`; tone = "warn"; }
    } else {
      if (pe < 0) { read = "Negative — the company is loss-making on a trailing basis."; tone = "bad"; }
      else if (pe < 15) { read = "Low absolute earnings multiple — inexpensive, or the market doubts growth."; tone = "good"; }
      else if (pe <= 25) { read = "A moderate earnings multiple — reasonable for a steady grower."; tone = "neutral"; }
      else if (pe <= 40) { read = "A rich multiple — priced for strong growth; disappointments hurt."; tone = "warn"; }
      else { read = "A very rich multiple — expensive unless growth is exceptional."; tone = "bad"; }
    }
    add("P/E", num(pe, 1), read, tone, 1.2);
  }

  // P/B — most meaningful for asset-heavy/financial names.
  if (f.pb != null) {
    const pb = f.pb; let read, tone;
    if (pb < 1) { read = "Below book value — deep value, or the market is pricing in trouble."; tone = "warn"; }
    else if (pb <= 3) { read = "A reasonable multiple of book value."; tone = "neutral"; }
    else if (pb <= 6) { read = "A high multiple of book — quality or richness; check ROE to tell which."; tone = "warn"; }
    else { read = "A very high multiple of book value."; tone = "bad"; }
    add("P/B", num(pb, 2), read, tone, 0.7);
  }

  // Profitability — ROE is the headline quality metric (Zerodha: consistent ROE > ~18–20% marks a
  // quality franchise; check it isn't merely leverage-driven via D/E below).
  if (f.roe != null) {
    const roe = f.roe * 100; let read, tone;
    if (roe >= 20) { read = "Excellent return on equity — the hallmark of a high-quality, capital-efficient business."; tone = "good"; }
    else if (roe >= 15) { read = "A good return on equity — management compounds shareholder capital well."; tone = "good"; }
    else if (roe >= 10) { read = "An average return on equity."; tone = "neutral"; }
    else if (roe >= 0) { read = "A low return on equity — capital isn't working hard."; tone = "warn"; }
    else { read = "Negative return on equity — the company is destroying equity value."; tone = "bad"; }
    add("ROE", pct(f.roe), read, tone, 1.3);
  }

  // Net margin.
  if (f.profitMargin != null) {
    const m = f.profitMargin * 100; let read, tone;
    if (m >= 20) { read = "A strong net margin — real pricing power and cost control (compare within the sector)."; tone = "good"; }
    else if (m >= 10) { read = "A healthy net margin."; tone = "good"; }
    else if (m >= 5) { read = "A modest net margin — typical of competitive or low-margin industries."; tone = "neutral"; }
    else if (m >= 0) { read = "A thin net margin — little cushion against cost shocks."; tone = "warn"; }
    else { read = "Loss-making at the net level."; tone = "bad"; }
    add("Net margin", pct(f.profitMargin), read, tone, 1);
  }

  // Operating margin (only add if it tells us something beyond net margin).
  if (f.operatingMargin != null) {
    const m = f.operatingMargin * 100;
    add("Operating margin", pct(f.operatingMargin),
      m >= 15 ? "Solid core-operating profitability before financing and tax." : m >= 0 ? "Slim core-operating profitability." : "The core operations are loss-making.",
      m >= 15 ? "good" : m >= 5 ? "neutral" : "warn", 0.7);
  }

  // Growth.
  if (f.revenueGrowth != null) {
    const g = f.revenueGrowth * 100; let read, tone;
    if (g >= 15) { read = "Strong top-line growth — the business is expanding fast."; tone = "good"; }
    else if (g >= 5) { read = "Steady top-line growth."; tone = "neutral"; }
    else if (g >= 0) { read = "Sluggish growth — revenue is barely moving."; tone = "warn"; }
    else { read = "Revenue is shrinking year-on-year."; tone = "bad"; }
    add("Revenue growth", pct(f.revenueGrowth), read, tone, 1.1);
  }

  // Leverage — D/E stored ×100, so 100 == a debt-to-equity ratio of 1.0.
  if (f.debtToEquity != null) {
    const de = f.debtToEquity / 100; let read, tone;
    if (de < 0.5) { read = "A conservative balance sheet — low debt relative to equity."; tone = "good"; }
    else if (de <= 1) { read = "A moderate debt load — manageable for most businesses."; tone = "neutral"; }
    else if (de <= 2) { read = "Meaningfully leveraged — rising rates and downturns bite harder."; tone = "warn"; }
    else { read = "Heavily leveraged — a material balance-sheet risk."; tone = "bad"; }
    add("Debt / Equity", num(de, 2), read, tone, 1);
  }

  // Income + risk (informational, light weight).
  if (f.dividendYield != null) {
    const dy = f.dividendYield * 100;
    add("Dividend yield", pct(f.dividendYield),
      dy >= 3 ? "A meaningful income yield." : dy > 0 ? "A small dividend — mostly a total-return story." : "Pays no dividend — returns come from price appreciation.",
      "neutral", 0.3);
  }
  if (f.beta != null) {
    const b = f.beta;
    add("Beta", num(b, 2),
      b < 0.8 ? "Less volatile than the market — a defensive profile." : b <= 1.2 ? "Moves roughly with the market." : "More volatile than the market — bigger swings both ways.",
      "neutral", 0.3);
  }

  if (!rows.length) return null;

  // Roll tones (weighted) into a 0–100 fundamental score and a plain verdict.
  const toneVal = { good: 1, neutral: 0.5, warn: 0.25, bad: 0 };
  let ws = 0, wsum = 0;
  rows.forEach((r) => { if (toneVal[r.tone] != null) { ws += toneVal[r.tone] * r.w; wsum += r.w; } });
  const score = wsum ? Math.round((ws / wsum) * 100) : 50;
  const verdict = score >= 70 ? "Fundamentally strong" : score >= 55 ? "Healthy" : score >= 40 ? "Mixed" : "Weak fundamentals";

  // Summary: lead with the biggest strengths, then the biggest concern.
  const good = rows.filter((r) => r.tone === "good").map((r) => r.k.toLowerCase());
  const bad = rows.filter((r) => r.tone === "bad" || r.tone === "warn").map((r) => r.k.toLowerCase());
  const bits = [];
  if (good.length) bits.push(`Strengths: ${good.slice(0, 3).join(", ")}`);
  if (bad.length) bits.push(`watch: ${bad.slice(0, 3).join(", ")}`);
  const summary = `${verdict}. ${bits.join("; ")}.`;

  return { score, verdict, rows, summary };
}

/* ─────────────────────────── TECHNICAL ───────────────────────────
   A structured multi-factor read (trend → momentum → volume → levels), the way a technician
   builds a view. `s` is a universe stock with real indicators; `tech` is techSignal(s) output. */
export function technicalRead(s, tech) {
  if (!s || s.rsi == null || s.sma50 == null) return null;
  const rows = [];
  const add = (k, v, read, tone) => rows.push({ k, v, read, tone });

  // Trend — the primary filter (price vs 50/200-DMA, golden/death cross).
  const trendUp = s.sma200 != null ? s.sma50 > s.sma200 : s.price > s.sma50;
  const above50 = s.price > s.sma50;
  add("Trend",
    s.sma200 != null ? (trendUp ? "Up (50-DMA > 200-DMA)" : "Down (50-DMA < 200-DMA)") : (above50 ? "Above 50-DMA" : "Below 50-DMA"),
    trendUp && above50 ? "Both moving averages align upward — trade with the trend, favour longs."
      : !trendUp && !above50 ? "Moving averages align downward — the path of least resistance is down."
      : "Mixed — price and the longer average disagree; wait for alignment.",
    trendUp && above50 ? "good" : !trendUp && !above50 ? "bad" : "warn");

  // Momentum — RSI.
  const rsi = s.rsi;
  add("RSI", Math.round(rsi),
    rsi >= 70 ? "Overbought — momentum is strong but the risk of a pullback is elevated."
      : rsi <= 30 ? "Oversold — stretched to the downside; watch for a reversal, don't catch a falling knife."
      : rsi >= 50 ? "Above the midline — momentum favours the bulls." : "Below the midline — momentum favours the bears.",
    rsi >= 70 ? "warn" : rsi <= 30 ? "warn" : rsi >= 50 ? "good" : "bad");

  // Momentum — MACD.
  if (s.macd != null && s.macdSignal != null) {
    const bull = s.macd > s.macdSignal;
    add("MACD", bull ? "Above signal" : "Below signal",
      bull ? "The MACD line is above its signal — momentum is positive." : "The MACD line is below its signal — momentum is negative.",
      bull ? "good" : "bad");
  }

  // Trend strength — ADX.
  if (s.adx != null) {
    add("ADX", Math.round(s.adx),
      s.adx >= 25 ? "A trending market — trend-following setups are more reliable here." : "A weak/ranging market — trends are unreliable; mean-reversion suits better.",
      s.adx >= 25 ? "good" : "neutral");
  }

  // Volume confirmation.
  if (s.avgVol && s.vol != null) {
    const vr = s.vol / s.avgVol;
    add("Volume", `${vr.toFixed(1)}× avg`,
      vr >= 1.5 ? "Well above average — strong participation confirms the move." : vr >= 0.8 ? "Around average — no unusual conviction." : "Below average — the move lacks participation.",
      vr >= 1.5 ? "good" : "neutral");
  }

  // Position in the 52-week range.
  if (s.high52 != null && s.low52 != null && s.high52 > s.low52) {
    const pos = (s.price - s.low52) / (s.high52 - s.low52);
    add("52-wk range", `${Math.round(pos * 100)}%`,
      pos >= 0.85 ? "Near its 52-week high — strength, but little overhead room." : pos <= 0.15 ? "Near its 52-week low — weak, or a potential value zone." : "Mid-range — no extreme.",
      pos >= 0.85 ? "good" : pos <= 0.15 ? "warn" : "neutral");
  }

  const verdict = tech && tech.signal ? tech.signal : (trendUp ? "Uptrend" : "Range-bound");
  const summary = tech && tech.why ? tech.why : `${verdict} on the current timeframe.`;
  return { verdict, rows, summary };
}
