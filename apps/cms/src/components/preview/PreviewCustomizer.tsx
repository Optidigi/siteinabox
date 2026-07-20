"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { useTranslations } from "next-intl"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  validateIframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import { CheckCircle2, Rocket, SquarePen } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Separator } from "@siteinabox/ui/components/separator"
import { cn } from "@siteinabox/ui/lib/utils"
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { setPreviewTheme } from "@/lib/actions/previewCustomizer"
import type {
  PreviewApprovalState,
  PreviewCustomizerAccess,
  PreviewPageSummary,
  PreviewPaymentState,
} from "@/lib/preview/customizer"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizePreviewThemeForSave } from "@/lib/theme/normalizeTheme"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { PreviewDesktopThemeToolbar } from "@/components/preview/preview-desktop-theme-toolbar"
import { PreviewMobileChrome } from "@/components/preview/preview-mobile-chrome"
import { PREVIEW_THEME_TOOLBAR_CLOSE_EVENT } from "@/lib/preview/preview-theme-events"

export { PREVIEW_THEME_TOOLBAR_CLOSE_EVENT }

type PreviewThemeSaveStatus = "idle" | "saving" | "saved" | "error"
type QueuedPreviewThemeSave = {
  normalizedTheme: ThemeTokens | null
  serializedTheme: string
  version: number
  requiresWrite?: boolean
}

export function shouldApplyPreviewThemeSaveResponse({
  latestSerializedTheme,
  latestVersion,
  requestSerializedTheme,
  requestVersion,
}: {
  latestSerializedTheme: string
  latestVersion: number
  requestSerializedTheme: string
  requestVersion: number
}) {
  return requestVersion === latestVersion && requestSerializedTheme === latestSerializedTheme
}

export function shouldStartPreviewThemeSave({
  hasInFlightSave,
  pendingRequiresWrite = false,
  pendingSerializedTheme,
  persistedSerializedTheme,
}: {
  hasInFlightSave: boolean
  pendingRequiresWrite?: boolean
  pendingSerializedTheme: string | null
  persistedSerializedTheme: string
}) {
  return Boolean(
    !hasInFlightSave &&
    pendingSerializedTheme != null &&
    (pendingRequiresWrite || pendingSerializedTheme !== persistedSerializedTheme),
  )
}

export function shouldBlockPreviewCustomerNavigation(themeSaveStatus: PreviewThemeSaveStatus) {
  return themeSaveStatus === "saving"
}

export function resolvePreviewNavigationTarget({ access, pages, href, origin }: {
  access: PreviewCustomizerAccess
  pages: PreviewPageSummary[]
  href: string
  origin: string
}): string | null {
  const pathname = new URL(href, origin).pathname.replace(/^\/+|\/+$/g, "")
  const requestedSlug = pathname === "" ? "index" : pathname.split("/").at(-1) ?? "index"
  const target = pages.find((candidate) => candidate.slug === requestedSlug || (requestedSlug === "home" && candidate.slug === "index"))
  if (!target) return null
  return target.slug === "index" ? `/${access.clientSlug}` : `/${access.clientSlug}/pages/${encodeURIComponent(target.slug)}`
}

export function PreviewCustomizer({
  access,
  pages,
  page,
  settings,
  manifest,
  theme,
  payment,
  tenantId,
  tenantSlug,
  domain,
}: {
  access: PreviewCustomizerAccess
  pages: PreviewPageSummary[]
  page: Page
  settings: SiteSettings
  manifest: RtManifest
  theme: ThemeTokens | null
  approval: PreviewApprovalState | null
  payment: PreviewPaymentState | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
}) {
  const t = useTranslations("preview")
  const [themeState, setThemeState] = React.useState<ThemeTokens | null>(() => normalizePreviewThemeForSave(theme))
  const [paymentState] = React.useState<PreviewPaymentState | null>(payment)
  const themeStateRef = React.useRef(themeState)
  const persistedThemeRef = React.useRef(JSON.stringify(normalizePreviewThemeForSave(theme) ?? {}))
  const latestThemeRef = React.useRef(persistedThemeRef.current)
  const themeVersionRef = React.useRef(0)
  const frameRevisionRef = React.useRef(0)
  const pendingSaveRef = React.useRef<QueuedPreviewThemeSave | null>(null)
  const inFlightSaveRef = React.useRef<QueuedPreviewThemeSave | null>(null)
  const [themeSaveStatus, setThemeSaveStatus] = React.useState<PreviewThemeSaveStatus>("idle")
  themeStateRef.current = themeState

  const handleThemeChange = React.useCallback((nextTheme: React.SetStateAction<ThemeTokens | null>) => {
    const resolvedTheme = typeof nextTheme === "function"
      ? (nextTheme as (currentTheme: ThemeTokens | null) => ThemeTokens | null)(themeStateRef.current)
      : nextTheme
    const normalizedTheme = normalizePreviewThemeForSave(resolvedTheme)
    const serializedTheme = JSON.stringify(normalizedTheme ?? {})
    const hasUnsavedTheme =
      serializedTheme !== persistedThemeRef.current ||
      (inFlightSaveRef.current != null && inFlightSaveRef.current.serializedTheme !== serializedTheme) ||
      (pendingSaveRef.current != null && pendingSaveRef.current.serializedTheme !== serializedTheme)

    themeStateRef.current = normalizedTheme

    if (hasUnsavedTheme) {
      setThemeSaveStatus("saving")
    }

    setThemeState(normalizedTheme)
  }, [])

  const flushThemeSaveQueue = React.useCallback(() => {
    if (!shouldStartPreviewThemeSave({
      hasInFlightSave: inFlightSaveRef.current != null,
      pendingRequiresWrite: pendingSaveRef.current?.requiresWrite ?? false,
      pendingSerializedTheme: pendingSaveRef.current?.serializedTheme ?? null,
      persistedSerializedTheme: persistedThemeRef.current,
    })) {
      return
    }

    const request = pendingSaveRef.current
    if (!request) return
    pendingSaveRef.current = null
    inFlightSaveRef.current = request
    setThemeSaveStatus("saving")

    if (!request.normalizedTheme) return
    void setPreviewTheme(access, request.normalizedTheme)
      .then((saved) => {
        const savedTheme = normalizePreviewThemeForSave(saved)
        const savedSerializedTheme = JSON.stringify(savedTheme ?? {})
        const isCurrentLocalTheme = shouldApplyPreviewThemeSaveResponse({
          latestSerializedTheme: latestThemeRef.current,
          latestVersion: themeVersionRef.current,
          requestSerializedTheme: request.serializedTheme,
          requestVersion: request.version,
        })

        if (isCurrentLocalTheme) {
          persistedThemeRef.current = savedSerializedTheme
          setThemeState(savedTheme)
          setThemeSaveStatus("saved")
          return
        }

        setThemeSaveStatus(pendingSaveRef.current ? "saving" : "idle")
      })
      .catch((error) => {
        console.error("Failed to save preview theme", error)
        if (latestThemeRef.current === request.serializedTheme) {
          setThemeSaveStatus("error")
        }
      })
      .finally(() => {
        inFlightSaveRef.current = null
        flushThemeSaveQueue()
      })
  }, [access])

  React.useEffect(() => {
    const normalizedTheme = normalizePreviewThemeForSave(themeState)
    const serializedTheme = JSON.stringify(normalizedTheme ?? {})
    latestThemeRef.current = serializedTheme
    const version = ++themeVersionRef.current

    if (serializedTheme === persistedThemeRef.current) {
      if (inFlightSaveRef.current && inFlightSaveRef.current.serializedTheme !== serializedTheme) {
        pendingSaveRef.current = {
          normalizedTheme,
          serializedTheme,
          version,
          requiresWrite: true,
        }
        flushThemeSaveQueue()
        return
      }
      if (inFlightSaveRef.current == null && pendingSaveRef.current == null) {
        setThemeSaveStatus("idle")
      }
      return
    }

    pendingSaveRef.current = { normalizedTheme, serializedTheme, version }
    flushThemeSaveQueue()
  }, [flushThemeSaveQueue, themeState])

  const paymentSatisfied = paymentState?.status === "completed" || paymentState?.status === "waived"
  const canCompleteOrder = !paymentSatisfied
  const checkoutHref = `/${access.clientSlug}/checkout`
  const reviewHref = `/${access.clientSlug}/review`
  const customerNavigationBlocked = shouldBlockPreviewCustomerNavigation(themeSaveStatus)
  const rendererTheme = React.useMemo(() => normalizeThemeForSave(themeState), [themeState])
  const frameSrc = React.useMemo(() => {
    const slug = page.slug && page.slug !== "index" ? `/pages/${encodeURIComponent(page.slug)}` : ""
    return `/renderer-frame/preview/${encodeURIComponent(access.clientSlug)}${slug}`
  }, [access, page.slug])

  const framePageId = React.useMemo(() => {
    const rawId = page.id ?? page.slug ?? "page"
    return String(rawId)
  }, [page.id, page.slug])
  const navigatePreview = React.useCallback((href: string) => {
    const targetHref = resolvePreviewNavigationTarget({ access, pages, href, origin: window.location.origin })
    if (targetHref) window.location.assign(targetHref)
  }, [access, pages])

  return (
    <RtManifestProvider manifest={manifest}>
      <form className="min-h-dvh bg-background text-foreground" onSubmit={(event) => event.preventDefault()}>
        <main className="h-dvh w-full overflow-hidden">
          <PreviewRendererFrame
            src={frameSrc}
            title={page.title || t("metadataTitle")}
            pageId={framePageId}
            page={page}
            settings={settings}
            theme={rendererTheme}
            revisionRef={frameRevisionRef}
            onNavigationRequested={navigatePreview}
            onFrameInteraction={() => window.dispatchEvent(new Event(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT))}
          />
        </main>

        <PreviewMobileChrome
          theme={themeState}
          onThemeChange={handleThemeChange}
          canCompleteOrder={canCompleteOrder}
          paymentSatisfied={paymentSatisfied}
          checkoutHref={checkoutHref}
          reviewHref={reviewHref}
          customerNavigationBlocked={customerNavigationBlocked}
        />

        <div className="hidden md:block">
          <PreviewCommandBar
            theme={themeState}
            onThemeChange={handleThemeChange}
            canCompleteOrder={canCompleteOrder}
            paymentSatisfied={paymentSatisfied}
            checkoutHref={checkoutHref}
            reviewHref={reviewHref}
            customerNavigationBlocked={customerNavigationBlocked}
          />
        </div>
        <ThemeSaveStatus status={themeSaveStatus} />
      </form>
    </RtManifestProvider>
  )
}

function PreviewRendererFrame({
  src,
  title,
  pageId,
  page,
  settings,
  theme,
  revisionRef,
  onNavigationRequested,
  onFrameInteraction,
}: {
  src: string
  title: string
  pageId: string
  page: Page
  settings: SiteSettings
  theme: ReturnType<typeof normalizeThemeForSave>
  revisionRef: React.MutableRefObject<number>
  onNavigationRequested: (href: string) => void
  onFrameInteraction: () => void
}) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = React.useState(false)
  const [frameError, setFrameError] = React.useState<string | null>(null)
  const readyRef = React.useRef(false)

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    const target = frameRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }, [])

  React.useEffect(() => {
    readyRef.current = false
    setReady(false)
    setFrameError(null)
    revisionRef.current = 0
  }, [revisionRef, src])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const parsed = validateIframeEditorMessage(event.data)
      if (parsed.ok && parsed.message.type === "renderer.ready") {
        if (!readyRef.current) {
          revisionRef.current = 0
          readyRef.current = true
          setReady(true)
        }
        setFrameError(null)
        return
      }
      if (parsed.ok && parsed.message.type === "error") {
        setFrameError(parsed.message.message)
        return
      }
      if (parsed.ok && parsed.message.type === "navigation.requested" && parsed.message.href) onNavigationRequested(parsed.message.href)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onNavigationRequested])

  React.useEffect(() => {
    if (ready || frameError) return
    const timeout = window.setTimeout(() => setFrameError("De preview kon niet op tijd worden geladen."), 12_000)
    return () => window.clearTimeout(timeout)
  }, [frameError, ready, src])

  React.useEffect(() => {
    if (!ready) return
    const frameDocument = frameRef.current?.contentDocument
    if (!frameDocument) return
    frameDocument.addEventListener("pointerdown", onFrameInteraction, true)
    frameDocument.addEventListener("focusin", onFrameInteraction, true)

    return () => {
      frameDocument.removeEventListener("pointerdown", onFrameInteraction, true)
      frameDocument.removeEventListener("focusin", onFrameInteraction, true)
    }
  }, [onFrameInteraction, ready, src])

  React.useEffect(() => {
    const closeWhenFrameTakesFocus = () => {
      if (document.activeElement === frameRef.current) onFrameInteraction()
    }
    window.addEventListener("blur", closeWhenFrameTakesFocus)
    return () => window.removeEventListener("blur", closeWhenFrameTakesFocus)
  }, [onFrameInteraction])

  const themeKey = React.useMemo(() => JSON.stringify(theme ?? null), [theme])

  React.useEffect(() => {
    if (!ready) return
    const expectedRevision = revisionRef.current
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "render.snapshot",
      messageId: `snapshot-${expectedRevision}`,
      expectedRevision,
      pageId,
      page,
      settings,
      theme,
    })
    revisionRef.current = expectedRevision + 1
  }, [page, pageId, postToFrame, ready, revisionRef, settings, theme, themeKey])

  const visible = ready

  return (
    <div className="relative h-dvh min-h-[32rem] w-full overflow-hidden bg-background">
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className={cn(
          "block h-full min-h-[32rem] w-full border-0 bg-transparent transition-opacity duration-150",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        sandbox="allow-same-origin allow-scripts allow-forms"
        data-siab-renderer-frame
        onFocus={onFrameInteraction}
        onPointerDown={onFrameInteraction}
      />
      {!visible && (
        <div className="absolute inset-0 bg-background p-4" aria-live="polite">
          {frameError ? (
            <div className="flex min-h-96 items-center justify-center text-center">
              <p role="alert" className="max-w-md rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
                {frameError}
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-pulse" aria-label="Preview laden">
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-96 rounded-lg bg-muted" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-48 rounded-lg bg-muted" />
                <div className="h-48 rounded-lg bg-muted" />
                <div className="h-48 rounded-lg bg-muted" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThemeSaveStatus({ status }: { status: PreviewThemeSaveStatus }) {
  const t = useTranslations("preview")
  if (status === "idle") return null
  const text = status === "error"
    ? t("themeSaveFailed")
    : status === "saving"
      ? t("themeSaving")
      : t("themeSaved")
  return (
    <p className="sr-only" role={status === "error" ? "alert" : "status"} aria-live="polite">
      {text}
    </p>
  )
}

export function PreviewCommandBar({
  theme,
  onThemeChange,
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  canCompleteOrder: boolean
  paymentSatisfied: boolean
  checkoutHref: string
  reviewHref: string
  customerNavigationBlocked: boolean
}) {
  const t = useTranslations("preview")
  const preventBlockedNavigation = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!customerNavigationBlocked) return
    event.preventDefault()
  }, [customerNavigationBlocked])
  const blockedAnchorProps = customerNavigationBlocked
    ? {
        "aria-disabled": true,
        href: undefined,
        onClick: preventBlockedNavigation,
        tabIndex: -1,
      }
    : {}
  const blockedClassName = customerNavigationBlocked ? "pointer-events-none opacity-50" : ""

  return (
    <div
      data-siab-cms-sticky-chrome
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-0 md:bottom-6 md:flex md:justify-center md:px-6"
    >
      <div className="pointer-events-auto relative grid w-full grid-cols-[auto_1fr] items-center gap-1 overflow-hidden border-t bg-background px-3 py-2 shadow-lg md:inline-flex md:w-auto md:grid-cols-none md:items-center md:gap-3 md:rounded-lg md:border md:border-border md:bg-background md:p-3 md:shadow-none">
        <PreviewDesktopThemeToolbar theme={theme} onThemeChange={onThemeChange} />

        <Separator orientation="vertical" className="mx-1 hidden h-8 md:block" />

        <div className="flex justify-self-end items-center gap-2 md:justify-self-auto">
          <Button asChild variant="default" size="default" className={`h-12 w-12 rounded-md px-0 md:h-9 lg:w-auto lg:px-5 ${blockedClassName}`}>
            <a
              href={customerNavigationBlocked ? undefined : reviewHref}
              aria-label={t("reviewChanges")}
              title={t("reviewChanges")}
              {...blockedAnchorProps}
            >
              <SquarePen className="size-5" aria-hidden />
              <span className="sr-only lg:not-sr-only lg:ml-2">{t("reviewChanges")}</span>
            </a>
          </Button>

          {canCompleteOrder ? (
            <Button asChild variant="success" size="default" className={`h-12 rounded-md px-4 md:h-9 md:px-5 ${blockedClassName}`}>
              <a
                href={customerNavigationBlocked ? undefined : checkoutHref}
                aria-label={t("launchWebsite")}
                title={t("launchWebsite")}
                {...blockedAnchorProps}
              >
                <Rocket className="size-5" aria-hidden />
                <span className="sr-only md:not-sr-only md:ml-2">{t("launchWebsite")}</span>
              </a>
            </Button>
          ) : paymentSatisfied ? (
            <Button
              type="button"
              variant="secondary"
              size="default"
              disabled
              className="h-12 rounded-md px-4 md:h-9 md:px-5"
              aria-label={t("paymentComplete")}
              title={t("paymentComplete")}
            >
              <CheckCircle2 className="size-5" aria-hidden />
              <span className="sr-only md:not-sr-only md:ml-2">{t("paymentComplete")}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
