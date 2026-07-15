import React from "react";

/**
 * MLogo — the MatrixOne brand mark. Strict monochrome: a thin white ring with a clean white
 * "M" inside. No fill, no colour — minimal and works on any background.
 */
export default function MLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="MatrixOne">
      {/* Ring — uses currentColor so it inherits the header's ink colour in both themes */}
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
      {/* The M */}
      <path
        d="M32 66 V34 L50 54 L68 34 V66"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
