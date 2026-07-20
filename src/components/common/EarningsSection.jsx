import React, { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { fetchEarnings } from "../../domain/api";

/**
 * EarningsSection — Recent & Upcoming earnings for the current market.
 *
 * US pulls FMP's earning_calendar; India pulls indianapi's recent announcements. Both soft-fail
 * to empty, so the whole section simply hides when there's no data (or no key configured) — it
 * never shows a broken or invented calendar. Not shown for crypto/commodity, which don't report.
 */
const fmtDate = (d) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  catch { return d; }
};

export default function EarningsSection({ market, onOpen }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    if (market !== "US" && market !== "IN") { setData({ recent: [], upcoming: [] }); return; }
    let alive = true;
    fetchEarnings(market).then((d) => { if (alive) setData(d || { recent: [], upcoming: [] }); });
    return () => { alive = false; };
  }, [market]);

  if (market !== "US" && market !== "IN") return null;
  if (!data) return null;
  const rows = (tab === "upcoming" ? data.upcoming : data.recent) || [];
  if (!data.upcoming?.length && !data.recent?.length) return null;   // nothing to show → hide

  return (
    <div style={{ marginTop: 22 }}>
      <div className="disp" style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <CalendarDays size={16} color="var(--primary)" /> Earnings {market === "IN" ? "· results" : "calendar"}
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        {[["upcoming", "Upcoming"], ["recent", "Recent"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="pill tap disp"
            style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, border: "1px solid " + (tab === k ? "var(--primary)" : "var(--line)"), background: tab === k ? "var(--primary)" : "var(--surface)", color: tab === k ? "var(--on-primary)" : "var(--ink)" }}>
            {l} {(k === "upcoming" ? data.upcoming?.length : data.recent?.length) ? `(${k === "upcoming" ? data.upcoming.length : data.recent.length})` : ""}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: "4px 12px" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>Nothing in this window.</div>
        ) : rows.slice(0, 25).map((r, i) => (
          <div key={(r.sym || "") + i} onClick={() => onOpen && onOpen(r.sym)} className="tap"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", borderBottom: i < Math.min(rows.length, 25) - 1 ? "1px solid var(--line)" : "none", cursor: onOpen ? "pointer" : "default" }}>
            <span className="disp" style={{ fontWeight: 800, fontSize: 13, flex: "0 0 auto", minWidth: 62 }}>{r.sym}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.title ? r.title : (r.epsEst != null ? `Est. EPS ${(+r.epsEst).toFixed(2)}` : "")}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)", flex: "0 0 auto" }}>{fmtDate(r.date)}</span>
            {r.when && <span style={{ fontSize: 9.5, color: "var(--muted)", flex: "0 0 auto" }}>{r.when === "bmo" ? "pre" : r.when === "amc" ? "post" : ""}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
