import React from "react";
import { fmt } from "../../lib/format";
import { recTone } from "../../services/researchService";

/**
 * ResearchVerdict — the AI Copilot's structured output. Never prose.
 *
 * Renders the schema from researchService: recommendation, confidence, thesis,
 * real entry/stop/target/R:R, holding period, bull case, bear case, risks and
 * things to watch.
 *
 * The levels shown here are computed by Matrix's engine from real
 * support/resistance + ATR — the model only supplies the reasoning.
 */
export default function ResearchVerdict({ a, market = "IN" }) {
  if (!a) return null;

  const tone = recTone(a.recommendation);
  const col = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--muted)";

  const Bullets = ({ title, items, dot }) =>
    !items || !items.length ? null : (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</div>
        {items.map((x, i) => (
          <div key={i} style={{ display: "flex", gap: 7, marginTop: 6, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>
            <span style={{ flex: "0 0 auto", color: dot }}>•</span>
            <span>{x}</span>
          </div>
        ))}
      </div>
    );

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="pill disp" style={{ fontSize: 13, fontWeight: 800, padding: "6px 14px", background: col, color: "#fff" }}>
          {a.recommendation}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>
            <span>CONFIDENCE</span>
            <span className="mono">{a.confidence}%</span>
          </div>
          <div style={{ height: 6, background: "var(--elev)", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
            <div style={{ width: `${a.confidence}%`, height: "100%", background: col, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.65, marginTop: 12 }}>{a.thesis}</div>

      {a.target != null && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[["Entry", a.entry, "var(--ink)"], ["Stop", a.stop, "var(--down)"], ["Target", a.target, "var(--up)"]].map(([k, v, c]) => (
            <div key={k} style={{ flex: 1, background: "var(--elev)", borderRadius: 11, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>{k.toUpperCase()}</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: c }}>{fmt(v, market)}</div>
            </div>
          ))}
          {a.rr != null && (
            <div style={{ flex: "0 0 auto", background: "var(--elev)", borderRadius: 11, padding: "8px 10px", display: "grid", placeItems: "center" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800 }}>R:R</div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{a.rr}</div>
            </div>
          )}
        </div>
      )}

      {a.holdingPeriod && a.holdingPeriod !== "n/a" && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, fontWeight: 600 }}>
          ⏱ Expected holding period: <b style={{ color: "var(--ink)" }}>{a.holdingPeriod}</b>
        </div>
      )}

      <Bullets title="Bull case" items={a.bullCase} dot="var(--up)" />
      <Bullets title="Bear case" items={a.bearCase} dot="var(--down)" />
      <Bullets title="Key risks" items={a.risks} dot="#F59E0B" />
      <Bullets title="Things to watch" items={a.watch} dot="var(--primary)" />

      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        {a.source === "ai"
          ? "AI reasoning over real market data · levels computed by Matrix's engine"
          : a.source === "rules"
          ? "Rules-based verdict from real indicators (AI engine unreachable)"
          : "No live data available"}
        {" "}· Educational research, not financial advice.
      </div>
    </div>
  );
}
