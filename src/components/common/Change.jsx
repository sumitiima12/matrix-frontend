import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * The ±% pill. Single responsibility: render a signed percentage.
 *
 * NO DATA IS NOT ZERO, AND IT IS CERTAINLY NOT A GAIN.
 *
 * This used to do `const up = v >= 0` and then `v.toFixed(2)`. Both are wrong when
 * v is null — which it now legitimately is, because prices start as null instead of
 * a fabricated seed value:
 *
 *   - `null >= 0` evaluates to TRUE in JavaScript (null coerces to 0), so an
 *     instrument with no data rendered a cheerful green up-arrow.
 *   - `null.toFixed()` then threw, which is the crash you just saw.
 *
 * A missing number renders as "—", in muted grey. It is neither up nor down.
 */
export default function Change({ v, big }) {
  if (v == null || Number.isNaN(v)) {
    return (
      <span className="mono" style={{ color: "var(--muted)", fontWeight: 700, fontSize: big ? 15 : 12.5 }}>
        —
      </span>
    );
  }

  const up = v >= 0;
  return (
    <span className="mono" style={{ color: up ? "var(--up)" : "var(--down)", fontWeight: 700, fontSize: big ? 15 : 12.5, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <ArrowUpRight size={big ? 16 : 13} /> : <ArrowDownRight size={big ? 16 : 13} />}
      {up ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}
