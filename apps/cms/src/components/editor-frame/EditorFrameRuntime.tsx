"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorMobileMode,
  type IframeEditorSelection,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import {
  ClientSitePageRenderer,
  applyThemeAttributes,
  createRendererMediaResolver,
  prepareClientSiteRenderer,
  type PreparedClientSiteRenderer,
} from "@siteinabox/site-renderer"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"

const HEADER_CHROME_SELECTOR = '[data-site-chrome="header"], [data-siab-site-header], .site-header, header.site-chrome, [data-amicare-nav]'
const FOOTER_CHROME_SELECTOR = '[data-site-chrome="footer"], [data-siab-site-footer], .site-footer, footer.site-chrome'

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve()
  return new Promise((resolve) => window.addEventListener("load", () => resolve(), { once: true }))
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

export function EditorFrameRuntime({
  page,
  settings,
  theme,
  tenantId,
  tenantSlug,
  domain,
  initialMobileMode,
}: {
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
  initialMobileMode?: IframeEditorMobileMode | null
}) {
  const cspNonce = useCspNonce()
  const [framePage, setFramePage] = React.useState(page)
  const [frameSettings, setFrameSettings] = React.useState(settings)
  const [frameTheme, setFrameTheme] = React.useState(theme)
  const [activeSelection, setActiveSelection] = React.useState<IframeEditorSelection | null>(null)
  const [mobileMode, setMobileMode] = React.useState<IframeEditorMobileMode>(initialMobileMode ?? { mode: "fullPage" })
  const revisionRef = React.useRef(0)
  const receivedParentCommandRef = React.useRef(false)
  const themeCleanupRef = React.useRef<(() => void) | null>(null)
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])
  const variantKey = framePage.blocks.map((block) => `${block.blockType}:${block.designVariant ?? ""}`).join("|")
  const [prepared, setPrepared] = React.useState<{ key: string; renderer: PreparedClientSiteRenderer } | null>(null)

  const emit = React.useCallback((payload: IframeEditorMessage) => {
    window.parent?.postMessage(payload, window.location.origin)
  }, [])

  const patchTheme = React.useCallback((nextTheme: ThemeTokenSpec | null) => {
    setFrameTheme(nextTheme)
    themeCleanupRef.current?.()
    themeCleanupRef.current = applyThemeAttributes(document, nextTheme)
  }, [])

  React.useEffect(() => setFramePage(page), [page])
  React.useEffect(() => setFrameSettings(settings), [settings])

  React.useEffect(() => {
    patchTheme(theme)
    return () => themeCleanupRef.current?.()
  }, [patchTheme, theme])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== window.parent) return
      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) return

      receivedParentCommandRef.current = true
      const message = parsed.message

      if (message.type === "selection.set") {
        setActiveSelection(message.selection)
        return
      }
      if (message.type === "editor.mobileMode.set") {
        setMobileMode({
          mode: message.mode,
          focusedBlockId: message.focusedBlockId,
          focusedBlockIndex: message.focusedBlockIndex,
          showChrome: message.showChrome,
        })
        return
      }
      if (message.type === "theme.patch") {
        patchTheme(message.theme)
        return
      }
      if (message.type === "page.replace") {
        if ("theme" in message) patchTheme(message.theme ?? null)
        setFramePage(message.page)
        if (message.settings) setFrameSettings(message.settings)
        revisionRef.current = message.expectedRevision + 1
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [patchTheme])

  React.useEffect(() => {
    if (prepared?.key === variantKey) return
    let cancelled = false
    void prepareClientSiteRenderer({ page: framePage, settings: frameSettings, tenantSlug, domain })
      .then((renderer) => {
        if (!cancelled) setPrepared({ key: variantKey, renderer })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        emit({
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "error",
          messageId: "editor-renderer-prepare-error",
          code: "renderer_prepare_failed",
          message: error instanceof Error ? error.message : "Renderer preparation failed.",
        })
      })
    return () => { cancelled = true }
  }, [domain, emit, framePage, frameSettings, prepared?.key, tenantSlug, variantKey])

  React.useEffect(() => {
    if (!prepared || prepared.key !== variantKey) return
    let cancelled = false
    let readyInterval: number | undefined

    const emitReady = () => {
      emit({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "renderer.ready",
        messageId: "editor-renderer-ready",
        rendererId: "cms-editor-frame",
        pageId: String(page.id ?? page.slug ?? "page"),
      })
    }

    void (async () => {
      await waitForWindowLoad()
      await document.fonts?.ready
      await waitForAnimationFrame()
      await waitForAnimationFrame()
      if (cancelled) return
      emitReady()
      readyInterval = window.setInterval(() => {
        if (receivedParentCommandRef.current) {
          if (readyInterval != null) window.clearInterval(readyInterval)
          return
        }
        emitReady()
      }, 500)
    })()

    return () => {
      cancelled = true
      if (readyInterval != null) window.clearInterval(readyInterval)
    }
  }, [emit, page.id, page.slug, prepared, variantKey])

  React.useEffect(() => {
    const pageId = String(framePage.id ?? framePage.slug ?? "page")
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return

      if (target.closest("a[href], button, form")) event.preventDefault()

      const headerNode = target.closest<HTMLElement>(HEADER_CHROME_SELECTOR)
      const footerNode = target.closest<HTMLElement>(FOOTER_CHROME_SELECTOR)
      if (headerNode || footerNode) {
        const zone: "header" | "footer" = headerNode ? "header" : "footer"
        emit({
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "chrome.select",
          messageId: `chrome-select-${pageId}-${zone}`,
          selection: { pageId, fieldPath: ["chrome", zone] },
        })
        return
      }

      if (mobileMode.mode === "focusedSection") return
      const blockNode = target.closest<HTMLElement>("[data-block-index]")
      const rawBlockIndex = blockNode?.dataset.blockIndex
      if (rawBlockIndex == null) return
      const blockIndex = Number.parseInt(rawBlockIndex, 10)
      if (!Number.isInteger(blockIndex) || blockIndex < 0) return
      const pageBlock = framePage.blocks?.[blockIndex]
      const blockId = pageBlock && typeof pageBlock === "object" && "id" in pageBlock && typeof pageBlock.id === "string"
        ? pageBlock.id
        : undefined

      emit({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "selection.changed",
        messageId: `selection-${pageId}-${blockIndex}`,
        selection: {
          pageId,
          ...(blockId ? { blockId } : {}),
          fieldPath: ["blocks", String(blockIndex)],
        },
      })
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [emit, framePage, mobileMode.mode])

  React.useEffect(() => {
    document.querySelectorAll("[data-siab-editor-selected]").forEach((node) => {
      node.removeAttribute("data-siab-editor-selected")
    })
    if (!activeSelection || mobileMode.mode === "focusedSection") return
    const blockIndex = activeSelection.fieldPath?.[0] === "blocks" ? activeSelection.fieldPath[1] : undefined
    const blockNode = blockIndex == null
      ? null
      : document.querySelector(`[data-block-index="${CSS.escape(String(blockIndex))}"]`)
    if (!(blockNode instanceof HTMLElement)) return
    blockNode.setAttribute("data-siab-editor-selected", "true")
    blockNode.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeSelection, framePage, mobileMode.mode])

  const focusedBlock = mobileMode.mode === "focusedSection"
    ? framePage.blocks?.find((block, index) => {
        if (mobileMode.focusedBlockId && typeof block === "object" && block && "id" in block) {
          return block.id === mobileMode.focusedBlockId
        }
        return index === mobileMode.focusedBlockIndex
      })
    : undefined
  const visiblePage = focusedBlock
    ? { ...framePage, blocks: [focusedBlock] }
    : framePage
  const showChrome = mobileMode.showChrome !== false

  if (!prepared || prepared.key !== variantKey) return null

  return (
    <div data-siab-editor-frame-runtime>
      <ClientSitePageRenderer
        prepared={prepared.renderer}
        page={visiblePage}
        settings={frameSettings}
        theme={frameTheme}
        tenantSlug={tenantSlug}
        domain={domain}
        mediaResolver={mediaResolver}
        nonce={cspNonce}
        includeBehaviorScripts={false}
        formAction="#"
        banner={showChrome ? undefined : null}
        header={showChrome ? undefined : null}
        footer={showChrome ? undefined : null}
      />
    </div>
  )
}
