import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const pageFormSource = () => readFileSync("src/components/forms/PageForm.tsx", "utf8")
const pageEditorCoreHookSource = () => readFileSync("src/components/editor/usePageEditorCore.ts", "utf8")
const pageEditorCoreLibSource = () => readFileSync("src/lib/editor/pageEditorCore.ts", "utf8")
const editorAuthoritySource = () =>
  pageFormSource() + pageEditorCoreHookSource() + pageEditorCoreLibSource()
const draftStoreSource = () => readFileSync("src/lib/editor/pageDraftStore.ts", "utf8")
const formSubmissionSheetSource = () => readFileSync("src/components/forms/FormSubmissionSheet.tsx", "utf8")

describe("page editor explicit-save contract", () => {
  it("keeps header/footer nav membership changes local until page Save", () => {
    const source = editorAuthoritySource()

    expect(source).toContain("deriveNavDirty(inNavbar, inFooter, savedInNavbar, savedInFooter")
    expect(source).toContain("siteDesign.navigation = navSnapshot")
    expect(source).toContain('fetch("/api/page-editor-save"')
    expect(source).toContain("expectedUpdatedAt: baselineUpdatedAtRef.current")
    expect(source).toContain("publish: true")
    expect(source).toContain("baselineUpdatedAtRef.current = result.page.updatedAt")

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
    expect(source).toContain("siteDesign.theme = normalizedThemeSnapshot")
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
    expect(core).toContain("nav: navStateRef.current")
    expect(core).toContain("if (draft.nav) {")
    expect(core).toContain("setInNavbar(!!draft.nav.inNavbar)")
    expect(core).toContain("setInFooter(!!draft.nav.inFooter)")
    expect(pageForm).toContain("<PageDraftRecoveryDialog")
  })

  it("does not expose unimplemented chrome editing through the page editor", () => {
    const pageForm = pageFormSource()
    const core = editorAuthoritySource()

    expect(pageForm).not.toContain("SiteChrome")
    expect(pageForm).not.toContain("FooterCompositionEditor")
    expect(core).not.toContain("chromeDraft")
    expect(core).not.toContain("siteDesign.chrome")
  })

  it("keeps selection limited to page elements", () => {
    const source = pageEditorCoreLibSource()
    const selectElement = source.slice(source.indexOf("export const selectElementPath"))

    expect(selectElement).toContain("selection: resolved")
    expect(selectElement).not.toContain("chromeSelection")
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
