import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Trash2 } from "lucide-react";
import { OVERLAY_COLORS } from "../../lib/indicators";

/**
 * IndicatorPanel — the chart-settings sheet.
 *
 * Candle type (Regular / Heikin Ashi / Line), plus fully EDITABLE indicators: add any number of
 * moving averages / Bollinger bands at ANY length, and set MACD (fast/slow/signal) and RSI length —
 * the same control you get in Automate's ⚙, but for the chart. Volume is a toggle.
 */
export default function IndicatorPanel({
  open = true, onClose,
  overlays = [], setOverlays,
  showMacd, setShowMacd, macdP = { fast: 12, slow: 26, signal: 9 }, setMacdP,
  showRsi, setShowRsi, rsiN = 14, setRsiN,
  showAdx, setShowAdx, adxN = 14, setAdxN,
  showStoch, setShowStoch, stochN = 14, setStochN,
  showAtr, setShowAtr, atrN = 14, setAtrN,
  showSd, setShowSd, sdN = 20, setSdN,
  showVol, setShowVol,
  ctype, setCtype,
}) {
  const [addType, setAddType] = useState("ema");
  const [addLen, setAddLen] = useState("100");
  if (open === false) return null;

  const numStyle = { width: 52, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 4px", fontWeight: 800, fontSize: 12.5, background: "var(--elev)", color: "var(--ink)" };
  const int = (v, min = 1) => Math.max(min, parseInt(String(v).replace(/[^0-9]/g, ""), 10) || min);

  const updateOverlay = (i, patch) => setOverlays((p) => p.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const removeOverlay = (i) => setOverlays((p) => p.filter((_, j) => j !== i));
  // Which overlay types take a length/lookback input (the rest derive everything from OHLC).
  const HAS_LEN = new Set(["ema", "sma", "bb", "keltner", "fib"]);
  const DEFAULT_LEN = { ema: 21, sma: 20, bb: 20, keltner: 20, fib: 90 };

  const addOverlay = () => {
    const used = new Set(overlays.map((o) => o.color));
    const color = OVERLAY_COLORS.find((c) => !used.has(c)) || OVERLAY_COLORS[overlays.length % OVERLAY_COLORS.length];
    if (!HAS_LEN.has(addType)) { setOverlays((p) => [...p, { type: addType, color }]); return; }
    const n = int(addLen) || DEFAULT_LEN[addType] || 20;
    setOverlays((p) => [...p, { type: addType, n, color, ...(addType === "bb" || addType === "keltner" ? { mult: 2 } : {}) }]);
  };

  const TYPE_LABEL = { ema: "EMA", sma: "SMA", bb: "Bollinger", keltner: "Keltner", vwap: "VWAP", cpr: "CPR", pivots: "Pivots", ichimoku: "Ichimoku", fib: "Fibonacci" };

  /* PORTAL to <body>. The details page slides up inside a CSS-transformed container, and a
     position:fixed child of a transformed ancestor is positioned relative to THAT ancestor, not
     the viewport — so the sheet rendered off-screen and only the grey backdrop showed. Portalling
     to body escapes the transform and the sheet appears correctly on both the drawer and details. */
  const sheet = (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.45)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet card"
        style={{ width: "100%", maxWidth: 460, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "82vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 14px" }} />
        <div className="disp" style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Chart settings</div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Candle type. */}
          {setCtype && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>Candle type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["candle", "Regular"], ["heikin", "Heikin Ashi"], ["line", "Line"]].map(([k, l]) => (
                  <button key={k} onClick={() => setCtype(k)} className="pill tap disp"
                    style={{ flex: 1, padding: "8px 6px", fontSize: 11.5, fontWeight: 800, borderRadius: 10,
                      border: "1px solid " + (ctype === k ? "var(--primary)" : "var(--line)"),
                      background: ctype === k ? "var(--primary)" : "var(--surface)",
                      color: ctype === k ? "var(--on-primary)" : "var(--ink)" }}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Moving averages & Bollinger bands — each editable to any length. */}
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>Moving averages &amp; bands</div>
          {overlays.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: o.color, flex: "0 0 auto" }} />
              <select value={o.type} onChange={(e) => updateOverlay(i, { type: e.target.value })}
                style={{ ...numStyle, width: 92, fontWeight: 800 }}>
                <option value="ema">EMA</option>
                <option value="sma">SMA</option>
                <option value="bb">Bollinger</option>
                <option value="keltner">Keltner</option>
                <option value="vwap">VWAP</option>
                <option value="cpr">CPR</option>
                <option value="pivots">Pivots</option>
                <option value="ichimoku">Ichimoku</option>
                <option value="fib">Fibonacci</option>
              </select>
              {HAS_LEN.has(o.type) && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{o.type === "fib" ? "look" : "length"}</span>}
              {HAS_LEN.has(o.type) && <input value={o.n} inputMode="numeric" onChange={(e) => updateOverlay(i, { n: int(e.target.value) })} className="no-ring mono" style={numStyle} />}
              {o.type === "bb" && (<>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>×</span>
                <input value={o.mult == null ? 2 : o.mult} inputMode="decimal" onChange={(e) => updateOverlay(i, { mult: Math.max(0.1, parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 2) })} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
              </>)}
              <button onClick={() => removeOverlay(i)} className="tap" style={{ marginLeft: "auto", border: "none", background: "transparent", padding: 2 }}><Trash2 size={15} color="var(--down)" /></button>
            </div>
          ))}
          {/* Add a new overlay at any length. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <select value={addType} onChange={(e) => setAddType(e.target.value)} style={{ ...numStyle, width: 96, fontWeight: 800 }}>
              <option value="ema">EMA</option>
              <option value="sma">SMA</option>
              <option value="bb">Bollinger</option>
              <option value="keltner">Keltner</option>
              <option value="vwap">VWAP</option>
              <option value="cpr">CPR</option>
              <option value="pivots">Pivots</option>
              <option value="ichimoku">Ichimoku</option>
              <option value="fib">Fibonacci</option>
            </select>
            {HAS_LEN.has(addType) && <input value={addLen} inputMode="numeric" onChange={(e) => setAddLen(e.target.value.replace(/[^0-9]/g, ""))} placeholder={addType === "fib" ? "look" : "length"} className="no-ring mono" style={numStyle} />}
            <button onClick={addOverlay} className="tap disp" style={{ display: "flex", alignItems: "center", gap: 5, border: "1px dashed var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 800 }}>
              <Plus size={14} /> Add {TYPE_LABEL[addType] || ""}
            </button>
          </div>

          {/* Sub-panels — MACD / RSI with editable params, Volume. */}
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, margin: "18px 0 6px" }}>Sub-panels</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <Box checked={showMacd} onClick={() => setShowMacd(!showMacd)} />
            <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>MACD</span>
            {showMacd && setMacdP && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                {[["fast", "F"], ["slow", "S"], ["signal", "Sig"]].map(([k, l]) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>{l}</span>
                    <input value={macdP[k]} inputMode="numeric" onChange={(e) => setMacdP({ ...macdP, [k]: int(e.target.value, 1) })} className="no-ring mono" style={{ ...numStyle, width: 40 }} />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <Box checked={showRsi} onClick={() => setShowRsi(!showRsi)} />
            <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>RSI</span>
            {showRsi && setRsiN && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>length</span>
                <input value={rsiN} inputMode="numeric" onChange={(e) => setRsiN(int(e.target.value, 2))} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
              </div>
            )}
          </div>

          {setShowAdx && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <Box checked={showAdx} onClick={() => setShowAdx(!showAdx)} />
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>ADX</span>
              {showAdx && setAdxN && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                  <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>length</span>
                  <input value={adxN} inputMode="numeric" onChange={(e) => setAdxN(int(e.target.value, 2))} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
                </div>
              )}
            </div>
          )}

          {setShowStoch && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <Box checked={showStoch} onClick={() => setShowStoch(!showStoch)} />
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>Stochastic</span>
              {showStoch && setStochN && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                  <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>length</span>
                  <input value={stochN} inputMode="numeric" onChange={(e) => setStochN(int(e.target.value, 2))} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
                </div>
              )}
            </div>
          )}

          {setShowAtr && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <Box checked={showAtr} onClick={() => setShowAtr(!showAtr)} />
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>ATR</span>
              {showAtr && setAtrN && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                  <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>length</span>
                  <input value={atrN} inputMode="numeric" onChange={(e) => setAtrN(int(e.target.value, 2))} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
                </div>
              )}
            </div>
          )}

          {setShowSd && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <Box checked={showSd} onClick={() => setShowSd(!showSd)} />
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: "0 0 auto" }}>Std deviation</span>
              {showSd && setSdN && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                  <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>length</span>
                  <input value={sdN} inputMode="numeric" onChange={(e) => setSdN(int(e.target.value, 2))} className="no-ring mono" style={{ ...numStyle, width: 44 }} />
                </div>
              )}
            </div>
          )}

          {setShowVol && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
              <Box checked={showVol} onClick={() => setShowVol(!showVol)} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>Volume</span>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="tap disp"
          style={{ width: "100%", marginTop: 12, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 13, padding: 13, fontWeight: 800, fontSize: 13.5 }}
        >
          Done
        </button>
      </div>
    </div>
  );
  // Portal into the THEMED wrapper (.theme-light / .theme-dark), not <body>: the theme's CSS
  // variables (--surface, --ink, …) are defined on that element, so portalling to body stripped the
  // panel's background and left it transparent over the chart. The themed wrapper sits above the
  // transformed sheet/detail containers, so we still escape the transform that caused the grey.
  if (typeof document === "undefined") return sheet;
  const target = document.querySelector(".theme-light, .theme-dark") || document.body;
  return createPortal(sheet, target);
}

function Box({ checked, onClick }) {
  return (
    <button onClick={onClick} className="tap" style={{ border: "none", background: "transparent", padding: 0, flex: "0 0 auto" }}>
      <span style={{
        width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center",
        border: "1.5px solid " + (checked ? "var(--primary)" : "var(--line)"),
        background: checked ? "var(--primary)" : "transparent",
      }}>
        {checked && <Check size={12} color="var(--on-primary)" />}
      </span>
    </button>
  );
}
