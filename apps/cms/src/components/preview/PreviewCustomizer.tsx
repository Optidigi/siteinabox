"use client"

import * as React from "react"
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
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { ThemeBar } from "@/components/editor/theme/theme-bar"
import { setPreviewTheme } from "@/lib/actions/previewCustomizer"
import type {
  PreviewApprovalState,
  PreviewCustomizerAccess,
  PreviewPageSummary,
  PreviewPaymentState,
} from "@/lib/preview/customizer"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"

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

export function PreviewCustomizer({
  access,
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
  const [themeState, setThemeState] = React.useState<ThemeTokens | null>(() => normalizeThemeForSave(theme))
  const [paymentState] = React.useState<PreviewPaymentState | null>(payment)
  const themeStateRef = React.useRef(themeState)
  const persistedThemeRef = React.useRef(JSON.stringify(normalizeThemeForSave(theme) ?? {}))
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
    const normalizedTheme = normalizeThemeForSave(resolvedTheme)
    const serializedTheme = JSON.stringify(normalizedTheme ?? {})
    const hasUnsavedTheme =
      serializedTheme !== persistedThemeRef.current ||
      (inFlightSaveRef.current != null && inFlightSaveRef.current.serializedTheme !== serializedTheme) ||
      (pendingSaveRef.current != null && pendingSaveRef.current.serializedTheme !== serializedTheme)

    themeStateRef.current = resolvedTheme

    if (hasUnsavedTheme) {
      setThemeSaveStatus("saving")
    }

    setThemeState(resolvedTheme)
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

    void setPreviewTheme(access, request.normalizedTheme ?? {})
      .then((saved) => {
        const savedTheme = normalizeThemeForSave(saved)
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
    const normalizedTheme = normalizeThemeForSave(themeState)
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
  const canCompleteOrder = access.type === "grant" && !paymentSatisfied
  const checkoutHref = access.type === "grant" ? `/${access.clientSlug}/checkout` : "#"
  const reviewHref = access.type === "grant" ? `/${access.clientSlug}/review` : "#"
  const customerNavigationBlocked = shouldBlockPreviewCustomerNavigation(themeSaveStatus)
  const rendererTheme = React.useMemo(() => cmsThemeToRendererTheme(themeState), [themeState])
  const frameSrc = React.useMemo(() => {
    const slug = page.slug && page.slug !== "index" ? `/pages/${encodeURIComponent(page.slug)}` : ""
    if (access.type === "grant") {
      return `/renderer-frame/preview/${encodeURIComponent(access.clientSlug)}${slug}`
    }
    if (access.type === "legacy-token") {
      return `/renderer-frame/preview-token/${encodeURIComponent(access.token)}${slug}`
    }
    return null
  }, [access, page.slug])

  const framePageId = React.useMemo(() => {
    const rawId = page.id ?? page.slug ?? "page"
    return String(rawId)
  }, [page.id, page.slug])

  return (
    <RtManifestProvider manifest={manifest}>
      <form className="min-h-dvh bg-background text-foreground" onSubmit={(event) => event.preventDefault()}>
        <div data-siab-cms-sticky-chrome className="sticky top-0 z-20 flex items-center justify-center border-b bg-background px-3 py-2">
          <div className="pointer-events-auto">
            <ThemeBar
              theme={themeState}
              manifest={manifest}
              onThemeChange={handleThemeChange}
              palettes={PALETTE_PRESETS}
              fonts={FONT_PRESETS}
              radiusLevels={RADIUS_PRESETS}
            />
            <ThemeSaveStatus status={themeSaveStatus} />
          </div>
        </div>

        <main className="w-full pb-28">
          {frameSrc ? (
            <PreviewRendererFrame
              src={frameSrc}
              title={page.title || t("metadataTitle")}
              pageId={framePageId}
              page={page}
              settings={settings}
              theme={rendererTheme}
              revisionRef={frameRevisionRef}
            />
          ) : (
            <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center text-muted-foreground">
              {t("accessUnavailableDescription")}
            </div>
          )}
        </main>

        <PreviewCommandBar
          canCompleteOrder={canCompleteOrder}
          paymentSatisfied={paymentSatisfied}
          checkoutHref={checkoutHref}
          reviewHref={reviewHref}
          customerNavigationBlocked={customerNavigationBlocked}
        />
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
}: {
  src: string
  title: string
  pageId: string
  page: Page
  settings: SiteSettings
  theme: ReturnType<typeof cmsThemeToRendererTheme>
  revisionRef: React.MutableRefObject<number>
}) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = React.useState(false)

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    const target = frameRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }, [])

  React.useEffect(() => {
    setReady(false)
    revisionRef.current = 0
  }, [revisionRef, src])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const parsed = validateIframeEditorMessage(event.data)
      if (parsed.ok && parsed.message.type === "renderer.ready") {
        setReady(true)
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
      pageId,
      page,
      settings,
    })
    revisionRef.current = expectedRevision + 1
  }, [page, pageId, postToFrame, ready, revisionRef, settings])

  React.useEffect(() => {
    if (!ready) return
    const expectedRevision = revisionRef.current
    postToFrame({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "theme.patch",
      messageId: `theme-${expectedRevision}`,
      expectedRevision,
      theme,
    })
    revisionRef.current = expectedRevision + 1
  }, [postToFrame, ready, revisionRef, theme])

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      className="block h-[calc(100dvh-9rem)] min-h-[640px] w-full border-0 bg-white"
      sandbox="allow-same-origin allow-scripts allow-forms"
      data-siab-renderer-frame
    />
  )
}

function ThemeSaveStatus({ status }: { status: PreviewThemeSaveStatus }) {
  if (status === "idle") return null
  const text = status === "error"
    ? "Theme changes could not be saved."
    : status === "saving"
      ? "Saving theme changes."
      : "Theme changes saved."
  return (
    <p className="sr-only" role={status === "error" ? "alert" : "status"} aria-live="polite">
      {text}
    </p>
  )
}

export function PreviewCommandBar({
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-3 py-3 shadow-lg">
      <div className="flex w-full justify-end">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
          <Button asChild variant="default" className={`w-full sm:w-auto ${blockedClassName}`}>
            <a href={customerNavigationBlocked ? undefined : reviewHref} {...blockedAnchorProps}>
              <SquarePen className="size-4" />
              {t("reviewChanges")}
            </a>
          </Button>
          {canCompleteOrder && (
            <Button asChild variant="success" className={`w-full sm:w-auto ${blockedClassName}`}>
              <a href={customerNavigationBlocked ? undefined : checkoutHref} {...blockedAnchorProps}>
                <Rocket className="size-4" />
                {t("launchWebsite")}
              </a>
            </Button>
          )}
          {paymentSatisfied && (
            <Button type="button" variant="secondary" disabled className="w-full sm:w-auto">
              <CheckCircle2 className="size-4" />
              {t("paymentComplete")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
