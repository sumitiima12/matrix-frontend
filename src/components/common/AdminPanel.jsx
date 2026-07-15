import React, { useState, useEffect } from "react";
import { adminListUsers, adminGetUser, adminSetBlocked } from "../../services/adminService";

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

  const toggleBlock = async (phone, next) => {
    setBusy(true);
    try {
      await adminSetBlocked(userId, adminKey, phone, next);
      await refresh();
      if (selected && selected.phone === phone) await openUser(phone);
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
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selected.phone}</div>
                {selected.user.createdAt && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
                    Joined {new Date(selected.user.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleBlock(selected.phone, !selected.user.blocked)}
                disabled={busy}
                className="tap disp"
                style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer",
                  background: selected.user.blocked ? "var(--up)" : "var(--down)", color: "#fff", opacity: busy ? 0.6 : 1 }}
              >
                {selected.user.blocked ? "Unblock" : "Block"}
              </button>
            </div>
            {selected.user.blocked && (
              <div style={{ fontSize: 10.5, color: "var(--down)", fontWeight: 700, marginTop: 8 }}>This user is BLOCKED and cannot log in.</div>
            )}
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

          {/* Trades */}
          <div style={card}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
              Trades ({selected.trades ? selected.trades.length : 0})
            </div>
            {selected.trades && selected.trades.length
              ? selected.trades.slice(0, 100).map((t, i) => (
                  <div key={t.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 7 : 0, marginTop: i ? 7 : 0 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{t.sym}</span>
                      <span className="mono" style={{ fontSize: 10, color: t.side === "SELL" ? "var(--down)" : "var(--up)", marginLeft: 6, fontWeight: 800 }}>{t.side}</span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>×{t.qty}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                      {t.at || t.entryAt ? new Date(t.at || t.entryAt).toLocaleDateString() : ""}
                      {t.pnl != null && <span style={{ color: t.pnl >= 0 ? "var(--up)" : "var(--down)", fontWeight: 800, marginLeft: 6 }}>{t.pnl >= 0 ? "+" : ""}{Math.round(t.pnl)}</span>}
                    </div>
                  </div>
                ))
              : <div style={{ fontSize: 12, color: "var(--muted)" }}>No trades.</div>}
            {selected.trades && selected.trades.length > 100 && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Showing first 100 of {selected.trades.length}.</div>
            )}
          </div>
        </div>
      ) : (
        /* USER LIST */
        <div>
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
                {u.blocked && <span className="pill" style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 7px", background: "var(--down)", color: "#fff" }}>BLOCKED</span>}
                <span style={{ color: "var(--muted)", fontSize: 16 }}>›</span>
              </div>
            </div>
          ))}
          {loadingDetail && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Loading user…</div>}
        </div>
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
