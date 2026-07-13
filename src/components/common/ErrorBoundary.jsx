import React from "react";

/**
 * ErrorBoundary — turns a white screen into a readable error.
 *
 * React unmounts the entire tree when a render throws. With no boundary, the user
 * sees a blank page and we see nothing: "clicking Search gives a blank screen" is
 * unactionable, and the real error is buried in a console the user may never open.
 *
 * This catches the throw, shows what broke and where, and keeps the rest of the app
 * usable. It is a debugging surface, not a way to paper over bugs — the error is
 * displayed loudly, not swallowed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    this.setState({ info });
    // Still log it — the console remains the source of truth for a developer.
    console.error(`[Matrix] crash in ${this.props.name || "component"}:`, err, info);
  }

  render() {
    const { err, info } = this.state;
    if (!err) return this.props.children;

    const where = (info && info.componentStack ? info.componentStack : "")
      .split("\n").filter(Boolean).slice(0, 4).join("\n");

    return (
      <div style={{ padding: 20 }}>
        <div className="card" style={{ padding: 16, border: "1px solid var(--down)" }}>
          <div className="disp" style={{ fontWeight: 800, fontSize: 15, color: "var(--down)" }}>
            {this.props.name || "This section"} failed to render
          </div>
          <div className="mono" style={{ fontSize: 12, marginTop: 8, color: "var(--ink)", wordBreak: "break-word" }}>
            {String(err && err.message ? err.message : err)}
          </div>
          {where && (
            <pre className="mono" style={{ fontSize: 10, marginTop: 10, color: "var(--muted)", whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>
              {where}
            </pre>
          )}
          <button
            onClick={() => this.setState({ err: null, info: null })}
            className="tap"
            style={{ marginTop: 12, border: "1px solid var(--line)", background: "var(--elev)", color: "var(--ink)", borderRadius: 10, padding: "9px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
