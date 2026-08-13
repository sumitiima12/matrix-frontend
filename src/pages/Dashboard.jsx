import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { currentIdeas } from "../domain/ideas";
import { dailyPicks, techSignal } from "../domain/signals";
import { Building2, ChevronDown, ChevronRight, Lightbulb, Newspaper, Pencil, Sparkles, TrendingUp, X, Zap } from "lucide-react";
import { BACKEND_URL, RECONCILE_REAL_CLOSES } from "../config";
import { CUR, DAY, chgColor, clamp, compact, fmt, fmtPnl, lsGet, lsSet, pct, timeAgo } from "../lib/format";
import { confirmDialog } from "../lib/confirmDialog";   // in-app confirm (reliable in webviews/PWA)
import { ALL, GLOBAL_MKTS, UNIVERSE, marketOf } from "../domain/universe";
import { stratPerf } from "../domain/strategies";   // same P&L engine the Automate page uses, so the two agree
import { positionPnl } from "../domain/leverage";   // Delta-parity crypto P&L (margin cap + fees), same for paper & real
import { askMatrix, fetchNews, fetchNewsFeed, scanIdeas } from "../domain/api";
import AddBtn from "../components/common/AddBtn";
import SectorHeatmap from "../components/common/SectorHeatmap";
import EarningsSection from "../components/common/EarningsSection";
import BuyButton from "../components/common/BuyButton";
import TagRow from "../components/common/TagRow";
import Change from "../components/common/Change";
import { computeTags } from "../domain/tags";
import DashStat from "../components/common/DashStat";
import ListRow from "../components/cards/ListRow";
import CarouselCard from "../components/cards/CarouselCard";
import MiniCandles from "../components/charts/MiniCandles";
import Pop from "../components/common/Pop";
import Section from "../components/common/Section";
import PopularScreeners from "../components/home/PopularScreeners";
import ActionRequired from "../components/home/ActionRequired";
import ActivityTimeline from "../components/home/ActivityTimeline";

/**
 * Dashboard — the trading desk. Composes the market strips, Matrix's Picks, trending, gainers/losers, news and the auto-buy panel.
 */

/* The next-open time for a market, expressed in IST and computed live so the US label follows US
   daylight saving (9:30 ET = 7:00 PM IST in summer / EDT, 8:00 PM IST in winter / EST) instead of a
   hardcoded string that drifts half the year. IN/Commodity/Crypto are IST-native so they're fixed. */
function tzOffsetMin(tz, at) {
  // How many minutes `tz` is ahead of UTC at instant `at` (handles DST via Intl).
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).reduce((a, x) => (a[x.type] = x.value, a), {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - at.getTime()) / 60000);
}
function marketOpenLabelIST(market) {
  if (market === "US") {
    try {
      const etOff = tzOffsetMin("America/New_York", new Date());   // -240 (EDT) or -300 (EST)
      const istMin = (570 - etOff + 330) % 1440;                   // 9:30 ET (570) -> UTC -> +5:30 IST
      const h = Math.floor(istMin / 60), m = istMin % 60;
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} IST`;
    } catch { return "7:00 PM IST"; }
  }
  if (market === "Commodity") return "9:00 AM IST";
  return "9:15 AM IST";   // Indian equities/F&O
}

/**
 * GlobalStrip — the live markets ticker, now MARKET-AWARE.
 *
 * It used to show the same Indian/US/commodity indices on every tab, so the Crypto
 * page led with NIFTY and SENSEX. Each market now leads with the instruments that
 * actually matter to it. Reads each one's REAL day change; no live quote yet -> "—".
 */
/* Each market shows ONLY its own instruments — no cross-market bleed (no Gold/Crude under Indian,
   no BTC/NIFTY under Commodity). */
const STRIP_BY_MARKET = {
  IN: [["NIFTY50", "NIFTY 50"], ["SENSEX", "SENSEX"], ["BANKNIFTY", "BANK NIFTY"], ["FINNIFTY", "FIN NIFTY"], ["INDIAVIX", "INDIA VIX"]],
  US: [["SPX", "S&P 500"], ["NDX", "NASDAQ"], ["DJI", "DOW"]],
  Crypto: [["BTC", "BTC"], ["ETH", "ETH"], ["SOL", "SOL"], ["BNB", "BNB"], ["XRP", "XRP"], ["DOGE", "DOGE"]],
  Commodity: [["GOLD", "GOLD"], ["SILVER", "SILVER"], ["CRUDEOIL", "CRUDE"], ["ALUMINIUM", "ALUMINIUM"]],
};
function GlobalStrip({ market = "IN" }) {
  const picks = STRIP_BY_MARKET[market] || GLOBAL_MKTS.map((m) => [m.sym, m.n]);
  const rows = picks.map(([sym, n]) => ({ sym, n, c: (ALL.find((a) => a.sym === sym) || {}).chg }));
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
  // Crypto has no volatility index, so it leads with ETH. US no longer lists VIX, so it leads with
  // NASDAQ (a normal asset). Indian/Commodity lead with India VIX.
  const vixSym = market === "Crypto" ? "ETH" : market === "US" ? "NDX" : "INDIAVIX";
  const idxSym = market === "US" ? "SPX" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY50";
  const vix = ALL.find((a) => a.sym === vixSym) || ALL.find((a) => a.sym === "INDIAVIX");
  const idx = ALL.find((a) => a.sym === idxSym) || ALL[0];
  const idxLabel = market === "US" ? "S&P 500" : market === "Crypto" ? "BTC" : market === "Commodity" ? "GOLD" : "NIFTY 50";
  const vixLabel = market === "Crypto" ? "ETH" : market === "US" ? "NASDAQ" : "INDIA VIX";
  // India VIX is inverted (up = fear = bad); ETH and NASDAQ are normal assets (up = green).
  const vixInverted = market !== "Crypto" && market !== "US";
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
      <div onClick={() => open(vix)} className="tap" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{vixLabel}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
          <span className="mono" style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vix.price != null ? Number(vix.price).toFixed(1) : "—"}</span>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, flex: "0 0 auto", color: (vixInverted ? vix.chg >= 0 : vix.chg < 0) ? "var(--down)" : "var(--up)" }}>{vix.chg >= 0 ? "+" : ""}{Number(vix.chg).toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ width: 1, background: "var(--line)", flex: "0 0 auto" }} />
      <div onClick={() => open(idx)} className="tap" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{idxLabel}</div>
        <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: idx.chg >= 0 ? "var(--up)" : "var(--down)" }}>{idx.chg >= 0 ? "▲ +" : "▼ "}{Number(idx.chg).toFixed(1)}%</div>
      </div>
      <div style={{ width: 1, background: "var(--line)", flex: "0 0 auto" }} />
      <div style={{ flex: "1.1 1 0", minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>🔥 {market === "Crypto" ? "Hot" : "Hot Stocks"}</div>
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
  const localAll = ideas.filter((i) => marketOf(i.sym) === mkt);

  /* PATTERN-BASED IDEAS (Neo). The backend scans this market's universe on real 1d/1h candles for
     bullish candlestick + chart patterns and returns entry/target/stop. We prefer those; if the scan
     is empty or the backend is unreachable, we fall back to the snapshot-technical ideas above. */
  const [gen, setGen] = useState([]);
  useEffect(() => {
    let stop = false;
    const syms = (UNIVERSE[mkt] || []).map((s) => s.sym).slice(0, 40);
    if (!syms.length) { setGen([]); return undefined; }
    scanIdeas(syms).then((list) => { if (!stop) setGen(Array.isArray(list) ? list : []); }).catch(() => { if (!stop) setGen([]); });
    return () => { stop = true; };
  }, [mkt]);
  const genCards = gen.map((g) => ({
    by: "Neo", sym: g.sym, entry: g.entry, exit: g.target, stop: g.stop, gain: g.tpPct, rr: g.rr,
    pattern: g.pattern, tradeType: "Stock", signal: g.name, tf: g.tf,
    logic: `A ${g.name} formed on the ${g.tf} chart${g.candlestick && g.candlestick !== g.name ? ` (with a ${g.candlestick})` : ""} — a bullish setup. Target +${g.tpPct}%, stop −${g.slPct}%.`,
  }));
  const all = genCards.length ? genCards : localAll;
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
  // Hide the whole Ideas section when this market has none, rather than showing an empty shell.
  if (top.length === 0) return null;
  return (
    <Section title="Ideas" icon={<Lightbulb size={17} color="var(--primary)" />}>
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
                    only={(idea.direction === "Short" || idea.side === "SELL" || idea.short) ? "sell" : "buy"}
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

    // Pass company NAMES so the backend can match Indian headlines (which use the name, not the ticker).
    const withNames = symbols.slice(0, 30).map((s) => { const st = list.find((a) => a.sym === s); return { sym: s, name: st ? st.name : "" }; });
    fetchNewsFeed(withNames)
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
    "Bulk deal": "#E8A33D", Buyback: "var(--up)", "M&A": "var(--primary)", "Order win": "var(--up)",
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
                color: tag === t ? "var(--on-primary)" : "var(--ink)",
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
  const cutoff = Date.now() - 15 * 24 * 3600 * 1000;
  const articles = feed
    .filter((n) => n.sym === sym && (!n.d || +new Date(n.d) >= cutoff))
    .sort((a, b) => (+new Date(b.d || 0)) - (+new Date(a.d || 0)));
  const cur = articles[idx] || articles[0];
  const many = articles.length > 1;

  const __sheet = (
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
          {articles.length ? `${articles.length} ${articles.length === 1 ? "story" : "stories"} · last 15 days` : "No stories in the last 15 days"}
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
  // Portal to <body> so the sheet escapes the home page's scroll-transform ancestor (otherwise
  // position:fixed anchors to that transformed parent and overlaps the list). BUT the theme CSS
  // variables live on the inner ".mx theme-*" div, not on <body> — so wrap the portaled sheet in
  // the current theme class or it renders with no background (transparent overlap bug).
  if (typeof document === "undefined" || !document.body) return __sheet;
  const themeClass = document.querySelector(".theme-dark") ? "theme-dark" : "theme-light";
  return createPortal(<div className={themeClass}>{__sheet}</div>, document.body);
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

  if (busy) return <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--muted)" }}>Loading…</p>;
  if (!text) return <p style={{ fontSize: 12.8, lineHeight: 1.6, margin: 0, color: "var(--muted)" }}>Loading…</p>;
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

      {/* WHY it's trending. A card is here because it's MOVING on 5-min candles, so we always show a
         momentum reason (a mover like SOXLB otherwise had a blank tag row and looked reasonless), plus
         any detected chart-pattern tags (bull flag, higher high…) when present. */}
      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        {m5 != null && (
          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 8px", background: "var(--elev)", color: tone(m5), whiteSpace: "nowrap" }}>
            {m5 >= 0 ? "▲ Rising" : "▼ Falling"} · 5m
          </span>
        )}
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
          <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth allowSell={false} />
        </div>
      )}
    </div>
  );
}

/* Is a market open RIGHT NOW (evaluated in IST)? Auto-buy must not fire when it's closed.
     IN/FNO 9:15–15:30 Mon–Fri · Commodity 9:00–23:30 Mon–Fri · US 7:00pm–1:30am IST Mon–Fri
     (the after-midnight tail belongs to the previous weekday's session) · Crypto 24/7. */
export function marketOpen(market) {
  if (market === "Crypto") return true;
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();                       // 0 Sun … 6 Sat
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const weekday = day >= 1 && day <= 5;
  if (market === "IN" || market === "FNO") return weekday && mins >= 555 && mins <= 930;      // 9:15–15:30
  if (market === "Commodity") return weekday && mins >= 540 && mins <= 1410;                   // 9:00–23:30
  if (market === "US") return (mins >= 1140 && day >= 1 && day <= 5) || (mins <= 90 && day >= 2 && day <= 6); // 7:00pm–1:30am IST
  return true;
}

/* Homepage — Live Positions + Recent Activity as TWO TABS in one section (instead of two stacked cards).
   Defaults to Live Positions when there are open positions, else Recent Activity. Renders nothing if the
   book is completely empty (no positions and no activity). */
function LiveActivityTabs({ opens = [], gcols, market, onGoPortfolio, trades = [], isReal = false }) {
  const [tab, setTab] = useState(opens.length ? "pos" : "act");
  // Any activity to show? (cheap check — same predicate ActivityTimeline uses.)
  const hasActivity = (trades || []).some((t) => (isReal ? !!t.real : !t.real) && t.entry != null && t.entryAt != null);
  if (!opens.length && !hasActivity) return null;
  const tabBtn = (k, label) => (
    <button key={k} onClick={() => setTab(k)} className="pill tap disp" style={{ padding: "5px 13px", fontSize: 11.5, fontWeight: 800, border: "none", whiteSpace: "nowrap", background: tab === k ? "var(--primary)" : "transparent", color: tab === k ? "var(--on-primary)" : "var(--muted)" }}>{label}</button>
  );
  return (
    <Section title={tab === "pos" ? "Live Positions" : "Recent Activity"} icon={<TrendingUp size={17} color="var(--primary)" />} right={
      <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3 }}>
        {tabBtn("pos", "Positions")}{tabBtn("act", "Activity")}
      </div>
    }>
      {/* Soft pastel wash — light green → blue-silver — so the section reads as a distinct, less-bland card. */}
      <div style={{ background: "linear-gradient(150deg, rgba(16,185,129,.12) 0%, rgba(150,190,235,.12) 55%, rgba(200,205,220,.10) 100%)", border: "1px solid var(--line)", borderRadius: 16, padding: 12 }}>
      {tab === "pos" ? (
        opens.length ? (
          <>
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: gcols, fontSize: 8.5, fontWeight: 800, color: "var(--muted)", background: "var(--elev)", padding: "5px 10px", letterSpacing: ".03em", gap: 6 }}>
                <span>SYMBOL</span><span style={{ textAlign: "right" }}>ENTRY</span><span style={{ textAlign: "right" }}>NOW</span><span style={{ textAlign: "right" }}>P&amp;L</span>
              </div>
              {opens.slice(0, 5).map((t, i) => (
                <div key={t.id || i} style={{ display: "grid", gridTemplateColumns: gcols, fontSize: 10.5, padding: "7px 10px", borderTop: "1px solid var(--line)", alignItems: "center", gap: 6 }}>
                  <span className="disp" style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.sym} <span style={{ fontSize: 8, fontWeight: 700, opacity: .55 }}>{t.tradeType || "Manual"}</span></span>
                  <span className="mono" style={{ textAlign: "right" }}>{fmt(Number(t.entry), t.market || market)}</span>
                  <span className="mono" style={{ textAlign: "right" }}>{fmt(t.cur, t.market || market)}</span>
                  <span className="mono" style={{ textAlign: "right", fontWeight: 800, color: t.pl >= 0 ? "var(--up)" : "var(--down)" }}>{(t.pl >= 0 ? "+" : "") + fmtPnl(t.pl, t.market || market)}</span>
                </div>
              ))}
            </div>
            {opens.length > 5 && (
              <button onClick={onGoPortfolio} className="tap disp" style={{ marginTop: 8, width: "100%", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 10, padding: "8px", fontWeight: 800, fontSize: 12 }}>See all {opens.length} positions</button>
            )}
          </>
        ) : <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "14px 4px", textAlign: "center" }}>No open positions.</div>
      ) : (
        <ActivityTimeline trades={trades} real={isReal} market={market} embedded />
      )}
      </div>
    </Section>
  );
}

export default function HomeView({ market, setMarket, segment, setSegment, list, onOpen, onBuy, onAutoBuy, onScreenerBuy, isAdmin = false, mode, watch, toggleWatch, profile, portfolio = [], realPortfolio = [], onRefreshReal, wallet = 0, onGoPortfolio, autoBuy, setAutoBuy, autoStats, onRecord, watchlists, addToWatch, createWatchlist, trades = [], liveTick = 0, onWhy, autoOnMap: autoOnMapProp, setAutoOnMap: setAutoOnMapProp, deployCapMap: deployCapMapProp, setDeployCapMap: setDeployCapMapProp, hideDash = false, onOpenScreener, actionItems = [], strategies = [], onGoDeployed, brokerName = null }) {
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
    // Crypto also gets SHORT picks; every other market stays long-only.
    // Scan the WHOLE market universe (not the profile-sorted `list`) so no symbol is ever excluded.
    const base = dailyPicks(UNIVERSE[market], { allowShorts: market === "Crypto" })
      .map((s) => ({
        s,
        // Rank by the favourable move LEFT to target: upside for longs, downside for shorts.
        left: s.price != null && s.pickTarget != null
          ? (s.pickDir === "short" ? -1 : 1) * ((s.pickTarget - s.price) / s.price) * 100
          : -Infinity,
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
  // News is for tradable stocks only — never indices (NIFTY 50, SENSEX, BANK NIFTY, …).
  const inNews = list.filter((s) => !s.isIndex).slice(0, 30);
  const smart = list.filter((s) => s.inst);
  const trendingView = trending;

  // portfolio dashboard math — PER MODE and PER MARKET.
  // In REAL mode the Total reflects your actual broker positions for the selected market;
  // in VIRTUAL mode it reflects your paper holdings. Each market is isolated, so switching
  // the market at the top changes the figure (US shows only US, Crypto only Crypto, etc.).
  const isReal = mode === "real";
  // Real-mode money: 1 decimal for values ≥ $1 (a Delta balance like $162.20473968 is noise),
  // but ADAPTIVE precision under $1 so tiny crypto P&L like $0.0062 stays legible instead of $0.0.
  const money1 = (v) => {
    const n = Number(v || 0), a = Math.abs(n), sym = (market === "Crypto" || market === "US") ? "$" : "₹";
    // MAX 2 decimals everywhere. A genuinely non-zero amount smaller than a cent shows a bounded value instead of a
    // misleading rounded "0.00", so we never overstate precision nor hide a tiny real P&L. R34-P4-02: a tiny LOSS reads
    // "> -$0.01" (mathematically unambiguous: the value is between −$0.01 and 0), a tiny gain reads "<$0.01".
    if (a > 0 && a < 0.005) return n < 0 ? "> -" + sym + "0.01" : "<" + sym + "0.01";
    return sym + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
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
          margin: h.margin != null ? h.margin : null,   // real capital deployed (leveraged venues)
          pnl: h.pnl != null ? h.pnl : null,             // broker's real unrealised P&L
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

  /* LEVERAGED real venues (Delta): the position notional (mark × size) shown above is 20–25× the
     capital actually at stake, so "value $195k / invested $193k" is misleading on a ~$200 account.
     When the broker reports real margin + equity, show THOSE instead: value = margin + unrealised
     P&L (your real equity in the trade), invested = margin, P&L = the broker's own unrealised P&L. */
  const isLeveraged = !!(realPortfolio && realPortfolio.leveraged);
  const realMargin = holds.reduce((a, h) => a + (h.margin || 0), 0);
  const realPnl = holds.reduce((a, h) => a + (h.pnl || 0), 0);
  const dashVal = (isReal && isLeveraged && realMargin > 0) ? realMargin + realPnl : dash.val;
  const dashInv = (isReal && isLeveraged && realMargin > 0) ? realMargin : dash.inv;
  const dashNet = (isReal && isLeveraged && realMargin > 0) ? realPnl : net;
  const dashRet = dashInv ? (dashNet / dashInv) * 100 : retPct;
  const realCash = (realPortfolio && realPortfolio.cash != null) ? realPortfolio.cash : null;
  const realEquity = (realPortfolio && realPortfolio.equity != null) ? realPortfolio.equity : null;

  // Auto-Buy Matrix's picks — for the market selected at the top; each market keeps its own on/off.
  // The on/off map is LIFTED to the app (persisted server-side) when provided, so it survives reloads.
  const [dashView, setDashView] = useState("total");
  const [autoOnMapLocal, setAutoOnMapLocal] = useState({ IN: false, US: false, Crypto: false, Commodity: false, FNO: false });
  const autoOnMap = autoOnMapProp || autoOnMapLocal;
  const setAutoOnMap = setAutoOnMapProp || setAutoOnMapLocal;
  /* Capital-to-deploy is PER MARKET and persisted, so it survives logout/login and each
     market keeps its own (a $ amount for US/Crypto, ₹ for Indian). */
  /* Capital is LIFTED to the app root (server-persisted) when provided, so it survives reloads and
     other devices instead of reverting; falls back to local state for guests. */
  const [deployCapMapLocal, setDeployCapMapLocal] = useState(() => { const v = lsGet("mx_deploy_capital", {}); return (v && typeof v === "object") ? v : {}; });
  const deployCapMap = deployCapMapProp || deployCapMapLocal;
  const setDeployCapRaw = setDeployCapMapProp || setDeployCapMapLocal;
  const capDefault = (m) => (m === "US" || m === "Crypto") ? "1000" : "100000";
  const deployCapital = deployCapMap[market] != null ? deployCapMap[market] : capDefault(market);
  const setDeployCapital = (v) => setDeployCapRaw((prev) => { const next = { ...(prev || {}), [market]: v }; lsSet("mx_deploy_capital", next); return next; });
  /* An explicit Save: you type into a draft, then tap Save to commit (and persist) it. The
     "Capital" figure only updates on Save, so it's clear what's applied vs being typed. */
  const [capDraft, setCapDraft] = useState(deployCapital);
  const [capSaved, setCapSaved] = useState(false);
  useEffect(() => { setCapDraft(deployCapMap[market] != null ? deployCapMap[market] : capDefault(market)); /* eslint-disable-next-line */ }, [market]);
  const [plPeriod, setPlPeriod] = useState("today");
  const [totPeriod, setTotPeriod] = useState("today");   // Total-card timeframe (default Today)
  const [totCustFrom, setTotCustFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });   // default: 1st of current month
  const [totCustTo, setTotCustTo] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });   // default: today
  /* Product type — PER MARKET, persisted. "Intraday" = auto-square-off (MIS/INTRADAY);
     "NRML" = carry-forward / delivery (CNC on equity). Only meaningful for Indian markets;
     crypto/US ignore it. Default to NRML so positions aren't force-closed at 3:20pm. */
  const [prodMap, setProdMap] = useState(() => { const v = lsGet("mx_autobuy_product", {}); return (v && typeof v === "object") ? v : {}; });
  const product = prodMap[market] || "NRML";                       // "NRML" | "INTRADAY"
  const setProduct = (v) => setProdMap((prev) => { const next = { ...prev, [market]: v }; lsSet("mx_autobuy_product", next); return next; });
  const prodCode = product === "INTRADAY" ? "MIS" : "CNC";         // what the broker order body expects
  const showProduct = market === "IN" || market === "FNO";         // concept only applies to Indian equity/F&O
  const [autoOverrides, setAutoOverrides] = useState({});   // sym -> {tp, sl}
  /* SL/TP mode for Smart Auto-Buy. "default" (the original behaviour) keeps a SEPARATE target/stop per
     symbol, taken from that pick's Top-Picks levels. "custom" applies ONE SL/TP to every pick, prefilled
     0.5% / 1.5%. A per-symbol edit in the positions panel still overrides either. */
  const [slMode, setSlMode] = useState("default");
  const [autoSL, setAutoSL] = useState(0.5);
  const [autoTP, setAutoTP] = useState(1.5);
  // Smart Auto-Buy symbol selection + minimum reward:risk (like screeners). sabSyms empty = all of today's
  // picks; sabMinRR defaults to 2 (2:1) so only picks whose target ÷ stop meets the ratio are bought.
  const [sabSyms, setSabSyms] = useState([]);
  const [sabSymOpen, setSabSymOpen] = useState(false);   // collapse the symbol chip picker to a count by default
  const [sabMinRR, setSabMinRR] = useState(2);
  const [editSym, setEditSym] = useState(null);
  const [showTrades, setShowTrades] = useState(false);
  const [showTotalPos, setShowTotalPos] = useState(false);   // Total card "Show positions" toggle
  const [runMsg, setRunMsg] = useState("");                  // transient feedback for "Run now"
  const MKT_LABEL = { IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", Commodity: "🪙 Commodity", FNO: "⚡ F&O" };
  // Smart Auto-Buy on/off is INDEPENDENT per mode: Real and Virtual each keep their own switch, so
  // turning it on for paper trading never arms real-money auto-buys (and vice versa).
  const autoKey = mode === "real" ? `${market}:real` : `${market}:virtual`;
  const autoOn = !!autoOnMap[autoKey];                      // on/off for this market AND this mode
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
  const autoPicksAll = useMemo(() => dailyPicks(UNIVERSE[market]).slice(0, 6), [market]);
  // SYMBOL SELECT — empty selection means "all of today's picks".
  const autoPicks = useMemo(() => autoPicksAll.filter((s) => sabSyms.length === 0 || sabSyms.includes(s.sym)), [autoPicksAll, sabSyms]);
  const perCap = capNum / Math.max(1, autoPicks.length);
  const autoTrades = autoPicks.map((s) => {
    const m = marketOf(s.sym);
    const auto = autoTargets(s);
    const ov = autoOverrides[s.sym];
    // Precedence: a per-symbol edit wins; else (Custom mode) the one global SL/TP; else the pick's own.
    const tpPct = ov ? ov.tp : (slMode === "custom" ? autoTP : auto.tp);
    const slPct = ov ? ov.sl : (slMode === "custom" ? autoSL : auto.sl);
    const rr = slPct > 0 ? +(tpPct / slPct).toFixed(2) : 0;   // reward:risk of this pick
    const entry = s.price;
    // Crypto sizes by AMOUNT (fractional units); stocks by whole shares.
    const qty = m === "Crypto" ? +(perCap / entry).toFixed(6) : Math.max(1, Math.floor(perCap / entry));
    return { sym: s.sym, m, qty, entry, tpPct, slPct, rr, auto };   // planned entry; the exit engine closes it at real prices
  }).filter((t) => t && t.rr >= sabMinRR);   // MIN R:R gate — only buy picks that meet the ratio (F&O with no lot size still dropped)
  // When Auto-Buy is ON, actually place today's picks as REAL positions (once per
  // day per market) with their target/stop attached. The exit engine then closes
  // them at real market prices — no simulated win/loss.
  useEffect(() => {
    if (!autoOn || !onBuy || !BACKEND_URL) return;
    // MARKET HOURS. Never place an auto-buy when the market is CLOSED (weekends, or outside session
    // hours) — placing an Indian trade at 8pm or on a Sunday is wrong. Crypto is 24/7.
    if (!marketOpen(market)) return;
    // Don't consume the once-per-day guard before the picks have actually loaded — otherwise
    // toggling ON early (while UNIVERSE prices are still null → autoTrades empty) marks the day
    // "done" and buys nothing, leaving 0 positions until tomorrow. Wait for real picks first.
    if (!autoTrades.length) return;
    // Fresh day index (NOT the module-load `DAY` const, which never rolls in a session left open across
    // midnight — that would keep blocking the next day's first auto-buy until a reload, esp. 24/7 crypto).
    const key = `mx_autobuy_${market}_${mode}_${Math.floor(Date.now() / 864e5)}`;   // scoped by mode so virtual & real each fire once/day
    if (lsGet(key, false)) return;
    autoTrades.forEach((t) => {
      const u = ALL.find((a) => a.sym === (t.under || t.sym));
      if (!u) return;
      // F&O: buy the futures contract (priced off the underlying, qty = 1 lot).
      const inst = u;   // no futures: auto-buy trades the stock itself
      (onAutoBuy || onBuy)(inst, t.qty, { tp: t.tpPct, sl: t.slPct, tradeType: "Auto Buy", product: prodCode });
    });
    lsSet(key, true);
    // `autoTrades.length` is in the deps so this fires the moment the day's picks finish loading —
    // without it, turning Auto-Buy on before prices arrived left the effect never re-running, so
    // nothing was ever placed (0 trades). The once-per-day key still prevents a second placement.
  }, [autoOn, market, mode, autoTrades.length]);
  /* MANUAL "Run now" — place today's picks immediately instead of waiting for the once-a-day effect to
     catch the right moment. Respects market hours and needs the picks loaded; sets the daily guard so the
     effect won't then double-place. */
  const runAutoBuyNow = () => {
    if (!marketOpen(market)) { setRunMsg(`${MKT_LABEL[market]} market is closed — auto-buy runs at the next open.`); return; }
    if (!autoTrades.length) { setRunMsg("Today's picks are still loading — try again in a moment."); return; }
    let placed = 0;
    autoTrades.forEach((t) => {
      const u = ALL.find((a) => a.sym === (t.under || t.sym));
      if (!u) return;
      (onAutoBuy || onBuy)(u, t.qty, { tp: t.tpPct, sl: t.slPct, tradeType: "Auto Buy", product: prodCode });
      placed += 1;
    });
    lsSet(`mx_autobuy_${market}_${mode}_${Math.floor(Date.now() / 864e5)}`, true);
    setRunMsg(`Placed ${placed} ${MKT_LABEL[market]} auto-buy position${placed === 1 ? "" : "s"} at live prices.`);
  };
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
  // FLAG (default off): DISPLAY-only reconciliation of real closes. A real Auto-Buy position
  // whose symbol is no longer in the live broker holdings has been closed (e.g. Delta's own
  // bracket fired) — show it CLOSED (est. exit at last price) rather than a stale "OPEN". Never
  // mutates the journal. Only trusts holdings once they've actually loaded.
  const realHeld = (isReal && RECONCILE_REAL_CLOSES && realPortfolio && Array.isArray(realPortfolio.holdings))
    ? new Set(realPortfolio.holdings.filter((h) => h.qty).map((h) => h.sym))
    : null;
  const autoRows = useMemo(() => (trades || [])
    .filter((t) => (t.tradeType === "Auto Buy") && ((t.market || marketOf(t.sym) || "IN")) === market && (t.entryAt || 0) >= periodFrom)
    .map((t) => {
      const rejected = t.status === "rejected";
      const last = (ALL.find((a) => a.sym === t.sym) || {}).price;
      // Reconciled close: real, still-journalled-open, but no longer held → treat as closed (est).
      const reconciledClosed = realHeld && !rejected && t.exitAt == null && t.real && !realHeld.has(t.sym);
      const open = !rejected && t.exitAt == null && !reconciledClosed;
      const cur = open ? (last ?? t.entry) : (reconciledClosed ? (last ?? t.entry) : t.exit);
      const realPnl = rejected || t.entry == null ? 0 : +(positionPnl(t, cur, market)).toFixed(2);
      return { ...t, rejected, open, cur, realPnl, reconciledClosed, exitType: reconciledClosed ? "Closed (est.)" : t.exitType };
    }), [trades, market, periodFrom, realHeld]);
  const closedRows = autoRows.filter((t) => !t.open && !t.rejected);
  // Stats exclude rejects — they aren't trades, they're failed attempts (shown separately).
  const filledRows = autoRows.filter((t) => !t.rejected);
  const periodStats = { pnl: filledRows.reduce((a, t) => a + t.realPnl, 0), trades: filledRows.length, wins: closedRows.filter((t) => t.realPnl > 0).length };
  const autoPnl = periodStats.pnl;
  const autoWinRate = closedRows.length ? closedRows.filter((t) => t.realPnl > 0).length / closedRows.length * 100 : 0;
  const periodLabel = plPeriod === "today" ? "today" : plPeriod === "month" ? "this month" : "last 12 months";

  /* TOTAL card P&L across ALL THREE trade types — manual + Smart Auto-Buy + Automate — for the
     selected market, mode and timeframe. This is why "Total ₹0" could sit beside a non-zero
     Auto-Buy figure: the old Total counted only unrealised P&L on current holdings and ignored the
     trade journal entirely. Now closed trades contribute realised P&L and open ones live
     unrealised P&L, exactly like the Auto-Buy stats, but for every trade type. */
  const totFrom = useMemo(() => {
    const d = new Date();
    if (totPeriod === "today") { d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (totPeriod === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (totPeriod === "last12") { d.setFullYear(d.getFullYear() - 1); d.setHours(0, 0, 0, 0); return d.getTime(); }
    // While the user is mid-edit the date field can briefly be empty/partial. Falling back to 0 (lifetime)
    // there made the win rate / open counts flash the all-time numbers for a moment; fall back to the
    // month-start default instead so the window never momentarily blows open.
    if (totPeriod === "custom") { const t = Date.parse(totCustFrom); if (Number.isFinite(t)) return t; const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
    return 0;                                       // lifetime
  }, [totPeriod, totCustFrom]);
  // Upper bound — only Custom has one (end of the chosen day); every other period runs to "now".
  const totTo = useMemo(() => {
    if (totPeriod === "custom") { const t = Date.parse(totCustTo); if (Number.isFinite(t)) return t + 86399999; const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
    return Infinity;
  }, [totPeriod, totCustTo]);
  const totalStats = useMemo(() => {
    // A trade is dated by its EXIT if closed, else its ENTRY (an open position is "current").
    const stampT = (t) => (t.exitAt || t.entryAt || 0);
    const rows = (trades || []).filter((t) =>
      inMarket(t.sym, t.market) &&
      (isReal ? !!t.real : !t.real) &&
      t.status !== "rejected" && t.entry != null &&
      // An OPEN position is live right now, so its P&L belongs in every period (even if it was
      // entered before the window) — matching what the Smart Auto-Buy card shows. Closed trades
      // are still scoped to the selected date range.
      (t.exitAt == null || (stampT(t) >= totFrom && stampT(t) <= totTo)));
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    let pnl = 0, invested = 0, open = 0, closedN = 0, wins = 0, byType = { Manual: 0, "Auto Buy": 0, Automate: 0, "Screener Auto Buy": 0 };
    for (const t of rows) {
      const closed = t.exitAt != null && t.exit != null;
      const st = ALL.find((a) => a.sym === t.sym) || {};
      const last = st.price;
      const cur = closed ? t.exit : (last != null ? last : t.entry);
      /* Reference the P&L is measured FROM. Normally the entry price. But an OPEN position carried in
         from a PRIOR day, shown under "Today", should contribute only TODAY's move — not its whole
         unrealised loss since entry. So we measure from today's open (derived from the live day-change %),
         which is why "Today" no longer shows a big loss for positions you didn't trade today. */
      let ref = t.entry;
      if (!closed && totPeriod === "today" && (t.entryAt || 0) < todayStart && st.chg != null && last != null) {
        ref = last / (1 + st.chg / 100);
      }
      // P&L = price move × quantity held. t.qty is the amount of the asset (coins / shares / lots) for
      // ALL markets — do NOT treat crypto qty as a USD notional (that multiplied a small stop by the
      // return fraction and blew a tiny loss into a huge phantom one). Shorts profit when price falls.
      const dir = (t.side === "SELL" || t.short) ? -1 : 1;
      const p = (cur - ref) * (t.qty != null ? t.qty : (market === "Crypto" ? 0 : 1)) * dir;
      pnl += p; invested += t.entry * (t.qty || (market === "Crypto" ? 0 : 1));
      if (!closed) open++; else { closedN++; if (p > 0) wins++; }
      const key = t.tradeType === "Auto Buy" ? "Auto Buy" : t.tradeType === "Automate" ? "Automate" : t.tradeType === "Screener Auto Buy" ? "Screener Auto Buy" : "Manual";
      byType[key] += p;
    }
    // Win rate is over CLOSED trades only (an open position hasn't won or lost yet).
    return { pnl: +pnl.toFixed(2), invested: +invested.toFixed(2), count: rows.length, open, closedN, wins, winRate: closedN ? (wins / closedN) * 100 : null, byType, retPct: invested ? (pnl / invested) * 100 : 0 };
  }, [trades, market, isReal, totFrom, totTo, totPeriod]);
  const totLabel = totPeriod === "today" ? "today" : totPeriod === "month" ? "this month" : totPeriod === "last12" ? "last 12 months" : totPeriod === "custom" ? "in range" : "all time";

  /* The "Automate" box uses the SAME P&L engine as the Automate page (stratPerf over the deployed strategies)
     so the two agree instead of diverging in sign. It sums each strategy's realised (closed-in-window) +
     unrealised (open, priced) P&L over the Total card's window, scoped to this mode + market. */
  const automatePnl = useMemo(() => {
    const priceOf = (sym) => { const a = ALL.find((x) => x.sym === sym); return a && a.price != null ? a.price : null; };
    const modeTrades = (trades || []).filter((t) => (isReal ? !!t.real : !t.real));
    const win = { from: totFrom, to: totTo === Infinity ? undefined : totTo };
    const inMkt = (s) => !(s.symbols && s.symbols.length) || (s.symbols || []).some((x) => marketOf(x) === market);
    return (strategies || []).filter(inMkt).reduce((a, s) => a + (stratPerf(s, modeTrades, 365, priceOf, win).pnl || 0), 0);
  }, [strategies, trades, isReal, market, totFrom, totTo]);

  /* The OPEN positions that make up the Total — every trade type (Manual / Auto-Buy / Automate /
     Screener), still open, for this market + mode. Rejected orders are excluded (they live in Orders,
     not in a positions list). Powers the Total card's "Show positions". */
  const totalOpenRows = useMemo(() => (trades || [])
    .filter((t) => inMarket(t.sym, t.market) && (isReal ? !!t.real : !t.real)
      && t.status !== "rejected" && t.entry != null && (t.exitAt == null || t.exit == null))
    .map((t) => {
      const last = (ALL.find((a) => a.sym === t.sym) || {}).price;
      const cur = last != null ? last : t.entry;
      const lp = positionPnl(t, cur, market);
      return { ...t, cur, livePnl: +lp.toFixed(2) };
    })
    .sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, market, isReal]);

  return (
    <div className="home-metal">
      {/* #24 — persistent safety summary: mode · broker · active strategies · open positions, at a glance.
          Real mode gets a red accent so situational awareness is continuous, never buried. */}
      {(() => {
        const activeStrats = (strategies || []).filter((s) => s && s.active).length;
        const openCount = (trades || []).filter((t) => (isReal ? !!t.real : !t.real) && t.exitAt == null && t.entry != null && t.status !== "rejected" && inMarket(t.sym, t.market)).length;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "7px 11px", borderRadius: 10, marginBottom: 10, background: "var(--elev)", border: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
            {/* Neutral STATUS strip (not an alert). Mode is a small badge; the rest is plain status text. */}
            <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".02em", padding: "2px 8px", borderRadius: 999, color: isReal ? "var(--down)" : "var(--muted)", background: isReal ? "rgba(239,68,68,.10)" : "var(--surface)", border: "1px solid " + (isReal ? "rgba(239,68,68,.22)" : "var(--line)") }}>{isReal ? "REAL" : "VIRTUAL"}</span>
            <span>{brokerName || (isReal ? "No broker" : "Paper money")}</span>
            <span style={{ opacity: .5 }}>·</span><span>{activeStrats} active {activeStrats === 1 ? "strategy" : "strategies"}</span>
            <span style={{ opacity: .5 }}>·</span><span>{openCount} open</span>
          </div>
        );
      })()}

      {/* Global markets live strip — market-aware (Crypto leads with BTC/ETH, not NIFTY) */}
      <GlobalStrip market={market} />

      {market !== "Crypto" && <TunedStrip profile={profile} />}

      {/* ACTION REQUIRED centre — one consolidated hub for account-level problems, instead of scattering
          them across cards. Server/broker/strategy-sourced items arrive via `actionItems`; the trade-derived
          ones (unprotected positions, unresolved orders, insufficient balance, market closed) are computed
          here. Renders nothing when there's nothing to act on. */}
      {(() => {
        const it = [...(actionItems || [])];
        if (isReal) {
          // Only GENUINELY OPEN filled positions count — exclude rejected / never-filled / unentered journal rows
          // (same predicate the Total's open-position list uses), else the "without a stop-loss" tally is inflated
          // by stale non-positions.
          const openReal = (trades || []).filter((t) => t.real && t.exitAt == null && t.entry != null && t.status !== "rejected" && inMarket(t.sym, t.market));
          const noSL = openReal.filter((t) => t.sl == null).length;
          if (noSL) it.push({ key: "nosl", tone: "warn", label: `${noSL} position${noSL > 1 ? "s" : ""} without a stop-loss`, detail: "Unprotected — a move against you has no automatic exit.", action: { label: "Review", onClick: onGoPortfolio } });
          const unresolved = openReal.filter((t) => ["pending", "unknown", "submitted"].includes(String(t.status || "").toLowerCase())).length;
          if (unresolved) it.push({ key: "unresolved", tone: "crit", label: `${unresolved} order${unresolved > 1 ? "s" : ""} awaiting broker confirmation`, detail: "Matrix won't retry these — check them with your broker.", action: { label: "Orders", onClick: onGoPortfolio } });
          const insuff = (trades || []).filter((t) => t.real && t.status === "rejected" && /balance|insufficient|fund|margin/i.test(String(t.rejectReason || ""))).length;
          if (insuff) it.push({ key: "balance", tone: "crit", label: "Insufficient balance", detail: "A recent real order was rejected for low funds — add funds at your broker." });
          if (!marketOpen(market)) it.push({ key: "mktclosed", tone: "info", label: `${MKT_LABEL[market]} market is closed`, detail: `Real orders queue until the next open (${marketOpenLabelIST(market)}).` });
        }
        return <ActionRequired items={it} />;
      })()}

      {/* Portfolio / Auto-Buy dashboard card. Hidden for gated users (non-admin, virtual mode,
          Indian paper trading off) — there is nothing to trade, so a ₹0 virtual portfolio would
          only mislead. */}
      {!hideDash && (
      <div className="card flat tint-blue" style={{ marginTop: 14, padding: 16, border: "1px solid var(--line)", outline: "none", color: "var(--ink)", position: "relative", overflow: "hidden", boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.02), 0 10px 30px rgba(0,0,0,.28)", background: "var(--card-grad)" }}>
        <div style={{ position: "relative" }}>
          {/* slider + date range on ONE row (the dropdown controls whichever view is showing) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", padding: 3 }}>
              {[["total", "Total"], ["auto", "Smart Auto-Buy"]].map(([k, l]) => (
                <button key={k} onClick={() => setDashView(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: dashView === k ? "var(--primary)" : "transparent", color: dashView === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
              ))}
            </div>
            <select aria-label="Date range" value={dashView === "total" ? totPeriod : plPeriod} onChange={(e) => { const v = e.target.value; if (dashView === "total") setTotPeriod(v); else setPlPeriod(v); }} style={{ fontSize: 11, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 8px", background: "var(--elev)", color: "var(--ink)" }}>
              <option value="today">Today</option>
              <option value="month">This month</option>
              {dashView === "total" && <option value="last12">Last 12 months</option>}
              <option value="lifetime">{dashView === "total" ? "All time" : "Lifetime"}</option>
              {dashView === "total" && <option value="custom">Custom…</option>}
            </select>
          </div>
          {/* Custom range pickers — only for the Total card, only when Custom is selected. */}
          {dashView === "total" && totPeriod === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <input type="date" aria-label="From date" value={totCustFrom} max={totCustTo || undefined} onChange={(e) => setTotCustFrom(e.target.value)} style={{ fontSize: 11, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 8px", background: "var(--elev)", color: "var(--ink)" }} />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>→</span>
              <input type="date" aria-label="To date" value={totCustTo} min={totCustFrom || undefined} onChange={(e) => setTotCustTo(e.target.value)} style={{ fontSize: 11, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 8px", background: "var(--elev)", color: "var(--ink)" }} />
            </div>
          )}

          {dashView === "total" ? (
            <div>
              <span style={{ fontSize: 12, opacity: .85, fontWeight: 700 }}>P&amp;L{isReal && <span title="Estimated from live prices. Your broker-verified P&L lives in Portfolio." style={{ fontWeight: 700, opacity: .6 }}> · est.</span>}</span>
              <div onClick={onGoPortfolio} className="tap" style={{ marginTop: 2 }}>
                {/* Headline = total P&L (Manual + Smart Auto-Buy + Automate) in BLACK, with Returns %
                    right beside it in green/red. Everything else on the card stays black. */}
                {(() => {
                  const hp = (isReal && isLeveraged) ? dashNet : totalStats.pnl;
                  const hr = (isReal && isLeveraged) ? dashRet : totalStats.retPct;
                  return (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 27, color: "var(--ink)" }}>{(hp >= 0 ? "+" : "") + (isReal ? money1(hp) : fmtPnl(hp, market))}</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: hr >= 0 ? "var(--up)" : "var(--down)" }}>{(hr >= 0 ? "+" : "") + hr.toFixed(1) + "%"}</div>
                    </div>
                  );
                })()}
                {isReal && realCash != null && <div style={{ marginTop: 8, fontSize: 11.5, opacity: .9 }}>Available cash <b style={{ fontWeight: 800, color: "var(--ink)" }}>{money1(realCash)}</b></div>}
                {/* Per-type P&L breakdown — equal, subtle boxes so all four sources read at a glance.
                    Shown in BOTH virtual and real mode (including leveraged crypto): even when the
                    headline P&L comes from the broker wallet, the user still wants to see how much of
                    their recorded activity came from Manual vs Auto-Buy vs Automate vs Screener. */}
                {(
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
                    {[["Manual", totalStats.byType.Manual], ["Auto-Buy", totalStats.byType["Auto Buy"]], ["Automate", automatePnl], ["Screener", totalStats.byType["Screener Auto Buy"]]].map(([label, v]) => (
                      <div key={label} style={{ background: "var(--elev)", borderRadius: 9, padding: "7px 8px", minWidth: 0 }}>
                        <div style={{ fontSize: 9, opacity: .65, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                        <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: v >= 0 ? "var(--up)" : "var(--down)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(v >= 0 ? "+" : "") + (isReal ? money1(v) : fmtPnl(v, market))}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* At-a-glance counts — trades and OPEN positions for THIS market. */}
                <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, opacity: .9, flexWrap: "wrap" }}>
                  <span><b style={{ fontWeight: 800 }}>{totalStats.count}</b> <span style={{ opacity: .7 }}>trades</span></span>
                  <span><b style={{ fontWeight: 800 }}>{totalOpenRows.length}</b> <span style={{ opacity: .7 }}>open</span></span>
                  {totalStats.winRate != null && <span><b style={{ fontWeight: 800 }}>{totalStats.winRate.toFixed(0)}%</b> <span style={{ opacity: .7 }}>win rate</span></span>}
                </div>
                {totalStats.count === 0 && <div style={{ fontSize: 11.5, opacity: .8, marginTop: 10 }}>No {isReal ? "real" : "virtual"} trades {totLabel} in {MKT_LABEL[market]}.</div>}

                {/* Show positions — the OPEN positions behind the Total (all types), rejected excluded. */}
                {totalOpenRows.length > 0 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setShowTotalPos((v) => !v); }} className="tap disp" style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 11, padding: "9px 12px", fontWeight: 800, fontSize: 12 }}>
                      {showTotalPos ? "Hide positions" : `Show positions (${totalOpenRows.length})`}<ChevronRight size={15} style={{ transform: showTotalPos ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }} />
                    </button>
                    {showTotalPos && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {totalOpenRows.map((t) => (
                          <div key={t.id || `${t.sym}-${t.entryAt}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--elev)", borderRadius: 9, padding: "8px 10px" }}>
                            <div style={{ flex: "1 1 0", minWidth: 0 }}>
                              <div className="disp" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--primary)" }}>{t.sym} <span style={{ fontSize: 9.5, fontWeight: 700, opacity: .6 }}>{t.tradeType || "Manual"}</span></div>
                              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>Entry {isReal ? money1(t.entry) : fmt(t.entry, market)} · now {isReal ? money1(t.cur) : fmt(t.cur, market)}</div>
                            </div>
                            <div className="mono" style={{ flex: "0 0 auto", fontWeight: 800, fontSize: 13, color: (t.livePnl || 0) >= 0 ? "var(--up)" : "var(--down)" }}>{(t.livePnl || 0) >= 0 ? "+" : ""}{isReal ? money1(t.livePnl) : fmtPnl(t.livePnl, market)}</div>
                          </div>
                        ))}
                        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>Rejected orders aren't positions — find them under Orders.</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, opacity: .85 }}>Smart Auto-Buy · {MKT_LABEL[market]}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="tap" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    {autoOn ? "On" : "Off"}
                    <span onClick={async () => {
                      const turningOn = !autoOn;
                      if (turningOn && mode === "real" && !lsGet("mx_autobuy_warned", false)) {
                        const ok = await confirmDialog(
                          "Smart Auto-Buy will place REAL orders on its own, without asking you each time. It will also auto-sell when your stop-loss or target is hit. Turn it on?",
                          { title: "Enable real Auto-Buy", confirmLabel: "Turn on", danger: false }
                        );
                        if (!ok) return;
                        lsSet("mx_autobuy_warned", true);
                      }
                      setAutoOnMap((m) => ({ ...m, [autoKey]: !m[autoKey] }));
                    }} style={{ width: 38, height: 22, borderRadius: 999, background: autoOn ? "#22C55E" : "var(--line)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: autoOn ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left .2s" }} />
                    </span>
                  </label>
                </div>
              </div>
              {showProduct && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 10.5, opacity: .8, fontWeight: 700 }}>Product</span>
                  <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", padding: 2 }}>
                    {[["INTRADAY", "Intraday"], ["NRML", "NRML"]].map(([k, l]) => (
                      <button key={k} onClick={() => setProduct(k)} className="pill tap disp" style={{ padding: "5px 12px", fontSize: 10.5, fontWeight: 800, border: "none", background: product === k ? "var(--primary)" : "transparent", color: product === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
                    ))}
                  </div>
                  <span style={{ fontSize: 9.5, opacity: .6 }}>{product === "INTRADAY" ? "auto-squared off same day" : "carried forward"}</span>
                </div>
              )}
              {/* Plain-English "how this works" so the behaviour and requirements are obvious. */}
              <div style={{ fontSize: 9.5, opacity: .6, marginTop: 3, lineHeight: 1.45 }}>
                Buys Matrix's top {MKT_LABEL[market]} picks once a day at the live price{autoOn ? ", and auto-exits at your target/stop" : ""}. {isReal ? "Real orders — needs a connected broker + enough balance." : "Paper preview until you switch to Real."}
              </div>
              <div style={{ fontSize: 10, opacity: .7, marginTop: 4 }}>P&amp;L · {periodLabel} {autoOn ? "· live positions (real exits)" : "· simulated preview"}</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 27, marginTop: 3, color: autoPnl >= 0 ? "var(--up)" : "var(--down)" }}>{(autoPnl >= 0 ? "+" : "") + fmt(autoPnl, aggCur)}</div>
              <div style={{ fontSize: 11, opacity: .85 }}>{`${periodStats.trades} trades · ${autoWinRate.toFixed(0)}% win rate · ${CUR[aggCur]}${(capNum / 1000).toFixed(0)}k capital`}</div>
              {/* Why "0 trades today" on a closed market (e.g. US during Indian daytime): auto-buy
                  only fires during that market's hours. Say so instead of leaving a bare zero. */}
              {!marketOpen(market) && (
                <div style={{ fontSize: 10.5, marginTop: 5, padding: "6px 10px", borderRadius: 9, background: "rgba(178,107,0,.12)", color: "#8A5200", fontWeight: 700, display: "inline-block" }}>
                  {MKT_LABEL[market]} market is closed now — auto-buy runs at the next open ({marketOpenLabelIST(market)}). Today's plan is below.
                </div>
              )}
              {autoRows.some((r) => r.rejected) && (
                <div style={{ fontSize: 10, color: "var(--down)", fontWeight: 700, marginTop: 3 }}>⚠ {autoRows.filter((r) => r.rejected).length} order(s) rejected — see the reason under Orders</div>
              )}
              {/* RUN NOW — place today's picks on demand instead of waiting for the once-a-day auto-fire. */}
              {autoOn && marketOpen(market) && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={runAutoBuyNow} disabled={!autoTrades.length} className="tap disp" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: autoTrades.length ? "pointer" : "not-allowed", opacity: autoTrades.length ? 1 : 0.6 }}>
                    ⚡ Run auto-buy now
                  </button>
                  {runMsg && <div style={{ fontSize: 10.5, opacity: .9, marginTop: 5, fontWeight: 700 }}>{runMsg}</div>}
                </div>
              )}

              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <DashStat k="Trades" v={periodStats.trades} pos={true} />
                <DashStat k="Win rate" v={autoWinRate.toFixed(0) + "%"} pos={autoWinRate >= 50} />
                <DashStat k="Capital" v={fmt(capNum, aggCur)} pos={true} />
              </div>

              {/* SL/TP mode. Default = each pick keeps its own target/stop (from Top Picks). Custom = one
                  SL/TP for all picks, prefilled 0.5% / 1.5%. A per-position edit still overrides either. */}
              <div style={{ marginTop: 12, background: "var(--elev)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 9.5, opacity: .8, fontWeight: 700 }}>STOP-LOSS / TARGET</div>
                  <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", padding: 2 }}>
                    {[["default", "Default"], ["custom", "Custom"]].map(([k, l]) => (
                      <button key={k} onClick={() => setSlMode(k)} className="pill tap disp" style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 800, border: "none", background: slMode === k ? "var(--primary)" : "transparent", color: slMode === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
                    ))}
                  </div>
                </div>
                {slMode === "custom" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
                    <input value={autoSL} onChange={(e) => setAutoSL(+e.target.value.replace(/[^0-9.]/g, "") || 0)} inputMode="decimal" className="no-ring mono" style={{ width: 52, textAlign: "center", border: "none", background: "var(--elev)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 13, color: "var(--primary)" }} />
                    <span style={{ fontSize: 11, color: "var(--down)", fontWeight: 800 }}>% SL</span>
                    <input value={autoTP} onChange={(e) => setAutoTP(+e.target.value.replace(/[^0-9.]/g, "") || 0)} inputMode="decimal" className="no-ring mono" style={{ width: 52, textAlign: "center", border: "none", background: "var(--elev)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 13, color: "var(--primary)" }} />
                    <span style={{ fontSize: 11, color: "var(--up)", fontWeight: 800 }}>% TP</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, opacity: .65, marginTop: 6 }}>Each pick uses its own target &amp; stop from Matrix's Top Picks.</div>
                )}
              </div>

              {/* SYMBOLS + MIN REWARD:RISK — pick which of today's symbols to auto-buy, and the minimum
                  target-to-stop ratio a pick must meet (like screeners). Empty selection = all picks. */}
              <div style={{ marginTop: 12, background: "var(--elev)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setSabSymOpen((v) => !v)} className="tap disp" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "var(--ink)", fontSize: 9.5, opacity: .85, fontWeight: 700, padding: 0, cursor: "pointer" }}>
                    SYMBOLS ({sabSyms.length === 0 ? "all" : sabSyms.length}) <ChevronDown size={12} style={{ transform: sabSymOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9.5, opacity: .8, fontWeight: 700 }}>MIN R:R</span>
                    <input value={sabMinRR} onChange={(e) => setSabMinRR(Math.max(0, +String(e.target.value).replace(/[^0-9.]/g, "") || 0))} inputMode="decimal" className="no-ring mono" style={{ width: 46, textAlign: "center", border: "none", background: "var(--surface)", borderRadius: 8, padding: "5px 4px", fontWeight: 800, fontSize: 13, color: "var(--primary)" }} />
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800 }}>: 1</span>
                  </div>
                </div>
                {sabSymOpen && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                    {autoPicksAll.map((s) => {
                      const on = sabSyms.length === 0 || sabSyms.includes(s.sym);
                      return (
                        <button key={s.sym} onClick={() => setSabSyms((prev) => prev.includes(s.sym) ? prev.filter((x) => x !== s.sym) : [...(prev.length ? prev : []), s.sym])} className="tap disp" style={{ border: "1px solid " + (on && sabSyms.includes(s.sym) ? "var(--primary)" : "var(--line)"), background: sabSyms.includes(s.sym) ? "var(--primary-soft)" : "var(--surface)", color: "var(--ink)", borderRadius: 999, padding: "5px 11px", fontWeight: 800, fontSize: 11 }}>{s.sym}</button>
                      );
                    })}
                    {sabSyms.length > 0 && <button onClick={() => setSabSyms([])} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)", borderRadius: 999, padding: "5px 11px", fontWeight: 800, fontSize: 11 }}>All</button>}
                  </div>
                )}
                <div style={{ fontSize: 10, opacity: .65, marginTop: 7 }}>Only picks whose target ÷ stop is at least {sabMinRR}:1 are bought. {autoTrades.length} of {autoPicksAll.length} qualify now.</div>
              </div>

              {/* capital — type then Save */}
              <div style={{ marginTop: 12, background: "var(--elev)", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, opacity: .8, fontWeight: 700 }}>CAPITAL TO DEPLOY ({CUR[aggCur]})</div>
                  <input value={capDraft} onChange={(e) => { setCapDraft(e.target.value.replace(/[^0-9]/g, "")); setCapSaved(false); }} inputMode="numeric" placeholder={capDefault(market)} className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--primary)", fontSize: 17, fontWeight: 800, marginTop: 2 }} />
                </div>
                <button
                  onClick={() => { setDeployCapital(capDraft); setCapSaved(true); setTimeout(() => setCapSaved(false), 2500); }}
                  disabled={capDraft === deployCapital}
                  className="tap disp"
                  style={{ flex: "0 0 auto", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 800, fontSize: 12.5, background: capDraft === deployCapital ? "var(--line)" : "var(--primary)", color: capDraft === deployCapital ? "var(--muted)" : "var(--on-primary)" }}
                >
                  {capSaved ? "Saved ✓" : "Save"}
                </button>
              </div>

              {/* Positions — REAL. Planned entries when Auto-Buy is off; live/closed
                  positions (with real P&L) once it is on. Nothing is simulated. */}
              <button onClick={() => setShowTrades((v) => !v)} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--elev)", color: "var(--primary)", border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                {showTrades ? "Hide positions" : (autoOn ? `Show Positions (${autoRows.filter((r) => !r.rejected).length})` : `Show Today's Plan (${autoTrades.length})`)}<ChevronRight size={15} style={{ transform: showTrades ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }} />
              </button>

              {showTrades && (autoOn ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Rejected orders aren't positions — they live under Orders, not here. */}
                  {autoRows.filter((t) => !t.rejected).length === 0 && <div style={{ fontSize: 11.5, opacity: .82, lineHeight: 1.6 }}>No auto-buy positions in this period yet. Positions are placed at real market prices and closed by the exit engine when a target or stop is actually hit.</div>}
                  {autoRows.filter((t) => !t.rejected).map((t) => {
                    const cyc = (t.market || marketOf(t.sym) || "IN");
                    const statusLabel = t.rejected ? "⛔ Order rejected" : t.status === "partial" ? "◑ PARTIAL" : t.open ? "● OPEN" : (t.exitType || "CLOSED");
                    const statusColor = t.rejected ? "var(--down)" : t.status === "partial" ? "#B26B00" : undefined;
                    return (
                    <div key={t.id} style={{ background: t.rejected ? "rgba(232,72,85,.12)" : "var(--elev)", borderRadius: 12, padding: "10px 12px", border: t.rejected ? "1px solid rgba(232,72,85,.4)" : "none" }}>
                      <div onClick={() => { const st = ALL.find((a) => a.sym === t.sym); st && onOpen(st); }} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{t.sym} <span style={{ fontSize: 10, opacity: .7, fontWeight: 600 }}>×{t.qty}</span></span>
                        <span style={{ fontSize: 9.5, opacity: .9, fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                        {!t.rejected && <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: t.realPnl >= 0 ? "var(--up)" : "var(--down)" }}>{t.realPnl >= 0 ? "+" : ""}{fmt(t.realPnl, cyc)}</span>}
                      </div>
                      {t.rejected ? (
                        <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--down)", lineHeight: 1.45 }}>
                          Order not placed{t.rejectReason ? ` — ${t.rejectReason}` : "."} {t.entryAt ? "· " + new Date(t.entryAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10, opacity: .82 }}>
                            <div><div style={{ opacity: .7 }}>Entry</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(t.entry, cyc)}</div><div style={{ opacity: .7 }}>{t.entryAt ? new Date(t.entryAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div></div>
                            <div style={{ textAlign: "right" }}><div style={{ opacity: .7 }}>{t.open ? "Current" : "Exit"}</div><div className="mono" style={{ fontWeight: 700 }}>{fmt(t.cur, cyc)}</div><div style={{ opacity: .7 }}>{t.open ? "position open" : (t.exitAt ? new Date(t.exitAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")}</div></div>
                          </div>
                          {(t.tp || t.sl) && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 10.5, fontWeight: 700 }}>🎯 Target <span style={{ color: "var(--up)" }}>+{t.tp}%</span> · 🛑 Stop <span style={{ color: "var(--down)" }}>−{t.sl}%</span></div>}
                        </>
                      )}
                    </div>
                  ); })}
                </div>
              ) : (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11, opacity: .8, lineHeight: 1.5 }}>Today's plan — these are the positions Smart Auto-Buy would enter at the live price, with the target/stop it would arm. Turn it on to place them for real.</div>
                  {autoTrades.map((t) => (
                    <div key={t.sym} style={{ background: "var(--elev)", borderRadius: 12, padding: "10px 12px" }}>
                      <div onClick={() => { const st = ALL.find((a) => a.sym === t.sym); st && onOpen(st); }} className="tap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span className="disp" style={{ fontWeight: 800, fontSize: 12.5 }}>{t.sym} <span style={{ fontSize: 10, opacity: .7, fontWeight: 600 }}>×{t.qty}</span></span>
                        <span className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(t.entry, t.m)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700 }}>🎯 Target <span style={{ color: "var(--up)" }}>+{t.tpPct}%</span> · 🛑 Stop <span style={{ color: "var(--down)" }}>−{t.slPct}%</span>{autoOverrides[t.sym] ? " · edited" : ""}</span>
                        <button onClick={() => setEditSym(editSym === t.sym ? null : t.sym)} className="tap" style={{ border: "none", background: "var(--elev)", borderRadius: 8, padding: 6, display: "grid", placeItems: "center", color: "var(--primary)" }}><Pencil size={12} /></button>
                      </div>
                      {editSym === t.sym && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "6px 9px" }}>
                            <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>TARGET %</div>
                            <input defaultValue={t.tpPct} onChange={(e) => setOv(t, "tp", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--primary)", fontSize: 13, fontWeight: 800 }} />
                          </div>
                          <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "6px 9px" }}>
                            <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>STOP %</div>
                            <input defaultValue={t.slPct} onChange={(e) => setOv(t, "sl", e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="no-ring mono" style={{ width: "100%", background: "transparent", border: "none", color: "var(--primary)", fontSize: 13, fontWeight: 800 }} />
                          </div>
                          <button onClick={() => setEditSym(null)} className="tap disp" style={{ alignSelf: "stretch", border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 10, padding: "0 14px", fontWeight: 800, fontSize: 12 }}>Done</button>
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
      )}

      {/* Matrix picks — Top Picks now ranks ABOVE Live Positions on the homepage. */}
      <Section title="Top Picks" icon={<Sparkles size={17} color="var(--primary-2)" />}>
        {/* An empty carousel is a void the user has to interpret. Say what's happening:
            picks need real indicators (RSI, 50-DMA), and those arrive after the prices. */}
        {picks.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 2px 8px", lineHeight: 1.5 }}>
            {list.some((s) => s.rsi != null)
              ? "No stock currently clears the signal bar in this market."
              : "Loading…"}
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
                  {s.pickTpPct != null && <span className="pill disp" title="Estimated move to Matrix's target level — an outlook, not a guarantee." style={{ marginLeft: "auto", flex: "0 0 auto", background: "var(--up-soft)", color: "var(--up)", fontWeight: 700, fontSize: 11, padding: "3px 9px" }}>{s.pickDir === "short" ? "−" : "+"}{s.pickTpPct}% potential</span>}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 19 }}>{fmt(s.price, market)}</span>
                  <span style={{ fontSize: 10.5, color: s.chg == null ? "var(--muted)" : s.chg >= 0 ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{s.chg == null ? "—" : (s.chg >= 0 ? "▲ " : "▼ ") + pct(s.chg, 2, false)}</span>{s.isFut ? <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{` · lot ${s.lot}`}</span> : null}
                </div>
                {/* REAL technical tags from the tag engine — Golden Cross, Bull Flag,
                    Breakout, Volume Spike and so on, each true and each backed by a
                    number. "Why?" opens the full evidence + verdict. */}
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center", overflow: "hidden" }}>
                  {(() => {
                    const isShort = s.pickDir === "short";
                    // SHORT picks lead with a red "Short" chip + the bearish signal; long picks show the
                    // real bullish tags (or a "Bullish setup" fallback).
                    if (isShort) {
                      const shown = [{ id: "short", label: "▼ Short", evidence: s.pickReason || "Bearish setup" }];
                      if (s.pickSignal) shown.push({ id: "sig", label: s.pickSignal, evidence: s.pickReason || "" });
                      return shown.map((t) => (
                        <span key={t.id} className="pill" title={t.evidence}
                          style={{ fontSize: 10, fontWeight: 800, background: "var(--down-soft, #fee2e2)", color: "var(--down, #dc2626)", padding: "3px 9px", whiteSpace: "nowrap", flex: "0 0 auto" }}>
                          {t.label}
                        </span>
                      ));
                    }
                    const ts = computeTags(s.under ? { ...s, sym: s.under } : s).slice(0, 3);
                    const shown = ts.length ? ts : [{ id: "bull", label: "Bullish setup", evidence: s.pickReason || "Qualified on real technicals" }];
                    return shown.map((t) => (
                      <span key={t.id} className="pill" title={t.evidence}
                        style={{ fontSize: 10, fontWeight: 800, background: "var(--up-soft, var(--primary-soft))", color: "var(--up, var(--primary))", padding: "3px 9px", whiteSpace: "nowrap", flex: "0 0 auto" }}>
                        {t.label}
                      </span>
                    ));
                  })()}
                </div>
                <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-soft, var(--ink))", lineHeight: 1.5, display: "flex", gap: 6 }}>
                  <Sparkles size={14} color="var(--primary)" style={{ flex: "0 0 auto", marginTop: 2 }} /><span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.pickReason || ""}</span>
                </div>
                {/* REAL stop / target from support-resistance + ATR */}
                {s.pickTarget != null && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>TARGET</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--up)" }}>{fmt(s.pickTarget, market)} <span style={{ fontSize: 9, opacity: .85 }}>{s.pickDir === "short" ? "−" : "+"}{s.pickTpPct}%</span></div>
                    </div>
                    <div style={{ flex: 1, background: "var(--elev)", borderRadius: 10, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>STOP</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: "var(--down)" }}>{fmt(s.pickStop, market)} <span style={{ fontSize: 9, opacity: .85 }}>{s.pickDir === "short" ? "+" : "−"}{s.pickSlPct}%</span></div>
                    </div>
                    {s.pickRR != null && <div style={{ flex: "0 0 auto", background: "var(--elev)", borderRadius: 10, padding: "7px 9px", display: "grid", placeItems: "center" }}>
                      <div style={{ fontSize: 8.5, opacity: .8, fontWeight: 700 }}>R:R</div>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 12.5 }}>{s.pickRR}</div>
                    </div>}
                  </div>
                )}
                {/* Potential left — favourable move still available from the live price to the target (like Ideas cards). */}
                {s.pickTarget != null && s.price != null && (() => {
                  const left = (s.pickDir === "short" ? -1 : 1) * ((s.pickTarget - s.price) / s.price) * 100;
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Potential left</span>
                      <span className="mono" style={{ fontWeight: 800, fontSize: 12.5, color: left > 0 ? "var(--up)" : "var(--muted)" }}>{left > 0 ? "+" + left.toFixed(1) + "%" : "target hit"}</span>
                    </div>
                  );
                })()}
                {/* Buy with explicit quantity; the pick's REAL stop & target are armed with it. Sits right
                    under the setup (no "auto" push) so there's no big empty gap above it. */}
                <div style={{ marginTop: 12, paddingTop: 0 }} onClick={(e) => e.stopPropagation()}>
                  <BuyButton
                    s={s}
                    market={market}
                    onBuy={onBuy}
                    opts={{ tp: s.pickTpPct, sl: s.pickSlPct, tradeType: "Manual" }}
                    variant="solid"
                    fullWidth
                    /* Picks are directional: a bearish pick shows Sell, otherwise Buy. Picks are
                       bullish by construction today, so this is Buy unless a short pick is flagged. */
                    only={(s.pickDir === "short" || s.bias === "bearish" || s.bearish) ? "sell" : "buy"}
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

      {/* OPERATIONAL STATUS — open positions + running strategies. Now ranked BELOW Top Picks on the homepage.
          Live Positions + Recent Activity share one tabbed section; Active Strategies shows top-3 by P&L. */}
      {!hideDash && (() => {
        const priceOf = (sym) => { const st = ALL.find((x) => x.sym === sym); return st && st.price != null ? st.price : null; };
        const opens = (trades || [])
          .filter((t) => (isReal ? !!t.real : !t.real) && t.exitAt == null && t.entry != null && t.status !== "rejected" && inMarket(t.sym, t.market))
          .map((t) => { const cur = priceOf(t.sym) ?? t.entry; const dir = (t.side === "SELL" || t.short) ? -1 : 1; return { ...t, cur, pl: (cur - Number(t.entry)) * (t.qty || 0) * dir }; })
          .sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
        const deployed = (strategies || []).filter((s) => s && s.active);
        const stratRows = deployed.map((s) => {
          const ts = (trades || []).filter((t) => (isReal ? !!t.real : !t.real) && (t.strategyId != null ? String(t.strategyId) === String(s.id) : t.strategy === s.name));
          const pl = ts.reduce((a, t) => { const closed = t.exitAt != null && t.exit != null; const cur = closed ? t.exit : (priceOf(t.sym) ?? t.entry); const dir = (t.side === "SELL" || t.short) ? -1 : 1; return a + (cur - Number(t.entry)) * (t.qty || 0) * dir; }, 0);
          return { s, pl, open: ts.filter((t) => t.exitAt == null).length };
        }).sort((a, b) => b.pl - a.pl);
        const hasAct = (trades || []).some((t) => (isReal ? !!t.real : !t.real) && t.entry != null && t.entryAt != null);
        if (!opens.length && !stratRows.length && !hasAct) return null;
        const gcols = "1.1fr .9fr .9fr .8fr";
        return (
          <>
            <LiveActivityTabs opens={opens} gcols={gcols} market={market} onGoPortfolio={onGoPortfolio} trades={trades} isReal={isReal} />
            {stratRows.length > 0 && (
              <Section title="Active Strategies" icon={<Zap size={17} color="var(--primary)" />}>
                <div style={{ background: "linear-gradient(150deg, rgba(219,234,254,.6) 0%, rgba(224,231,245,.55) 55%, rgba(226,232,240,.45) 100%)", border: "1px solid var(--line)", borderRadius: 16, padding: 12 }}>
                {stratRows.slice(0, 3).map(({ s, pl, open }) => (
                  <div key={s.id} onClick={onGoDeployed} className="tap" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 8, borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface)", cursor: onGoDeployed ? "pointer" : "default" }}>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      <div className="disp" style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name || (s.symbols && s.symbols[0]) || "Strategy"}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginTop: 1 }}>{open} open position{open === 1 ? "" : "s"}{s.paused ? " · paused" : ""}</div>
                    </div>
                    <div className="mono" style={{ flex: "0 0 auto", fontWeight: 800, fontSize: 13.5, color: pl >= 0 ? "var(--up)" : "var(--down)" }}>{(pl >= 0 ? "+" : "") + fmtPnl(pl, market)}</div>
                  </div>
                ))}
                {(stratRows.length > 3 || onGoDeployed) && (
                  <button onClick={onGoDeployed} className="tap disp" style={{ width: "100%", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 10, padding: "8px", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    Show all{stratRows.length > 3 ? ` (${stratRows.length})` : ""} <ChevronRight size={14} />
                  </button>
                )}
                </div>
              </Section>
            )}
          </>
        );
      })()}

      {/* Market updates summary — hidden on Crypto (news-driven brief doesn't fit 24/7 crypto). */}
      {market !== "Crypto" && (
      <Pop style={{ marginTop: 22 }}>
        <div className="card tint-green" style={{ padding: 15 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Newspaper size={15} color="var(--primary)" /> Market updates</div>
          <MarketBrief market={market} list={list} />
        </div>
      </Pop>
      )}

      {/* Ideas carousel — every market except Commodity (Crypto now included; the strip scans the crypto
         universe for bullish patterns and hides itself if none are found). */}
      {market !== "Commodity" && <StockIdeasStrip onOpen={onOpen} onBuy={onBuy} market={market} liveTick={liveTick} />}

      {/* Popular Screeners — 3 live-scanning strategy carousels, market-aware. */}
      <PopularScreeners variant="active" onOpenScreener={onOpenScreener} market={market} mode={mode} list={list} isAdmin={isAdmin} onOpen={onOpen} onBuy={onBuy} onAutoBuy={onAutoBuy} onScreenerBuy={onScreenerBuy} liveTick={liveTick} trades={trades} />

      {/* F&O Picks (Indian derivatives) */}

      {/* Market pulse strip — not for Commodity */}
      {market !== "Commodity" && <MarketPulseStrip market={market} list={list} onOpen={onOpen} liveTick={liveTick} />}

      {/* Earnings — Recent & Upcoming (US calendar / India results; hides if no data) */}
      <EarningsSection market={market} onOpen={(sym) => { const st = list.find((x) => x.sym === sym); if (st) onOpen(st); }} />

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
          <div className="card tint-lavender" style={{ padding: "4px 14px" }}>
            {(glMode === "Gainers" ? gainers : losers).map((s) => <ListRow key={s.sym} s={s} market={market} onOpen={onOpen} />)}
          </div>
        </Section>
      )}

      {/* Sector heatmap — below Gainers & Losers. Not for Commodity (a handful of COMEX/NYMEX
          contracts, no real sector breakdown to show). */}
      {market !== "Commodity" && market !== "Crypto" && <SectorHeatmap market={market} list={list} />}


      {/* In the news — REAL headlines fetched live. Hidden on Crypto (headline coverage for coins is
          thin and noisy; the crypto page stays price-driven). */}
      {market !== "Crypto" && <LiveNewsStrip symbols={inNews.map((s) => s.sym)} onOpen={onOpen} onBuy={onBuy} list={list} market={market} />}

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
