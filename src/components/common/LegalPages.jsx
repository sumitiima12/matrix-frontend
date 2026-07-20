import React, { useState } from "react";

/**
 * Legal + informational content for MatrixOne. All content is written for a personal,
 * non-commercial research project operating in India. It is NOT legal advice; the operator
 * should have it reviewed by a qualified professional before any wider use.
 *
 * Exposes: <Footer/> (links + copyright), and <LegalOverlay/> (renders the selected page).
 */

const CONTACT_EMAIL = "brandbucksconsulting@gmail.com";

/* ----------------------------- shared styles ----------------------------- */
const overlayWrap = { position: "fixed", inset: 0, background: "var(--bg)", zIndex: 3200, overflowY: "auto" };
const inner = { maxWidth: 640, margin: "0 auto", padding: "20px 20px 60px" };
const h1 = { fontSize: 22, fontWeight: 800, marginBottom: 4 };
const h2 = { fontSize: 15, fontWeight: 800, marginTop: 22, marginBottom: 6 };
const p = { fontSize: 13, lineHeight: 1.7, color: "var(--ink-soft, var(--ink))", marginBottom: 10 };
const muted = { fontSize: 11, color: "var(--muted)" };

function Page({ title, children, onClose }) {
  return (
    <div style={overlayWrap}>
      <div style={{ ...inner }}>
        <button onClick={onClose} className="tap disp" style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", borderRadius: 10, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginBottom: 16 }}>← Back</button>
        <h1 className="disp" style={h1}>{title}</h1>
        <div style={muted}>Last updated: July 2026</div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------- DISCLAIMER ------------------------------ */
export function Disclaimer({ onClose }) {
  return (
    <Page title="Disclaimer" onClose={onClose}>
      <p style={p}>
        MatrixOne is a personal, non-commercial project built for learning and research purposes only.
        It is not a registered investment adviser, research analyst, stock broker, or financial services
        provider, and it is not affiliated with any such entity.
      </p>
      <p style={p}>
        Nothing on MatrixOne constitutes investment advice, a research report, or a recommendation,
        solicitation, or offer to buy or sell any security or financial instrument. We do not advise on,
        recommend, or endorse any trade, strategy, or instrument. Any signals, scores, "picks", analysis,
        or AI-generated commentary are illustrative and educational, are derived from publicly available
        market data, may be delayed or inaccurate, and must not be relied upon for any financial decision.
      </p>
      <p style={p}>
        All trading and investment decisions are yours alone and are made at your own risk. Trading in
        securities and derivatives involves substantial risk of loss and is not suitable for every person.
        Past performance is not indicative of future results. Please consult a SEBI-registered investment
        adviser or research analyst and read all scheme/offer documents before investing.
      </p>
      <p style={p}>
        Any live-market or broker features are provided on a best-effort basis with no guarantee of
        accuracy, availability, or execution. The operator accepts no liability for any loss or damage
        arising from use of the app.
      </p>
      <p style={muted}>For any queries, contact {CONTACT_EMAIL}.</p>
    </Page>
  );
}

/* ------------------------------- TERMS OF USE ----------------------------- */
export function Terms({ onClose }) {
  return (
    <Page title="Terms of Use" onClose={onClose}>
      <p style={p}>
        These Terms of Use ("Terms") govern your access to and use of MatrixOne (the "App"), a personal,
        non-commercial research project. By using the App, you agree to these Terms. If you do not agree,
        please do not use the App.
      </p>

      <h2 style={h2}>1. Nature of the service</h2>
      <p style={p}>
        MatrixOne is provided for educational and research purposes only. It is not a commercial product
        and is not intended to facilitate, advise on, or execute real financial transactions on your behalf
        except where you explicitly connect your own broker account, at your own risk. The App does not
        provide investment advice and is not a substitute for a SEBI-registered adviser.
      </p>

      <h2 style={h2}>2. Eligibility</h2>
      <p style={p}>
        You must be at least 18 years old and legally capable of entering into a binding agreement under
        the Indian Contract Act, 1872. You are responsible for complying with all laws applicable to you.
      </p>

      <h2 style={h2}>3. No investment advice</h2>
      <p style={p}>
        Content in the App — including signals, scores, screeners, "picks", back-tests, and AI-generated
        text — is general information derived from public data. It is not personalised advice, not a
        research report under the SEBI (Research Analysts) Regulations, 2014, and not a recommendation. You
        are solely responsible for your decisions and their consequences.
      </p>

      <h2 style={h2}>4. Accounts and security</h2>
      <p style={p}>
        You are responsible for keeping your login PIN and any connected broker credentials secure. You
        must not share your account or use another person's account. We may suspend or terminate access if
        we reasonably believe the App is being misused.
      </p>

      <h2 style={h2}>5. Broker connections</h2>
      <p style={p}>
        If you connect a third-party broker, you authorise the App to interact with that broker's API using
        credentials you provide, solely to display data and, where you explicitly confirm, place orders.
        Your relationship with your broker is governed by the broker's own terms. We are not responsible
        for broker downtime, rejected orders, execution quality, or any resulting loss.
      </p>

      <h2 style={h2}>6. Acceptable use</h2>
      <p style={p}>
        You agree not to misuse the App, including by attempting to gain unauthorised access, disrupting
        the service, scraping at scale, reverse-engineering, or using it for any unlawful purpose or market
        manipulation.
      </p>

      <h2 style={h2}>7. Intellectual property</h2>
      <p style={p}>
        The App's design, code, and original content are the property of the operator. Market data and
        third-party content belong to their respective owners. "The Matrix" and related names are used only
        as a personal creative theme and imply no affiliation or endorsement.
      </p>

      <h2 style={h2}>8. Disclaimer of warranties &amp; limitation of liability</h2>
      <p style={p}>
        The App is provided "as is" and "as available", without warranties of any kind. To the maximum
        extent permitted by law, the operator shall not be liable for any direct, indirect, incidental, or
        consequential loss (including trading losses) arising from your use of the App.
      </p>

      <h2 style={h2}>9. Governing law</h2>
      <p style={p}>
        These Terms are governed by the laws of India, and any disputes are subject to the exclusive
        jurisdiction of the courts of India.
      </p>

      <h2 style={h2}>10. Changes</h2>
      <p style={p}>
        We may update these Terms from time to time. Continued use after changes means you accept the
        revised Terms.
      </p>

      <p style={muted}>Questions? Contact {CONTACT_EMAIL}.</p>
    </Page>
  );
}

/* ------------------------------ PRIVACY POLICY ---------------------------- */
export function Privacy({ onClose }) {
  return (
    <Page title="Privacy Policy" onClose={onClose}>
      <p style={p}>
        This Privacy Policy explains how MatrixOne (the "App") handles your information. The App is a
        personal, non-commercial research project. We aim to collect as little personal data as possible
        and to handle it in line with India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the
        Information Technology Act, 2000 and its rules.
      </p>

      <h2 style={h2}>1. Information we collect</h2>
      <p style={p}>
        <b>Account data:</b> your mobile number, a display name, and a hashed PIN, used to sign you in and
        save your preferences. <b>App data:</b> your watchlists, paper trades, strategies, and settings.
        <b>Recovery data:</b> a security question and a hashed answer, if you choose to set one. <b>Broker
        data:</b> if you connect a broker, a temporary session token is held to fetch your data; we do not
        store your broker password.
      </p>

      <h2 style={h2}>2. How we use it</h2>
      <p style={p}>
        Solely to operate the App: to authenticate you, save and show your data across sessions, provide
        research features, and maintain security. We do not sell your personal data, and we do not use it
        for advertising.
      </p>

      <h2 style={h2}>3. How it's stored &amp; protected</h2>
      <p style={p}>
        PINs and security answers are stored only as one-way bcrypt hashes, never in plain text. Sessions
        use signed, expiring tokens. Broker access tokens are kept server-side and never exposed to the
        browser. Despite reasonable safeguards, no method of transmission or storage is completely secure.
      </p>

      <h2 style={h2}>4. Sharing</h2>
      <p style={p}>
        We do not sell or rent your data. Limited data is processed by the infrastructure providers that
        run the App (for example, hosting and database providers) and by any market-data or AI provider
        strictly to deliver a feature you request. Market data is sourced from publicly available feeds.
      </p>

      <h2 style={h2}>5. Your rights</h2>
      <p style={p}>
        Under the DPDP Act you may request access to, correction of, or deletion of your personal data, and
        withdraw consent. To exercise these rights, contact us at {CONTACT_EMAIL}. Because this is a
        personal project, deletion of your account removes your stored data from the active system.
      </p>

      <h2 style={h2}>6. Data retention</h2>
      <p style={p}>
        We keep your data only while your account is active or as needed to provide the App. You can ask us
        to delete it at any time.
      </p>

      <h2 style={h2}>7. Children</h2>
      <p style={p}>
        The App is not intended for anyone under 18, and we do not knowingly collect data from minors.
      </p>

      <h2 style={h2}>8. Changes &amp; contact</h2>
      <p style={p}>
        We may update this policy; material changes will be reflected here. For any privacy question or
        request, contact {CONTACT_EMAIL}.
      </p>
    </Page>
  );
}

/* ---------------------------------- FAQ ----------------------------------- */
export function FAQ({ onClose }) {
  const items = [
    {
      q: "Is MatrixOne giving me trading tips or advice?",
      a: "No. MatrixOne is a personal research and learning project. Everything you see — signals, scores, picks, and AI commentary — is general information from public market data, not advice or a recommendation. All decisions are yours, and you should consult a SEBI-registered adviser before investing.",
    },
    {
      q: "Where does the data come from, and is it real-time?",
      a: "Market data comes from publicly available feeds and may be delayed. Analysis is technical and price-based only; the app does not use company fundamentals. Numbers can be inaccurate or incomplete, so treat everything as illustrative, not authoritative.",
    },
    {
      q: "Is my information safe, and can I delete it?",
      a: "Your PIN and security answer are stored only as one-way hashes, sessions use expiring tokens, and broker tokens never reach your browser. You can request access to or deletion of your data any time by emailing " + CONTACT_EMAIL + ".",
    },
    {
      q: "Is there any charge to use MatrixOne?",
      a: "No. MatrixOne is a free personal project, not a commercial service. There are no subscriptions, fees, or paid tips. It exists purely for research and learning.",
    },
    {
      q: "Can I paper trade Indian (NSE/BSE) stocks with virtual money?",
      a: "Not by default. Simulated/\"paper\" trading on live Indian market data is turned off in line with SEBI's norms on the use of real-time exchange price data (and NSE/BSE data policies), which restrict virtual or simulated trading on real-time feeds. Instead, you can back-test your strategies on historical data, and place real orders by connecting your own broker account — where the data is licensed to you directly. Virtual trading is only available in a market if it has been explicitly enabled by the operator.",
    },
    {
      q: "What is \"paper trading\" and how is it different from real trading?",
      a: "Paper trading simulates buying and selling with virtual money so you can test ideas with no financial risk — nothing is sent to a real exchange and no real money moves. Where it is available, it is offered for learning only, with no monetary incentive. Real trading only happens if you separately connect your own live broker and confirm orders yourself. For Indian markets, virtual trading is disabled by default (see above); back-testing on historical data remains available to everyone.",
    },
    {
      q: "Can I still back-test my strategies?",
      a: "Yes. Back-testing runs your rules over historical price data and is always available — it is not affected by the virtual-trading setting. It is a separate, permitted use from live simulated trading.",
    },
  ];
  return (
    <Page title="FAQ" onClose={onClose}>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 5 }}>{it.q}</div>
          <div style={p}>{it.a}</div>
        </div>
      ))}
      <p style={muted}>Have another question? Contact {CONTACT_EMAIL}.</p>
    </Page>
  );
}

/* --------------------------------- FOOTER --------------------------------- */
/* Sits at the bottom of the main scroll. Opens the legal pages as overlays via `onOpen`. */
export function Footer({ onOpen }) {
  const link = { background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "2px 0" };
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 24, padding: "18px 18px 90px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12, maxWidth: 460, margin: "0 auto 12px" }}>
        MatrixOne is a personal project for research purposes only. It is not for commercial use and does
        not recommend or advise any trade.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginBottom: 12 }}>
        <button style={link} onClick={() => onOpen("terms")}>Terms of Use</button>
        <button style={link} onClick={() => onOpen("privacy")}>Privacy Policy</button>
        <button style={link} onClick={() => onOpen("disclaimer")}>Disclaimer</button>
        <button style={link} onClick={() => onOpen("faq")}>FAQ</button>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>
        For any queries, contact: {CONTACT_EMAIL}
      </div>
      <div style={{ fontSize: 9.5, color: "var(--muted)" }}>© 2026 · All rights reserved</div>
    </div>
  );
}

/* Renders whichever legal page is selected. `page` is one of the keys, or null. */
export function LegalOverlay({ page, onClose }) {
  if (!page) return null;
  if (page === "terms") return <Terms onClose={onClose} />;
  if (page === "privacy") return <Privacy onClose={onClose} />;
  if (page === "disclaimer") return <Disclaimer onClose={onClose} />;
  if (page === "faq") return <FAQ onClose={onClose} />;
  return null;
}
