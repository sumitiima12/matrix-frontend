import Block from "./Block";
import React, { useEffect, useRef, useState } from "react";
import { Activity, Building2, ChevronRight, Newspaper, Plus, X } from "lucide-react";
import { fmt } from "../../lib/format";
import { marketOf } from "../../domain/universe";
import { fetchNews, fetchFundamentals } from "../../domain/api";
import { techSignal } from "../../domain/signals";
import { technicalRead, fundamentalRead } from "../../domain/analysisFramework";
import Change from "../../components/common/Change";
import ProChart from "../../components/charts/ProChart";
import VerdictTag from "../../components/common/VerdictTag";

/**
 * Bottom sheet drawer.
 */

export default function Drawer({ s, onClose, onDetails, onBuy, canBuy }) {
  const showBuy = !canBuy || canBuy(s.sym);
  const startY = useRef(null);
  const [dy, setDy] = useState(0);
  const sheetRef = useRef(null);

  /* The "keep scrolling past the end and it opens the full page" transition is GONE.
     Reading the drawer means scrolling down it — and scrolling down navigated you away
     mid-read, so the sheet appeared to vanish. A scroll gesture should scroll. Opening
     the full page is what the button is for. */

  /* REAL news. Hooks MUST run before the `if (!s)` early return (Rules of Hooks) — otherwise a
     render where s is null runs fewer hooks than one where it isn't, and React throws. The
     effect is null-safe on s?.sym, so running it unconditionally is harmless. */
  const [news, setNews] = useState(null);
  useEffect(() => {
    let stop = false;
    setNews(null);
    if (!s?.sym) return undefined;
    fetchNews(s.sym).then((n) => { if (!stop && n && n.length) setNews(n[0]); }).catch(() => {});
    return () => { stop = true; };
  }, [s?.sym]);

  // REAL fundamentals (indianapi for NSE/BSE, FMP for US via backend). Crypto has none.
  const [fund, setFund] = useState(null);
  useEffect(() => {
    let stop = false;
    setFund(null);
    if (!s?.sym) return undefined;
    if (marketOf(s.sym) === "Crypto") { setFund({ unavailable: true }); return undefined; }
    fetchFundamentals(s.sym).then((f) => { if (!stop) setFund(f); }).catch(() => { if (!stop) setFund({ unavailable: true }); });
    return () => { stop = true; };
  }, [s?.sym]);

  if (!s) return null;
  const market = marketOf(s.sym);

  const onTS = (e) => { startY.current = e.touches[0].clientY; };
  const onTM = (e) => { if (startY.current == null) return; setDy(Math.max(0, e.touches[0].clientY - startY.current)); };  // down only
  /* Swipe DOWN closes. Swiping UP used to jump to the detail page — which read as
     "scrolling up closed my drawer". Gone; use the button to open details. */
  const onTE = () => { const d = dy; setDy(0); startY.current = null; if (d > 90) onClose && onClose(); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.32)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="sheet card"
        style={{
          width: "100%", maxWidth: 460,
          borderRadius: "24px 24px 0 0",
          maxHeight: "80vh", overflowY: "auto", padding: 18,
          transform: dy > 0 ? `translateY(${dy}px)` : "none",
          transition: dy === 0 ? "transform .22s ease" : "none",
          // the sheet scrolls; it does not navigate
          overscrollBehavior: "contain",
        }}
      >
        <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} style={{ padding: "2px 0 10px", margin: "-2px 0 0", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto" }} />
        </div>
        {/* Symbol + price stay pinned while the sheet scrolls. */}
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--surface)", paddingBottom: 10, marginBottom: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>{s.sym}</div>
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{s.name}</div>
            </div>
            <X size={22} className="tap" onClick={onClose} color="var(--muted)" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 26 }}>{fmt(s.price, market)}</span>
            <Change v={s.chg} big />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>Price action · candles</div>
          <ProChart sym={s.sym} defaultTf={market === "Crypto" ? "1h" : "1d"} height={250} />
        </div>

        {news && (
          <Block title="Key news / event" icon={<Newspaper size={14} />}>
            {news.title}
          </Block>
        )}
        {/* Technical (left) and Fundamental (right), each as bullet points. */}
        {(() => {
          const TONE = { good: "var(--up)", bad: "var(--down)", warn: "var(--amber, #F59E42)", neutral: "var(--ink)" };
          const tr = technicalRead(s, techSignal(s));
          const fr = (market !== "Crypto" && fund && !fund.unavailable) ? fundamentalRead(fund) : null;
          const Bullet = ({ k, v, tone }) => (
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 11, marginBottom: 5, lineHeight: 1.35 }}>
              <span style={{ color: "var(--muted)", flex: "0 0 auto" }}>•</span>
              <span style={{ color: "var(--muted)", flex: "0 0 auto" }}>{k}</span>
              <span className="mono" style={{ fontWeight: 800, color: TONE[tone] || "var(--ink)", marginLeft: "auto" }}>{v}</span>
            </div>
          );
          const Col = ({ title, icon, children }) => (
            <div className="card" style={{ padding: 12, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9, color: "var(--muted)", fontWeight: 800, fontSize: 11.5 }}>{icon}{title}</div>
              {children}
            </div>
          );
          // A compact 0–100 meter (bar + label), like the detail page's gauge.
          const scoreColor = (v) => (v >= 55 ? "var(--up)" : v >= 40 ? "var(--amber, #F59E42)" : "var(--down)");
          const Meter = ({ label, score }) => (
            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)" }}>{label}</span>
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 800, color: scoreColor(score) }}>{score}/100</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: "var(--elev)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(3, Math.min(100, score))}%`, height: "100%", borderRadius: 6, background: scoreColor(score) }} />
              </div>
            </div>
          );
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, alignItems: "stretch" }}>
              <Col title={<>Technicals <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 9.5, letterSpacing: 0.2 }}>· Daily (1D)</span></>} icon={<Activity size={13} />}>
                {tr ? (<>
                    {tr.rows.map((r) => <Bullet key={r.k} k={r.k} v={r.v} tone={r.tone} />)}
                    <Meter label={tr.grade} score={tr.score} />
                  </>) : <div style={{ fontSize: 11, color: "var(--muted)" }}>Waiting for live indicators.</div>}
              </Col>
              <Col title="Fundamentals" icon={<Building2 size={13} />}>
                {market === "Crypto" ? <div style={{ fontSize: 11, color: "var(--muted)" }}>Not applicable to crypto.</div>
                  : fund == null ? <div style={{ fontSize: 11, color: "var(--muted)" }}>Loading…</div>
                  : fund.unavailable ? <div style={{ fontSize: 11, color: "var(--muted)" }}>Not available right now.</div>
                  : fr ? (<>
                      {fr.rows.map((r) => <Bullet key={r.k} k={r.k} v={r.v} tone={r.tone} />)}
                      <Meter label={fr.verdict} score={fr.score} />
                    </>) : <div style={{ fontSize: 11, color: "var(--muted)" }}>—</div>}
              </Col>
            </div>
          );
        })()}

        <div className="card" style={{ marginTop: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Matrix's verdict</div>
            <div className="disp" style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{s.verdict} near {fmt(s.price, market)}</div>
          </div>
          <VerdictTag v={s.verdict} size={15} />
        </div>

        <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "14px 2px 6px", fontWeight: 600 }}>Ask Neo</div>
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto" }}>
          {["Should I buy right now?", "Support & resistance?", "Good time to enter?"].map((q) => (
            <button key={q} onClick={() => onDetails(s)} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12, fontWeight: 600, padding: "7px 12px", color: "var(--ink)" }}>{q}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {showBuy && (
          <button onClick={() => { if (onBuy) onBuy(s, 1); onClose(); }} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--up),#12B98A)", color: "#fff", border: "none", borderRadius: 16, padding: "14px", fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={17} /> Buy
          </button>
          )}
          <button onClick={() => onDetails(s)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Details <ChevronRight size={17} />
          </button>
        </div>

      </div>
    </div>
  );
}
