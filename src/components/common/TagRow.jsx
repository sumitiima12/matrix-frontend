import React from "react";
import { computeTags } from "../../domain/tags";

/**
 * TagRow — the technical tags under a price.
 *
 * Renders nothing at all when there are no true tags. An instrument with no
 * signal gets no badge, rather than a filler like "Neutral" — a neutral tag is
 * just noise dressed up as information.
 */
const TONE = {
  bull: { bg: "rgba(15,185,125,.12)", fg: "var(--up)" },
  bear: { bg: "rgba(232,72,85,.12)", fg: "var(--down)" },
  warn: { bg: "rgba(232,163,61,.14)", fg: "#B87514" },
};

export default function TagRow({ s, max = 3, size = "sm", onWhy }) {
  const tags = computeTags(s).slice(0, max);
  if (!tags.length) return null;

  const pad = size === "sm" ? "3px 7px" : "5px 10px";
  const fs = size === "sm" ? 9.5 : 11;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      {tags.map((t) => {
        const tone = TONE[t.tone] || TONE.bull;
        return (
          <span
            key={t.id}
            title={t.evidence}
            style={{
              background: tone.bg, color: tone.fg, borderRadius: 7,
              padding: pad, fontSize: fs, fontWeight: 800, whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </span>
        );
      })}
      {onWhy && (
        <button
          onClick={(e) => { e.stopPropagation(); onWhy(s); }}
          className="tap"
          style={{
            border: "1px solid var(--line)", background: "transparent", color: "var(--muted)",
            borderRadius: 7, padding: pad, fontSize: fs, fontWeight: 800, cursor: "pointer",
          }}
        >
          Why?
        </button>
      )}
    </div>
  );
}
