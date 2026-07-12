import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Render error:", error, info.componentStack);
  }

  private handleReload = () => {
    sessionStorage.removeItem("asset_404_reload");
    sessionStorage.removeItem("vite_preload_error_reload");
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#0a0a0f",
        color: "#f2f2f2",
        fontFamily: "Inter, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}>
        <img src="/logo.jpg" alt="Cotopia" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", marginBottom: 8 }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Something went wrong</h2>
        <p style={{ fontSize: "0.875rem", color: "#888", maxWidth: 360, margin: 0 }}>
          The page ran into an unexpected error. A quick refresh usually fixes it.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            padding: "0.55rem 1.5rem",
            borderRadius: 9999,
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Refresh page
        </button>
      </div>
    );
  }
}
