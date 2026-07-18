import React, { useEffect, useMemo, useState } from "react";
import { currentIdeas } from "../domain/ideas";
import { dailyPicks, techSignal } from "../domain/signals";
import { Building2, ChevronRight, Lightbulb, Newspaper, Pencil, Sparkles, TrendingUp, X, Zap } from "lucide-react";
import { BACKEND_URL } from "../config";
import { CUR, DAY, chgColor, clamp, compact, fmt, lsGet, lsSet, pct, timeAgo } from "../lib/format";
import { ALL, GLOBAL_MKTS, UNIVERSE, marketOf } from "../domain/universe";
import { askMatrix, fetchNews, fetchNewsFeed } from "../domain/api";
import AddBtn from "../components/common/AddBtn";
import BuyButton from "../components/common/BuyButton";
import TagRow from "../components/common/TagRow";
import Change from "../components/common/Change";
import { computeTags } from "../domain/tags";
import DashStat from "../components/common/DashStat";
import ListRow from "../components/cards/ListRow";
import Screener from "./Screener";
import CarouselCard from "../components/cards/CarouselCard";
import MiniCandles from "../components/charts/MiniCandles";
import Pop from "../components/common/Pop";
import Section from "../components/common/Section";

/**
 * Dashboard — the trading desk. Composes the market strips, Matrix's Picks, trending, gainers/losers, news and the auto-buy panel.
 */

/**
 * GlobalStrip — the live global markets ticker.
 *
 * Reads each index/asset's REAL day change from the universe. No hardcoded
 * percentages: an instrument with no live quote yet renders "—".
 */
function GlobalStrip() {
  const rows = GLOBAL_MKTS.map((m) => ({ ...m, c: (ALL.find((a) => a.sym === m.sym) || {}).chg }));
  return (
    <div className="hide-scroll" style={{ display: "flex", gap: 0, overflowX: "auto", marginTop: 10, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)" }}>
      {rows.map((m, i) => (
        <div key={m.sym} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRight: i < rows.length - 1 ? "1px solid var(--line)" : "none" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>{m.n}</span>
          {m.c == null ? (
            <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>—</span>
          ) : (
            <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: m.c >= 0 ? "var(--up)" : "var(--down)" }}>
              {m.c >= 0 ? "▲" : "▼"}{Math.abs(m.c).toFixed(2)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MarketPulseStrip({ market, list, onOpen, liveTick = 0 }) {
  const vixSym = market === "US" ? "VIX" : "INDIAVIX";
  const idxSym = market === "US" ? "SPX" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY50";
  const vix = ALL.find((a) => a.sym === vixSym) || ALL.find((a) => a.sym === "INDIAVIX");
  const idx = ALL.find((a) => a.sym === idxSym) || ALL[0];
  const idxLabel = market === "US" ? "S&P 500" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY 50";
  // It said "VIX" even when showing INDIAVIX. Name the thing we are actually showing.
  const vixLabel = market === "US" ? "VIX" : "INDIA VIX";
  /**
   * HOT STOCKS — what is moving most RIGHT NOW.
   *
   * Two bugs lived here:
   *  1. This useMemo keyed only on [list], but `list` is a stable array whose
   *     objects are mutated in place as quotes arrive. So it ran ONCE at mount,
   *     when every chg was still null, produced [], and froze — which is why the
   *     strip was empty. It now recomputes on liveTick, like Trending does.
   *  2. Indices (SENSEX, FINNIFTY) were being ranked as if they were stocks.
   *
   * Ranking prefers the REAL last-15-minute move from 5-minute candles. When the
   * market is closed those candles are the final 15 minutes of the last session —
   * exactly "what was hot at the close". It falls back to the day change only if
   * no intraday data exists, and shows nothing at all rather than inventing a mover.
   */
  const hot = useMemo(
    () => list
      .filter((s) => !s.isIndex && (s.chg15m != null || s.chg != null))
      .map((s) => ({ s, heat: Math.abs(s.chg15m != null ? s.chg15m : s.chg) }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 8)
      .map((x) => x.s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, liveTick]
  );
  // One symbol at a time, rotating. It used to show two side by side, which made
  // each one cramped and hard to read at a glance.
  const [pi, setPi] = useState(0);
  useEffect(() => {
    if (hot.length < 2) return;
    const t = setInterval(() => setPi((p) => (p + 1) % hot.length), 2600);
    return () => clearInterval(t);
  }, [hot]);
  const shown = hot.length ? [hot[pi % hot.length]] : [];
  const open = (s) => s && onOpen(s);
  return (
    <div className="card" style={{ marginTop: 22, padding: 12, display: "flex", alignItems: "stretch", gap: 10 }}>
      <div onClick={() => open(vix)} className="tap" style={{ flex: "0 0 auto" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{vixLabel}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{vix.price}</span>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: vix.chg >= 0 ? "var(--down)" : "var(--up)" }}>{vix.chg >= 0 ? "+" : ""}{vix.chg}%</span>
        </div>
      </div>
      <div style={{ width: 1, background: "var(--line)" }} />
      <div onClick={() => open(idx)} className="tap" style={{ flex: "0 0 auto" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{idxLabel}</div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: idx.chg >= 0 ? "var(--up)" : "var(--down)" }}>{idx.chg >= 0 ? "▲ +" : "▼ "}{idx.chg}%</div>
      </div>
      <div style={{ width: 1, background: "var(--line)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>🔥 Hot Stocks</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          {shown.map((h, k) => (
            <div key={h.sym + k} onClick={() => open(h)} className="tap fade" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.sym}</span>
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: chgColor(h.chg15m != null ? h.chg15m : h.chg), flex: "0 0 auto" }}>
                {pct(h.chg15m != null ? h.chg15m : h.chg, 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StockIdeasStrip({ onOpen, onBuy, market, liveTick = 0 }) {
  const mkt = market;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => currentIdeas(), [liveTick]);
  const all = ideas.filter((i) => marketOf(i.sym) === mkt);
  /* Ordered by POTENTIAL LEFT, descending: how far the price still has to run to
     the target, measured against the live price. An idea whose target is already
     hit has nothing left to give, so it sinks to the bottom rather than leading.
     Market-strict: if this market has no ideas, show NONE (not other markets'). */
  const top = all
    .map((i) => {
      const st = ALL.find((a) => a.sym === i.sym);
      const cur = st && st.price != null ? st.price : i.entry;
      return { i, left: cur ? ((i.exit - cur) / cur) * 100 : -Infinity };
    })
    .sort((a, b) => b.left - a.left)
    .slice(0, 6)
    .map((x) => x.i);
  return (
    <Section title="Ideas" icon={<Lightbulb size={17} color="var(--primary)" />}>
      {top.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 2px 8px", lineHeight: 1.5 }}>No ideas for this market right now — check back later or switch markets.</div>}
      <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {top.map((idea, i) => {
          const s = ALL.find((a) => a.sym === idea.sym); const m = marketOf(idea.sym);
          const cur = s ? s.price : idea.entry;
          const potLeft = ((idea.exit - cur) / cur) * 100;
          return (
            <div key={i} onClick={() => s && onOpen(s)} className="card tap" style={{ flex: "0 0 auto", width: 236, padding: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{idea.sym}</span>
                <span className="pill" style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 700, padding: "2px 8px" }}>✦ Matrix</span>
              </div>
              <div style={{ marginTop: 8 }}><MiniCandles sym={idea.sym} price={cur} chg={s ? s.chg : 0} height={92} showTf={false} staticChart defaultTf={m === "Crypto" ? "1h" : "1d"} pattern={idea.pattern} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, fontSize: 10.5, gap: 4 }}>
                <div><div style={{ color: "var(--muted)", fontSize: 9 }}>Entry</div><span className="mono" style={{ fontWeight: 700 }}>{fmt(idea.entry, m)}</span></div>
                <div><div style={{ color: "var(--muted)", fontSize: 9 }}>Current</div><span className="mono" style={{ fontWeight: 800 }}>{fmt(cur, m)}</span></div>
                <div><div style={{ color: "var(--muted)", fontSize: 9 }}>Target</div><span className="mono" style={{ fontWeight: 700 }}>{fmt(idea.exit, m)}</span></div>
                <div style={{ textAlign: "right" }}><div style={{ color: "var(--muted)", fontSize: 9 }}>Left</div><span className="mono" style={{ fontWeight: 800, color: potLeft >= 0 ? "var(--up)" : "var(--muted)" }}>{potLeft >= 0 ? "+" + potLeft.toFixed(1) + "%" : "hit"}</span></div>
              </div>
              {/* The shared control. This was the last bespoke buy button left: it
                  silently bought qty 1 with no way to change it. */}
              {s && onBuy && (
                <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                  <BuyButton s={s} market={m} onBuy={onBuy} lot={s.lot || 1} fullWidth
                    opts={{ tp: idea.gain, sl: (idea.entry && idea.stop) ? +(((idea.entry - idea.stop) / idea.entry) * 100).toFixed(2) : undefined, tradeType: "Manual" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function LiveNewsStrip({ symbols = [], onOpen, onBuy, list = [], market = "IN" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState(null);          // Earnings / Dividend / Split / Bulk deal…
  const [readSym, setReadSym] = useState(null);  // symbol whose 7-day news drawer is open
  const key = symbols.join(",");

  /* Was: ONE headline from ONE symbol, six times — and any symbol Yahoo had nothing
     for simply dropped out, which is why the strip usually showed a single stock.
     Now: a real feed across the whole list, newest first, de-duplicated, and tagged by
     event type so you can pull out just the earnings or just the bulk deals. */
  useEffect(() => {
    let stop = false;
    setLoading(true);
    setItems([]);
    if (!BACKEND_URL || !symbols.length) { setLoading(false); return undefined; }

    fetchNewsFeed(symbols.slice(0, 12))
      .then((n) => { if (!stop) { setItems(n); setLoading(false); } })
      .catch(() => { if (!stop) setLoading(false); });

    return () => { stop = true; };
  }, [key]);

  /* Headlines that match none of the event patterns — a product launch, a management
     change, a regulatory note. They were always IN the feed (under "All"), but there was
     no way to isolate them, so they were effectively invisible unless you scrolled past
     everything else. "Others" is that filter. It is a real bucket, not a catch-all label:
     it holds exactly the items the tagger could not classify, and we don't pretend to
     have classified them. */
  const untagged = items.filter((x) => !x.tag).length;
  const tags = [
    ...new Set(items.map((x) => x.tag).filter(Boolean)),
    ...(untagged ? ["Others"] : []),
  ];

  const filtered =
    tag === "Others" ? items.filter((x) => !x.tag)
    : tag ? items.filter((x) => x.tag === tag)
    : items;
  // ONE card per symbol — keep the newest headline for each. Multiple headlines about the
  // same stock (e.g. three EICHERMOT stories) collapsed into three identical-looking cards;
  // the "Read more" carousel already shows every headline for that symbol.
  const shown = (() => { const seen = new Set(); return filtered.filter((n) => { if (!n.sym || seen.has(n.sym)) return false; seen.add(n.sym); return true; }); })();

  const TAG_COLOR = {
    Earnings: "var(--primary)", Dividend: "var(--up)", Split: "#8B5CF6",
    "Bulk deal": "#E8A33D", Buyback: "var(--up)", "M&A": "#EC4899", "Order win": "var(--up)",
    Others: "var(--muted)",
  };

  return (
    <Section title="In the news" icon={<Newspaper size={17} color="#E8A33D" />}>
      {tags.length > 1 && (
        <div className="hide-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className="pill tap disp"
              style={{
                flex: "0 0 auto", padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: "1px solid " + (tag === t ? (TAG_COLOR[t] || "var(--primary)") : "var(--line)"),
                background: tag === t ? (TAG_COLOR[t] || "var(--primary)") : "var(--surface)",
                color: tag === t ? "#fff" : "var(--ink)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 18, color: "var(--muted)", fontSize: 12.5 }}>Loading headlines…</div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ padding: 18, color: "var(--muted)", fontSize: 12.5 }}>
          {BACKEND_URL ? "No recent headlines for these symbols." : "Connect the backend to load real news."}
        </div>
      ) : (
        <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {shown.slice(0, 14).map((n, i) => {
            const s = list.find((a) => a.sym === n.sym);
            return (
              /* Tapping the headline opens the SYMBOL. The card now also carries a Buy
                 control (with quantity) and a "Read more" that opens the 7-day feed. */
              <div
                key={n.sym + i}
                className="card"
                style={{ flex: "0 0 auto", width: 250, padding: 14, display: "flex", flexDirection: "column" }}
              >
                <div
                  onClick={() => s && onOpen(s)}
                  style={{ cursor: s ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                    <span className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>{n.sym}</span>
                    {s && <span className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(s.price, market)}</span>}
                  </div>
                  {s && <div style={{ marginTop: 2 }}><Change v={s.chg} /></div>}

                  {n.tag && (
                    <span
                      className="pill"
                      style={{ display: "inline-block", marginTop: 8, fontSize: 9, fontWeight: 800, padding: "3px 7px", background: "var(--elev)", color: TAG_COLOR[n.tag] || "var(--primary)" }}
                    >
                      {n.tag.toUpperCase()}
                    </span>
                  )}

                  <div style={{ marginTop: 7, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {n.t}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 7 }}>
                    {n.src ? n.src + " · " : ""}{n.d ? timeAgo(n.d) : ""}
                  </div>
                </div>

                {/* Read more ALWAYS opens the 7-day news carousel (never the stock drawer).
                    Generous vertical padding gives a comfortable tap target that doesn't
                    bleed into the headline tap-area above it. */}
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setReadSym(n.sym); }}
                  className="tap disp"
                  style={{ alignSelf: "stretch", marginTop: 6, background: "none", border: "none", padding: "10px 2px", color: "var(--primary)", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  Read more <ChevronRight size={13} />
                </button>

                {s && onBuy && (
                  <div style={{ marginTop: 10 }}>
                    <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {readSym && (
        <NewsReadMore
          sym={readSym}
          stock={list.find((a) => a.sym === readSym)}
          feed={items}
          market={market}
          onOpen={onOpen}
          onBuy={onBuy}
          onClose={() => setReadSym(null)}
        />
      )}
    </Section>
  );
}

/**
 * NewsReadMore — a bottom-sheet drawer that shows every headline for ONE symbol from
 * the last 7 days, newest first, as a swipeable carousel. Sourced from the same real
 * feed the strip already loaded (no invented articles); if the feed has fewer than a
 * week of items for this symbol, it shows exactly what exists.
 */
function NewsReadMore({ sym, stock, feed = [], market = "IN", onOpen, onBuy, onClose }) {
  const [idx, setIdx] = useState(0);
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const articles = feed
    .filter((n) => n.sym === sym && (!n.d || +new Date(n.d) >= cutoff))
    .sort((a, b) => (+new Date(b.d || 0)) - (+new Date(a.d || 0)));
  const cur = articles[idx] || articles[0];
  const many = articles.length > 1;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.42)", zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 460, maxHeight: "80vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 18px 24px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="disp" style={{ fontWeight: 800, fontSize: 18 }}>{sym}</span>
            {stock && <span className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{fmt(stock.price, market)}</span>}
            {stock && <Change v={stock.chg} />}
          </div>
          <button onClick={onClose} aria-label="Close" className="tap" style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginTop: 4 }}>
          {articles.length ? `${articles.length} ${articles.length === 1 ? "story" : "stories"} · last 7 days` : "No stories in the last 7 days"}
        </div>

        {cur && (
          <div style={{ marginTop: 14 }}>
            {cur.tag && (
              <span className="pill" style={{ display: "inline-block", fontSize: 9.5, fontWeight: 800, padding: "3px 8px", background: "var(--elev)", color: "var(--primary)" }}>
                {cur.tag.toUpperCase()}
              </span>
            )}
            <div className="disp" style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.4, marginTop: cur.tag ? 8 : 0 }}>{cur.t}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              {cur.src ? cur.src + " · " : ""}{cur.d ? timeAgo(cur.d) : ""}
            </div>
            {cur.url && (
              <a href={cur.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 10, color: "var(--primary)", fontWeight: 800, fontSize: 12, textDecoration: "none" }}>
                Open full article <ChevronRight size={13} />
              </a>
            )}
          </div>
        )}

        {many && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="tap disp"
              style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1 }}>
              ‹ Prev
            </button>
            <div style={{ display: "flex", gap: 5 }}>
              {articles.map((_, i) => (
                <span key={i} onClick={() => setIdx(i)} style={{ width: 7, height: 7, borderRadius: 99, cursor: "pointer", background: i === idx ? "var(--primary)" : "var(--line)" }} />
              ))}
            </div>
            <button onClick={() => setIdx((i) => Math.min(articles.length - 1, i + 1))} disabled={idx >= articles.length - 1} className="tap disp"
              style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: idx >= articles.length - 1 ? "not-allowed" : "pointer", opacity: idx >= articles.length - 1 ? 0.4 : 1 }}>
              Next ›
            </button>
          </div>
        )}

        {stock && onBuy && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <BuyButton s={stock} market={market} onBuy={onBuy} lot={stock.lot || 1} fullWidth />
          </div>
        )}
        {stock && onOpen && (
          <button onClick={() => { onClose(); onOpen(stock); }} className="tap disp"
            style={{ width: "100%", marginTop: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            View {sym} details
          </button>
        )}
      </div>
    </div>
  );
}

function MarketBrief({ market, list = [] }) {
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(true);
  // Exclude indices (India VIX, Nifty, etc.) — they are not stocks and must not appear
  // as gainers/losers in the market brief.
  const withData = list.filter((s) => s.hasData && s.chg != null && !s.isIndex);
  const key = market + "|" + Math.floor(Date.now() / 3600000) + "|" + withData.length;
  useEffect(() => {
    let stop = false;
    setBusy(true);
    if (!withData.length) { setText(null); setBusy(false); return; }
    const up = withData.filter((s) => s.chg > 0).length;
    const down = withData.filter((s) => s.chg < 0).length;
    const top = [...withData].sort((a, b) => b.chg - a.chg).slice(0, 3);
    const bot = [...withData].sort((a, b) => a.chg - b.chg).slice(0, 3);
    const avg = (withData.reduce((a, s) => a + s.chg, 0) / withData.length).toFixed(2);
    const facts = `Market: ${market}. Advancing ${up}, declining ${down}, average change ${avg}%. Top gainers: ${top.map((s) => `${s.sym} ${s.chg > 0 ? "+" : ""}${s.chg}%`).join(", ")}. Top losers: ${bot.map((s) => `${s.sym} ${s.chg}%`).join(", ")}.`;
    const fallback = `Breadth is ${up > down ? "positive" : up < down ? "negative" : "mixed"} — ${up} advancing vs ${down} declining, average move ${avg}%. Leading: ${top.map((s) => s.sym).join(", ")}. Lagging: ${bot.map((s) => s.sym).join(", ")}.`;
    askMatrix(
      [{ role: "user", content: facts }],
      "You are a market analyst. Using ONLY the real numbers given, write a 2-3 sentence market update: what breadth and the movers imply, and what to watch. Do not invent any figure, company or event not in the data. No preamble, no disclaimer.",
      220
    ).then((out) => { if (!stop) { setText((out || "").trim() || fallback); setBusy(false); } })
     .catch(() => { if (!stop) { setText(fallback); setBusy(false); } });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (busy) return <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--muted)" }}>Reading the tape…</p>;
  if (!text) return <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--muted)" }}>Live market data is still loading.</p>;
  return <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--ink-soft)" }}>{text}</p>;
}

/**
 * TrendingRow — shows WHY something is trending, not just that it is.
 * Every number here comes from real 5-minute candles.
 */
/**
 * TunedStrip — a very slim personalisation strip. The four preferences (style, risk, caps,
 * sectors) rotate through one at a time, like the hot-stocks ticker, so the whole thing
 * stays a single thin line. Its job is a light "this is tuned to you" touch, not a data
 * panel — hence the small type and minimal height.
 */
function TunedStrip({ profile }) {
  const items = React.useMemo(() => {
    if (!profile) return [];
    return [
      ["Style", profile.style],
      ["Risk", profile.risk],
      ["Caps", profile.caps && profile.caps.length ? profile.caps.join(" · ") : "All caps"],
      ["Sectors", profile.sectors && profile.sectors.length ? profile.sectors.join(" · ") : "All sectors"],
    ].filter(([, v]) => v);
  }, [profile]);

  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => setI((p) => (p + 1) % items.length), 2600);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const [label, value] = items[i % items.length];

  return (
    <div className="card metalblack" style={{ marginTop: 14, padding: "7px 12px", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
      <span style={{ fontSize: 8.5, opacity: .5, fontWeight: 700, letterSpacing: ".05em", flex: "0 0 auto" }}>TUNED FOR YOU</span>
      <span style={{ width: 1, height: 11, background: "rgba(255,255,255,.18)", flex: "0 0 auto" }} />
      {/* key on i so each preference fades in as it rotates */}
      <span key={i} className="fade" style={{ fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
        <span style={{ opacity: .55 }}>{label} </span>
        <span style={{ fontWeight: 700 }}>{value}</span>
      </span>
      {/* dot indicators */}
      <span style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>
        {items.map((_, k) => (
          <span key={k} style={{ width: 4, height: 4, borderRadius: 4, background: k === (i % items.length) ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.22)" }} />
        ))}
      </span>
    </div>
  );
}

function TrendingRow({ s, market, onOpen, onBuy, onWhy }) {
  const m5 = s.chg5m, m15 = s.chg15m, surge = s.volSurge;
  const tone = (v) => (v == null ? "var(--muted)" : v >= 0 ? "var(--up)" : "var(--down)");
  const sign = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  return (
    /* Fixed height + column layout so EVERY card lines up: tags reserve their space, "Why?"
       always sits just below them, and the Buy row is pinned to the bottom (marginTop:auto)
       so it's on the same line across cards whether or not they have tags. */
    <div className="card tap" onClick={() => onOpen(s)} style={{ flex: "0 0 auto", width: 210, padding: 13, display: "flex", flexDirection: "column", minHeight: 244 }}>
      {/* symbol left, price top-right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sym}</div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, flex: "0 0 auto" }}>{fmt(s.price, market)}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <div style={{ flex: 1, background: "var(--elev)", borderRadius: 9, padding: "6px 8px" }}>
          <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800 }}>5 MIN</div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: tone(m5) }}>{sign(m5)}</div>
        </div>
        <div style={{ flex: 1, background: "var(--elev)", borderRadius: 9, padding: "6px 8px" }}>
          <div style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 800 }}>15 MIN</div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: tone(m15) }}>{sign(m15)}</div>
        </div>
      </div>

      {surge != null && surge >= 1.5 && (
        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, color: "#E8A33D" }}>
          ⚡ {surge.toFixed(1)}× usual volume
        </div>
      )}

      {/* REAL technical tags (empty when the instrument has no signal yet). */}
      <div style={{ marginTop: 8 }}>
        <TagRow s={s} max={2} />
      </div>

      {/* "Why?" ALWAYS below the tags, on its own line. */}
      {onWhy && (
        <button onClick={(e) => { e.stopPropagation(); onWhy(s, "Trending now — moving on real 5-minute candles"); }} className="tap"
          style={{ alignSelf: "flex-start", marginTop: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 7, padding: "3px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>
          Why?
        </button>
      )}

      {onBuy && (
        <div style={{ marginTop: "auto", paddingTop: 11 }} onClick={(e) => e.stopPropagation()}>
          <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth />
        </div>
      )}
    </div>
  );
}

export default function HomeView({ market, setMarket, segment, setSegment, list, onOpen, onBuy, onAutoBuy, mode, watch, toggleWatch, profile, portfolio = [], realPortfolio = [], onRefreshReal, wallet = 0, onGoPortfolio, autoBuy, setAutoBuy, autoStats, onRecord, watchlists, addToWatch, createWatchlist, trades = [], liveTick = 0, onWhy, autoOnMap: autoOnMapProp, setAutoOnMap: setAutoOnMapProp }) {
  const [glMode, setGlMode] = useState("Gainers");
  // Picks refresh ONCE AN HOUR (not on every tick) so they don't churn.
  const [pickHour, setPickHour] = useState(() => Math.floor(Date.now() / 3600000));
  useEffect(() => {
    const id = setInterval(() => setPickHour(Math.floor(Date.now() / 3600000)), 60000);
    return () => clearInterval(id);
  }, []);
  /* Picks were BLANK for the same reason Hot Stocks was: this useMemo keyed on
     [list], and `list` is a stable array whose objects are mutated in place as
     quotes arrive. It ran once at mount — before any indicator had loaded — got an
     empty array, and froze. It must recompute when data actually arrives. */
  const picks = useMemo(() => {
    /* Ranked by POTENTIAL LEFT to the engine's real target, not by raw signal score:
       a pick that has already run to its target is the least useful one to show first. */
    const base = dailyPicks(list)
      .map((s) => ({
        s,
        left: s.price != null && s.pickTarget != null ? ((s.pickTarget - s.price) / s.price) * 100 : -Infinity,
      }))
      .sort((a, b) => b.left - a.left)
      .map((x) => x.s)
      .slice(0, 8);
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, market, pickHour, liveTick]);
  /**
   * TRENDING NOW — what is moving RIGHT NOW.
   *
   * This used to rank on relative volume + the DAY change, which is not trending:
   * a stock up 4% since the open but flat for the last hour is not moving now.
   *
   * It now ranks on real 5-minute candle data from /api/intraday:
   *   - change over the last 5 minutes   (weighted highest — most immediate)
   *   - change over the last 15 minutes  (confirms it is a move, not a tick)
   *   - volume surge vs this session's own average 5-min volume
   *
   * An instrument with no intraday data is EXCLUDED rather than scored as zero:
   * we would rather show four movers than six with two invented.
   */
  const trending = useMemo(() => [...list]
    .filter((s) => !s.isIndex && (s.chg5m != null || s.chg15m != null))
    .map((s) => {
      const m5 = s.chg5m ?? 0;
      const m15 = s.chg15m ?? 0;
      const surge = s.volSurge ?? 1;
      // Momentum, confirmed by the 15-min move and amplified by a volume surge.
      const score = (Math.abs(m5) * 2 + Math.abs(m15)) * Math.max(1, surge);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.s), [list, liveTick]);
  // Indices (Nifty, Bank Nifty, India VIX...) are not tradeable stocks and must
  // never appear in gainers/losers or trending. Flagged explicitly on the
  // instrument rather than guessed at from its name.
  const glList = list.filter((s) => !s.isIndex && s.chg != null);
  const gainers = [...glList].sort((a, b) => b.chg - a.chg).slice(0, 5);
  const losers = [...glList].sort((a, b) => a.chg - b.chg).slice(0, 5);
  /* We have NO volume in the quote feed, so this cannot be "the most liquid names" —
     it is simply the first twelve of the current market list. It used to .sort() by
     s.vol, which was always undefined: the comparator did nothing and the result only
     LOOKED ranked. An ordering that pretends to mean something is worse than an
     obvious one that doesn't. */
  const inNews = list.slice(0, 12);
  const smart = list.filter((s) => s.inst);
  const trendingView = trending;

  // portfolio dashboard math — PER MODE and PER MARKET.
  // In REAL mode the Total reflects your actual broker positions for the selected market;
  // in VIRTUAL mode it reflects your paper holdings. Each market is isolated, so switching
  // the market at the top changes the figure (US shows only US, Crypto only Crypto, etc.).
  const isReal = mode === "real";
  // Real-mode money shown to ONE decimal (a Delta cash balance like $162.20473968 is noise).
  const money1 = (v) => ((market === "Crypto" || market === "US") ? "$" : "₹") + Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const inMarket = (sym, m) => (m || marketOf(sym) || "IN") === market;
  // Real broker holdings arrive as an OBJECT { holdings:[...], cash } — not an array — with
  // each holding shaped { sym, qty, avg, value, pnl }. Normalise to the paper-holding shape
  // (buy = avg cost, price = current unit value) so the same math works for both modes.
  const realHoldings = (realPortfolio && Array.isArray(realPortfolio.holdings)) ? realPortfolio.holdings : (Array.isArray(realPortfolio) ? realPortfolio : []);
  const holds = isReal
    ? realHoldings
        .filter((h) => inMarket(h.sym, h.market) && h.qty)
        .map((h) => ({
          sym: h.sym, qty: h.qty,
          buy: (h.avg != null ? h.avg : (h.value != null && h.qty ? h.value / h.qty : 0)),
          price: (h.value != null && h.qty ? h.value / h.qty : (h.price != null ? h.price : null)),
          date: h.entryAt || (Date.now() - 30 * 864e5),
        }))
    : (portfolio || []).filter((h) => inMarket(h.sym, h.market));
  // Refresh real positions when entering real mode / switching market, so the figure isn't stale.
  useEffect(() => { if (isReal && onRefreshReal) onRefreshReal(); /* eslint-disable-next-line */ }, [isReal, market]);
  const dash = holds.reduce((a, h) => {
    const cur = h.price != null ? h.price : (ALL.find((x) => x.sym === h.sym) || { price: h.buy }).price;
    const days = Math.max(1, Math.round((Date.now() - h.date) / 86400000));
    a.val += cur * h.qty; a.inv += h.buy * h.qty;
    a.annNum += (Math.pow(cur / h.buy, 365 / days) - 1) * (h.buy * h.qty);
    return a;
  }, { val: 0, inv: 0, annNum: 0 });
  // Net returns = unrealised P&L on the holdings CURRENTLY shown. If current value is ₹0
  // (no open holdings), returns are ₹0 too — we no longer bolt lifetime realised paper P&L
  // onto this card (that was why "value ₹0" could sit next to "+₹29,037"). Realised auto-buy
  // performance still has its own home in the Smart Auto-Buy tab.
  const unrealised = dash.val - dash.inv;
  const net = unrealised;
  const retPct = dash.inv ? (net / dash.inv) * 100 : 0;
  const annPct = dash.inv ? (dash.annNum / dash.inv) * 100 : 0;

  // Auto-Buy Matrix's picks — for the market selected at the top; each market keeps its own on/off.
  // The on/off map is LIFTED to the app (persisted server-side) when provided, so it survives reloads.
  const [dashView, setDashView] = useState("total");
  const [autoOnMapLocal, setAutoOnMapLocal] = useState({ IN: false, US: false, Crypto: false, Commodity: false, FNO: false });
  const autoOnMap = autoOnMapProp || autoOnMapLocal;
  const setAutoOnMap = setAutoOnMapProp || setAutoOnMapLocal;
  /* Capital-to-deploy is PER MARKET and persisted, so it survives logout/login and each
     market keeps its own (a $ amount for US/Crypto, ₹ for Indian). */
  const [deployCapMap, setDeployCapMap] = useState(() => { const v = lsGet("mx_deploy_capital", {}); return (v && typeof v === "object") ? v : {}; });
  const capDefault = (m) => (m === "US" || m === "Crypto") ? "1000" : "100000";
  const deployCapital = deployCapMap[market] != null ? deployCapMap[market] : capDefault(market);
  const setDeployCapital = (v) => { setDeployCapMap((prev) => { const next = { ...prev, [market]: v }; lsSet("mx_deploy_capital", next); return next; }); };
  /* An explicit Save: you type into a draft, then tap Save to commit (and persist) it. The
     "Capital" figure only updates on Save, so it's clear what's applied vs being typed. */
  const [capDraft, setCapDraft] = useState(deployCapital);
  const [capSaved, setCapSaved] = useState(false);
  useEffect(() => { setCapDraft(deployCapMap[market] != null ? deployCapMap[market] : capDefault(market)); /* eslint-disable-next-line */ }, [market]);
  const [plPeriod, setPlPeriod] = useState("today");
  /* Product type — PER MARKET, persisted. "Intraday" = auto-square-off (MIS/INTRADAY);
     "NRML" = carry-forward / delivery (CNC on equity). Only meaningful for Indian markets;
     crypto/US ignore it. Default to NRML so positions aren't force-closed at 3:20pm. */
  const [prodMap, setProdMap] = useState(() => { const v = lsGet("mx_autobuy_product", {}); return (v && typeof v === "object") ? v : {}; });
  const product = prodMap[market] || "NRML";                       // "NRML" | "INTRADAY"
  const setProduct = (v) => setProdMap((prev) => { const next = { ...prev, [market]: v }; lsSet("mx_autobuy_product", next); return next; });
  const prodCode = product === "INTRADAY" ? "MIS" : "CNC";         // what the broker order body expects
  const showProduct = market === "IN" || market === "FNO";         // concept only applies to Indian equity/F&O
  const [autoOverrides, setAutoOverrides] = useState({});   // sym -> {tp, sl}
  const [editSym, setEditSym] = useState(null);
  const [showTrades, setShowTrades] = useState(false);
  const MKT_LABEL = { IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", Commodity: "🪙 Commodity", FNO: "⚡ F&O" };
  const autoOn = !!autoOnMap[market];                       // on/off for the currently selected market
  // Minimum is small for $-markets (US/Crypto) so you can deploy e.g. $100; ₹ markets keep a higher floor.
  const capMin = (market === "US" || market === "Crypto") ? 10 : 1000;
  const capNum = Math.max(capMin, parseInt(deployCapital) || Number(capDefault(market)));
  const aggCur = market;          // currency of the selected market
  const dayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const mkTime = (addMin) => { const base = 9 * 60 + 15 + addMin; const h = Math.floor(base / 60), mm = base % 60; return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; };
  const autoTargets = (s) => {
    const t = techSignal(s);
    let tp = clamp(((s.resistance - s.price) / s.price) * 100, 0.8, 6);
    let sl = clamp(((s.price - s.support) / s.price) * 100, 0.3, 3);
    if (t.pattern === "breakout") tp = clamp(tp * 1.3 + 1, 1.5, 8);
    else if (t.pattern === "flag") tp = clamp(tp + 0.6, 1.2, 6.5);
    else if (t.pattern === "doubleBottom" || t.pattern === "cup") tp = clamp(tp + 0.4, 1.5, 7);
    if (marketOf(s.sym) === "Crypto") { tp = clamp(tp * 2, 2, 16); sl = clamp(sl * 1.6, 1, 9); }
    return { tp: +tp.toFixed(1), sl: +sl.toFixed(1) };
  };
  const autoPicks = useMemo(() => dailyPicks(UNIVERSE[market]).slice(0, 6), [market]);
  const perCap = capNum / Math.max(1, autoPicks.length);
  const autoTrades = autoPicks.map((s) => {
    const m = marketOf(s.sym);
    const auto = autoTargets(s);
    const ov = autoOverrides[s.sym];
    const tpPct = ov ? ov.tp : auto.tp;
    const slPct = ov ? ov.sl : auto.sl;
    const entry = s.price;
    // Crypto sizes by AMOUNT (fractional units); stocks by whole shares.
    const qty = m === "Crypto" ? +(perCap / entry).toFixed(6) : Math.max(1, Math.floor(perCap / entry));
    const dp = entry < 1 ? 6 : entry < 10 ? 4 : 2;
    return { sym: s.sym, m, qty, entry, tpPct, slPct, auto };   // planned entry; the exit engine closes it at real prices
  }).filter(Boolean);   // F&O names with no real lot size are dropped, not guessed
  // When Auto-Buy is ON, actually place today's picks as REAL positions (once per
  // day per market) with their target/stop attached. The exit engine then closes
  // them at real market prices — no simulated win/loss.
  useEffect(() => {
    if (!autoOn || !onBuy || !BACKEND_URL) return;
    // Don't consume the once-per-day guard before the picks have actually loaded — otherwise
    // toggling ON early (while UNIVERSE prices are still null → autoTrades empty) marks the day
    // "done" and buys nothing, leaving 0 positions until tomorrow. Wait for real picks first.
    if (!autoTrades.length) return;
    const key = `mx_autobuy_${market}_${DAY}`;
    if (lsGet(key, false)) return;
    autoTrades.forEach((t) => {
      const u = ALL.find((a) => a.sym === (t.under || t.sym));
      if (!u) return;
      // F&O: buy the futures contract (priced off the underlying, qty = 1 lot).
      const inst = u;   // no futures: auto-buy trades the stock itself
      (onAutoBuy || onBuy)(inst, t.qty, { tp: t.tpPct, sl: t.slPct, tradeType: "Auto Buy", product: prodCode });
    });
    lsSet(key, true);
  }, [autoOn, market]);
  const setOv = (t, field, val) => setAutoOverrides((o) => { const cur = o[t.sym] || { tp: t.tpPct, sl: t.slPct }; return { ...o, [t.sym]: { ...cur, [field]: val === "" ? cur[field] : +val } }; });
  // period stats (shown regardless of on/off)
  const bizDaysThisMonth = () => { const now = new Date(); let c = 0; for (let d = 1; d <= now.getDate(); d++) { const wd = new Date(now.getFullYear(), now.getMonth(), d).getDay(); if (wd >= 1 && wd <= 5) c++; } return c; };
  // REAL stats: every number below comes from actual recorded Auto-Buy trades.
  // Closed trades contribute realised P&L; open ones contribute live unrealised P&L.
  const periodFrom = useMemo(() => {
    const d = new Date();
    if (plPeriod === "today") { d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (plPeriod === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
    return 0;                                       // lifetime
  }, [plPeriod]);
  const autoRows = useMemo(() => (trades || [])
    .filter((t) => (t.tradeType === "Auto Buy") && ((t.market || marketOf(t.sym) || "IN")) === market && (t.entryAt || 0) >= periodFrom)
    .map((t) => {
      const rejected = t.status === "rejected";
      const open = !rejected && t.exitAt == null;
      const cur = open ? ((ALL.find((a) => a.sym === t.sym) || {}).price ?? t.entry) : t.exit;
      // A rejected order never executed — no entry, no P&L. Only filled/partial rows carry P&L.
      const realPnl = rejected || t.entry == null ? 0 : +(((cur - t.entry) * (t.qty || 1))).toFixed(2);
      return { ...t, rejected, open, cur, realPnl };
    }), [trades, market, periodFrom]);
  const closedRows = autoRows.filter((t) => !t.open && !t.rejected);
  // Stats exclude rejects — they aren't trades, they're failed attempts (shown separately).
  const filledRows = autoRows.filter((t) => !t.rejected);
  const periodStats = { pnl: filledRows.reduce((a, t) => a + t.realPnl, 0), trades: filledRows.length, wins: closedRows.filter((t) => t.realPnl > 0).length };
  const autoPnl = periodStats.pnl;
  const autoWinRate = closedRows.length ? closedRows.filter((t) => t.realPnl > 0).length / closedRows.length * 100 : 0;
  const periodLabel = plPeriod === "today" ? "today" : plPeriod === "month" ? "this month" : "last 12 months";

  return (
    <div className="home-metal">
      {/* Global markets live strip */}
      <GlobalStrip />

      <TunedStrip profile={profile} />

      {/* Portfolio / Auto-Buy dashboard card */}
      <div className="card glow metalblack" style={{ marginTop: 14, padding: 16, border: "none", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative" }}>
          {/* slider */}
          <div className="pill" style={{ display: "inline-flex", background: "rgba(0,0,0,.28)", padding: 3, marginBottom: 14 }}>
            {[["total", "Total"], ["auto", "Smart Auto-Buy"]].map(([k, l]) => (
              <button key={k} onClick={() => setDashView(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: dashView === k ? "#fff" : "transparent", color: dashView === k ? "#141416" : "rgba(255,255,255,.8)" }}>{l}</button>
            ))}
          </div>

          {dashView === "total" ? (
            <div onClick={onGoPortfolio} className="tap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: .85 }}>{isReal ? "Real" : "Virtual"} · {MKT_LABEL[market]} · current value</span>
                <span className="pill" style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.16)", padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>My Portfolio <ChevronRight size={13} /></span>
              </div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 27, marginTop: 2 }}>{isReal ? money1(dash.val) : fmt(dash.val, market)}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <DashStat k="Returns %" v={(retPct >= 0 ? "+" : "") + retPct.toFixed(1) + "%"} pos={retPct >= 0} />
                <DashStat k="Net returns" v={(net >= 0 ? "+" : "") + (isReal ? money1(net) : fmt(net, market))} pos={net >= 0} />
              </div>
              {portfolio.length === 0 && <div style={{ fontSize: 11.5, opacity: .8, marginTop: 10 }}>No holdings yet — buy your first stock in Virtual Trade.</div>}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, opacity: .85 }}>Smart Auto-Buy · {MKT_LABEL[market]}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="pill" style={{ display: "inline-flex", background: "rgba(0,0,0,.28)", padding: 2 }}>
                    {[["today", "Today"], ["month", "Month"], ["lifetime", "Lifetime"]].map(([k, l]) => (
                      <button key={k} onClick={() => setPlPeriod(k)} className="pill tap disp" style={{ padding: "5px 10px", fontSize: 10, fontWeight: 800, border: "none", background: plPeriod === k ? "#fff" : "transparent", color: plPeriod === k ? "#141416" : "rgba(255,255,255,.8)" }}>{l}</button>
                    ))}
                  </div>
                  <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    {autoOn ? "On" : "Off"}
                    <span onClick={() => {
                      const turningOn = !autoOn;
                      if (turningOn && mode === "real" && !lsGet("mx_autobuy_warned", false)) {
                        const ok = typeof window === "undefined" || window.confirm(
                          "Smart Auto-Buy will place REAL orders on its own, without asking you each time. It will also auto-sell when your stop-loss or target is hit. Turn it on?"
                        );
                        if (!ok) return;
                        lsSet("mx_autobuy_warned", true);
                      }
                      setAutoOnMap((m) => ({ ...m, [market]: !m[market] }));
                    }} style={{ width: 38, height: 22, borderRadius: 999, background: autoOn ? "#22C55E" : "rgba(255,255,255,.3)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
                    </span>
                  </label>
                </div>
              </div>
              {showProduct && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 10.5, opacity: .8, fontWeight: 700 }}>Product</span>
                  <div className="pill" style={{ display: "inline-flex", background: "rgba(0,0,0,.28)", padding: 2 }}>
                    {[["INTRADAY", "Intraday"], ["NRML", "NRML"]].map(([k, l]) => (
                      <button key={k} onClick={() => setProduct(k)} className="pill tap disp" style={{ padding: "5px 12px", fontSize: 10.5, fontWeight: 800, border: "none", background: product === k ? "#fff" : "transparent", color: product === k ? "#141416" : "rgba(255,255,255,.8)" }}>{l}</button>
                    ))}
                  </div>
                  <span style={{ fontSize: 9.5, opacity: .6 }}>{product === "INTRADAY" ? "auto-squared off same day" : "carried forward"}</span>
                </div>
              )}
              <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>P&amp;L · {periodLabel} {autoOn ? "· live positions (real exits)" : "· simulated preview"}</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 27, marginTop: 3, color: autoPnl >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{(autoPnl >= 0 ? "+" : "") + fmt(autoPnl, aggCur)}</div>
              <div style={{ fontSize: 11, opacity: .85 }}>{`${periodStats.trades} trades · ${autoWinRate.toFixed(0)}% win rate · ${CUR[aggCur]}${(capNum / 1000).toFixed(0)}k capital`}</div>

              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <DashStat k="Trades" v={periodStats.trades} pos={true} />
                <DashStat k="Win rate" v={autoWinRate.toFixed(0) + "%"} pos={autoWinRate >= 50} />
                <DashStat k="Capital" v={fmt(capNum, aggCur)} pos={true} />
              </div>

              {/* capital — type then Save */}
              <div style={{ marginTop: 12, background: "rgba(0,0,0,.25)", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, opacity: .8, fontWeight: 700 }}>CAPITAL TO DEPLOY ({CUR[aggCur]})</div>
                  <input value={capDraft} onChange={(e) => { setCapDraft(e.target.value.replace(/[^0-9]/g, "")); setCapSaved(false); }} inputMode="numeric" placeholder={capDefault(market)} className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 17, fontWeight: 800, marginTop: 2 }} />
                </div>
                <button
                  onClick={() => { setDeployCapital(capDraft); setCapSaved(true); setTimeout(() => setCapSaved(false), 2500); }}
                  disabled={capDraft === deployCapital}
                  className="tap disp"
                  style={{ flex: "0 0 auto", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 800, fontSize: 12.5, background: capDraft === deployCapital ? "rgba(255,255,255,.15)" : "#fff", color: capDraft === deployCapital ? "rgba(255,255,255,.6)" : "#141416" }}
                >
                  {capSaved ? "Saved ✓" : "Save"}
                </button>
              </div>

              {/* Positions — REAL. Planned entries when Auto-Buy is off; live/closed
                  positions (with real P&L) once it is on. Nothing is simulated. */}
              <button onClick={() => setShowTrades((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.22)", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {showTrades ? "Hide positions" : (autoOn ? `Show Positions (${autoRows.length})` : `Show Today's Plan (${autoTrades.length})`)}<ChevronRight size={15} style={{ transform: showTrades ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }} />
              </button>

              {showTrades && (autoOn ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {autoRows.length === 0 && <div style={{ fontSize: 11.5, opacity: .82, lineHeight: 1.6 }}>No auto-buy positions in this period yet. Positions are placed at real market prices and closed by the exit engine when a target or stop is actually hit.</div>}
                  {autoRows.map((t) => {
                    const cyc = (t.market || marketOf(t.sym) || "IN");
                    const statusLabel = t.rejected ? "REJECTED" : t.status === "partial" ? "◑ PARTIAL" : t.open ? "● OPEN" : (t.exitType || "CLOSED");
                    const statusColor = t.rejected ? "#FFB3BE" : t.status === "partial" ? "#FFD27A" : undefined;
                    return (
                    <div key={t.id} style={{ background: t.rejected ? "rgba(232,72,85,.12)" : "rgba(0,0,0,.22)", borderRadius: 12, padding: "10px 12px", border: t.rejected ? "1px solid rgba(232,72,85,.4)" : "none" }}>
                      <div onClick={() => { const st = ALL.find((a) => a.sym === t.sym); st && onOpen(st); }} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{t.sym} <span style={{ fontSize: 10, opacity: .7, fontWeight: 600 }}>×{t.qty}</span></span>
                        <span style={{ fontSize: 9.5, opacity: .9, fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                        {!t.rejected && <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: t.realPnl >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{t.realPnl >= 0 ? "+" : ""}{fmt(t.realPnl, cyc)}</span>}
                      </div>
                      {t.rejected ? (
                        <div style={{ marginTop: 6, fontSize: 10.5, color: "#FFC2C9", lineHeight: 1.45 }}>
                          Order not placed{t.rejectReason ? ` — ${t.rejectReason}` : "."} {t.entryAt ? "· " + new Date(t.entryAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10, opacity: .82 }}>
                            <div><div style={{ opacity: .7 }}>Entry</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(t.entry, cyc)}</div><div style={{ opacity: .7 }}>{t.entryAt ? new Date(t.entryAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div></div>
                            <div style={{ textAlign: "right" }}><div style={{ opacity: .7 }}>{t.open ? "Current" : "Exit"}</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(t.cur, cyc)}</div><div style={{ opacity: .7 }}>{t.open ? "position open" : (t.exitAt ? new Date(t.exitAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")}</div></div>
                          </div>
                          {(t.tp || t.sl) && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.12)", fontSize: 10.5, fontWeight: 700 }}>🎯 Target <span style={{ color: "#9CFFD6" }}>+{t.tp}%</span> · 🛑 Stop <span style={{ color: "#FFB3BE" }}>−{t.sl}%</span></div>}
                        </>
                      )}
                    </div>
                  ); })}
                </div>
              ) : (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11, opacity: .8, lineHeight: 1.5 }}>Today's plan — these are the positions Smart Auto-Buy would enter at the live price, with the target/stop it would arm. Turn it on to place them for real.</div>
                  {autoTrades.map((t) => (
                    <div key={t.sym} style={{ background: "rgba(0,0,0,.22)", borderRadius: 12, padding: "10px 12px" }}>
                      <div onClick={() => { const st = ALL.find((a) => a.sym === t.sym); st && onOpen(st); }} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{t.sym} <span style={{ fontSize: 10, opacity: .7, fontWeight: 600 }}>×{t.qty}</span></span>
                        <span className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(t.entry, t.m)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.12)" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700 }}>🎯 Target <span style={{ color: "#9CFFD6" }}>+{t.tpPct}%</span> · 🛑 Stop <span style={{ color: "#FFB3BE" }}>−{t.slPct}%</span>{autoOverrides[t.sym] ? " · edited" : ""}</span>
                        <button onClick={() => setEditSym(editSym === t.sym ? null : t.sym)} className="tap" style={{ border: "none", background: "rgba(255,255,255,.14)", borderRadius: 8, padding: 6, display: "grid", placeItems: "center", color: "#fff" }}><Pencil size={12} /></button>
                      </div>
                      {editSym === t.sym && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 10, padding: "6px 9px" }}>
                            <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>TARGET %</div>
                            <input defaultValue={t.tpPct} onChange={(e) => setOv(t, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 800 }} />
                          </div>
                          <div style={{ flex: 1, background: "rgba(0,0,0,.3)", borderRadius: 10, padding: "6px 9px" }}>
                            <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>STOP %</div>
                            <input defaultValue={t.slPct} onChange={(e) => setOv(t, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 800 }} />
                          </div>
                          <button onClick={() => setEditSym(null)} className="tap disp" style={{ alignSelf: "stretch", border: "none", background: "#fff", color: "#141416", borderRadius: 10, padding: "0 14px", fontWeight: 800, fontSize: 12 }}>Done</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Matrix picks */}
      <Section title="Top Picks" icon={<Sparkles size={17} color="var(--primary-2)" />}>
        {/* An empty carousel is a void the user has to interpret. Say what's happening:
            picks need real indicators (RSI, 50-DMA), and those arrive after the prices. */}
        {picks.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 2px 8px", lineHeight: 1.5 }}>
            {list.some((s) => s.rsi != null)
              ? "No stock currently clears the signal bar in this market."
              : "Waiting on real indicators — picks are ranked on RSI and the 50-DMA, so they appear once the data lands."}
          </div>
        )}
        <div className="hide-scroll" style={{ display: "flex", alignItems: "stretch", gap: 13, overflowX: "auto", paddingBottom: 8, paddingTop: 2 }}>
          {picks.map((s) => (
            /* Uniform light-grey cards with the homepage metallic edges. */
            <div key={s.sym} onClick={() => onOpen(s)} className="card tap glow pickcard" style={{ flex: "0 0 auto", width: 272, padding: 0, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 17, position: "relative", color: "var(--ink)", display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>💎</span>
                  <div style={{ minWidth: 0 }}><div className="disp" style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sym}</div><div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div></div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 19 }}>{fmt(s.price, market)}</span>
                  <span style={{ fontSize: 10.5, color: s.chg == null ? "var(--muted)" : s.chg >= 0 ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{s.chg == null ? "—" : (s.chg >= 0 ? "▲ " : "▼ ") + pct(s.chg, 2, false)}</span>{s.isFut ? <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{` · lot ${s.lot}`}</span> : null}
                </div>
                {/* REAL technical tags from the tag engine — Golden Cross, Bull Flag,
                    Breakout, Volume Spike and so on, each true and each backed by a
                    number. "Why?" opens the full evidence + verdict. */}
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center", overflow: "hidden" }}>
                  {computeTags(s.under ? { ...s, sym: s.under } : s).slice(0, 3).map((t) => (
                    <span key={t.id} className="pill" title={t.evidence}
                      style={{ fontSize: 10, fontWeight: 800, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 9px", whiteSpace: "nowrap", flex: "0 0 auto" }}>
                      {t.label}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-soft, var(--ink))", lineHeight: 1.5, display: "flex", gap: 6 }}>
                  <Sparkles size={14} color="var(--primary)" style={{ flex: "0 0 auto", marginTop: 2 }} /><span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.pickReason || ""}</span>
                </div>
                {/* REAL stop / target from support-resistance + ATR */}
                {s.pickTarget != null && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>TARGET</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--up)" }}>{fmt(s.pickTarget, market)} <span style={{ fontSize: 9, opacity: .85 }}>+{s.pickTpPct}%</span></div>
                    </div>
                    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>STOP</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--down)" }}>{fmt(s.pickStop, market)} <span style={{ fontSize: 9, opacity: .85 }}>−{s.pickSlPct}%</span></div>
                    </div>
                    {s.pickRR != null && <div style={{ flex: "0 0 auto", background: "var(--elev)", borderRadius: 10, padding: "7px 9px", display: "grid", placeItems: "center" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>R:R</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5 }}>{s.pickRR}</div>
                    </div>}
                  </div>
                )}
                {/* Buy with explicit quantity; the pick's REAL stop & target are armed with it. */}
                <div style={{ marginTop: "auto", paddingTop: 13 }} onClick={(e) => e.stopPropagation()}>
                  <BuyButton
                    s={s}
                    market={market}
                    onBuy={onBuy}
                    opts={{ tp: s.pickTpPct, sl: s.pickSlPct, tradeType: "Manual" }}
                    variant="solid"
                    fullWidth
                  />
                </div>
                {onWhy && (
                  <div style={{ marginTop: 14, display: "flex" }}>
                    <button onClick={(e) => { e.stopPropagation(); onWhy(s, "Matrix's Pick for today"); }} className="tap disp"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "var(--elev)", color: "var(--muted)", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      <Sparkles size={12} color="var(--primary)" /> Why this pick?
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Market updates summary */}
      <Pop style={{ marginTop: 22 }}>
        <div className="card" style={{ padding: 15 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Newspaper size={15} color="var(--primary)" /> Market updates</div>
          <MarketBrief market={market} list={list} />
        </div>
      </Pop>

      {/* Ideas carousel (not for F&O or Commodity) */}
      {market !== "Commodity" && <StockIdeasStrip onOpen={onOpen} onBuy={onBuy} market={market} liveTick={liveTick} />}

      {/* F&O Picks (Indian derivatives) */}

      {/* Market pulse strip — not for Commodity */}
      {market !== "Commodity" && <MarketPulseStrip market={market} list={list} onOpen={onOpen} liveTick={liveTick} />}

      {/* Trending — not for Commodity; F&O shows ATM options */}
      {market !== "Commodity" && (
        <Section title="Trending now" icon={<TrendingUp size={17} color="#0FB97D" />}>
          <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {trendingView.length
              ? trendingView.map((s) => (
                  <TrendingRow key={s.sym} s={s} market={market} onOpen={onOpen} onBuy={onBuy} onWhy={onWhy} />
                ))
              : (
                <div style={{ padding: "14px 2px", fontSize: 12, color: "var(--muted)" }}>
                  No intraday moves yet — trending needs live 5-minute candles, which arrive while the market is open.
                </div>
              )}
          </div>
        </Section>
      )}

      {/* Screener — not for F&O or Commodity */}
      {market !== "Commodity" && (
        <Pop style={{ marginTop: 40 }}>
          <Screener onOpen={onOpen} market={market} list={list} watchlists={watchlists} addToWatch={addToWatch} createWatchlist={createWatchlist} />
        </Pop>
      )}

      {/* Gainers / Losers — not for F&O or Commodity */}
      {market !== "Commodity" && (
        <Section title="Top gainers & losers" icon={<Zap size={17} color="#E8A33D" />}
          right={
            <div className="pill" style={{ display: "flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3 }}>
              {["Gainers", "Losers"].map((m) => (
                <button key={m} onClick={() => setGlMode(m)} className="pill tap disp" style={{ padding: "5px 13px", fontSize: 11.5, fontWeight: 700, border: "none", background: glMode === m ? (m === "Gainers" ? "var(--up)" : "var(--down)") : "transparent", color: glMode === m ? "var(--on-primary)" : "var(--muted)" }}>{m}</button>
              ))}
            </div>
          }>
          <div className="card" style={{ padding: "4px 14px" }}>
            {(glMode === "Gainers" ? gainers : losers).map((s) => <ListRow key={s.sym} s={s} market={market} onOpen={onOpen} />)}
          </div>
        </Section>
      )}


      {/* In the news — REAL headlines fetched live (not for F&O) */}
      {<LiveNewsStrip symbols={inNews.map((s) => s.sym)} onOpen={onOpen} onBuy={onBuy} list={list} market={market} />}

      {/* Smart money — REAL institutional holders from Yahoo (quoteSummary).
          Hidden entirely when no holder data is available: no invented names. */}
      {market !== "Commodity" && smart.length > 0 && (
        <Section title="Smart Money picks" icon={<Building2 size={17} color="var(--primary)" />}>
          <div className="hide-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {smart.map((s) => (
              <CarouselCard key={s.sym} s={s} market={market} onOpen={onOpen} onBuy={onBuy} width={260}>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                  {s.inst.slice(0, 3).map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", borderRadius: 12, padding: "9px 11px", gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.n}</span>
                      <span style={{ flex: "0 0 auto", textAlign: "right" }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 800, display: "block" }}>{it.pct != null ? it.pct + "%" : "—"}</span>
                        {it.c != null && <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: it.c >= 0 ? "var(--up)" : "var(--down)" }}>{it.c >= 0 ? "+" : ""}{it.c}%</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 8 }}>% of shares held by institution · latest filing</div>
              </CarouselCard>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ============================== SCREENER ============================== */


// Parse a plain-English screen into sector/cap filters + numeric conditions.
