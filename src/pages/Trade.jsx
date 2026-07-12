import React, { useEffect, useState } from "react";
import { CUR, MKT_LABEL, fmt } from "../lib/format";
import { ALL, marketOf } from "../domain/universe";
import Change from "../components/common/Change";

/**
 * Trade — order ticket for buying and selling an instrument.
 */

export default function TradeView({ walletMap, adjustWallet, portfolio, setPortfolio, preset, market, recordTrade }) {
  const [sel, setSel] = useState(preset || ALL[0]);
  const [qty, setQty] = useState(1);
  const [side, setSide] = useState("Buy");
  const [ordType, setOrdType] = useState("Market");
  const [limitPx, setLimitPx] = useState("");
  const [sl, setSl] = useState(""); const [tsl, setTsl] = useState(""); const [tp, setTp] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (preset) setSel(preset); }, [preset]);
  const m = marketOf(sel.sym);
  const wallet = walletMap[m] ?? 1000000;
  const holding = portfolio.find((p) => p.sym === sel.sym);
  useEffect(() => { if (side === "Sell" && !holding) setSide("Buy"); }, [sel, holding, side]);
  const needsPx = ordType === "Limit" || ordType === "Stop-limit";
  const execPx = needsPx && limitPx !== "" && !isNaN(+limitPx) ? +limitPx : sel.price;
  const cost = execPx * qty;
  const risk = { ...(sl !== "" ? { sl: +sl } : {}), ...(tsl !== "" ? { tsl: +tsl } : {}), ...(tp !== "" ? { tp: +tp } : {}), ordType };
  const exec = () => {
    if (side === "Buy") {
      if (cost > wallet) { setMsg({ t: `Not enough funds in your ${MKT_LABEL[m] || m} wallet.`, e: true }); return; }
      adjustWallet(m, -cost);
      setPortfolio((p) => {
        const ex = p.find((h) => h.sym === sel.sym);
        if (ex) { const tq = ex.qty + qty; return p.map((h) => h.sym === sel.sym ? { ...h, qty: tq, buy: (h.buy * h.qty + cost) / tq, ...risk } : h); }
        return [...p, { sym: sel.sym, name: sel.name, qty, buy: execPx, date: Date.now(), ...risk }];
      });
      setMsg({ t: `${ordType} buy: ${qty} ${sel.sym} @ ${fmt(execPx, m)}${sl || tsl || tp ? " · risk orders set" : ""}.`, e: false });
      recordTrade && recordTrade({ sym: sel.sym, name: sel.name, entry: execPx, entryAt: Date.now(), exit: null, exitAt: null, pnl: null, qty, market: m, tradeType: "Manual", exitType: "Open" });
    } else {
      if (!holding || holding.qty < qty) { setMsg({ t: "You don't hold enough units to sell.", e: true }); return; }
      adjustWallet(m, +cost);
      recordTrade && recordTrade({ sym: sel.sym, name: sel.name, entry: holding.buy, entryAt: holding.date, exit: execPx, exitAt: Date.now(), pnl: +((execPx - holding.buy) * qty).toFixed(2), qty, market: m, tradeType: "Manual", exitType: "Manual" });
      setPortfolio((p) => p.map((h) => h.sym === sel.sym ? { ...h, qty: h.qty - qty } : h).filter((h) => h.qty > 0));
      setMsg({ t: `Sold ${qty} ${sel.sym} at ${fmt(execPx, m)} — credited to wallet.`, e: false });
    }
    setQty(1);
  };
  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Virtual Trade</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Practice with {fmt(wallet, "IN")} virtual cash. Zero real risk.</div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Instrument</div>
        <select value={sel.sym} onChange={(e) => setSel(ALL.find((a) => a.sym === e.target.value))} style={{ ...selStyle, width: "100%", marginTop: 6, fontSize: 14, padding: 12 }}>
          {ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym} — {a.name}</option>)}
        </select>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 22 }}>{fmt(sel.price, m)}</span><Change v={sel.chg} big />
        </div>

        <div className="pill" style={{ display: "flex", background: "var(--bg)", padding: 4, marginTop: 14 }}>
          {["Buy", "Sell"].map((x) => {
            const disabled = x === "Sell" && !holding;
            return (
              <button key={x} disabled={disabled} onClick={() => !disabled && setSide(x)} className="pill tap disp" title={disabled ? "You can only sell stocks you hold" : ""} style={{ flex: 1, padding: 10, border: "none", fontWeight: 700, fontSize: 13.5, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, background: side === x ? (x === "Buy" ? "var(--up)" : "var(--down)") : "transparent", color: side === x ? "var(--on-primary)" : "var(--muted)" }}>{x}</button>
            );
          })}
        </div>
        {!holding && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Sell is available only for instruments you already hold.</div>}

        {/* order type */}
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginTop: 14 }}>Order type</div>
        <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 6 }}>
          {["Market", "Limit", "Stop-limit", "Trailing-stop"].map((x) => (
            <button key={x} onClick={() => setOrdType(x)} className="pill tap disp" style={{ flex: "0 0 auto", padding: "8px 13px", fontSize: 12, fontWeight: 700, border: "1px solid " + (ordType === x ? "var(--primary)" : "var(--line)"), background: ordType === x ? "var(--primary)" : "var(--surface)", color: ordType === x ? "var(--on-primary)" : "var(--ink)" }}>{x}</button>
          ))}
        </div>
        {needsPx && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{ordType === "Stop-limit" ? "Trigger / limit price" : "Limit price"} ({CUR[m] || "₹"})</div>
            <input value={limitPx} onChange={(e) => setLimitPx(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={String(sel.price)} className="no-ring mono" style={{ width: "100%", marginTop: 4, border: "1px solid var(--line)", borderRadius: 10, padding: 10, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Quantity</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="tap" style={qBtn}>–</button>
            <input value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="no-ring mono" style={{ width: 56, textAlign: "center", border: "1px solid var(--line)", borderRadius: 10, padding: 8, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" }} />
            <button onClick={() => setQty((q) => q + 1)} className="tap" style={qBtn}>+</button>
          </div>
        </div>
        {holding && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>You hold {holding.qty} units @ avg {fmt(holding.buy, m)}</div>}

        {/* risk orders */}
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginTop: 14 }}>Risk orders (optional, %)</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {[["Stop loss", sl, setSl], ["Trailing SL", tsl, setTsl], ["Take profit", tp, setTp]].map(([lbl, val, setter]) => (
            <div key={lbl} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "7px 9px", background: "var(--elev)" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{lbl} %</div>
              <input value={val} onChange={(e) => setter(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="—" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--ink)", fontWeight: 800, fontSize: 14, marginTop: 2 }} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}>
          <span style={{ color: "var(--muted)" }}>Order value</span><span className="mono" style={{ fontWeight: 700 }}>{fmt(cost, m)}</span>
        </div>
        <button onClick={exec} className="tap disp glow" style={{ width: "100%", marginTop: 14, background: side === "Buy" ? "linear-gradient(120deg,var(--up),#0EA968)" : "linear-gradient(120deg,var(--down),#D93A4E)", color: "#fff", border: "none", borderRadius: 14, padding: 14, fontWeight: 800, fontSize: 15 }}>{side} {sel.sym} · {ordType}</button>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: msg.e ? "var(--down)" : "var(--up)", textAlign: "center" }}>{msg.t}</div>}
      </div>
    </div>
  );
}
const qBtn = { width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 18, fontWeight: 700, color: "var(--ink)" };

/* ============================== PORTFOLIO ============================== */

/* Per-holding intelligence: trend, action, confidence and suggested levels.
   Straight from portfolioService — no logic in this component. */
