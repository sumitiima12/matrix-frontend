/**
 * services/aiService.js — all LLM calls go through here.
 *
 * The backend proxy owns the API keys and tries providers in order
 * (Groq -> OpenRouter -> Gemini -> Anthropic), so no key ever reaches the client.
 */
import { BACKEND_URL, MATRIX_PERSONA } from "../config";
import { analysisSystemPrompt, buildContext, normalizeAnalysis, localRecommendation } from "./researchService";

/** Raw completion. Throws with the backend's real error text so callers can surface it. */
export async function ask(messages, system = MATRIX_PERSONA, maxTokens = 1000) {
  if (!BACKEND_URL) throw new Error("no backend configured");
  const r = await fetch(`${BACKEND_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `proxy ${r.status}`);
  return (d.text || "").trim();
}

/** Plain English -> structured screener conditions. Returns null if it can't. */
export async function interpretScreen(text, metricFields) {
  const system =
    `You convert a plain-English stock screen into JSON. Available metric fields: ${metricFields.join(", ")}. ` +
    `Operators: ">","<",">=","<=". Output ONLY a JSON array (no prose, no markdown). ` +
    `Each item: {"m":<field>,"o":<op>,"rhsType":"value"|"indicator","v":<number when value>,"rhs":<field when indicator>,"tf":"3m"|"5m"|"15m"|"30m"|"1h"|"1d"}. ` +
    `For "EMA21 > EMA50" use ema20 vs ema50 with rhsType "indicator". Default tf "1d".`;
  try {
    const out = await ask([{ role: "user", content: text }], system, 500);
    const arr = JSON.parse((out || "").replace(/```json|```/g, "").trim());
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((c) => c && c.m && c.o)
      .map((c) => ({
        m: c.m,
        o: c.o,
        rhsType: c.rhsType === "indicator" ? "indicator" : "value",
        v: c.v != null ? String(c.v) : "",
        rhs: c.rhs || "sma50",
        tf: c.tf || "1d",
      }));
  } catch {
    return null;
  }
}

/** Plain English -> a structured entry/exit/stop/target summary. */
export async function interpretStrategy(text) {
  const system =
    "You are a trading-strategy interpreter. Given a plain-English rule, respond in exactly this shape (no markdown):\n" +
    "ENTRY: <one line>\nEXIT: <one line>\nSTOP: <n>%\nTARGET: <n>%\n" +
    "Keep it crisp and only use indicators the user mentioned.";
  try {
    const out = await ask([{ role: "user", content: text }], system, 400);
    return (out || "").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Market brief from REAL numbers only. `facts` must contain the actual figures;
 * the model is instructed not to invent anything beyond them.
 */
export async function marketBrief(facts) {
  const system =
    "You are a market analyst. Using ONLY the real numbers given, write a 2-3 sentence market update: " +
    "what breadth and the movers imply, and what to watch. Do not invent any figure, company or event " +
    "not present in the data. No preamble, no disclaimer.";
  return ask([{ role: "user", content: facts }], system, 220);
}


/**
 * analyzeStock — the AI Copilot's core call.
 *
 * Returns a STRUCTURED research verdict (never prose):
 *   { recommendation, confidence, thesis, bullCase[], bearCase[], risks[],
 *     watch[], holdingPeriod, entry, stop, target, rr, source }
 *
 * The LLM reasons; it never sets the price levels — those are computed by the
 * engine from real data and re-applied in normalizeAnalysis(). If the model is
 * unreachable or returns junk, we fall back to a grounded rules-based verdict
 * rather than inventing narrative.
 */
export async function analyzeStock(stock, signal, market = "IN") {
  const ctx = buildContext(stock, signal, market);
  try {
    const out = await ask([{ role: "user", content: ctx }], analysisSystemPrompt(), 900);
    const cleaned = (out || "").replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return localRecommendation(stock, signal);
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return normalizeAnalysis(parsed, stock, signal);
  } catch {
    // No backend, rate limit, or malformed JSON -> honest, grounded fallback.
    return localRecommendation(stock, signal);
  }
}

/**
 * analyzePortfolio — whole-book review through Oracle. Each holding's REAL, already-computed
 * numbers (price, avg, P&L%, trend, RSI when we have it) are handed to the model; the model
 * interprets, it does NOT invent figures. Returns { overall, holdings: [{sym, verdict, insight,
 * action}] }. Falls back to a grounded local read if the backend/JSON is unavailable.
 */
export async function analyzePortfolio(holdings) {
  if (!holdings || !holdings.length) {
    return { overall: "No open positions to analyze.", holdings: [] };
  }

  // Feed ONLY real values. Anything null is sent as "n/a" so the model never guesses.
  const rows = holdings.map((h) => ({
    sym: h.sym,
    qty: h.qty,
    avg: h.avg != null ? +Number(h.avg).toFixed(2) : null,
    ltp: h.ltp != null ? +Number(h.ltp).toFixed(2) : null,
    pnlPct: (h.avg && h.ltp) ? +(((h.ltp / h.avg) - 1) * 100).toFixed(2) : null,
    trend: h.trend || null,
    rsi: h.rsi != null ? Math.round(h.rsi) : null,
  }));

  const system =
    "You are Oracle, a markets analyst reviewing a real trading portfolio. " +
    "You are given each holding's actual figures. Use ONLY these numbers — never invent prices, " +
    "targets, or statistics not present in the data. If a field is null, say the data isn't available " +
    "rather than guessing. Be concise and practical. " +
    "Output ONLY JSON, no markdown, in this exact shape: " +
    '{"overall":"<2-3 sentence portfolio-level read>","holdings":[{"sym":"<symbol>",' +
    '"verdict":"<Hold|Trim|Add|Exit|Watch>","insight":"<one sentence on what the numbers show>",' +
    '"action":"<one concrete, optional next step>"}]}. ' +
    "Verdicts must follow the numbers: a large loss with a downtrend leans Exit/Trim; a healthy " +
    "gain in an uptrend leans Hold/Add. Never recommend leverage or averaging down into a falling knife.";

  const user = "Holdings (real data):\n" + JSON.stringify(rows, null, 2);

  try {
    const out = await ask([{ role: "user", content: user }], system, 1200);
    const cleaned = (out || "").replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no json");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    // Guard the shape.
    const byId = {};
    (parsed.holdings || []).forEach((x) => { if (x && x.sym) byId[x.sym] = x; });
    return {
      overall: String(parsed.overall || "").trim() || localPortfolioRead(rows).overall,
      holdings: rows.map((r) => {
        const a = byId[r.sym] || {};
        return {
          sym: r.sym,
          verdict: a.verdict || localVerdict(r),
          insight: (a.insight || "").trim() || localInsight(r),
          action: (a.action || "").trim() || "",
        };
      }),
    };
  } catch {
    return localPortfolioRead(rows);
  }
}

/* Grounded local fallback — no LLM, purely from the numbers. Honest, never invented. */
function localVerdict(r) {
  if (r.pnlPct == null) return "Watch";
  if (r.pnlPct <= -8) return "Trim";
  if (r.pnlPct >= 15 && r.trend === "Uptrend") return "Hold";
  if (r.trend === "Downtrend" && r.pnlPct < 0) return "Trim";
  return "Hold";
}
function localInsight(r) {
  const bits = [];
  if (r.pnlPct != null) bits.push(`${r.pnlPct >= 0 ? "up" : "down"} ${Math.abs(r.pnlPct)}% from your average`);
  if (r.trend) bits.push(r.trend.toLowerCase());
  if (r.rsi != null) bits.push(`RSI ${r.rsi}`);
  return bits.length ? `${r.sym} is ${bits.join(", ")}.` : `Limited data available for ${r.sym}.`;
}
function localPortfolioRead(rows) {
  const priced = rows.filter((r) => r.pnlPct != null);
  const losers = priced.filter((r) => r.pnlPct < 0).length;
  const overall = priced.length
    ? `${priced.length} priced position${priced.length > 1 ? "s" : ""}, ${losers} underwater. Review the trimmed names below; the rest look steady on the numbers you hold.`
    : "Live prices weren't available for these holdings, so this is a limited read.";
  return { overall, holdings: rows.map((r) => ({ sym: r.sym, verdict: localVerdict(r), insight: localInsight(r), action: "" })) };
}
