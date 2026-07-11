"use client"
import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { useTranslations } from "next-intl"

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render-time exceptions in the editor surface (richtext, inspector,
 * drill-down state 2 forms). Without this, a Lexical plugin error (e.g.
 * ListPlugin registered against an editor lacking ListNode) propagates to the
 * Next.js dev overlay and the user must hard-reload the entire page.
 */
type BoundaryCopy = {
  failed: string
  unknownError: string
  retry: string
}

class EditorErrorBoundaryInner extends React.Component<Props & { copy: BoundaryCopy }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[editor] surface error:", error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-foreground">{this.props.copy.failed}</p>
        <p className="mt-1 text-muted-foreground">
          {this.state.error?.message ?? this.props.copy.unknownError}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={this.reset}
          className="mt-3"
        >
          {this.props.copy.retry}
        </Button>
      </div>
    )
  }
}

export function EditorErrorBoundary(props: Props) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  return (
    <EditorErrorBoundaryInner
      {...props}
      copy={{
        failed: t("editorSurfaceFailed"),
        unknownError: tCommon("unknownError"),
        retry: tCommon("retry"),
      }}
    />
  )
}
