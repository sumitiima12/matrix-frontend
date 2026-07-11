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
