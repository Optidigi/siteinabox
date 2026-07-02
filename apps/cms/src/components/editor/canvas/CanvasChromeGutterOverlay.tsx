"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { GripVertical, MoreVertical } from "lucide-react"
import { useTranslations } from "next-intl"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"

type AnchorRect = Pick<DOMRect, "bottom" | "left" | "right" | "top" | "width">
const CHROME_VIEWPORT_GAP = 8

function useFixedAnchorRect(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
  measureKey?: unknown,
): AnchorRect | null {
  const [rect, setRect] = React.useState<AnchorRect | null>(null)

  React.useLayoutEffect(() => {
    if (!enabled) return

    let frame: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let observedNode: HTMLElement | null = null
    const measure = () => {
      frame = null
      const node = ref.current
      if (!node) return
      if (node !== observedNode) {
        resizeObserver?.disconnect()
        observedNode = node
        resizeObserver = new ResizeObserver(schedule)
        resizeObserver.observe(node)
      }
      const next = node.getBoundingClientRect()
      setRect((current) => {
        const measured = {
          left: next.left,
          right: next.right,
          bottom: next.bottom,
          top: next.top,
          width: next.width,
        }
        return current &&
          current.bottom === measured.bottom &&
          current.left === measured.left &&
          current.right === measured.right &&
          current.top === measured.top &&
          current.width === measured.width
          ? current
          : measured
      })
    }
    const schedule = () => {
      if (frame != null) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)

    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, true)
    }
  }, [enabled, ref, measureKey])

  return rect
}

function cmsChromeBottomAt(x: number) {
  if (typeof document === "undefined" || typeof window === "undefined") return CHROME_VIEWPORT_GAP
  let bottom = CHROME_VIEWPORT_GAP
  document.body.querySelectorAll<HTMLElement>("[data-siab-cms-sticky-chrome]").forEach((element) => {
    if (element.closest(".rt-canvas, [data-siab-canvas-chrome]")) return
    const style = window.getComputedStyle(element)
    if (style.position !== "fixed" && style.position !== "sticky") return
    const zIndex = Number.parseInt(style.zIndex, 10)
    if (!Number.isFinite(zIndex) || zIndex < 15) return
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    if (rect.top > window.innerHeight / 2 || rect.right < x || rect.left > x) return
    bottom = Math.max(bottom, rect.bottom + CHROME_VIEWPORT_GAP)
  })
  return bottom
}

export const CanvasChromeGutterOverlay: React.FC<{
  anchorRef: React.RefObject<HTMLElement | null>
  visible: boolean
  setVisible: (next: boolean) => void
  dragHandleRef?: (node: HTMLElement | null) => void
  dragHandleProps?: Record<string, unknown>
  onDelete?: () => void
  onDuplicate?: () => void
  onOptionsClick?: (point: { x: number; y: number }) => void
  optionsLabel: string
  dataChrome?: string
  premeasure?: boolean
  measureKey?: unknown
}> = ({
  anchorRef,
  visible,
  setVisible,
  dragHandleRef,
  dragHandleProps,
  onDelete,
  onDuplicate,
  onOptionsClick,
  optionsLabel,
  dataChrome = "block-gutter",
  premeasure = false,
  measureKey,
}) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const show = visible || menuOpen
  const rect = useFixedAnchorRect(anchorRef, premeasure || show, measureKey)
  const hasDropdownActions = !!onDuplicate || !!onDelete
  const left = rect ? Math.max(CHROME_VIEWPORT_GAP, rect.right - 72) : 0
  const cmsChromeBottom = rect ? cmsChromeBottomAt(left + 28) : CHROME_VIEWPORT_GAP
  const naturalTop = rect ? Math.max(CHROME_VIEWPORT_GAP, rect.top + CHROME_VIEWPORT_GAP) : 0
  const shouldClampToCmsChrome = dataChrome === "site-chrome-gutter" || (rect ? rect.top >= 0 : false)
  const top = shouldClampToCmsChrome ? Math.max(naturalTop, cmsChromeBottom) : naturalTop
  const hiddenAfterAnchorScrolledAway = rect ? dataChrome !== "site-chrome-gutter" && rect.bottom < cmsChromeBottom : false
  const position = useCspStyleRule(
    "canvas-gutter-overlay",
    show && rect && !hiddenAfterAnchorScrolledAway
      ? `left:${formatCssPx(left)};top:${formatCssPx(top)};`
      : null,
  )

  React.useEffect(() => {
    if (menuOpen) setVisible(true)
  }, [menuOpen, setVisible])

  if (!show || !rect || hiddenAfterAnchorScrolledAway || typeof document === "undefined") return null

  return createPortal(
    <>
      {position.styleElement}
      <div
        data-siab-editor-ui
        data-siab-canvas-chrome={dataChrome}
        className={`${position.className} fixed z-[19] inline-flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 text-foreground opacity-100 shadow-sm backdrop-blur-sm`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => {
          if (!menuOpen) setVisible(false)
        }}
        onFocus={() => setVisible(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !menuOpen) {
            setVisible(false)
          }
        }}
      >
        <button
          ref={dragHandleRef}
          type="button"
          aria-label={dragHandleRef ? t("dragToReorder") : undefined}
          aria-hidden={dragHandleRef ? undefined : true}
          tabIndex={dragHandleRef ? undefined : -1}
          className={`rounded-sm p-1 text-muted-foreground ${
            dragHandleRef
              ? "cursor-grab hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
              : "cursor-default opacity-45"
          }`}
          {...(dragHandleProps ?? {})}
        >
          <GripVertical className="size-4" />
        </button>
        {hasDropdownActions ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={optionsLabel}
                className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-siab-editor-ui>
              {onDuplicate && <DropdownMenuItem onClick={onDuplicate}>{t("duplicate")}</DropdownMenuItem>}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  {tCommon("delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            data-site-chrome-menu-trigger
            aria-label={optionsLabel}
            className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              onOptionsClick?.({ x: rect.right, y: rect.bottom + 4 })
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOptionsClick?.({ x: event.clientX, y: event.clientY })
            }}
          >
            <MoreVertical className="size-4" />
          </button>
        )}
      </div>
    </>,
    document.body,
  )
}
