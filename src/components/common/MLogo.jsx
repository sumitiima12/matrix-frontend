import React from "react";

/**
 * MLogo — the MatrixOne brand mark. A custom geometric "M" in a rounded tile, using the
 * app's primary gradient. Replaces the old ✦ star (which read as a generic AI sparkle).
 * Size is configurable; defaults suit the header.
 */
export default function MLogo({ size = 30, radius }) {
  const r = radius != null ? radius : size * 0.28;
  const id = "mlogo-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="MatrixOne">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
      {/* Rounded tile */}
      <rect x="2" y="2" width="96" height="96" rx={r} fill={`url(#${id})`} />
      {/* The "M" — drawn as a bold stroke so it reads at small sizes */}
      <path
        d="M24 74 V30 L50 58 L76 30 V74"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
