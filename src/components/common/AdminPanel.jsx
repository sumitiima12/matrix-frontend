import React, { useState, useEffect, useMemo } from "react";
import { adminListUsers, adminGetUser, adminSetBlocked, adminResetPin, adminPendingUsers, adminApproveUser, adminDeleteUser } from "../../services/adminService";
import { apiListIdeas, apiReviewIdea } from "../../domain/api";
import { tradesToCSV, downloadCSV, tradeFilename } from "../../lib/csv";

/**
 * AdminPanel — a full-screen admin console. Gated: it only mounts once the caller has
 * proven admin status (userId in ADMIN_USER_IDS + correct key). The key is held in memory
 * for the session and passed on every call; it is never stored.
 *
 * Shows all users; tap one to see their profile, onboarding answers, strategies, and trades;
 * block/unblock from either view.
 */
export default function AdminPanel({ userId, adminKey, onClose }) {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);   // full detail of one user
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState("users");  // users | ideas

  const refresh = async () => {
    try { setUsers(await adminListUsers(userId, adminKey)); setErr(null); }
    catch (e) { setErr(String(e.message || e)); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const openUser = async (phone) => {
    setLoadingDetail(true);
    try { setSelected(await adminGetUser(userId, adminKey, phone)); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setLoadingDetail(false); }
  };

  const resetPin = async (phone) => {
    const np = typeof window !== "undefined" ? window.prompt(`New PIN for ${phone} (4+ digits):`) : "";
    if (!np) return;
    if (String(np).length < 4) { setErr("PIN must be at least 4 digits."); return; }
    setBusy(true);
    try { await adminResetPin(userId, adminKey, phone, np); setErr(null); alert("PIN reset."); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const toggleBlock = async (phone, next) => {
    setBusy(true);
    try {
      await adminSetBlocked(userId, adminKey, phone, next);
      await refresh();
      if (selected && selected.phone === phone) await openUser(phone);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const approve = async (phone, next) => {
    setBusy(true);
    try {
      await adminApproveUser(userId, adminKey, phone, next);
      await refresh();
      if (selected && selected.phone === phone) await openUser(phone);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const removeUser = async (phone, label) => {
    if (typeof window !== "undefined" && !window.confirm(`Permanently delete ${label || phone} and ALL their data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await adminDeleteUser(userId, adminKey, phone);
      if (r && r.error) { setErr(r.error); return; }
      setSelected(null);
      await refresh();
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };

  const wrap = { position: "fixed", inset: 0, background: "var(--bg)", zIndex: 3000, overflowY: "auto", padding: "18px 16px 40px" };
  const card = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, marginTop: 10 };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 20 }}>Admin</div>
        <button onClick={onClose} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 10, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Close</button>
      </div>

      {err && (
        <div style={{ ...card, borderColor: "var(--down)", color: "var(--down)", fontSize: 12.5 }}>{err}</div>
      )}

      {/* DETAIL VIEW */}
      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="tap disp" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>← All users</button>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="disp" style={{ fontWeight: 800, fontSize: 16 }}>{selected.user.name || "(no name)"}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {selected.user.username ? "@" + selected.user.username + " · " : ""}{selected.phone}
                </div>
                {selected.user.email && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{selected.user.email}</div>}
                {selected.user.referredBy && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>Referred by @{selected.user.referredBy}</div>}
                {selected.user.createdAt && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
                    Joined {new Date(selected.user.createdAt).toLocaleDateString()}
                    {selected.user.lastLogin ? ` · Last login ${new Date(selected.user.lastLogin).toLocaleString()}` : ""}
                  </div>
                )}
              </div>
              {selected.user.approved === false && (
                <button
                  onClick={() => approve(selected.phone, true)}
                  disabled={busy}
                  className="tap disp"
                  style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", marginRight: 8, background: "var(--up)", color: "#fff", opacity: busy ? 0.6 : 1 }}
                >
                  Approve
                </button>
              )}
              {selected.user.approved !== false && (
                <button
                  onClick={() => approve(selected.phone, false)}
                  disabled={busy}
                  className="tap disp"
                  title="Revoke approval — user will need to be re-approved to log in"
                  style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", marginRight: 8, background: "transparent", color: "var(--muted)", opacity: busy ? 0.6 : 1 }}
                >
                  Revoke
                </button>
              )}
              <button
                onClick={() => toggleBlock(selected.phone, !selected.user.blocked)}
                disabled={busy}
                className="tap disp"
                style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer",
                  background: selected.user.blocked ? "var(--up)" : "var(--down)", color: "#fff", opacity: busy ? 0.6 : 1 }}
              >
                {selected.user.blocked ? "Unblock" : "Block"}
              </button>
              <button
                onClick={() => resetPin(selected.phone)}
                disabled={busy}
                className="tap disp"
                style={{ marginLeft: 8, border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--ink)", opacity: busy ? 0.6 : 1 }}
              >
                Reset PIN
              </button>
            </div>
            {selected.user.blocked && (
              <div style={{ fontSize: 10.5, color: "var(--down)", fontWeight: 700, marginTop: 8 }}>This user is BLOCKED and cannot log in.</div>
            )}
            {selected.user.approved === false && (
              <div style={{ fontSize: 10.5, color: "var(--down)", fontWeight: 700, marginTop: 6 }}>AWAITING APPROVAL — this user cannot log in until you tap Approve.</div>
            )}
            <button
              onClick={() => removeUser(selected.phone, selected.user.name || (selected.user.username ? "@" + selected.user.username : selected.phone))}
              disabled={busy}
              className="tap disp"
              style={{ marginTop: 14, width: "100%", border: "1px solid var(--down)", borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "var(--down)", color: "#fff", opacity: busy ? 0.6 : 1 }}
            >
              Delete this account permanently
            </button>
          </div>

          {/* Onboarding answers / profile */}
          <div style={card}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Onboarding & profile</div>
            {selected.state && selected.state.profile
              ? <ProfileTable profile={selected.state.profile} />
              : <div style={{ fontSize: 12, color: "var(--muted)" }}>No onboarding answers saved.</div>}
          </div>

          {/* Strategies */}
          <div style={card}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
              Strategies {selected.state && selected.state.strats ? `(${selected.state.strats.length})` : ""}
            </div>
            {selected.state && selected.state.strats && selected.state.strats.length
              ? selected.state.strats.map((s, i) => (
                  <div key={s.id || i} style={{ borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 8 : 0, marginTop: i ? 8 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{s.name || "Unnamed"}</span>
                      <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", background: s.active ? "var(--up)" : "var(--elev)", color: s.active ? "#fff" : "var(--muted)" }}>{s.active ? "ACTIVE" : "OFF"}</span>
                    </div>
                    {s.symbols && s.symbols.length > 0 && (
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{s.symbols.join(", ")}</div>
                    )}
                  </div>
                ))
              : <div style={{ fontSize: 12, color: "var(--muted)" }}>No strategies.</div>}
          </div>

          {/* Trades — last 10 by default, filters + CSV export */}
          <TradesSection trades={selected.trades || []} cardStyle={card} />
        </div>
      ) : (
        /* USER LIST + IDEAS MODERATION */
        <div>
          <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginTop: 8, marginBottom: 4 }}>
            {[["users", "Users"], ["pending", "Pending"], ["ideas", "Ideas"]].map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: section === k ? "var(--primary)" : "transparent", color: section === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
            ))}
          </div>
          {section === "ideas" ? (
            <IdeasModeration adminKey={adminKey} card={card} />
          ) : section === "pending" ? (
            <PendingUsers userId={userId} adminKey={adminKey} card={card} />
          ) : (
          <>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
            {users ? `${users.length} user${users.length !== 1 ? "s" : ""}` : "Loading…"}
          </div>
          {users && users.map((u) => (
            <div key={u.phone} onClick={() => openUser(u.phone)} className="tap" style={{ ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name || "(no name)"}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{u.phone}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {u.approved === false && <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 7px", background: "#F59E42", color: "#fff" }}>PENDING</span>}
                {u.blocked && <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 7px", background: "var(--down)", color: "#fff" }}>BLOCKED</span>}
                <span style={{ color: "var(--muted)", fontSize: 16 }}>›</span>
              </div>
            </div>
          ))}
          {loadingDetail && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Loading user…</div>}
          </>
          )}
        </div>
      )}
    </div>
  );
}

/* Signup approval queue: every account awaiting admin activation, with Approve / Reject. */
function PendingUsers({ userId, adminKey, card }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);
  const refresh = () => adminPendingUsers(userId, adminKey).then((users) => { setList(Array.isArray(users) ? users : []); setErr(null); }).catch((e) => { setErr(String(e.message || e)); setList([]); });
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  const act = async (phone, approved) => {
    setBusy(phone);
    try { await adminApproveUser(userId, adminKey, phone, approved); await refresh(); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(""); }
  };
  return (
    <div>
      {err && <div style={{ ...card, borderColor: "var(--down)", color: "var(--down)", fontSize: 12 }}>{err}</div>}
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
        {list == null ? "Loading…" : list.length ? `${list.length} awaiting approval` : ""}
      </div>
      {list != null && list.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>No accounts awaiting approval.</div>
      )}
      {(list || []).map((u) => (
        <div key={u.phone} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name || "(no name)"}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {u.username ? "@" + u.username + " · " : ""}{u.phone}
            </div>
            {u.email && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{u.email}</div>}
            {u.createdAt && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>Signed up {new Date(u.createdAt).toLocaleString()}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
            <button onClick={() => act(u.phone, true)} disabled={busy === u.phone} className="tap disp"
              style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "var(--up)", color: "#fff", opacity: busy === u.phone ? 0.6 : 1 }}>Approve</button>
            <button onClick={() => act(u.phone, false)} disabled={busy === u.phone} className="tap disp"
              style={{ border: "1px solid var(--down)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--down)", opacity: busy === u.phone ? 0.6 : 1 }}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Idea moderation: every pending community idea, with approve/reject. Uses the admin key. */
function IdeasModeration({ adminKey, card }) {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("pending");   // pending | all
  const refresh = () => apiListIdeas({ adminKey }).then((l) => setList(Array.isArray(l) ? l : []));
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  const review = async (id, status) => { await apiReviewIdea(id, status, adminKey); refresh(); };
  const del = async (id) => { const { apiDeleteIdea } = await import("../../domain/api"); await apiDeleteIdea(id); refresh(); };
  const shown = (list || []).filter((i) => filter === "all" ? true : (i.status || "approved") === "pending");
  const chip = (on) => ({ border: "1px solid " + (on ? "var(--primary)" : "var(--line)"), background: on ? "var(--primary-soft)" : "var(--elev)", color: on ? "var(--primary)" : "var(--muted)", borderRadius: 9, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => setFilter("pending")} style={chip(filter === "pending")}>Pending</button>
        <button onClick={() => setFilter("all")} style={chip(filter === "all")}>All</button>
      </div>
      {list == null ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Loading ideas…</div>
        : shown.length === 0 ? <div style={{ ...card, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>Nothing to review.</div>
        : shown.map((i) => (
          <div key={i.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{i.symbol} <span style={{ color: i.direction === "Short" ? "var(--down)" : "var(--up)", fontSize: 11 }}>{i.direction}</span></div>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>@{i.owner_name} · {(i.status || "approved").toUpperCase()}</span>
            </div>
            {i.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{i.note}</div>}
            {Array.isArray(i.tags) && i.tags.length > 0 && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{i.tags.map((t) => "#" + t).join("  ")}</div>}
            {i.screenshot && <img src={i.screenshot} alt="idea" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", marginTop: 8 }} />}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {i.status !== "approved" && <button onClick={() => review(i.id, "approved")} className="tap" style={{ border: "1px solid var(--up)", background: "var(--up-soft)", color: "var(--up)", borderRadius: 9, padding: "6px 14px", fontSize: 11.5, fontWeight: 800 }}>✓ Approve</button>}
              {i.status !== "rejected" && <button onClick={() => review(i.id, "rejected")} className="tap" style={{ border: "1px solid var(--down)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "6px 14px", fontSize: 11.5, fontWeight: 800 }}>Reject</button>}
              <button onClick={() => del(i.id)} className="tap" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "6px 12px", fontSize: 11.5, fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        ))}
    </div>
  );
}

/* Trades for ONE user in the admin console.
   - Filters: trade type, market, and a date range (From / To).
   - Shows the last 10 by default; "Show more" expands to the full history.
   - "CSV" downloads exactly what's currently filtered. */
function TradesSection({ trades = [], cardStyle }) {
  const [fType, setFType] = useState("All");
  const [fMkt, setFMkt] = useState("All");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [expanded, setExpanded] = useState(false);

  const stamp = (t) => t.exitAt || t.entryAt || t.at || t.ts || 0;
  const TYPES = ["All", "Manual", "Automate", "Auto Buy"];
  const MKTS = ["All", "IN", "US", "Crypto", "Commodity"];

  const from = dFrom ? new Date(dFrom + "T00:00:00").getTime() : 0;
  const to = dTo ? new Date(dTo + "T23:59:59.999").getTime() : Date.now();

  const rows = useMemo(() => (trades || [])
    .filter((t) => (fType === "All" ? true : (t.tradeType || "Manual") === fType))
    .filter((t) => (fMkt === "All" ? true : (t.market || "IN") === fMkt))
    .filter((t) => { const ts = stamp(t); return ts >= from && ts <= to; })
    .sort((a, b) => stamp(b) - stamp(a)),
    [trades, fType, fMkt, from, to]);

  const shown = expanded ? rows : rows.slice(0, 10);
  const exportCSV = () => downloadCSV(tradeFilename("matrix-user-trades"), tradesToCSV(rows, () => null));

  const chip = (on) => ({
    flex: "0 0 auto", padding: "5px 10px", fontSize: 10.5, fontWeight: 800, borderRadius: 9, cursor: "pointer",
    border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
    background: on ? "var(--primary)" : "var(--surface)", color: on ? "#fff" : "var(--ink)",
  });
  const dateInput = { border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 9, padding: "7px 8px", fontSize: 11.5, fontWeight: 700, width: "100%" };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 13 }}>Trades ({rows.length})</div>
        <button onClick={exportCSV} disabled={!rows.length} className="tap disp"
          style={{ border: "1px solid var(--line)", background: "var(--elev)", color: rows.length ? "var(--ink)" : "var(--muted)", borderRadius: 9, padding: "6px 11px", fontWeight: 800, fontSize: 11, cursor: rows.length ? "pointer" : "not-allowed", opacity: rows.length ? 1 : 0.5 }}>
          ⬇ CSV
        </button>
      </div>

      {/* Trade-type chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {TYPES.map((t) => <button key={t} onClick={() => setFType(t)} style={chip(fType === t)}>{t}</button>)}
      </div>
      {/* Market chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {MKTS.map((m) => <button key={m} onClick={() => setFMkt(m)} style={chip(fMkt === m)}>{m}</button>)}
      </div>
      {/* Date range */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>FROM</div>
          <input type="date" value={dFrom} max={dTo || undefined} onChange={(e) => setDFrom(e.target.value)} className="no-ring mono" style={dateInput} />
        </label>
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 800, marginBottom: 3 }}>TO</div>
          <input type="date" value={dTo} min={dFrom || undefined} onChange={(e) => setDTo(e.target.value)} className="no-ring mono" style={dateInput} />
        </label>
        {(dFrom || dTo) && (
          <button onClick={() => { setDFrom(""); setDTo(""); }} className="tap disp" style={{ alignSelf: "flex-end", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--muted)", borderRadius: 9, padding: "7px 10px", fontSize: 10.5, fontWeight: 700 }}>Clear</button>
        )}
      </div>

      {rows.length === 0
        ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No trades match.</div>
        : shown.map((t, i) => (
            <div key={t.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 7 : 0, marginTop: i ? 7 : 0 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{t.sym}</span>
                <span className="mono" style={{ fontSize: 10, color: t.side === "SELL" ? "var(--down)" : "var(--up)", marginLeft: 6, fontWeight: 800 }}>{t.side || "BUY"}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>×{t.qty}</span>
                <span className="pill" style={{ fontSize: 8, fontWeight: 800, padding: "1px 6px", marginLeft: 6, background: "var(--elev)", color: "var(--muted)" }}>{t.tradeType || "Manual"}</span>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                {stamp(t) ? new Date(stamp(t)).toLocaleDateString() : ""}
                {t.pnl != null && <span style={{ color: t.pnl >= 0 ? "var(--up)" : "var(--down)", fontWeight: 800, marginLeft: 6 }}>{t.pnl >= 0 ? "+" : ""}{Math.round(t.pnl)}</span>}
              </div>
            </div>
          ))}

      {rows.length > 10 && (
        <button onClick={() => setExpanded((v) => !v)} className="tap disp"
          style={{ width: "100%", marginTop: 10, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--primary)", borderRadius: 10, padding: "8px 0", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
          {expanded ? "Show less" : `Show more (${rows.length - 10} more)`}
        </button>
      )}
    </div>
  );
}

/* Renders the onboarding/profile object as a readable key→value table. */
function ProfileTable({ profile }) {
  const entries = Object.entries(profile || {}).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return <div style={{ fontSize: 12, color: "var(--muted)" }}>No answers saved.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <span style={{ color: "var(--muted)", fontWeight: 600, textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
          <span style={{ fontWeight: 700, textAlign: "right" }}>{Array.isArray(v) ? v.join(", ") : String(v)}</span>
        </div>
      ))}
    </div>
  );
}
