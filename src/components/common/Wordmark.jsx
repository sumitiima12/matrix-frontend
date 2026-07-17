import React from "react";

/**
 * Wordmark — the "Matrix One" logo as live text, not an image.
 *
 * Styled like the Android One lockup: "Matrix" in a heavy display weight sitting
 * flush against "One" in a light weight. Rendered in `currentColor` so it recolours
 * itself for light/dark themes and for the black splash — one component, every surface,
 * no separate PNG per theme.
 *
 * @param height  the visual cap-height target in px (font-size is derived from it)
 * @param color   overrides the colour (defaults to the inherited text colour)
 */
export default function Wordmark({ height = 30, color, style = {} }) {
  const fs = Math.round(height * 0.92);
  return (
    <span
      className="disp"
      aria-label="Matrix One"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        fontSize: fs,
        lineHeight: 1,
        letterSpacing: "-0.015em",
        whiteSpace: "nowrap",
        color: color || "var(--ink)",
        ...style,
      }}
    >
      <span style={{ fontWeight: 800 }}>Matrix</span>
      <span style={{ fontWeight: 300, marginLeft: Math.round(fs * 0.12), opacity: 0.92 }}>One</span>
    </span>
  );
}
