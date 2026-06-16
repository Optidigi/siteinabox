"use client"
import { Button } from "@siteinabox/ui/components/button"
import { Save, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export type SaveButtonProps = {
  /** A save / write is in flight. */
  pending: boolean
  /** Unsaved changes exist. The button is disabled when not dirty. */
  isDirty?: boolean
  /** Blocking validation issues — flips the button to the destructive treatment. */
  errorCount?: number
  /** Count surfaced in the floating badge when dirty (defaults to 1). */
  dirtyCount?: number
  /** "submit" inside a <form>; "button" when paired with onClick. */
  type?: "submit" | "button"
  onClick?: () => void
  label?: string
  pendingLabel?: string
}

/**
 * The canonical CMS save button — an inverted-surface pill (dark in light
 * mode, light in dark mode), an amber dirty-state border (destructive when
 * `errorCount > 0`), and a floating count badge in the top-right corner.
 *
 * Single source of truth for every save affordance in the CMS: the page
 * editor's PublishControls, the navigation manager, and the settings /
 * entity-edit forms all render this so they read identically.
 */
export function SaveButton({
  pending,
  isDirty = false,
  errorCount,
  dirtyCount,
  type = "submit",
  onClick,
  label,
  pendingLabel,
}: SaveButtonProps) {
  const t = useTranslations("common")
  const actualLabel = label ?? t("save")
  const actualPendingLabel = pendingLabel ?? t("saving")
  const hasErrors = errorCount != null && errorCount > 0
  const title = hasErrors
    ? t("saveBlocked", { count: errorCount })
    : isDirty
      ? actualLabel
      : actualLabel
  return (
    <div className="relative">
      <Button
        type={type}
        onClick={onClick}
        disabled={pending || !isDirty}
        title={title}
        variant="default"
        className={cn(
          // Inverted shadcn surface — dark pill on light mode, light pill on
          // dark mode. Matches the MobileSavePill default treatment.
          "bg-foreground text-background hover:bg-foreground/90 gap-2",
          isDirty && !hasErrors && "border-2 border-amber-500/70",
          hasErrors && "border-2 border-destructive/70",
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : hasErrors ? (
          <AlertCircle className="h-4 w-4" aria-hidden />
        ) : (
          <Save className="h-4 w-4" aria-hidden />
        )}
        {pending ? actualPendingLabel : actualLabel}
      </Button>
      {/* Floating count badge — dirty / error only. Pointer-events-none so it
          doesn't intercept clicks on the button. */}
      {(isDirty || hasErrors) && !pending && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-sm text-[10px] font-medium flex items-center justify-center",
            hasErrors
              ? "bg-destructive text-destructive-foreground"
              : "bg-amber-500 text-white",
          )}
        >
          {(() => {
            const n = hasErrors ? errorCount! : (dirtyCount ?? 1)
            return n > 9 ? "9+" : n
          })()}
        </span>
      )}
    </div>
  )
}
