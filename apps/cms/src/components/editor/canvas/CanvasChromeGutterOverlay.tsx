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

type AnchorRect = Pick<DOMRect, "left" | "right" | "top" | "width">

function useFixedAnchorRect(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
): AnchorRect | null {
  const [rect, setRect] = React.useState<AnchorRect | null>(null)

  React.useLayoutEffect(() => {
    if (!enabled) return
    const node = ref.current
    if (!node) return

    let frame: number | null = null
    const measure = () => {
      frame = null
      const next = node.getBoundingClientRect()
      setRect({
        left: next.left,
        right: next.right,
        top: next.top,
        width: next.width,
      })
    }
    const schedule = () => {
      if (frame != null) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(node)
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)

    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, true)
    }
  }, [enabled, ref])

  return rect
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
}) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const rect = useFixedAnchorRect(anchorRef, visible)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const show = visible || menuOpen
  const hasDropdownActions = !!onDuplicate || !!onDelete
  const position = useCspStyleRule(
    "canvas-gutter-overlay",
    show && rect
      ? `left:${formatCssPx(Math.max(8, rect.right - 72))};top:${formatCssPx(Math.max(8, rect.top + 8))};`
      : null,
  )

  React.useEffect(() => {
    if (menuOpen) setVisible(true)
  }, [menuOpen, setVisible])

  if (!show || !rect || typeof document === "undefined") return null

  return createPortal(
    <>
      {position.styleElement}
      <div
        data-siab-canvas-chrome={dataChrome}
        className={`${position.className} fixed z-40 inline-flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 text-foreground opacity-100 shadow-sm backdrop-blur-sm`}
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
            <DropdownMenuContent align="end">
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
