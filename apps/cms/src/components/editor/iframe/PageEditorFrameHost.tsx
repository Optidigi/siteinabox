"use client"

import * as React from "react"
import type { Page, SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorMobileMode,
  type IframeEditorSelection,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export type PageEditorFrameLayout = "desktop" | "mobile"

const PAGE_SNAPSHOT_DEBOUNCE_MS = 80

function selectionIdentity(selection: IframeEditorSelection | null | undefined): string {
  if (!selection) return ""
  return `${selection.pageId ?? ""}|${selection.blockId ?? ""}|${(selection.fieldPath ?? []).join(".")}`
}

export function PageEditorFrameHost({
  pageId,
  page,
  settings,
  theme,
  layout = "desktop",
  mobileMode,
  tenantId,
  tenantSlug,
  selection,
  onSelectionChanged,
  onChromeSelect,
}: {
  pageId: string | number
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  layout?: PageEditorFrameLayout
  mobileMode?: IframeEditorMobileMode
  tenantId: string | number
  tenantSlug?: string | null
  selection?: IframeEditorSelection | null
  onSelectionChanged?: (selection: IframeEditorSelection | null) => void
  onChromeSelect?: (zone: "header" | "footer" | "banner") => void
}) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const revisionRef = React.useRef(0)
  const [ready, setReady] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [frameError, setFrameError] = React.useState<string | null>(null)
  const [frameHeight, setFrameHeight] = React.useState<number | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)
  const readyRef = React.useRef(false)
  const onSelectionChangedRef = React.useRef(onSelectionChanged)
  const onChromeSelectRef = React.useRef(onChromeSelect)
  onSelectionChangedRef.current = onSelectionChanged
  onChromeSelectRef.current = onChromeSelect

  const src = React.useMemo(() => {
    const base = `/editor-frame/pages/${encodeURIComponent(String(pageId))}`
    const query = new URLSearchParams()
    if (tenantSlug) query.set("tenantSlug", tenantSlug)
    if (mobileMode) {
      query.set("mobileMode", mobileMode.mode)
      if (mobileMode.focusedBlockId) query.set("focusedBlockId", mobileMode.focusedBlockId)
      if (mobileMode.focusedBlockIndex != null) query.set("focusedBlockIndex", String(mobileMode.focusedBlockIndex))
      if (mobileMode.showChrome != null) query.set("showChrome", String(mobileMode.showChrome))
    }
    return query.size ? `${base}?${query.toString()}` : base
  }, [mobileMode, pageId, tenantSlug])

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    frameRef.current?.contentWindow?.postMessage(payload, window.location.origin)
  }, [])

  React.useEffect(() => {
    readyRef.current = false
    setReady(false)
    setFailed(false)
    setFrameError(null)
    setFrameHeight(null)
    revisionRef.current = 0
  }, [retryKey, src])

  React.useEffect(() => {
    if (ready) return
    const timeout = window.setTimeout(() => {
      setFailed(true)
      setFrameError(t("editorFrameTimeout"))
    }, 12_000)
    return () => window.clearTimeout(timeout)
  }, [ready, retryKey, src, t])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const parsed = validateIframeEditorMessage(event.data)
      if (!parsed.ok) return
      const message = parsed.message

      if (message.type === "renderer.ready") {
        // Resync host revision on the false→true ready transition so a remounted
        // iframe is not stuck rejecting theme/page snapshots.
        if (!readyRef.current) {
          revisionRef.current = 0
          readyRef.current = true
          setReady(true)
        }
        setFailed(false)
        setFrameError(null)
        return
      }
      if (message.type === "renderer.height") {
        setFrameHeight(message.height)
        return
      }
      if (message.type === "selection.changed") {
        onSelectionChangedRef.current?.(message.selection)
        return
      }
      if (message.type === "chrome.select") {
        const zone = message.selection?.fieldPath?.[1]
        if (zone === "header" || zone === "footer" || zone === "banner") onChromeSelectRef.current?.(zone)
        return
      }
      if (message.type === "error") {
        setFrameError(message.message)
        setFailed(true)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const themeKey = React.useMemo(() => JSON.stringify(theme ?? null), [theme])
  const settingsKey = React.useMemo(() => JSON.stringify(settings ?? null), [settings])
  const mobileModeKey = React.useMemo(() => JSON.stringify(mobileMode ?? null), [mobileMode])
  const selectionKeyValue = React.useMemo(() => selectionIdentity(selection), [selection])
  const pageKey = React.useMemo(() => JSON.stringify(page ?? null), [page])

  const latestSnapshotRef = React.useRef({
    page,
    settings,
    theme,
    selection: selection ?? null,
    mobileMode: mobileMode ?? { mode: "fullPage" as const },
    pageId: String(pageId),
  })
  latestSnapshotRef.current = {
    page,
    settings,
    theme,
    selection: selection ?? null,
    mobileMode: mobileMode ?? { mode: "fullPage" },
    pageId: String(pageId),
  }

  const postSnapshot = React.useCallback(() => {
    if (!readyRef.current) return
    const expectedRevision = revisionRef.current
    const snap = latestSnapshotRef.current
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "render.snapshot",
      messageId: `snapshot-${expectedRevision}`,
      expectedRevision,
      pageId: snap.pageId,
      page: snap.page,
      settings: snap.settings,
      theme: snap.theme,
      selection: snap.selection,
      mobileMode: snap.mobileMode,
    })
    revisionRef.current = expectedRevision + 1
  }, [postToFrame])

  // Immediate flush: theme / chrome settings / selection / mobile mode / first ready.
  React.useEffect(() => {
    if (!ready) return
    postSnapshot()
  }, [mobileModeKey, postSnapshot, ready, selectionKeyValue, settingsKey, themeKey])

  // Debounced page body updates (typing / RT) so keystrokes do not flood the iframe.
  // Skip the ready transition — the immediate effect already posts a full snapshot.
  const pageDebounceArmedRef = React.useRef(false)
  React.useEffect(() => {
    if (!ready) {
      pageDebounceArmedRef.current = false
      return
    }
    if (!pageDebounceArmedRef.current) {
      pageDebounceArmedRef.current = true
      return
    }
    const timer = window.setTimeout(() => {
      postSnapshot()
    }, PAGE_SNAPSHOT_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [pageKey, pageId, postSnapshot, ready])

  return (
    <div className="relative w-full overflow-hidden bg-background" data-siab-editor-frame-host data-siab-editor-frame-layout={layout}>
      <iframe
        key={`${src}:${retryKey}`}
        ref={frameRef}
        src={src}
        title={t("pageEditorFrameTitle")}
        className={cn(
          "block w-full border-0 bg-transparent transition-opacity duration-150",
          ready ? "opacity-100" : "pointer-events-none opacity-0",
          layout === "mobile" ? "min-h-[32rem]" : "min-h-[640px]",
        )}
        height={frameHeight ?? (layout === "mobile" ? 512 : 640)}
        scrolling="no"
        data-siab-editor-frame
        data-tenant-id={String(tenantId)}
        onError={() => {
          setFailed(true)
          setFrameError(t("editorFrameLoadFailedDescription"))
        }}
      />
      {!ready && (
        <div className="absolute inset-0 bg-background p-4" aria-live="polite">
          {!failed ? (
            <div className="space-y-4 animate-pulse" aria-label={t("editorFrameLoading")}>
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-72 rounded-lg bg-muted" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-40 rounded-lg bg-muted" />
                <div className="h-40 rounded-lg bg-muted" />
                <div className="h-40 rounded-lg bg-muted" />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div className="max-w-sm rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
                <p className="text-sm font-medium">{t("editorFrameLoadFailed")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{frameError ?? t("editorFrameNotReady")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 text-xs"
                  onClick={() => setRetryKey((current) => current + 1)}
                >
                  {tCommon("retry")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {frameError && ready && (
        <div role="alert" className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {frameError}
        </div>
      )}
    </div>
  )
}
