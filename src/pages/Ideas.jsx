import React, { useEffect, useMemo, useState } from "react";
import { currentIdeas, resolveIdea } from "../domain/ideas";
import { BACKEND_URL } from "../config";
import { fmt } from "../lib/format";
import { ALL, marketOf, UNIVERSE } from "../domain/universe";
import { fetchHistory, apiListIdeas, apiPostIdea, apiDeleteIdea, apiReviewIdea } from "../domain/api";
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2, X } from "lucide-react";
import MiniCandles from "../components/charts/MiniCandles";
import { selStyle } from "../components/common/styles";
import BuyButton from "../components/common/BuyButton";
import TagRow from "../components/common/TagRow";

/**
 * Ideas — trade ideas published by Matrix, scored against real candles.
 */

function IdeasDashboard({ ideas, collapsed = false, onExpand, signupAt = null }) {
  const [postedBy, setPostedBy] = useState("Neo");
  const [range, setRange] = useState(365);
  const [cap, setCap] = useState(100000);
  const [symF, setSymF] = useState("All");
  const postedByOptions = useMemo(() => ["All", ...Array.from(new Set(ideas.map((i) => i.by).filter(Boolean)))], [ideas]);
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

  /* VIRTUAL performance: we assume EVERY idea published on/after the user's sign-up date
     was executed at its entry, and mark it to its outcome — a realized win/loss if the
     target or stop was hit, otherwise the live mark-to-market. So open positions count as
     trades too (their unrealised return is real, just not yet closed). */
  const signupCutoff = signupAt || 0;
  const all = ideas
    .map((id) => ({ id, o: outcomes[id.sym] }))
    .filter(({ id, o }) => o &&
      (postedBy === "All" || id.by === postedBy) &&
      (symF === "All" || id.sym === symF) &&
      ((id.publishedAt || 0) >= signupCutoff) &&
      o.daysAgo <= range);
  const n = all.length;                                   // every idea is an assumed trade
  const isWin = (r) => (r.o.status === "closed" ? r.o.win : r.o.ret >= 0);
  const wins = all.filter(isWin).length;
  const losses = n - wins;
  const openN = all.filter((r) => r.o.status !== "closed").length;
  const avg = n ? all.reduce((a, r) => a + r.o.ret, 0) / n : 0;
  const total = (all.reduce((a, r) => a * (1 + r.o.ret / 100), 1) - 1) * 100;
  const netPnl = cap * (total / 100);
  const winRate = n ? (wins / n) * 100 : 0;

  /* Period label: for an account younger than 3 months we show "Since Jul'26"; once it's
     older, we show the selected range window ("last 3 months", etc.). */
  const monthTag = (ts) => new Date(ts).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }).replace(" ", "'");
  const ageMonths = signupAt ? (Date.now() - signupAt) / (30 * 864e5) : Infinity;
  const rangeText = ({ 30: "last 30 days", 90: "last 3 months", 180: "last 6 months", 365: "last 12 months" })[range] || `last ${range}d`;
  const periodLabel = (signupAt && ageMonths < 3) ? `Since ${monthTag(signupAt)}` : rangeText;
  const sel = { ...selStyle, flex: "1 1 0", minWidth: 0, padding: "8px 6px", fontSize: 11.5 };
  const Stat = ({ k, v, c }) => (
    <div style={{ flex: "1 1 30%", minWidth: 88, background: "rgba(255,255,255,.15)", borderRadius: 12, padding: "9px 11px" }}>
      <div style={{ fontSize: 9.5, opacity: .85, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 14.5, marginTop: 2, color: c || "#fff" }}>{v}</div>
    </div>
  );
  // Collapsed: just Win/Loss + P&L and an expand arrow.
  if (collapsed) {
    return (
      <button onClick={onExpand} className="tap disp card glow" style={{ width: "100%", marginTop: 14, border: "none", background: "radial-gradient(circle at 74% 20%, rgba(255,255,255,.28), transparent 46%), linear-gradient(135deg, #C4CBD0 0%, #A6AFB6 52%, #889199 100%)", color: "#fff", borderRadius: 24, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 10, opacity: .85, fontWeight: 700 }}>WIN / LOSS</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{wins} : {losses}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 10, opacity: .85, fontWeight: 700 }}>P&amp;L</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: netPnl >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{netPnl >= 0 ? "+" : ""}{fmt(netPnl, "IN")}</div>
        </div>
        <span style={{ marginLeft: "auto", display: "grid", placeItems: "center" }}><ChevronDown size={16} /></span>
      </button>
    );
  }
  return (
    <div className="card glow" style={{ marginTop: 14, padding: 16, border: "none", background: "radial-gradient(circle at 74% 20%, rgba(255,255,255,.28), transparent 46%), linear-gradient(135deg, #C4CBD0 0%, #A6AFB6 52%, #889199 100%)", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Ideas Dashboard</div>
        <span style={{ fontSize: 10.5, opacity: .85, marginRight: 34 }}>{periodLabel}</span>
      </div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 26, marginTop: 6, color: netPnl >= 0 ? "#9CFFD6" : "#FFB3BE" }}>{netPnl >= 0 ? "+" : ""}{fmt(netPnl, "IN")}</div>
      <div style={{ fontSize: 11, opacity: .85, marginTop: -2 }}>If every idea was traded with {fmt(cap, "IN")} · {openN} still open</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Stat k="Returns %" v={(avg >= 0 ? "+" : "") + avg.toFixed(2) + "%"} c={avg >= 0 ? "#9CFFD6" : "#FFB3BE"} />
        <Stat k="Win rate" v={n ? winRate.toFixed(0) + "%" : "—"} />
        <Stat k="Win / Loss" v={wins + " : " + losses} />
        <Stat k="Trades" v={n} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <select aria-label="Posted by" value={postedBy} onChange={(e) => setPostedBy(e.target.value)} style={sel}>{postedByOptions.map((b) => <option key={b} value={b}>Posted by: {b}</option>)}</select>
        <select aria-label="Range" value={range} onChange={(e) => setRange(+e.target.value)} style={sel}><option value={30}>30d</option><option value={90}>3m</option><option value={180}>6m</option><option value={365}>12m</option></select>
        <select aria-label="Capital" value={cap} onChange={(e) => setCap(+e.target.value)} style={sel}><option value={50000}>Capital: ₹50k</option><option value={100000}>Capital: ₹1L</option><option value={500000}>Capital: ₹5L</option><option value={1000000}>Capital: ₹10L</option></select>
        <select aria-label="Symbol" value={symF} onChange={(e) => setSymF(e.target.value)} style={sel}><option value="All">Symbol: All</option>{ALL.map((a) => <option key={a.sym} value={a.sym}>{a.sym}</option>)}</select>
      </div>
    </div>
  );
}

/* Community ideas — anyone can post; everyone sees them. Filters by symbol and poster. */
function CommunityIdeas({ market, me, isAdmin, adminKey = "", onOpen }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fBy, setFBy] = useState("");
  const [fSym, setFSym] = useState("");
  const [sym, setSym] = useState("");
  const [dir, setDir] = useState("Long");
  const [note, setNote] = useState("");
  const [tgt, setTgt] = useState("");
  const [stp, setStp] = useState("");
  const [tags, setTags] = useState([]);       // up to 4 short tags
  const [tagIn, setTagIn] = useState("");
  const [shot, setShot] = useState(null);     // screenshot data URL
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const symOptions = useMemo(() => (UNIVERSE[market] || []).map((s) => s.sym), [market]);
  const refresh = () => { setLoading(true); apiListIdeas({ symbol: fSym, by: fBy, adminKey: isAdmin ? adminKey : "" }).then((l) => { setList(Array.isArray(l) ? l : []); setLoading(false); }); };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [fSym, fBy]);
  const marketList = list.filter((i) => marketOf(i.symbol) === market);
  const byOptions = useMemo(() => Array.from(new Set(marketList.map((i) => i.owner_name).filter(Boolean))), [list, market]);
  const symFilterOptions = useMemo(() => Array.from(new Set(marketList.map((i) => i.symbol))), [list, market]);
  const addTag = () => { const t = tagIn.trim().replace(/^#/, "").slice(0, 24); if (t && tags.length < 4 && !tags.includes(t)) setTags([...tags, t]); setTagIn(""); };
  const onShot = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 1_400_000) { alert("Image too large — please use one under ~1.4MB."); return; }
    const rd = new FileReader(); rd.onload = () => setShot(String(rd.result)); rd.readAsDataURL(f);
  };
  const submit = async () => {
    if (!sym) return;
    setBusy(true);
    const r = await apiPostIdea({ symbol: sym, direction: dir, note, target: tgt, stop: stp, tags, screenshot: shot });
    setBusy(false);
    if (r && r.ok) { setSym(""); setNote(""); setTgt(""); setStp(""); setTags([]); setShot(null); setShowForm(false); setPosted(true); setTimeout(() => setPosted(false), 6000); refresh(); }
  };
  const del = async (id) => { await apiDeleteIdea(id); refresh(); };
  const reviewIt = async (id, status) => { await apiReviewIdea(id, status, adminKey); refresh(); };
  const sel = { ...selStyle, flex: "1 1 0", minWidth: 0, fontSize: 11.5 };
  const dt = (t) => { try { return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return ""; } };
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 16 }}>Community ideas</div>
        <button onClick={() => setShowForm((v) => !v)} className="tap disp" style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--primary)", background: showForm ? "var(--primary-soft)" : "var(--primary)", color: showForm ? "var(--primary)" : "#fff", borderRadius: 11, padding: "8px 12px", fontWeight: 800, fontSize: 12 }}>{showForm ? <><X size={14} /> Close</> : <><Plus size={15} /> Post an idea</>}</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          {!me && <div style={{ fontSize: 11.5, color: "var(--amber, #F59E0B)", fontWeight: 600, marginBottom: 8 }}>Sign in to post an idea.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <select value={sym} onChange={(e) => setSym(e.target.value)} aria-label="Symbol" style={sel}><option value="">Symbol…</option>{symOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Direction" style={sel}><option>Long</option><option>Short</option></select>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this trade? (thesis, levels…)" className="no-ring" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 64, background: "var(--elev)", color: "var(--ink)", marginTop: 8, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={tgt} onChange={(e) => setTgt(e.target.value)} placeholder="Target (optional)" className="no-ring mono" style={{ ...sel, textAlign: "center" }} />
            <input value={stp} onChange={(e) => setStp(e.target.value)} placeholder="Stop loss (optional)" className="no-ring mono" style={{ ...sel, textAlign: "center" }} />
          </div>
          {/* Tags — up to 4. */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            {tags.map((t) => <span key={t} className="pill" style={{ fontSize: 10.5, fontWeight: 700, background: "var(--primary-soft)", color: "var(--primary)", padding: "3px 9px", display: "inline-flex", gap: 4, alignItems: "center" }}>#{t}<X size={11} className="tap" onClick={() => setTags(tags.filter((x) => x !== t))} /></span>)}
            {tags.length < 4 && <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="+ tag" className="no-ring" style={{ ...sel, flex: "0 0 90px", fontSize: 11.5 }} />}
          </div>
          {/* Screenshot (optional). */}
          <div style={{ marginTop: 8 }}>
            {shot
              ? <div style={{ position: "relative", display: "inline-block" }}><img src={shot} alt="idea" style={{ maxHeight: 120, borderRadius: 10, border: "1px solid var(--line)" }} /><button onClick={() => setShot(null)} className="tap" style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: 8, padding: "2px 6px", fontSize: 11 }}>Remove</button></div>
              : <label className="tap disp" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed var(--line)", borderRadius: 10, padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>📎 Add a screenshot<input type="file" accept="image/*" onChange={onShot} style={{ display: "none" }} /></label>}
          </div>
          <button onClick={submit} disabled={busy || !sym || !me} className="tap disp glow" style={{ width: "100%", marginTop: 10, background: (sym && me) ? "linear-gradient(120deg,var(--primary),var(--primary-2))" : "var(--elev)", color: (sym && me) ? "#fff" : "var(--muted)", border: "none", borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 13 }}>{busy ? "Posting…" : "Post idea"}</button>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>Posted as @{me || "you"} · goes live after admin approval.</div>
        </div>
      )}
      {posted && <div className="card" style={{ padding: 11, marginBottom: 10, background: "var(--up-soft)", color: "var(--up)", fontSize: 12, fontWeight: 700, textAlign: "center" }}>Idea submitted — it'll appear once an admin approves it.</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <select value={fSym} onChange={(e) => setFSym(e.target.value)} aria-label="Symbol filter" style={sel}><option value="">Symbol: All</option>{symFilterOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={fBy} onChange={(e) => setFBy(e.target.value)} aria-label="Posted by filter" style={sel}><option value="">Posted by: All</option>{byOptions.map((b) => <option key={b} value={b}>{b}</option>)}</select>
      </div>

      {loading ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>Loading ideas…</div>
        : marketList.length === 0 ? <div className="card" style={{ marginTop: 10, padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>No community ideas here yet — be the first to post one.</div>
        : marketList.map((idea) => {
          const s = ALL.find((a) => a.sym === idea.symbol);
          const canDel = isAdmin || (me && idea.owner_name === me);
          return (
            <div key={idea.id} className="card" style={{ marginTop: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span onClick={() => s && onOpen(s)} className="disp tap" style={{ fontWeight: 700, fontSize: 14 }}>{idea.symbol}</span>
                  <span className="pill" style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", background: idea.direction === "Short" ? "var(--down-soft)" : "var(--up-soft)", color: idea.direction === "Short" ? "var(--down)" : "var(--up)" }}>{idea.direction}</span>
                </div>
                <span style={{ fontSize: 10.5, color: "var(--muted)", flex: "0 0 auto" }}>by @{idea.owner_name || "user"} · {dt(idea.created_at)}</span>
              </div>
              {idea.status && idea.status !== "approved" && (
                <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", marginTop: 6, display: "inline-block", background: idea.status === "rejected" ? "var(--down-soft)" : "var(--amber-soft, rgba(245,158,11,.15))", color: idea.status === "rejected" ? "var(--down)" : "var(--amber, #F59E0B)" }}>{idea.status === "rejected" ? "REJECTED" : "PENDING REVIEW"}</span>
              )}
              {idea.note && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft, var(--ink))", marginTop: 8 }}>{idea.note}</div>}
              {Array.isArray(idea.tags) && idea.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                  {idea.tags.map((t) => <span key={t} className="pill" style={{ fontSize: 9.5, fontWeight: 700, background: "var(--elev)", color: "var(--muted)", padding: "2px 8px" }}>#{t}</span>)}
                </div>
              )}
              {idea.screenshot && <img src={idea.screenshot} alt="idea" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", marginTop: 8 }} />}
              {(idea.target || idea.stop) && (
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11.5 }}>
                  {idea.target && <span style={{ color: "var(--muted)" }}>Target <b className="mono" style={{ color: "var(--up)" }}>{idea.target}</b></span>}
                  {idea.stop && <span style={{ color: "var(--muted)" }}>Stop <b className="mono" style={{ color: "var(--down)" }}>{idea.stop}</b></span>}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {isAdmin && idea.status !== "approved" && <button onClick={() => reviewIt(idea.id, "approved")} className="tap" style={{ border: "1px solid var(--up)", background: "var(--up-soft)", color: "var(--up)", borderRadius: 9, padding: "5px 12px", fontSize: 11, fontWeight: 800 }}>✓ Approve</button>}
                {isAdmin && idea.status !== "rejected" && <button onClick={() => reviewIt(idea.id, "rejected")} className="tap" style={{ border: "1px solid var(--down)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "5px 12px", fontSize: 11, fontWeight: 800 }}>Reject</button>}
                {canDel && <button onClick={() => del(idea.id)} className="tap" title="Delete" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "5px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex", gap: 5, alignItems: "center" }}><Trash2 size={12} /> Delete</button>}
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default function Ideas({ onOpen, onBuy, market = "IN", onWhy, me = null, isAdmin = false, adminKey = "", signupAt = null }) {
  const [dashOpen, setDashOpen] = useState(false);
  const [view, setView] = useState("all");   // "all" | "neo" | "community"
  // Recomputed from real data as it arrives, rather than frozen at import time.
  const [ideas, setIdeas] = useState(currentIdeas);
  useEffect(() => {
    const id = setInterval(() => setIdeas(currentIdeas()), 30000);
    return () => clearInterval(id);
  }, []);
  const [open, setOpen] = useState(false);
  const mkt = market;
  /* Ordered by POTENTIAL LEFT to the target, measured off the live price — so the
     ideas with the most room still to run lead, and ones that already hit sink. */
  const shown = ideas
    .filter((i) => marketOf(i.sym) === mkt)
    .map((i) => {
      const st = ALL.find((a) => a.sym === i.sym);
      const cur = st && st.price != null ? st.price : i.entry;
      return { i, left: cur ? ((i.exit - cur) / cur) * 100 : -Infinity };
    })
    .sort((a, b) => b.left - a.left)
    .map((x) => x.i);
;
  return (
    <div className="mx fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div><div className="disp" style={{ fontWeight: 700, fontSize: 20 }}>Ideas</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{{ IN: "🇮🇳 Indian", US: "🇺🇸 US", Crypto: "₿ Crypto", FNO: "⚡ F&O", Commodity: "🪙 Commodity" }[market]}</div></div>
      </div>

      {/* Source tabs — All (Neo + community), Neo only, or community only. */}
      <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginTop: 12 }}>
        {[["all", "All"], ["neo", "Neo"], ["community", "Community"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: view === k ? "var(--primary)" : "transparent", color: view === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
        ))}
      </div>

      {view !== "community" && (!dashOpen ? (
        <IdeasDashboard ideas={shown} collapsed onExpand={() => setDashOpen(true)} signupAt={signupAt} />
      ) : (
        <div style={{ position: "relative" }}>
          <IdeasDashboard ideas={shown} signupAt={signupAt} />
          <button onClick={() => setDashOpen(false)} className="tap" title="Collapse" style={{ position: "absolute", top: 14, right: 16, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.18)", color: "#fff", borderRadius: 10, padding: "6px", fontWeight: 800 }}><ChevronUp size={14} /></button>
        </div>
      ))}
      {view !== "community" && shown.length === 0 && <div className="card" style={{ marginTop: 12, padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No Neo ideas for this market yet. Switch markets from the tabs above, or check the Community tab.</div>}
      {view !== "community" && shown.map((idea, i) => {
        const s = ALL.find((a) => a.sym === idea.sym); const m = marketOf(idea.sym);
        return (
          <div key={i} className="card" style={{ marginTop: 12, padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="pill" style={{ background: "var(--primary-soft)", color: "var(--primary)", fontSize: 11, fontWeight: 700, padding: "3px 9px" }}>Neo</span>
                <span onClick={() => s && onOpen(s)} className="disp tap" style={{ fontWeight: 700, fontSize: 14 }}>{idea.sym}</span>
              </div>
              <span className="pill disp" style={{ background: "var(--up-soft)", color: "var(--up)", fontWeight: 700, fontSize: 12.5, padding: "4px 11px" }}>+{idea.gain}% potential</span>
            </div>
            {s && (
              <div style={{ marginTop: 10 }}>
                <TagRow s={s} max={3} onWhy={null} />
              </div>
            )}
            <div style={{ marginTop: 10 }}><MiniCandles sym={idea.sym} price={s ? s.price : idea.entry} chg={s ? s.chg : 0} height={120} staticChart defaultTf={m === "Crypto" ? "1h" : "1d"} pattern={idea.pattern} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
              <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Entry</div><div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(idea.entry, m)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--muted)" }}>Current</div><div className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(s ? s.price : idea.entry, m)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "var(--muted)" }}>Target</div><div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(idea.exit, m)}</div></div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.55 }}>{idea.logic}</div>
            {s && onBuy && (
              <div style={{ marginTop: 12 }}>
                <BuyButton s={s} market={market} onBuy={onBuy} lot={s.lot || 1} fullWidth
                  opts={{ tp: idea.gain, sl: (idea.entry && idea.stop) ? +(((idea.entry - idea.stop) / idea.entry) * 100).toFixed(2) : undefined, tradeType: "Manual" }} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
              {onWhy ? (
                <button onClick={(e) => { e.stopPropagation(); onWhy(s, "Neo Idea — published today"); }} className="tap disp" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "var(--elev)", color: "var(--muted)", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Sparkles size={12} color="var(--primary)" /> Why this idea?</button>
              ) : <span />}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Potential left</div>
                {(() => { const cur = s ? s.price : idea.entry; const pl = (idea.exit - cur) / cur * 100; return <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: pl >= 0 ? "var(--up)" : "var(--muted)" }}>{pl >= 0 ? "+" + pl.toFixed(1) + "%" : "target hit"}</div>; })()}
              </div>
            </div>
          </div>
        );
      })}

      {view !== "neo" && <CommunityIdeas market={market} me={me} isAdmin={isAdmin} adminKey={adminKey} onOpen={onOpen} />}
    </div>
  );
}

/* ============================== BACKTEST ENGINE ============================== */
