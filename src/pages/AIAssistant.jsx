import React, { useEffect, useRef, useState } from "react";
import { useMatrixChat } from "../hooks/useMatrixChat";
import { Bot, Send } from "lucide-react";

/**
 * Neo — the chat surface.
 *
 * Named for Neo in The Matrix: the one you go to for a reading, who tells
 * you what she sees rather than what you want to hear. Which is the whole point of
 * this app — Neo never invents a number, and says so when the data is not there.
 */

export default function ChatPanel({ context, suggestions, compactMode, stock }) {
  const { msgs, busy, send } = useMatrixChat(context, stock);
  const [text, setText] = useState("");
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy]);
  const fire = (t) => { send(t); setText(""); };
  return (
    <div className="mx" style={{ display: "flex", flexDirection: "column", height: compactMode ? 360 : "100%" }}>
      <div ref={scroller} className="hide-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 18, fontSize: 13 }}>
            <Bot size={26} color="var(--primary)" /><div style={{ marginTop: 6 }}>Ask Neo — stocks, levels, strategy.</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
            <div className="pill" style={{
              background: m.role === "user" ? "var(--primary)" : "var(--surface)",
              color: m.role === "user" ? "var(--on-primary)" : "var(--ink)",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 13px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {busy && <div style={{ color: "var(--muted)", fontSize: 12.5, paddingLeft: 4 }}>Neo is thinking…</div>}
      </div>
      {suggestions && msgs.length === 0 && (
        <div className="hide-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 2px" }}>
          {suggestions.map((q) => (
            <button key={q} onClick={() => fire(q)} className="pill tap" style={{ flex: "0 0 auto", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 600, padding: "7px 12px" }}>{q}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fire(text)}
          placeholder="Ask Neo…" className="no-ring"
          style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 14, padding: "11px 14px", fontSize: 13.5, background: "var(--surface)" }} />
        <button onClick={() => fire(text)} className="tap" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 14, width: 46, display: "grid", placeItems: "center" }}><Send size={17} /></button>
      </div>
    </div>
  );
}

/* ============================== STOCK DRAWER ============================== */
