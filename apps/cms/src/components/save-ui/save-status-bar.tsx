"use client"
import { useEffect, useState, type ReactNode } from "react"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { useSidebar } from "@siteinabox/ui/components/sidebar"
import { useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { useTranslations } from "next-intl"
import {
  StatusBadge,
  getStatusBadgeClassName,
  type StatusBadgeTone,
} from "@/components/save-ui/status-badge"

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

/**
 * SaveStatusBar — floating status pill anchored just above the bottom-
 * centre ModeBar. Only renders transient save lifecycle states:
 *
 *   idle              -> hidden
 *   dirty             -> hidden (PublishControls Save button carries this)
 *   saving            -> spinner pill, "Saving..."
 *   saved             -> success pill, "Saved" — fades out after 3.25s
 *   error             -> destructive pill, "Save blocked: N issues"
 *                        (clickable → jumps to first invalid field) or
 *                        "Save failed" + Retry for non-field server errors
 *
 * Visual treatment uses one compact status pill shape for saving / saved /
 * failed states. Saved/error keep the stronger success/destructive contrast
 * while staying smaller than the old wide default badge.
 *
 * Phone is suppressed entirely (`hidden md:flex`); the MobileSavePill
 * owns small-viewport save UI.
 *
 * The bar is UI-only: navigation guarding is handled by
 * `useNavigationGuard` mounted by the parent form.
 */
type Props = {
  status: SaveStatus
  errorCount?: number
  onRetry?: () => void
  onJumpToError?: () => void
  /** viewport: fixed centre of main content (default). canvas: inline pill for parent grid centering. */
  layout?: "viewport" | "canvas"
}

export function SaveStatusBar({
  status,
  errorCount = 0,
  onRetry,
  onJumpToError,
  layout = "viewport",
}: Props) {
  const t = useTranslations("common")
  const { state, isMobile } = useSidebar()
  const [showSaved, setShowSaved] = useState(false)
  const [savedFading, setSavedFading] = useState(false)

  useEffect(() => {
    if (status === "saved") {
      setShowSaved(true)
      setSavedFading(false)
      const fade = setTimeout(() => setSavedFading(true), 3_250)
      const hide = setTimeout(() => setShowSaved(false), 3_750)
      return () => {
        clearTimeout(fade)
        clearTimeout(hide)
      }
    }
    setShowSaved(false)
    setSavedFading(false)
  }, [status])

  // Anchor above the ModeBar (fixed bottom-centre with the same sidebar
  // offset). 4.75rem clears ~1rem ModeBar inset + ~2.75rem pill height +
  // a 1rem visual gap.
  const sidebarOffset = isMobile
    ? "0px"
    : state === "expanded"
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)"
  const isCanvasLayout = layout === "canvas"
  const positionClasses = cn(
    "hidden md:flex",
    !isCanvasLayout && "fixed z-40 -translate-x-1/2",
  )
  const position = useCspStyleRule(
    isCanvasLayout ? "save-status-bar-canvas" : "save-status-bar-position",
    isCanvasLayout
      ? null
      : `bottom:calc(env(safe-area-inset-bottom, 0px) + 4.75rem);left:calc(50% + ${sidebarOffset} / 2);`,
  )

  // Hidden states: idle and dirty render nothing — PublishControls'
  // Save button carries the dirty signal on desktop.
  if (status === "idle" || status === "dirty" || (status === "saved" && !showSaved)) {
    return null
  }

  let body: ReactNode = null
  let label = ""
  let isClickableJump = false
  let retryAction: (() => void) | null = null

  if (status === "saving") {
    label = t("saving")
    body = (
      <>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </>
    )
  } else if (status === "saved") {
    label = t("saved")
    body = (
      <>
        <CheckCircle2 className="h-4 w-4 text-success-foreground" aria-hidden />
        <span>{label}</span>
      </>
    )
  } else if (status === "error") {
    if (errorCount > 0) {
      label = t("saveBlocked", { count: errorCount })
      isClickableJump = Boolean(onJumpToError)
      body = (
        <>
          <AlertCircle className="h-4 w-4 text-destructive-foreground" aria-hidden />
          <span>{label}</span>
        </>
      )
    } else {
      label = t("saveFailed")
      retryAction = onRetry ?? null
      body = (
        <>
          <AlertCircle className="h-4 w-4 text-destructive-foreground" aria-hidden />
          <span>{label}</span>
        </>
      )
    }
  }

  const variant: StatusBadgeTone =
    status === "saved" ? "success" : status === "error" ? "destructive" : "neutral"
  const fadeClass =
    status === "saved"
      ? cn(
          "transition-all duration-500 ease-out",
          savedFading && "opacity-0 translate-y-2",
        )
      : ""

  const inner = isClickableJump ? (
    <button
      type="button"
      role="status"
      aria-live="polite"
      aria-label={label}
      onClick={onJumpToError}
      className={getStatusBadgeClassName(variant, cn("cursor-pointer hover:opacity-90", fadeClass))}
    >
      {body}
    </button>
  ) : (
    <StatusBadge
      tone={variant}
      role="status"
      aria-live="polite"
      aria-label={label}
      className={fadeClass}
    >
      {body}
    </StatusBadge>
  )

  return (
    <div className={cn(position.className, positionClasses)}>
      {!isCanvasLayout ? position.styleElement : null}
      {retryAction ? (
        <div className={cn("inline-flex items-center gap-2", fadeClass)}>
          {inner}
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={retryAction}
            aria-label={t("retry")}
            className="h-8"
          >
            {t("retry")}
          </Button>
        </div>
      ) : (
        inner
      )}
    </div>
  )
}
