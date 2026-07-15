import React from "react";
import neoIcon from "../../assets/brand/neo-icon.png";

/**
 * NeoIcon — the Neo AI assistant mark (the metallic helmet with glowing green eyes).
 * Renders the brand PNG. Accepts a `size` prop and harmlessly ignores lucide-style
 * `fill`/`color` props so it drops straight into the existing nav map.
 */
export default function NeoIcon({ size = 20 }) {
  return (
    <img
      src={neoIcon}
      alt="Neo"
      width={size}
      height={size}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
