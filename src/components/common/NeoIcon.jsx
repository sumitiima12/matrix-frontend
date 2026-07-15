import React from "react";

/**
 * NeoIcon — a simple AI-assistant (bot) mark in the same clean line style as the other
 * bottom-bar icons. Strokes with `currentColor` and no fill, so it inherits the nav's
 * muted/active colour and matches the siblings in both light and dark themes. Accepts
 * `size`; harmlessly ignores lucide-style `fill`/`color` props.
 */
export default function NeoIcon({ size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Neo"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
