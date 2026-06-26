"use client"

import "@siteinabox/site-renderer/styles.css"
import * as React from "react"
import { SitePageRenderer } from "@siteinabox/site-renderer"
import type { Page, SiteSettings, ThemeTokenSpec } from "@siteinabox/contracts"
import { AlertCircle, Check, CheckCircle2, Clock, CreditCard, Loader2 } from "lucide-react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { ThemeBar } from "@/components/editor/theme/theme-bar"
import { setPreviewTheme, approvePreviewSite, createPreviewMollieCheckout } from "@/lib/actions/previewCustomizer"
import type {
  PreviewApprovalState,
  PreviewCustomizerAccess,
  PreviewPageSummary,
  PreviewPaymentState,
} from "@/lib/preview/customizer"
import type { RtManifest } from "@/lib/richText/manifest"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import type { ThemeTokens } from "@/lib/theme/schema"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS, STYLE_PRESETS } from "@/lib/theme/presets"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

type SaveState = "idle" | "saving" | "saved" | "error"

const formatExpiry = (exp: number) => {
  const date = new Date(exp * 1000)
  return Number.isNaN(date.getTime()) ? "Unknown expiry" : date.toLocaleString("nl-NL")
}

export function PreviewCustomizer({
  access,
  pages,
  page,
  settings,
  manifest,
  theme,
  approval,
  payment,
}: {
  access: PreviewCustomizerAccess
  pages: PreviewPageSummary[]
  page: Page
  settings: SiteSettings
  manifest: RtManifest
  theme: ThemeTokens | null
  approval: PreviewApprovalState | null
  payment: PreviewPaymentState | null
}) {
  const nonce = useCspNonce()
  const [themeState, setThemeState] = React.useState<ThemeTokens | null>(() => normalizeThemeForSave(theme))
  const [themeSaveState, setThemeSaveState] = React.useState<SaveState>("idle")
  const [themeMessage, setThemeMessage] = React.useState<string | null>(null)
  const [approvalState, setApprovalState] = React.useState<PreviewApprovalState | null>(approval)
  const [paymentState, setPaymentState] = React.useState<PreviewPaymentState | null>(payment)
  const [approveState, setApproveState] = React.useState<SaveState>("idle")
  const [approveMessage, setApproveMessage] = React.useState<string | null>(null)
  const [checkoutState, setCheckoutState] = React.useState<SaveState>("idle")
  const [checkoutMessage, setCheckoutMessage] = React.useState<string | null>(null)
  const initialThemeRef = React.useRef(JSON.stringify(normalizeThemeForSave(theme) ?? {}))
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const serialized = JSON.stringify(normalizeThemeForSave(themeState) ?? {})
    if (serialized === initialThemeRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setThemeSaveState("saving")
      setThemeMessage(null)
      setPreviewTheme(access, themeState ?? {})
        .then((saved) => {
          initialThemeRef.current = JSON.stringify(saved ?? {})
          setThemeState(saved)
          setThemeSaveState("saved")
          setThemeMessage("Style changes saved.")
        })
        .catch((error) => {
          setThemeSaveState("error")
          setThemeMessage(error instanceof Error ? error.message : "Style changes could not be saved.")
        })
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [themeState, access])

  const rendererTheme = React.useMemo<ThemeTokenSpec | null>(
    () => cmsThemeToRendererTheme(themeState),
    [themeState],
  )

  const handleApprove = () => {
    setApproveState("saving")
    setApproveMessage(null)
    approvePreviewSite(access)
      .then((next) => {
        setApprovalState(next.approval)
        setPaymentState(next.payment)
        setApproveState("saved")
        setApproveMessage("Approval recorded. Continue to checkout when you are ready.")
      })
      .catch((error) => {
        setApproveState("error")
        setApproveMessage(error instanceof Error ? error.message : "Approval could not be recorded.")
      })
  }
  const handleCheckout = () => {
    setCheckoutState("saving")
    setCheckoutMessage(null)
    createPreviewMollieCheckout(access)
      .then((next) => {
        setPaymentState(next.payment)
        window.location.assign(next.checkoutUrl)
      })
      .catch((error) => {
        setCheckoutState("error")
        setCheckoutMessage(error instanceof Error ? error.message : "Checkout could not be started.")
      })
  }
  const saveStatus =
    themeSaveState === "saving"
      ? "Saving styles"
      : themeSaveState === "saved"
        ? themeMessage
        : themeSaveState === "error"
          ? themeMessage
          : "Styles ready"
  const paymentStatus = paymentState?.status ? paymentState.status.replace(/_/g, " ") : "not started"
  const paymentSatisfied = paymentState?.status === "completed" || paymentState?.status === "waived"
  const canCheckout = access.type === "grant" && approvalState?.status === "approved" && !paymentSatisfied
  const pageHref = (summary: PreviewPageSummary) =>
    access.type === "grant"
      ? (summary.slug === "index" || summary.slug === "home"
          ? `/${access.clientSlug}`
          : `/${access.clientSlug}/pages/${encodeURIComponent(summary.slug)}`)
      : `/preview/${access.token}?page=${encodeURIComponent(summary.slug)}`

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="sticky top-0 z-20 flex shrink-0 flex-col border-b bg-background/95 backdrop-blur">
        <div className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Preview pages">
            {pages.map((summary) => {
              const active = String(summary.slug) === String(page.slug) || String(summary.id) === String(page.id)
              return (
                <Button key={summary.id} asChild size="sm" variant={active ? "default" : "outline"}>
                  <a href={pageHref(summary)} aria-current={active ? "page" : undefined}>
                    {summary.title || summary.slug}
                  </a>
                </Button>
              )
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={themeSaveState === "error" ? "destructive" : themeSaveState === "saving" ? "secondary" : "outline"}>
              {themeSaveState === "saving" ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : themeSaveState === "error" ? (
                <AlertCircle className="size-3" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3" aria-hidden />
              )}
              {saveStatus}
            </Badge>
            {access.type === "legacy-token" && (
              <Badge variant="outline">
                <Clock className="size-3" aria-hidden />
                Expires {formatExpiry(access.exp)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex justify-center px-3 pb-2">
          <ThemeBar
            theme={themeState}
            manifest={manifest}
            onThemeChange={setThemeState}
            palettes={PALETTE_PRESETS}
            fonts={FONT_PRESETS}
            radiusLevels={RADIUS_PRESETS}
            densityLevels={DENSITY_PRESETS}
            stylePresetLevels={STYLE_PRESETS}
          />
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-auto bg-background">
        <SitePageRenderer
          page={page}
          settings={settings}
          theme={rendererTheme}
          nonce={nonce}
          canvasClassName="preview-customizer-canvas min-h-full [&_a[href]]:pointer-events-none"
          formAction="#"
        />
      </main>

      <footer className="z-20 shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={approvalState?.status === "approved" ? "success" : "secondary"}>
              {approvalState?.status === "approved" ? "Approved" : "Pending approval"}
            </Badge>
            <span>Payment gate: {paymentStatus}</span>
            {approveState === "error" && approveMessage && (
              <span className="text-destructive">{approveMessage}</span>
            )}
            {approveState === "saved" && approveMessage && (
              <span>{approveMessage}</span>
            )}
            {checkoutState === "error" && checkoutMessage && (
              <span className="text-destructive">{checkoutMessage}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canCheckout && (
              <Button type="button" variant="outline" onClick={handleCheckout} disabled={checkoutState === "saving"}>
                {checkoutState === "saving" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CreditCard className="size-4" />
                )}
                Pay with Mollie
              </Button>
            )}
            <Button type="button" onClick={handleApprove} disabled={approveState === "saving" || approvalState?.status === "approved"}>
              {approveState === "saving" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : approvalState?.status === "approved" ? (
                <Check className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {approvalState?.status === "approved" ? "Approved" : "Approve preview"}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
