import React from "react";

/**
 * MLogo — the Matrix One brand mark (v2).
 *
 * The angular twin-blade "M": two mirrored metallic blades that meet at a central
 * valley, split by a vertical light beam with a glowing core dot. Rendered as a
 * self-contained SVG (metallic silver gradient) so it reads crisply on any dark or
 * light surface and scales without loss. Used in the app header on every page.
 */
export default function MLogo({ size = 30 }) {
  // Unique gradient ids so multiple instances on one page never collide.
  // useId is called UNCONDITIONALLY (React 18 always provides it) — a ternary guard around a
  // hook is a Rules-of-Hooks violation.
  const uid = React.useId().replace(/:/g, "");
  const gid = `mlg-${uid}`;
  const bid = `mlb-${uid}`;
  const did = `mld-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Matrix One"
    >
      <defs>
        <linearGradient id={gid} x1="50" y1="6" x2="50" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#e9ebee" />
          <stop offset="0.62" stopColor="#b8bcc4" />
          <stop offset="1" stopColor="#8c9099" />
        </linearGradient>
        <linearGradient id={bid} x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={did} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The twin-blade M */}
      <path
        d="M10 12 L50 34 L90 12 L90 74 L80 90 L66 74 L50 56 L34 74 L20 90 L10 74 Z"
        fill={`url(#${gid})`}
        stroke="#5f636c"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Vertical light beam through the core */}
      <rect x="49.1" y="8" width="1.8" height="84" fill={`url(#${bid})`} />

      {/* Glowing core dot */}
      <circle cx="50" cy="45" r="7" fill={`url(#${did})`} />
      <circle cx="50" cy="45" r="2.4" fill="#ffffff" />
    </svg>
  );
}
