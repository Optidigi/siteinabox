"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { ThemeTokenSpecSchema } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
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
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve()
  return new Promise((resolve) => window.addEventListener("load", () => resolve(), { once: true }))
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

export function RendererFrameRuntime({
  page,
  settings,
  theme,
  tenantId,
  tenantSlug,
  domain,
  mode = "preview",
}: {
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
  mode?: "preview" | "editor"
}) {
  const [framePage, setFramePage] = React.useState(page)
  const [frameSettings, setFrameSettings] = React.useState(settings)
  const [frameTheme, setFrameTheme] = React.useState(theme)
  const cspNonce = useCspNonce()
  const revisionRef = React.useRef(0)
  const themeCleanupRef = React.useRef<(() => void) | null>(null)
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])
  const variantKey = framePage.blocks.map((block) => `${block.blockType}:${block.designVariant ?? ""}`).join("|")
  const [prepared, setPrepared] = React.useState<{ key: string; renderer: PreparedClientSiteRenderer } | null>(null)
  const [prepareError, setPrepareError] = React.useState<string | null>(null)
  const [hostViewportHeight, setHostViewportHeight] = React.useState<number | null>(null)
  const previewViewportRule = useCspStyleRule(
    "renderer-frame-preview-viewport",
    mode === "preview" && hostViewportHeight != null
      ? `--siab-preview-viewport-height:${formatCssPx(hostViewportHeight)};`
      : null,
  )

  const patchTheme = React.useCallback((nextTheme: ThemeTokenSpec | null) => {
    setFrameTheme(nextTheme)
    themeCleanupRef.current?.()
    themeCleanupRef.current = applyThemeAttributes(document, nextTheme)
  }, [])

  React.useEffect(() => {
    patchTheme(theme)
    return () => themeCleanupRef.current?.()
  }, [patchTheme, theme])

  React.useLayoutEffect(() => {
    if (!prepared || prepared.key !== variantKey) return
    themeCleanupRef.current?.()
    themeCleanupRef.current = applyThemeAttributes(document, frameTheme)
  }, [frameTheme, prepared, variantKey])

  React.useLayoutEffect(() => {
    if (mode !== "preview") return
    let hostWindow: Window = window
    try {
      if (window.parent && window.parent !== window) hostWindow = window.parent
    } catch {
      hostWindow = window
    }
    const update = () => {
      const next = hostWindow.innerHeight
      setHostViewportHeight((current) => current === next ? current : next)
    }
    update()
    hostWindow.addEventListener("resize", update)
    return () => hostWindow.removeEventListener("resize", update)
  }, [mode])

  React.useEffect(() => {
    if (prepared?.key === variantKey) return
    let cancelled = false
    setPrepareError(null)
    void prepareClientSiteRenderer({ page: framePage, settings: frameSettings, tenantSlug, domain })
      .then((renderer) => {
        if (!cancelled) setPrepared({ key: variantKey, renderer })
      })
      .catch((error: unknown) => {
        if (!cancelled) setPrepareError(error instanceof Error ? error.message : "Renderer preparation failed.")
      })
    return () => { cancelled = true }
  }, [domain, framePage, frameSettings, prepared?.key, tenantSlug, variantKey])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== window.parent) return
      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) {
        // Theme-only recovery when the full snapshot fails validation — keeps
        // preview token bridge live without relaxing the page/settings contract.
        const raw = event.data
        if (
          raw
          && typeof raw === "object"
          && (raw as { protocol?: unknown }).protocol === IFRAME_EDITOR_PROTOCOL_NAME
          && (raw as { schemaVersion?: unknown }).schemaVersion === IFRAME_EDITOR_PROTOCOL_VERSION
          && (raw as { type?: unknown }).type === "render.snapshot"
        ) {
          const themeParsed = ThemeTokenSpecSchema.nullable().safeParse((raw as { theme?: unknown }).theme)
          if (themeParsed.success) {
            patchTheme(themeParsed.data)
            const expected = (raw as { expectedRevision?: unknown }).expectedRevision
            if (typeof expected === "number" && Number.isFinite(expected) && expected >= revisionRef.current) {
              revisionRef.current = expected + 1
            }
          }
        }
        return
      }
      const message = parsed.message

      // Preview runtime only accepts atomic render snapshots from the host.
      // Editor interaction (selection, mobile projection) stays on editor-frame.
      if (mode === "preview" && message.type !== "render.snapshot") return

      if (message.type === "render.snapshot") {
        patchTheme(message.theme)
        setFramePage(message.page)
        setFrameSettings(message.settings)
        revisionRef.current = message.expectedRevision + 1
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [mode, patchTheme])

  React.useEffect(() => {
    if (!prepareError) return
    window.parent?.postMessage({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "error",
      messageId: "renderer-prepare-error",
      code: "renderer_prepare_failed",
      message: prepareError,
    } satisfies IframeEditorMessage, window.location.origin)
  }, [prepareError])

  React.useEffect(() => {
    if (!prepared || prepared.key !== variantKey) return
    let cancelled = false
    void (async () => {
      await waitForWindowLoad()
      await document.fonts?.ready
      await nextFrame()
      await nextFrame()
      if (cancelled) return
      window.parent?.postMessage({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "renderer.ready",
        messageId: "renderer-ready",
        rendererId: "cms-preview-frame",
        pageId: String(page.id ?? page.slug ?? "page"),
      } satisfies IframeEditorMessage, window.location.origin)
    })()
    return () => { cancelled = true }
  }, [page.id, page.slug, prepared, variantKey])

  React.useEffect(() => {
    if (mode !== "preview") return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!target || target.hasAttribute("download")) return
      const rawHref = target.getAttribute("href")?.trim()
      if (!rawHref || rawHref.startsWith("#") || /^(?:mailto|tel):/i.test(rawHref)) return
      const destination = new URL(rawHref, window.location.href)
      if (destination.origin !== window.location.origin) return
      event.preventDefault()
      window.parent?.postMessage({
        protocol: IFRAME_EDITOR_PROTOCOL_NAME,
        schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
        type: "navigation.requested",
        messageId: `navigation-${Date.now()}`,
        href: `${destination.pathname}${destination.search}${destination.hash}`,
        reason: "linkClick",
      } satisfies IframeEditorMessage, window.location.origin)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [mode])

  return (
    <>
      {previewViewportRule.styleElement}
      <div
        className={previewViewportRule.className}
        data-siab-preview-viewport={mode === "preview" ? "true" : undefined}
      >
        {prepared?.key === variantKey ? (
          <ClientSitePageRenderer
            prepared={prepared.renderer}
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
        ) : null}
      </div>
    </>
  )
}
