"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional label for identifying which boundary caught the error */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`,
      error,
      errorInfo
    );
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            gap: "1rem",
            minHeight: "200px",
            textAlign: "center",
            color: "var(--ink, #1f1c19)",
          }}
        >
          <div style={{ fontSize: "2rem" }} aria-hidden>
            ⚠
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>
            {this.props.name
              ? `${this.props.name} encountered an error`
              : "Something went wrong"}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--ink-muted, rgba(31,28,25,0.45))",
              maxWidth: "400px",
            }}
          >
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "0.5rem 1.2rem",
              borderRadius: "99px",
              border: "1px solid var(--line, rgba(31,28,25,0.12))",
              background: "var(--bg-2, #e6dcc9)",
              color: "var(--ink, #1f1c19)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight wrapper for visualization components.
 * Shows a nicer error state with the viz name.
 */
export function VizErrorBoundary({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return <ErrorBoundary name={name}>{children}</ErrorBoundary>;
}
