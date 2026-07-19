"use client"
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useForm, type FieldErrors, type Resolver } from "react-hook-form"
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
import { SaveButton } from "@/components/save-ui/save-button"
import { PageMetaInline, type PageMetaFormValues } from "@/components/editor/page-meta-inline"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { PageDraftRecoveryDialog } from "@/components/forms/PageDraftRecoveryDialog"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { parsePayloadError } from "@/lib/api"
import { scrollToFirstError } from "@/lib/formScroll"
import { ChevronLeft, Trash2, ExternalLink, Copy, Navigation, PanelBottom, PanelTop, Plus, X } from "lucide-react"
import type { Page } from "@/payload-types"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import { SHADCNUI_CHROME_VARIANTS, SITE_CHROME_CATALOG } from "@siteinabox/contracts"
import type { IframeEditorSelection } from "@siteinabox/contracts/iframe-editor"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { EDITOR_DESKTOP_BREAKPOINT } from "@/lib/editor/constants"
import { PageEditorFrameHost } from "@/components/editor/iframe/PageEditorFrameHost"
import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"
import { blockWireId } from "@/lib/editor/ensureBlockIds"
import { EditorBlockSchema, editorPageSeoSchema, type EditorBlock } from "@/lib/editor/editorBlock"
import { ensureEditorBlocks } from "@/lib/editor/ensureItemIds"
import {
  appendEditorBlock,
  cloneEditorBlockAt,
  insertEditorBlock,
  removeEditorBlock,
  reorderEditorBlocks,
} from "@/lib/editor/pageEditorCommands"
import { elementPathToIframeSelection, iframeSelectionToElementPath } from "@/lib/editor/elementPathBridge"
import { pageToJson } from "@/lib/projection/pageToJson"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { BlockPresetsProvider } from "@/components/editor/BlockPresetsContext"
import { MobileMediaSheetProvider } from "@/components/editor/mobile/MobileMediaSheetContext"
import {
  SidebarBlockFormLayout,
  SidebarDrillDown,
  type SidebarBlockFormSlotContext,
  SidebarListLayout,
  type SidebarListSlotContext,
  SidebarPageSettingsLayout,
  type SidebarPageSettingsSlotContext,
} from "@/components/editor/sidebar-drill-down"
import type { ElementPath } from "@/components/editor/elementPath"
import {
  remapSelectionAfterDelete,
  remapSelectionAfterInsert,
  remapSelectionAfterReorder,
} from "@/components/editor/elementPath"
import { EditorErrorBoundary } from "@/components/editor/EditorErrorBoundary"
import { EditorThemeToolbar } from "@/components/editor/theme/editor-theme-toolbar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { countLeafDirty } from "@/lib/countLeafDirty"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { useStatusFeedback } from "@/components/status-feedback"
import {
  deletePageEditorDraft,
  readPageEditorDraft,
  writePageEditorDraft,
  type PageEditorDraft,
} from "@/lib/editor/pageDraftStore"
import { useTranslations } from "next-intl"
import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"
import { resolveSettingsContract } from "@/lib/settingsContract"
import { pageEditorHref } from "@/lib/pageEditorUrls"
import type { NavPage } from "@/lib/projection/resolveNav"
import { SiteChromeRow, type SiteChromeSelection, type SiteChromeZone } from "@/components/editor/sidebar/SiteChromeRow"
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
import { canonicalizeCtaFields } from "@/lib/projection/canonicalizeCtaFields"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"
import {
  chromeComparable,
  chromeDraftFromSettings,
  chromePatchFromDraft,
  mergeChromeSettings,
  rendererSettingsFromChromeDraft,
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

const pageEditorThemeCache = new Map<string, ThemeTokens | null>()

type DraftRecord = Record<string, unknown>

type ChromeVariantEntry = (typeof SHADCNUI_CHROME_VARIANTS)[number]

const asDraftRecord = (value: unknown): DraftRecord =>
  value != null && typeof value === "object" && !Array.isArray(value) ? value as DraftRecord : {}

const draftFieldString = (group: unknown, field: string): string => {
  const value = asDraftRecord(group)[field]
  return typeof value === "string" ? value : ""
}

const draftFieldBool = (group: unknown, field: string): boolean =>
  asDraftRecord(group)[field] === true

const mergeDraftGroup = (group: unknown, patch: DraftRecord): DraftRecord => ({
  ...asDraftRecord(group),
  ...patch,
})

const chromeVariantById = (id: string): ChromeVariantEntry | undefined =>
  SHADCNUI_CHROME_VARIANTS.find((entry) => entry.id === id)

type ChromeRange = { min: number; max: number }

type ChromeEditorCapabilities = {
  mobileMenu?: readonly string[]
  secondaryAction?: boolean
  search?: boolean
  newsletter?: boolean
  navigation?: string
  primaryItems?: ChromeRange
  columns?: ChromeRange
  linksPerColumn?: ChromeRange
}

const chromeVariantCapabilities = (id: string): ChromeEditorCapabilities | undefined => {
  const entry = chromeVariantById(id)
  if (!entry || !("capabilities" in entry)) return undefined
  return entry.capabilities as ChromeEditorCapabilities
}

const settingsRecordId = (settings: unknown): string | number | null => {
  const id = asDraftRecord(settings).id
  return typeof id === "string" || typeof id === "number" ? id : null
}

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
  blocks: z.array(EditorBlockSchema),
  // `.nullish()` (T | null | undefined) is load-bearing — Postgres returns
  // `null` for unset optional text columns inside groups, and `payload-types`
  // declares `seo.title?: string | null`. With plain `.optional()` (T |
  // undefined only) zod rejects those nulls on second save: a fresh page
  // post-create has `defaultValues.seo = {title: null, description: null,
  // ogImage: null}` — the parent `??` short-circuit doesn't dig into the
  // children — and `handleSubmit` short-circuits to `onInvalid` before any
  // network call, lighting both text fields red.
  seo: editorPageSeoSchema
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
    itemIndex: number,
    patch: Partial<FooterCompositionColumn["items"][number]>,
  ) => {
    setColumns(columns.map((column, cIndex) => cIndex !== columnIndex
      ? column
      : {
          ...column,
          items: column.items.map((item, iIndex) => iIndex === itemIndex ? { ...item, ...patch } : item),
        }))
  }
  const setColumnType = (columnIndex: number, itemIndex: number, type: FooterItemType) => {
    setColumns(columns.map((column, cIndex) => cIndex !== columnIndex
      ? column
      : { ...column, items: column.items.map((item, iIndex) => iIndex === itemIndex ? { ...createFooterItem(type), id: item.id ?? undefined } : item) }))
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
        {columns.map((column, columnIndex) => (
          <div key={column.id ?? columnIndex} className="space-y-3 rounded-md border border-border bg-background p-3">
            <h3 className="text-sm font-medium text-foreground">{t("footerColumn", { index: columnIndex + 1 })}</h3>
            {column.items.map((item, itemIndex) => <div className="space-y-3 rounded-md border border-border bg-card p-3" key={item.id ?? itemIndex}>
              <div className="flex items-center gap-2">
              <Select
                value={item.type}
                disabled={!canEditSettings}
                onValueChange={(type) => setColumnType(columnIndex, itemIndex, type as FooterItemType)}
              >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contract.items.map((item) => (
                      <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" disabled={!canEditSettings || column.items.length === 1} aria-label={t("removeFooterItem")} onClick={() => setColumns(columns.map((candidate, index) => index === columnIndex ? { ...candidate, items: candidate.items.filter((_, removeIndex) => removeIndex !== itemIndex) } : candidate))}><X className="size-4" /></Button>
              </div>
            {(item.type === "text" || item.type === "links") && (
            <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>{t("footerItemLabel")}</Label>
                        <Input
                          value={item.label ?? ""}
                          placeholder={itemLabel(item.type)}
                          disabled={!canEditSettings}
                          onChange={(event) => updateItem(columnIndex, itemIndex, { label: event.target.value || null })}
                        />
                      </div>

                    {item.type === "text" && (
                      <div className="space-y-2">
                        <Label>{t("footerItemText")}</Label>
                        <Textarea
                          value={item.text ?? ""}
                          disabled={!canEditSettings}
                          onChange={(event) => updateItem(columnIndex, itemIndex, { text: event.target.value || null })}
                        />
                      </div>
                    )}

                    {item.type === "links" && (
                      <div className="space-y-2">
                        <Label>{t("footerLinks")}</Label>
                        <div className="space-y-2">
                          {(item.links?.length ? item.links : [{ label: "", href: "", external: false }]).map((link, linkIndex) => (
                            <div key={linkIndex} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                              <Input
                                value={link.label}
                                placeholder={t("footerLinkLabel")}
                                disabled={!canEditSettings}
                                onChange={(event) => {
                                  const links = [...(item.links ?? [])]
                                  links[linkIndex] = { ...(links[linkIndex] ?? { label: "", href: "" }), label: event.target.value }
                                  updateItem(columnIndex, itemIndex, { links })
                                }}
                              />
                              <Switch aria-label={t("externalLink")} checked={!!link.external} disabled={!canEditSettings} onCheckedChange={(external) => { const links = [...(item.links ?? [])]; links[linkIndex] = { ...(links[linkIndex] ?? { label: "", href: "" }), external }; updateItem(columnIndex, itemIndex, { links }) }} />
                              <Input
                                value={link.href}
                                placeholder="/"
                                disabled={!canEditSettings}
                                onChange={(event) => {
                                  const links = [...(item.links ?? [])]
                                  links[linkIndex] = { ...(links[linkIndex] ?? { label: "", href: "" }), href: event.target.value }
                                  updateItem(columnIndex, itemIndex, { links })
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
                                  updateItem(columnIndex, itemIndex, { links })
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
                            disabled={(item.links?.length ?? 0) >= 8}
                            onClick={() => updateItem(columnIndex, itemIndex, {
                              links: [...(item.links ?? []), { label: "Link", href: "/", external: false }],
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
            </div>)}
            <Button type="button" variant="outline" size="sm" disabled={!canEditSettings || column.items.length >= 4} onClick={() => setColumns(columns.map((candidate, index) => index === columnIndex ? { ...candidate, items: [...candidate.items, createFooterItem(contract.items[0]!.type)] } : candidate))}><Plus className="size-3.5" />{t("addFooterItem")}</Button>
          </div>
        ))}
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
  const variant = String(zone === "header" ? draft.header.variant ?? "" : draft.footer.variant ?? "")
  const capability = chromeVariantCapabilities(variant)
  const variantOptions = SITE_CHROME_CATALOG.filter((entry) => entry.area === zone && (entry.scope.kind === "global" || entry.variant === variant))
  const setLogo = (logoValue: unknown) => {
    if (!canEditSettings) return
    setDraft((current) => zone === "header"
      ? { ...current, header: { ...current.header, logo: logoValue } }
      : { ...current, footer: { ...current.footer, logo: logoValue } })
  }
  const setVariant = (value: string) => {
    const nextCapability = chromeVariantCapabilities(value)
    setDraft((current) => zone === "header"
      ? {
          ...current,
          header: {
            ...current.header,
            variant: value,
            mobileMenu: nextCapability?.mobileMenu?.includes(String(current.header.mobileMenu ?? ""))
              ? current.header.mobileMenu
              : null,
            secondaryAction: nextCapability?.secondaryAction ? current.header.secondaryAction : undefined,
            search: nextCapability?.search ? current.header.search : undefined,
          },
        }
      : {
          ...current,
          footer: {
            ...current.footer,
            variant: value,
            newsletter: nextCapability?.newsletter ? current.footer.newsletter : undefined,
          },
        })
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-md border border-border bg-card p-4">
        <Label htmlFor={`site-chrome-${zone}-variant`}>{t("layoutVariant")}</Label>
        <Select value={variant} disabled={!canEditSettings} onValueChange={setVariant}>
          <SelectTrigger id={`site-chrome-${zone}-variant`}><SelectValue /></SelectTrigger>
          <SelectContent>{variantOptions.map((option) => <SelectItem key={option.variant} value={option.variant}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        {capability ? <p className="text-xs text-muted-foreground">{zone === "header" ? `${capability.navigation ?? ""} navigation · ${capability.primaryItems?.min ?? 0}-${capability.primaryItems?.max ?? 0} primary items` : `${capability.columns?.min ?? 0}-${capability.columns?.max ?? 0} columns · 0-${capability.linksPerColumn?.max ?? 0} links per section`}</p> : null}
      </section>
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
          {capability?.newsletter && <section className="space-y-3 rounded-md border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">{t("newsletter")}</h2>
            <Input disabled={!canEditSettings} value={draftFieldString(draft.footer.newsletter, "title")} placeholder={t("newsletterTitle")} onChange={(event) => setDraft((current) => ({ ...current, footer: { ...current.footer, newsletter: mergeDraftGroup(current.footer.newsletter, { title: event.target.value || null }) } }))} />
            <Input disabled={!canEditSettings} value={draftFieldString(draft.footer.newsletter, "placeholder")} placeholder={t("newsletterPlaceholder")} onChange={(event) => setDraft((current) => ({ ...current, footer: { ...current.footer, newsletter: mergeDraftGroup(current.footer.newsletter, { placeholder: event.target.value || null }) } }))} />
            <Input disabled={!canEditSettings} value={draftFieldString(draft.footer.newsletter, "submitLabel")} placeholder={t("newsletterSubmit")} onChange={(event) => setDraft((current) => ({ ...current, footer: { ...current.footer, newsletter: mergeDraftGroup(current.footer.newsletter, { submitLabel: event.target.value || null }) } }))} />
            <Input disabled={!canEditSettings} value={draftFieldString(draft.footer.newsletter, "action")} placeholder="/newsletter" onChange={(event) => setDraft((current) => ({ ...current, footer: { ...current.footer, newsletter: mergeDraftGroup(current.footer.newsletter, { action: event.target.value || null, method: draftFieldString(current.footer.newsletter, "method") || "POST" }) } }))} />
          </section>}
        </>
      )}

      {zone === "header" && <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">{t("headerActions")}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1"><Label>{t("headerBehavior")}</Label><Select disabled={!canEditSettings} value={String(draft.header.behavior ?? "sticky")} onValueChange={(behavior) => setDraft((current) => ({ ...current, header: { ...current.header, behavior } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sticky">{t("sticky")}</SelectItem><SelectItem value="static">{t("static")}</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>{t("activeLinkMode")}</Label><Select disabled={!canEditSettings} value={String(draft.header.activeMode ?? "path")} onValueChange={(activeMode) => setDraft((current) => ({ ...current, header: { ...current.header, activeMode } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="path">{t("activePath")}</SelectItem><SelectItem value="anchor">{t("activeAnchor")}</SelectItem><SelectItem value="none">{t("activeNone")}</SelectItem></SelectContent></Select></div>
          {capability?.mobileMenu?.length ? <div className="space-y-1"><Label>{t("mobileMenu")}</Label><Select disabled={!canEditSettings} value={String(draft.header.mobileMenu ?? capability.mobileMenu[0])} onValueChange={(mobileMenu) => setDraft((current) => ({ ...current, header: { ...current.header, mobileMenu } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{capability.mobileMenu.map((mode: string) => <SelectItem key={mode} value={mode}>{mode === "drawer" ? t("mobileDrawer") : t("mobileDropdown")}</SelectItem>)}</SelectContent></Select></div> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2"><Input disabled={!canEditSettings} maxLength={32} value={draftFieldString(draft.header.cta, "label")} placeholder={t("primaryActionLabel")} onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, cta: mergeDraftGroup(current.header.cta, { label: event.target.value || null }) } }))} /><Input disabled={!canEditSettings} value={draftFieldString(draft.header.cta, "href")} placeholder="/contact" onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, cta: mergeDraftGroup(current.header.cta, { href: event.target.value || null }) } }))} /></div>
        <div className="flex items-center justify-between"><Label htmlFor="header-cta-external">{t("externalLink")}</Label><Switch id="header-cta-external" disabled={!canEditSettings} checked={draftFieldBool(draft.header.cta, "external")} onCheckedChange={(external) => setDraft((current) => ({ ...current, header: { ...current.header, cta: mergeDraftGroup(current.header.cta, { external }) } }))} /></div>
        {capability?.secondaryAction && <div className="grid gap-2 sm:grid-cols-2"><Input disabled={!canEditSettings} maxLength={32} value={draftFieldString(draft.header.secondaryAction, "label")} placeholder={t("secondaryActionLabel")} onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, secondaryAction: mergeDraftGroup(current.header.secondaryAction, { label: event.target.value || null }) } }))} /><Input disabled={!canEditSettings} value={draftFieldString(draft.header.secondaryAction, "href")} placeholder="/login" onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, secondaryAction: mergeDraftGroup(current.header.secondaryAction, { href: event.target.value || null }) } }))} /></div>}
        {capability?.secondaryAction && <div className="flex items-center justify-between"><Label htmlFor="header-secondary-external">{t("externalLink")}</Label><Switch id="header-secondary-external" disabled={!canEditSettings} checked={draftFieldBool(draft.header.secondaryAction, "external")} onCheckedChange={(external) => setDraft((current) => ({ ...current, header: { ...current.header, secondaryAction: mergeDraftGroup(current.header.secondaryAction, { external }) } }))} /></div>}
        {capability?.search && <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="header-search-enabled">{t("siteSearch")}</Label><Switch id="header-search-enabled" disabled={!canEditSettings} checked={draftFieldBool(draft.header.search, "enabled")} onCheckedChange={(enabled) => setDraft((current) => ({ ...current, header: { ...current.header, search: mergeDraftGroup(current.header.search, { enabled }) } }))} /></div><div className="grid gap-2 sm:grid-cols-2"><Input disabled={!canEditSettings} value={draftFieldString(draft.header.search, "action")} placeholder="/search" onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, search: mergeDraftGroup(current.header.search, { action: event.target.value || null }) } }))} /><Input disabled={!canEditSettings} maxLength={48} value={draftFieldString(draft.header.search, "placeholder")} placeholder={t("searchPlaceholder")} onChange={(event) => setDraft((current) => ({ ...current, header: { ...current.header, search: mergeDraftGroup(current.header.search, { placeholder: event.target.value || null }) } }))} /></div></div>}
      </section>}

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

export function PageForm({ initial, tenantId, tenantSlug, tenantDomain, baseHref, tenantOrigin, manifest, theme, siteSettings, rendererNavPages = [], canManageNav, canEditSettings, inHeaderNav, inFooterNav, readOnly = false }: { initial?: Page; tenantId: number | string; tenantSlug?: string | null; tenantDomain?: string | null; baseHref: string; tenantOrigin: string; manifest: RtManifest; theme?: ThemeTokens | null; siteSettings?: unknown; rendererNavPages?: NavPage[]; canManageNav?: boolean; canEditSettings?: boolean; inHeaderNav?: boolean; inFooterNav?: boolean; readOnly?: boolean }) {
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

  // Theme state — seeded from the server-fetched tenant.theme prop (B2).
  // EditorThemeToolbar writes here for immediate renderer updates; persistence
  // piggybacks on the page-form Save cycle. `themeBaseline` is held as
  // STATE (not a ref) so updates to it re-trigger the `themeDirty`
  // memo — a ref would mutate silently and leave the badge stuck on
  // "unsaved" after a successful theme save.
  const tenantStyleCacheKey = String(tenantId)
  const cachedTheme = pageEditorThemeCache.get(tenantStyleCacheKey)
  const [themeState, setThemeState] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedTheme ?? null))
  const [themeBaseline, setThemeBaseline] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedTheme ?? null))
  const themeDirty = useMemo(
    () => JSON.stringify(themeState) !== JSON.stringify(themeBaseline),
    [themeState, themeBaseline],
  )

  useEffect(() => {
    if (theme == null) return
    pageEditorThemeCache.set(tenantStyleCacheKey, normalizeThemeForSave(theme))
  }, [tenantStyleCacheKey, theme])

  // Element selection state — single source of truth.
  // The sidebar and event-delegated renderer selection share one element path.
  const [selected, setSelected] = useState<ElementPath | null>(null)
  const [mobileFocusedSectionIndex, setMobileFocusedSectionIndex] = useState<number | null>(null)
  const [selectedChrome, setSelectedChrome] = useState<SiteChromeSelection | null>(null)
  const siteSettingsState = siteSettings ?? null
  const footerContract = useMemo(() => resolveFooterContract(manifest), [manifest])
  const settingsContract = useMemo(() => resolveSettingsContract(manifest), [manifest])
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
  const rendererSettingsState = useMemo(
    () => rendererSettingsFromChromeDraft(siteSettingsState, chromeDraft, {
      publishedPages: rendererNavPages,
      settingsContract,
    }),
    [chromeDraft, rendererNavPages, settingsContract, siteSettingsState],
  )

  const selectElement = useCallback<Dispatch<SetStateAction<ElementPath | null>>>((next) => {
    if (readOnly) return
    setSelected((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      setSelectedChrome(null)
      return resolved
    })
  }, [readOnly])

  const selectChrome = useCallback((selection: SiteChromeSelection) => {
    if (readOnly) return
    setSelected(null)
    setSelectedChrome(selection)
  }, [readOnly])

  const isDesktop = useIsDesktop()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: initial
      ? { title: initial.title, slug: initial.slug ?? "", status: "published",
          blocks: ensureEditorBlocks((initial.blocks ?? []) as EditorBlock[]), seo: initial.seo ?? {} }
      : { title: "", slug: "", status: "published", blocks: [], seo: {} }
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
        header: {
          ...chromeDraftFromSettings(siteSettingsState, footerContract).header,
          ...((draft.chrome as Partial<SiteChromeDraft>).header ?? {}),
        },
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
    const savedValues: Values = { ...values, status: "published" }
    const saveStartedAt = performance.now()
    setPending(true)
    setSubmitError(null)
    setShowSaved(false)
    const themeWasDirty = themeDirty
    const themeSnapshot = themeState
    const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)
    const navWasDirty = navDirty
    const navSnapshot = { inHeader, inFooter }
    const chromeSnapshot = chromeDraftRef.current
    const chromeWasDirty =
      chromeDirtyRef.current ||
      JSON.stringify(chromeComparable(chromeSnapshot, footerContract)) !==
        JSON.stringify(chromeComparable(chromeBaselineRef.current, footerContract))
    const chromeWillSave = chromeWasDirty && settingsRecordId(siteSettingsState) != null && canEditSettingsResolved
    const normalizedBlocks = normalizePageBlockUploadIds(savedValues.blocks)
    const pageData = {
      ...savedValues,
      tenant: tenantId,
      blocks: Array.isArray(normalizedBlocks)
        ? normalizedBlocks.map((block) => canonicalizeCtaFields(block as Record<string, unknown>))
        : [],
      seo: savedValues.seo
        ? { ...savedValues.seo, ogImage: normalizeUploadId(savedValues.seo.ogImage) }
        : savedValues.seo,
    }
    let createdPage: { id: string | number; slug?: string | null } | null = null
    try {
      const response = await fetch("/api/page-editor-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          page: { id: initial?.id, data: pageData },
          theme: themeWasDirty ? normalizedThemeSnapshot : undefined,
          navigation: navWasDirty ? navSnapshot : undefined,
          chrome: chromeWillSave
            ? chromePatchFromDraft(chromeSnapshot, footerContract)
            : undefined,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof result?.message === "string" ? result.message : `HTTP ${response.status}`
        const stage = typeof result?.stage === "string" ? result.stage : "save"
        throw new Error(`${stage}: ${message}`)
      }
      createdPage = result?.page?.id == null ? null : result.page
      if (themeWasDirty && normalizedThemeSnapshot) {
        const savedTheme = (result?.theme ?? normalizedThemeSnapshot) as ThemeTokens
        setThemeState(savedTheme)
        setThemeBaseline(savedTheme)
        pageEditorThemeCache.set(tenantStyleCacheKey, savedTheme)
      }
      if (navWasDirty) {
        setSavedInHeader(navSnapshot.inHeader)
        setSavedInFooter(navSnapshot.inFooter)
      }
      if (chromeWillSave) setChromeBaseline(chromeSnapshot)
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
        cms_object_id: initial?.id ?? createdPage?.id ?? undefined,
        cms_error_type: msg.split(":", 1)[0] || "save",
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
    form.reset(savedValues)
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
      cms_object_id: initial?.id ?? createdPage?.id ?? undefined,
      cms_dirty_count: dirtyCount,
      cms_duration_ms: performance.now() - saveStartedAt,
    })
    await deletePageEditorDraft(pageDraftKey)
    // No duplicate notification — the top-right SaveButton already shows
    // the "Saved" / "1 unsaved" state.
    if (!initial && createdPage != null) {
      router.replace(pageEditorHref(baseHref, createdPage))
    } else if (initial && savedValues.slug !== initial.slug) {
      router.replace(pageEditorHref(baseHref, { id: initial.id, slug: savedValues.slug }))
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

  const pageMetaControl = form.control as unknown as import("react-hook-form").Control<PageMetaFormValues>
  const pageMetaSetValue = form.setValue as unknown as import("react-hook-form").UseFormSetValue<PageMetaFormValues>
  const pageMetaGetValues = form.getValues as unknown as import("react-hook-form").UseFormGetValues<PageMetaFormValues>

  const onDeletePage = () => {
    if (!readOnly) setDeleteOpen(true)
  }
  const pageTitle = form.watch("title") || initial?.title || ""

  // Watched blocks — needed by SidebarDrillDown in sidebar view.
  const watchedBlocks: EditorBlock[] = form.watch("blocks") ?? []

  useEffect(() => {
    if (readOnly) return
    const normalized = ensureEditorBlocks(watchedBlocks)
    if (JSON.stringify(normalized) !== JSON.stringify(watchedBlocks)) {
      form.setValue("blocks", normalized, { shouldDirty: false })
    }
  }, [form, readOnly, watchedBlocks])

  // Reorder helper for the parent-owned desktop and mobile section lists.
  const reorderBlocks = (from: number, to: number) => {
    if (readOnly) return
    form.setValue("blocks", reorderEditorBlocks(watchedBlocks, from, to), { shouldDirty: true })
    // Keep `selected` coherent: the dragged block follows its new position;
    // blocks in the shift zone shift by one.
    setSelected((prev) => remapSelectionAfterReorder(prev, from, to))
  }

  const deleteBlock = (i: number) => {
    if (readOnly) return
    form.setValue("blocks", removeEditorBlock(watchedBlocks, i), { shouldDirty: true })
    setSelected((prev) => remapSelectionAfterDelete(prev, i))
  }

  const duplicateBlock = (i: number) => {
    if (readOnly) return
    const result = cloneEditorBlockAt(watchedBlocks, i)
    if (!result) return
    form.setValue("blocks", result.blocks, { shouldDirty: true })
    setSelected((prev) => remapSelectionAfterInsert(prev, result.insertedIndex))
  }

  const insertBlockAtIndex = useCallback((index: number, block: Record<string, unknown>) => {
    if (readOnly) return
    const blockType = typeof block.blockType === "string" ? block.blockType : ""
    if (!blockType) return
    form.setValue(
      "blocks",
      insertEditorBlock(watchedBlocks, index, { ...block, blockType }),
      { shouldDirty: true },
    )
    setSelected({ blockIndex: index, field: "" })
  }, [form, readOnly, watchedBlocks])

  // SidebarDrillDown add affordance: append and open the new block form.
  const addBlock = (blockType: string, seed?: Record<string, unknown>) => {
    if (readOnly) return
    const defaultAnchor = manifest?.blocks?.find((m) => m.slug === blockType)?.defaultAnchor
    const next = appendEditorBlock(watchedBlocks, {
      blockType,
      ...(defaultAnchor ? { anchor: defaultAnchor } : {}),
      ...seed,
    })
    form.setValue("blocks", next, { shouldDirty: true })
    setSelected({ blockIndex: next.length - 1, field: "" })
  }

  const insertMobileBlockAt = useCallback((index: number, blockType: string, seed?: Record<string, unknown>) => {
    if (readOnly) return
    const defaultAnchor = manifest?.blocks?.find((m) => m.slug === blockType)?.defaultAnchor
    insertBlockAtIndex(index, { blockType, ...(defaultAnchor ? { anchor: defaultAnchor } : {}), ...seed })
  }, [insertBlockAtIndex, manifest?.blocks, readOnly])

  const mobileFrameBlocksApi = useMemo(() => ({
    blocks: watchedBlocks,
    reorderBlocks,
    insertBlockAt: insertMobileBlockAt,
    deleteBlock,
    duplicateBlock,
  }), [deleteBlock, duplicateBlock, insertMobileBlockAt, reorderBlocks, watchedBlocks])

  useEffect(() => {
    if (mobileFocusedSectionIndex == null) return
    if (watchedBlocks[mobileFocusedSectionIndex]) return
    setMobileFocusedSectionIndex(null)
  }, [mobileFocusedSectionIndex, watchedBlocks])

  // Danger zone shown from page settings in the inspector/mobile shell.
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

  // SEO settings rendered inside the inspector/mobile page settings.
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

  // Page-settings card stack handed to the sidebar `seoCard` slot
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

  // View-live + copy-URL affordances. Page editor saves publish page rows
  // internally; the status field is no longer an editor-facing control.
  const liveLinks = form.watch("slug") ? (
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

  // The visual pane is always the authenticated `/editor-frame` iframe when
  // The iframe owns rendering only. The parent owns fields, ordering, saving,
  // theme controls, and the single inspector sidebar.
  const watchedSeo = form.watch("seo")
  const watchedSlug = form.watch("slug")
  const iframeAnalyticsContext = useMemo(
    () => ({ tenantId, tenantSlug: tenantSlug ?? null, siteDomain: tenantDomain ?? null }),
    [tenantId, tenantSlug, tenantDomain],
  )
  const framePage = useMemo(
    () => pageToJson(
      {
        id: initial?.id,
        title: pageTitle,
        slug: watchedSlug,
        blocks: watchedBlocks,
        seo: watchedSeo,
        updatedAt: initial?.updatedAt,
      },
      iframeAnalyticsContext,
      { preserveBlockIds: true },
    ) as ContractPage,
    [initial?.id, initial?.updatedAt, pageTitle, watchedSlug, watchedBlocks, watchedSeo, iframeAnalyticsContext],
  )
  const frameSettings = rendererSettingsState as ContractSiteSettings | null
  const frameTheme = useMemo(() => normalizeThemeForSave(themeState), [themeState])
  const frameEditorLayout = isDesktop ? "desktop" : "mobile"
  const canRenderEditorFrame = frameSettings != null
  const framePageId = initial?.id ?? "new"
  const frameSelection = useMemo(
    () => elementPathToIframeSelection(selected, watchedBlocks, framePageId),
    [framePageId, selected, watchedBlocks],
  )
  const frameMobileMode = useMemo(() => {
    if (isDesktop || mobileFocusedSectionIndex == null) return undefined
    const focusedBlock = watchedBlocks[mobileFocusedSectionIndex]
    const focusedBlockId = focusedBlock && typeof focusedBlock === "object"
      ? blockWireId(focusedBlock as Record<string, unknown>) ?? undefined
      : undefined
    return {
      mode: "focusedSection" as const,
      focusedBlockIndex: mobileFocusedSectionIndex,
      ...(focusedBlockId ? { focusedBlockId } : {}),
      showChrome: false,
    }
  }, [isDesktop, mobileFocusedSectionIndex, watchedBlocks])
  const handleFrameSelectionChanged = useCallback((selection: IframeEditorSelection | null) => {
    if (readOnly) return
    if (!selection) {
      setSelectedChrome(null)
      setSelected(null)
      return
    }
    const path = iframeSelectionToElementPath(selection, watchedBlocks)
    if (!path) return
    setSelectedChrome(null)
    setSelected(path)
  }, [readOnly, watchedBlocks])
  const handleFrameChromeSelect = useCallback(
    (zone: "header" | "footer") => {
      selectChrome({ zone })
    },
    [selectChrome],
  )

  const pageEditorFrame = canRenderEditorFrame ? (
    <PageEditorFrameHost
      layout={frameEditorLayout}
      pageId={framePageId}
      page={framePage}
      settings={frameSettings!}
      theme={frameTheme}
      tenantId={tenantId}
      tenantSlug={tenantSlug}
      selection={frameSelection}
      mobileMode={frameMobileMode}
      onSelectionChanged={handleFrameSelectionChanged}
      onChromeSelect={handleFrameChromeSelect}
    />
  ) : (
    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
      Site settings are required before the editor frame can load.
    </p>
  )

  return (
    <RtManifestProvider manifest={manifest}>
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col w-full"
      >
          {/* Shared sticky header — sits below SiteHeader, above the editor theme toolbar. */}
          {isDesktop && (
            <header data-siab-cms-sticky-chrome className="sticky top-12 z-20 flex shrink-0 items-center gap-4 border-b bg-background px-4 py-3">
              {readOnly ? (
                <h1 className="min-w-0 truncate text-sm font-medium text-foreground">
                  {pageTitle}
                </h1>
              ) : (
                <PageMetaInline control={pageMetaControl} setValue={pageMetaSetValue} getValues={pageMetaGetValues} />
              )}
              {liveLinks}
              {!readOnly && (
                <div className="ml-auto flex items-end gap-2">
                  <SaveButton pending={pending} isDirty={isDirty} errorCount={errorCount} dirtyCount={dirtyCount} />
                </div>
              )}
            </header>
          )}

          {submitError ? (
            <p className="mx-4 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          {/* Editor-owned theme toolbar — centered over the canvas column, never inside the renderer frame. */}
          {!readOnly && isDesktop && (
            <div
              data-siab-cms-sticky-chrome
              className="pointer-events-none sticky top-[6.5rem] z-20 grid w-full grid-cols-[minmax(0,1fr)_360px] gap-3"
            >
              <div className="pointer-events-auto flex justify-center">
                <EditorThemeToolbar
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

          {!isDesktop && !readOnly && (
            <MobileMediaSheetProvider>
              <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
                <MobileFrameEditor
                  api={mobileFrameBlocksApi}
                  manifest={manifest}
                  theme={themeState}
                  pageTitle={pageTitle}
                  selected={selected}
                  onSelectElement={selectElement}
                  onFocusedSectionChange={setMobileFocusedSectionIndex}
                  focusedFrame={pageEditorFrame}
                  onDeletePage={onDeletePage}
                />
              </BlockPresetsProvider>
            </MobileMediaSheetProvider>
          )}

          {/* Desktop/read-only: exact renderer beside the one inspector. */}
          {(isDesktop || readOnly) && (
            <>
              <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
              <div className="flex w-full min-w-0 items-start gap-3 pt-2">
                <div className="flex-1 min-w-0 pb-24">
                  <MobileMediaSheetProvider>
                      {pageEditorFrame}
                  </MobileMediaSheetProvider>
                </div>
                {isDesktop && !readOnly && (
                  <aside
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
