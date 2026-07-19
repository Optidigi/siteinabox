import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const pageFormSource = () => readFileSync("src/components/forms/PageForm.tsx", "utf8")
const siteChromeDraftSource = () => readFileSync("src/lib/siteChromeDraft.ts", "utf8")
const draftStoreSource = () => readFileSync("src/lib/editor/pageDraftStore.ts", "utf8")
const formSubmissionSheetSource = () => readFileSync("src/components/forms/FormSubmissionSheet.tsx", "utf8")

describe("page editor explicit-save contract", () => {
  it("keeps header/footer nav membership changes local until page Save", () => {
    const source = pageFormSource()

    expect(source).toContain("const navDirty = !!initial && (inHeader !== savedInHeader || inFooter !== savedInFooter)")
    expect(source).toContain("navigation: navWasDirty ? navSnapshot : undefined")
    expect(source).toContain('fetch("/api/page-editor-save"')

    const toggleNavStart = source.indexOf("const toggleNav = useCallback(")
    const toggleNavEnd = source.indexOf("// Theme state", toggleNavStart)
    const toggleNavBody = source.slice(toggleNavStart, toggleNavEnd)
    expect(toggleNavBody).not.toContain("togglePageInNav")
  })

  it("counts and guards unsaved nav membership alongside page and theme edits", () => {
    const source = pageFormSource()

    expect(source).toContain("useNavigationGuard(!readOnly && (form.formState.isDirty || themeDirty || navDirty || chromeDirty || pending))")
    expect(source).toContain("const isDirty = !readOnly && (form.formState.isDirty || themeDirty || navDirty || chromeDirty)")
    expect(source).toContain("const dirtyCount = readOnly ? 0 : countLeafDirty(form.formState.dirtyFields) + (themeDirty ? 1 : 0) + (navDirty ? 1 : 0) + (chromeDirty ? 1 : 0)")
  })

  it("serializes media uploads and sparse theme state before explicit Save", () => {
    const source = pageFormSource()

    expect(source).toContain('import { normalizePageBlockUploadIds, normalizeUploadId } from "@/lib/uploadValues"')
    expect(source).toContain('import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"')
    expect(source).toContain("const [themeState, setThemeState] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedTheme ?? null))")
    expect(source).toContain("const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)")
    expect(source).toContain("theme: themeWasDirty ? normalizedThemeSnapshot : undefined")
    expect(source).not.toContain('fetch("/api/tenant-theme"')
    expect(source).not.toContain('from "@/lib/actions/setTenantTheme"')
    expect(source).toContain("const normalizedBlocks = normalizePageBlockUploadIds(savedValues.blocks)")
    expect(source).toContain("normalizedBlocks.map((block: any) => canonicalizeCtaFields(block))")
    expect(source).toContain("ogImage: normalizeUploadId(savedValues.seo.ogImage)")
  })

  it("stores nav membership in local draft recovery without server persistence", () => {
    const pageForm = pageFormSource()
    const draftStore = draftStoreSource()

    expect(draftStore).toContain("nav?:")
    expect(draftStore).toContain("chrome?: unknown")
    expect(pageForm).toContain("nav: navStateRef.current")
    expect(pageForm).toContain("chrome: chromeDraftRef.current")
    expect(pageForm).toContain("if (draft.nav) {")
    expect(pageForm).toContain("setInHeader(!!draft.nav.inHeader)")
    expect(pageForm).toContain("setInFooter(!!draft.nav.inFooter)")
    expect(pageForm).toContain("if (draft.chrome) {")
    expect(pageForm).toContain("setChromeDraft({")
    expect(pageForm).toContain("chromeDraftFromSettings(siteSettingsState, footerContract)")
  })

  it("keeps site chrome inspector changes local until explicit page Save", () => {
    const source = pageFormSource()
    const siteChromeDraft = siteChromeDraftSource()

    expect(source).toContain("const chromeDirty = useMemo(")
    expect(siteChromeDraft).toContain("columns: comparableFooterColumns(draft.footer.columns, footerContract)")
    expect(siteChromeDraft).toContain("columns: normalizeFooterColumns(draft.footer.columns, footerContract)")
    expect(source).toContain("resolveFooterContract(manifest)")
    expect(source).toContain("<FooterCompositionEditor")
    expect(source).toContain("<SiteChromeDrillDown")
    expect(source).toContain("tenantId={tenantId}")
    expect(source).toContain("<FooterCompositionEditor")
    expect(source).toContain("<SidebarDrillDown")
    expect(source).not.toContain("SiteChromeQuickMenu")
    expect(source).not.toContain("const mobileChromeRows")
    expect(source).toContain("const chromeWillSave = chromeWasDirty && Boolean(siteSettingsState?.id) && canEditSettingsResolved")
    expect(source).toContain("chrome: chromeWillSave")
    expect(source).not.toContain('fetch(`/api/site-settings/${siteSettingsState.id}`')
    expect(source).toContain("setChromeBaseline(chromeSnapshot)")
    expect(source).not.toContain("const pageWasDirty =")
    expect(source).toContain("const chromeSnapshot = chromeDraftRef.current")
    expect(source).toContain("chromeBaselineRef.current")
    expect(source).toContain("const current = chromeDraftRef.current")
    expect(source).toContain("setChromeDraftState(resolved)")
  })

  it("clears selected footer chrome when renderer selection moves to a page element", () => {
    const source = pageFormSource()
    const selectStart = source.indexOf("const selectElement = useCallback")
    const selectEnd = source.indexOf("const selectChrome = useCallback", selectStart)
    const selectElement = source.slice(selectStart, selectEnd)

    expect(selectElement).toContain("setSelectedChrome(null)")
    expect(selectElement).not.toContain("if (resolved)")
  })

  it("does not recreate a recovery draft from the normal save reset cycle", () => {
    const source = pageFormSource()

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
