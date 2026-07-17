import React, { useState } from "react";
import { Wallet, X } from "lucide-react";
import { fmt } from "../../lib/format";

/**
 * WalletSheet — the paper-trading wallet, one balance per market.
 *
 * Each market has its OWN wallet, because they settle in different currencies and
 * mixing them would be meaningless: your Indian wallet is in ₹, your US and crypto
 * wallets in $. Adding ₹1,00,000 to the Indian wallet must not silently inflate
 * your dollar buying power.
 *
 * This is VIRTUAL money for paper trading. The app says so plainly rather than
 * dressing it up — nothing here touches a real account, and no real broker is
 * connected. Fills still happen at REAL market prices (see MockBroker), so the
 * P&L you make against this balance is honest; only the capital is imaginary.
 */

const PRESETS = {
  IN:        [50000, 100000, 500000, 1000000],
  US:        [1000, 5000, 10000, 50000],
  Crypto:    [1000, 5000, 10000, 50000],
  Commodity: [1000, 5000, 10000, 50000],
};

const LABEL = {
  IN: "🇮🇳 Indian equity",
  US: "🇺🇸 US equity",
  Crypto: "₿ Crypto",
  Commodity: "🪙 Commodity",
};

/** F&O and Indian equity settle in rupees; the rest in dollars. */
const CCY = { IN: "IN", US: "US", Crypto: "Crypto", Commodity: "Commodity" };

export default function WalletSheet({ walletMap = {}, onAdd, onReset, onClose }) {
  const [custom, setCustom] = useState({});

  const addCustom = (mkt) => {
    const v = parseFloat(String(custom[mkt] || "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(v) || v <= 0) return;
    onAdd(mkt, v);
    setCustom((c) => ({ ...c, [mkt]: "" }));
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 120 }} />
      <div
        className="glass"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460, margin: "0 auto",
          background: "var(--surface)", borderRadius: "22px 22px 0 0", zIndex: 121,
          maxHeight: "80vh", overflowY: "auto", padding: "16px 18px 28px",
          boxShadow: "0 -16px 44px rgba(0,0,0,.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div className="disp" style={{ fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={18} color="var(--gold)" /> Wallet
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>
              Virtual money for paper trading. Orders fill at real market prices — only the capital is imaginary.
            </div>
          </div>
          <button onClick={onClose} className="tap" aria-label="Close wallet"
            style={{ border: "none", background: "var(--elev)", borderRadius: 10, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto" }}>
            <X size={16} />
          </button>
        </div>

        {Object.keys(LABEL).map((mkt) => {
          const bal = walletMap[mkt] ?? 0;
          const ccy = CCY[mkt];
          return (
            <div key={mkt} className="card" style={{ marginTop: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>{LABEL[mkt]}</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{fmt(bal, ccy)}</span>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                {(PRESETS[mkt] || []).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => onAdd(mkt, amt)}
                    className="tap mono"
                    style={{
                      flex: "1 1 auto", minWidth: 70, border: "1px solid var(--line)", background: "var(--elev)",
                      color: "var(--ink)", borderRadius: 10, padding: "8px 6px", fontWeight: 800, fontSize: 11.5, cursor: "pointer",
                    }}
                  >
                    + {fmt(amt, ccy)}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  value={custom[mkt] || ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [mkt]: e.target.value.replace(/[^0-9.]/g, "") }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustom(mkt); }}
                  inputMode="decimal"
                  placeholder="Custom amount"
                  aria-label={`Custom amount for ${LABEL[mkt]}`}
                  className="no-ring mono"
                  style={{
                    flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 10,
                    padding: "9px 11px", fontSize: 12.5, fontWeight: 700,
                    background: "var(--elev)", color: "var(--ink)",
                  }}
                />
                <button
                  onClick={() => addCustom(mkt)}
                  className="tap disp"
                  style={{ flex: "0 0 auto", border: "none", background: "var(--up)", color: "#fff", borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}

        {onReset && (
          <button
            onClick={onReset}
            className="tap"
            style={{ width: "100%", marginTop: 16, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", borderRadius: 11, padding: 11, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
          >
            Reset all wallets to starting balance
          </button>
        )}
      </div>
    </>
  );
}
