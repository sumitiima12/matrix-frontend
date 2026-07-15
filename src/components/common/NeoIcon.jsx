import React from "react";
import neoIconLight from "../../assets/brand/neo-icon.png";
import neoIconDark from "../../assets/brand/neo-icon-dark.png";

/**
 * NeoIcon — the Neo AI assistant mark (metallic helmet with glowing green eyes).
 * Theme-aware: the darkened mark shows in light theme, the bright silver mark in dark
 * theme. Toggled purely via ancestor `.theme-light` / `.theme-dark` CSS classes, so it
 * works anywhere in the app without threading a theme prop. Accepts a `size` prop and
 * harmlessly ignores lucide-style `fill`/`color` props.
 */
export default function NeoIcon({ size = 20 }) {
  const imgStyle = { width: size, height: size, display: "block", objectFit: "contain" };
  return (
    <span style={{ display: "inline-flex", width: size, height: size }}>
      <img className="neo-ico-light" src={neoIconLight} alt="Neo" style={imgStyle} />
      <img className="neo-ico-dark" src={neoIconDark} alt="Neo" style={imgStyle} />
    </span>
  );
}
