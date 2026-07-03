"use client"

import * as React from "react"
import type { Block, Page, SiteSettings } from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorSelection,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { Button } from "@siteinabox/ui/components/button"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import type { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import { findBlockIndexByWireId } from "@/lib/editor/ensureBlockIds"

export type PageEditorFrameView = "canvas" | "sidebar"
export type PageEditorFrameLayout = "desktop" | "mobile"

const PARENT_CHROME_BOTTOM_VAR = "--siab-parent-chrome-bottom"
const CHROME_VIEWPORT_GAP = 8

function measureParentChromeBottom(): number {
  if (typeof document === "undefined" || typeof window === "undefined") return CHROME_VIEWPORT_GAP
  let bottom = CHROME_VIEWPORT_GAP
  document.body.querySelectorAll<HTMLElement>("[data-siab-cms-sticky-chrome]").forEach((element) => {
    const style = window.getComputedStyle(element)
    if (style.position !== "fixed" && style.position !== "sticky") return
    const zIndex = Number.parseInt(style.zIndex, 10)
    if (!Number.isFinite(zIndex) || zIndex < 15) return
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    if (rect.top > window.innerHeight / 2) return
    bottom = Math.max(bottom, rect.bottom + CHROME_VIEWPORT_GAP)
  })
  return bottom
}

export type PageEditorFrameMutationHandlers = {
  onBlockPatch?: (args: { blockId: string; patch: Record<string, unknown> }) => void
  onBlocksInsert?: (args: { block: Block; index?: number; beforeBlockId?: string; afterBlockId?: string }) => void
  onBlocksDelete?: (args: { blockId: string }) => void
  onBlocksReorder?: (args: { blockIds: string[] }) => void
  onFieldCommit?: (args: { blockId: string; fieldPath: readonly string[]; value: unknown }) => void
}

export function PageEditorFrameHost({
  pageId,
  page,
  settings,
  theme,
  view,
  layout = "desktop",
  tenantId,
  tenantSlug,
  selection,
  onSelectionChanged,
  onOpenBlockInspector,
  onChromeSelect,
  onChromeGeometry,
  onFrameDocument,
  mutations,
}: {
  pageId: string | number
  page: Page
  settings: SiteSettings
  theme: ReturnType<typeof cmsThemeToRendererTheme>
  view: PageEditorFrameView
  layout?: PageEditorFrameLayout
  tenantId: string | number
  /** Required on super-admin host so the frame route can resolve the selected site. */
  tenantSlug?: string | null
  selection?: IframeEditorSelection | null
  onSelectionChanged?: (selection: IframeEditorSelection | null) => void
  onOpenBlockInspector?: (index: number) => void
  onChromeSelect?: (zone: "header" | "footer", point?: { x: number; y: number }) => void
  onChromeGeometry?: (zone: "header" | "footer", rect: { x: number; y: number; width: number; height: number }) => void
  onFrameDocument?: (document: Document | null) => void
  mutations?: PageEditorFrameMutationHandlers
}) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const revisionRef = React.useRef(0)
  const [ready, setReady] = React.useState(false)
  const [frameError, setFrameError] = React.useState<string | null>(null)
  const [loadState, setLoadState] = React.useState<"loading" | "ready" | "failed">("loading")
  const [retryKey, setRetryKey] = React.useState(0)
  const [parentChromeBottom, setParentChromeBottom] = React.useState(CHROME_VIEWPORT_GAP)
  const iframeChromeInset = useCspStyleRule(
    "editor-frame-chrome-inset",
    `${PARENT_CHROME_BOTTOM_VAR}:${formatCssPx(parentChromeBottom)};`,
  )
  const onSelectionChangedRef = React.useRef(onSelectionChanged)
  onSelectionChangedRef.current = onSelectionChanged
  const onOpenBlockInspectorRef = React.useRef(onOpenBlockInspector)
  onOpenBlockInspectorRef.current = onOpenBlockInspector
  const onChromeSelectRef = React.useRef(onChromeSelect)
  onChromeSelectRef.current = onChromeSelect
  const onChromeGeometryRef = React.useRef(onChromeGeometry)
  onChromeGeometryRef.current = onChromeGeometry
  const mutationsRef = React.useRef(mutations)
  mutationsRef.current = mutations
  const pageRef = React.useRef(page)
  pageRef.current = page

  const src = React.useMemo(() => {
    const base = `/editor-frame/pages/${encodeURIComponent(String(pageId))}`
    if (!tenantSlug) return base
    const query = new URLSearchParams({ tenantSlug })
    return `${base}?${query.toString()}`
  }, [pageId, tenantSlug])

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    const target = frameRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }, [])

  React.useEffect(() => {
    setReady(false)
    setFrameError(null)
    setLoadState("loading")
    revisionRef.current = 0
    onFrameDocument?.(null)
  }, [onFrameDocument, src, retryKey])

  React.useLayoutEffect(() => {
    const measure = () => setParentChromeBottom(measureParentChromeBottom())
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [])

  React.useEffect(() => {
    if (!ready) {
      onFrameDocument?.(null)
      return
    }
    onFrameDocument?.(frameRef.current?.contentDocument ?? null)
    return () => onFrameDocument?.(null)
  }, [onFrameDocument, ready, retryKey, src])

  React.useEffect(() => {
    if (ready) {
      setLoadState("ready")
      return
    }
    const timeout = window.setTimeout(() => {
      setLoadState("failed")
      setFrameError("The editor frame did not finish loading. Retry the frame.")
    }, 8000)
    return () => window.clearTimeout(timeout)
  }, [ready, retryKey, src])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      const parsed = validateIframeEditorMessage(event.data)
      if (!parsed.ok) return
      const message = parsed.message

      if (message.type === "chrome.select") {
        const zone = message.selection?.fieldPath?.[1]
        if (zone === "header" || zone === "footer") {
          const iframeEl = frameRef.current
          const point = iframeEl
            ? (() => {
                const rect = iframeEl.getBoundingClientRect()
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              })()
            : undefined
          onChromeSelectRef.current?.(zone, point)
        }
        return
      }

      if (message.type === "geometry.changed") {
        const iframeEl = frameRef.current
        if (!iframeEl) return
        const iframeRect = iframeEl.getBoundingClientRect()
        for (const block of message.blocks) {
          if (block.blockId === "chrome:header" || block.blockId === "chrome:footer") {
            const zone = block.blockId === "chrome:header" ? "header" : "footer"
            onChromeGeometryRef.current?.(zone, {
              x: iframeRect.left + block.rect.x,
              y: iframeRect.top + block.rect.y,
              width: block.rect.width,
              height: block.rect.height,
            })
          }
        }
        return
      }

      if (message.type === "renderer.ready") {
        setReady(true)
        setLoadState("ready")
        setFrameError(null)
        return
      }

      if (message.type === "selection.changed") {
        onSelectionChangedRef.current?.(message.selection)
        return
      }

      if (message.type === "block.patch" && mutationsRef.current?.onBlockPatch) {
        mutationsRef.current.onBlockPatch({ blockId: message.blockId, patch: message.patch })
        return
      }

      if (message.type === "blocks.insert" && mutationsRef.current?.onBlocksInsert) {
        mutationsRef.current.onBlocksInsert({
          block: message.block,
          index: message.index,
          beforeBlockId: message.beforeBlockId,
          afterBlockId: message.afterBlockId,
        })
        return
      }

      if (message.type === "blocks.delete" && mutationsRef.current?.onBlocksDelete) {
        mutationsRef.current.onBlocksDelete({ blockId: message.blockId })
        return
      }

      if (message.type === "blocks.reorder" && mutationsRef.current?.onBlocksReorder) {
        mutationsRef.current.onBlocksReorder({ blockIds: message.blockIds })
        return
      }

      if (message.type === "field.commit" && mutationsRef.current?.onFieldCommit) {
        mutationsRef.current.onFieldCommit({
          blockId: message.blockId,
          fieldPath: message.fieldPath,
          value: message.value,
        })
        return
      }

      if (message.type === "edit.start" && message.mode === "settings") {
        const index = findBlockIndexByWireId(pageRef.current.blocks ?? [], message.blockId)
        if (index >= 0) onOpenBlockInspectorRef.current?.(index)
        return
      }

      if (message.type === "error") {
        setFrameError(message.message)
        if (message.recoverable !== false) setLoadState("failed")
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  React.useEffect(() => {
    if (!ready) return
    const expectedRevision = revisionRef.current
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "page.replace",
      messageId: `page-${expectedRevision}`,
      expectedRevision,
      pageId: String(pageId),
      page,
      settings,
      theme,
    })
    revisionRef.current = expectedRevision + 1
  }, [page, pageId, postToFrame, ready, settings, theme])

  React.useEffect(() => {
    if (!ready) return
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "theme.patch",
      messageId: `theme-${revisionRef.current}-${Date.now()}`,
      expectedRevision: revisionRef.current,
      theme,
    })
  }, [postToFrame, ready, theme])

  React.useEffect(() => {
    if (!ready) return
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "selection.set",
      messageId: `selection-set-${String(pageId)}-${selection?.blockId ?? selection?.fieldPath?.join(".") ?? "none"}`,
      selection: selection ?? null,
    })
  }, [pageId, postToFrame, ready, selection])

  React.useEffect(() => {
    if (!ready) return
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "editor.view.set",
      messageId: `editor-view-${view}`,
      view,
    })
  }, [postToFrame, ready, view])

  return (
    <div
      className="relative w-full"
      data-siab-editor-frame-host
      data-siab-editor-frame-view={view}
      data-siab-editor-frame-layout={layout}
    >
      {iframeChromeInset.styleElement}
      <iframe
        key={`${src}:${retryKey}`}
        ref={frameRef}
        src={src}
        title="Page editor"
        className={cn(
          iframeChromeInset.className,
          "block w-full border-0 bg-transparent",
          layout === "mobile"
            ? "min-h-[calc(100dvh-4.5rem)] h-[calc(100dvh-4.5rem)]"
            : cn("min-h-[640px]", view === "sidebar" ? "h-[calc(100dvh-6.5rem)]" : "h-[calc(100dvh-9rem)]"),
        )}
        sandbox="allow-same-origin allow-scripts allow-forms"
        data-siab-editor-frame
        data-tenant-id={String(tenantId)}
        onLoad={() => {
          if (!ready) setLoadState("loading")
        }}
        onError={() => {
          setLoadState("failed")
          setFrameError("The editor frame failed to load.")
        }}
      />
      {loadState !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/85 px-4 text-center">
          <div className="max-w-sm rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
            <p className="text-sm font-medium">
              {loadState === "failed" ? "Editor frame failed to load" : "Loading editor frame"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {loadState === "failed"
                ? frameError ?? "The iframe did not report readiness."
                : "Waiting for the renderer to become ready."}
            </p>
            {loadState === "failed" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs"
                onClick={() => {
                  setFrameError(null)
                  setReady(false)
                  setLoadState("loading")
                  revisionRef.current = 0
                  setRetryKey((current) => current + 1)
                }}
              >
                Retry frame
              </Button>
            )}
          </div>
        </div>
      )}
      {frameError && loadState === "ready" && (
        <div
          role="alert"
          className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
        >
          {frameError}
        </div>
      )}
    </div>
  )
}
