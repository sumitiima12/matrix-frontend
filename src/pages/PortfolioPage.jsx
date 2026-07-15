import React, { useMemo, useState } from "react";
import { Briefcase, ChevronRight, Home, SlidersHorizontal } from "lucide-react";
import { fmt } from "../lib/format";
import { ALL, marketOf } from "../domain/universe";
import { techSignal } from "../domain/signals";
import { analyzeHolding, portfolioHealth, sectorExposure } from "../services/portfolioService";
import { analyzePortfolio } from "../services/aiService";

/**
 * Portfolio — holdings with AI intelligence, health score and sector exposure.
 */

function HoldingIntel({ a, market = "IN", stock, onWhy }) {
  const [open, setOpen] = useState(false);
  if (!a) return null;
  const col = a.action === "Add" ? "var(--up)" : a.action === "Exit" ? "var(--down)" : a.action === "Reduce" ? "#F59E0B" : "var(--muted)";
  if (!a.hasData) {
    return <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--muted)" }}>Data currently unavailable</div>;
  }
  return (
    <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--line)" }}>
      <div onClick={() => setOpen((v) => !v)} className="tap" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill disp" style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 10px", background: col, color: "#fff" }}>{a.action}</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{a.confidence}% confidence</span>
        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>· {a.trend} · {a.risk} risk</span>
        {a.rMultiple != null && <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: a.rMultiple >= 0 ? "var(--up)" : "var(--down)" }}>{a.rMultiple >= 0 ? "+" : ""}{a.rMultiple}R</span>}
        <ChevronRight size={13} style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--muted)" }} />
      </div>
      {open && (
        <div style={{ marginTop: 9 }}>
          {a.reasons.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 6, fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.5 }}><span style={{ color: col }}>•</span><span>{x}</span></div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {[["Suggested stop", a.suggestedStop, "var(--down)"], ["Suggested target", a.suggestedTarget, "var(--up)"]].map(([k, v, c]) => (
              <div key={k} style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "7px 9px" }}>
                <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800 }}>{k.toUpperCase()}</div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: c }}>{v != null ? fmt(v, market) : "—"}</div>
              </div>
            ))}
          </div>

          {/* Matrix is telling you to hold / trim / exit. You are entitled to ask why. */}
          {stock && onWhy && (
            <button onClick={(e) => { e.stopPropagation(); onWhy(stock, `Portfolio suggestion: ${a.action}`); }} className="tap"
              style={{ marginTop: 10, width: "100%", border: "1px solid var(--line)", background: "transparent", color: "var(--ink-soft)", borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              Why this call?
            </button>
          )}
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>📊 {a.technical}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>🏛 {a.fundamental}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, c }) { return <div><div style={{ color: "var(--muted)" }}>{k}</div><div className="mono" style={{ fontWeight: 700, color: c || "var(--ink)" }}>{v}</div></div>; }

/* ============================== WATCHLIST ============================== */

function ManageHolding({ r, st, onBuy, onSell, onUpdate, onClose }) {
  const [buyQty, setBuyQty] = useState(1);
  const [sellQty, setSellQty] = useState(r.qty || 1);   // default to selling the whole holding
  const [sl, setSl] = useState(r.sl ? String(r.sl) : "");
  const [tsl, setTsl] = useState(r.tsl ? String(r.tsl) : "");
  const [tp, setTp] = useState(r.tp ? String(r.tp) : "");
  const saveRisk = () => { onUpdate && onUpdate(r.sym, { sl: sl === "" ? undefined : +sl, tsl: tsl === "" ? undefined : +tsl, tp: tp === "" ? undefined : +tp }); onClose && onClose(); };
  // The +/- button style. Referenced but never defined — every "Manage" panel threw.
  const qBtn = {
    border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)",
    borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", fontWeight: 800,
  };

  const stepper = (val, setter, max) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
      <button onClick={() => setter((q) => Math.max(1, q - 1))} className="tap" style={{ ...qBtn, width: 30, height: 30, fontSize: 16 }}>–</button>
      <input value={val} onChange={(e) => setter(Math.max(1, Math.min(max || 9999, parseInt(e.target.value) || 1)))} className="no-ring mono" style={{ width: 44, textAlign: "center", border: "1px solid var(--line)", borderRadius: 9, padding: 6, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
      <button onClick={() => setter((q) => Math.min(max || 9999, q + 1))} className="tap" style={{ ...qBtn, width: 30, height: 30, fontSize: 16 }}>+</button>
    </div>
  );
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
      {/* Buy more */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {stepper(buyQty, setBuyQty)}
        <button onClick={() => { onBuy && onBuy(st, buyQty); }} className="tap disp" style={{ flex: 1, background: "linear-gradient(120deg,var(--up),#0EA968)", color: "#fff", border: "none", borderRadius: 10, padding: 11, fontWeight: 800, fontSize: 13 }}>Buy more · {buyQty}</button>
      </div>
      {/* Sell */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
        {stepper(sellQty, setSellQty, r.qty)}
        <button onClick={() => { onSell && onSell(st, sellQty, { market: r.market || r.m }); onClose && onClose(); }} className="tap disp" style={{ flex: 1, background: "linear-gradient(120deg,var(--down),#D93A4E)", color: "#fff", border: "none", borderRadius: 10, padding: 11, fontWeight: 800, fontSize: 13 }}>Sell · {sellQty}</button>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 7 }}>You hold {r.qty} units · sell up to {r.qty}.</div>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, margin: "12px 0 6px" }}>Risk orders (%)</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[["Stop loss", sl, setSl], ["Trailing SL", tsl, setTsl], ["Take profit", tp, setTp]].map(([lbl, val, setter]) => (
          <div key={lbl} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "7px 9px", background: "var(--elev)" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{lbl} %</div>
            <input value={val} onChange={(e) => setter(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="—" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--ink)", fontWeight: 800, fontSize: 14, marginTop: 2 }} />
          </div>
        ))}
      </div>
      <button onClick={saveRisk} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 11, padding: 10, fontWeight: 800, fontSize: 12.5 }}>Save risk orders</button>
    </div>
  );
}


function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 700, letterSpacing: ".03em" }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: color || "var(--ink)", marginTop: 1 }}>{value}</div>
    </div>
  );
}

/* Shared "Analyze my portfolio" button + Oracle's read panel — used by both virtual and
   real mode so the two behave identically. */
function AnalyzeBlock({ onRun, loading, review }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={onRun}
        disabled={loading}
        className="tap disp glow"
        style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Oracle is analyzing…" : "✨ Analyze my portfolio"}
      </button>
      {review && (
        <div className="card fade" style={{ marginTop: 12, padding: 15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span className="disp" style={{ fontWeight: 800, fontSize: 14 }}>Oracle's read</span>
            <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 7px", background: "var(--primary-soft)", color: "var(--primary)" }}>AI</span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink)" }}>{review.overall}</div>
          {review.holdings && review.holdings.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
              {review.holdings.map((h) => {
                const vColor = /Exit|Trim/.test(h.verdict) ? "var(--down)" : /Add|Hold/.test(h.verdict) ? "var(--up)" : "var(--muted)";
                return (
                  <div key={h.sym} style={{ borderTop: "1px solid var(--line)", paddingTop: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{h.sym}</span>
                      <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", background: vColor, color: "#fff" }}>{h.verdict}</span>
                    </div>
                    {h.insight && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{h.insight}</div>}
                    {h.action && <div style={{ fontSize: 11, color: "var(--ink)", marginTop: 3, fontWeight: 600 }}>→ {h.action}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
            Oracle interprets your real holding numbers — it isn't financial advice. Always do your own check before acting.
          </div>
        </div>
      )}
    </div>
  );
}

export default function Portfolio({ portfolio, wallet, market = "IN", onGoHome, onBuy, onSell, onUpdate, onRemove, priceSnap = {}, onWhy, onOpen, mode = "virtual", realPortfolio = null, realErr = null, realLoading = false, onRefreshReal, brokerName }) {
  /* Whole-book AI review state — shared by BOTH virtual and real mode. Declared up here so
     the real-mode early-return below can use it too. */
  const [aiReview, setAiReview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const runAnalyze = async (payload) => {
    setAiLoading(true); setAiReview(null);
    try { setAiReview(await analyzePortfolio(payload)); }
    catch { setAiReview({ overall: "Couldn't reach Oracle right now — try again in a moment.", holdings: [] }); }
    finally { setAiLoading(false); }
  };

  /* REAL MODE shows the user's ACTUAL broker holdings. It is read-only and entirely
     separate from the paper book — no paper position appears here, and no real
     position leaks into the paper P&L. Mixing them would produce a portfolio that is
     true of no account that exists. */
  if (mode === "real") {
    /* FYERS holds Indian (NSE) stock only. On any other market tab, real trading isn't
       wired up — say so plainly rather than showing Indian holdings under US/Crypto. */
    if (market !== "IN") {
      return (
        <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
          Real trading isn't available for this market yet.<br />
          Switch to <b style={{ color: "var(--ink)" }}>Indian</b> to see your FYERS holdings, or switch to Virtual for paper trading here.
        </div>
      );
    }
    if (realLoading && !realPortfolio) {
      return <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading your {brokerName || "broker"} portfolio…</div>;
    }
    if (realErr) {
      return (
        <div style={{ padding: "40px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--down)", fontSize: 13, fontWeight: 700 }}>Couldn't load your real portfolio</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>{realErr}</div>
          <button onClick={onRefreshReal} className="tap disp" style={{ marginTop: 14, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>Try again</button>
        </div>
      );
    }

    const hold = (realPortfolio && realPortfolio.holdings) || [];
    const cash = realPortfolio ? realPortfolio.cash : null;
    const invested = hold.reduce((a, h) => a + (h.avg != null && h.qty ? h.avg * h.qty : 0), 0);
    const value = hold.reduce((a, h) => a + (h.value != null ? h.value : 0), 0);
    const pnl = hold.reduce((a, h) => a + (h.pnl != null ? h.pnl : 0), 0);

    /* Health from real holdings — only the components FYERS data can honestly support. */
    const realHealth = (() => {
      const priced = hold.filter((h) => h.value != null && h.value > 0);
      if (!priced.length) return null;
      const inv = priced.reduce((a, h) => a + h.value, 0);
      const weights = priced.map((h) => (inv ? h.value / inv : 0));
      const hhi = weights.reduce((a, w) => a + w * w, 0);
      const concentration = Math.max(0, Math.min(100, Math.round((1 - hhi) * 125)));
      const biggest = priced.reduce((a, b) => (b.value > a.value ? b : a), priced[0]);
      const biggestPct = inv ? Math.round((biggest.value / inv) * 100) : 0;
      const losers = priced.filter((h) => h.pnl != null && h.pnl < 0).length;
      const drawdown = Math.round((1 - losers / priced.length) * 100);
      const score = Math.round((concentration + drawdown) / 2);
      return {
        score, biggest: biggest.sym, biggestPct, losers, total: priced.length,
        components: [
          { label: "Diversification", value: concentration, hint: `Largest position ${biggest.sym} is ${biggestPct}% of holdings` },
          { label: "Drawdown pressure", value: drawdown, hint: `${losers} of ${priced.length} position${priced.length > 1 ? "s" : ""} underwater` },
        ],
      };
    })();

    return (
      <div style={{ padding: "6px 0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 2px 12px" }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 22 }}>Real portfolio</div>
          <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", background: "var(--down-soft)", color: "var(--down)" }}>
            {brokerName ? brokerName.toUpperCase() : "BROKER"}
          </span>
        </div>

        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Holdings value</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 3 }}>
            {value ? "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Invested</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 800 }}>{invested ? "₹" + invested.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>P&L</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: pnl > 0 ? "var(--up)" : pnl < 0 ? "var(--down)" : "var(--ink)" }}>
                {hold.length ? (pnl >= 0 ? "+" : "") + "₹" + pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Available cash</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 800 }}>{cash != null ? "₹" + cash.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</div>
            </div>
          </div>
        </div>

        {realHealth && (
          <div className="card" style={{ padding: 15, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 14 }}>Portfolio health</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: realHealth.score >= 60 ? "var(--up)" : realHealth.score >= 40 ? "var(--ink)" : "var(--down)" }}>
                {realHealth.score}<span style={{ fontSize: 11, color: "var(--muted)" }}>/100</span>
              </div>
            </div>
            {realHealth.components.map((c) => (
              <div key={c.label} style={{ marginTop: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>{c.label}</span>
                  <span className="mono" style={{ fontWeight: 800 }}>{c.value}</span>
                </div>
                <div style={{ height: 5, background: "var(--line)", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: c.value + "%", height: "100%", background: c.value >= 60 ? "var(--up)" : c.value >= 40 ? "var(--muted)" : "var(--down)" }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{c.hint}</div>
              </div>
            ))}
            <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 11, lineHeight: 1.5 }}>
              Based on your live FYERS holdings. Trend and stop-protection scores aren't shown here — they need technical analysis we only run on tracked stocks.
            </div>
          </div>
        )}

        {!hold.length ? (
          <div style={{ padding: "34px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>
            No holdings in your {brokerName || "broker"} account.
          </div>
        ) : hold.map((h) => {
          // Real technicals ONLY when the stock is in our universe. For anything FYERS holds
          // that we don't track, we show price/P&L and say analysis isn't available — we
          // never invent a confidence or risk score.
          const uni = ALL.find((a) => a.sym === h.sym);
          const sig = uni ? techSignal(uni) : null;
          const pnlPct = (h.avg && h.ltp) ? ((h.ltp / h.avg) - 1) * 100 : null;
          return (
            <div key={h.sym} className="card" style={{ marginTop: 9, padding: 13 }}>
              <div
                onClick={() => uni && onOpen && onOpen(uni)}
                className={uni && onOpen ? "tap" : undefined}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: uni && onOpen ? "pointer" : "default" }}
              >
                <div>
                  <div className="disp" style={{ fontWeight: 800, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                    {h.sym}
                    {h.source === "positions" && (
                      <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "var(--elev)", color: "var(--muted)", letterSpacing: ".03em" }}>POSITION</span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                    {h.qty} @ {h.avg != null ? "₹" + h.avg.toFixed(2) : "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 13.5, fontWeight: 800 }}>{h.ltp != null ? "₹" + h.ltp.toFixed(2) : "—"}</div>
                  <div className="mono" style={{ fontSize: 10.5, fontWeight: 800, marginTop: 2, color: h.pnl == null ? "var(--muted)" : h.pnl >= 0 ? "var(--up)" : "var(--down)" }}>
                    {h.pnl == null ? "—" : (h.pnl >= 0 ? "+" : "") + "₹" + h.pnl.toFixed(0)}
                    {pnlPct != null && <span style={{ opacity: .8 }}> ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>

              {/* Real technicals row — only when we actually have them. All values come from
                  the live signal/universe entry; nothing here is invented. */}
              {sig ? (
                <div style={{ display: "flex", gap: 14, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", flexWrap: "wrap", alignItems: "center" }}>
                  {sig.signal && <MiniStat label="Signal" value={sig.signal} color={/Buy|Bull/i.test(sig.signal) ? "var(--up)" : /Sell|Bear/i.test(sig.signal) ? "var(--down)" : "var(--muted)"} />}
                  {uni.rsi != null && <MiniStat label="RSI" value={String(Math.round(uni.rsi))} color={uni.rsi > 70 ? "var(--down)" : uni.rsi < 30 ? "var(--up)" : "var(--ink)"} />}
                  {sig.rr != null && <MiniStat label="R:R" value={sig.rr + ":1"} color="var(--ink)" />}
                  {uni && onOpen && <button onClick={() => onOpen(uni)} className="tap disp" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>Manage →</button>}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  Trend and risk analysis isn't available for this holding — it's not in Matrix's tracked universe.
                </div>
              )}
            </div>
          );
        })}

        {hold.length > 0 && (
          <AnalyzeBlock
            loading={aiLoading}
            review={aiReview}
            onRun={() => runAnalyze(hold.map((h) => ({
              sym: h.sym, qty: h.qty, avg: h.avg, ltp: h.ltp,
              trend: null, rsi: null,   // FYERS holdings carry no technicals; Oracle reads price/P&L only
            })))}
          />
        )}

        <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          Read-only, straight from {brokerName || "your broker"}. Switch to Virtual for paper trading.
        </div>
      </div>
    );
  }
  const [expand, setExpand] = useState(null);   // sym with open trade panel
  const [fType, setFType] = useState([]);      // Manual / Auto Buy / Automate
  const mkt = market;
  const mLabel = { IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", Commodity: "🪙 Commodity" }[market];

  /* Positions we can no longer price: the symbol isn't in the universe, so no feed
     carries it (LAB is the real example — a dollar-priced token, not an Indian stock).

     These were being dumped under the INDIAN tab, which is precisely the thing the old
     comment claimed not to do. A dollar-denominated token is not an Indian holding, and
     showing it there makes the Indian portfolio wrong.

     Now they appear under the market they were actually BOUGHT in, which the order
     records. Options carry market:"IN" and are priced fine, so they never land here. */
  const orphans = portfolio.filter(
    (h) => !h.isFut && !h.isOpt && marketOf(h.sym) === null && (h.market || null) === market
  );

  /* Positions with NO recorded market at all — bought before the order started recording
     it. They belong to no tab, so if we simply filtered them out they would sit in storage
     forever, invisible and unremovable. We surface them once, clearly labelled, with a way
     to delete them. Hiding a position is not the same as it not existing. */
  const unplaceable = portfolio.filter(
    (h) => !h.isFut && !h.isOpt && marketOf(h.sym) === null && !h.market
  );


  const TRADE_TYPES = ["Manual", "Auto Buy", "Automate"];
  const typeOf = (h) => h.tradeType || "Manual";

  const rows = portfolio
    /* F&O holdings live under Indian now that the F&O tab is gone. The old filter
       (`marketOf(h.sym) === mkt && !h.fno`) EXCLUDED them from Indian and showed them
       only on the F&O tab — so removing that tab would have made any open F&O position
       invisible while you still owned it. */
    /* There is no F&O tab. Options bought by automation file under INDIAN — they carry
       market:"IN" from the order, so they land here alongside the stocks. We do NOT try to
       re-derive their market from the symbol: "NSE:NIFTY26JUL24050CE" is a broker contract
       string, not a universe entry, and marketOf() would return nothing — the position
       would match no tab and you'd own something you couldn't see.

       Legacy FUTURES positions (from when futures existed) are dropped: they can no longer
       be priced or exited by any code path in the app, so showing a live-looking P&L for
       them would be a fiction. */
    .filter((h) => !h.isFut && !/\sFUT$/.test(h.sym || ""))
    .filter((h) => (h.market || marketOf(h.sym)) === mkt)
    .filter((h) => (fType.length ? fType.includes(typeOf(h)) : true))
    .map((h) => {
    const m = marketOf(h.sym);
    const cur = priceSnap[h.sym] != null ? priceSnap[h.sym] : h.buy;   // frozen until next buy/sell
    const inv = h.buy * h.qty, val = cur * h.qty;
    const pl = val - inv, plp = (cur / h.buy - 1) * 100;
    const days = Math.max(1, Math.round((Date.now() - h.date) / 86400000)) || 1;
    return { ...h, m, cur, inv, val, pl, plp, days };
  });
  const totalVal = rows.reduce((a, r) => a + r.val, 0);
  const totalInv = rows.reduce((a, r) => a + r.inv, 0);
  const totalPL = totalVal - totalInv;

  // ---- PORTFOLIO INTELLIGENCE (real data only; no guesses) ----
  const intel = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const st = ALL.find((a) => a.sym === r.sym);
      map[r.sym] = analyzeHolding(r, st, st ? techSignal(st) : null);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.sym}:${r.qty}:${r.cur}:${r.sl || ""}:${r.tp || ""}`).join(",")]);
  const analyses = Object.values(intel);
  const health = useMemo(() => portfolioHealth(analyses, wallet), [analyses, wallet]);
  const sectors = useMemo(() => sectorExposure(analyses, (sym) => ALL.find((a) => a.sym === sym)), [analyses]);

  return (
    <div className="mx fade">
      {/* PORTFOLIO HEALTH — every point traceable to a real number */}
      {health.score != null && (
        <div className="card" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 14 }}>Portfolio health</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 22, color: health.score >= 70 ? "var(--up)" : health.score >= 45 ? "#F59E0B" : "var(--down)" }}>{health.score}<span style={{ fontSize: 12, color: "var(--muted)" }}>/100</span></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {health.components.map((c) => (
              <div key={c.k} style={{ marginTop: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700 }}>
                  <span>{c.k}</span><span className="mono" style={{ color: "var(--muted)" }}>{c.v}</span>
                </div>
                <div style={{ height: 5, background: "var(--elev)", borderRadius: 3, marginTop: 3, overflow: "hidden" }}>
                  <div style={{ width: `${c.v}%`, height: "100%", borderRadius: 3, background: c.v >= 70 ? "var(--up)" : c.v >= 45 ? "#F59E0B" : "var(--down)" }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{c.why}</div>
              </div>
            ))}
          </div>
          {health.flags.length > 0 && (
            <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              {health.flags.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--ink-soft)", marginTop: 5, lineHeight: 1.5 }}>
                  <span style={{ color: "#F59E0B", flex: "0 0 auto" }}>▲</span><span>{f}</span>
                </div>
              ))}
            </div>
          )}
          {sectors.length > 1 && (
            <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 7 }}>SECTOR EXPOSURE</div>
              {sectors.slice(0, 5).map((x) => (
                <div key={x.sector} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 11.5, flex: "0 0 90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.sector}</span>
                  <div style={{ flex: 1, height: 6, background: "var(--elev)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${x.pct}%`, height: "100%", background: "var(--primary)", borderRadius: 3 }} />
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, flex: "0 0 auto" }}>{x.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Virtual Portfolio</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{mLabel} holdings</div>
      <div className="card metal" style={{ marginTop: 12, padding: 16, background: "var(--feature-grad)", border: "none", color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: .8 }}>Holdings value</div>
        <div className="mono" style={{ fontWeight: 700, fontSize: 28, marginTop: 2 }}>{fmt(totalVal, mkt)}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12.5 }}>
          <div><div style={{ opacity: .7 }}>Cash</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(wallet, "IN")}</div></div>
          <div><div style={{ opacity: .7 }}>Invested</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(totalInv, mkt)}</div></div>
          <div><div style={{ opacity: .7 }}>Total P/L</div><div className="mono" style={{ fontWeight: 700, color: totalPL >= 0 ? "#5CF0B5" : "#FF8FA0" }}>{totalPL >= 0 ? "+" : ""}{fmt(totalPL, mkt)}</div></div>
        </div>
      </div>
      {/* TRADE TYPE — tell your own trades apart from the ones a strategy opened.
          Only shown when there is more than one kind in the book: a filter with a
          single option is noise. */}
      {(() => {
        const present = TRADE_TYPES.filter((t) =>
          portfolio.some((h) => (h.market || marketOf(h.sym)) === mkt && typeOf(h) === t));
        if (present.length < 2) return null;
        const color = (t) => (t === "Auto Buy" ? "var(--primary)" : t === "Automate" ? "#8B5CF6" : "var(--muted)");
        return (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            {present.map((t) => {
              const on = fType.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setFType((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className="pill tap disp"
                  style={{
                    padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    border: "1px solid " + (on ? color(t) : "var(--line)"),
                    background: on ? color(t) : "var(--surface)",
                    color: on ? "#fff" : "var(--ink)",
                  }}
                >
                  {t}
                </button>
              );
            })}
            {fType.length > 0 && (
              <button onClick={() => setFType([])} className="pill tap disp"
                style={{ padding: "6px 11px", fontSize: 11.5, fontWeight: 700, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--muted)", cursor: "pointer" }}>
                Clear
              </button>
            )}
          </div>
        );
      })()}

      {rows.length > 0 && (
        <AnalyzeBlock
          loading={aiLoading}
          review={aiReview}
          onRun={() => runAnalyze(rows.map((r) => {
            const a = intel[r.sym] || {};
            return { sym: r.sym, qty: r.qty, avg: r.buy, ltp: r.cur, trend: a.trend || null, rsi: a.rsi != null ? a.rsi : null };
          }))}
        />
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 30, textAlign: "center", color: "var(--muted)" }}>
          <Briefcase size={28} color="var(--muted)" /><div style={{ marginTop: 8, fontSize: 13.5 }}>{market === "FNO" ? "No F&O positions. Futures & options you trade will show here — stock holdings stay under their own market." : `No ${mLabel} holdings yet. Buy from this market, or switch markets from the tabs above.`}</div>
          <button onClick={() => onGoHome && onGoHome()} className="tap disp glow" style={{ marginTop: 16, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: "12px 22px", fontWeight: 800, fontSize: 13.5, display: "inline-flex", gap: 7, alignItems: "center" }}><Home size={16} /> Go to Home</button>
        </div>
      ) : rows.map((r) => {
        const st = ALL.find((a) => a.sym === r.sym) || { sym: r.sym, name: r.name, price: r.cur };
        return (
          <div key={r.sym} className="card" style={{ marginTop: 12, padding: 14 }}>
            {/* Tapping the holding opens the symbol drawer, exactly like a card on the
                home page. The controls below stopPropagation so they still work. */}
            <div
              onClick={() => onOpen && ALL.find((a) => a.sym === r.sym) && onOpen(ALL.find((a) => a.sym === r.sym))}
              className={onOpen ? "tap" : undefined}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{r.sym}</div>
                  {/* An intraday position will be closed for you. Say so on the position
                      itself — not just in the confirm sheet you saw once. */}
                  {r.product === "MIS" && (
                    <span className="pill" title={r.m === "Crypto" ? "Auto-sells 23h45m after entry" : "Auto-sells 15 min before the close"}
                      style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 6px", background: "var(--amber-soft, var(--elev))", color: "var(--amber)" }}>
                      INTRADAY
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.qty} units · held {r.days}d</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: r.pl >= 0 ? "var(--up)" : "var(--down)" }}>{r.pl >= 0 ? "+" : ""}{fmt(r.pl, r.m)}</div>
                <div className="mono" style={{ fontSize: 12, color: r.pl >= 0 ? "var(--up)" : "var(--down)" }}>{r.plp >= 0 ? "+" : ""}{r.plp.toFixed(2)}%</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11.5 }}>
              <Stat k="Buy" v={fmt(r.buy, r.m)} /><Stat k="Current" v={fmt(r.cur, r.m)} /><Stat k="Invested" v={fmt(r.inv, r.m)} />
            </div>
            {(r.sl || r.tsl || r.tp) && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, fontWeight: 600, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", background: "var(--up-soft)", color: "var(--up)" }}>● ARMED</span>
              {r.tp ? `🎯 TP +${r.tp}% ` : ""}{r.sl ? `· 🛑 SL −${r.sl}% ` : ""}{r.tsl ? `· 🔻 TSL ${r.tsl}%` : ""}
              <span style={{ opacity: .8 }}></span>
            </div>}

            {/* ---- AI COPILOT: per-holding recommendation (real data only) ---- */}
            {intel[r.sym] && <HoldingIntel a={intel[r.sym]} market={r.m} stock={ALL.find((x) => x.sym === r.sym)} onWhy={onWhy} />}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setExpand(expand === r.sym ? null : r.sym)} className="tap disp" style={{ flex: 1, background: expand === r.sym ? "var(--primary)" : "var(--surface)", color: expand === r.sym ? "var(--on-primary)" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 11, padding: 11, fontWeight: 800, fontSize: 12.5, display: "flex", gap: 5, alignItems: "center", justifyContent: "center" }}><SlidersHorizontal size={13} /> {expand === r.sym ? "Close" : "Manage · Buy / Sell"}</button>
            </div>
            {expand === r.sym && <ManageHolding r={r} st={st} onBuy={onBuy} onSell={onSell} onUpdate={onUpdate} onClose={() => setExpand(null)} />}
          </div>
        );
      })}

      {/* Positions we can no longer price. Never silently dropped, never filed under
          a market they don't belong to. */}
      {/* NO MARKET RECORDED. Shown once so it can be dealt with — explicitly NOT presented
          as an Indian holding, which is what the old code did. */}
      {market === "IN" && unplaceable.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: 14, border: "1px dashed var(--line)", background: "var(--elev)" }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--muted)" }}>
            Positions with no market recorded
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
            These were bought before the app recorded which market a trade belonged to, and no feed
            carries them now — so they can't be priced or filed. They are <b>not</b> Indian holdings
            and are excluded from every valuation. Remove them if you no longer want them.
          </div>
          {unplaceable.map((h) => (
            <div key={h.sym} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10 }}>
              <span className="disp" style={{ fontWeight: 700 }}>{h.sym}</span>
              <span className="mono" style={{ color: "var(--muted)", fontSize: 11.5, marginLeft: "auto" }}>
                {h.qty} units
              </span>
              <button
                onClick={() => onRemove && onRemove(h.sym)}
                className="tap disp"
                style={{ border: "1px solid var(--down)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {orphans.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: 14, border: "1px dashed var(--line)" }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--muted)" }}>Not currently priceable</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
            No live feed exists for these, so they are excluded from valuations rather than
            valued with a made-up price.
          </div>
          {orphans.map((h) => (
            <div key={h.sym} style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5 }}>
              <span className="disp" style={{ fontWeight: 700 }}>{h.sym}</span>
              <span className="mono" style={{ color: "var(--muted)" }}>{h.qty} units · bought at {fmt(h.buy, "Crypto")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
