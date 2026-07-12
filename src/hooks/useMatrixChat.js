import { BACKEND_URL, MATRIX_PERSONA } from "../config";
import React, { useState } from "react";
import { askMatrix } from "../domain/api";

/**
 * Chat state for the Matrix Copilot.
 */

export function useMatrixChat(context, stock) {
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  async function send(text) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setBusy(true);
    const system = `${MATRIX_PERSONA}${context ? "\n\nCURRENT CONTEXT:\n" + context : ""}`;
    try {
      const out = await askMatrix(next, system, 1000);
      setMsgs([...next, { role: "assistant", content: out || "I couldn't get a response from the engine. Try again in a moment." }]);
    } catch (e) {
      const detail = e && e.message ? ` (${e.message})` : "";
      setMsgs([...next, { role: "assistant", content: `I couldn't reach the Matrix engine${detail}. Check that BACKEND_URL points at your Render service and that a GROQ_API_KEY is set there — open <backend-url>/api/health to see which engines it can find. For a grounded verdict without the AI, tap Deep Analysis: it falls back to rules over real indicators.` }]);
    } finally { setBusy(false); }
  }
  return { msgs, busy, send, reset: () => setMsgs([]) };
}
