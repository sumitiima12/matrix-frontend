import React, { useState, useEffect, useMemo } from "react";
import { adminListUsers, adminGetUser, adminSetBlocked, adminResetPin, adminPendingUsers, adminApproveUser, adminDeleteUser, adminClearVirtual, adminClearTradesByType, adminOpsOverview, adminOpsPauseUser, adminOpsResumeUser, adminOpsClearHalt, adminOpsIncidentNote, adminAudit, adminOpsCostMetrics, adminDeltaDiag } from "../../services/adminService";
import { apiListIdeas, apiReviewIdea, apiDeleteIdea } from "../../domain/api";
import { tradesToCSV, downloadCSV, tradeFilename } from "../../lib/csv";
import { confirmDialog, promptDialog, alertDialog } from "../../lib/confirmDialog";   // in-app dialogs (reliable in webviews/PWA)

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
  const [clearScope, setClearScope] = useState("virtual");   // virtual | real — which book the Clear buttons target

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
    const np = await promptDialog(`New PIN for ${phone} (4+ digits):`, { title: "Reset PIN", confirmLabel: "Reset", placeholder: "New PIN" });
    if (!np) return;
    if (String(np).length < 4) { setErr("PIN must be at least 4 digits."); return; }
    setBusy(true);
    try { await adminResetPin(userId, adminKey, phone, np); setErr(null); await alertDialog("PIN reset.", { title: "Done" }); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  const clearVirtual = async (phone) => {
    if (!(await confirmDialog(`Delete ALL virtual (paper) trade history for ${phone}? Real broker trades are not affected. This cannot be undone.`, { title: "Clear virtual trades", confirmLabel: "Delete all" }))) return;
    setBusy(true);
    try { const r = await adminClearVirtual(userId, adminKey, phone); setErr(null); await alertDialog(`Cleared ${r.removed != null ? r.removed : ""} virtual trade${r.removed === 1 ? "" : "s"}.`, { title: "Done" }); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  };
  // Clear ONE trade type's history (Manual / Auto Buy / Screener / Automate). `scope` = virtual | real | all.
  // This only wipes the JOURNAL rows behind the dashboard/history — it does NOT place any broker order or
  // touch real holdings. Used to drop phantom/duplicate records so the shown P&L reflects reality.
  const clearType = async (phone, tradeType, label, scope = "virtual") => {
    const scopeWord = scope === "real" ? "REAL" : scope === "all" ? "ALL (virtual + real)" : "virtual";
    const warn = scope === "virtual"
      ? "Real broker trades are not affected."
      : "This removes JOURNAL records only — it does NOT sell or touch your actual broker positions. Use it to clear phantom/duplicate entries.";
    if (!(await confirmDialog(`Delete ${label} ${scopeWord} trade data for ${phone}? ${warn} This cannot be undone.`, { title: "Clear trades", confirmLabel: "Delete", danger: scope !== "virtual" }))) return;
    setBusy(true);
    try { const r = await adminClearTradesByType(userId, adminKey, phone, tradeType, scope); setErr(null); await alertDialog(`Cleared ${r.removed != null ? r.removed : ""} ${label} ${scopeWord} record${r.removed === 1 ? "" : "s"}.`, { title: "Done" }); if (selected && selected.phone === phone) await openUser(phone); }
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
    if (!(await confirmDialog(`Permanently delete ${label || phone} and ALL their data? This cannot be undone.`, { title: "Delete user", confirmLabel: "Delete user" }))) return;
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
        <button onClick={onClose} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 10, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 15, lineHeight: 1 }}>✕</span> Close</button>
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

          {/* Clear trade data — per type (Manual / Auto Buy / Screener / Automate). Virtual only; real
              broker trades are never touched. Lets the admin reset one bucket's dashboard at a time. */}
          <div style={card}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>Clear trade data</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>
              Wipes the chosen book's JOURNAL rows for a trade type. This only cleans the dashboard/history — it
              never places an order or touches real broker holdings. Use REAL to drop phantom/duplicate real records.
            </div>
            {/* Which book the Clear buttons target. Virtual is the safe default; Real removes real journal rows. */}
            <div style={{ display: "inline-flex", gap: 0, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
              {[["virtual", "Virtual"], ["real", "Real"]].map(([sc, lbl]) => (
                <button key={sc} onClick={() => setClearScope(sc)} className="tap disp"
                  style={{ border: "none", padding: "6px 14px", fontWeight: 800, fontSize: 11, cursor: "pointer",
                    background: clearScope === sc ? (sc === "real" ? "var(--down)" : "var(--ink)") : "transparent",
                    color: clearScope === sc ? "#fff" : "var(--muted)" }}>{lbl}</button>
              ))}
            </div>
            {clearScope === "real" && (
              <div style={{ fontSize: 10.5, color: "var(--down)", fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>
                ⚠ Clearing REAL records removes them from the app's history/P&L only. It does NOT close positions at your broker — verify holdings in your broker app.
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[["Manual", "Manual"], ["Auto Buy", "Auto Buy"], ["Screener Auto Buy", "Screener"], ["Automate", "Automate"]].map(([tt, label]) => (
                <button key={tt} onClick={() => clearType(selected.phone, tt, label, clearScope)} disabled={busy} className="tap disp"
                  style={{ border: "1px solid " + (clearScope === "real" ? "var(--down)" : "var(--line)"), borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer", background: "var(--elev)", color: clearScope === "real" ? "var(--down)" : "var(--ink)", opacity: busy ? 0.6 : 1 }}>
                  Clear {label}
                </button>
              ))}
              {clearScope === "virtual" && (
                <button onClick={() => clearVirtual(selected.phone)} disabled={busy} className="tap disp"
                  style={{ border: "1px solid var(--down)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer", background: "transparent", color: "var(--down)", opacity: busy ? 0.6 : 1 }}>
                  Clear ALL virtual
                </button>
              )}
            </div>
          </div>

          {/* Onboarding answers / profile */}
          <div style={card}>
            <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Onboarding & profile</div>
            {selected.state && selected.state.profile
              ? <ProfileTable profile={selected.state.profile} />
              : <div style={{ fontSize: 12, color: "var(--muted)" }}>No onboarding answers saved.</div>}
          </div>

          {/* Strategies — first 5 by default, "Show more" expands to the full list */}
          <StrategiesSection strats={(selected.state && selected.state.strats) || []} cardStyle={card} />

          {/* Trades — last 10 by default, filters + CSV export */}
          <TradesSection trades={selected.trades || []} cardStyle={card} />
        </div>
      ) : (
        /* USER LIST + IDEAS MODERATION */
        <div>
          <div className="pill" style={{ display: "inline-flex", background: "var(--elev)", border: "1px solid var(--line)", padding: 3, marginTop: 8, marginBottom: 4 }}>
            {[["users", "Users"], ["pending", "Pending"], ["ideas", "Ideas"], ["ops", "Ops"]].map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)} className="pill tap disp" style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, border: "none", background: section === k ? "var(--primary)" : "transparent", color: section === k ? "var(--on-primary)" : "var(--muted)" }}>{l}</button>
            ))}
          </div>
          {section === "ops" ? (
            <OpsConsole userId={userId} adminKey={adminKey} card={card} />
          ) : section === "ideas" ? (
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

/* OPS-1 — operations console: one live snapshot of unattended real-money health (real traders, unprotected
   positions, unresolved orders, pending protection, halted accounts) with pause/resume + incident notes, plus
   the immutable audit log. Read model comes from /api/admin/ops/overview; actions are audited server-side. */
function OpsConsole({ userId, adminKey, card }) {
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [audit, setAudit] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [cm, setCm] = useState(null);        // FIN-2 cost metrics result
  const [cmPhone, setCmPhone] = useState("");
  const [delta, setDelta] = useState(null);  // Delta connection diagnosis result
  const [deltaBusy, setDeltaBusy] = useState(false);

  const refresh = () => { setErr(null); adminOpsOverview(userId, adminKey).then(setOv).catch((e) => setErr(String(e.message || e))); };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const pauseUser = async () => {
    const phone = await promptDialog("Pause automated entries for which account? (phone)", { title: "Pause user" });
    if (!phone) return;
    setBusy(true);
    try { await adminOpsPauseUser(userId, adminKey, phone.trim()); await alertDialog("Entries paused for " + phone, { title: "Paused" }); refresh(); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  };
  const resumeUser = async (phone) => {
    if (!(await confirmDialog(`Resume automated entries for ${phone}? Real trading will run again.`, { title: "Resume user", confirmLabel: "Resume" }))) return;
    setBusy(true);
    try { await adminOpsResumeUser(userId, adminKey, phone); refresh(); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  };
  const clearHalt = async () => {
    const phone = await promptDialog("Clear the trading halt for which account? (phone)\n\nDo this only AFTER verifying at the broker (e.g. the Delta app) that there is no unknown open position from the stuck order.", { title: "Resolve halt (override)" });
    if (!phone) return;
    if (!(await confirmDialog(`Manually clear the entry-halt AND risk-lock for ${phone.trim()}?\n\nThis is an override for when the broker-backed reconcile can't run (e.g. proxy down). Use only when you've confirmed the broker state out of band. It's written to the audit log. Real orders still route through the proxy, so trading only resumes once the proxy is reachable.`, { title: "Resolve halt", confirmLabel: "Clear halt", danger: true }))) return;
    setBusy(true);
    try { const r = await adminOpsClearHalt(userId, adminKey, phone.trim(), "manual override from ops console"); await alertDialog((r && r.note) || "Halt cleared.", { title: "Halt cleared" }); refresh(); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await adminOpsIncidentNote(userId, adminKey, note.trim()); setNote(""); await alertDialog("Incident note recorded to the audit log.", { title: "Saved" }); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  };
  const loadAudit = () => { setShowAudit(true); adminAudit(userId, adminKey, 100).then((d) => setAudit(d.entries || [])).catch((e) => setErr(String(e.message || e))); };
  const loadCost = async () => {
    if (!cmPhone.trim()) return;
    setErr(null); setCm(null);
    try { setCm(await adminOpsCostMetrics(userId, adminKey, cmPhone.trim(), 30)); }
    catch (e) { setErr(String(e.message || e)); }
  };
  const checkDelta = async () => {
    setDeltaBusy(true); setErr(null); setDelta(null);
    try { setDelta(await adminDeltaDiag(userId, adminKey)); }
    catch (e) { setErr(String(e.message || e)); } finally { setDeltaBusy(false); }
  };

  const s = ov && ov.summary;
  const tile = (label, val, warn) => (
    <div style={{ ...card, flex: "1 1 100px", minWidth: 92, margin: 0, textAlign: "center", padding: "10px 8px", border: "1px solid " + (warn ? "var(--down)" : "var(--line)") }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 18, marginTop: 3, color: warn ? "var(--down)" : "var(--ink)" }}>{val}</div>
    </div>
  );
  const ageStr = (ms) => (ms == null ? "—" : ms < 60000 ? Math.round(ms / 1000) + "s" : ms < 3600000 ? Math.round(ms / 60000) + "m" : Math.round(ms / 3600000) + "h");

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={refresh} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "6px 12px", fontWeight: 800, fontSize: 12 }}>↻ Refresh</button>
        <button onClick={pauseUser} disabled={busy} className="tap disp" style={{ border: "1px solid var(--down)", background: "var(--surface)", color: "var(--down)", borderRadius: 10, padding: "6px 12px", fontWeight: 800, fontSize: 12 }}>Pause a user</button>
        <button onClick={clearHalt} disabled={busy} title="Manual override: clear a stuck entry-halt + risk-lock after verifying the broker state" className="tap disp" style={{ border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--primary)", borderRadius: 10, padding: "6px 12px", fontWeight: 800, fontSize: 12 }}>Resolve halt</button>
        <button onClick={checkDelta} disabled={deltaBusy} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "6px 12px", fontWeight: 800, fontSize: 12 }}>{deltaBusy ? "Checking…" : "Check Delta connection"}</button>
        {ov && ov.role && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>role: {ov.role}</span>}
      </div>
      {delta && (() => {
        const ok = /^OK/.test(delta.diagnosis || "");
        return (
          <div style={{ ...card, margin: "0 0 8px", padding: "10px 12px", border: "1px solid " + (ok ? "var(--up)" : "var(--down)") }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 4 }}>Delta connection</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: ok ? "var(--up)" : "var(--down)", lineHeight: 1.45 }}>{delta.diagnosis}</div>
            {delta.serverOutboundIp && <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>IP to whitelist on your Delta key: <b style={{ color: "var(--ink)" }}>{delta.serverOutboundIp}</b></div>}
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>public {delta.public && delta.public.ok ? "✓" : "✗"} · signed {(delta.userSigned || delta.signed || {}).ok ? "✓" : "✗"} · proxy {delta.proxyConfigured ? "on" : "off"}</div>
          </div>
        );
      })()}
      {err && <div style={{ fontSize: 12, color: "var(--down)", marginBottom: 8 }}>{err}</div>}
      {!ov ? <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</div> : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tile("Real traders", s.realTradingUsers)}
            {tile("Active real", s.activeRealStrategies)}
            {tile("Open pos", s.openManagedPositions)}
            {tile("Unprotected", s.unprotectedPositions, s.unprotectedPositions > 0)}
            {tile("Unresolved", s.unresolvedOrders, s.unresolvedOrders > 0)}
            {tile("Pending prot", s.pendingProtection, s.pendingProtection > 0)}
            {tile("Halted", s.haltedAccounts)}
          </div>
          {(s.oldestUnresolvedMs != null || s.oldestPendingProtectionMs != null) && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              Oldest unresolved order: <b style={{ color: s.oldestUnresolvedMs > 3600000 ? "var(--down)" : "var(--ink)" }}>{ageStr(s.oldestUnresolvedMs)}</b> · oldest pending protection: <b>{ageStr(s.oldestPendingProtectionMs)}</b>
            </div>
          )}

          {ov.unprotectedPositions && ov.unprotectedPositions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--down)", marginBottom: 6 }}>⚠ Unprotected positions ({ov.unprotectedPositions.length})</div>
              {ov.unprotectedPositions.slice(0, 20).map((p, i) => (
                <div key={i} style={{ ...card, margin: "6px 0", padding: "8px 10px", fontSize: 11.5, display: "flex", justifyContent: "space-between" }}>
                  <span className="mono">{p.symbol} · {p.broker} · qty {p.qty}</span>
                  <span style={{ color: "var(--muted)" }}>{p.userId}</span>
                </div>
              ))}
            </div>
          )}

          {ov.haltedAccounts && ov.haltedAccounts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>Halted accounts ({ov.haltedAccounts.length})</div>
              {ov.haltedAccounts.slice(0, 20).map((uid, i) => (
                <div key={i} style={{ ...card, margin: "6px 0", padding: "8px 10px", fontSize: 11.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono">{uid}</span>
                  <button onClick={() => resumeUser(String(uid).replace(/^ph_/, ""))} disabled={busy} className="tap" style={{ border: "1px solid var(--up)", background: "var(--surface)", color: "var(--up)", borderRadius: 8, padding: "4px 10px", fontWeight: 800, fontSize: 11 }}>Resume</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>Incident note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record an incident / action for the audit trail…" rows={2}
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: 9, fontSize: 12.5, background: "var(--elev)", color: "var(--ink)", resize: "vertical" }} />
            <button onClick={saveNote} disabled={busy || !note.trim()} className="tap disp" style={{ marginTop: 6, border: "none", background: "var(--primary)", color: "var(--on-primary)", borderRadius: 10, padding: "7px 14px", fontWeight: 800, fontSize: 12, opacity: note.trim() ? 1 : 0.6 }}>Record note</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>Cost / slippage (last 30d)</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input value={cmPhone} onChange={(e) => setCmPhone(e.target.value)} placeholder="user phone" className="mono" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", fontSize: 12, background: "var(--elev)", color: "var(--ink)", width: 150 }} />
              <button onClick={loadCost} disabled={!cmPhone.trim()} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, padding: "6px 12px", fontWeight: 800, fontSize: 12, opacity: cmPhone.trim() ? 1 : 0.6 }}>Load</button>
            </div>
            {cm && (
              <div style={{ ...card, marginTop: 8, padding: "10px 12px", fontSize: 11.5 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span>Net P&L: <b className="mono" style={{ color: cm.realizedNet >= 0 ? "var(--up)" : "var(--down)" }}>{cm.realizedNet}</b></span>
                  <span>Gross: <b className="mono">{cm.realizedGross}</b></span>
                  <span>Fees: <b className="mono">{cm.totalFees}</b></span>
                  <span>Fee drag: <b className="mono">{cm.feeDragPct == null ? "—" : cm.feeDragPct + "%"}</b></span>
                  <span>Round-trips: <b className="mono">{cm.roundTrips}</b></span>
                </div>
                <div style={{ marginTop: 6, color: "var(--muted)" }}>
                  Slippage: {cm.slippage && cm.slippage.available ? <b>{cm.slippage.avgBps} bps avg ({cm.slippage.samples})</b> : <span>not measurable yet (no reference price on fills)</span>}
                </div>
                {cm.byBroker && Object.keys(cm.byBroker).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {Object.entries(cm.byBroker).map(([b, v]) => (
                      <div key={b} className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{b}: net {v.net} · fees {v.fees} · {v.matched} rt</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            {!showAudit ? (
              <button onClick={loadAudit} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 10, padding: "7px 14px", fontWeight: 800, fontSize: 12 }}>View audit log</button>
            ) : (
              <>
                <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>Audit log (latest 100)</div>
                {audit == null ? <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</div> : audit.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No entries yet.</div> : (
                  <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
                    {audit.map((a, i) => (
                      <div key={a.id || i} style={{ padding: "7px 10px", borderTop: i ? "1px solid var(--line)" : "none", fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: 800 }}>{a.action}{a.target ? ` · ${a.target}` : ""}</span>
                          <span style={{ color: "var(--muted)" }}>{new Date(a.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div style={{ color: "var(--muted)", marginTop: 1 }}>{a.actor} ({a.role}){a.detail && a.detail.note ? ` — ${a.detail.note}` : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
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
  const del = async (id) => { await apiDeleteIdea(id); refresh(); };
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

/* Strategies for ONE user in the admin console.
   - Shows the first 5 by default; "Show more" expands the section to the full list. */
function StrategiesSection({ strats = [], cardStyle }) {
  const [expanded, setExpanded] = useState(false);
  const CAP = 5;
  const shown = expanded ? strats : strats.slice(0, CAP);
  const hidden = Math.max(0, strats.length - CAP);
  return (
    <div style={cardStyle}>
      <div className="disp" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
        Strategies {strats.length ? `(${strats.length})` : ""}
      </div>
      {strats.length
        ? shown.map((s, i) => (
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
      {hidden > 0 && (
        <button onClick={() => setExpanded((v) => !v)} className="tap disp"
          style={{ marginTop: 10, width: "100%", border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>
          {expanded ? "Show less" : `Show more (${hidden} more)`}
        </button>
      )}
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
  const [fReal, setFReal] = useState("All");   // All | Real | Virtual
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [expanded, setExpanded] = useState(false);

  const stamp = (t) => t.exitAt || t.entryAt || t.at || t.ts || 0;
  const TYPES = ["All", "Manual", "Automate", "Auto Buy"];
  const MKTS = ["All", "IN", "US", "Crypto", "Commodity"];
  // Real orders are journalled with real:true; paper ones aren't — that's the real/virtual split.
  const REALS = ["All", "Real", "Virtual"];

  const from = dFrom ? new Date(dFrom + "T00:00:00").getTime() : 0;
  const to = dTo ? new Date(dTo + "T23:59:59.999").getTime() : Date.now();

  const rows = useMemo(() => (trades || [])
    .filter((t) => (fType === "All" ? true : (t.tradeType || "Manual") === fType))
    .filter((t) => (fMkt === "All" ? true : (t.market || "IN") === fMkt))
    .filter((t) => (fReal === "All" ? true : fReal === "Real" ? !!t.real : !t.real))
    .filter((t) => { const ts = stamp(t); return ts >= from && ts <= to; })
    .sort((a, b) => stamp(b) - stamp(a)),
    [trades, fType, fMkt, fReal, from, to]);

  const shown = expanded ? rows : rows.slice(0, 10);
  const exportCSV = () => downloadCSV(tradeFilename("matrix-user-trades"), tradesToCSV(rows, () => null));

  const chip = (on) => ({
    flex: "0 0 auto", padding: "5px 10px", fontSize: 10.5, fontWeight: 800, borderRadius: 9, cursor: "pointer",
    border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
    background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--on-primary)" : "var(--ink)",
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

      {/* Real / Virtual chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {REALS.map((r) => <button key={r} onClick={() => setFReal(r)} style={chip(fReal === r)}>{r === "All" ? "All modes" : r}</button>)}
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
