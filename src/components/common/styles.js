/**
 * components/common/styles.js — shared form-control styling.
 *
 * `selStyle` lived inside pages/Screener.jsx and was not exported, yet Ideas,
 * Automation and Trade all referenced it. It worked only in the old monolith,
 * where everything shared one scope; once the pages became real modules it
 * became a ReferenceError that crashed those pages on open.
 *
 * A style used by four pages belongs to none of them. It lives here.
 */
export const selStyle = {
  flex: 1,
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "9px 8px",
  fontSize: 12.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

/** Text input, same visual language as selStyle. */
export const inpStyle = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 700,
  background: "var(--elev)",
  color: "var(--ink)",
};
