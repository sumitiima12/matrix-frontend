import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Clock, DoorOpen, LogIn } from "lucide-react";
import { fmt, fmtPnl, timeAgo } from "../../lib/format";
import Section from "../common/Section";

/* #25 — ONE unified activity timeline. Instead of scattering "what just happened" across Orders,
   Automate and Portfolio, this collapses every trade event (entries + exits, real and paper) into a
   single chronological feed, newest first. It's read-only and derived purely from `trades`, so it
   never disagrees with the books it summarises. Pass `real` to show the matching account's events. */
export default function ActivityTimeline({ trades = [], real = false, market = "IN", limit = 8 }) {
  const [showAll, setShowAll] = useState(false);

  const events = useMemo(() => {
    const out = [];
    for (const t of trades || []) {
      if ((real ? !t.real : !!t.real)) continue;              // wrong book
      if (t.entry == null || t.entryAt == null) continue;      // nothing to show yet
      const dir = (t.side === "SELL" || t.short) ? -1 : 1;
      const mkt = t.market || market;
      // Entry event
      out.push({
        id: (t.id || t.sym) + ":in",
        at: t.entryAt,
        kind: "entry",
        sym: t.sym,
        side: dir < 0 ? "SELL" : "BUY",
        price: Number(t.entry),
        market: mkt,
        who: t.tradeType || t.strategy || "Manual",
      });
      // Exit event (only if genuinely closed)
      if (t.exitAt != null && t.exit != null && t.exitType !== "Open") {
        const pnl = (Number(t.exit) - Number(t.entry)) * (t.qty || 0) * dir;
        out.push({
          id: (t.id || t.sym) + ":out",
          at: t.exitAt,
          kind: "exit",
          sym: t.sym,
          exitType: t.exitType || "Closed",
          price: Number(t.exit),
          pnl,
          market: mkt,
          who: t.tradeType || t.strategy || "Manual",
        });
      }
    }
    return out.sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [trades, real, market]);

  if (!events.length) return null;
  const shown = showAll ? events.slice(0, 40) : events.slice(0, limit);

  return (
    <Section title="Recent Activity" icon={<Clock size={17} color="var(--primary)" />}>
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
        {shown.map((e, i) => {
          const isExit = e.kind === "exit";
          const up = isExit ? (e.pnl >= 0) : (e.side === "BUY");
          const tone = isExit ? (e.pnl >= 0 ? "var(--up)" : "var(--down)") : (e.side === "BUY" ? "var(--up)" : "var(--down)");
          const Icon = isExit ? DoorOpen : LogIn;
          const DirIcon = up ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <div style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--elev)", border: "1px solid var(--line)", color: tone }}>
                <Icon size={14} />
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <div className="disp" style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isExit ? "Closed" : e.side === "SELL" ? "Opened short" : "Opened"} {e.sym}
                  <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 700, opacity: .55 }}>{e.who}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginTop: 1 }}>
                  {isExit ? `${e.exitType} @ ${fmt(e.price, e.market)}` : `@ ${fmt(e.price, e.market)}`} · {timeAgo(e.at)}
                </div>
              </div>
              {isExit && (
                <div className="mono" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 2, fontWeight: 800, fontSize: 12.5, color: tone }}>
                  <DirIcon size={13} />{(e.pnl >= 0 ? "+" : "") + fmtPnl(e.pnl, e.market)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {events.length > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="tap disp" style={{ marginTop: 8, width: "100%", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 10, padding: "8px", fontWeight: 800, fontSize: 12 }}>
          {showAll ? "Show less" : `Show more (${events.length})`}
        </button>
      )}
    </Section>
  );
}
