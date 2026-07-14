import Block from "./Block";
import React, { useEffect, useRef, useState } from "react";
import { Activity, Building2, ChevronRight, Newspaper, Plus, X } from "lucide-react";
import { fmt } from "../../lib/format";
import { marketOf } from "../../domain/universe";
import { fetchNews } from "../../domain/api";
import Change from "../../components/common/Change";
import ProChart from "../../components/charts/ProChart";
import VerdictTag from "../../components/common/VerdictTag";

/**
 * Bottom sheet drawer.
 */

export default function Drawer({ s, onClose, onDetails, onBuy }) {
  const startY = useRef(null);
  const [dy, setDy] = useState(0);
  const sheetRef = useRef(null);

  /* The "keep scrolling past the end and it opens the full page" transition is GONE.
     Reading the drawer means scrolling down it — and scrolling down navigated you away
     mid-read, so the sheet appeared to vanish. A scroll gesture should scroll. Opening
     the full page is what the button is for. */

  if (!s) return null;
  const market = marketOf(s.sym);
  /* REAL news. The old code read s.news[0].t — a hardcoded fake headline baked
     onto the instrument. We deleted those arrays, so this crashed on every card
     tap. Now it fetches the actual headline, and simply shows nothing if there
     is none. */
  const [news, setNews] = useState(null);
  useEffect(() => {
    let stop = false;
    setNews(null);
    if (!s?.sym) return undefined;
    fetchNews(s.sym).then((n) => { if (!stop && n && n.length) setNews(n[0]); }).catch(() => {});
    return () => { stop = true; };
  }, [s?.sym]);

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
          maxHeight: "88vh", overflowY: "auto", padding: 18,
          transform: dy > 0 ? `translateY(${dy}px)` : "none",
          transition: dy === 0 ? "transform .22s ease" : "none",
          // the sheet scrolls; it does not navigate
          overscrollBehavior: "contain",
        }}
      >
        <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} style={{ padding: "2px 0 10px", margin: "-2px 0 0", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>{s.sym}</div>
            <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{s.name}</div>
          </div>
          <X size={22} className="tap" onClick={onClose} color="var(--muted)" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 26 }}>{fmt(s.price, market)}</span>
          <Change v={s.chg} big />
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
        <Block title="Technical summary" icon={<Activity size={14} />}>
          {s.rsi == null
            ? "Waiting for live indicators."
            : `RSI ${s.rsi} (${s.rsi > 70 ? "overbought" : s.rsi < 30 ? "oversold" : "neutral"}), price ${s.price > s.sma50 ? "above" : "below"} 50-DMA. Support ${fmt(s.support, market)} · Resistance ${fmt(s.resistance, market)}.`}
        </Block>
        <Block title="Fundamental summary" icon={<Building2 size={14} />}>

        </Block>

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
          <button onClick={() => { if (onBuy) onBuy(s, 1); onClose(); }} className="tap disp glow" style={{ flex: 1, background: "linear-gradient(120deg,var(--up),#12B98A)", color: "#fff", border: "none", borderRadius: 16, padding: "14px", fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={17} /> Buy
          </button>
          <button onClick={() => onDetails(s)} className="tap disp" style={{ flex: 1, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Details <ChevronRight size={17} />
          </button>
        </div>

      </div>
    </div>
  );
}
