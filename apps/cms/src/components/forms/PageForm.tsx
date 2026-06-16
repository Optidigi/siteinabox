"use client"
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { Form } from "@siteinabox/ui/components/form"
import { Input } from "@siteinabox/ui/components/input"
import { Switch } from "@siteinabox/ui/components/switch"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { RtManifestProvider, useRtManifest } from "@/components/editor/RtManifestContext"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { PublishControls } from "@/components/editor/publish-controls"
import { PageMetaInline } from "@/components/editor/page-meta-inline"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { PageDraftRecoveryDialog } from "@/components/forms/PageDraftRecoveryDialog"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { parsePayloadError } from "@/lib/api"
import { scrollToFirstError } from "@/lib/formScroll"
import { ChevronLeft, Trash2, ExternalLink, Copy, Navigation, PanelBottom, PanelTop, Plus, X, SlidersHorizontal } from "lucide-react"
import type { Page } from "@/payload-types"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { PALETTE_PRESETS, FONT_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { type EditorMode, resolveDefaultMode } from "@/lib/editor/editorMode"
import { EDITOR_DESKTOP_BREAKPOINT } from "@/lib/editor/constants"
import { ModeBar } from "@/components/editor/mode/mode-bar"
import { CanvasMode } from "@/components/editor/canvas/CanvasMode"
import {
  MobileInspectorBarLayout,
  type MobileInspectorBarSlotContext,
} from "@/components/editor/canvas/mobile/mobile-inspector-bar"
import {
  MobilePageSettingsLayout,
  type MobilePageSettingsSlotContext,
} from "@/components/editor/canvas/mobile/mobile-page-settings"
import {
  MobileSectionEditLayout,
  type MobileSectionEditSlotContext,
} from "@/components/editor/canvas/mobile/mobile-section-edit"
import {
  MobileSectionListLayout,
  type MobileSectionListSlotContext,
} from "@/components/editor/canvas/mobile/mobile-section-list"
import {
  MobileSeoSettingsLayout,
  type MobileSeoSettingsSlotContext,
} from "@/components/editor/canvas/mobile/mobile-seo-settings"
import { BlockPresetsProvider } from "@/components/editor/canvas/BlockPresetsContext"
import { MobileMediaSheetProvider } from "@/components/editor/canvas/MobileMediaSheetContext"
import {
  SidebarBlockFormLayout,
  SidebarDrillDown,
  type SidebarBlockFormSlotContext,
  SidebarListLayout,
  type SidebarListSlotContext,
  SidebarPageSettingsLayout,
  type SidebarPageSettingsSlotContext,
} from "@/components/editor/sidebar-drill-down"
import { CanvasSelectionProvider } from "@/components/editor/canvas/CanvasSelectionContext"
import type { ElementPath } from "@/components/editor/canvas/elementPath"
import {
  remapSelectionAfterDelete,
  remapSelectionAfterInsert,
  remapSelectionAfterReorder,
} from "@/components/editor/canvas/elementPath"
import { EditorErrorBoundary } from "@/components/editor/EditorErrorBoundary"
import { setUserEditorMode } from "@/lib/actions/setUserEditorMode"
import { ThemeBar } from "@/components/editor/theme/theme-bar"
import { setTenantTheme } from "@/lib/actions/setTenantTheme"
import { togglePageInNav } from "@/lib/actions/togglePageInNav"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { countLeafDirty } from "@/lib/countLeafDirty"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { useStatusFeedback } from "@/components/status-feedback"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import {
  deletePageEditorDraft,
  readPageEditorDraft,
  writePageEditorDraft,
  type PageEditorDraft,
} from "@/lib/editor/pageDraftStore"
import { useTranslations } from "next-intl"
import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { SiteChromePreview, SiteChromeRow, type SiteChromeSelection, type SiteChromeSelectPoint, type SiteChromeZone } from "@/components/editor/canvas/SiteChromePreview"
import { MediaPicker } from "@/components/media/MediaPicker"
import {
  createFooterItem,
  defaultFooterItemLabel,
  ensureFooterColumnItems,
  normalizeFooterColumns,
  resolveFooterContract,
  setFooterColumnCount,
  type FooterCompositionColumn,
  type FooterCompositionContract,
  type FooterItemType,
} from "@/lib/footerComposition"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"
import {
  chromeComparable,
  chromeDraftFromSettings,
  chromePatchFromDraft,
  mergeChromeSettings,
  type SiteChromeDraft,
} from "@/lib/siteChromeDraft"

export { useRtManifest }

/**
 * SSR-safe editor desktop media query hook. Defaults to `false` on
 * the first render so the mobile-only layout renders identically on
 * server and client (no hydration mismatch). Once mounted, listens for
 * matchMedia changes so a DevTools resize flips state without a refresh.
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_DESKTOP_BREAKPOINT}px)`)
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return isDesktop
}

const pageEditorStyleCache = new Map<string, {
  tenantCss: string | null
  theme: ThemeTokens | null
}>()

/**
 * Payload upload fields accept either a numeric id or null. The form may
 * hold a fully populated Media object after a fetched page is loaded
 * with depth>=1. Normalize back to id (or null) before submit so we
 * don't trip a Payload v3.84.1 upstream bug in beforeValidate where
 * parseFloat(<object>) returns NaN and validation rejects the field.
 *
 * Any non-primitive shape that ISN'T `{ id, ... }` collapses to null —
 * sending `{}` or any malformed object would re-trigger the same upstream
 * parseFloat-over-object → NaN path we're working around.
 */
const createSchema = (t: (key: string) => string) => z.object({
  title: z.string().min(1, t("titleRequired")),
  slug: z.string().regex(/^[a-z0-9-]+$/, t("slugValidation")),
  status: z.enum(["draft", "published"], {
    message: t("statusValidation")
  }),
  blocks: z.array(z.any()),
  // `.nullish()` (T | null | undefined) is load-bearing — Postgres returns
  // `null` for unset optional text columns inside groups, and `payload-types`
  // declares `seo.title?: string | null`. With plain `.optional()` (T |
  // undefined only) zod rejects those nulls on second save: a fresh page
  // post-create has `defaultValues.seo = {title: null, description: null,
  // ogImage: null}` — the parent `??` short-circuit doesn't dig into the
  // children — and `handleSubmit` short-circuits to `onInvalid` before any
  // network call, lighting both text fields red. ogImage uses `z.any()`
  // which already tolerates null, but standardise on `.nullish()` so the
  // intent is uniform across the group.
  seo: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    ogImage: z.any().nullish()
  }).nullish()
})
type Values = z.infer<ReturnType<typeof createSchema>>

function FooterCompositionEditor({
  draft,
  setDraft,
  contract,
  canEditSettings,
}: {
  draft: SiteChromeDraft
  setDraft: Dispatch<SetStateAction<SiteChromeDraft>>
  contract: FooterCompositionContract
  canEditSettings?: boolean
}) {
  const t = useTranslations("editor")
  const columns = ensureFooterColumnItems(
    setFooterColumnCount(draft.footer.columns, draft.footer.columns.length || contract.defaultColumnCount, contract),
    contract,
  )
  const itemLabel = (type: FooterItemType) =>
    contract.items.find((item) => item.type === type)?.label ?? defaultFooterItemLabel(type)
  const setColumns = (nextColumns: FooterCompositionColumn[]) => {
    if (!canEditSettings) return
    setDraft((current) => ({
      ...current,
      footer: { ...current.footer, columns: ensureFooterColumnItems(normalizeFooterColumns(nextColumns, contract), contract) },
    }))
  }
  const updateItem = (
    columnIndex: number,
    patch: Partial<FooterCompositionColumn["items"][number]>,
  ) => {
    setColumns(columns.map((column, cIndex) => cIndex !== columnIndex
      ? column
      : {
          ...column,
          items: [{ ...column.items[0]!, ...patch }],
        }))
  }
  const setColumnType = (columnIndex: number, type: FooterItemType) => {
    setColumns(columns.map((column, cIndex) => cIndex !== columnIndex
      ? column
      : { ...column, items: [{ ...createFooterItem(type), id: column.items[0]?.id ?? undefined }] }))
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("footerLayout")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("footerLayoutDescription")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="site-chrome-footer-columns">{t("footerColumns")}</Label>
        <Select
          value={String(columns.length)}
          disabled={!canEditSettings}
          onValueChange={(value) => setColumns(setFooterColumnCount(columns, Number(value), contract))}
        >
          <SelectTrigger id="site-chrome-footer-columns" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contract.columnCounts.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {t("footerColumnCount", { count })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        {columns.map((column, columnIndex) => {
          const item = column.items[0]!
          return (
          <div key={column.id ?? columnIndex} className="space-y-3 rounded-md border border-border bg-background p-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t("footerColumn", { index: columnIndex + 1 })}
              </h3>
              <Select
                value={item.type}
                disabled={!canEditSettings}
                onValueChange={(type) => setColumnType(columnIndex, type as FooterItemType)}
              >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contract.items.map((item) => (
                      <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            {(item.type === "text" || item.type === "links") && (
            <div className="space-y-3 rounded-md border border-border bg-card p-3">
                      <div className="space-y-2">
                        <Label>{t("footerItemLabel")}</Label>
                        <Input
                          value={item.label ?? ""}
                          placeholder={itemLabel(item.type)}
                          disabled={!canEditSettings}
                          onChange={(event) => updateItem(columnIndex, { label: event.target.value || null })}
                        />
                      </div>

                    {item.type === "text" && (
                      <div className="space-y-2">
                        <Label>{t("footerItemText")}</Label>
                        <Textarea
                          value={item.text ?? ""}
                          disabled={!canEditSettings}
                          onChange={(event) => updateItem(columnIndex, { text: event.target.value || null })}
                        />
                      </div>
                    )}

                    {item.type === "links" && (
                      <div className="space-y-2">
                        <Label>{t("footerLinks")}</Label>
                        <div className="space-y-2">
                          {(item.links?.length ? item.links : [{ label: "", href: "" }]).map((link, linkIndex) => (
                            <div key={linkIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                              <Input
                                value={link.label}
                                placeholder={t("footerLinkLabel")}
                                disabled={!canEditSettings}
                                onChange={(event) => {
                                  const links = [...(item.links ?? [])]
                                  links[linkIndex] = { ...(links[linkIndex] ?? { label: "", href: "" }), label: event.target.value }
                                  updateItem(columnIndex, { links })
                                }}
                              />
                              <Input
                                value={link.href}
                                placeholder="/"
                                disabled={!canEditSettings}
                                onChange={(event) => {
                                  const links = [...(item.links ?? [])]
                                  links[linkIndex] = { ...(links[linkIndex] ?? { label: "", href: "" }), href: event.target.value }
                                  updateItem(columnIndex, { links })
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!canEditSettings}
                                aria-label={t("removeFooterLink")}
                                onClick={() => {
                                  const links = (item.links ?? []).filter((_, index) => index !== linkIndex)
                                  updateItem(columnIndex, { links })
                                }}
                              >
                                <X className="size-4" aria-hidden />
                              </Button>
                            </div>
                          ))}
                        </div>
                        {canEditSettings && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => updateItem(columnIndex, {
                              links: [...(item.links ?? []), { label: "Link", href: "/" }],
                            })}
                          >
                            <Plus className="size-3.5" aria-hidden />
                            {t("addFooterLink")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
            )}
          </div>
        )})}
      </div>
    </section>
  )
}

function SiteChromeInspectorFields({
  zone,
  draft,
  setDraft,
  tenantId,
  canEditSettings,
  navigationHref,
  onNavigate,
  footerContract,
}: {
  zone: SiteChromeZone
  draft: SiteChromeDraft
  setDraft: Dispatch<SetStateAction<SiteChromeDraft>>
  tenantId: number | string
  canEditSettings?: boolean
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  footerContract?: FooterCompositionContract | null
}) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const logo = zone === "header" ? draft.header.logo : draft.footer.logo
  const setLogo = (logoValue: unknown) => {
    if (!canEditSettings) return
    setDraft((current) => zone === "header"
      ? { ...current, header: { ...current.header, logo: logoValue } }
      : { ...current, footer: { ...current.footer, logo: logoValue } })
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("brand")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("logoOverrideDescription")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("customLogo")}</Label>
          {canEditSettings ? (
            <MediaPicker value={logo} onChange={setLogo} relationTo="media" tenantId={tenantId} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("siteChromeReadOnly")}</p>
          )}
        </div>
      </section>

      {zone === "footer" && (
        <>
          {footerContract && (
            <FooterCompositionEditor
              draft={draft}
              setDraft={setDraft}
              contract={footerContract}
              canEditSettings={canEditSettings}
            />
          )}
          <section className="space-y-3 rounded-md border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">{t("footerContent")}</h2>
            <div className="space-y-2">
              <Label htmlFor="site-chrome-footer-text">{t("footerText")}</Label>
              <Textarea
                id="site-chrome-footer-text"
                value={draft.footer.tagline ?? ""}
                disabled={!canEditSettings}
                onChange={(event) => {
                  const value = event.target.value
                  setDraft((current) => ({
                    ...current,
                    footer: { ...current.footer, tagline: value || null },
                  }))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-chrome-footer-copyright">{t("copyright")}</Label>
              <Input
                id="site-chrome-footer-copyright"
                value={draft.footer.copyright ?? ""}
                disabled={!canEditSettings}
                onChange={(event) => {
                  const value = event.target.value
                  setDraft((current) => ({
                    ...current,
                    footer: { ...current.footer, copyright: value || null },
                  }))
                }}
              />
            </div>
          </section>
        </>
      )}

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">{t("navigation")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("siteChromeManagedElsewhere")}</p>
        {navigationHref && (
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => onNavigate?.(navigationHref)}>
            <Navigation className="size-3.5" aria-hidden />
            {t("manageNavigation")}
          </Button>
        )}
      </section>

      {canEditSettings && (
        <p className="text-xs text-muted-foreground">{tCommon("save")}: {t("siteChromeSaveHint")}</p>
      )}
    </div>
  )
}

function SiteChromeDrillDown({
  selection,
  draft,
  setDraft,
  tenantId,
  canEditSettings,
  navigationHref,
  onNavigate,
  footerContract,
  onBack,
}: {
  selection: SiteChromeSelection
  draft: SiteChromeDraft
  setDraft: Dispatch<SetStateAction<SiteChromeDraft>>
  tenantId: number | string
  canEditSettings?: boolean
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  footerContract?: FooterCompositionContract | null
  onBack: () => void
}) {
  const t = useTranslations("editor")
  const zone = selection.zone
  const label = zone === "header" ? "Header" : "Footer"
  const Icon = zone === "header" ? PanelTop : PanelBottom
  const header = (
    <>
      <header className="flex items-center border-b border-border px-3 py-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1"
          aria-label={t("backToBlockList")}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("back")}
        </Button>
      </header>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </header>
    </>
  )
  const body = (
    <SiteChromeInspectorFields
      zone={zone}
      draft={draft}
      setDraft={setDraft}
      tenantId={tenantId}
      canEditSettings={canEditSettings}
      navigationHref={navigationHref}
      onNavigate={onNavigate}
      footerContract={footerContract}
    />
  )

  return (
    <SidebarPageSettingsLayout
      header={header}
      body={body}
      footer={null}
    />
  )
}

function SiteChromeQuickMenu({
  menu,
  draft,
  setDraft,
  tenantId,
  canEditSettings,
  navigationHref,
  onNavigate,
  footerContract,
  onOpenInspector,
  onClose,
}: {
  menu: { selection: SiteChromeSelection; point: SiteChromeSelectPoint } | null
  draft: SiteChromeDraft
  setDraft: Dispatch<SetStateAction<SiteChromeDraft>>
  tenantId: number | string
  canEditSettings?: boolean
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  footerContract?: FooterCompositionContract | null
  onOpenInspector: (selection: SiteChromeSelection) => void
  onClose: () => void
}) {
  const t = useTranslations("editor")
  const [panel, setPanel] = useState<"main" | "columns" | "items" | "logo">("main")

  useEffect(() => {
    if (!menu) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [menu, onClose])

  useEffect(() => {
    setPanel("main")
  }, [menu?.selection.zone, menu?.point.x, menu?.point.y])

  const hasDocument = typeof document !== "undefined"
  // siab-responsive-ignore-next-line -- CMS quick menu is positioned against the browser viewport.
  const left = menu && hasDocument ? Math.max(8, Math.min(menu.point.x, window.innerWidth - 368)) : 0
  // siab-responsive-ignore-next-line -- CMS quick menu is positioned against the browser viewport.
  const top = menu && hasDocument ? Math.max(8, Math.min(menu.point.y, window.innerHeight - 320)) : 0
  const menuPosition = useCspStyleRule(
    "site-chrome-quick-menu",
    menu && hasDocument ? `left:${formatCssPx(left)};top:${formatCssPx(top)};` : null,
  )

  if (!menu || !hasDocument) return null

  const zone = menu.selection.zone
  const logo = zone === "header" ? draft.header.logo : draft.footer.logo
  const setLogo = (logoValue: unknown) => {
    if (!canEditSettings) return
    setDraft((current) => zone === "header"
      ? { ...current, header: { ...current.header, logo: logoValue } }
      : { ...current, footer: { ...current.footer, logo: logoValue } })
  }
  const columns = footerContract
    ? ensureFooterColumnItems(
        setFooterColumnCount(draft.footer.columns, draft.footer.columns.length || footerContract.defaultColumnCount, footerContract),
        footerContract,
      )
    : []
  const setColumns = (nextColumns: FooterCompositionColumn[]) => {
    if (!canEditSettings || !footerContract) return
    setDraft((current) => ({
      ...current,
      footer: { ...current.footer, columns: ensureFooterColumnItems(normalizeFooterColumns(nextColumns, footerContract), footerContract) },
    }))
  }
  const setColumnType = (columnIndex: number, type: FooterItemType) => {
    if (!footerContract) return
    setColumns(columns.map((column, index) => index !== columnIndex
      ? column
      : { ...column, items: [{ ...createFooterItem(type), id: column.items[0]?.id ?? undefined }] }))
  }
  const title = zone === "header" ? "Header" : "Footer"
  const footerActions = (
    <div className={`${navigationHref ? "grid-cols-2" : "grid-cols-1"} grid gap-2 border-t border-border pt-3`}>
      {navigationHref && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => {
            onClose()
            onNavigate?.(navigationHref)
          }}
        >
          <Navigation className="size-3.5" aria-hidden />
          {t("manageNavigation")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => onOpenInspector(menu.selection)}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden />
        {t("openInspector")}
      </Button>
    </div>
  )
  const submenuHeader = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => setPanel("main")}
        aria-label={t("back")}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 font-sans"
      role="presentation"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      {menuPosition.styleElement}
      <div
        className={`${menuPosition.className} fixed max-h-[min(28rem,calc(100vh-1rem))] w-88 space-y-3 overflow-y-auto rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md`}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {panel === "main" && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {zone === "footer" ? t("footerQuickMenuDescription") : t("siteChromeManagedElsewhere")}
              </p>
            </div>
            <div className="space-y-2">
              {zone === "footer" && footerContract && (
                <>
                  <Button type="button" variant="ghost" className="h-9 w-full justify-start px-2" onClick={() => setPanel("columns")}>
                    {t("columnsAmount")}
                  </Button>
                  <Button type="button" variant="ghost" className="h-9 w-full justify-start px-2" onClick={() => setPanel("items")}>
                    {t("editColumns")}
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" className="h-9 w-full justify-start px-2" onClick={() => setPanel("logo")}>
                {t("editCustomLogo")}
              </Button>
            </div>
            {footerActions}
          </>
        )}

        {panel === "columns" && zone === "footer" && footerContract && (
          <>
            {submenuHeader}
            <div className="space-y-1.5">
              <Label htmlFor="footer-quick-columns" className="text-xs">{t("columnsAmount")}</Label>
              <Select
                value={String(columns.length)}
                disabled={!canEditSettings}
                onValueChange={(value) => setColumns(setFooterColumnCount(columns, Number(value), footerContract))}
              >
                <SelectTrigger id="footer-quick-columns" className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {footerContract.columnCounts.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {t("footerColumnCount", { count })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {footerActions}
          </>
        )}

        {panel === "items" && zone === "footer" && footerContract && (
          <>
            {submenuHeader}
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div key={column.id ?? index} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("footerColumn", { index: index + 1 })}</Label>
                  <Select
                    value={column.items[0]?.type}
                    disabled={!canEditSettings}
                    onValueChange={(type) => setColumnType(index, type as FooterItemType)}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {footerContract.items.map((item) => (
                        <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {footerActions}
          </>
        )}

        {panel === "logo" && (
          <>
            {submenuHeader}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("customLogo")}</Label>
              {canEditSettings ? (
                <MediaPicker value={logo} onChange={setLogo} relationTo="media" tenantId={tenantId} />
              ) : (
                <p className="text-xs text-muted-foreground">{t("siteChromeReadOnly")}</p>
              )}
            </div>
            {footerActions}
          </>
          )}
      </div>
    </div>,
    document.body,
  )
}

export function PageForm({ initial, tenantId, baseHref, tenantOrigin, manifest, userEditorMode, tenantCss, theme, siteSettings, canManageNav, canEditSettings, inHeaderNav, inFooterNav, readOnly = false }: { initial?: Page; tenantId: number | string; baseHref: string; tenantOrigin: string; manifest: RtManifest; userEditorMode?: EditorMode | null; tenantCss?: string | null; theme?: ThemeTokens | null; siteSettings?: any; canManageNav?: boolean; canEditSettings?: boolean; inHeaderNav?: boolean; inFooterNav?: boolean; readOnly?: boolean }) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const schema = createSchema(t)
  const canEditPage = !readOnly
  const canManageNavResolved = canEditPage && !!canManageNav
  const canEditSettingsResolved = canEditPage && !!canEditSettings
  const seoFields = [
    { name: "title", type: "text", label: t("seoTitle") },
    { name: "description", type: "textarea", label: t("seoDescription") },
    { name: "ogImage", type: "upload", relationTo: "media", label: t("openGraphImage") }
  ]
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draftCandidate, setDraftCandidate] = useState<PageEditorDraft | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const draftCandidateRef = useRef<PageEditorDraft | null>(null)
  const draftWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // OBS-21 / FE-85 — page-flag nav membership. The two toggles are a view over
  // the tenant's SiteSettings nav lists, but changes are local until the page
  // Save button is pressed. This keeps navigation membership under the same
  // explicit-save contract as page fields and tenant theme changes.
  const [inHeader, setInHeader] = useState(!!inHeaderNav)
  const [inFooter, setInFooter] = useState(!!inFooterNav)
  const [savedInHeader, setSavedInHeader] = useState(!!inHeaderNav)
  const [savedInFooter, setSavedInFooter] = useState(!!inFooterNav)
  const navDirty = !!initial && (inHeader !== savedInHeader || inFooter !== savedInFooter)

  const toggleNav = useCallback(
    (zone: "header" | "footer", next: boolean) => {
      if (!canEditPage || !initial) return
      const setLocal = zone === "header" ? setInHeader : setInFooter
      setLocal(next)
    },
    [canEditPage, initial],
  )

  // Editor mode: resolved from user preference → manifest default → "canvas".
  // Both canvas and sidebar modes are persisted via server action.
  const [mode, setMode] = useState<EditorMode>(() => readOnly ? "canvas" : resolveDefaultMode(userEditorMode, manifest))

  // Theme state — seeded from the server-fetched tenant.theme prop (B2).
  // ThemeBar writes here for immediate canvas re-renders; persistence
  // piggybacks on the page-form Save cycle. `themeBaseline` is held as
  // STATE (not a ref) so updates to it re-trigger the `themeDirty`
  // memo — a ref would mutate silently and leave the badge stuck on
  // "unsaved" after a successful theme save.
  const tenantStyleCacheKey = String(tenantId)
  const cachedStyle = pageEditorStyleCache.get(tenantStyleCacheKey)
  const [themeState, setThemeState] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedStyle?.theme ?? null))
  const [themeBaseline, setThemeBaseline] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedStyle?.theme ?? null))
  const [stableTenantCss, setStableTenantCss] = useState<string | null>(() => tenantCss ?? cachedStyle?.tenantCss ?? null)
  const themeDirty = useMemo(
    () => JSON.stringify(themeState) !== JSON.stringify(themeBaseline),
    [themeState, themeBaseline],
  )

  useEffect(() => {
    if (tenantCss == null && theme == null) return
    const previous = pageEditorStyleCache.get(tenantStyleCacheKey)
    const normalizedTheme = normalizeThemeForSave(theme ?? previous?.theme ?? null)
    pageEditorStyleCache.set(tenantStyleCacheKey, {
      tenantCss: tenantCss ?? previous?.tenantCss ?? null,
      theme: normalizedTheme,
    })
    if (tenantCss != null) setStableTenantCss(tenantCss)
  }, [tenantCss, tenantStyleCacheKey, theme])

  // Element selection state — single source of truth.
  // SidebarDrillDown and the canvas's click-to-select BOTH write via the context's
  // select; SidebarDrillDown reads selected to know which block to open.
  const [selected, setSelected] = useState<ElementPath | null>(null)
  const [selectedChrome, setSelectedChrome] = useState<SiteChromeSelection | null>(null)
  const [chromeQuickMenu, setChromeQuickMenu] = useState<{ selection: SiteChromeSelection; point: SiteChromeSelectPoint } | null>(null)
  const siteSettingsState = siteSettings ?? null
  const footerContract = useMemo(() => resolveFooterContract(manifest), [manifest])
  const [chromeDraft, setChromeDraftState] = useState<SiteChromeDraft>(() => chromeDraftFromSettings(siteSettingsState, footerContract))
  const [chromeBaseline, setChromeBaselineState] = useState<SiteChromeDraft>(() => chromeDraftFromSettings(siteSettingsState, footerContract))
  const chromeDraftRef = useRef<SiteChromeDraft>(chromeDraft)
  const chromeBaselineRef = useRef<SiteChromeDraft>(chromeBaseline)
  const setChromeDraft = useCallback<Dispatch<SetStateAction<SiteChromeDraft>>>((next) => {
    const current = chromeDraftRef.current
    const resolved = typeof next === "function"
      ? (next as (previous: SiteChromeDraft) => SiteChromeDraft)(current)
      : next
    chromeDraftRef.current = resolved
    setChromeDraftState(resolved)
  }, [])
  const setChromeBaseline = useCallback<Dispatch<SetStateAction<SiteChromeDraft>>>((next) => {
    const current = chromeBaselineRef.current
    const resolved = typeof next === "function"
      ? (next as (previous: SiteChromeDraft) => SiteChromeDraft)(current)
      : next
    chromeBaselineRef.current = resolved
    setChromeBaselineState(resolved)
  }, [])
  const chromeDirty = useMemo(
    () => JSON.stringify(chromeComparable(chromeDraft, footerContract)) !== JSON.stringify(chromeComparable(chromeBaseline, footerContract)),
    [chromeDraft, chromeBaseline, footerContract],
  )
  const chromeSettingsState = useMemo(
    () => siteSettingsState ? mergeChromeSettings(siteSettingsState, chromeDraft) : null,
    [siteSettingsState, chromeDraft],
  )

  const selectElement = useCallback<Dispatch<SetStateAction<ElementPath | null>>>((next) => {
    if (readOnly) return
    setSelected((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      setSelectedChrome(null)
      setChromeQuickMenu(null)
      return resolved
    })
  }, [readOnly])

  const selectChrome = useCallback((selection: SiteChromeSelection, point?: SiteChromeSelectPoint) => {
    if (readOnly) return
    setSelected(null)
    setSelectedChrome(selection)
    if (mode === "canvas" && point) setChromeQuickMenu({ selection, point })
  }, [mode, readOnly])

  // Sidebar height tracks the canvas pane's bottom edge in the viewport, so
  // the sidebar's bottom never extends past the canvas's bottom — symmetric
  // with the sticky `top: CHROME_STACK_HEIGHT` that prevents the sidebar's
  // top from rising above the chrome. The static ResizeObserver-only
  // approach handled the "short canvas, no scroll" case but not the
  // "user scrolls down so canvas content end enters the viewport" case —
  // the sidebar (sticky at the chrome offset, full viewport height) would
  // continue past the canvas content's bottom.
  //
  // Fix: track the canvas pane's bounding rect on every scroll/resize via
  // rAF-throttled listener. Aside height = min(viewport, canvas-pane-bottom)
  // - CHROME - SIDEBAR_BOTTOM_GUTTER. Bumps any time the canvas pane
  // resizes too (block add/remove, image load, theme bar toggle, etc.).
  const canvasPaneRef = useRef<HTMLDivElement | null>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const canvasNode = canvasPaneRef.current
    if (!canvasNode) return
    let raf: number | null = null
    let lastHeightPx = -1
    const recompute = () => {
      raf = null
      const aside = asideRef.current
      const canvas = canvasPaneRef.current
      if (!aside || !canvas) return
      const rect = canvas.getBoundingClientRect()
      const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const baseChromePx = 6.5 * rootFs        // CHROME_STACK_HEIGHT in px
      const topGutterPx = 0.5 * rootFs         // matches theme bar's py-2 top
      const bottomGutterPx = 0.5 * rootFs      // breathing above viewport bottom
      const chromePx = baseChromePx + topGutterPx
      // rect.bottom INCLUDES the canvas pane's pb-24 padding (6rem) — that
      // padding is breathing room for the canvas content, not a continuation
      // of the canvas surface. The sidebar should bound by the *visible* end
      // of the canvas content, not the padded box bottom. Subtract pb-24.
      const canvasPbPx = 6 * rootFs            // matches pb-24 on the canvas pane
      const vh = window.innerHeight
      const canvasContentBottomInVp = rect.bottom - canvasPbPx
      const asideBottomInVp = Math.min(vh - bottomGutterPx, canvasContentBottomInVp)
      const next = Math.max(0, Math.round(asideBottomInVp - chromePx))
      if (next === lastHeightPx) return     // skip identical writes
      lastHeightPx = next
      // Write directly to the DOM — bypasses React reconciliation so the
      // scroll-driven height updates land in the same frame as the scroll
      // paint, without triggering setState → reconcile → commit per
      // pointer movement. Substantially smoother on long pages.
      aside.style.height = `${next}px`
    }
    const schedule = () => { if (raf === null) raf = requestAnimationFrame(recompute) }
    recompute()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(canvasNode)
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      ro.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [mode])  // re-run when mode toggles so we observe the sidebar-view pane on activation

  const handleModeChange = async (next: EditorMode) => {
    const prev = mode
    setChromeQuickMenu(null)
    setMode(next)
    try {
      await setUserEditorMode(next)
    } catch {
      // Roll back on error
      setMode(prev)
      status.error(t("editorModePreferenceFailed"))
    }
  }

  const isDesktop = useIsDesktop()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { title: initial.title, slug: initial.slug ?? "", status: (initial.status as "draft" | "published") ?? "draft",
          blocks: (initial.blocks as any) ?? [], seo: (initial.seo as any) ?? {} }
      : { title: "", slug: "", status: "draft", blocks: [], seo: {} }
  })

  const pageDraftKey = useMemo(
    () => [
      "page",
      String(tenantId),
      initial ? String(initial.id) : "new",
      baseHref,
    ].map(encodeURIComponent).join(":"),
    [tenantId, initial, baseHref],
  )
  const baselineUpdatedAt = initial?.updatedAt ?? null
  const baselineUpdatedAtRef = useRef<string | null>(baselineUpdatedAt)
  const themeStateRef = useRef<ThemeTokens | null>(themeState)
  const themeDirtyRef = useRef(themeDirty)
  const navDirtyRef = useRef(navDirty)
  const chromeDirtyRef = useRef(chromeDirty)
  const navStateRef = useRef({ inHeader, inFooter })

  useEffect(() => { baselineUpdatedAtRef.current = baselineUpdatedAt }, [baselineUpdatedAt])
  useEffect(() => { themeStateRef.current = themeState }, [themeState])
  useEffect(() => { themeDirtyRef.current = themeDirty }, [themeDirty])
  useEffect(() => { navDirtyRef.current = navDirty }, [navDirty])
  useEffect(() => { chromeDraftRef.current = chromeDraft }, [chromeDraft])
  useEffect(() => { chromeBaselineRef.current = chromeBaseline }, [chromeBaseline])
  useEffect(() => { chromeDirtyRef.current = chromeDirty }, [chromeDirty])
  useEffect(() => { navStateRef.current = { inHeader, inFooter } }, [inHeader, inFooter])
  useEffect(() => { draftCandidateRef.current = draftCandidate }, [draftCandidate])

  useEffect(() => {
    if (readOnly) {
      setDraftChecked(true)
      return
    }
    let cancelled = false
    setDraftChecked(false)
    void readPageEditorDraft(pageDraftKey).then((draft) => {
      if (cancelled || !draft) return
      const parsed = schema.safeParse(draft.formValues)
      const serverUpdatedAt = baselineUpdatedAt ? Date.parse(baselineUpdatedAt) : 0
      const staleAgainstServer = serverUpdatedAt > 0 && draft.savedAt <= serverUpdatedAt
      if (!parsed.success || staleAgainstServer) {
        void deletePageEditorDraft(pageDraftKey)
        return
      }
      setDraftCandidate(draft)
    }).finally(() => {
      if (!cancelled) setDraftChecked(true)
    })
    return () => { cancelled = true }
  }, [readOnly, pageDraftKey, baselineUpdatedAt])

  const scheduleDraftWrite = useCallback(
    (force = false) => {
      if (readOnly) return
      if (draftWriteTimer.current) clearTimeout(draftWriteTimer.current)
      draftWriteTimer.current = setTimeout(() => {
        if (draftCandidateRef.current) return
        const hasWork = force || form.formState.isDirty || themeDirtyRef.current || navDirtyRef.current || chromeDirtyRef.current
        if (!hasWork) {
          void deletePageEditorDraft(pageDraftKey)
          return
        }
        void writePageEditorDraft({
          version: 1,
          key: pageDraftKey,
          savedAt: Date.now(),
          baselineUpdatedAt: baselineUpdatedAtRef.current,
          formValues: form.getValues(),
          theme: themeStateRef.current,
          nav: navStateRef.current,
          chrome: chromeDraftRef.current,
        })
      }, 350)
    },
    [form, pageDraftKey, readOnly],
  )

  const cancelScheduledDraftWrite = useCallback(() => {
    if (!draftWriteTimer.current) return
    clearTimeout(draftWriteTimer.current)
    draftWriteTimer.current = null
  }, [])

  useEffect(() => {
    const subscription = form.watch(() => {
      setShowSaved(false)
      scheduleDraftWrite()
    })
    return () => {
      subscription.unsubscribe()
      cancelScheduledDraftWrite()
    }
  }, [cancelScheduledDraftWrite, form, scheduleDraftWrite])

  useEffect(() => {
    if (themeDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [themeDirty, themeState, scheduleDraftWrite])

  useEffect(() => {
    if (navDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [navDirty, inHeader, inFooter, scheduleDraftWrite])

  useEffect(() => {
    if (chromeDirty) {
      setShowSaved(false)
      scheduleDraftWrite(true)
    }
  }, [chromeDirty, chromeDraft, scheduleDraftWrite])

  useEffect(() => {
    if (!draftChecked || draftCandidate) return
    if (!form.formState.isDirty && !themeDirty && !navDirty && !chromeDirty) {
      void deletePageEditorDraft(pageDraftKey)
    }
  }, [draftChecked, draftCandidate, form.formState.isDirty, themeDirty, navDirty, chromeDirty, pageDraftKey])

  const restorePageDraft = useCallback(() => {
    const draft = draftCandidate
    if (!draft) return
    const parsed = schema.safeParse(draft.formValues)
    if (!parsed.success) {
      void deletePageEditorDraft(pageDraftKey)
      setDraftCandidate(null)
      status.error(t("draftRestoreFailed"))
      return
    }
    setDraftCandidate(null)
    form.reset(parsed.data, { keepDefaultValues: true })
    setThemeState((draft.theme ?? null) as ThemeTokens | null)
    if (draft.nav) {
      setInHeader(!!draft.nav.inHeader)
      setInFooter(!!draft.nav.inFooter)
    }
    if (draft.chrome) {
      setChromeDraft({
        ...chromeDraftFromSettings(siteSettingsState, footerContract),
        ...(draft.chrome as Partial<SiteChromeDraft>),
        footer: {
          ...chromeDraftFromSettings(siteSettingsState, footerContract).footer,
          ...((draft.chrome as Partial<SiteChromeDraft>).footer ?? {}),
        },
      })
    }
    status.success(t("draftRestored"))
  }, [draftCandidate, form, footerContract, pageDraftKey, siteSettingsState, status, t])

  const discardPageDraft = useCallback(() => {
    setDraftCandidate(null)
    void deletePageEditorDraft(pageDraftKey)
    status.success(t("draftDiscarded"))
  }, [pageDraftKey, status, t])

  // Guard against accidental tab close / refresh / off-site nav while the
  // form has unsaved work or a save is in flight. Headless hook —
  // pairs with <UnsavedChangesDialog/> below for the in-app + popstate
  // confirms. Includes `themeDirty`, `navDirty`, and `chromeDirty` because those live outside
  // RHF but still persist only through the explicit Save button.
  const guard = useNavigationGuard(!readOnly && (form.formState.isDirty || themeDirty || navDirty || chromeDirty || pending))
  const navigateFromChrome = useCallback(
    (href: string) => guard.guardedNavigate(() => router.push(href)),
    [guard, router],
  )

  const onSubmit = async (values: Values) => {
    if (readOnly) return
    const saveStartedAt = performance.now()
    setPending(true)
    setSubmitError(null)
    setShowSaved(false)
    // Persist tenant theme alongside the page save when the user has
    // edited it via ThemeBar. Runs in parallel with the page write but
    // its failure is reported independently — the page save is what
    // owns the form's lifecycle, so a theme-only failure surfaces a
    // status badge rather than rolling the whole save back.
    const themeWasDirty = themeDirty
    const themeSnapshot = themeState
    const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)
    const themePromise = themeWasDirty
      ? setTenantTheme(tenantId, normalizedThemeSnapshot ?? {}).then(
          () => {
            setThemeState(normalizedThemeSnapshot)
            setThemeBaseline(normalizedThemeSnapshot)
            const previous = pageEditorStyleCache.get(tenantStyleCacheKey)
            pageEditorStyleCache.set(tenantStyleCacheKey, {
              tenantCss: previous?.tenantCss ?? stableTenantCss,
              theme: normalizedThemeSnapshot,
            })
          },
          () => { status.error(t("themeSaveFailed")) },
        )
      : Promise.resolve()
    const navWasDirty = navDirty
    const navSnapshot = { inHeader, inFooter }
    const saveNavMembership = async () => {
      if (!navWasDirty || !initial) return
      await Promise.all([
        navSnapshot.inHeader !== savedInHeader
          ? togglePageInNav(tenantId, initial.id, "header", navSnapshot.inHeader)
          : Promise.resolve(),
        navSnapshot.inFooter !== savedInFooter
          ? togglePageInNav(tenantId, initial.id, "footer", navSnapshot.inFooter)
          : Promise.resolve(),
      ])
      setSavedInHeader(navSnapshot.inHeader)
      setSavedInFooter(navSnapshot.inFooter)
    }
    const chromeSnapshot = chromeDraftRef.current
    const chromeWasDirty =
      chromeDirtyRef.current ||
      JSON.stringify(chromeComparable(chromeSnapshot, footerContract)) !==
        JSON.stringify(chromeComparable(chromeBaselineRef.current, footerContract))
    const saveChrome = async () => {
      if (!chromeWasDirty || !siteSettingsState?.id || !canEditSettingsResolved) return
      const res = await fetch(`/api/site-settings/${siteSettingsState.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chrome: chromePatchFromDraft(chromeSnapshot, footerContract) }),
      })
      if (!res.ok) {
        const detail = await parsePayloadError(res)
        throw new Error(detail.message)
      }
      setChromeBaseline(chromeSnapshot)
    }
    const url = initial ? `/api/pages/${initial.id}` : "/api/pages"
    const method = initial ? "PATCH" : "POST"
    // Normalize upload relationships to bare ids so Payload validation
    // never receives populated Media objects from depth-loaded edit pages.
    const body = JSON.stringify({
      ...values,
      tenant: tenantId,
      blocks: normalizePageBlockUploadIds(values.blocks),
      seo: values.seo
        ? { ...values.seo, ogImage: normalizeUploadId(values.seo.ogImage) }
        : values.seo,
    })
    const pageWasDirty = !initial || form.formState.isDirty
    let createdPageId: string | number | null = null
    if (pageWasDirty) {
      let res: Response
      try {
        res = await fetch(url, { method, headers: { "content-type": "application/json" }, body })
      } catch (e) {
        setPending(false)
        const msg = e instanceof Error ? e.message : t("networkError")
        setSubmitError(msg)
        captureCmsBrowserEvent({
          event: "cms_page_save_failed",
          cms_route: initial ? "/pages/[id]" : "/pages/new",
          cms_action: "page-save",
          cms_result: "failure",
          cms_object_type: "page",
          cms_object_id: initial?.id,
          cms_error_type: "network",
          cms_dirty_count: dirtyCount,
          cms_duration_ms: performance.now() - saveStartedAt,
        })
        return
      }
      if (!res.ok) {
        setPending(false)
        // Drill into Payload's error envelope so a slug-regex / unique
        // conflict / required-field error lights up the offending field
        // instead of bubbling up as an opaque "HTTP 400".
        const detail = await parsePayloadError(res)
        if (detail.field) {
          // RHF accepts dotted paths (e.g. "seo.title"). Cast widens to any
          // because `keyof Values` is only the top-level keys, but RHF's
          // runtime accepts the full FieldPath. Matches the pattern in
          // TenantEditForm/UserEditForm for consistency.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form.setError(detail.field as any, {
            type: "server",
            message: detail.message
          })
          // setError mutates the errors object synchronously, but defer
          // the scroll to next frame so RHF has flushed re-renders that
          // would otherwise move the field's DOM position out from under
          // us.
          requestAnimationFrame(() => scrollToFirstError(form.formState.errors))
        }
        setSubmitError(detail.message)
        captureCmsBrowserEvent({
          event: "cms_page_save_failed",
          cms_route: initial ? "/pages/[id]" : "/pages/new",
          cms_action: "page-save",
          cms_result: "failure",
          cms_object_type: "page",
          cms_object_id: initial?.id,
          cms_error_type: detail.field ? "validation" : `http-${res.status}`,
          cms_dirty_count: dirtyCount,
          cms_duration_ms: performance.now() - saveStartedAt,
        })
        return
      }
      if (!initial) {
        const json = await res.json()
        createdPageId = json.doc?.id ?? json.id
      }
    }
    try {
      await Promise.all([themePromise, saveNavMembership(), saveChrome()])
    } catch (err) {
      setPending(false)
      const msg = err instanceof Error ? err.message : t("saveFailed")
      setSubmitError(msg)
      captureCmsBrowserEvent({
        event: "cms_page_save_failed",
        cms_route: initial ? "/pages/[id]" : "/pages/new",
        cms_action: "page-save",
        cms_result: "failure",
        cms_object_type: "page",
        cms_object_id: initial?.id ?? createdPageId ?? undefined,
        cms_error_type: "related-write",
        cms_dirty_count: dirtyCount,
        cms_duration_ms: performance.now() - saveStartedAt,
      })
      return
    }
    setPending(false)
    setSubmitError(null)
    // FN-2026-0012 — the prior shape passed `{ keepValues: true }`, which
    // keeps the *current* DOM input values but does NOT advance RHF's dirty
    // baseline reliably across all field types (RHF's diff is per-renderer
    // and `keepValues` skips the per-field reset path that updates the
    // dirty-comparison baseline). Result: `formState.isDirty` could stay
    // true for the next render tick. The useNavigationGuard hook keys off
    // that flag, so a hard refresh in the ~1s window after save still
    // triggered the browser-native "Leave site?" prompt. Resetting WITHOUT
    // keepValues uses the just-submitted `values` as both the input snapshot
    // AND the new clean baseline — `isDirty` flips to false synchronously
    // and the beforeunload listener detaches on the same frame.
    form.reset(values)
    // `form.reset` notifies RHF watchers. Do not let that normal save-cycle
    // reset recreate a local recovery draft after the successful save deletes
    // the stale one below. Draft recovery is only for unsaved refresh/crash
    // recovery, not for a clean explicit Save.
    cancelScheduledDraftWrite()
    setShowSaved(true)
    captureCmsBrowserEvent({
      event: "cms_page_saved",
      cms_route: initial ? "/pages/[id]" : "/pages/new",
      cms_action: "page-save",
      cms_result: "success",
      cms_object_type: "page",
      cms_object_id: initial?.id ?? createdPageId ?? undefined,
      cms_dirty_count: dirtyCount,
      cms_duration_ms: performance.now() - saveStartedAt,
    })
    await deletePageEditorDraft(pageDraftKey)
    // No duplicate notification — the top-right SaveButton already shows
    // the "Saved" / "1 unsaved" state.
    if (!initial && createdPageId != null) {
      router.replace(`${baseHref}/${createdPageId}`)
    } else {
      router.refresh()
    }
  }

  // RHF calls onInvalid when zod validation fails before onSubmit ever
  // runs. Jump the user to the first offending field.
  const onInvalid = (errors: FieldErrors<Values>) => {
    scrollToFirstError(errors as Record<string, unknown>)
    captureCmsBrowserEvent({
      event: "cms_page_save_failed",
      cms_route: initial ? "/pages/[id]" : "/pages/new",
      cms_action: "page-save",
      cms_result: "failure",
      cms_object_type: "page",
      cms_object_id: initial?.id,
      cms_error_type: "client-validation",
      cms_dirty_count: dirtyCount,
    })
  }

  const retry = () => form.handleSubmit(onSubmit, onInvalid)()
  const triggerSave = useCallback(() => {
    if (readOnly) return
    form.handleSubmit(onSubmit, onInvalid)()
  }, [form, onSubmit, onInvalid, readOnly])

  // Cmd+S / Ctrl+S global save shortcut. Skip when focus is inside an
  // open dialog so confirmation dialogs handle their own key events.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        if (readOnly) return
        const active = document.activeElement
        if (active && active.closest("[role='dialog']")) return
        e.preventDefault()
        triggerSave()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [readOnly, triggerSave])

  const jumpToError = () =>
    scrollToFirstError(form.formState.errors as Record<string, unknown>)

  const onDelete = async () => {
    if (readOnly) return
    if (!initial) return
    const res = await fetch(`/api/pages/${initial.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
    // Clear dirty so the navigation guard doesn't fire on the post-
    // delete redirect. router.replace is programmatic so the click
    // guard wouldn't fire anyway, but if a future code path adds a
    // guard between here and the redirect, this keeps the state
    // machine coherent. Belt-and-braces.
    form.reset(form.getValues(), { keepValues: true })
    status.success(t("deletePageTitle", { title: initial.title }))
    router.replace(baseHref)
    router.refresh()
  }

  // Compute save status for the pill. "idle" means: not dirty AND
  // nothing saved yet — keeps the pill hidden on initial render.
  // Validation errors take precedence over dirty so the operator sees
  // why their save was blocked.
  // Combine page-form dirty state with tenant-theme, nav-membership, and
  // site-chrome dirty
  // state so the Save button + navigation guard fire on every explicit-save
  // surface owned by this page editor.
  const isDirty = !readOnly && (form.formState.isDirty || themeDirty || navDirty || chromeDirty)
  // Recursively count leaf error nodes — RHF nests errors as
  // { blocks: [{ headline: { message } }, ...] }, so a top-level
  // Object.keys() count would collapse all block errors to 1.
  const errorCount = countLeafErrors(form.formState.errors)
  const dirtyCount = readOnly ? 0 : countLeafDirty(form.formState.dirtyFields) + (themeDirty ? 1 : 0) + (navDirty ? 1 : 0) + (chromeDirty ? 1 : 0)
  const saveStatus: SaveStatus = deriveSaveStatus({
    pending,
    hasError: errorCount > 0 || !!submitError,
    isDirty,
    showSaved,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlAny = form.control as unknown as import("react-hook-form").Control<any>

  const onDeletePage = () => {
    if (!readOnly) setDeleteOpen(true)
  }
  const pageTitle = form.watch("title") || initial?.title || ""

  // Watched blocks — needed by SidebarDrillDown in sidebar view.
  const watchedBlocks: any[] = form.watch("blocks") ?? []

  // Reorder helper — lifted from useCanvasBlocks to avoid importing
  // the hook twice (CanvasMode owns its own instance). PageForm needs
  // this for SidebarDrillDown's onReorder prop.
  const reorderBlocks = (from: number, to: number) => {
    if (readOnly) return
    const copy = [...watchedBlocks]
    const [moved] = copy.splice(from, 1)
    copy.splice(to, 0, moved)
    form.setValue("blocks", copy, { shouldDirty: true })
    // Keep `selected` coherent: the dragged block follows its new position;
    // blocks in the shift zone shift by one.
    setSelected((prev) => remapSelectionAfterReorder(prev, from, to))
  }

  const deleteBlock = (i: number) => {
    if (readOnly) return
    const next = watchedBlocks.filter((_, j) => j !== i)
    form.setValue("blocks", next, { shouldDirty: true })
    setSelected((prev) => remapSelectionAfterDelete(prev, i))
  }

  const duplicateBlock = (i: number) => {
    if (readOnly) return
    // Strip Payload id so a new one is generated on save.
    const dup = { ...watchedBlocks[i], id: undefined }
    const next = [...watchedBlocks.slice(0, i + 1), dup, ...watchedBlocks.slice(i + 1)]
    form.setValue("blocks", next, { shouldDirty: true })
    setSelected((prev) => remapSelectionAfterInsert(prev, i + 1))
  }

  // FE-53 — SidebarDrillDown's "Add block" affordance. Mirrors
  // useCanvasBlocks.insertBlockAt (defaultAnchor pre-fill + seed merge) but
  // appends at the end; selects the new block so its form opens immediately.
  const addBlock = (blockType: string, seed?: Record<string, unknown>) => {
    if (readOnly) return
    const defaultAnchor = manifest?.blocks?.find((m) => m.slug === blockType)?.defaultAnchor
    const next = [
      ...watchedBlocks,
      { blockType, ...(defaultAnchor ? { anchor: defaultAnchor } : {}), ...seed },
    ]
    form.setValue("blocks", next, { shouldDirty: true })
    setSelected({ blockIndex: next.length - 1, field: "" })
  }

  // Danger zone — standalone card rendered below the canvas (canvas view)
  // or inside the sidebar (sidebar view).
  const dangerZone = readOnly ? null : (
    <section className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
      <h2 className="text-base font-semibold text-foreground">{t("dangerZone")}</h2>
      <p className="mt-2 text-sm text-foreground">
        {initial ? (
          <>{t("deleteSavedDescription", { title: initial.title })}</>
        ) : (
          <>{t("deleteUnsavedDescription")}</>
        )}
      </p>
      {initial ? (
        <Button
          type="button"
          variant="destructive"
          className="mt-3"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("deletePage")}
        </Button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            {/* A disabled <Button> swallows pointer events, so wrap in a
                span trigger so the tooltip still surfaces on hover/focus. */}
            <TooltipTrigger asChild>
              <span tabIndex={0} className="mt-3 inline-block">
                <Button
                  type="button"
                  variant="destructive"
                  disabled
                  aria-disabled="true"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deletePage")}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("savePageFirst")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </section>
  )

  // SEO card — rendered below the canvas (canvas view) or inside the sidebar (sidebar view).
  const seoCard = (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">{t("seo")}</h2>
      <div className="mt-3 space-y-3">
        {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo" />)}
      </div>
    </section>
  )

  // OBS-21 / FE-85 — page-flag nav toggles. Shown only to nav managers
  // (owner / super-admin) and only once the page is saved (an unsaved page has
  // no id to reference from a nav entry). Toggling marks the page editor dirty;
  // the SiteSettings nav lists update only when the user presses Save.
  const navCard =
    canManageNavResolved && initial ? (
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">{t("navigation")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("navigationDescription")}
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="nav-header-toggle">{t("includeHeaderNavigation")}</Label>
            <Switch
              id="nav-header-toggle"
              checked={inHeader}
              disabled={pending}
              onCheckedChange={(c) => toggleNav("header", c)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="nav-footer-toggle">{t("includeFooterNavigation")}</Label>
            <Switch
              id="nav-footer-toggle"
              checked={inFooter}
              disabled={pending}
              onCheckedChange={(c) => toggleNav("footer", c)}
            />
          </div>
        </div>
      </section>
    ) : null

  // Page-settings card stack handed to the canvas / sidebar `seoCard` slot
  // (a ReactNode slot — local UI components render whatever node they get).
  const pageSettings = readOnly ? null : (
    <>
      {navCard}
      {seoCard}
    </>
  )
  const navigationHref = canManageNavResolved ? baseHref.replace(/\/pages$/, "/navigation") : null
  const navigationHrefFor = useCallback(
    (zone: SiteChromeZone) => {
      if (!navigationHref) return null
      const separator = navigationHref.includes("?") ? "&" : "?"
      return `${navigationHref}${separator}zone=${zone}`
    },
    [navigationHref],
  )

  const updateFooterTextItem = useCallback((columnIndex: number, patch: { label?: string | null; text?: string | null }) => {
    if (!canEditSettingsResolved || !footerContract) return
    setChromeDraft((current) => {
      const columns = ensureFooterColumnItems(
        setFooterColumnCount(current.footer.columns, current.footer.columns.length || footerContract.defaultColumnCount, footerContract),
        footerContract,
      )
      const nextColumns = columns.map((column, index) => {
        if (index !== columnIndex || column.items[0]?.type !== "text") return column
        return { ...column, items: [{ ...column.items[0], ...patch }] }
      })
      return {
        ...current,
        footer: { ...current.footer, columns: normalizeFooterColumns(nextColumns, footerContract) },
      }
    })
  }, [canEditSettingsResolved, footerContract])

  const openChromeInSidebar = useCallback((selection: SiteChromeSelection) => {
    setChromeQuickMenu(null)
    setSelected(null)
    setSelectedChrome(selection)
    void handleModeChange("sidebar")
  }, [handleModeChange])

  const openBlockInSidebar = useCallback((index: number) => {
    setChromeQuickMenu(null)
    setSelectedChrome(null)
    setSelected({ blockIndex: index, field: "" })
    void handleModeChange("sidebar")
  }, [handleModeChange])

  const headerChrome = chromeSettingsState ? (
    <SiteChromePreview
      zone="header"
      settings={chromeSettingsState}
      navigationHref={navigationHrefFor("header")}
      manifest={manifest}
      onNavigate={navigateFromChrome}
      selected={selectedChrome}
      onSelect={selectChrome}
    />
  ) : null

  const footerChrome = chromeSettingsState ? (
    <SiteChromePreview
      zone="footer"
      settings={chromeSettingsState}
      navigationHref={navigationHrefFor("footer")}
      manifest={manifest}
      onNavigate={navigateFromChrome}
      selected={selectedChrome}
      onSelect={selectChrome}
      onUpdateFooterTextItem={mode === "canvas" ? updateFooterTextItem : undefined}
    />
  ) : null

  const renderSidebarList = useCallback(
    (ctx: SidebarListSlotContext) => (
      <SidebarListLayout
        header={ctx.header}
        body={
          <>
            {siteSettingsState && (
              <SiteChromeRow
                zone="header"
                navigationHref={navigationHrefFor("header")}
                onNavigate={navigateFromChrome}
                selected={selectedChrome?.zone === "header"}
                onSelect={selectChrome}
              />
            )}
            {ctx.blocks.length === 0 ? ctx.emptyState : ctx.blockRows}
            {siteSettingsState && (
              <SiteChromeRow
                zone="footer"
                navigationHref={navigationHrefFor("footer")}
                onNavigate={navigateFromChrome}
                selected={selectedChrome?.zone === "footer"}
                onSelect={selectChrome}
              />
            )}
            {ctx.addBlockButton}
            {ctx.blockTypePicker}
          </>
        }
      />
    ),
    [navigationHrefFor, selectedChrome, selectChrome, siteSettingsState],
  )

  const renderSidebarBlockForm = useCallback(
    (ctx: SidebarBlockFormSlotContext) => (
      <SidebarBlockFormLayout
        actions={
          <>
            {ctx.backButton}
            {ctx.deleteButton}
          </>
        }
        title={ctx.title}
        body={ctx.fields}
        deleteDialog={ctx.deleteDialog}
      />
    ),
    [],
  )

  const renderSidebarPageSettings = useCallback(
    (ctx: SidebarPageSettingsSlotContext) => (
      <SidebarPageSettingsLayout
        header={ctx.header}
        body={ctx.body}
        footer={ctx.footer}
      />
    ),
    [],
  )

  const renderMobileList = useCallback(
    (ctx: MobileSectionListSlotContext) => (
      <MobileSectionListLayout
        header={ctx.header}
        sectionsHeader={ctx.sectionsHeader}
        emptyState={ctx.emptyState}
        sectionCards={ctx.sectionCards}
        addSectionButton={ctx.addSectionButton}
        pageActionsTitle={ctx.pageActionsTitle}
        pageRows={
          <>
            {ctx.pageRows}
          </>
        }
        blockTypePicker={ctx.blockTypePicker}
      />
    ),
    [],
  )

  const renderMobileSectionEdit = useCallback(
    (ctx: MobileSectionEditSlotContext) => (
      <MobileSectionEditLayout
        header={ctx.header}
        canvas={ctx.canvas}
        inspectorBar={ctx.inspectorBar}
        trashPill={ctx.trashPill}
        deleteDialog={ctx.deleteDialog}
      />
    ),
    [],
  )

  const renderMobileInspector = useCallback(
    (ctx: MobileInspectorBarSlotContext) => (
      <MobileInspectorBarLayout
        snapFraction={ctx.snapFraction}
        handle={ctx.handle}
        body={ctx.body}
      />
    ),
    [],
  )

  const mobileNavigationSection = canManageNavResolved ? (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">{t("navigation")}</h3>
        <p className="text-xs text-muted-foreground">
          {initial ? t("navigationDescription") : t("savePageFirst")}
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mobile-nav-header-toggle" className="text-sm">
            {t("includeHeaderNavigation")}
          </Label>
          <Switch
            id="mobile-nav-header-toggle"
            checked={inHeader}
            disabled={!initial || pending}
            onCheckedChange={(c) => toggleNav("header", c)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mobile-nav-footer-toggle" className="text-sm">
            {t("includeFooterNavigation")}
          </Label>
          <Switch
            id="mobile-nav-footer-toggle"
            checked={inFooter}
            disabled={!initial || pending}
            onCheckedChange={(c) => toggleNav("footer", c)}
          />
        </div>
      </div>
      {initial && (
        <div className="flex flex-wrap gap-2 pt-1">
          {navigationHrefFor("header") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const href = navigationHrefFor("header")
                if (href) navigateFromChrome(href)
              }}
            >
              <PanelTop className="size-3.5" aria-hidden />
              Header
            </Button>
          )}
          {navigationHrefFor("footer") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const href = navigationHrefFor("footer")
                if (href) navigateFromChrome(href)
              }}
            >
              <PanelBottom className="size-3.5" aria-hidden />
              Footer
            </Button>
          )}
        </div>
      )}
    </section>
  ) : null

  const renderMobilePageSettings = useCallback(
    (ctx: MobilePageSettingsSlotContext) => (
      <MobilePageSettingsLayout
        header={ctx.header}
        body={
          <>
            {ctx.titleField}
            {ctx.slugField}
            {mobileNavigationSection}
            {ctx.statusField}
          </>
        }
      />
    ),
    [mobileNavigationSection],
  )

  const renderMobileSeoSettings = useCallback(
    (ctx: MobileSeoSettingsSlotContext) => (
      <MobileSeoSettingsLayout
        header={ctx.header}
        body={ctx.body}
        mediaSheet={ctx.mediaSheet}
      />
    ),
    [],
  )

  // View-live + copy-URL affordances — shown in the canvas-mode header
  // when the page is published and has a slug.
  const liveLinks = form.watch("status") === "published" && form.watch("slug") ? (
    <>
      <Button variant="ghost" size="icon" type="button" asChild title={t("liveLink")}>
        <a href={`${tenantOrigin}/${form.watch("slug")}`} target="_blank" rel="noopener noreferrer" aria-label={t("liveLink")}>
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
      <Button variant="ghost" size="icon" type="button" title={t("copyUrl")}
        onClick={() => {
          navigator.clipboard.writeText(`${tenantOrigin}/${form.watch("slug")}`)
          status.success(t("urlCopied"))
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </>
  ) : null

  return (
    <RtManifestProvider manifest={manifest}>
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col w-full"
      >
        {/*
          CanvasSelectionProvider wraps both view branches so the selection
          state flows through CanvasMode (inline primitives) and through
          SidebarDrillDown without any prop drilling.
        */}
        <CanvasSelectionProvider value={{ view: readOnly ? "sidebar" : mode, selected, select: selectElement }}>

          {/* Shared sticky header — sits below SiteHeader, above ThemeBar, in both view modes */}
          {isDesktop && (
            <header className="sticky top-12 z-20 flex shrink-0 items-center gap-4 border-b bg-background px-4 py-3">
              {readOnly ? (
                <h1 className="min-w-0 truncate text-sm font-medium text-foreground">
                  {pageTitle}
                </h1>
              ) : (
                <PageMetaInline control={controlAny} setValue={form.setValue} getValues={form.getValues} />
              )}
              {liveLinks}
              {!readOnly && (
                <div className="ml-auto">
                  <PublishControls control={controlAny} pending={pending} isDirty={isDirty} errorCount={errorCount} dirtyCount={dirtyCount} variant="bare" />
                </div>
              )}
            </header>
          )}

          {/* Sticky-but-transparent ThemeBar — pill's own glass styling makes it look floating */}
          {isDesktop && !readOnly && (
            <div className="sticky top-[6.5rem] z-20 flex justify-center pointer-events-none">
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
          )}

          {/*
            Canvas view: full-bleed WYSIWYG layout.
            Canvas → SEO card → Danger Zone (stacked, scrollable).
          */}
          {mode === "canvas" && (
            <>
              {/* Document-scroll canvas + SEO/Danger grid below */}
              <div className="w-full">
                <MobileMediaSheetProvider>
                <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
                  <CanvasMode
                    view="canvas"
                    manifest={manifest}
                    tenantCss={stableTenantCss}
                    theme={themeState}
                    readOnly={readOnly}
                    headerChrome={headerChrome}
                    footerChrome={footerChrome}
                    seoCard={pageSettings}
                    dangerZone={dangerZone}
                    reorderBlocks={reorderBlocks}
                    deleteBlock={deleteBlock}
                    duplicateBlock={duplicateBlock}
                    pageTitle={pageTitle}
                    onDeletePage={onDeletePage}
                    onOpenBlockInspector={openBlockInSidebar}
                    renderMobileList={renderMobileList}
                    renderMobileSectionEdit={renderMobileSectionEdit}
                    renderMobileInspector={renderMobileInspector}
                    renderMobilePageSettings={renderMobilePageSettings}
                    renderMobileSeoSettings={renderMobileSeoSettings}
                  />
                </BlockPresetsProvider>
                </MobileMediaSheetProvider>
                {/* SEO + Danger grid: full-width breakout cancels main p-4/p-6 padding */}
                {isDesktop && !readOnly && (
                  <div className="-mx-4 md:-mx-6 px-4 md:px-6 pt-8 pb-24 grid gap-6 md:grid-cols-2">
                    {pageSettings}
                    {dangerZone}
                  </div>
                )}
              </div>
            </>
          )}

          {/*
            Sidebar view: select-only canvas + SidebarDrillDown (block list → block
            form → page settings drill-down navigation).
            Header → flex row: canvas-pane (left) + aside (right).
          */}
          {mode === "sidebar" && (
            <>
              <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
              <div className="flex w-full min-w-0 items-start gap-3 pt-2">
                <div ref={canvasPaneRef} className="flex-1 min-w-0 pb-24">
                  <MobileMediaSheetProvider>
                      <CanvasMode
                        view="sidebar"
                        manifest={manifest}
                        tenantCss={stableTenantCss}
                        theme={themeState}
                        readOnly={readOnly}
                        headerChrome={headerChrome}
                        footerChrome={footerChrome}
                      seoCard={pageSettings}
                      dangerZone={dangerZone}
                      reorderBlocks={reorderBlocks}
                      deleteBlock={deleteBlock}
                      duplicateBlock={duplicateBlock}
                      pageTitle={pageTitle}
                      onDeletePage={onDeletePage}
                      onOpenBlockInspector={openBlockInSidebar}
                      renderMobileList={renderMobileList}
                      renderMobileSectionEdit={renderMobileSectionEdit}
                      renderMobileInspector={renderMobileInspector}
                      renderMobilePageSettings={renderMobilePageSettings}
                      renderMobileSeoSettings={renderMobileSeoSettings}
                    />
                  </MobileMediaSheetProvider>
                </div>
                {isDesktop && !readOnly && (
                  <aside
                    ref={asideRef}
                    className="sticky top-[calc(6.5rem+0.5rem)] h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)] w-[360px] shrink-0 self-start overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <EditorErrorBoundary>
                      {selectedChrome ? (
                        <SiteChromeDrillDown
                          selection={selectedChrome}
                          draft={chromeDraft}
                          setDraft={setChromeDraft}
                          tenantId={tenantId}
                          canEditSettings={canEditSettingsResolved}
                          navigationHref={navigationHrefFor(selectedChrome.zone)}
                          onNavigate={navigateFromChrome}
                          footerContract={footerContract}
                          onBack={() => setSelectedChrome(null)}
                        />
                      ) : (
                        <SidebarDrillDown
                          blocks={watchedBlocks}
                          selectedBlockIndex={selected?.blockIndex ?? null}
                          onSelectBlock={(i) => {
                            setSelectedChrome(null)
                            setChromeQuickMenu(null)
                            setSelected(i != null ? { blockIndex: i, field: "" } : null)
                          }}
                          onReorder={reorderBlocks}
                          onDeleteBlock={deleteBlock}
                          onDuplicateBlock={duplicateBlock}
                          onAddBlock={addBlock}
                          manifest={manifest}
                          seoCard={pageSettings}
                          dangerZone={dangerZone}
                          theme={themeState}
                          renderList={renderSidebarList}
                          renderBlockForm={renderSidebarBlockForm}
                          renderPageSettings={renderSidebarPageSettings}
                        />
                      )}
                    </EditorErrorBoundary>
                  </aside>
                )}
              </div>
              </BlockPresetsProvider>
            </>
          )}

        </CanvasSelectionProvider>

        {/*
          Phone-only floating Save pill. Mounted unconditionally so the
          icon is always visible in mobile views — visual state (amber/
          spinner/error/muted) carries the dirty signal across all views.
        */}
        {!isDesktop && !readOnly && (
          <div className="[&_[data-mobile-save-pill]]:!inline-flex">
            <MobileSavePill
              status={saveStatus}
              dirtyCount={dirtyCount}
              errorCount={errorCount}
              onSave={triggerSave}
            />
          </div>
        )}
      </form>
      {/* Floating mode bar — canvas/sidebar switcher, fixed bottom-centre. Desktop only: mobile has a single view. */}
      {isDesktop && !readOnly && (
        <ModeBar mode={mode} onChange={handleModeChange} />
      )}
      {isDesktop && !readOnly && (
        <SaveStatusBar
          status={saveStatus}
          errorCount={errorCount}
          onRetry={retry}
          onJumpToError={jumpToError}
        />
      )}
        <UnsavedChangesDialog
          open={guard.pending !== null}
          onCancel={() => {
            captureCmsBrowserEvent({
              event: "cms_editor_friction",
              cms_route: initial ? "/pages/[id]" : "/pages/new",
              cms_action: "unsaved-navigation-cancelled",
              cms_result: "cancelled",
              cms_object_type: "page",
              cms_object_id: initial?.id,
              cms_dirty_count: dirtyCount,
            })
            guard.cancel()
          }}
          onConfirm={() => {
            captureCmsBrowserEvent({
              event: "cms_editor_friction",
              cms_route: initial ? "/pages/[id]" : "/pages/new",
              cms_action: "unsaved-navigation-confirmed",
              cms_result: "success",
              cms_object_type: "page",
              cms_object_id: initial?.id,
              cms_dirty_count: dirtyCount,
            })
            guard.confirm()
          }}
        />
        {!readOnly && (
          <SiteChromeQuickMenu
            menu={chromeQuickMenu}
            draft={chromeDraft}
            setDraft={setChromeDraft}
            tenantId={tenantId}
            canEditSettings={canEditSettingsResolved}
            navigationHref={chromeQuickMenu ? navigationHrefFor(chromeQuickMenu.selection.zone) : null}
            onNavigate={navigateFromChrome}
            footerContract={footerContract}
            onOpenInspector={openChromeInSidebar}
            onClose={() => {
              setChromeQuickMenu(null)
              setSelectedChrome(null)
            }}
          />
        )}
        <PageDraftRecoveryDialog
          open={draftCandidate !== null}
        savedAt={draftCandidate?.savedAt ?? null}
        onRestore={restorePageDraft}
        onDiscard={discardPageDraft}
      />
      {initial && (
        <TypedConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("deletePageTitle", { title: initial.title })}
          description={
            <>
              {t("deletePageDescription", { title: initial.title })}
            </>
          }
          confirmPhrase={initial.slug}
          confirmLabel={t("deletePage")}
          onConfirm={onDelete}
        />
      )}
    </Form>
    </RtManifestProvider>
  )
}
