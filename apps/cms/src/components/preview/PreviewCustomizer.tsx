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
import { CheckCircle2, ChevronDown, ChevronUp, Rocket, SquarePen } from "lucide-react"
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
import { PreviewFrameLoading } from "@/components/preview/PreviewFrameLoading"
import { PREVIEW_THEME_TOOLBAR_CLOSE_EVENT } from "@/lib/preview/preview-theme-events"

export { PREVIEW_THEME_TOOLBAR_CLOSE_EVENT }

const FRAME_LOADING_FADE_MS = 320
const FRAME_LOADING_FILL_START_DELAY_MS = 120
const FRAME_LOADING_FILL_MS = 320
const FRAME_LOADING_POST_FILL_HOLD_MS = 280

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
    ?? (pathname === "" ? pages[0] : undefined)
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
  faviconHref,
  consentAvailable = false,
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
  faviconHref: string
  consentAvailable?: boolean
  approval: PreviewApprovalState | null
  payment: PreviewPaymentState | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
}) {
  const t = useTranslations("preview")
  const [themeState, setThemeState] = React.useState<ThemeTokens | null>(() => normalizePreviewThemeForSave(theme))
  const [previewVisible, setPreviewVisible] = React.useState(false)
  const [desktopToolbarExpanded, setDesktopToolbarExpanded] = React.useState(true)
  const [paymentState] = React.useState<PreviewPaymentState | null>(payment)
  React.useEffect(() => {
    if (!previewVisible) setDesktopToolbarExpanded(true)
  }, [previewVisible])
  React.useEffect(() => {
    const existingLink = document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    const link = existingLink ?? document.createElement("link")
    const previousHref = link.getAttribute("href")
    if (!existingLink) {
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = faviconHref
    return () => {
      if (previousHref) link.href = previousHref
      else if (!existingLink) link.remove()
    }
  }, [faviconHref])
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

    if (!request.normalizedTheme) {
      inFlightSaveRef.current = null
      flushThemeSaveQueue()
      return
    }
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
            consentAvailable={consentAvailable}
            revisionRef={frameRevisionRef}
            onNavigationRequested={navigatePreview}
            onFrameInteraction={() => window.dispatchEvent(new Event(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT))}
            onVisibilityChange={setPreviewVisible}
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
            previewVisible={previewVisible}
            desktopToolbarExpanded={desktopToolbarExpanded}
            onDesktopToolbarExpandedChange={setDesktopToolbarExpanded}
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
  consentAvailable,
  revisionRef,
  onNavigationRequested,
  onFrameInteraction,
  onVisibilityChange,
}: {
  src: string
  title: string
  pageId: string
  page: Page
  settings: SiteSettings
  theme: ReturnType<typeof normalizeThemeForSave>
  consentAvailable: boolean
  revisionRef: React.MutableRefObject<number>
  onNavigationRequested: (href: string) => void
  onFrameInteraction: () => void
  onVisibilityChange: (visible: boolean) => void
}) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = React.useState(false)
  const [loadingProgress, setLoadingProgress] = React.useState(0)
  const [loadingOverlayVisible, setLoadingOverlayVisible] = React.useState(true)
  const [loadingOverlayMounted, setLoadingOverlayMounted] = React.useState(true)
  const [frameError, setFrameError] = React.useState<string | null>(null)
  const readyRef = React.useRef(false)

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    const target = frameRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }, [])

  React.useLayoutEffect(() => {
    readyRef.current = false
    setReady(false)
    setLoadingProgress(0)
    setLoadingOverlayVisible(true)
    setLoadingOverlayMounted(true)
    setFrameError(null)
    revisionRef.current = 0
    onVisibilityChange(false)

    const frameDocument = frameRef.current?.contentDocument
    if (frameDocument && frameDocument.readyState !== "loading") {
      setLoadingProgress(72)
      readyRef.current = true
      setReady(true)
    }
  }, [onVisibilityChange, revisionRef, src])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const parsed = validateIframeEditorMessage(event.data)
      if (parsed.ok && parsed.message.type === "renderer.ready") {
        if (!readyRef.current) {
          revisionRef.current = 0
          readyRef.current = true
          setLoadingProgress(72)
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
    let fadeTimeout: number | undefined
    const fillStartTimeout = window.setTimeout(() => setLoadingProgress(100), FRAME_LOADING_FILL_START_DELAY_MS)
    const fadeStartTimeout = window.setTimeout(() => {
      setLoadingOverlayVisible(false)
      fadeTimeout = window.setTimeout(() => {
        setLoadingOverlayMounted(false)
        onVisibilityChange(true)
      }, FRAME_LOADING_FADE_MS)
    }, FRAME_LOADING_FILL_START_DELAY_MS + FRAME_LOADING_FILL_MS + FRAME_LOADING_POST_FILL_HOLD_MS)
    return () => {
      window.clearTimeout(fillStartTimeout)
      window.clearTimeout(fadeStartTimeout)
      if (fadeTimeout != null) window.clearTimeout(fadeTimeout)
    }
  }, [onVisibilityChange, ready, src])

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
          "block h-full min-h-[32rem] w-full border-0 bg-transparent transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        sandbox="allow-same-origin allow-scripts allow-forms"
        data-siab-renderer-frame
        onLoad={() => {
          // A fast mobile iframe can finish its first render before the host
          // effect subscribes to postMessage. The frame has its own fixture
          // data already, so revealing it on load avoids a permanent skeleton
          // while the next snapshot handshake catches up.
          if (!readyRef.current) setLoadingProgress(72)
          readyRef.current = true
          setFrameError(null)
          setReady(true)
        }}
        onFocus={onFrameInteraction}
        onPointerDown={onFrameInteraction}
      />
      {(!visible || loadingOverlayMounted) && (
        <div
          className={cn(
            "absolute inset-0 bg-background p-4 transition-opacity duration-200 ease-out",
            loadingOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={visible && !frameError ? true : undefined}
          aria-live="polite"
        >
          {frameError ? (
            <div className="flex min-h-96 items-center justify-center text-center">
              <p role="alert" className="max-w-md rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
                {frameError}
              </p>
            </div>
          ) : (
            <PreviewFrameLoading
              label="Preview laden"
              progress={loadingProgress}
              className="h-full min-h-[32rem]"
            />
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
  previewVisible,
  desktopToolbarExpanded,
  onDesktopToolbarExpandedChange,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  canCompleteOrder: boolean
  paymentSatisfied: boolean
  checkoutHref: string
  reviewHref: string
  customerNavigationBlocked: boolean
  previewVisible: boolean
  desktopToolbarExpanded: boolean
  onDesktopToolbarExpandedChange: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const t = useTranslations("preview")
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const toggleRef = React.useRef<HTMLButtonElement | null>(null)
  const toolbarToggleLabel = desktopToolbarExpanded
    ? t("collapsePreviewToolbar")
    : t("expandPreviewToolbar")
  const toggleToolbar = () => {
    if (desktopToolbarExpanded) {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && panelRef.current?.contains(activeElement)) {
        toggleRef.current?.focus()
      }
    }
    onDesktopToolbarExpandedChange((expanded) => !expanded)
  }
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
      className={cn(
        "siab-preview-command-bar pointer-events-none fixed inset-x-0 bottom-0 z-30 px-0 md:bottom-6 md:flex md:justify-center md:px-6 md:flex-col md:items-center",
      )}
      data-preview-visible={previewVisible ? "true" : "false"}
      data-preview-expanded={desktopToolbarExpanded ? "true" : "false"}
      aria-hidden={!previewVisible}
      inert={!previewVisible}
    >
      <div
        ref={panelRef}
        id="siab-preview-command-bar-panel"
        className="pointer-events-auto relative grid w-full grid-cols-[auto_1fr] items-center gap-1 overflow-hidden border-t bg-background px-3 py-2 shadow-lg md:inline-flex md:w-auto md:grid-cols-none md:items-center md:gap-3 md:rounded-lg md:border md:border-border md:bg-background md:p-3 md:shadow-none siab-preview-command-bar__panel"
        aria-hidden={!desktopToolbarExpanded}
        inert={!desktopToolbarExpanded}
      >
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
                <span className="sr-only lg:not-sr-only lg:ml-2">{t("launchWebsite")}</span>
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
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        data-siab-preview-toolbar-toggle
        className={cn(
          "siab-preview-command-bar__toggle pointer-events-auto z-10 inline-flex h-5 w-16 cursor-pointer items-center justify-center border border-border bg-background text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:mt-[-1px]",
          desktopToolbarExpanded ? "rounded-b-md rounded-t-none border-t-0" : "rounded-md border-t",
        )}
        aria-expanded={desktopToolbarExpanded}
        aria-controls="siab-preview-command-bar-panel"
        aria-label={toolbarToggleLabel}
        title={toolbarToggleLabel}
        onClick={toggleToolbar}
      >
        {desktopToolbarExpanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronUp className="size-3.5" aria-hidden />}
        <span className="sr-only">{toolbarToggleLabel}</span>
      </Button>
    </div>
  )
}
