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
  const initialThemeRef = React.useRef(JSON.stringify(normalizeThemeForSave(theme) ?? {}))
  const latestThemeRef = React.useRef(initialThemeRef.current)
  const themeVersionRef = React.useRef(0)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const form = useForm<PreviewCanvasFormValues>({
    defaultValues: { blocks: page.blocks ?? [] },
  })

  React.useEffect(() => {
    form.reset({ blocks: page.blocks ?? [] })
  }, [form, page.id, page.blocks])

  React.useEffect(() => {
    const normalizedTheme = normalizeThemeForSave(themeState)
    const serialized = JSON.stringify(normalizedTheme ?? {})
    latestThemeRef.current = serialized
    const requestVersion = ++themeVersionRef.current
    if (serialized === initialThemeRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const requestSerializedTheme = serialized
      setPreviewTheme(access, normalizedTheme ?? {})
        .then((saved) => {
          if (!shouldApplyPreviewThemeSaveResponse({
            latestSerializedTheme: latestThemeRef.current,
            latestVersion: themeVersionRef.current,
            requestSerializedTheme,
            requestVersion,
          })) {
            return
          }
          const savedTheme = normalizeThemeForSave(saved)
          initialThemeRef.current = JSON.stringify(savedTheme ?? {})
          setThemeState(savedTheme)
        })
        .catch(() => {})
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [themeState, access])

  const paymentSatisfied = paymentState?.status === "completed" || paymentState?.status === "waived"
  const canCompleteOrder = access.type === "grant" && !paymentSatisfied
  const checkoutHref = access.type === "grant" ? `/${access.clientSlug}/checkout` : "#"
  const reviewHref = access.type === "grant" ? `/${access.clientSlug}/review` : "#"
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
                  onThemeChange={setThemeState}
                  palettes={PALETTE_PRESETS}
                  fonts={FONT_PRESETS}
                  radiusLevels={RADIUS_PRESETS}
                />
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
            />
          </CanvasSelectionProvider>
        </form>
      </Form>
    </RtManifestProvider>
  )
}

function PreviewCommandBar({
  canCompleteOrder,
  paymentSatisfied,
  checkoutHref,
  reviewHref,
}: {
  canCompleteOrder: boolean
  paymentSatisfied: boolean
  checkoutHref: string
  reviewHref: string
}) {
  const t = useTranslations("preview")
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-3 py-3 shadow-lg">
      <div className="flex w-full justify-end">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
          <Button asChild variant="default" className="w-full sm:w-auto">
            <a href={reviewHref}>
              <SquarePen className="size-4" />
              {t("reviewChanges")}
            </a>
          </Button>
          {canCompleteOrder && (
            <Button asChild variant="success" className="w-full sm:w-auto">
              <a href={checkoutHref}>
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
