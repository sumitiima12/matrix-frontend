import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ALL, marketOf } from "../../domain/universe";
import { fmt } from "../../lib/format";
import Change from "./Change";

/**
 * SearchOverlay — search suggestions across every instrument.
 *
 * Shows the SYMBOL and the company NAME (searching "reliance" or "RELIANCE" or
 * even "bank" should all work), with the live price where we have one.
 *
 * Deliberately built with no dependencies beyond the universe and formatting:
 * the previous version pulled in ListRow and WatchAddButton, and a throw in either
 * blanked the entire app, since the overlay renders outside the page tree. Fewer
 * moving parts under a search box is the right trade.
 *
 * Ranking: exact symbol first, then symbol prefix, then symbol contains, then name
 * contains. Typing "TC" should surface TCS before it surfaces "Tata Consumer".
 */

const MKT_TAG = { IN: "NSE", US: "US", Crypto: "CRYPTO", Commodity: "COMMODITY" };

function rank(s, q) {
  const sym = (s.sym || "").toLowerCase();
  const name = (s.name || "").toLowerCase();
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (sym.includes(q)) return 3;
  if (name.includes(q)) return 4;
  return 99;
}

export default function SearchOverlay({ onClose, onOpen }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pool = Array.isArray(ALL) ? ALL : [];
    if (!query) return pool.slice(0, 30);        // show something immediately, not a void
    return pool
      .map((s) => ({ s, r: rank(s, query) }))
      .filter((x) => x.r < 99)
      .sort((a, b) => a.r - b.r || (a.s.sym || "").length - (b.s.sym || "").length)
      .slice(0, 40)
      .map((x) => x.s);
  }, [q]);

  return (
    <div
      className="mx"
      style={{
        position: "fixed", inset: 0, zIndex: 130,
        background: "var(--bg)", maxWidth: 460, margin: "0 auto",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 10, padding: 14, alignItems: "center", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
        <Search size={20} color="var(--muted)" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol or company…"
          aria-label="Search instruments"
          className="no-ring"
          style={{ flex: 1, minWidth: 0, border: "none", fontSize: 16, background: "transparent", color: "var(--ink)" }}
        />
        <button onClick={onClose} aria-label="Close search" className="tap"
          style={{ border: "none", background: "var(--elev)", borderRadius: 9, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto" }}>
          <X size={16} />
        </button>
      </div>

      <div className="hide-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 14px 24px" }}>
        {results.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 40, fontSize: 13.5 }}>
            No match for “{q}”. Try TCS, NVDA, BTC or GOLD.
          </div>
        ) : (
          results.map((s) => {
            const m = marketOf(s.sym);
            return (
              <div
                key={s.sym}
                onClick={() => { onClose && onClose(); onOpen && onOpen(s); }}
                className="tap"
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>{s.sym}</span>
                    {m && (
                      <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 6px", background: "var(--elev)", color: "var(--muted)" }}>
                        {MKT_TAG[m] || m}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                    {s.name}
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{fmt(s.price, m || "IN")}</div>
                  <Change v={s.chg} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
