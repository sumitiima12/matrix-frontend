import React from "react";

/**
 * Toggle — a real sliding switch.
 *
 * `on` is styled by the caller (`onColor`), because the two switches in this app mean
 * very different things: dark mode is a preference, Real mode spends actual money. The
 * latter is red on purpose — a switch that arms real orders should not look like a
 * switch that changes the wallpaper.
 */
export default function Toggle({ on, onChange, label, offLabel, onLabel, onColor = "var(--primary)", disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className="tap"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        border: "none", background: "transparent", padding: 0,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      }}
    >
      {offLabel && (
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".03em", color: on ? "var(--muted)" : "var(--ink)" }}>
          {offLabel}
        </span>
      )}

      <span
        style={{
          position: "relative", width: 34, height: 19, borderRadius: 19,
          background: on ? onColor : "var(--line)",
          transition: "background 180ms ease", flex: "0 0 auto",
        }}
      >
        <span
          style={{
            position: "absolute", top: 2, left: on ? 17 : 2,
            width: 15, height: 15, borderRadius: 15, background: "#fff",
            transition: "left 180ms cubic-bezier(.2,.8,.2,1)",
            boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }}
        />
      </span>

      {onLabel && (
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".03em", color: on ? onColor : "var(--muted)" }}>
          {onLabel}
        </span>
      )}
    </button>
  );
}
