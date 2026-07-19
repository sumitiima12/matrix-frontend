import { MATRIX_PERSONA } from "../config";
import { useState } from "react";
import { askMatrix, fetchFundamentals, fetchLiveQuotes } from "../domain/api";
import { ALL, marketOf } from "../domain/universe";

/**
 * Chat state for the Matrix Copilot (Neo).
 *
 * The old version sent the user's message with ONLY the persona — so "what's your outlook on
 * TRENT?" reached the model with no numbers and came back as vague macro waffle. Now, before every
 * send, we detect any symbol referenced (the open `stock`, or a ticker/company-name in the text),
 * pull its REAL technicals (from the live universe row) and REAL fundamentals (backend), and inject
 * them. The system prompt then forces a grounded Technical + Fundamental read and a Buy/Hold/Sell
 * lean — and forbids "I don't have real-time data" when data is supplied.
 */

const num = (x, d = 1) => (x == null ? null : (+x).toFixed(d));
function fmtCr(v, mkt) {
  if (v == null) return null;
  return mkt === "IN" ? "₹" + (v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " Cr" : String(v);
}

/** Find up to 2 symbols the user is asking about (the open stock always counts). */
function detectSymbols(text, stock) {
  const found = new Map();
  if (stock && stock.sym) found.set(stock.sym, stock);
  const up = String(text || "").toUpperCase();
  for (const a of ALL) {
    if (found.size >= 2) break;
    if (found.has(a.sym)) continue;
    let hit = false;
    try { hit = a.sym && a.sym.length >= 2 && new RegExp(`(^|[^A-Z0-9])${a.sym}([^A-Z0-9]|$)`).test(up); } catch { hit = false; }
    if (!hit && a.name && a.name.length > 4 && up.includes(a.name.toUpperCase())) hit = true;
    if (hit) found.set(a.sym, a);
  }
  return [...found.values()];
}

/** Build a REAL-DATA block (technicals + fundamentals) for the detected symbols. */
async function groundData(text, stock) {
  const syms = detectSymbols(text, stock);
  if (!syms.length) return "";
  const blocks = await Promise.all(syms.map(async (st) => {
    const sym = st.sym, mkt = marketOf(sym);
    const [fund, quotes] = await Promise.all([
      fetchFundamentals(sym).catch(() => null),
      fetchLiveQuotes([sym]).catch(() => null),
    ]);
    const q = quotes && quotes[0];
    const price = st.price != null ? st.price : (q && q.price);
    const lines = [`SYMBOL ${sym} (${st.name || sym}), market ${mkt}.`];
    if (price != null) lines.push(`Price ${price}${q && q.chg != null ? ` (${q.chg >= 0 ? "+" : ""}${q.chg}% today)` : ""}.`);
    const t = [];
    if (st.rsi != null) t.push(`RSI ${st.rsi}`);
    if (st.sma50 != null && price != null) t.push(`price ${price > st.sma50 ? "above" : "below"} 50-DMA`);
    if (st.sma200 != null && price != null) t.push(`${price > st.sma200 ? "above" : "below"} 200-DMA`);
    if (st.support != null) t.push(`support ${st.support}`);
    if (st.resistance != null) t.push(`resistance ${st.resistance}`);
    if (t.length) lines.push("Technicals: " + t.join(", ") + ".");
    if (fund && !fund.unavailable) {
      const f = [];
      if (fund.peTrailing != null) f.push(`P/E ${num(fund.peTrailing)}`);
      if (fund.sectorPE != null) f.push(`sector P/E ${num(fund.sectorPE)}`);
      if (fund.pb != null) f.push(`P/B ${num(fund.pb)}`);
      if (fund.roe != null) f.push(`ROE ${num(fund.roe * 100)}%`);
      if (fund.profitMargin != null) f.push(`net margin ${num(fund.profitMargin * 100)}%`);
      if (fund.revenueGrowth != null) f.push(`revenue growth ${num(fund.revenueGrowth * 100)}%`);
      if (fund.debtToEquity != null) f.push(`debt/equity ${num(fund.debtToEquity, 0)}`);
      if (fund.dividendYield != null) f.push(`dividend yield ${num(fund.dividendYield * 100, 2)}%`);
      if (fund.marketCap != null) f.push(`market cap ${fmtCr(fund.marketCap, mkt)}`);
      if (fund.high52 != null && fund.low52 != null) f.push(`52-week range ${fund.low52}–${fund.high52}`);
      if (f.length) lines.push("Fundamentals: " + f.join(", ") + ".");
    } else if (mkt === "Crypto") {
      lines.push("Fundamentals: N/A (crypto has no company fundamentals).");
    }
    return lines.join(" ");
  }));
  return blocks.join("\n\n");
}

const NEO_GUIDE =
  "\n\nWhen the user asks about a specific instrument, structure the answer as: " +
  "(1) Technical read — trend vs 50/200-DMA, RSI, and support/resistance if given; " +
  "(2) Fundamental read — valuation vs sector P/E, ROE, margins, growth, debt (for stocks; skip for crypto); " +
  "(3) a clear lean: Buy, Hold, or Sell, with a one-line reason and the single biggest risk. " +
  "Use the REAL DATA numbers provided and quote them. NEVER say you lack real-time data or that a figure " +
  "is unavailable when it appears in REAL DATA above. Keep it tight and practical. " +
  "End with: 'Educational research, not financial advice.'";

export function useMatrixChat(context, stock) {
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  async function send(text) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setBusy(true);
    try {
      let ground = "";
      try { ground = await groundData(text, stock); } catch { ground = ""; }
      const system = `${MATRIX_PERSONA}` +
        `${context ? "\n\nCURRENT CONTEXT:\n" + context : ""}` +
        `${ground ? "\n\nREAL DATA (use ONLY these numbers; they ARE current — do not claim otherwise):\n" + ground : ""}` +
        `${NEO_GUIDE}`;
      const out = await askMatrix(next, system, 1000);
      setMsgs([...next, { role: "assistant", content: out || "I couldn't get a response from the engine. Try again in a moment." }]);
    } catch (e) {
      const detail = e && e.message ? ` (${e.message})` : "";
      setMsgs([...next, { role: "assistant", content: `I couldn't reach the Matrix engine${detail}. Check that BACKEND_URL points at your Render service and that a GROQ_API_KEY is set there — open <backend-url>/api/health to see which engines it can find. For a grounded verdict without the AI, tap Deep Analysis: it falls back to rules over real indicators.` }]);
    } finally { setBusy(false); }
  }
  return { msgs, busy, send, reset: () => setMsgs([]) };
}
