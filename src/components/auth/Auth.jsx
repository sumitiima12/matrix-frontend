import React, { useState } from "react";
import { FNO } from "../../domain/universe";
import { fmt, profileSummary } from "../../lib/format";
import { Check, ChevronLeft, Clock, LogIn, LogOut, Sparkles, User } from "lucide-react";
import { apiLogin, apiRegister } from "../../domain/api";

/**
 * Auth & profile — login, onboarding and the profile sheet.
 */

export function LoginScreen({ onAuthed, onGuest }) {
  const [tab, setTab] = useState("login");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const field = { width: "100%", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", outline: "none" };
  const submit = async () => {
    if (mobile.length < 6 || pin.length < 4) { setErr("Enter your mobile number and a 4+ digit PIN."); return; }
    setErr(null); setBusy(true);
    const res = tab === "login" ? await apiLogin(mobile, pin) : await apiRegister(mobile, pin, name);
    setBusy(false);
    if (res && res.ok) onAuthed({ phone: res.userId, name: res.name || name || "" });
    else setErr((res && res.error) || "Something went wrong.");
  };
  return (
    <div className="mx" style={{ position: "fixed", inset: 0, zIndex: 100, background: "linear-gradient(165deg,#232327 0%,#161619 55%,#0C0C0E 100%)", display: "flex", flexDirection: "column", overflow: "auto" }}>
      <style>{`.lginput::placeholder{color:rgba(255,255,255,.55)}`}</style>
      <div style={{ position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.14),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(200,200,210,.12),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "30px", position: "relative", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 46, color: "#fff", letterSpacing: "-.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 38 }}>✦</span> Matrix
          </div>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: 600, letterSpacing: ".22em", marginTop: 6 }}>SMART TRADING</div>
        </div>

        <div style={{ display: "flex", background: "rgba(255,255,255,.1)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
          {[["login", "Log in"], ["signup", "Sign up"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setErr(null); }} className="tap disp" style={{ flex: 1, padding: 11, border: "none", borderRadius: 11, fontWeight: 800, fontSize: 13.5, background: tab === k ? "#fff" : "transparent", color: tab === k ? "#141416" : "rgba(255,255,255,.75)" }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "signup" && <input className="lginput" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" style={field} />}
          <input className="lginput mono" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} inputMode="numeric" placeholder="Mobile number" style={field} />
          <input className="lginput mono" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" type="password" placeholder="PIN (4+ digits)" style={field} />
        </div>
        {err && <div style={{ color: "#FFB3BE", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}

        <button onClick={submit} disabled={busy} className="tap disp" style={{ width: "100%", marginTop: 22, background: "#fff", color: "#141416", border: "none", borderRadius: 999, padding: 16, fontWeight: 800, fontSize: 15, letterSpacing: ".02em", opacity: busy ? 0.6 : 1 }}>{busy ? "PLEASE WAIT…" : tab === "login" ? "LOG IN" : "CREATE ACCOUNT"}</button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
          <span style={{ color: "rgba(255,255,255,.65)", fontSize: 11, fontWeight: 700 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
        </div>

        <button onClick={onGuest} className="tap disp glow" style={{ width: "100%", background: "rgba(255,255,255,.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,.5)", borderRadius: 999, padding: 15, fontWeight: 800, fontSize: 14.5, display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <User size={17} /> Continue as guest
        </button>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.6)", fontSize: 11.5, marginTop: 14 }}>Log in to save your trades, portfolio and automations across visits.</div>
      </div>

      <div style={{ textAlign: "center", color: "rgba(255,255,255,.55)", fontSize: 10.5, padding: "0 30px 26px", position: "relative" }}>Educational research, not investment advice.</div>
    </div>
  );
}

export function Onboarding({ onDone, onSkip, initial }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState(initial || { proficiency: "Beginner", risk: "Balanced", reward: "", style: "Technical", caps: [], sectors: [] });
  const steps = [
    { key: "proficiency", q: "How would you rate your investing skill?", opts: ["Beginner", "Intermediate", "Pro"], multi: false },
    { key: "risk", q: "Your risk appetite?", opts: ["Conservative", "Balanced", "Aggressive"], multi: false },
    { key: "style", q: "Your investing style?", opts: ["Technical", "Fundamental", "News / Event"], multi: false },
    { key: "caps", q: "Preferred market caps?", opts: ["Large", "Mid", "Small"], multi: true },
    { key: "sectors", q: "Any favourite sectors?", opts: ["IT", "Banking", "Auto", "Consumer Tech", "Energy", "Defence"], multi: true },
  ];
  const cur = steps[step];
  const toggle = (o) => {
    if (cur.multi) setP((s) => ({ ...s, [cur.key]: s[cur.key].includes(o) ? s[cur.key].filter((x) => x !== o) : [...s[cur.key], o] }));
    else setP((s) => ({ ...s, [cur.key]: o }));
  };
  const val = p[cur.key];
  const next = () => { if (step < steps.length - 1) setStep(step + 1); else onDone(p); };
  const back = () => { if (step > 0) setStep(step - 1); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--bg)", maxWidth: 460, margin: "0 auto", padding: 22, display: "flex", flexDirection: "column" }} className="mx">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 10, minHeight: 38 }}>
        {step > 0 && (
          <button onClick={back} className="tap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 38, height: 38, display: "grid", placeItems: "center", color: "var(--ink)" }}><ChevronLeft size={20} /></button>
        )}
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Step {step + 1} of {steps.length}</span>
      </div>
      <div style={{ display: "flex", gap: 5 }}>{steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? "var(--primary)" : "var(--line)" }} />)}</div>
      <div className="disp" style={{ fontWeight: 700, fontSize: 24, marginTop: 30, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--primary)" }}>✦</span> Matrix</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Let's personalise your edge.</div>
      <div className="disp" style={{ fontWeight: 700, fontSize: 19, marginTop: 30 }}>{cur.q}</div>
      <div style={{ marginTop: 16, flex: 1 }}>
        {cur.opts.map((o) => {
          const sel = cur.multi ? val.includes(o) : val === o;
          return <button key={o} onClick={() => toggle(o)} className="tap" style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "15px 16px", borderRadius: 16, border: "1.5px solid " + (sel ? "var(--primary)" : "var(--line)"), background: sel ? "var(--primary-soft)" : "var(--surface)", fontWeight: 600, fontSize: 14.5, display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ink)" }}>{o}{sel && <Check size={18} color="var(--primary)" />}</button>;
        })}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => (onSkip ? onSkip() : onDone(null))} className="tap" style={{ flex: "0 0 auto", padding: "15px 18px", borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, color: "var(--muted)" }}>Skip</button>
        <button onClick={next} className="tap disp glow" style={{ flex: 1, padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "#fff", fontWeight: 700, fontSize: 15 }}>{step < steps.length - 1 ? "Continue" : "Enter Matrix"}</button>
      </div>
    </div>
  );
}

/* ============================== PROFILE SHEET ============================== */

export function LoginModal({ onClose, onAuthed }) {
  const [tab, setTab] = useState("login");
  const [phone, setPhone] = useState(""); const [pin, setPin] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const submit = async () => {
    setErr(null); setBusy(true);
    const res = tab === "login" ? await apiLogin(phone, pin) : await apiRegister(phone, pin, name);
    setBusy(false);
    if (res && res.ok) onAuthed({ phone: res.userId, name: res.name || name || "" });
    else setErr((res && res.error) || "Something went wrong.");
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.4)", zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "24px 24px 0 0", padding: 22 }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 16px" }} />
        <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>{tab === "login" ? "Log in" : "Create account"}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Use your phone number and a PIN to save trades, automations and preferences across visits.</div>
        <div className="pill" style={{ display: "flex", background: "var(--bg)", padding: 4, marginTop: 16 }}>
          {["login", "register"].map((x) => (
            <button key={x} onClick={() => { setTab(x); setErr(null); }} className="pill tap disp" style={{ flex: 1, padding: 9, border: "none", fontWeight: 700, fontSize: 13, background: tab === x ? "var(--primary)" : "transparent", color: tab === x ? "var(--on-primary)" : "var(--muted)" }}>{x === "login" ? "Log in" : "Register"}</button>
          ))}
        </div>
        {tab === "register" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>Name (optional)</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="no-ring" style={inpStyle} placeholder="Your name" />
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>Phone number</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="no-ring mono" style={inpStyle} placeholder="9876543210" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>PIN (4+ digits)</div>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" type="password" className="no-ring mono" style={inpStyle} placeholder="••••" />
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--down)", marginTop: 10, fontWeight: 600 }}>{err}</div>}
        <button onClick={submit} disabled={busy} className="tap disp glow" style={{ width: "100%", marginTop: 16, background: "linear-gradient(120deg,var(--primary),var(--primary-2))", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: 14, fontWeight: 800, fontSize: 14.5, opacity: busy ? 0.6 : 1 }}>{busy ? "Please wait…" : tab === "login" ? "Log in" : "Create account"}</button>
        <button onClick={onClose} className="tap disp" style={{ width: "100%", marginTop: 10, background: "transparent", color: "var(--muted)", border: "none", fontWeight: 700, fontSize: 13 }}>Continue as guest</button>
      </div>
    </div>
  );
}
const inpStyle = { width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" };
// Human-readable summary of the personalisation answers.

export default function ProfileSheet({ profile, walletMap = {}, onClose, onTradeHistory, auth, onLogin, onLogout, onPersonalise }) {
  const WMKTS = [["IN", "🇮🇳 Indian stocks"], ["US", "🇺🇸 US stocks"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]];
  const summary = profileSummary(profile);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.4)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "24px 24px 0 0", padding: 20, height: "92vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,var(--primary),var(--primary-2))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 20 }} className="disp">M</div>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>{auth && auth.name ? auth.name : "My Profile"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{auth ? `Logged in · ${auth.phone}` : "Guest session"}</div>
          </div>
        </div>

        {/* wallets — every market */}
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "18px 2px 8px" }}>VIRTUAL WALLETS</div>
        <div className="card" style={{ padding: "4px 14px", background: "var(--bg)" }}>
          {WMKTS.map(([k, l], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < WMKTS.length - 1 ? "1px solid var(--line)" : "none" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
              <span className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{fmt(walletMap[k] ?? 0, k)}</span>
            </div>
          ))}
        </div>

        <button onClick={() => { onClose && onClose(); onTradeHistory && onTradeHistory(); }} className="tap disp" style={{ width: "100%", marginTop: 14, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 13.5, display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}><Clock size={16} /> Trade history</button>

        {/* personalisation summary */}
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "20px 2px 8px" }}>YOUR INVESTOR PROFILE</div>
        <div className="card metal" style={{ padding: 14, background: "var(--feature-grad)", color: "#fff" }}>
          {summary ? (
            <div style={{ fontSize: 13, lineHeight: 1.6, fontWeight: 600 }}>{summary}</div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6, opacity: .9 }}>You haven't personalised Matrix yet. Answer a few quick questions and your picks, ideas and screens will be tuned to how you invest.</div>
          )}
        </div>
        {profile && (
          <div style={{ marginTop: 10 }}>
            {[["Skill", profile.proficiency], ["Risk", profile.risk], ["Style", profile.style], ["Caps", (profile.caps || []).join(", ") || "All"], ["Sectors", (profile.sectors || []).join(", ") || "All"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 2px", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span style={{ color: "var(--muted)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right", maxWidth: "62%" }}>{v}</span></div>
            ))}
          </div>
        )}

        {/* personalize */}
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "20px 2px 8px" }}>PERSONALIZE</div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>Changed how you invest? Retake the quick questions and Matrix will re-tune your picks, ideas and screens.</div>
          <button onClick={() => { onClose && onClose(); onPersonalise && onPersonalise(); }} className="tap disp" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 13, display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}><Sparkles size={15} /> {profile ? "Update my answers" : "Personalise Matrix"}</button>
        </div>

        {auth ? (
          <button onClick={() => { onClose && onClose(); onLogout && onLogout(); }} className="tap disp" style={{ width: "100%", margin: "16px 0 8px", background: "var(--surface)", color: "var(--down)", border: "1px solid var(--line)", borderRadius: 14, padding: 12, fontWeight: 800, fontSize: 13.5, display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}><LogOut size={16} /> Log out</button>
        ) : (
          <button onClick={() => { onClose && onClose(); onLogin && onLogin(); }} className="tap disp" style={{ width: "100%", margin: "16px 0 8px", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14, padding: 12, fontWeight: 800, fontSize: 13.5, display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}><LogIn size={16} /> Log in / Register</button>
        )}
      </div>
    </div>
  );
}
/* ---- Trade history (filters hoisted OUT so dropdowns don't remount) ---- */
/* ---- Multi-select filter: renders as a bottom sheet so it can never be
       clipped by a scrolling row (the old absolute dropdown was). ---- */

/* ============================== ROOT ============================== */
