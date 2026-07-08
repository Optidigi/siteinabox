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
import { CheckCircle2, Palette, Rocket, SlidersHorizontal, SquarePen, SquareRoundCorner, Type } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@siteinabox/ui/components/popover"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { SegmentedPill } from "@/components/common/segmented-pill"
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { DensityControl, ShapeControl } from "@/components/editor/theme/radius-control"
import { setPreviewTheme } from "@/lib/actions/previewCustomizer"
import type {
  PreviewApprovalState,
  PreviewCustomizerAccess,
  PreviewPageSummary,
  PreviewPaymentState,
} from "@/lib/preview/customizer"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import { PreviewMobileChrome } from "@/components/preview/preview-mobile-chrome"

const PREVIEW_FRAME_HEIGHT_GUTTER = 2
export const PREVIEW_THEME_TOOLBAR_CLOSE_EVENT = "siab:preview-theme-toolbar-close"
type AppearanceMode = NonNullable<ThemeTokens["appearance"]>["mode"]
type PreviewThemeSegment = "colors" | "fonts" | "shape" | "density"

const PREVIEW_RANDOM_MODES: AppearanceMode[] = ["light", "dark"]

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

function measurePreviewFrameDocumentHeight(frameDocument: Document | null | undefined): number | null {
  if (!frameDocument) return null
  const body = frameDocument.body
  if (!body) return null
  const frameWindow = frameDocument.defaultView
  const scrollY = frameWindow?.scrollY ?? 0
  const bodyTop = body.getBoundingClientRect().top + scrollY
  const height = Array.from(body.children).reduce((max, child) => {
    const rect = child.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return max
    return Math.max(max, rect.bottom + scrollY - bodyTop)
  }, 0)
  return Number.isFinite(height) && height > 0 ? Math.ceil(height + PREVIEW_FRAME_HEIGHT_GUTTER) : null
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
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

    if (!request.normalizedTheme) return
    void setPreviewTheme(access, request.normalizedTheme)
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

  const handleShuffleTheme = React.useCallback(() => {
    const palette = pickRandom(PALETTE_PRESETS)
    const font = pickRandom(FONT_PRESETS)
    const shape = pickRandom(RADIUS_PRESETS)
    const density = pickRandom(DENSITY_PRESETS)
    const mode = pickRandom(PREVIEW_RANDOM_MODES) ?? "light"

    handleThemeChange((current) =>
      normalizeThemeForSave({
        ...(current ?? themeStateRef.current ?? DEFAULT_THEME_TOKEN_SPEC),
        version: 2,
        appearance: { mode },
        ...(palette ? { colors: { schemeId: palette.id } } : {}),
        ...(font ? { fonts: { schemeId: font.id } } : {}),
        ...(shape ? { shape: { schemeId: shape.id } } : {}),
        ...(density ? { density: { schemeId: density.id } } : {}),
      } as ThemeTokens),
    )
  }, [handleThemeChange])

  const handleDefaultTheme = React.useCallback(() => {
    handleThemeChange(normalizeThemeForSave(DEFAULT_THEME_TOKEN_SPEC))
  }, [handleThemeChange])

  return (
    <RtManifestProvider manifest={manifest}>
      <form className="min-h-dvh bg-background text-foreground" onSubmit={(event) => event.preventDefault()}>
        <main className="w-full pb-24 md:pb-32">
          {frameSrc ? (
            <PreviewRendererFrame
              src={frameSrc}
              title={page.title || t("metadataTitle")}
              pageId={framePageId}
              page={page}
              settings={settings}
              theme={rendererTheme}
              revisionRef={frameRevisionRef}
              onFrameInteraction={() => window.dispatchEvent(new Event(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT))}
            />
          ) : (
            <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center text-muted-foreground">
              {t("accessUnavailableDescription")}
            </div>
          )}
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
            onShuffleTheme={handleShuffleTheme}
            onDefaultTheme={handleDefaultTheme}
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
  onFrameInteraction,
}: {
  src: string
  title: string
  pageId: string
  page: Page
  settings: SiteSettings
  theme: ReturnType<typeof cmsThemeToRendererTheme>
  revisionRef: React.MutableRefObject<number>
  onFrameInteraction: () => void
}) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = React.useState(false)
  const [frameContentHeight, setFrameContentHeight] = React.useState<number | null>(null)
  const iframeAutoHeight = useCspStyleRule(
    "preview-renderer-frame-auto-height",
    frameContentHeight != null ? `height:${formatCssPx(frameContentHeight)};` : null,
  )

  const postToFrame = React.useCallback((payload: IframeEditorMessage) => {
    const target = frameRef.current?.contentWindow
    if (!target) return
    target.postMessage(payload, window.location.origin)
  }, [])

  React.useEffect(() => {
    setReady(false)
    setFrameContentHeight(null)
    revisionRef.current = 0
  }, [revisionRef, src])

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return
      const parsed = validateIframeEditorMessage(event.data)
      if (parsed.ok && parsed.message.type === "renderer.ready") {
        setReady(true)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  React.useLayoutEffect(() => {
    if (!ready) {
      setFrameContentHeight(null)
      return
    }
    const frameDocument = frameRef.current?.contentDocument
    const frameWindow = frameRef.current?.contentWindow
    if (!frameDocument) return

    let raf: number | null = null
    const measure = () => {
      raf = null
      const next = measurePreviewFrameDocumentHeight(frameDocument)
      setFrameContentHeight((current) => (current === next ? current : next))
    }
    const schedule = () => {
      if (raf != null) return
      raf = window.requestAnimationFrame(measure)
    }

    measure()
    const resizeObserver = new ResizeObserver(schedule)
    if (frameDocument.documentElement) resizeObserver.observe(frameDocument.documentElement)
    if (frameDocument.body) resizeObserver.observe(frameDocument.body)
    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(frameDocument.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    frameWindow?.addEventListener("resize", schedule)
    frameWindow?.addEventListener("load", schedule)
    window.addEventListener("resize", schedule)
    frameDocument.addEventListener("pointerdown", onFrameInteraction, true)
    frameDocument.addEventListener("focusin", onFrameInteraction, true)

    return () => {
      if (raf != null) window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      frameWindow?.removeEventListener("resize", schedule)
      frameWindow?.removeEventListener("load", schedule)
      window.removeEventListener("resize", schedule)
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
    <>
      {iframeAutoHeight.styleElement}
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className={cn(iframeAutoHeight.className, "block min-h-dvh w-full border-0 bg-white")}
        sandbox="allow-same-origin allow-scripts allow-forms"
        data-siab-renderer-frame
        onFocus={onFrameInteraction}
        onPointerDown={onFrameInteraction}
      />
    </>
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

function PreviewThemeToolbar({
  theme,
  onThemeChange,
  onShuffleTheme: _onShuffleTheme,
  onDefaultTheme: _onDefaultTheme,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  onShuffleTheme: () => void
  onDefaultTheme: () => void
}) {
  const t = useTranslations("editor")
  const previewT = useTranslations("preview")
  const [openSegment, setOpenSegment] = React.useState<PreviewThemeSegment | null>(null)
  const lastOpenSegmentRef = React.useRef<PreviewThemeSegment | null>(null)
  const segmentRefs = React.useRef<Record<PreviewThemeSegment, HTMLButtonElement | null>>({
    colors: null,
    fonts: null,
    shape: null,
    density: null,
  })

  React.useEffect(() => {
    if (openSegment) lastOpenSegmentRef.current = openSegment
  }, [openSegment])

  React.useEffect(() => {
    const close = () => setOpenSegment(null)
    window.addEventListener(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT, close)
    return () => window.removeEventListener(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT, close)
  }, [])

  function handleUpdate(partial: Partial<ThemeTokens>) {
    onThemeChange((current) => normalizeThemeForSave({ ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC), ...partial } as ThemeTokens))
  }

  return (
    <div className="justify-self-center">
      <div className="hidden md:block">
        <Popover open={openSegment != null} onOpenChange={(open) => !open && setOpenSegment(null)}>
          <PopoverAnchor asChild>
            <div>
              <SegmentedPill<PreviewThemeSegment>
                ariaLabel={previewT("themeControls")}
                value={openSegment}
                onValueChange={(next) => setOpenSegment((current) => (current === next ? null : next))}
                className="h-12 border-0 bg-card/95 shadow-none md:h-9"
                itemRef={(value, el) => {
                  segmentRefs.current[value] = el
                }}
                items={[
                  { value: "colors", label: t("colours"), icon: Palette, ariaLabel: t("colourPalette") },
                  { value: "fonts", label: t("fonts"), icon: Type, ariaLabel: t("fontPairings") },
                  { value: "shape", label: t("shape"), icon: SquareRoundCorner, ariaLabel: t("cornerRadius") },
                  { value: "density", label: t("density"), icon: SlidersHorizontal, ariaLabel: t("spacingDensity") },
                ]}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="w-auto max-w-[calc(100vw-2rem)] rounded-md border border-border/40 bg-card/95 p-3 shadow-md backdrop-blur-sm"
            onPointerDownOutside={() => setOpenSegment(null)}
            onFocusOutside={() => setOpenSegment(null)}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => {
              const target = lastOpenSegmentRef.current
              if (target) {
                e.preventDefault()
                segmentRefs.current[target]?.focus()
              }
            }}
          >
            {openSegment === "colors" && (
              <PalettePicker
                palettes={PALETTE_PRESETS}
                value={theme?.colors?.schemeId}
                mode={theme?.appearance?.mode ?? "light"}
                onChange={(patch) => handleUpdate(patch)}
              />
            )}
            {openSegment === "fonts" && (
              <FontPicker
                fonts={FONT_PRESETS}
                value={theme?.fonts?.schemeId}
                onChange={(next) => handleUpdate({ fonts: next })}
              />
            )}
            {openSegment === "shape" && (
              <ShapeControl
                shapeId={theme?.shape?.schemeId}
                radiusLevels={RADIUS_PRESETS}
                onChange={(next) => handleUpdate({ shape: next })}
              />
            )}
            {openSegment === "density" && (
              <DensityControl
                densityId={theme?.density?.schemeId}
                levels={DENSITY_PRESETS}
                onChange={(next) => handleUpdate({ density: next })}
              />
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export function PreviewCommandBar({
  theme,
  onThemeChange,
  onShuffleTheme,
  onDefaultTheme,
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
  customerNavigationBlocked,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  onShuffleTheme: () => void
  onDefaultTheme: () => void
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
      <div className="pointer-events-auto grid w-full grid-cols-[auto_1fr] items-center gap-1 border-t bg-background px-3 py-2 shadow-lg md:inline-flex md:w-auto md:grid-cols-none md:justify-center md:gap-2 md:rounded-lg md:border-0 md:bg-background/90 md:p-3 md:shadow-2xl md:backdrop-blur-xl">
        <PreviewThemeToolbar
          theme={theme}
          onThemeChange={onThemeChange}
          onShuffleTheme={onShuffleTheme}
          onDefaultTheme={onDefaultTheme}
        />

        <div className="flex justify-self-end items-center gap-2">
          <Button asChild variant="default" size="default" className={`h-12 w-12 rounded-md px-0 md:h-9 md:w-auto md:px-5 ${blockedClassName}`}>
            <a
              href={customerNavigationBlocked ? undefined : reviewHref}
              aria-label={t("reviewChanges")}
              title={t("reviewChanges")}
              {...blockedAnchorProps}
            >
              <SquarePen className="size-5" aria-hidden />
              <span className="sr-only md:not-sr-only md:ml-2">{t("reviewChanges")}</span>
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
