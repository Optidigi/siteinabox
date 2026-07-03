"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorRevisionedMessageBase,
  type IframeEditorSelection,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { SitePageRenderer, createRendererMediaResolver, resolveLegacyTenant } from "@siteinabox/site-renderer"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { FrameCanvasSurface } from "@/components/editor-frame/FrameCanvasSurface"
import type { PageEditorFrameView } from "@/components/editor/iframe/PageEditorFrameHost"
import type { RtManifest } from "@/lib/richText/manifest"

const HEADER_CHROME_SELECTOR = "[data-siab-site-header], .site-header, header.site-chrome, [data-amicare-nav]"
const FOOTER_CHROME_SELECTOR = "[data-siab-site-footer], .site-footer, footer.site-chrome"

export function EditorFrameRuntime({
  page,
  settings,
  theme,
  tenantId,
  tenantSlug,
  domain,
  manifest,
  tenantCss,
}: {
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
  manifest: RtManifest
  tenantCss: string | null
}) {
  const cspNonce = useCspNonce()
  const [framePage, setFramePage] = React.useState(page)
  const [frameSettings, setFrameSettings] = React.useState(settings)
  const [frameTheme, setFrameTheme] = React.useState(theme)
  const [activeSelection, setActiveSelection] = React.useState<IframeEditorSelection | null>(null)
  const [frameView, setFrameView] = React.useState<PageEditorFrameView | null>(null)
  const [revision, setRevision] = React.useState(0)
  const revisionRef = React.useRef(0)
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])
  const effectiveTenantCss = React.useMemo(() => {
    if (resolveLegacyTenant({ tenantSlug, domain })) return null
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

  React.useEffect(() => {
    setFrameTheme(theme)
  }, [theme])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) return

      const message = parsed.message

      if (message.type === "selection.set") {
        setActiveSelection(message.selection)
        return
      }

      if (message.type === "editor.view.set") {
        setFrameView(message.view)
        return
      }

      if (!("expectedRevision" in message)) return

      const revisioned = message as IframeEditorMessage & IframeEditorRevisionedMessageBase<"page.replace" | "theme.patch">

      if (revisioned.type === "theme.patch") {
        setFrameTheme(revisioned.theme)
        return
      }

      if (revisioned.type === "page.replace") {
        if ("theme" in revisioned) setFrameTheme(revisioned.theme ?? null)
        if (revisioned.expectedRevision < revisionRef.current) return
        setFramePage(revisioned.page)
        if (revisioned.settings) setFrameSettings(revisioned.settings)
        revisionRef.current = revisioned.expectedRevision + 1
        setRevision(revisionRef.current)
      }
    }

    window.addEventListener("message", onMessage)
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
        fieldEditing: frameView === "canvas",
        assetPicking: frameView === "canvas",
        viewportResize: false,
      },
    })

    return () => window.removeEventListener("message", onMessage)
  }, [bumpRevision, emit, page.id, page.slug])

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
        theme={frameTheme}
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        domain={domain}
        selection={activeSelection}
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
        theme={frameTheme}
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
