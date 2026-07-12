import React, { useEffect, useMemo, useRef, useState } from "react";
import { tradesToCSV, downloadCSV, tradeFilename } from "../lib/csv";
import { Bolt, Bot, Briefcase, Check, ChevronLeft, Home, Lightbulb, Moon, Search, Star, Sun, User, Wallet, X, Download } from "lucide-react";
import { BACKEND_URL } from "../config";
import { fmt, getUserId, lsGet, lsSet } from "../lib/format";
import { ALL, FNO, UNIVERSE, marketOf, yahooSymbol } from "../domain/universe";
import { fetchFundamentals, fetchIndicators, fetchLiveQuotes, fetchTrades, marketOpen, postTrade, resolveExitFromCandles } from "../domain/api";
import { DEFAULT_LIMITS, validateOrder } from "../services/riskService";
import { analyzeJournal } from "../services/journalService";

/**
 * Orders — trade history and the trading journal.
 */

function JournalPanel({ trades = [] }) {
  const { stats, insights } = useMemo(() => analyzeJournal(trades), [trades]);
  const tone = { good: "var(--up)", warn: "#F59E0B", info: "var(--primary)" };
  const icon = { good: "✓", warn: "▲", info: "◆" };
  const Tile = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 92, background: "var(--elev)", borderRadius: 12, padding: "10px 11px" }}>
      <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 15, marginTop: 2, color: c || "var(--ink)" }}>{v}</div>
    </div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Tile k="Closed" v={stats.closed} />
        <Tile k="Win rate" v={stats.winRate != null ? stats.winRate + "%" : "—"} c={stats.winRate >= 50 ? "var(--up)" : "var(--down)"} />
        <Tile k="Net P&L" v={stats.netPnl >= 0 ? "+" + stats.netPnl.toFixed(0) : stats.netPnl.toFixed(0)} c={stats.netPnl >= 0 ? "var(--up)" : "var(--down)"} />
        <Tile k="Profit factor" v={stats.profitFactor ?? "—"} c={stats.profitFactor >= 1 ? "var(--up)" : "var(--down)"} />
        <Tile k="Expectancy" v={stats.expectancy != null ? (stats.expectancy >= 0 ? "+" : "") + stats.expectancy.toFixed(0) : "—"} c={stats.expectancy >= 0 ? "var(--up)" : "var(--down)"} />
        <Tile k="Avg hold" v={stats.avgHoldDays ? stats.avgHoldDays + "d" : "—"} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", margin: "18px 2px 8px", letterSpacing: ".04em" }}>WHAT MATRIX NOTICED</div>
      {insights.map((x, i) => (
        <div key={i} className="card" style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${tone[x.kind]}` }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <span style={{ color: tone[x.kind], fontWeight: 800, fontSize: 12 }}>{icon[x.kind]}</span>
            <span className="disp" style={{ fontWeight: 800, fontSize: 13 }}>{x.title}</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-soft)", marginTop: 6 }}>{x.body}</div>
          {x.evidence && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 7, fontWeight: 700 }}>Based on {x.evidence}</div>}
        </div>
      ))}
    </div>
  );
}

export default function TradeHistory({ userId, trades, onClose }) {
  const RANGES = [["today", "Today"], ["7", "7d"], ["30", "30d"], ["90", "90d"], ["365", "1y"], ["all", "All"]];
  const MKTS = [["all", "All markets"], ["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]];
  const [range, setRange] = useState("30");
  const [mkt, setMkt] = useState("all");
  const [remote, setRemote] = useState(null);
  const [fSym, setFSym] = useState([]);
  const [fType, setFType] = useState([]);
  const [fExit, setFExit] = useState([]);
  const [openF, setOpenF] = useState(null);
  const [view, setView] = useState("history");   // "history" | "journal"
  const now = Date.now();
  const from = useMemo(() => {
    if (range === "all") return 0;
    if (range === "today") { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
    return Date.now() - (+range) * 86400000;
  }, [range]);
  useEffect(() => { let stop = false; setRemote(null); if (BACKEND_URL) fetchTrades(userId, from, Date.now()).then((t) => { if (!stop && t) setRemote(t); }).catch(() => {}); return () => { stop = true; }; }, [range, userId]);

  const isOpen = (t) => t.exitAt == null || t.exit == null || t.exitType === "Open";
  // Live P&L for still-open positions, using the current price.
  const withPnl = (t) => {
    if (!isOpen(t)) return { ...t, livePnl: t.pnl || 0, open: false };
    const s = ALL.find((a) => a.sym === t.sym);
    const cur = s ? s.price : t.entry;
    return { ...t, open: true, cur, livePnl: +((cur - t.entry) * (t.qty || 1)).toFixed(2) };
  };
  const src = (remote || trades)
    .filter((t) => (isOpen(t) ? (t.entryAt || 0) : (t.exitAt || t.entryAt || 0)) >= from)
    .map(withPnl);
  const allSyms = [...new Set(src.map((t) => t.sym))].sort();
  const TYPES = ["Manual", "Automate", "Auto Buy"];
  const EXITS = ["Manual", "Exit trigger", "Stop loss", "Trailing stop", "Open"];
  const exitOf = (t) => (t.open ? "Open" : (t.exitType || "Manual"));
  const rows = src
    .filter((t) => (mkt === "all" ? true : (t.market || "IN") === mkt))
    .filter((t) => (fSym.length ? fSym.includes(t.sym) : true))
    .filter((t) => (fType.length ? fType.includes(t.tradeType || "Manual") : true))
    .filter((t) => (fExit.length ? fExit.includes(exitOf(t)) : true))
    .sort((a, b) => (b.exitAt || b.entryAt || 0) - (a.exitAt || a.entryAt || 0));
  const dt = (ms) => ms ? new Date(ms).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const totalPnl = rows.reduce((a, t) => a + (t.livePnl || 0), 0);
  const openN = rows.filter((t) => t.open).length;
  const typeColor = (tt) => tt === "Auto Buy" ? "var(--primary)" : tt === "Automate" ? "#8B5CF6" : "var(--muted)";
  const exitColor = (et) => (et === "Stop loss" || et === "Trailing stop") ? "var(--down)" : et === "Exit trigger" ? "var(--up)" : et === "Open" ? "var(--primary)" : "var(--muted)";

  // Export the trades CURRENTLY shown (all active filters applied), so what you
  // see is what you get. Open positions carry their live price and unrealised P&L.
  const exportCSV = () => {
    const livePriceOf = (sym) => {
      const st = ALL.find((a) => a.sym === sym);
      return st && st.price != null ? st.price : null;
    };
    downloadCSV(tradeFilename(), tradesToCSV(rows, livePriceOf));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 80, display: "flex", flexDirection: "column" }} onClick={() => setOpenF(null)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 12px", borderBottom: "1px solid var(--line)" }}>
        <button onClick={onClose} className="tap" style={{ border: "none", background: "var(--elev)", borderRadius: 11, width: 36, height: 36, display: "grid", placeItems: "center" }}><ChevronLeft size={18} /></button>
        <div>
          <div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>{view === "journal" ? "Trading journal" : "Trade history"}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{rows.length} trades{openN ? ` · ${openN} open` : ""} · P&amp;L {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl, mkt === "all" ? "IN" : mkt)}</div>
        </div>
        {/* Export whatever is currently filtered, as CSV */}
        <button
          onClick={(e) => { e.stopPropagation(); exportCSV(); }}
          disabled={!rows.length}
          className="tap disp"
          title="Export these trades to CSV"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "var(--elev)", color: rows.length ? "var(--ink)" : "var(--muted)", borderRadius: 11, padding: "8px 12px", fontWeight: 800, fontSize: 12, opacity: rows.length ? 1 : 0.5, cursor: rows.length ? "pointer" : "not-allowed" }}
        >
          <Download size={14} /> Export
        </button>
      </div>

      {/* history | journal */}
      <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, margin: "10px 16px 0" }}>
        {[["history", "History"], ["journal", "Journal"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: view === k ? "var(--primary)" : "transparent", color: view === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
        ))}
      </div>

      {view === "journal" && <JournalPanel trades={remote || trades} />}

      {view === "history" && (
        <>
      {/* market selector */}
      <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "10px 16px 4px" }}>
        {MKTS.map(([k, l]) => (
          <button key={k} onClick={() => setMkt(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 13px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", border: "1px solid " + (mkt === k ? "var(--primary)" : "var(--line)"), background: mkt === k ? "var(--primary)" : "var(--surface)", color: mkt === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
        ))}
      </div>

      {/* timeframe */}
      <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 16px 4px" }}>
        {RANGES.map(([k, l]) => (
          <button key={k} onClick={() => setRange(k)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 14px", fontSize: 12, fontWeight: 700, border: "1px solid " + (range === k ? "var(--primary)" : "var(--line)"), background: range === k ? "var(--primary)" : "var(--surface)", color: range === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
        ))}
      </div>

      {/* multi-select filters */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", padding: "6px 16px 10px" }}>
        <FilterChip label="Symbol" options={allSyms} sel={fSym} setter={setFSym} open={openF} setOpen={setOpenF} />
        <FilterChip label="Trade type" options={TYPES} sel={fType} setter={setFType} colors={typeColor} open={openF} setOpen={setOpenF} />
        <FilterChip label="Exit type" options={EXITS} sel={fExit} setter={setFExit} colors={exitColor} open={openF} setOpen={setOpenF} />
        {(fSym.length || fType.length || fExit.length) ? <button onClick={() => { setFSym([]); setFType([]); setFExit([]); }} className="pill tap disp" style={{ flex: "0 0 auto", padding: "7px 12px", fontSize: 11.5, fontWeight: 700, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--muted)", whiteSpace: "nowrap" }}>Clear all</button> : null}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
        {rows.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No trades match. Buys show as <b>Open</b> until you sell; manual, auto-buy and automate trades all record here.</div>
        ) : rows.map((t) => (
          <div key={t.id} className="card" style={{ marginTop: 10, padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ minWidth: 0 }}><span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{t.sym}</span> <span style={{ fontSize: 11, color: "var(--muted)" }}>×{t.qty}</span></div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: (t.livePnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{(t.livePnl || 0) >= 0 ? "+" : ""}{fmt(t.livePnl || 0, t.market || "IN")}</div>
                {t.open && <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>unrealised</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--elev)", color: typeColor(t.tradeType || "Manual") }}>{t.tradeType || "Manual"}</span>
              <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: t.open ? "var(--primary-soft)" : "var(--elev)", color: exitColor(exitOf(t)) }}>Exit: {exitOf(t)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 11 }}>
              <div><div style={{ color: "var(--muted)", fontSize: 9.5 }}>Entry</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(t.entry, t.market || "IN")}</div><div style={{ color: "var(--muted)", fontSize: 9.5 }}>{dt(t.entryAt)}</div></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--muted)", fontSize: 9.5 }}>{t.open ? "Current" : "Exit"}</div>
                <div className="mono" style={{ fontWeight: 700 }}>{fmt(t.open ? t.cur : t.exit, t.market || "IN")}</div>
                <div style={{ color: "var(--muted)", fontSize: 9.5 }}>{t.open ? "position open" : dt(t.exitAt)}</div>
              </div>
            </div>
          </div>
        ))}
        </>
      )}
      </div>
    </div>
  );
}

