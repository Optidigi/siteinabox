"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import type { RtManifest } from "@/lib/richText/manifest"
import { MarkChips } from "@/components/editor/richText/toolbar/mark-chips"
import { FontChip } from "@/components/editor/richText/toolbar/font-chip"
import { StyleChip } from "@/components/editor/richText/toolbar/style-chip"
import { LinkChip } from "@/components/editor/richText/toolbar/link-chip"
import { useIsMobile } from "@/lib/hooks/useIsMobile"
import { useVisualViewportOffset } from "@/lib/hooks/useVisualViewportOffset"
import { FLOATING_PILL_CLASS } from "@/components/editor/mode/mode-bar"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"

const TOOLBAR_HEIGHT_APPROX = 44
const TOOLBAR_GAP = 8

const IDLE_DISMISS_MS = 10_000

export const FloatingToolbar: React.FC<{
  manifest: RtManifest
  variant: "block" | "inline"
  allowFontFamily?: boolean
  onOpenLink: () => void
}> = ({ manifest, variant, allowFontFamily = false, onOpenLink }) => {
  const [editor] = useLexicalComposerContext()
  const [coords, setCoords] = React.useState<{ x: number; y: number } | null>(null)
  const [placement, setPlacement] = React.useState<"above" | "below">("above")
  // Auto-dismiss: the toolbar hides on typing, page scroll, or 10s idle.
  // It re-appears on any mouseup in the editor or on a non-collapsed
  // selection change (shift+arrow extending a range, drag-select via mouse).
  const [dismissed, setDismissed] = React.useState(false)
  const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useIsMobile()
  const kbOffset = useVisualViewportOffset()

  const armIdle = React.useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setDismissed(true), IDLE_DISMISS_MS)
  }, [])

  React.useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    const update = () => {
      editor.getEditorState().read(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel)) { setCoords(null); return }
        if (!editor.getRootElement()?.contains(document.activeElement)) {
          setCoords(null); return
        }
        const dom = window.getSelection()
        if (!dom || dom.rangeCount === 0) { setCoords(null); return }
        const rect = dom.getRangeAt(0).getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) { setCoords(null); return }
        const hasRoomAbove = rect.top >= TOOLBAR_HEIGHT_APPROX + TOOLBAR_GAP
        setPlacement(hasRoomAbove ? "above" : "below")
        setCoords({
          x: rect.left + rect.width / 2,
          y: hasRoomAbove ? rect.top : rect.bottom,
        })
        // A real range (text was dragged-selected or shift+arrow extended)
        // un-dismisses; a collapsed cursor doesn't (so post-typing the
        // toolbar stays hidden until the user mouseups or selects fresh text).
        if (!sel.isCollapsed()) setDismissed(false)
        armIdle()
      })
    }
    const unregister = editor.registerUpdateListener(update)
    document.addEventListener("selectionchange", update)
    return () => { unregister(); document.removeEventListener("selectionchange", update) }
  }, [editor, armIdle])

  // Typing dismisses (character inputs + edit keys). Navigation keys
  // (arrows, home/end, escape, tab) and OS shortcuts pass through so the
  // toolbar can still respond to formatting commands.
  React.useEffect(() => {
    const root = editor.getRootElement()
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length === 1) { setDismissed(true); return }
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
        setDismissed(true)
      }
    }
    root.addEventListener("keydown", onKey)
    return () => root.removeEventListener("keydown", onKey)
  }, [editor])

  // Page scroll dismisses; mouseup inside the editor re-summons. Scroll
  // events don't bubble, so `window.addEventListener("scroll")` only fires
  // for the page itself — popover scrolls inside the toolbar don't trigger.
  React.useEffect(() => {
    const root = editor.getRootElement()
    const onScroll = () => setDismissed(true)
    const onMouseUp = () => setDismissed(false)
    window.addEventListener("scroll", onScroll, { passive: true })
    root?.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("scroll", onScroll)
      root?.removeEventListener("mouseup", onMouseUp)
    }
  }, [editor])

  const mobilePosition = useCspStyleRule(
    "floating-toolbar-mobile",
    isMobile
      ? `bottom:calc(${formatCssPx(kbOffset)} + env(safe-area-inset-bottom, 0px) + 8px);`
      : null,
  )
  const desktopPosition = useCspStyleRule(
    "floating-toolbar-desktop",
    !isMobile && coords
      ? `left:${formatCssPx(coords.x)};top:${formatCssPx(coords.y)};`
      : null,
  )

  // Desktop: render only when there's an active selection in this editor
  // and the toolbar has not been auto-dismissed.
  // Mobile: render whenever the editor root contains the active element
  // (the bottom-anchored mobile toolbar isn't auto-dismissed — it's the
  // only formatting affordance available above the soft keyboard).
  if (!isMobile && (!coords || dismissed)) return null
  if (isMobile && !editor.getRootElement()?.contains(document.activeElement)) return null

  const Inner = (
    <div
      role="toolbar"
      className={cn("rt-floating-toolbar flex items-center gap-0.5", FLOATING_PILL_CLASS)}
      data-siab-editor-ui
      data-siab-canvas-chrome="rich-text-toolbar"
    >
      <MarkChips manifest={manifest} surface="floating" />
      {allowFontFamily && <FontChip manifest={manifest} />}
      <StyleChip manifest={manifest} />
      <LinkChip onOpen={onOpenLink} surface="floating" />
    </div>
  )

  if (isMobile) {
    return createPortal(
      <>
        {mobilePosition.styleElement}
        <div
          className={`${mobilePosition.className} fixed inset-x-2 z-[9999] overflow-x-auto`}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
          data-siab-editor-ui
          data-siab-canvas-chrome="rich-text-toolbar"
        >
          {Inner}
        </div>
      </>,
      document.body,
    )
  }

  return createPortal(
    <>
      {desktopPosition.styleElement}
      <div
        role="toolbar"
        className={[
          desktopPosition.className,
          "fixed z-[9999] -translate-x-1/2",
          placement === "above" ? "-translate-y-[calc(100%+8px)]" : "translate-y-2",
        ].join(" ")}
        onMouseDown={(e) => e.preventDefault()}
        data-siab-editor-ui
        data-siab-canvas-chrome="rich-text-toolbar"
      >
        {Inner}
      </div>
    </>,
    document.body,
  )
}
