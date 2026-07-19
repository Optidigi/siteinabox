import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const pageFormSource = () => readFileSync("src/components/forms/PageForm.tsx", "utf8")
const pageEditorCoreHookSource = () => readFileSync("src/components/editor/usePageEditorCore.ts", "utf8")
const pageEditorCoreLibSource = () => readFileSync("src/lib/editor/pageEditorCore.ts", "utf8")
const editorAuthoritySource = () =>
  pageFormSource() + pageEditorCoreHookSource() + pageEditorCoreLibSource()
const siteChromeDraftSource = () => readFileSync("src/lib/siteChromeDraft.ts", "utf8")
const draftStoreSource = () => readFileSync("src/lib/editor/pageDraftStore.ts", "utf8")
const formSubmissionSheetSource = () => readFileSync("src/components/forms/FormSubmissionSheet.tsx", "utf8")

describe("page editor explicit-save contract", () => {
  it("keeps header/footer nav membership changes local until page Save", () => {
    const source = editorAuthoritySource()

    expect(source).toContain("deriveNavDirty(inHeader, inFooter, savedInHeader, savedInFooter")
    expect(source).toContain("navigation: navWasDirty ? navSnapshot : undefined")
    expect(source).toContain('fetch("/api/page-editor-save"')

    const toggleNavStart = source.indexOf("const toggleNav = useCallback(")
    const toggleNavEnd = source.indexOf("const setSavedNav = useCallback", toggleNavStart)
    const toggleNavBody = source.slice(toggleNavStart, toggleNavEnd)
    expect(toggleNavBody).not.toContain("togglePageInNav")
  })

  it("counts and guards unsaved nav membership alongside page and theme edits", () => {
    const source = editorAuthoritySource()

    expect(source).toContain("useNavigationGuard(!readOnly && (isDirty || pending))")
    expect(source).toContain("aggregatePageEditorDirty(dirtyInputs)")
    expect(source).toContain("countPageEditorDirtyLeaves(dirtyInputs)")
  })

  it("serializes media uploads and sparse theme state before explicit Save", () => {
    const source = editorAuthoritySource()

    expect(source).toContain('import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"')
    expect(source).toContain('import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"')
    expect(source).toContain("seedThemeState(theme, cachedTheme)")
    expect(source).toContain("const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)")
    expect(source).toContain("theme: themeWasDirty ? normalizedThemeSnapshot : undefined")
    expect(source).not.toContain('fetch("/api/tenant-theme"')
    expect(source).not.toContain('from "@/lib/actions/setTenantTheme"')
    expect(source).toContain("const normalizedBlocks = normalizePageBlockUploadIds(savedValues.blocks)")
    expect(source).toContain("canonicalizeCtaFields(block as Record<string, unknown>)")
    expect(source).toContain("ogImage: normalizeUploadId(savedValues.seo.ogImage)")
  })

  it("stores nav membership in local draft recovery without server persistence", () => {
    const pageForm = pageFormSource()
    const core = pageEditorCoreHookSource()
    const draftStore = draftStoreSource()

    expect(draftStore).toContain("nav?:")
    expect(draftStore).toContain("chrome?: unknown")
    expect(core).toContain("nav: navStateRef.current")
    expect(core).toContain("chrome: chromeDraftRef.current")
    expect(core).toContain("if (draft.nav) {")
    expect(core).toContain("setInHeader(!!draft.nav.inHeader)")
    expect(core).toContain("setInFooter(!!draft.nav.inFooter)")
    expect(core).toContain("if (draft.chrome) {")
    expect(core).toContain("mergeRestoredChromeDraft(siteSettingsState, footerContract, draft.chrome)")
    expect(pageForm).toContain("<PageDraftRecoveryDialog")
  })

  it("keeps site chrome inspector changes local until explicit page Save", () => {
    const pageForm = pageFormSource()
    const core = editorAuthoritySource()
    const siteChromeDraft = siteChromeDraftSource()

    expect(core).toContain("deriveChromeDirty(chromeDraft, chromeBaseline, footerContract)")
    expect(siteChromeDraft).toContain("columns: comparableFooterColumns(draft.footer.columns, footerContract)")
    expect(siteChromeDraft).toContain("columns: normalizeFooterColumns(draft.footer.columns, footerContract)")
    expect(core).toContain("resolveFooterContract(manifest)")
    expect(pageForm).toContain("<FooterCompositionEditor")
    expect(pageForm).toContain("<SiteChromeDrillDown")
    expect(pageForm).toContain("tenantId={tenantId}")
    expect(pageForm).toContain("<FooterCompositionEditor")
    expect(pageForm).toContain("<SidebarDrillDown")
    expect(pageForm).not.toContain("SiteChromeQuickMenu")
    expect(pageForm).not.toContain("const mobileChromeRows")
    expect(core).toContain("chromeWasDirty && settingsRecordId(siteSettingsState) != null && canEditSettingsResolved")
    expect(core).toContain("chrome: chromeWillSave")
    expect(core).not.toContain('fetch(`/api/site-settings/${siteSettingsState.id}`')
    expect(core).toContain("setChromeBaseline(chromeSnapshot)")
    expect(core).not.toContain("const pageWasDirty =")
    expect(core).toContain("const chromeSnapshot = chromeDraftRef.current")
    expect(core).toContain("chromeBaselineRef.current")
    expect(core).toContain("const current = chromeDraftRef.current")
    expect(core).toContain("setChromeDraftState(resolved)")
  })

  it("clears selected footer chrome when renderer selection moves to a page element", () => {
    const source = pageEditorCoreLibSource()
    const hook = pageEditorCoreHookSource()
    const selectElement = source.slice(source.indexOf("export const selectElementPath"))

    expect(selectElement).toContain("chromeSelection: null")
    expect(hook).toContain("setSelectedChrome(resolved.chromeSelection)")
    expect(hook).not.toContain("if (resolved)")
  })

  it("does not recreate a recovery draft from the normal save reset cycle", () => {
    const source = pageEditorCoreHookSource()

    expect(source).toContain("const cancelScheduledDraftWrite = useCallback(")
    expect(source).toContain("const subscription = form.watch(() => {")
    expect(source).toContain("setShowSaved(false)")
    expect(source).toContain("scheduleDraftWrite()")
    expect(source).toContain("form.reset(savedValues)")
    expect(source).toContain("cancelScheduledDraftWrite()")
    expect(source).toContain("await deletePageEditorDraft(pageDraftKey)")

    const resetStart = source.indexOf("form.reset(savedValues)")
    const deleteStart = source.indexOf("await deletePageEditorDraft(pageDraftKey)", resetStart)
    const saveCleanup = source.slice(resetStart, deleteStart)
    expect(saveCleanup).toContain("cancelScheduledDraftWrite()")
  })

  it("keeps form submission status changes local until explicit Save", () => {
    const source = formSubmissionSheetSource()

    expect(source).toContain('import { SaveButton } from "@/components/save-ui/save-button"')
    expect(source).toContain("const [status, setStatus] = useState<string>")
    expect(source).toContain("const dirty = status !== savedStatus")
    expect(source).toContain("const saveStatus = async () => {")
    expect(source).toContain('method: "PATCH"')
    expect(source).toContain("<Select value={status} onValueChange={(next) => { setShowSaved(false); setStatus(next) }} disabled={pending}>")
    expect(source).toContain("<SaveButton")

    const selectStart = source.indexOf("<Select value={status} onValueChange={setStatus}")
    const selectEnd = source.indexOf("</Select>", selectStart)
    const selectBlock = source.slice(selectStart, selectEnd)
    expect(selectBlock).not.toContain("fetch(")
  })
})
