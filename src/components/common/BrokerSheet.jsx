import React, { useEffect, useState } from "react";
import { Link2, X, AlertTriangle, Check } from "lucide-react";
import { brokerStatus, brokerLoginUrl, brokerSession, clearSession } from "../../services/brokerService";
import { BROKER_COVERAGE } from "../../domain/brokerSymbols";

/**
 * BrokerSheet — connect a real broker.
 *
 * Every broker here is listed with what it can ACTUALLY do today, not what we wish
 * it did. Zerodha and FYERS have working real-time quote + order integrations.
 * The rest are listed as "coming" because their APIs key off numeric instrument
 * IDs we have not downloaded yet, and quoting the wrong instrument is worse than
 * quoting none. No greyed-out button pretending to be one tap away.
 */

const ORDER = ["zerodha", "fyers", "dhan", "angelone", "groww", "delta", "schwab", "robinhood"];

const MKT_TXT = { IN: "Indian stocks", FNO: "F&O", US: "US stocks", Crypto: "Crypto" };

export default function BrokerSheet({ session, onConnected, onDisconnect, onClose }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState({ broker: null, token: "" });

  useEffect(() => { brokerStatus().then(setStatus); }, []);

  const connect = async (id) => {
    setErr(null); setBusy(id);
    try {
      const url = await brokerLoginUrl(id, window.location.origin);
      // The broker redirects back with a request_token / auth_code in the URL.
      window.open(url, "_blank", "noopener");
      setManual({ broker: id, token: "" });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    if (!manual.broker || !manual.token.trim()) return;
    setErr(null); setBusy(manual.broker);
    try {
      const s = await brokerSession(manual.broker, manual.token.trim());
      onConnected && onConnected(s);
      setManual({ broker: null, token: "" });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 150 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto",
        background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 151,
        maxHeight: "88vh", overflowY: "auto", padding: "16px 18px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={18} color="var(--primary)" /> Connect your broker
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>
              Yahoo prices are delayed ~15 minutes. A broker feed is live.
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="tap"
            style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto" }}>
            <X size={16} />
          </button>
        </div>

        {session && (
          <div className="card" style={{ marginTop: 14, padding: 13, border: "1px solid var(--up)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={15} color="var(--up)" />
                <span className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>
                  {(BROKER_COVERAGE[session.broker] || {}).name} connected
                </span>
              </div>
              <button onClick={() => { clearSession(); onDisconnect && onDisconnect(); }} className="tap"
                style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 9, padding: "6px 11px", fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}>
                Disconnect
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 7, lineHeight: 1.45 }}>
              Live prices are on. Trades still fill on paper — real-money orders need
              to be switched on separately on the server.
            </div>
          </div>
        )}

        {err && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, padding: 11, borderRadius: 11, background: "var(--elev)" }}>
            <AlertTriangle size={15} color="var(--down)" style={{ flex: "0 0 auto", marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>{err}</span>
          </div>
        )}

        {/* After the broker redirects back, paste the token it returned. */}
        {manual.broker && (
          <div className="card" style={{ marginTop: 12, padding: 13 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              Finish connecting {(BROKER_COVERAGE[manual.broker] || {}).name}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 9 }}>
              After logging in, your browser is redirected back with a
              <span className="mono"> request_token</span> (Zerodha) or
              <span className="mono"> auth_code</span> (FYERS) in the address bar. Paste it here.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={manual.token}
                onChange={(e) => setManual((m) => ({ ...m, token: e.target.value }))}
                placeholder="Paste the token"
                aria-label="Broker request token"
                className="no-ring mono"
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 11px", fontSize: 12, background: "var(--elev)", color: "var(--ink)" }}
              />
              <button onClick={finish} disabled={!manual.token.trim() || busy} className="tap disp"
                style={{ border: "none", background: "var(--primary)", color: "#fff", borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", opacity: manual.token.trim() ? 1 : 0.5 }}>
                {busy ? "…" : "Connect"}
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 800, letterSpacing: ".04em", margin: "18px 2px 8px" }}>
          BROKERS
        </div>

        {ORDER.map((id) => {
          const c = BROKER_COVERAGE[id];
          if (!c) return null;
          const configured = status && status.brokers && status.brokers[id] && status.brokers[id].configured;
          const ready = c.realtime;                   // has a working integration
          const isThis = session && session.broker === id;

          return (
            <div key={id} className="card" style={{ marginTop: 8, padding: 12, display: "flex", alignItems: "center", gap: 10, opacity: ready ? 1 : 0.62 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>{c.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                  {c.markets.map((m) => MKT_TXT[m] || m).join(" · ")}
                  {ready
                    ? " · real-time"
                    : " · integration not built yet"}
                </div>
              </div>

              {isThis ? (
                <span className="pill" style={{ fontSize: 9.5, fontWeight: 800, padding: "4px 9px", background: "var(--up-soft)", color: "var(--up)" }}>CONNECTED</span>
              ) : ready ? (
                <button
                  onClick={() => connect(id)}
                  disabled={busy === id || !configured}
                  className="tap disp"
                  style={{
                    border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12,
                    background: configured ? "var(--primary)" : "var(--elev)",
                    color: configured ? "#fff" : "var(--muted)",
                    cursor: configured ? "pointer" : "not-allowed", flex: "0 0 auto",
                  }}
                  title={configured ? "" : "Server is missing this broker's API key"}
                >
                  {busy === id ? "…" : configured ? "Connect" : "Not configured"}
                </button>
              ) : (
                <span className="pill" style={{ fontSize: 9.5, fontWeight: 700, padding: "4px 9px", background: "var(--elev)", color: "var(--muted)", flex: "0 0 auto" }}>SOON</span>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>
          Your API secret never reaches the browser — the login exchange happens on the
          server. Tokens expire daily at both Zerodha and FYERS, so you'll re-connect each
          morning; that's their rule, not ours.
        </div>
      </div>
    </>
  );
}
