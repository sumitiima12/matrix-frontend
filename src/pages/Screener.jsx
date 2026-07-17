import React, { useRef, useState } from "react";
import { METRICS, OPS, indValue, matchScreen, parseScreen } from "../domain/screener";
import ListRow from "../components/cards/ListRow";
import { selStyle } from "../components/common/styles";
import WatchAddButton from "../components/common/WatchAddButton";
import { Filter, Plus, Trash2 } from "lucide-react";
import { aiInterpretScreen } from "../domain/api";

/**
 * Screener — multi-condition scans over real indicator data.
 */

export default function Screener({ onOpen, market, list, watchlists, addToWatch, createWatchlist }) {
  const [filters, setFilters] = useState([{ m: "rsi", o: ">", rhsType: "value", v: "50", rhs: "sma50" }]);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [parsedNote, setParsedNote] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const recommended = [
    { label: "Momentum movers", f: [{ m: "rsi", o: ">", v: "60" }, { m: "chg", o: ">", v: "1" }] },
    { label: "Value with growth", f: [{ m: "pe", o: "<", v: "30" }, { m: "revGrowth", o: ">", v: "8" }] },
    { label: "Oversold bounce", f: [{ m: "rsi", o: "<", v: "35" }] },
    { label: "EMA 21 > EMA 50", f: [{ m: "ema20", o: ">", rhsType: "indicator", rhs: "ema50" }] },
  ];
  const [selRec, setSelRec] = useState(null);
  const cmp = (o, x, y) => o === ">" ? x > y : o === "<" ? x < y : o === ">=" ? x >= y : o === "<=" ? x <= y : Math.abs(x - y) < 1e-6;
  const apply = (fs) => {
    const ok = list.filter((s) => fs.every((f) => {
      const x = indValue(s, f.m);
      const y = f.rhsType === "indicator" ? indValue(s, f.rhs) : parseFloat(f.v);
      if (x == null || isNaN(x) || y == null || isNaN(y)) return true;
      return cmp(f.o, x, y);
    }));
    setResults(ok);
  };
  const [timedOut, setTimedOut] = useState(false);
  const cancelled = useRef(null);   // a chip tap cancels the in-flight interpretation

  /* Every one of these is parsed LOCALLY — no backend, no AI, no waiting. We only
     suggest prompts we know for a fact will work; suggesting something that also
     fails would be worse than saying nothing. */
  const SUGGESTIONS = [
    "RSI > 60",
    "RSI below 30",
    "ADX > 25",
    "price above 200-DMA",
    "RSI > 60 and ADX > 25",
    "banking stocks with RSI > 55",
  ];

  const useSuggestion = (q) => {
    cancelled.current = text;      // ignore whatever the model was chewing on
    setText(q);
    setTimedOut(false);
    const res = parseScreen(q);
    setParsedNote("Applied: " + res.note.join(" · "));
    setResults(matchScreen(list, res));
  };

  const runScreener = async () => {
    if (text.trim()) {
      setSelRec(null);
      const res = parseScreen(text);
      if (res.sectors.length || res.caps.length || res.conds.length || res.dma) {
        setParsedNote("Applied: " + res.note.join(" · "));
        setResults(matchScreen(list, res));
        return;
      }
      /* Fall back to the LLM — but on a LEASH. It used to be a bare await, so if
         the backend was cold-starting, missing a key, or just slow, the button sat
         on "Interpreting…" forever with no way out. Two seconds, then we give up
         and say so. Whichever finishes first wins. */
      setAiBusy(true);
      setParsedNote("Asking Neo to interpret…");
      setTimedOut(false);

      /* Don't THROW AWAY a slow answer — just stop blocking on it. If the model
         comes back after we've already offered the fallback chips, apply it then.
         The server is pre-warmed on app load, so 5s is generous; the old 2s was
         racing a cold Render instance, not Groq. */
      const pending = aiInterpretScreen(text).catch(() => null);

      pending.then((late) => {
        if (late && late.length && cancelled.current !== text) {
          setFilters(late);
          setTimedOut(false);
          setParsedNote("Neo interpreted: " + late.map((c) => `${c.m} ${c.o} ${c.rhsType === "indicator" ? c.rhs : c.v}${c.tf && c.tf !== "1d" ? " · " + c.tf : ""}`).join(" · "));
          apply(late);
        }
      });

      const conds = await Promise.race([
        pending,
        new Promise((r) => setTimeout(() => r("TIMEOUT"), 5000)),
      ]);
      setAiBusy(false);

      if (conds && conds !== "TIMEOUT" && conds.length) {
        setFilters(conds);
        setParsedNote("Neo interpreted: " + conds.map((c) => `${c.m} ${c.o} ${c.rhsType === "indicator" ? c.rhs : c.v}${c.tf && c.tf !== "1d" ? " · " + c.tf : ""}`).join(" · "));
        apply(conds);
      } else {
        setParsedNote(conds === "TIMEOUT"
          ? "Couldn't interpret that in time."
          : "Couldn't interpret that.");
        setTimedOut(true);
        setResults([]);
      }
    } else { setParsedNote(null); apply(filters); }
  };
  const upd = (i, k, val) => setFilters((p) => p.map((f, j) => j === i ? { ...f, [k]: val } : f));
  return (
    <div className="mx fade">
      <div className="disp" style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>Screener</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Build rules from technicals, fundamentals or events.</div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "16px 2px 8px" }}>Recommended</div>
      <div className="hide-scroll" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {recommended.map((r) => (
          <button key={r.label} onClick={() => { setFilters(r.f); setText(""); setParsedNote(null); setSelRec(r.label); apply(r.f); }} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid " + (selRec === r.label ? "var(--primary)" : "var(--line)"), background: selRec === r.label ? "var(--primary)" : "var(--surface)", color: selRec === r.label ? "var(--on-primary)" : "var(--ink)", fontSize: 12.5, fontWeight: selRec === r.label ? 800 : 600, padding: "9px 14px" }}>{r.label}</button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 14 }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Build your own</div>
        {filters.map((f, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 9, marginBottom: 8, background: "var(--elev)" }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <select aria-label="Metric" value={f.m} onChange={(e) => upd(i, "m", e.target.value)} style={{ ...selStyle, flex: 1, minWidth: 0 }}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select aria-label="Comparator" value={f.o} onChange={(e) => upd(i, "o", e.target.value)} style={{ ...selStyle, flex: "0 0 54px" }}>{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              {(f.rhsType || "value") === "value"
                ? <input value={f.v} onChange={(e) => upd(i, "v", e.target.value)} style={{ ...selStyle, flex: "0 0 70px" }} className="no-ring" placeholder="value" />
                : <select aria-label="Compare against" value={f.rhs || "sma50"} onChange={(e) => upd(i, "rhs", e.target.value)} style={{ ...selStyle, flex: 1, minWidth: 0 }}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
              <button onClick={() => setFilters((p) => p.filter((_, j) => j !== i))} className="tap" style={{ border: "none", background: "transparent", flex: "0 0 auto" }}><Trash2 size={16} color="var(--down)" /></button>
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 7 }}>
              <div className="pill" style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--line)", padding: 2 }}>
                {[["value", "vs value"], ["indicator", "vs indicator"]].map(([k, l]) => (
                  <button key={k} onClick={() => upd(i, "rhsType", k)} className="pill tap" style={{ padding: "5px 9px", fontSize: 10, fontWeight: 800, border: "none", background: (f.rhsType || "value") === k ? "var(--primary)" : "transparent", color: (f.rhsType || "value") === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
                ))}
              </div>
              <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginLeft: "auto" }}>TF</span>
            </div>
          </div>
        ))}
        <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginRight: 8 }}>
          Screening on daily indicators
        </span>
        <button onClick={() => setFilters((p) => [...p, { m: "ema20", o: ">", rhsType: "indicator", rhs: "ema50", v: "" }])} className="tap" style={{ border: "1px dashed var(--line)", background: "transparent", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--primary)", display: "flex", gap: 5, alignItems: "center" }}><Plus size={15} /> Add condition</button>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Or write a prompt</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. large-cap IT stocks with RSI under 40 and rising revenue" className="no-ring"
          style={{ width: "100%", marginTop: 6, border: "1px solid var(--line)", borderRadius: 12, padding: 11, fontSize: 13, minHeight: 60, resize: "vertical" }} />

        <button onClick={runScreener} disabled={aiBusy} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: aiBusy ? 0.6 : 1 }}><Filter size={16} /> {aiBusy ? "Interpreting…" : "Run screener"}</button>
        {parsedNote && <div style={{ fontSize: 11, color: parsedNote.startsWith("Applied") || parsedNote.startsWith("AI interpreted") ? "var(--up)" : "var(--amber)", marginTop: 8, fontWeight: 600, lineHeight: 1.5 }}>{parsedNote.startsWith("Applied") || parsedNote.startsWith("AI interpreted") ? "✓ " : "⚠ "}{parsedNote}</div>}

        {timedOut && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 7 }}>
              Try one of these — they run instantly, no AI needed:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => useSuggestion(q)}
                  className="tap mono"
                  style={{ border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {results && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{results.length} match{results.length !== 1 ? "es" : ""}</div>
          <div className="card" style={{ padding: "4px 12px" }}>
            {results.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No stocks match these rules. Try loosening a filter.</div>
              : results.map((s) => (
                <div key={s.sym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><ListRow s={s} market={market} onOpen={onOpen} /></div>
                  {addToWatch && <WatchAddButton sym={s.sym} watchlists={watchlists} onAdd={addToWatch} onCreate={createWatchlist} />}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== VIRTUAL TRADE ============================== */
