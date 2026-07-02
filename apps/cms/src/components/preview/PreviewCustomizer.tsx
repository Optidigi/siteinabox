"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { CheckCircle2, Rocket, SquarePen } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Form } from "@siteinabox/ui/components/form"
import { BlockPresetsProvider } from "@/components/editor/canvas/BlockPresetsContext"
import { CanvasMode } from "@/components/editor/canvas/CanvasMode"
import { CanvasSelectionProvider } from "@/components/editor/canvas/CanvasSelectionContext"
import {
  SiteChromeActionFrame,
  SiteChromePreview,
  type SiteChromeSelection,
  type SiteChromeSelectPoint,
} from "@/components/editor/canvas/SiteChromePreview"
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

type PreviewCanvasFormValues = { blocks: Page["blocks"] }
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
  const pendingSaveRef = React.useRef<QueuedPreviewThemeSave | null>(null)
  const inFlightSaveRef = React.useRef<QueuedPreviewThemeSave | null>(null)
  const [themeSaveStatus, setThemeSaveStatus] = React.useState<PreviewThemeSaveStatus>("idle")
  const form = useForm<PreviewCanvasFormValues>({
    defaultValues: { blocks: page.blocks ?? [] },
  })
  themeStateRef.current = themeState

  React.useEffect(() => {
    form.reset({ blocks: page.blocks ?? [] })
  }, [form, page.id, page.blocks])

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
  const preventCustomerChromeSelection = React.useCallback((_selection?: SiteChromeSelection, _point?: SiteChromeSelectPoint) => {}, [])
  const preventCustomerChromeNavigate = React.useCallback((_href: string) => {}, [])
  const headerChrome = (
    <SiteChromePreview
      zone="header"
      settings={settings}
      manifest={manifest}
      onNavigate={preventCustomerChromeNavigate}
      onSelect={preventCustomerChromeSelection}
    />
  )
  const footerChrome = (
    <SiteChromePreview
      zone="footer"
      settings={settings}
      manifest={manifest}
      onNavigate={preventCustomerChromeNavigate}
      onSelect={preventCustomerChromeSelection}
    />
  )
  const renderHeaderChrome = React.useCallback((defaultChrome: React.ReactNode) => (
    <SiteChromeActionFrame
      zone="header"
      onNavigate={preventCustomerChromeNavigate}
      onSelect={preventCustomerChromeSelection}
    >
      {defaultChrome}
    </SiteChromeActionFrame>
  ), [preventCustomerChromeNavigate, preventCustomerChromeSelection])
  const renderFooterChrome = React.useCallback((defaultChrome: React.ReactNode) => (
    <SiteChromeActionFrame
      zone="footer"
      onNavigate={preventCustomerChromeNavigate}
      onSelect={preventCustomerChromeSelection}
    >
      {defaultChrome}
    </SiteChromeActionFrame>
  ), [preventCustomerChromeNavigate, preventCustomerChromeSelection])

  return (
    <RtManifestProvider manifest={manifest}>
      <Form {...form}>
        <form className="min-h-dvh bg-background text-foreground" onSubmit={(event) => event.preventDefault()}>
          <CanvasSelectionProvider value={{ view: "preview", selected: null, select: () => {} }}>
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
              <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
                <CanvasMode
                  view="preview"
                  manifest={manifest}
                  tenantCss={null}
                  theme={themeState}
                  rendererSettings={settings}
                  tenantId={tenantId}
                  tenantSlug={tenantSlug}
                  tenantDomain={domain}
                  readOnly
                  headerChrome={headerChrome}
                  footerChrome={footerChrome}
                  renderHeaderChrome={renderHeaderChrome}
                  renderFooterChrome={renderFooterChrome}
                  reorderBlocks={() => {}}
                  deleteBlock={() => {}}
                  duplicateBlock={() => {}}
                  pageTitle={page.title || t("metadataTitle")}
                  onDeletePage={() => {}}
                />
              </BlockPresetsProvider>
            </main>

            <PreviewCommandBar
              canCompleteOrder={canCompleteOrder}
              paymentSatisfied={paymentSatisfied}
              checkoutHref={checkoutHref}
              reviewHref={reviewHref}
              customerNavigationBlocked={customerNavigationBlocked}
            />
          </CanvasSelectionProvider>
        </form>
      </Form>
    </RtManifestProvider>
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
