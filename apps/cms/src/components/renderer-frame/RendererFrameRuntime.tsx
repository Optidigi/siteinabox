"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { SitePageRenderer, createRendererMediaResolver } from "@siteinabox/site-renderer"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"

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
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])
  const [hostViewportHeight, setHostViewportHeight] = React.useState<number | null>(null)
  const previewViewportRule = useCspStyleRule(
    "renderer-frame-preview-viewport",
    mode === "preview" && hostViewportHeight != null
      ? `--siab-preview-viewport-height:${formatCssPx(hostViewportHeight)};`
      : null,
  )

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
    const emit = (payload: IframeEditorMessage) => {
      window.parent?.postMessage(payload, window.location.origin)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const parsed = validateIframeEditorMessage(event.data, { currentRevision: revisionRef.current })
      if (!parsed.ok) return
      const message = parsed.message

      if (mode === "preview" && message.type !== "page.replace" && message.type !== "theme.patch") return
      if (!("expectedRevision" in message)) return

      if (message.type === "theme.patch") {
        setFrameTheme(message.theme)
        revisionRef.current += 1
        return
      }

      if (message.type === "page.replace") {
        setFramePage(message.page)
        if (message.settings) setFrameSettings(message.settings)
        if ("theme" in message) setFrameTheme(message.theme ?? null)
        revisionRef.current += 1
      }
    }

    window.addEventListener("message", onMessage)
    emit({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "renderer.ready",
      messageId: "renderer-ready",
      rendererId: "cms-preview-frame",
      revision: revisionRef.current,
      pageId: String(page.id ?? page.slug ?? "page"),
      capabilities: {
        selection: false,
        fieldEditing: false,
        assetPicking: false,
        viewportResize: false,
      },
    })
    return () => window.removeEventListener("message", onMessage)
  }, [mode, page.id, page.slug])

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
      </div>
    </>
  )
}
