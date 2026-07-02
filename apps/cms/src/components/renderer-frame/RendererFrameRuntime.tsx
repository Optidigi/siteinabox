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
  const revisionRef = React.useRef(0)
  const mediaResolver = React.useMemo(() => createRendererMediaResolver(String(tenantId)), [tenantId])

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
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!target) return
      event.preventDefault()
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [mode])

  return (
    <SitePageRenderer
      page={framePage}
      settings={frameSettings}
      theme={frameTheme}
      tenantSlug={tenantSlug}
      domain={domain}
      mediaResolver={mediaResolver}
      includeBehaviorScripts={false}
      formAction="#"
    />
  )
}
