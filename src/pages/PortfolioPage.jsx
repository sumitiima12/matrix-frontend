import React, { useMemo, useState } from "react";
import { Briefcase, ChevronRight, Home, SlidersHorizontal } from "lucide-react";
import { fmt } from "../lib/format";
import { ALL, FNO, marketOf } from "../domain/universe";
import { techSignal } from "../domain/signals";
import { analyzeHolding, portfolioHealth, sectorExposure } from "../services/portfolioService";

/**
 * Portfolio — holdings with AI intelligence, health score and sector exposure.
 */

function HoldingIntel({ a, market = "IN" }) {
  const [open, setOpen] = useState(false);
  if (!a) return null;
  const col = a.action === "Add" ? "var(--up)" : a.action === "Exit" ? "var(--down)" : a.action === "Reduce" ? "#F59E0B" : "var(--muted)";
  if (!a.hasData) {
    return <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--muted)" }}>Live indicators haven't loaded — no recommendation without real data.</div>;
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
  const [sellQty, setSellQty] = useState(1);
  const [sl, setSl] = useState(r.sl ? String(r.sl) : "");
  const [tsl, setTsl] = useState(r.tsl ? String(r.tsl) : "");
  const [tp, setTp] = useState(r.tp ? String(r.tp) : "");
  const saveRisk = () => { onUpdate && onUpdate(r.sym, { sl: sl === "" ? undefined : +sl, tsl: tsl === "" ? undefined : +tsl, tp: tp === "" ? undefined : +tp }); onClose && onClose(); };
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
        <button onClick={() => { onSell && onSell(st, sellQty); onClose && onClose(); }} className="tap disp" style={{ flex: 1, background: "linear-gradient(120deg,var(--down),#D93A4E)", color: "#fff", border: "none", borderRadius: 10, padding: 11, fontWeight: 800, fontSize: 13 }}>Sell · {sellQty}</button>
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

export default function Portfolio({ portfolio, wallet, market = "IN", onGoHome, onBuy, onSell, onUpdate, priceSnap = {} }) {
  const [expand, setExpand] = useState(null);   // sym with open trade panel
  const mkt = market === "FNO" ? "IN" : market;
  const mLabel = { IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market];
  // F&O portfolio shows only F&O (futures/options) positions — never plain stock holdings
  const rows = portfolio.filter((h) => market === "FNO" ? h.fno : (marketOf(h.sym) === mkt && !h.fno)).map((h) => {
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
      {rows.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 30, textAlign: "center", color: "var(--muted)" }}>
          <Briefcase size={28} color="var(--muted)" /><div style={{ marginTop: 8, fontSize: 13.5 }}>{market === "FNO" ? "No F&O positions. Futures & options you trade will show here — stock holdings stay under their own market." : `No ${mLabel} holdings yet. Buy from this market, or switch markets from the tabs above.`}</div>
          <button onClick={() => onGoHome && onGoHome()} className="tap disp glow" style={{ marginTop: 16, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: "12px 22px", fontWeight: 800, fontSize: 13.5, display: "inline-flex", gap: 7, alignItems: "center" }}><Home size={16} /> Go to Home</button>
        </div>
      ) : rows.map((r) => {
        const st = ALL.find((a) => a.sym === r.sym) || { sym: r.sym, name: r.name, price: r.cur };
        return (
          <div key={r.sym} className="card" style={{ marginTop: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{r.sym}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{r.qty} units · held {r.days}d</div></div>
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
              <span style={{ opacity: .8 }}>· auto-sells when hit</span>
            </div>}

            {/* ---- AI COPILOT: per-holding recommendation (real data only) ---- */}
            {intel[r.sym] && <HoldingIntel a={intel[r.sym]} market={r.m} />}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setExpand(expand === r.sym ? null : r.sym)} className="tap disp" style={{ flex: 1, background: expand === r.sym ? "var(--primary)" : "var(--surface)", color: expand === r.sym ? "var(--on-primary)" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 11, padding: 11, fontWeight: 800, fontSize: 12.5, display: "flex", gap: 5, alignItems: "center", justifyContent: "center" }}><SlidersHorizontal size={13} /> {expand === r.sym ? "Close" : "Manage · Buy / Sell"}</button>
            </div>
            {expand === r.sym && <ManageHolding r={r} st={st} onBuy={onBuy} onSell={onSell} onUpdate={onUpdate} onClose={() => setExpand(null)} />}
          </div>
        );
      })}
    </div>
  );
}
