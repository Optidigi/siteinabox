"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorMobileMode,
  type IframeEditorRevisionedMessageBase,
  type IframeEditorSelection,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { SitePageRenderer, applyThemeAttributes, createRendererMediaResolver, resolveTenantRenderer } from "@siteinabox/site-renderer"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { FrameCanvasSurface } from "@/components/editor-frame/FrameCanvasSurface"
import type { PageEditorFrameView } from "@/components/editor/iframe/PageEditorFrameHost"
import type { RtManifest } from "@/lib/richText/manifest"

const HEADER_CHROME_SELECTOR = '[data-site-chrome="header"], [data-siab-site-header], .site-header, header.site-chrome, [data-amicare-nav]'
const FOOTER_CHROME_SELECTOR = '[data-site-chrome="footer"], [data-siab-site-footer], .site-footer, footer.site-chrome'

export function EditorFrameRuntime({
  page,
  settings,
  theme,
  tenantId,
  tenantSlug,
  domain,
  manifest,
  tenantCss,
  initialView,
  initialMobileMode,
}: {
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
  manifest: RtManifest
  tenantCss: string | null
  initialView?: PageEditorFrameView | null
  initialMobileMode?: IframeEditorMobileMode | null
}) {
  const cspNonce = useCspNonce()
  const [framePage, setFramePage] = React.useState(page)
  const [frameSettings, setFrameSettings] = React.useState(settings)
  const frameThemeRef = React.useRef(theme)
  const themeCleanupRef = React.useRef<(() => void) | null>(null)
  const [activeSelection, setActiveSelection] = React.useState<IframeEditorSelection | null>(null)
  const [frameView, setFrameView] = React.useState<PageEditorFrameView | null>(initialView ?? null)
  const [mobileMode, setMobileMode] = React.useState<IframeEditorMobileMode>(initialMobileMode ?? { mode: "fullPage" })
  const [revision, setRevision] = React.useState(0)
  const revisionRef = React.useRef(0)
  const frameViewRef = React.useRef(frameView)
  const receivedParentCommandRef = React.useRef(false)
  frameViewRef.current = frameView
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])
  const effectiveTenantCss = React.useMemo(() => {
    if (resolveTenantRenderer({ tenantSlug, domain })) return null
    return tenantCss
  }, [tenantCss, tenantSlug, domain])
  const emit = React.useCallback((payload: IframeEditorMessage) => {
    window.parent?.postMessage(payload, window.location.origin)
  }, [])

  const bumpRevision = React.useCallback(() => {
    revisionRef.current += 1
    setRevision(revisionRef.current)
  }, [])

  React.useEffect(() => {
    setFramePage(page)
  }, [page])

  React.useEffect(() => {
    setFrameSettings(settings)
  }, [settings])

  const patchTheme = React.useCallback((nextTheme: ThemeTokenSpec | null) => {
    frameThemeRef.current = nextTheme
    themeCleanupRef.current?.()
    themeCleanupRef.current = applyThemeAttributes(document, nextTheme)
  }, [])

  React.useEffect(() => {
    patchTheme(theme)
    return () => themeCleanupRef.current?.()
  }, [patchTheme, theme])

  React.useEffect(() => {
    receivedParentCommandRef.current = false
    const emitReady = () => {
      emit({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "renderer.ready",
        messageId: "editor-renderer-ready",
        rendererId: "cms-editor-frame",
        revision: revisionRef.current,
        pageId: String(page.id ?? page.slug ?? "page"),
        capabilities: {
          selection: true,
          fieldEditing: frameViewRef.current === "canvas",
          assetPicking: frameViewRef.current === "canvas",
          viewportResize: false,
        },
      })
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) return

      receivedParentCommandRef.current = true
      const message = parsed.message

      if (message.type === "selection.set") {
        setActiveSelection(message.selection)
        return
      }

      if (message.type === "editor.view.set") {
        setFrameView(message.view)
        return
      }

      if (message.type === "editor.mobileMode.set") {
        setMobileMode({
          mode: message.mode,
          focusedBlockId: message.focusedBlockId,
          focusedBlockIndex: message.focusedBlockIndex,
          showChrome: message.showChrome,
          showGutters: message.showGutters,
          allowInlineEditing: message.allowInlineEditing,
        })
        return
      }

      if (!("expectedRevision" in message)) return

      const revisioned = message as IframeEditorMessage & IframeEditorRevisionedMessageBase<"page.replace" | "theme.patch">

      if (revisioned.type === "theme.patch") {
        patchTheme(revisioned.theme)
        return
      }

      if (revisioned.type === "page.replace") {
        if ("theme" in revisioned) patchTheme(revisioned.theme ?? null)
        if (revisioned.expectedRevision < revisionRef.current) return
        setFramePage(revisioned.page)
        if (revisioned.settings) setFrameSettings(revisioned.settings)
        revisionRef.current = revisioned.expectedRevision + 1
        setRevision(revisionRef.current)
      }
    }

    window.addEventListener("message", onMessage)
    emitReady()
    const readyInterval = window.setInterval(() => {
      if (!receivedParentCommandRef.current) emitReady()
    }, 500)

    return () => {
      window.clearInterval(readyInterval)
      window.removeEventListener("message", onMessage)
    }
  }, [emit, page.id, page.slug, patchTheme])

  React.useEffect(() => {
    const pageId = String(framePage.id ?? framePage.slug ?? "page")

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return

      const linkTarget = target.closest("a[href]")
      if (linkTarget) event.preventDefault()

      const headerNode = target.closest<HTMLElement>(HEADER_CHROME_SELECTOR)
      const footerNode = target.closest<HTMLElement>(FOOTER_CHROME_SELECTOR)
      if (headerNode || footerNode) {
        const zone: "header" | "footer" = headerNode ? "header" : "footer"
        const chromeNode = (headerNode ?? footerNode) as HTMLElement
        emit({
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "chrome.select",
          messageId: `chrome-select-${pageId}-${zone}`,
          selection: { pageId, fieldPath: ["chrome", zone] },
          point: { x: event.clientX, y: event.clientY },
        })
        const rect = chromeNode.getBoundingClientRect()
        emit({
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "geometry.changed",
          messageId: `chrome-geometry-${pageId}-${zone}`,
          pageId,
          revision: revisionRef.current,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
          },
          blocks: [{
            blockId: `chrome:${zone}`,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          }],
        })
        return
      }

      // Once the frame knows its view, block selection is owned by
      // `FrameCanvasSurface`/`CanvasSurface` (click handlers wired through
      // `CanvasSelectionProvider`) — this raw DOM listener only needs to
      // keep handling chrome (header/footer), which CanvasSurface doesn't
      // know how to select.
      if (frameView) return

      const blockNode = target.closest("[data-block-index]")
      if (!blockNode) return

      const rawBlockIndex = blockNode.getAttribute("data-block-index")
      if (!rawBlockIndex) return

      const blockIndex = Number.parseInt(rawBlockIndex, 10)
      if (!Number.isFinite(blockIndex) || blockIndex < 0) return

      const explicitBlockId = blockNode.getAttribute("data-block-id")
      const pageBlock = framePage.blocks?.[blockIndex]
      const fallbackBlockId =
        pageBlock && typeof pageBlock === "object" && "id" in pageBlock && typeof pageBlock.id === "string"
          ? pageBlock.id
          : undefined
      const blockId = explicitBlockId || fallbackBlockId
      const selection = blockId
        ? { pageId, blockId, fieldPath: ["blocks", String(blockIndex)] as const }
        : { pageId, fieldPath: ["blocks", String(blockIndex)] as const }

      emit({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "selection.changed",
        messageId: `selection-${pageId}-${blockIndex}`,
        selection,
      })
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [emit, framePage, frameView])

  React.useEffect(() => {
    if (frameView) return

    document.querySelectorAll("[data-siab-editor-selected]").forEach((node) => {
      node.removeAttribute("data-siab-editor-selected")
    })
    if (!activeSelection) return

    const blockIndex = activeSelection.fieldPath?.[0] === "blocks"
      ? activeSelection.fieldPath[1]
      : undefined
    const blockNode =
      (activeSelection.blockId
        ? document.querySelector(`[data-block-id="${CSS.escape(activeSelection.blockId)}"]`)
        : null) ??
      (blockIndex != null
        ? document.querySelector(`[data-block-index="${CSS.escape(String(blockIndex))}"]`)
        : null)

    if (!(blockNode instanceof HTMLElement)) return
    blockNode.setAttribute("data-siab-editor-selected", "true")
    blockNode.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeSelection, frameView, framePage])

  if (frameView) {
    return (
      <FrameCanvasSurface
        manifest={manifest}
        tenantCss={effectiveTenantCss}
        view={frameView}
        page={framePage}
        settings={frameSettings}
        theme={frameThemeRef.current}
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        domain={domain}
        selection={activeSelection}
        mobileMode={mobileMode}
        revision={revision}
        emit={emit}
      />
    )
  }

  return (
    <>
      {effectiveTenantCss && (
        <style nonce={cspNonce} suppressHydrationWarning data-rt-tenant-css dangerouslySetInnerHTML={{ __html: effectiveTenantCss }} />
      )}
      <SitePageRenderer
        page={framePage}
        settings={frameSettings}
        theme={frameThemeRef.current}
        tenantSlug={tenantSlug}
        domain={domain}
        mediaResolver={mediaResolver}
        nonce={cspNonce}
        includeBehaviorScripts={false}
        formAction="#"
      />
    </>
  )
}
