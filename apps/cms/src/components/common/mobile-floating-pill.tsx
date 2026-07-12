"use client"
import * as React from "react"
import { Loader2 } from "lucide-react"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { ShineBorder } from "@/components/common/shine-border"

export type MobileFloatingPillVariant = "default" | "warning" | "destructive" | "loading" | "success"
export type MobileFloatingPillPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface MobileFloatingPillProps {
  position: MobileFloatingPillPosition
  /** Lucide icon (or any node). Ignored when variant="loading". */
  icon: React.ReactNode
  onClick?: () => void
  /** When set (and not disabled/loading), renders an anchor instead of a button. */
  href?: string
  ariaLabel: string
  variant?: MobileFloatingPillVariant
  /** Counter badge top-right of pill. Suppressed when 0/undefined. */
  badgeCount?: number
  /** Override badge tone (defaults to match variant). */
  badgeTone?: "warning" | "destructive"
  disabled?: boolean
  /** Animate the pill out and disable pointer events while keeping it mounted. */
  visible?: boolean
  /** Extra inset (CSS length) along the pill's horizontal edge — lets a
   *  second pill sit beside another that shares the same corner. */
  offset?: string
  /** Stable test/data attrs (`data-mobile-*`). */
  dataAttrs?: Record<string, string | undefined>
  /** `theme` follows token background/foreground (for preview chrome wrappers). */
  surface?: "inverted" | "theme"
  sizeClassName?: string
  /** Adds the preview toolbar's animated Magic UI shine border. */
  shine?: boolean
}

/**
 * Reusable floating pill for mobile editor (save / back / trash / etc).
 *
 * Default variant inverts the surface: dark pill + light icon in light mode,
 * light pill + dark icon in dark mode — pops against any tenant canvas.
 *
 * Position drives top/right/bottom/left + safe-area inset.
 * 48px tap target (h-12 w-12). Always md:hidden + fixed z-50.
 */
export const MobileFloatingPill: React.FC<MobileFloatingPillProps> = ({
  position,
  icon,
  onClick,
  href,
  ariaLabel,
  variant = "default",
  badgeCount,
  badgeTone,
  disabled,
  visible = true,
  offset,
  dataAttrs,
  surface = "inverted",
  sizeClassName = "size-12",
  shine = false,
}) => {
  const isLoading = variant === "loading"
  const tone = badgeTone ?? (variant === "destructive" ? "destructive" : "warning")
  const showBadge = badgeCount != null && badgeCount > 0

  const positionClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
  }[position]
  const safeOffset = formatRuntimeCssValue(offset)
  const horizontalOffset = safeOffset ? ` + ${safeOffset}` : ""
  const positionRule = [
    position.startsWith("top") ? "top:calc(env(safe-area-inset-top) + 0.75rem);" : "",
    position.startsWith("bottom") ? "bottom:calc(env(safe-area-inset-bottom) + 0.75rem);" : "",
    position.endsWith("left") ? `left:calc(env(safe-area-inset-left) + 0.75rem${horizontalOffset});` : "",
    position.endsWith("right") ? `right:calc(env(safe-area-inset-right) + 0.75rem${horizontalOffset});` : "",
  ].join("")
  const cspPosition = useCspStyleRule("mobile-floating-pill-position", positionRule)

  const variantClasses = cn(
    surface === "theme"
      ? "border border-border/60 bg-background text-foreground shadow-lg"
      : "border bg-foreground text-background border-transparent shadow-lg",
    variant === "warning" && "border-2 border-amber-500/70 text-amber-400 dark:text-amber-500",
    variant === "destructive" && "text-destructive",
    variant === "loading" && "opacity-90 cursor-wait border-transparent",
    variant === "success" && "border-transparent bg-success text-success-foreground shadow-success/25",
  )
  const hiddenMotionClass = position.endsWith("right") ? "translate-x-3" : "-translate-x-3"
  const isInteractive = !isLoading && !disabled && visible
  const useLink = Boolean(href && isInteractive)
  const sharedClassName = cn(
    cspPosition.className,
    "md:hidden fixed z-50 inline-flex items-center justify-center overflow-hidden rounded-full transition-all duration-200 ease-out",
    sizeClassName,
    visible ? "pointer-events-auto opacity-100 scale-100 translate-x-0" : cn("pointer-events-none opacity-0 scale-75", hiddenMotionClass),
    !isInteractive && "pointer-events-none opacity-50",
    positionClasses,
    variantClasses,
  )
  const sharedContent = (
    <>
      {shine && (
        <ShineBorder
          borderWidth={1}
          duration={14}
          shineColor={["transparent", "white", "white", "white", "transparent"]}
        />
      )}
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {showBadge && (
        <span
          className={cn(
            "absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-medium flex items-center justify-center",
            tone === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white",
          )}
          aria-hidden
        >
          {(badgeCount ?? 0) > 9 ? "9+" : badgeCount}
        </span>
      )}
    </>
  )
  const pointerDownGuard = (e: React.PointerEvent) => {
    const tag = document.activeElement?.tagName
    if (tag === "INPUT" || tag === "TEXTAREA") e.preventDefault()
  }

  return (
    <>
      {cspPosition.styleElement}
      {useLink ? (
        <a
          href={href}
          onPointerDown={pointerDownGuard}
          onClick={onClick}
          aria-label={ariaLabel}
          {...(dataAttrs ?? {})}
          className={sharedClassName}
        >
          {sharedContent}
        </a>
      ) : (
        <button
          type="button"
          onPointerDown={pointerDownGuard}
          onClick={isInteractive ? onClick : undefined}
          disabled={!isInteractive}
          aria-label={ariaLabel}
          {...(dataAttrs ?? {})}
          className={sharedClassName}
        >
          {sharedContent}
        </button>
      )}
    </>
  )
}
