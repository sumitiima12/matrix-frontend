import React, { useEffect, useMemo, useState } from "react";
import { Check, Link2, Search, X, AlertTriangle, ExternalLink } from "lucide-react";
import { BROKERS } from "../../domain/brokers";
import { brokerStatus, brokerLoginUrl, saveBrokerAppCreds } from "../../services/brokerService";

/**
 * BrokerSheet — connect a real broker.
 *
 * Connecting gives you REAL-TIME prices. It does NOT arm real-money orders: that is
 * a separate switch on the server (BROKER_TRADING_ENABLED), and this sheet says so,
 * because the gap between "live prices" and "live money" is the most dangerous
 * ambiguity in a trading app.
 *
 * Three states, kept distinct on purpose — they look identical to a user but have
 * completely different fixes:
 *
 *   "Ready to connect"      the server has this broker's keys. Go.
 *   "Keys not set on server" the adapter works; nobody added the API key to Render.
 *   "Can't reach the server" we have NO IDEA what's configured. Not the same thing.
 *
 * Collapsing the last two into one grey "Not configured" is what sent us chasing
 * a phantom bug when the backend was in fact reporting configured: true.
 */

const TONE = {
  ready:   { label: "Available",           c: "var(--up)" },
  gateway: { label: "Needs local gateway", c: "var(--amber)" },
  none:    { label: "No public API",       c: "var(--muted)" },
};

/**
 * ONE BROKER PER MARKET — all connected at the same time.
 *
 * connectedIds is now a SET, not a single id: FYERS for Indian, Schwab for US, Delta for
 * crypto. No single broker covers all three, so a one-at-a-time model could never give you
 * a fully live portfolio. Connecting a second broker no longer evicts the first.
 */
/* Map a broker's market tags to the 4 gate markets the admin controls (F&O rides on Indian). */
function gateMarketsFor(b) {
  const out = new Set();
  (b.markets || []).forEach((m) => {
    if (m === "IN" || m === "FNO") out.add("IN");
    else if (m === "US") out.add("US");
    else if (m === "Crypto") out.add("Crypto");
    else if (m === "Commodity") out.add("Commodity");
  });
  return [...out];
}

export default function BrokerSheet({ userId, connectedIds = [], marketMap = {}, onDisconnect, onClose, onConnect, marketFilter = null, isAdmin = false, canConnectMarket = () => true }) {
  const connectedId = connectedIds[0] || null;   // back-compat for the copy below
  const [q, setQ] = useState("");
  const [server, setServer] = useState(null);
  const [statusErr, setStatusErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [credFor, setCredFor] = useState(null);   // broker id whose credential form is open
  const [creds, setCreds] = useState({});
  // The static egress IP the user whitelists in their own broker app (from the server).
  const [staticIp, setStaticIp] = useState(null);
  // The redirect URL they must register in their broker app — the exact URL we send them back to.
  const redirectUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";

  useEffect(() => {
    brokerStatus(userId)
      .then((d) => { setServer(d); setStatusErr(null); if (d && d.staticIp) setStaticIp(d.staticIp); })
      .catch((e) => { setServer(null); setStatusErr(String(e.message || e)); });
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = BROKERS;
    // Server-side house feeds (FYERS, Delta) aren't per-user connects — hide unless admin.
    if (!isAdmin) list = list.filter((b) => !b.adminOnly);
    // Only show brokers that actually serve the market we're connecting for.
    if (marketFilter) list = list.filter((b) => (b.markets || []).includes(marketFilter));
    if (t) list = list.filter((b) => b.name.toLowerCase().includes(t));
    const rank = { ready: 0, gateway: 1, none: 2 };
    return [...list].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [q, marketFilter, isAdmin]);

  const submitCreds = async (b) => {
    const missing = (b.fields || []).filter((f) => !String(creds[f.key] || "").trim());
    if (missing.length) { setErr(`Enter: ${missing.map((f) => f.label).join(", ")}.`); return; }
    setErr(null);
    setBusy(b.id);
    try {
      await onConnect(b.id, null, creds, marketFilter);   // bring-your-own credentials, for this market
      setBusy(null); setCredFor(null); setCreds({});
      onClose && onClose();
    } catch (e) {
      setErr(String(e.message || e));
      setBusy(null);
    }
  };

  /* BRING-YOUR-OWN-APP + OAuth (FYERS): save the user's own app id/secret on the server,
     THEN send them to the broker's login page. Two steps behind one button. */
  const submitByoa = async (b) => {
    const appId = String(creds.appId || "").trim();
    const secret = String(creds.secret || "").trim();
    if (!appId || !secret) { setErr("Enter your App ID and Secret ID."); return; }
    setErr(null);
    setBusy(b.id);
    try {
      await saveBrokerAppCreds(b.id, appId, secret, String(creds.pin || "").trim());
      const url = await brokerLoginUrl(b.id, redirectUrl, userId);
      window.location.href = url;      // the broker's own login — we never see the password
    } catch (e) {
      setErr(String(e.message || e));
      setBusy(null);
    }
  };

  const start = async (b) => {
    setErr(null);
    // Bring-your-own-app OR bring-your-own-credential brokers open an inline form first.
    if (b.userCreds || b.byoaOAuth) { setCredFor((cur) => (cur === b.id ? null : b.id)); setCreds({}); return; }
    setBusy(b.id);
    try {
      /* Delta has no login page. It authenticates with API keys held on the SERVER and
         signs each request, so there is nothing to redirect to — we just ask the server
         to prove the keys work and hand back a session. Sending it down the OAuth path
         would bounce the user to a URL that doesn't exist. */
      if (b.apiKeyOnly) {
        await onConnect(b.id, null);        // server verifies the keys with a signed call
        setBusy(null);
        onClose && onClose();
        return;
      }

      const redirect = window.location.origin + window.location.pathname;
      const url = await brokerLoginUrl(b.id, redirect, userId);
      window.location.href = url;     // the broker's own login page — we never see the password
    } catch (e) {
      setErr(String(e.message || e));
      setBusy(null);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 150 }} />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto",
          background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 151,
          maxHeight: "80vh", overflowY: "auto", padding: "16px 18px 26px",
          boxShadow: "0 -16px 44px rgba(0,0,0,.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
              <Link2 size={17} /> Connect your brokers
            </div>

        {/* WHICH MARKET IS COVERED BY WHAT. This is the whole point of multi-broker: you can
            see at a glance that Indian is live on FYERS while US has nothing connected. */}
        <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
          {[["IN", "Indian"], ["US", "US"], ["Crypto", "Crypto"]].map(([m, label]) => {
            const bid = marketMap[m];
            const meta = bid ? BROKERS.find((x) => x.id === bid) : null;
            return (
              <div key={m} style={{
                flex: 1, padding: "8px 6px", borderRadius: 10, textAlign: "center",
                border: "1px solid " + (bid ? "var(--up)" : "var(--line)"),
                background: bid ? "rgba(34,197,94,.08)" : "var(--elev)",
              }}>
                <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, letterSpacing: ".03em" }}>{label.toUpperCase()}</div>
                <div className="disp" style={{ fontSize: 11, fontWeight: 800, marginTop: 3, color: bid ? "var(--up)" : "var(--muted)" }}>
                  {meta ? meta.name : "Not connected"}
                </div>
              </div>
            );
          })}
        </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>
              Yahoo prices are delayed ~15 minutes. A broker feed is live, and brings real open interest and depth.
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="tap"
            style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 13, padding: 11, borderRadius: 11, background: "var(--elev)" }}>
          <AlertTriangle size={15} color="var(--amber)" style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
            Connecting gives Matrix <b style={{ color: "var(--ink)" }}>live market data</b>. Your trades stay on virtual
            capital unless you switch to Real mode, which needs live trading enabled on the server.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, background: "var(--elev)", borderRadius: 12, padding: "10px 12px" }}>
          <Search size={16} color="var(--muted)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brokers…"
            aria-label="Search brokers"
            className="no-ring"
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: "var(--ink)", fontSize: 13.5 }}
          />
        </div>

        {err && <div style={{ fontSize: 11.5, color: "var(--down)", marginTop: 10, fontWeight: 600 }}>{err}</div>}

        {statusErr && (
          <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 10, fontWeight: 600, lineHeight: 1.5 }}>
            Couldn't reach the server to check which brokers are set up ({statusErr}). That is NOT the same as a
            broker being unconfigured — the app simply cannot tell yet.
          </div>
        )}
        {!server && !statusErr && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>Checking the server…</div>
        )}

        {shown.map((b) => {
          const isConnected = connectedIds.includes(b.id);
          const configured = Boolean(server && server.brokers && server.brokers[b.id] && server.brokers[b.id].configured);
          // Bring-your-own-app / bring-your-own-credential brokers don't need SERVER keys — the
          // user supplies them inline — so they're connectable regardless of `configured`.
          const selfServe = b.byoaOAuth || b.userCreds;
          // Admin gate: connectable only if the admin allows broker-connect for a market this
          // broker serves (admins pass through — canConnectMarket returns true for them).
          const gm = marketFilter ? [marketFilter] : gateMarketsFor(b);
          const marketAllowed = gm.some((m) => canConnectMarket(m));
          const canConnect = b.status === "ready" && (configured || selfServe) && marketAllowed;
          const tone = TONE[b.status] || TONE.none;

          const stateLabel = isConnected ? "Connected"
            : canConnect ? "Ready to connect"
            : b.status === "ready" && server ? "Keys not set on server"
            : b.status === "ready" ? tone.label
            : tone.label;

          const stateColor = isConnected || canConnect ? "var(--up)"
            : b.status === "ready" && server ? "var(--amber)"
            : tone.c;

          return (
            <div key={b.id} className="card" style={{ marginTop: 10, padding: 13, border: isConnected ? "1px solid var(--up)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span className="disp" style={{ fontWeight: 800, fontSize: 14 }}>{b.name}</span>
                    {isConnected && (
                      <span className="pill" style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", background: "var(--up-soft)", color: "var(--up)", display: "flex", alignItems: "center", gap: 3 }}>
                        <Check size={9} /> LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontWeight: 700 }}>
                    {b.markets.join(" · ")}
                    <span style={{ color: stateColor, marginLeft: 8 }}>● {stateLabel}</span>
                  </div>
                </div>

                {isConnected ? (
                  <button onClick={() => onDisconnect(b.id)} className="tap disp"
                    style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    Disconnect
                  </button>
                ) : canConnect ? (
                  <button onClick={() => start(b)} disabled={busy === b.id} className="tap disp"
                    style={{ flex: "0 0 auto", border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontSize: 12, cursor: "pointer", opacity: busy === b.id ? 0.5 : 1 }}>
                    {busy === b.id ? "…" : "Connect"}
                  </button>
                ) : null}
              </div>

              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>{b.note}</div>

              {/* Credential entry for bring-your-own-token brokers (Dhan, IND Money, Angel One, Groww)
                  and bring-your-own-app + OAuth brokers (FYERS). */}
              {credFor === b.id && !isConnected && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {/* BYOA setup: what to configure in the user's own broker app before connecting. */}
                  {b.byoaOAuth && (
                    <div style={{ marginBottom: 12, padding: 11, borderRadius: 11, background: "var(--elev)" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)", marginBottom: 7 }}>
                        In your FYERS app (myapi.fyers.in), set these:
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>REDIRECT URL</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", color: "var(--ink)", background: "var(--surface)", borderRadius: 8, padding: "6px 8px", marginBottom: 8 }}>
                        {redirectUrl}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>WHITELIST THIS IP</div>
                      <div style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--ink)", background: "var(--surface)", borderRadius: 8, padding: "6px 8px" }}>
                        {staticIp || "— (set BROKER_STATIC_IP on the server)"}
                      </div>
                    </div>
                  )}
                  {(b.fields || []).map((f) => (
                    <div key={f.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800, marginBottom: 4 }}>{f.label.toUpperCase()}</div>
                      <input
                        value={creds[f.key] || ""}
                        onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                        type={f.type === "password" ? "password" : "text"}
                        placeholder={f.hint || ""}
                        className="no-ring"
                        autoComplete="off"
                        style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 11px", fontSize: 12.5, background: "var(--elev)", color: "var(--ink)" }}
                      />
                      {f.hint && <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{f.hint}</div>}
                    </div>
                  ))}
                  <button onClick={() => (b.byoaOAuth ? submitByoa(b) : submitCreds(b))} disabled={busy === b.id} className="tap disp"
                    style={{ width: "100%", marginTop: 4, border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 10, padding: 11, fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: busy === b.id ? 0.5 : 1 }}>
                    {busy === b.id ? (b.byoaOAuth ? "Saving…" : "Connecting…") : (b.byoaOAuth ? `Save & log in to ${b.name}` : `Connect ${b.name}`)}
                  </button>
                </div>
              )}

              {b.status === "ready" && server && !configured && !selfServe && marketAllowed && (
                <div style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 6, fontWeight: 600, lineHeight: 1.45 }}>
                  Add this broker's API key and secret to the server's environment variables, then redeploy.
                </div>
              )}

              {!isConnected && !marketAllowed && (
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, fontWeight: 600, lineHeight: 1.45 }}>
                  Connecting a broker for this market is currently turned off by the admin.
                </div>
              )}

              {b.docs && (
                <a href={b.docs} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10.5, color: "var(--primary)", marginTop: 6, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  API docs <ExternalLink size={10} />
                </a>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          You log in on the broker's own site — Matrix never sees your password, and your API secret stays on the
          server. Broker tokens expire daily, so you'll re-connect each morning. That's their rule, not ours.
        </div>
      </div>
    </>
  );
}
