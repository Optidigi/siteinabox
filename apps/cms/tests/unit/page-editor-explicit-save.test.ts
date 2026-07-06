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
    expect(source).toContain("const saveNavMembership = async () => {")
    expect(source).toContain('togglePageInNav(tenantId, initial.id, "header", navSnapshot.inHeader)')
    expect(source).toContain('togglePageInNav(tenantId, initial.id, "footer", navSnapshot.inFooter)')
    expect(source).toContain("await Promise.all([themePromise, saveNavMembership(), saveChrome()])")

    const toggleNavStart = source.indexOf("const toggleNav = useCallback(")
    const toggleNavEnd = source.indexOf("// Editor mode:", toggleNavStart)
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
    expect(source).toContain("const [themeState, setThemeState] = useState<ThemeTokens | null>(() => normalizeThemeForSave(theme ?? cachedStyle?.theme ?? null))")
    expect(source).toContain("const normalizedThemeSnapshot = normalizeThemeForSave(themeSnapshot)")
    expect(source).toContain('fetch("/api/tenant-theme"')
    expect(source).toContain("themeWasDirty && normalizedThemeSnapshot")
    expect(source).toContain("saveTenantTheme(tenantId, normalizedThemeSnapshot)")
    expect(source).not.toContain('from "@/lib/actions/setTenantTheme"')
    expect(source).toContain("blocks: normalizePageBlockUploadIds(savedValues.blocks)")
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
    expect(source).toContain("<SiteChromeQuickMenu")
    expect(source).toContain("tenantId={tenantId}")
    expect(source).toContain('useState<"main" | "columns" | "items" | "logo">("main")')
    expect(source).toContain('setPanel("columns")')
    expect(source).toContain('setPanel("items")')
    expect(source).toContain('setPanel("logo")')
    expect(source).toContain('max-h-[min(28rem,calc(100vh-1rem))]')
    expect(source).toContain("window.innerWidth - 368")
    expect(source).toContain("w-88")
    expect(source).toContain('navigationHref ? "grid-cols-2" : "grid-cols-1"')
    expect(source).not.toContain("const mobileChromeRows")
    expect(source).toContain("const saveChrome = async () => {")
    expect(source).toContain('fetch(`/api/site-settings/${siteSettingsState.id}`')
    expect(source).toContain("body: JSON.stringify({ chrome: chromePatchFromDraft(chromeSnapshot, footerContract) })")
    expect(source).toContain("setChromeBaseline(chromeSnapshot)")
    expect(source).toContain("const pageWasDirty =")
    expect(source).toContain('initial.status !== "published"')
    expect(source).toContain("if (pageWasDirty) {")
    expect(source).toContain("const chromeSnapshot = chromeDraftRef.current")
    expect(source).toContain("chromeBaselineRef.current")
    expect(source).toContain("const current = chromeDraftRef.current")
    expect(source).toContain("setChromeDraftState(resolved)")
  })

  it("clears selected footer chrome when canvas selection is cleared or moves to a page element", () => {
    const source = pageFormSource()
    const canvasMode = readFileSync("src/components/editor/canvas/CanvasSurface.tsx", "utf8")
    const selectStart = source.indexOf("const selectElement = useCallback")
    const selectEnd = source.indexOf("const selectChrome = useCallback", selectStart)
    const selectElement = source.slice(selectStart, selectEnd)

    expect(selectElement).toContain("setSelectedChrome(null)")
    expect(selectElement).toContain("setChromeQuickMenu(null)")
    expect(selectElement).not.toContain("if (resolved)")
    expect(canvasMode).toContain('className="site-frame-root"')
    expect(canvasMode).toContain("if (event.target === event.currentTarget) {")
    expect(canvasMode).toContain("setActiveIndex(null)")
    expect(canvasMode).toContain("select(null)")
  })

  it("clears selected footer chrome when the canvas quick menu is dismissed", () => {
    const source = pageFormSource()

    const quickMenuStart = source.indexOf("<SiteChromeQuickMenu")
    const quickMenuEnd = source.indexOf("</SiteChromeQuickMenu>", quickMenuStart)
    const quickMenuBlock = source.slice(quickMenuStart, quickMenuEnd)

    expect(quickMenuBlock).toContain("onClose={() => {")
    expect(quickMenuBlock).toContain("setChromeQuickMenu(null)")
    expect(quickMenuBlock).toContain("setSelectedChrome(null)")
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
