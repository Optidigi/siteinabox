"use client"
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { Form } from "@siteinabox/ui/components/form"
import { Input } from "@siteinabox/ui/components/input"
import { Switch } from "@siteinabox/ui/components/switch"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { RtManifestProvider, useRtManifest } from "@/components/editor/RtManifestContext"
import { SaveStatusBar } from "@/components/save-ui/save-status-bar"
import { SaveButton } from "@/components/save-ui/save-button"
import { PageMetaInline, type PageMetaFormValues } from "@/components/editor/page-meta-inline"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { PageDraftRecoveryDialog } from "@/components/forms/PageDraftRecoveryDialog"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { usePageEditorCore } from "@/components/editor/usePageEditorCore"
import { parsePayloadError } from "@/lib/api"
import { ChevronLeft, Trash2, ExternalLink, Copy, Navigation, PanelBottom, PanelTop, Plus, X, Cookie } from "lucide-react"
import Link from "next/link"
import type { Page, SiteSetting } from "@/payload-types"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import { SHADCNUI_CHROME_VARIANTS, SITE_CHROME_CATALOG } from "@siteinabox/contracts"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { PageEditorFrameHost } from "@/components/editor/iframe/PageEditorFrameHost"
import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"
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
import { EditorErrorBoundary } from "@/components/editor/EditorErrorBoundary"
import { EditorThemeToolbar } from "@/components/editor/theme/editor-theme-toolbar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { useStatusFeedback } from "@/components/status-feedback"
import { useSidebar } from "@siteinabox/ui/components/sidebar"
import { useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { useTranslations } from "next-intl"
import { pageEditorHref } from "@/lib/pageEditorUrls"
import type { NavPage } from "@/lib/projection/resolveNav"
import { SiteChromeRow, siteChromeZoneLabel, type SiteChromeSelection, type SiteChromeZone } from "@/components/editor/sidebar/SiteChromeRow"
import { MediaPicker } from "@/components/media/MediaPicker"
import {
  createFooterItem,
  defaultFooterItemLabel,
  ensureFooterColumnItems,
  normalizeFooterColumns,
  setFooterColumnCount,
  type FooterCompositionColumn,
  type FooterCompositionContract,
  type FooterItemType,
} from "@/lib/footerComposition"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"
import type { SiteChromeDraft } from "@/lib/siteChromeDraft"

export { useRtManifest }

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

  if (zone === "banner") {
    const banner = asDraftRecord(draft.banner)
    const variant = String(banner.variant ?? "")
    const variantOptions = SITE_CHROME_CATALOG.filter((entry) =>
      entry.area === "banner" && (entry.scope.kind === "global" || entry.variant === variant),
    )
    const setBanner = (patch: DraftRecord) => {
      if (!canEditSettings) return
      setDraft((current) => ({
        ...current,
        banner: { ...asDraftRecord(current.banner), ...patch },
      }))
    }
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground px-0.5">{t("bannerCookieHint")}</p>
        <section className="space-y-2 rounded-md border border-border bg-card p-4">
          <Label htmlFor="site-chrome-banner-variant">{t("layoutVariant")}</Label>
          <Select
            value={variant || undefined}
            disabled={!canEditSettings}
            onValueChange={(value) => setBanner({ variant: value })}
          >
            <SelectTrigger id="site-chrome-banner-variant"><SelectValue /></SelectTrigger>
            <SelectContent>
              {variantOptions.map((option) => (
                <SelectItem key={option.variant} value={option.variant}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="site-chrome-banner-visible">{t("bannerVisible")}</Label>
            <Switch
              id="site-chrome-banner-visible"
              disabled={!canEditSettings}
              checked={banner.visible === true}
              onCheckedChange={(visible) => setBanner({ visible })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="site-chrome-banner-dismissible">{t("bannerDismissible")}</Label>
            <Switch
              id="site-chrome-banner-dismissible"
              disabled={!canEditSettings}
              checked={banner.dismissible !== false}
              onCheckedChange={(dismissible) => setBanner({ dismissible })}
            />
          </div>
        </section>
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="site-chrome-banner-title">{t("bannerTitle")}</Label>
            <Input
              id="site-chrome-banner-title"
              disabled={!canEditSettings}
              value={typeof banner.title === "string" ? banner.title : ""}
              onChange={(event) => setBanner({ title: event.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-chrome-banner-message">{t("bannerMessage")}</Label>
            <Textarea
              id="site-chrome-banner-message"
              disabled={!canEditSettings}
              value={typeof banner.message === "string" ? banner.message : ""}
              onChange={(event) => setBanner({ message: event.target.value || null })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("bannerLinkLabel")}</Label>
              <Input
                disabled={!canEditSettings}
                value={draftFieldString(banner.link, "label")}
                onChange={(event) => setBanner({
                  link: mergeDraftGroup(banner.link, { label: event.target.value || null }),
                })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("bannerLinkUrl")}</Label>
              <Input
                disabled={!canEditSettings}
                value={draftFieldString(banner.link, "href")}
                inputMode="url"
                onChange={(event) => setBanner({
                  link: mergeDraftGroup(banner.link, { href: event.target.value || null }),
                })}
              />
            </div>
          </div>
        </section>
        {canEditSettings && (
          <p className="text-xs text-muted-foreground">{tCommon("save")}: {t("siteChromeSaveHint")}</p>
        )}
      </div>
    )
  }

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
  const label = siteChromeZoneLabel(zone, t)
  const Icon = zone === "header" ? PanelTop : zone === "footer" ? PanelBottom : Cookie
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

export function PageForm({ initial, tenantId, tenantSlug, tenantDomain, baseHref, tenantOrigin, manifest, theme, siteSettings, rendererNavPages = [], canManageNav, canEditSettings, inHeaderNav, inFooterNav, readOnly = false }: { initial?: Page; tenantId: number | string; tenantSlug?: string | null; tenantDomain?: string | null; baseHref: string; tenantOrigin: string; manifest: RtManifest; theme?: ThemeTokens | null; siteSettings?: SiteSetting | null; rendererNavPages?: NavPage[]; canManageNav?: boolean; canEditSettings?: boolean; inHeaderNav?: boolean; inFooterNav?: boolean; readOnly?: boolean }) {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const seoFields = [
    { name: "title", type: "text", label: t("seoTitle") },
    { name: "description", type: "textarea", label: t("seoDescription") },
    { name: "ogImage", type: "upload", relationTo: "media", label: t("openGraphImage") }
  ]
  const [deleteOpen, setDeleteOpen] = useState(false)
  const siteSettingsState = siteSettings ?? null

  const core = usePageEditorCore({
    initial,
    tenantId,
    baseHref,
    manifest,
    theme,
    siteSettings,
    rendererNavPages,
    canManageNav,
    canEditSettings,
    inHeaderNav,
    inFooterNav,
    readOnly,
    t,
    onDraftRestoreFailed: () => status.error(t("draftRestoreFailed")),
    onDraftRestored: () => status.success(t("draftRestored")),
    onDraftDiscarded: () => status.success(t("draftDiscarded")),
    // Save failure surfaces via SaveStatusBar + submitError banner (avoid a
    // third bottom floater colliding with StatusFeedback).
    onSaveFailed: () => {},
    onSaveSuccess: async ({ savedValues, createdPage }) => {
      if (!initial && createdPage != null) {
        router.replace(pageEditorHref(baseHref, createdPage))
      } else if (initial && savedValues.slug !== initial.slug) {
        router.replace(pageEditorHref(baseHref, { id: initial.id, slug: savedValues.slug }))
      } else {
        router.refresh()
      }
    },
  })

  const {
    form,
    isDesktop,
    selected,
    selectedChrome,
    selectElement,
    selectChrome,
    clearChromeSelection,
    mobileFocusedSectionIndex,
    setMobileFocusedSectionIndex,
    themeState,
    setThemeState,
    chromeDraft,
    setChromeDraft,
    rendererSettingsState,
    footerContract,
    inHeader,
    inFooter,
    toggleNav,
    isDirty,
    dirtyCount,
    errorCount,
    saveStatus,
    pending,
    submitError,
    watchedBlocks,
    reorderBlocks,
    deleteBlock,
    duplicateBlock,
    addBlock,
    mobileFrameBlocksApi,
    draftCandidate,
    restorePageDraft,
    discardPageDraft,
    guard,
    triggerSave,
    retry,
    jumpToError,
    onSubmit,
    onInvalid,
    handleFrameSelectionChanged,
    handleFrameChromeSelect,
    frameSelection,
    frameMobileMode,
    canEditPage,
    canManageNavResolved,
    canEditSettingsResolved,
  } = core

  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar()
  const saveStatusBarOffset = sidebarIsMobile
    ? "0px"
    : sidebarState === "expanded"
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)"
  const pageEditorSaveStatusBarPosition = useCspStyleRule(
    "page-editor-save-status-bar-position",
    `left:calc(${saveStatusBarOffset} + 1.5rem);right:1.5rem;bottom:calc(env(safe-area-inset-bottom, 0px) + 4.75rem);`,
  )

  const navigateFromChrome = useCallback(
    (href: string) => guard.guardedNavigate(() => router.push(href)),
    [guard, router],
  )

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

  const onDelete = async () => {
    if (readOnly) return
    if (!initial) return
    const res = await fetch(`/api/pages/${initial.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
    form.reset(form.getValues(), { keepValues: true })
    status.success(t("deletePageTitle", { title: initial.title }))
    router.replace(baseHref)
    router.refresh()
  }

  const pageMetaControl = form.control as unknown as import("react-hook-form").Control<PageMetaFormValues>
  const pageMetaSetValue = form.setValue as unknown as import("react-hook-form").UseFormSetValue<PageMetaFormValues>
  const pageMetaGetValues = form.getValues as unknown as import("react-hook-form").UseFormGetValues<PageMetaFormValues>
  const onDeletePage = () => {
    if (!readOnly) setDeleteOpen(true)
  }
  const pageTitle = form.watch("title") || initial?.title || ""

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
      if (!navigationHref || zone === "banner") return null
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
                zone="banner"
                selected={selectedChrome?.zone === "banner"}
                onSelect={selectChrome}
              />
            )}
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
      } as Page,
      iframeAnalyticsContext,
      { preserveBlockIds: true },
    ) as ContractPage,
    [initial?.id, initial?.updatedAt, pageTitle, watchedSlug, watchedBlocks, watchedSeo, iframeAnalyticsContext],
  )
  const frameSettings = rendererSettingsState as ContractSiteSettings | null
  const frameTheme = useMemo(() => normalizeThemeForSave(themeState), [themeState])
  const frameEditorLayout = isDesktop === false ? "mobile" : "desktop"
  const canRenderEditorFrame = frameSettings != null
  const framePageId = initial?.id ?? "new"

  const pageEditorBreakpointSkeleton = (
    <div className="w-full bg-background p-4" aria-live="polite" data-siab-editor-breakpoint-skeleton>
      <div className="space-y-4 animate-pulse" aria-label="Loading editor layout">
        <div className="h-16 rounded-lg bg-muted" />
        <div className="h-72 rounded-lg bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
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
      {t("editorFrameRequiresSettings")}
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
              <Button asChild type="button" variant="secondary" size="sm" className="h-8 shrink-0 gap-1">
                <Link href={baseHref} aria-label={t("backToPages")}>
                  <ChevronLeft className="size-4" aria-hidden />
                  {t("backToPages")}
                </Link>
              </Button>
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

          {isDesktop === null && !readOnly ? pageEditorBreakpointSkeleton : null}

          {isDesktop === false && !readOnly && (
            <MobileMediaSheetProvider>
              <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
                <div className="mb-3 flex flex-col gap-2">
                  <Button asChild type="button" variant="secondary" size="sm" className="h-9 w-fit gap-1">
                    <Link href={baseHref}>
                      <ChevronLeft className="size-4" aria-hidden />
                      {t("backToPages")}
                    </Link>
                  </Button>
                </div>
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
          {(isDesktop || readOnly) && isDesktop !== null && (
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
                          onBack={() => clearChromeSelection()}
                        />
                      ) : (
                        <SidebarDrillDown
                          blocks={watchedBlocks}
                          selectedBlockIndex={selected?.blockIndex ?? null}
                          selectedPath={selected}
                          onSelectBlock={(i) => {
                            clearChromeSelection()
                            selectElement(i != null ? { blockIndex: i, field: "" } : null)
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
        {isDesktop === false && !readOnly && (
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
        <div
          className={cn(
            "pointer-events-none fixed z-40 grid grid-cols-[minmax(0,1fr)_360px] gap-3",
            pageEditorSaveStatusBarPosition.className,
          )}
        >
          {pageEditorSaveStatusBarPosition.styleElement}
          <div className="pointer-events-auto flex justify-center">
            <SaveStatusBar
              layout="canvas"
              status={saveStatus}
              errorCount={errorCount}
              onRetry={retry}
              onJumpToError={jumpToError}
            />
          </div>
        </div>
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
