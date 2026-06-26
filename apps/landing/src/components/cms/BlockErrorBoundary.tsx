import { Component, type ComponentChildren } from "preact"

/**
 * Per-block error boundary.
 *
 * Wraps each block renderer at usage site. If a block component throws
 * during render (malformed draft, unexpected null, schema drift), this
 * catches it and renders a small placeholder instead of crashing the
 * whole preview tree. Logs via window.postMessage so the admin's
 * watchdog can surface the error in the toolbar.
 */
type Props = {
  blockType: string
  children: ComponentChildren
}

type State = {
  hasError: boolean
  message?: string
}

export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  componentDidCatch(err: unknown) {
    // Best-effort report to admin parent. Safe to fail silently if there's
    // no parent (e.g., this component is somehow rendered standalone).
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: "preview:error",
            version: 1,
            message: this.state.message ?? "render error",
            blockType: this.props.blockType,
          },
          "*", // We don't know admin origin here; admin's listener checks origin and ignores mismatch.
        )
      } catch {
        // Silently ignore — we tried.
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "1rem",
            margin: "0.5rem 0",
            border: "1px dashed #d97706",
            background: "#fef3c7",
            color: "#92400e",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          }}
        >
          [{this.props.blockType} block: render error] {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}
