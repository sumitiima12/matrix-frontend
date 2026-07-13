import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { analyzeStock } from "../../services/aiService";
import { techSignal } from "../../domain/signals";
import { computeTags } from "../../domain/tags";
import { fmt } from "../../lib/format";
import ResearchVerdict from "./ResearchVerdict";

/**
 * WhyPanel — "why is Matrix showing me this?", answerable from anywhere.
 *
 * The full research verdict (thesis, entry/stop/target, R:R, bull case, bear case,
 * risks) already existed in ResearchVerdict, but it was reachable ONLY by opening
 * a stock's detail page and tapping Deep Analysis. So the recommendation you were
 * actually being shown — on a Pick, an Idea, a Trending card — came with no way to
 * interrogate it. That is the opposite of an explainable system.
 *
 * This is a sheet that wraps the same pipeline and opens from any of them.
 *
 * It shows the EVIDENCE FIRST — the real, checkable numbers behind every tag —
 * and only then the LLM's reading of them. The evidence is not generated: it is
 * measured. If the model is unavailable, the evidence is still there, and it is
 * the part that matters.
 */
export default function WhyPanel({ s, market = "IN", context, onClose, onOpenStock }) {
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const tags = computeTags(s);
  const sig = techSignal(s);

  useEffect(() => {
    let stop = false;
    setAnalysis(null); setErr(false); setBusy(true);
    analyzeStock(s, sig, market)
      .then((v) => { if (!stop) setAnalysis(v); })
      .catch(() => { if (!stop) setErr(true); })
      .finally(() => { if (!stop) setBusy(false); });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.sym]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 120 }} />
      <div
        className="glass"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto",
          background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 121,
          maxHeight: "88vh", overflowY: "auto", padding: "16px 18px 28px",
          boxShadow: "0 -16px 44px rgba(0,0,0,.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".05em" }}>WHY THIS?</div>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{s.sym}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {s.name}{s.price != null ? ` · ${fmt(s.price, market)}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="tap" aria-label="Close"
            style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto" }}>
            <X size={16} />
          </button>
        </div>

        {context && (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 11, background: "var(--elev)", fontSize: 12, fontWeight: 700 }}>
            {context}
          </div>
        )}

        {/* THE EVIDENCE — measured, not generated. This is the honest core. */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".05em", marginBottom: 8 }}>
            WHAT THE DATA SAYS
          </div>

          {tags.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              No technical signal on this instrument right now. Nothing is being claimed.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tags.map((t) => (
                <div key={t.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{
                    flex: "0 0 auto", marginTop: 1,
                    background: t.tone === "bear" ? "rgba(232,72,85,.12)" : t.tone === "warn" ? "rgba(232,163,61,.14)" : "rgba(15,185,125,.12)",
                    color: t.tone === "bear" ? "var(--down)" : t.tone === "warn" ? "#B87514" : "var(--up)",
                    borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
                  }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>{t.evidence}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The engine's levels — computed from real support/resistance and ATR. */}
        {sig && sig.stop != null && sig.target != null && (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            {[["Entry", s.price], ["Stop", sig.stop], ["Target", sig.target]].map(([k, v]) => (
              <div key={k} style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "9px 10px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>{k.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{fmt(v, market)}</div>
              </div>
            ))}
            {sig.rr != null && (
              <div style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "9px 10px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>R:R</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{sig.rr}</div>
              </div>
            )}
          </div>
        )}

        {/* The model's reading of that evidence. Secondary, on purpose. */}
        <div style={{ marginTop: 20 }}>
          {busy && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Reading the evidence…</div>}
          {err && !busy && (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              The AI reading is unavailable right now — the measured evidence above is unaffected.
            </div>
          )}
          {analysis && !busy && <ResearchVerdict a={analysis} market={market} />}
        </div>

        {onOpenStock && (
          <button onClick={() => { onClose(); onOpenStock(s); }} className="tap disp"
            style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            Open {s.sym} →
          </button>
        )}
      </div>
    </>
  );
}
