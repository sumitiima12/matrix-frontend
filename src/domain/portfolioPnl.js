import { positionPnl } from "./leverage";   // the ONE P&L engine (Delta-parity crypto perps + spot); used everywhere
import { marketOf } from "./universe";

/**
 * portfolioPnl.js — the SINGLE client-side portfolio analytics function.
 *
 * Every dashboard headline (Home Total, Screener, Automate, Ideas, Smart Auto-Buy) calls computeCategories()
 * with its own {mode, market, window} and reads the category it cares about. Because they all share this one
 * function — same P&L engine (positionPnl), same provenance bucketing (sourceCategory), same window rule
 * (open positions count "now"; closed trades scoped by exit time), same REAL/VIRTUAL wall — the feature
 * dashboards can never disagree with the Total's category box for the same filter.
 *
 * GUARANTEE (unit-tested): total === Σ categories, and every in-scope trade lands in exactly one category.
 */

export const CATEGORIES = ["Manual", "Smart Auto-Buy", "Automate", "Screener", "Ideas", "Unknown/Imported"];

/* Canonical source category of a trade — mirrors the backend provenance resolver and the Dashboard srcLabel.
   Screener SELF-EVIDENCE (a screenerKey/screenerName) wins even when the row was mis-stamped "Manual", so a
   screener-placed position is never miscounted as Manual. Empty/unrecognised tradeType with no evidence is
   treated as Unknown/Imported (an externally-opened or legacy position), never silently Manual. */
export function sourceCategory(t) {
  const tt = String((t && t.tradeType) || "").toLowerCase();
  const hasScreener = !!(t && (t.screenerKey || t.screenerName));
  if (tt === "screener auto buy") return "Screener";
  if (tt === "auto buy") return "Smart Auto-Buy";
  if (tt === "automate") return "Automate";
  if (tt === "ideas" || tt === "idea") return "Ideas";
  if (tt === "manual") return hasScreener ? "Screener" : "Manual";
  if (hasScreener) return "Screener";
  return tt ? "Manual" : "Unknown/Imported";   // recognised-but-other → Manual; truly blank → Unknown/Imported
}

const _lo = (v) => (v == null ? -Infinity : (Number.isFinite(Number(v)) ? Number(v) : -Infinity));
const _hi = (v) => (v == null ? Infinity : (Number.isFinite(Number(v)) ? Number(v) : Infinity));

/**
 * @param {Array} trades  the trade journal
 * @param {object} opts
 *   mode:   "real"|"virtual"|"REAL"|"VIRTUAL"  — hard wall, never mixes books
 *   market: e.g. "Crypto" (optional; matches t.market OR the symbol's market)
 *   from,to: window bounds in ms (open positions ignore the window; closed scoped by exit time). null = unbounded
 *   priceOf: (sym) => number|null  — live mark for open positions' unrealised P&L
 *   heldSet: optional Set of normalised held symbols (real mode) → a real journalled-open the broker no longer
 *            holds is treated as CLOSED at its mark (phantom-open reconciliation), matching the Home dashboard.
 *   normSym: optional normaliser used with heldSet
 * @returns {{ total, categories, open, closed, trades, wins, winRate }}
 */
export function computeCategories(trades, opts = {}) {
  const { mode, market, from = null, to = null, priceOf = null, heldSet = null, normSym = null } = opts;
  const isReal = String(mode || "").toLowerCase() === "real";
  const lo = _lo(from), hi = _hi(to);
  const cats = CATEGORIES.reduce((m, c) => (m[c] = 0, m), {});
  let total = 0, open = 0, closed = 0, wins = 0, tradesN = 0;

  for (const t of Array.isArray(trades) ? trades : []) {
    if (!t || t.status === "rejected") continue;
    if (isReal ? !t.real : !!t.real) continue;                              // REAL/VIRTUAL wall
    if (market && (String(t.market || marketOf(t.sym) || "")) !== market) continue;
    if (t.entry == null || !(Number(t.entry) > 0)) continue;

    // Phantom-open reconciliation (real): a still-journalled-open row the broker no longer holds is CLOSED-at-mark.
    let reconciledClosed = false;
    if (isReal && heldSet && normSym && t.exitAt == null && !heldSet.has(normSym(t.sym))) reconciledClosed = true;

    const isO = (t.exitAt == null || t.exit == null) && !reconciledClosed;
    if (!isO && !reconciledClosed) {
      // closed by the book: scope by exit (fallback entry) time into the window
      const st = Number(t.exitAt || t.entryAt || 0);
      if (!(st >= lo && st <= hi)) continue;
    }
    const px = isO || reconciledClosed ? (priceOf ? priceOf(t.sym) : null) : Number(t.exit);
    if (px == null) continue;                                               // no mark yet ⇒ can't value; skip

    const p = positionPnl(t, px, marketOf(t.sym) || market);
    const cat = sourceCategory(t);
    cats[cat] += p; total += p; tradesN += 1;
    if (isO) open += 1; else { closed += 1; if (p > 0) wins += 1; }
  }

  const round = (n) => +Number(n).toFixed(2);
  const categories = {}; for (const c of CATEGORIES) categories[c] = round(cats[c]);
  return { total: round(total), categories, open, closed, trades: tradesN, wins, winRate: closed ? +((wins / closed) * 100).toFixed(1) : null };
}
