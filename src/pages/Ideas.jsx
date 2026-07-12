import React, { useEffect, useState } from "react";
import { currentIdeas, resolveIdea } from "../domain/ideas";
import { BACKEND_URL } from "../config";
import { fmt } from "../lib/format";
import { ALL, FNO, marketOf } from "../domain/universe";
import { fetchHistory } from "../domain/api";
import MiniCandles from "../components/charts/MiniCandles";
import { selStyle } from "../components/common/styles";
import BuyButton from "../components/common/BuyButton";

/**
 * Ideas — trade ideas published by Matrix, scored against real candles.
 */

function IdeasDashboard({ ideas }) {
  const [type, setType] = useState("All");
  const [mkt, setMkt] = useState("All");
  const [range, setRange] = useState(365);
  const [cap, setCap] = useState(100000);
  const [symF, setSymF] = useState("All");
  // Outcomes are resolved against REAL candles (async). Until the history lands we
  // show nothing rather than a guess.
  const [outcomes, setOutcomes] = useState({});
  const symsKey = ideas.map((i) => i.sym).join(",");
  useEffect(() => {
    let stop = false;
    if (!BACKEND_URL || !ideas.length) { setOutcomes({}); return; }
    Promise.all(ideas.map((idea) =>
      fetchHistory(idea.sym, "1d")
        .then((c) => [idea.sym, resolveIdea(idea, c)])
        .catch(() => [idea.sym, null])
    )).then((rows) => { if (!stop) setOutcomes(Object.fromEntries(rows)); });
    return () => { stop = true; };
  }, [symsKey]);

  const all = ideas
    .map((id) => ({ id, o: outcomes[id.sym] }))
    .filter(({ id, o }) => o &&
      (type === "All" || o.type === type) &&
      (mkt === "All" || o.mkt === mkt) &&
      (symF === "All" || id.sym === symF) &&
      o.daysAgo <= range);
  const closed = all.filter((r) => r.o.status === "closed"); // realized only
  const openN = all.length - closed.length;
  const n = closed.length;
  const wins = closed.filter((r) => r.o.win).length;
  const losses = n - wins;
  const avg = n ? closed.reduce((a, r) => a + r.o.ret, 0) / n : 0;
  const total = (closed.reduce((a, r) => a * (1 + r.o.ret / 100), 1) - 1) * 100;
  const netPnl = cap * (total / 100);
  const winRate = n ? (wins / n) * 100 : 0;
  const sel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 6px", fontSize: 11.5 };
  const Stat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 88, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "9px 11px" }}>
      <div style={{ fontSize: 9.5, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14.5, marginTop: 2, color: c || "#fff" }}>{v}</div>
    </div>
  );
  return (
    <div className="card glow metal" style={{ marginTop: 14, padding: 16, border: "none", background: "var(--feature-grad)", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Ideas Dashboard</div>
        <span style={{ fontSize: 10.5, opacity: .85 }}>realized · last {range >= 365 ? "12 months" : range + "d"}</span>
      </div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 6 }}>{netPnl >= 0 ? "+" : ""}{fmt(netPnl, "IN")}</div>
      <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>Net realized P&amp;L on {fmt(cap, "IN")} deployed · {openN} still open</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Stat k="Returns %" v={(avg >= 0 ? "+" : "") + avg.toFixed(2) + "%"} c={avg >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        <Stat k="Win rate" v={n ? winRate.toFixed(0) + "%" : "—"} />
        <Stat k="Win / Loss" v={wins + " : " + losses} />
        <Stat k="Trades" v={n} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={sel}><option value="All">Type: All</option><option value="Stock">Stock</option><option value="F&O">F&amp;O</option></select>
        <select value={mkt} onChange={(e) => setMkt(e.target.value)} style={sel}><option value="All">Market: All</option><option value="IN">Indian</option><option value="US">US</option><option value="Crypto">Crypto</option></select>
        <select value={range} onChange={(e) => setRange(+e.target.value)} style={sel}><option value={30}>30d</option><option value={90}>3m</option><option value={180}>6m</option><option value={365}>12m</option></select>
        <select value={cap} onChange={(e) => setCap(+e.target.value)} style={sel}><option value={50000}>Capital: ₹50k</option><option value={100000}>Capital: ₹1L</option><option value={500000}>Capital: ₹5L</option><option value={1000000}>Capital: ₹10L</option></select>
        <select value={symF} onChange={(e) => setSymF(e.target.value)} style={sel}><option value="All">Symbol: All</option>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym}</option>)}</select>
      </div>
    </div>
  );
}

export default function Ideas({ onOpen, onBuy, market = "IN" }) {
  // Recomputed from real data as it arrives, rather than frozen at import time.
  const [ideas, setIdeas] = useState(currentIdeas);
  useEffect(() => {
    const id = setInterval(() => setIdeas(currentIdeas()), 30000);
    return () => clearInterval(id);
  }, []);
  const [open, setOpen] = useState(false);
  const mkt = market === "FNO" ? "IN" : market;
  const shown = market === "FNO" ? [] : ideas.filter((i) => marketOf(i.sym) === mkt);
;
  return (
    <div className="mx fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div><div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Ideas</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{{ IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market]}</div></div>
      </div>

      <IdeasDashboard ideas={shown} />
      {market === "FNO" && <div className="card" style={{ marginTop: 12, padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Ideas aren't available for F&O. Switch to a stock market (Indian / US) to see trade ideas.</div>}
      {market !== "FNO" && shown.length === 0 && <div className="card" style={{ marginTop: 12, padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No ideas for this market yet. Post one, or switch markets from the tabs above.</div>}
      {shown.map((idea, i) => {
        const s = ALL.find((a) => a.sym === idea.sym); const m = marketOf(idea.sym);
        return (
          <div key={i} className="card" style={{ marginTop: 12, padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="pill" style={{ background: "var(--primary-soft)", color: "var(--primary)", fontSize: 11, fontWeight: 700, padding: "3px 9px" }}>✦ Matrix</span>
                <span onClick={() => s && onOpen(s)} className="disp tap" style={{ fontWeight: 700, fontSize: 14 }}>{idea.sym}</span>
              </div>
              <span className="pill disp" style={{ background: "var(--up-soft)", color: "var(--up)", fontWeight: 700, fontSize: 12.5, padding: "4px 11px" }}>+{idea.gain}% potential</span>
            </div>
            <div style={{ marginTop: 10 }}><MiniCandles sym={idea.sym} price={s ? s.price : idea.entry} chg={s ? s.chg : 0} height={120} staticChart defaultTf={m === "Crypto" ? "1h" : "1d"} pattern={idea.pattern} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
              <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Entry</div><div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(idea.entry, m)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Current</div><div className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(s ? s.price : idea.entry, m)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Target</div><div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(idea.exit, m)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "var(--muted)" }}>Potential left</div>{(() => { const cur = s ? s.price : idea.entry; const pl = (idea.exit - cur) / cur * 100; return <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: pl >= 0 ? "var(--up)" : "var(--muted)" }}>{pl >= 0 ? "+" + pl.toFixed(1) + "%" : "target hit"}</div>; })()}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.55 }}>{idea.logic}</div>
            {s && onBuy && (
              <div style={{ marginTop: 12 }}>
                <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth
                  opts={{ tp: idea.gain, sl: idea.stop, tradeType: "Manual" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================== BACKTEST ENGINE ============================== */
