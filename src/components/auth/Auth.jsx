import React, { useState } from "react";
import { } from "../../domain/universe";
import { fmt, profileSummary } from "../../lib/format";
import { Check, ChevronLeft, Clock, Copy, LogIn, LogOut, Sparkles, User } from "lucide-react";
import { apiLogin, apiRegister, apiForgotQuestion, apiForgotReset, apiGetSecurityQuestion, apiSetSecurityQuestion, apiSetUsername, apiSetEmail } from "../../domain/api";
import EquityCurve from "../common/EquityCurve";
import headerLogo from "../../assets/brand/header-logo.png";
import headerLogoDark from "../../assets/brand/header-logo-dark.png";
import splashLockup from "../../assets/brand/splash-m.png";
import Wordmark from "../common/Wordmark";
import { brokerById } from "../../domain/brokers";

/**
 * Auth & profile — login, onboarding and the profile sheet.
 */

/**
 * SetUsernameModal — blocking screen that mandates a unique user ID. Shown after login for
 * any account that doesn't have one yet (accounts created before user IDs existed).
 */
export function SetUsernameModal({ onDone }) {
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const valid = /^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(uid);
  const field = { width: "100%", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", outline: "none" };
  const save = async () => {
    if (!valid) { setErr("3–20 characters, starting with a letter (letters, numbers, underscore)."); return; }
    setErr(null); setBusy(true);
    try {
      const res = await apiSetUsername(uid);
      if (res && res.ok) { onDone(res.username || uid); return; }
      setErr((res && res.error) || "Couldn't save that user ID — please try again.");
    } catch { setErr("Network error — please try again."); }
    setBusy(false);
  };
  return (
    <div className="mx" style={{ position: "fixed", inset: 0, zIndex: 120, background: "linear-gradient(165deg,#232327 0%,#161619 55%,#0C0C0E 100%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <style>{`.lginput::placeholder{color:rgba(255,255,255,.55)}`}</style>
      <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
        <div className="disp" style={{ fontWeight: 800, fontSize: 22, color: "#fff" }}>Choose your user ID</div>
        <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>Pick a unique handle — it's how you appear on shared strategies and it's your referral code. You can't skip this.</div>
        <input className="lginput mono" value={uid} onChange={(e) => setUid(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))} placeholder="e.g. sumit_trader" style={{ ...field, marginTop: 18, borderColor: uid ? (valid ? "rgba(52,224,125,.7)" : "rgba(255,120,120,.6)") : field.border }} />
        {err && <div style={{ color: "#FFB3BE", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{err}</div>}
        <button onClick={save} disabled={busy || !valid} className="tap disp glow" style={{ width: "100%", marginTop: 16, padding: 15, borderRadius: 16, border: "none", background: valid ? "linear-gradient(120deg,#fff,#d8d8de)" : "rgba(255,255,255,.2)", color: valid ? "#141416" : "rgba(255,255,255,.6)", fontWeight: 800, fontSize: 15, cursor: valid ? "pointer" : "not-allowed" }}>{busy ? "Saving…" : "Save user ID"}</button>
      </div>
    </div>
  );
}

export function LoginScreen({ onAuthed, onGuest }) {
  /* ONE screen for Login and Sign-up. The user enters their number + PIN and taps
     "Login / Sign up":
       - existing account, correct PIN  -> logged straight in
       - existing account, wrong PIN    -> inline error
       - no account for that number     -> switches to the "looks like you're new" step,
                                           which asks for a user ID and an optional email,
                                           then signs them up and drops them on the homepage. */
  const [stage, setStage] = useState("auth");   // "auth" | "newuser"
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [referral, setReferral] = useState(() => { try { return new URLSearchParams(window.location.search).get("ref") || ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const validId = /^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(userId);
  const emailOk = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const field = { width: "100%", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", outline: "none" };

  const finish = (res, fresh = false) => onAuthed({ phone: res.userId, name: res.name || "", username: res.username || null, email: res.email || null, createdAt: res.createdAt || null }, { fresh });

  // Step 1 — number + PIN. Decide login vs sign-up from the server's answer.
  const submitAuth = async () => {
    if (mobile.length < 6 || pin.length < 4) { setErr("Enter your mobile number and a 4+ digit PIN."); return; }
    setErr(null); setBusy(true);
    const res = await apiLogin(mobile, pin);
    setBusy(false);
    if (res && res.ok) { finish(res); return; }               // existing user -> straight in
    if (res && res.newAccount) { setErr(null); setStage("newuser"); return; }  // new -> sign-up step
    setErr((res && res.error) || "Wrong PIN for this number.");
  };

  // Step 2 — a brand-new user picks a handle (+ optional email), then we register them.
  const submitSignup = async () => {
    if (!validId) { setErr("Choose a user ID: 3–20 characters, starting with a letter."); return; }
    if (!emailOk) { setErr("Enter a valid email, or leave it blank."); return; }
    setErr(null); setBusy(true);
    const res = await apiRegister(mobile, pin, "", "", "", userId, referral, email);
    setBusy(false);
    if (res && res.ok) { finish(res, true); return; }          // signed up -> homepage (skip onboarding)
    setErr((res && res.error) || "Couldn't create your account.");
  };

  return (
    <div className="mx" style={{ position: "fixed", inset: 0, zIndex: 100, background: "linear-gradient(165deg,#232327 0%,#161619 55%,#0C0C0E 100%)", display: "flex", flexDirection: "column", overflow: "auto" }}>
      <style>{`.lginput::placeholder{color:rgba(255,255,255,.55)}`}</style>
      <div style={{ position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.14),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(200,200,210,.12),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "30px", position: "relative", maxWidth: 460, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <Wordmark height={52} color="#fff" />
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: 600, letterSpacing: ".22em", marginTop: 10 }}>SMART TRADING</div>
        </div>

        {stage === "auth" ? (
          <>
            <div className="disp" style={{ color: "#fff", fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Login / Sign up</div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, textAlign: "center", marginBottom: 20 }}>Enter your number and PIN — we'll log you in, or set you up if you're new.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input className="lginput mono" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} inputMode="numeric" placeholder="Mobile number" style={field} />
              <input className="lginput mono" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && submitAuth()} inputMode="numeric" type="password" placeholder="PIN (4+ digits)" style={field} />
            </div>
            {err && <div style={{ color: "#FFB3BE", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}

            <button onClick={submitAuth} disabled={busy} className="tap disp" style={{ width: "100%", marginTop: 22, background: "#fff", color: "#141416", border: "none", borderRadius: 999, padding: 16, fontWeight: 800, fontSize: 15, letterSpacing: ".02em", opacity: busy ? 0.6 : 1 }}>{busy ? "PLEASE WAIT…" : "LOGIN / SIGN UP"}</button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
              <span style={{ color: "rgba(255,255,255,.65)", fontSize: 11, fontWeight: 700 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
            </div>

            {/* Guest is a quiet text link, not a button. */}
            <div style={{ textAlign: "center" }}>
              <span onClick={onGuest} className="tap" style={{ color: "rgba(255,255,255,.85)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Continue as guest</span>
            </div>
          </>
        ) : (
          <>
            <div className="disp" style={{ color: "#fff", fontSize: 19, fontWeight: 800, textAlign: "center" }}>Looks like you're new! 👋</div>
            <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, textAlign: "center", marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>Pick a user ID to finish setting up your account. Your number <b style={{ color: "#fff" }}>{mobile}</b> and PIN are ready.</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <input className="lginput mono" value={userId} onChange={(e) => setUserId(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))} placeholder="Choose a user ID (unique)" style={{ ...field, borderColor: userId ? (validId ? "rgba(52,224,125,.7)" : "rgba(255,120,120,.6)") : field.border }} />
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", marginTop: 5, paddingLeft: 4 }}>3–20 characters, starts with a letter. This is your public handle & referral code.</div>
              </div>
              <input className="lginput" value={email} onChange={(e) => setEmail(e.target.value.trim())} type="email" inputMode="email" placeholder="Email (optional)" style={{ ...field, borderColor: email ? (emailOk ? "rgba(52,224,125,.7)" : "rgba(255,120,120,.6)") : field.border }} />
              <input className="lginput mono" value={referral} onChange={(e) => setReferral(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))} placeholder="Referral code (optional)" style={field} />
            </div>
            {err && <div style={{ color: "#FFB3BE", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}

            <button onClick={submitSignup} disabled={busy || !validId} className="tap disp" style={{ width: "100%", marginTop: 22, background: validId ? "#fff" : "rgba(255,255,255,.3)", color: "#141416", border: "none", borderRadius: 999, padding: 16, fontWeight: 800, fontSize: 15, letterSpacing: ".02em", opacity: busy ? 0.6 : 1 }}>{busy ? "PLEASE WAIT…" : "SIGN UP"}</button>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span onClick={() => { setStage("auth"); setErr(null); }} className="tap" style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>← Use a different number</span>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", color: "rgba(255,255,255,.55)", fontSize: 10.5, padding: "0 30px 26px", position: "relative" }}>Educational research, not investment advice.</div>
    </div>
  );
}

export function Onboarding({ onDone, onSkip, initial, theme }) {
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
      <div style={{ marginTop: 30 }}><Wordmark height={44} /></div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Let's personalise your edge.</div>
      <div className="disp" style={{ fontWeight: 700, fontSize: 19, marginTop: 30 }}>{cur.q}</div>
      {cur.multi && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Select all that apply.</div>}
      <div style={{ marginTop: 16, flex: 1 }}>
        {cur.opts.map((o) => {
          const sel = cur.multi ? val.includes(o) : val === o;
          /* Multi-select questions get real CHECKBOXES on the left (a square that fills
             with a tick), so it's clear more than one answer is allowed. Single-select
             questions keep the tick-on-the-right radio style. */
          if (cur.multi) {
            return (
              <button key={o} onClick={() => toggle(o)} className="tap" style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "15px 16px", borderRadius: 16, border: "1.5px solid " + (sel ? "var(--primary)" : "var(--line)"), background: sel ? "var(--primary-soft)" : "var(--surface)", fontWeight: 600, fontSize: 14.5, display: "flex", gap: 12, alignItems: "center", color: "var(--ink)" }}>
                <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 6, border: "2px solid " + (sel ? "var(--primary)" : "var(--line)"), background: sel ? "var(--primary)" : "transparent", display: "grid", placeItems: "center" }}>
                  {sel && <Check size={15} color="#fff" strokeWidth={3} />}
                </span>
                {o}
              </button>
            );
          }
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
  const [secQ, setSecQ] = useState(""); const [secA, setSecA] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);

  // Forgot-PIN sub-flow state.
  const [mode, setMode] = useState("auth");   // "auth" | "forgot"
  const [fStep, setFStep] = useState(1);        // 1: enter phone -> 2: answer + new pin
  const [fQuestion, setFQuestion] = useState(""); const [fAnswer, setFAnswer] = useState(""); const [fNewPin, setFNewPin] = useState("");

  const submit = async () => {
    setErr(null); setBusy(true);
    let res;
    if (tab === "login") res = await apiLogin(phone, pin);
    else res = await apiRegister(phone, pin, name, secQ, secA);
    setBusy(false);
    if (res && res.ok) onAuthed({ phone: res.userId, name: res.name || name || "" });
    else setErr((res && res.error) || "Something went wrong.");
  };

  const forgotLookup = async () => {
    setErr(null); setBusy(true);
    const res = await apiForgotQuestion(phone);
    setBusy(false);
    if (res && res.ok && res.question) { setFQuestion(res.question); setFStep(2); }
    else setErr((res && res.message) || (res && res.error) || "No security question is set for this number.");
  };
  const forgotSubmit = async () => {
    setErr(null); setBusy(true);
    const res = await apiForgotReset(phone, fAnswer, fNewPin);
    setBusy(false);
    if (res && res.ok) onAuthed({ phone: res.userId, name: res.name || "" });
    else setErr((res && res.error) || "That answer doesn't match.");
  };

  const label = (t) => <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4, marginTop: 12 }}>{t}</div>;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "22px 22px 0 0", padding: "18px 18px 26px" }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 14px" }} />

        {mode === "auth" ? (
          <>
            <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>{tab === "login" ? "Log in" : "Create account"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Use your phone number and a PIN to save trades, automations and preferences across visits.</div>
            <div className="pill" style={{ display: "flex", background: "var(--bg)", padding: 4, marginTop: 14, borderRadius: 12 }}>
              {["login", "register"].map((x) => (
                <button key={x} onClick={() => { setTab(x); setErr(null); }} className="pill tap disp" style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", background: tab === x ? "var(--primary)" : "transparent", color: tab === x ? "#fff" : "var(--muted)" }}>{x === "login" ? "Log in" : "Register"}</button>
              ))}
            </div>

            {tab === "register" && (<>
              {label("Name")}
              <input value={name} onChange={(e) => setName(e.target.value)} className="no-ring" style={inpStyle} placeholder="Your name" />
            </>)}

            {label("Phone number")}
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="no-ring" style={inpStyle} placeholder="10-digit mobile" />

            {label("PIN (4+ digits)")}
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" type="password" className="no-ring" style={inpStyle} placeholder="••••" />

            {tab === "register" && (<>
              {label("Security question (you'll answer this to recover your PIN)")}
              <input value={secQ} onChange={(e) => setSecQ(e.target.value)} className="no-ring" style={inpStyle} placeholder="e.g. Name of my first pet?" />
              {label("Answer")}
              <input value={secA} onChange={(e) => setSecA(e.target.value)} className="no-ring" style={inpStyle} placeholder="Your answer" />
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>Pick something only you know and won't forget. It's stored securely (hashed) and is the only way to reset your PIN yourself.</div>
            </>)}

            {err && <div style={{ fontSize: 12, color: "var(--down)", marginTop: 12, fontWeight: 600 }}>{err}</div>}
            <button onClick={submit} disabled={busy} className="tap disp glow" style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Please wait…" : tab === "login" ? "Log in" : "Create account"}</button>

            {tab === "login" && (
              <button onClick={() => { setMode("forgot"); setFStep(1); setErr(null); }} className="tap disp" style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Forgot PIN?</button>
            )}
            <button onClick={onClose} className="tap disp" style={{ width: "100%", marginTop: 8, background: "none", border: "none", color: "var(--muted)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </>
        ) : (
          /* FORGOT-PIN FLOW */
          <>
            <div className="disp" style={{ fontWeight: 700, fontSize: 19 }}>Reset your PIN</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Answer your security question to set a new PIN.</div>

            {fStep === 1 ? (<>
              {label("Phone number")}
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="no-ring" style={inpStyle} placeholder="10-digit mobile" />
              {err && <div style={{ fontSize: 12, color: "var(--down)", marginTop: 12, fontWeight: 600 }}>{err}</div>}
              <button onClick={forgotLookup} disabled={busy} className="tap disp glow" style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Please wait…" : "Continue"}</button>
            </>) : (<>
              <div style={{ marginTop: 14, padding: 12, background: "var(--bg)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{fQuestion}</div>
              {label("Your answer")}
              <input value={fAnswer} onChange={(e) => setFAnswer(e.target.value)} className="no-ring" style={inpStyle} placeholder="Answer" />
              {label("New PIN (4+ digits)")}
              <input value={fNewPin} onChange={(e) => setFNewPin(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" type="password" className="no-ring" style={inpStyle} placeholder="••••" />
              {err && <div style={{ fontSize: 12, color: "var(--down)", marginTop: 12, fontWeight: 600 }}>{err}</div>}
              <button onClick={forgotSubmit} disabled={busy} className="tap disp glow" style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Please wait…" : "Reset PIN & log in"}</button>
            </>)}

            <button onClick={() => { setMode("auth"); setErr(null); }} className="tap disp" style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--muted)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>← Back to log in</button>
          </>
        )}
      </div>
    </div>
  );
}
const inpStyle = { width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700, background: "var(--elev)", color: "var(--ink)" };
// Human-readable summary of the personalisation answers.

/* Set/change your security question (recovery). Logged-in only; the backend derives the
   account from the auth token, so a user can only set their own. */
function SecurityQuestionCard() {
  const [open, setOpen] = React.useState(false);
  const [existing, setExisting] = React.useState(null);   // { hasQuestion, question }
  const [q, setQ] = React.useState(""); const [ans, setAns] = React.useState("");
  const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState(null);

  const load = async () => {
    const r = await apiGetSecurityQuestion();
    if (r && r.ok) { setExisting(r); if (r.question) setQ(r.question); }
  };
  React.useEffect(() => { load(); }, []);

  const save = async () => {
    if (!q.trim() || !ans.trim()) { setMsg({ e: true, t: "Enter a question and an answer." }); return; }
    setBusy(true); setMsg(null);
    const r = await apiSetSecurityQuestion(q.trim(), ans.trim());
    setBusy(false);
    if (r && r.ok) { setMsg({ e: false, t: "Saved. You can use this to recover your PIN." }); setAns(""); setExisting({ hasQuestion: true, question: q.trim() }); setTimeout(() => setOpen(false), 1200); }
    else setMsg({ e: true, t: (r && r.error) || "Couldn't save." });
  };

  const inp = { width: "100%", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", fontSize: 14, fontWeight: 600, background: "var(--elev)", color: "var(--ink)", marginTop: 8 };

  return (
    <div className="card" style={{ padding: 0, marginBottom: 9, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} className="tap" style={{ width: "100%", textAlign: "left", padding: "13px 15px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Security question {existing && existing.hasQuestion ? "(set)" : "(not set)"}</span>
        <span style={{ color: "var(--muted)" }}>{open ? "\u2013" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 15px 15px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 4 }}>
            {existing && existing.hasQuestion ? "Update your recovery question and answer." : "Set a question only you can answer, so you can reset your PIN if you forget it."}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. First pet's name?" style={inp} />
          <input value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Answer" style={inp} />
          {msg && <div style={{ fontSize: 11.5, color: msg.e ? "var(--down)" : "var(--up)", marginTop: 8, fontWeight: 600 }}>{msg.t}</div>}
          <button onClick={save} disabled={busy} className="tap disp glow" style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Saving\u2026" : "Save security question"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfileSheet({ profile, walletMap = {}, onClose, onTradeHistory, auth, onLogin, onLogout, onPersonalise, onAdmin, isAdminUser = false, adminMode = false, onToggleAdminMode, portfolio = [], trades = [], deposits = [], market = "IN", onBroker, brokerName, onUsernameChanged, onEmailChanged, marketBrokers = {}, houseFeeds = {}, onDisconnectBroker }) {
  const [uidEdit, setUidEdit] = useState(false);
  const [uidVal, setUidVal] = useState("");
  const [uidBusy, setUidBusy] = useState(false);
  const [uidErr, setUidErr] = useState(null);
  // Optional contact email.
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailVal, setEmailVal] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState(null);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
  const saveEmail = async () => {
    if (!emailValid) { setEmailErr("Enter a valid email address."); return; }
    setEmailErr(null); setEmailBusy(true);
    try {
      const r = await apiSetEmail(emailVal.trim());
      if (r && r.ok) { onEmailChanged && onEmailChanged(r.email || emailVal.trim()); setEmailEdit(false); }
      else setEmailErr((r && r.error) || "Couldn't save email.");
    } catch { setEmailErr("Network error."); }
    setEmailBusy(false);
  };
  const uidValid = /^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(uidVal);
  const saveUid = async () => {
    if (!uidValid) { setUidErr("3–20 chars, starts with a letter."); return; }
    setUidErr(null); setUidBusy(true);
    try {
      const r = await apiSetUsername(uidVal);
      if (r && r.ok) { onUsernameChanged && onUsernameChanged(r.username || uidVal); setUidEdit(false); }
      else setUidErr((r && r.error) || "Couldn't update.");
    } catch { setUidErr("Network error."); }
    setUidBusy(false);
  };
  const WMKTS = [["IN", "🇮🇳 Indian stocks"], ["US", "🇺🇸 US stocks"], ["Crypto", "₿ Crypto"], ["FNO", "⚡ F&O"], ["Commodity", "🪙 Commodity"]];
  const summary = profileSummary(profile);

  /* The curve is drawn for ONE market at a time, in that market's own currency.
     ₹ and $ cannot be added together without an exchange rate for every day in the
     series, and we do not have one — a blended "net worth" line would be invented. */
  const [curveMkt, setCurveMkt] = useState(market || "IN");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,.4)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet card" style={{ width: "100%", maxWidth: 460, borderRadius: "24px 24px 0 0", padding: 20, height: "80vh", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 9, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,var(--primary),var(--primary-2))", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 20 }} className="disp">{((auth && (auth.name || auth.username)) || "?").charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontWeight: 700, fontSize: 17 }}>{auth && (auth.name || auth.username) ? (auth.name || auth.username) : "My Profile"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{auth ? `Logged in · ${auth.phone}` : "Guest session"}</div>
          </div>
        </div>

        {/* BROKER — where the prices come from */}
        {onBroker && (
          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>Broker connections</div>
              <button onClick={() => onBroker()} className="tap disp" style={{ border: "1px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)", borderRadius: 10, padding: "6px 11px", fontWeight: 800, fontSize: 11.5 }}>Manage</button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>A different broker per market. Prices are live via the built-in feed where shown.</div>
            {[["IN", "🇮🇳 Indian"], ["US", "🇺🇸 US"], ["Crypto", "₿ Crypto"], ["Commodity", "🪙 Commodity"]].map(([m, label]) => {
              const personal = brokerById(marketBrokers && marketBrokers[m]);   // a broker YOU connected
              const feedName = m === "IN" && houseFeeds.fyers ? "FYERS" : m === "Crypto" && houseFeeds.delta ? "Delta" : null;   // built-in price feed
              return (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
                    {!personal && feedName && (
                      <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700, marginTop: 1 }}>Prices live via {feedName} feed</div>
                    )}
                  </div>
                  {personal ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--up)", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 6, background: "var(--up)" }} /> {personal.name}
                      </span>
                      <button onClick={() => onBroker(m)} className="tap disp" style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 9, padding: "5px 9px", fontWeight: 800, fontSize: 10.5, cursor: "pointer" }}>Change</button>
                      <button onClick={() => onDisconnectBroker && onDisconnectBroker(personal.id)} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--down)", borderRadius: 9, padding: "5px 9px", fontWeight: 800, fontSize: 10.5, cursor: "pointer" }}>Disconnect</button>
                    </div>
                  ) : (
                    <button onClick={() => onBroker(m)} className="tap disp" style={{ border: "none", background: "var(--ink)", color: "var(--surface)", borderRadius: 9, padding: "6px 14px", fontWeight: 800, fontSize: 11.5, cursor: "pointer", flex: "0 0 auto" }}>Connect Broker</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TOTAL VALUE OVER TIME — cash + holdings, rebuilt from real closing prices */}
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, margin: "18px 2px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>PORTFOLIO VALUE</span>
          <select
            value={curveMkt}
            onChange={(e) => setCurveMkt(e.target.value)}
            aria-label="Market for the portfolio value chart"
            style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 11, fontWeight: 800, padding: "4px 6px" }}
          >
            {WMKTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <EquityCurve market={curveMkt} portfolio={portfolio} trades={trades} deposits={deposits} wallet={walletMap[curveMkt] ?? 0} />

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

        {auth && (
          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>USER ID</div>
                <div className="disp mono" style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{auth.username || "—"}</div>
              </div>
              {!uidEdit && <button onClick={() => { setUidVal(auth.username || ""); setUidEdit(true); setUidErr(null); }} className="tap disp" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12 }}>Change</button>}
            </div>
            {uidEdit && (
              <div style={{ marginTop: 10 }}>
                <input value={uidVal} onChange={(e) => setUidVal(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))} placeholder="new user ID" className="no-ring mono" style={{ width: "100%", border: "1px solid " + (uidVal ? (uidValid ? "var(--up)" : "var(--down)") : "var(--line)"), borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "var(--elev)", color: "var(--ink)" }} />
                {uidErr && <div style={{ color: "var(--down)", fontSize: 11.5, fontWeight: 600, marginTop: 6 }}>{uidErr}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => setUidEdit(false)} className="tap disp" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: 10, fontWeight: 800, fontSize: 12.5 }}>Cancel</button>
                  <button onClick={saveUid} disabled={uidBusy || !uidValid} className="tap disp" style={{ flex: 1, border: "none", background: uidValid ? "var(--primary)" : "var(--elev)", color: uidValid ? "var(--on-primary)" : "var(--muted)", borderRadius: 10, padding: 10, fontWeight: 800, fontSize: 12.5 }}>{uidBusy ? "Saving…" : "Save"}</button>
                </div>
              </div>
            )}

            {/* EMAIL — optional contact address the user can add or change. */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>EMAIL</div>
                <div className="disp" style={{ fontWeight: 700, fontSize: 13.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.email || <span style={{ color: "var(--muted)", fontWeight: 600 }}>Not added</span>}</div>
              </div>
              {!emailEdit && <button onClick={() => { setEmailVal(auth.email || ""); setEmailEdit(true); setEmailErr(null); }} className="tap disp" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12 }}>{auth.email ? "Change" : "Add email"}</button>}
            </div>
            {emailEdit && (
              <div style={{ marginTop: 10 }}>
                <input value={emailVal} onChange={(e) => setEmailVal(e.target.value.trim())} placeholder="you@example.com" type="email" inputMode="email" className="no-ring" style={{ width: "100%", border: "1px solid " + (emailVal ? (emailValid ? "var(--up)" : "var(--down)") : "var(--line)"), borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "var(--elev)", color: "var(--ink)" }} />
                {emailErr && <div style={{ color: "var(--down)", fontSize: 11.5, fontWeight: 600, marginTop: 6 }}>{emailErr}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => setEmailEdit(false)} className="tap disp" style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 10, padding: 10, fontWeight: 800, fontSize: 12.5 }}>Cancel</button>
                  <button onClick={saveEmail} disabled={emailBusy || !emailValid} className="tap disp" style={{ flex: 1, border: "none", background: emailValid ? "var(--primary)" : "var(--elev)", color: emailValid ? "var(--on-primary)" : "var(--muted)", borderRadius: 10, padding: 10, fontWeight: 800, fontSize: 12.5 }}>{emailBusy ? "Saving…" : "Save"}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {auth && auth.username && (() => {
          const link = `${(typeof window !== "undefined" && window.location ? window.location.origin : "https://matrixone.app")}/?ref=${auth.username}`;
          return (
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="var(--primary)" /> Your referral link</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>Share this — anyone who signs up through it is credited to you.</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input readOnly value={link} onFocus={(e) => e.target.select()} className="no-ring mono" style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 11, padding: "9px 11px", fontSize: 11.5, background: "var(--elev)", color: "var(--ink)" }} />
                <button onClick={() => { try { navigator.clipboard.writeText(link); } catch {} }} className="tap disp" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: 11, padding: "9px 12px", fontWeight: 800, fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}><Copy size={13} /> Copy</button>
              </div>
            </div>
          );
        })()}

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

        {auth && <SecurityQuestionCard />}

        {/* ADMIN — only for admin accounts. Default is USER mode (normal experience);
            the toggle flips into admin mode, which reveals the console + edit/delete controls. */}
        {auth && isAdminUser && (
          <div className="card" style={{ padding: 14, marginBottom: 9, border: "1px solid " + (adminMode ? "var(--primary)" : "var(--line)") }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="disp" style={{ fontWeight: 800, fontSize: 13.5 }}>{adminMode ? "Admin mode" : "User mode"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{adminMode ? "You see the console and edit/delete controls." : "You're using the normal member experience."}</div>
              </div>
              <button
                onClick={() => onToggleAdminMode && onToggleAdminMode()}
                aria-label="Toggle admin mode"
                className="tap"
                style={{ flex: "0 0 auto", width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: adminMode ? "var(--primary)" : "var(--line)", transition: "background .15s" }}
              >
                <span style={{ position: "absolute", top: 3, left: adminMode ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
              </button>
            </div>
          </div>
        )}
        {auth && onAdmin && (
          <button onClick={() => { onAdmin(); }} className="tap card" style={{ width: "100%", textAlign: "left", padding: "13px 15px", marginBottom: 9, border: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            Admin console
          </button>
        )}
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
