"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { ChevronLeft, Trash2, ExternalLink, Copy } from "lucide-react"
import Link from "next/link"
import type { Page, SiteSetting } from "@/payload-types"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { PageEditorFrameHost } from "@/components/editor/iframe/PageEditorFrameHost"
import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"
import { ensureCanvasWirePage, ensureCanvasWireSettings } from "@/lib/projection/ensureCanvasWire"
import { settingsToJsonWithoutAnalytics } from "@/lib/projection/settingsToJsonCore"
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
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"

export { useRtManifest }

export function PageForm({ initial, tenantId, tenantSlug, tenantDomain, baseHref, tenantOrigin, manifest, theme, siteSettings, rendererNavPages = [], canManageNav, canEditSettings, inNavbarNav, inFooterNav, readOnly = false }: { initial?: Page; tenantId: number | string; tenantSlug?: string | null; tenantDomain?: string | null; baseHref: string; tenantOrigin: string; manifest: RtManifest; theme?: ThemeTokens | null; siteSettings?: SiteSetting | null; rendererNavPages?: NavPage[]; canManageNav?: boolean; canEditSettings?: boolean; inNavbarNav?: boolean; inFooterNav?: boolean; readOnly?: boolean }) {
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
    canManageNav,
    inNavbarNav,
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
    revealInspectorSelection,
    revealFrameSelection,
    selectElement,
    selectInspectorElement,
    mobileFocusedSectionIndex,
    setMobileFocusedSectionIndex,
    themeState,
    setThemeState,
    inNavbar,
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
    frameSelection,
    frameMobileMode,
    canEditPage,
    canManageNavResolved,
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
            <Label htmlFor="nav-navbar-toggle">{t("includeNavbarNavigation")}</Label>
            <Switch
              id="nav-navbar-toggle"
              checked={inNavbar}
              disabled={pending}
              onCheckedChange={(c) => toggleNav("navbar", c)}
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
  const renderSidebarList = useCallback(
    (ctx: SidebarListSlotContext) => (
      <SidebarListLayout
        header={ctx.header}
        body={
          <>
            {ctx.blocks.length === 0 ? ctx.emptyState : ctx.blockRows}
            {ctx.addBlockButton}
            {ctx.blockTypePicker}
          </>
        }
      />
    ),
    [],
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
    () => ensureCanvasWirePage(pageToJson(
      {
        id: initial?.id,
        title: pageTitle,
        slug: watchedSlug,
        blocks: watchedBlocks,
        seo: watchedSeo,
        updatedAt: initial?.updatedAt,
      } as unknown as Page,
      iframeAnalyticsContext,
      { preserveBlockIds: true },
    ) as ContractPage),
    [initial?.id, initial?.updatedAt, pageTitle, watchedSlug, watchedBlocks, watchedSeo, iframeAnalyticsContext],
  )
  const frameSettings = siteSettingsState
    ? ensureCanvasWireSettings(settingsToJsonWithoutAnalytics(siteSettingsState, rendererNavPages)) as ContractSiteSettings
    : null
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
      revealSelection={revealFrameSelection}
      mobileMode={frameMobileMode}
      onSelectionChanged={handleFrameSelectionChanged}
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
              <div className="flex w-full min-w-0 min-h-0 items-stretch gap-3 pt-2">
                <div className="flex min-w-0 flex-1 pb-24">
                  <MobileMediaSheetProvider>
                    <div className="w-full">
                      {pageEditorFrame}
                    </div>
                  </MobileMediaSheetProvider>
                </div>
                {isDesktop && !readOnly && (
                  <aside
                    className="sticky top-[calc(6.5rem+0.5rem)] h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)] w-[360px] shrink-0 self-start overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <EditorErrorBoundary>
                      <SidebarDrillDown
                          blocks={watchedBlocks}
                          selectedBlockIndex={selected?.blockIndex ?? null}
                          selectedPath={selected}
                          revealSelectedPath={revealInspectorSelection}
                          onSelectBlock={(i) => {
                            selectElement(i != null ? { blockIndex: i, field: "" } : null)
                          }}
                          onSelectPath={selectInspectorElement}
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
