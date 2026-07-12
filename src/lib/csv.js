/**
 * lib/csv.js — CSV serialisation and download.
 *
 * Pure and UI-free: `toCSV` turns rows into a string, `downloadCSV` hands the
 * browser a file. Kept separate so it can be reused by any page (journal,
 * portfolio, backtest results) without dragging in UI code.
 */

/** Escape a single CSV cell (RFC 4180: quote it, and double any inner quotes). */
function cell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Turn rows into a CSV string.
 * @param columns [{ key, label, get? }]
 * @param rows    array of records
 */
export function toCSV(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(",");
  const body = (rows || []).map((r) =>
    columns.map((c) => cell(c.get ? c.get(r) : r[c.key])).join(",")
  );
  return [head, ...body].join("\r\n");
}

/** Trigger a file download in the browser. */
export function downloadCSV(filename, csv) {
  // BOM so Excel opens UTF-8 (₹, ₿ etc.) correctly instead of mangling it.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* --------------------------- date / time helpers --------------------------- */
const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD — sorts correctly in Excel and Google Sheets. */
export function csvDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HH:MM:SS, 24-hour. */
export function csvTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ------------------------------ trade export ------------------------------ */

const MARKET_LABEL = { IN: "Indian", US: "US", Crypto: "Crypto", FNO: "F&O", Commodity: "Commodity" };

/**
 * Column layout for a trade export.
 *
 * `livePriceOf(sym)` supplies the current price for OPEN positions so their
 * unrealised P&L is real rather than blank. If no live price is available the
 * P&L cell is left empty — it is never guessed.
 */
export function tradeColumns(livePriceOf = () => null) {
  const isOpen = (t) => t.exitAt == null || t.exit == null || t.exitType === "Open";

  const exitPrice = (t) => (isOpen(t) ? livePriceOf(t.sym) : t.exit);

  const pnl = (t) => {
    const px = exitPrice(t);
    if (px == null || t.entry == null) return null;
    return (px - t.entry) * (t.qty || 1);
  };

  const pnlPct = (t) => {
    const px = exitPrice(t);
    if (px == null || !t.entry) return null;
    return ((px - t.entry) / t.entry) * 100;
  };

  return [
    { label: "Market",        get: (t) => MARKET_LABEL[t.market] || t.market || "" },
    { label: "Symbol",        get: (t) => t.sym },
    { label: "Side",          get: (t) => t.side || "BUY" },
    { label: "Quantity",      get: (t) => t.qty ?? 1 },
    { label: "Entry Date",    get: (t) => csvDate(t.entryAt) },
    { label: "Entry Time",    get: (t) => csvTime(t.entryAt) },
    { label: "Entry Price",   get: (t) => (t.entry != null ? Number(t.entry).toFixed(2) : "") },
    { label: "Exit Date",     get: (t) => (isOpen(t) ? "" : csvDate(t.exitAt)) },
    { label: "Exit Time",     get: (t) => (isOpen(t) ? "" : csvTime(t.exitAt)) },
    { label: "Exit Price",    get: (t) => { const p = exitPrice(t); return p != null ? Number(p).toFixed(2) : ""; } },
    { label: "P&L",           get: (t) => { const p = pnl(t); return p != null ? p.toFixed(2) : ""; } },
    { label: "P&L %",         get: (t) => { const p = pnlPct(t); return p != null ? p.toFixed(2) : ""; } },
    { label: "Status",        get: (t) => (isOpen(t) ? "Open" : "Closed") },
    { label: "Trade Type",    get: (t) => t.tradeType || "Manual" },
    { label: "Exit Type",     get: (t) => (isOpen(t) ? "" : (t.exitType || "Manual")) },
    { label: "Stop Loss %",   get: (t) => (t.sl != null ? t.sl : "") },
    { label: "Target %",      get: (t) => (t.tp != null ? t.tp : "") },
    { label: "Trailing SL %", get: (t) => (t.tsl != null ? t.tsl : "") },
  ];
}

/** Build the whole trade CSV. Open positions are marked and use the live price. */
export function tradesToCSV(trades, livePriceOf) {
  return toCSV(tradeColumns(livePriceOf), trades);
}

/** matrix-trades-2026-07-12.csv */
export function tradeFilename(prefix = "matrix-trades") {
  return `${prefix}-${csvDate(Date.now())}.csv`;
}
