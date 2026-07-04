import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("mobile iframe native editor source contract", () => {
  it("hosts the canonical parent-owned section list, focused frame, and two-detent inspector", () => {
    const shell = read("apps/cms/src/components/editor/iframe/MobileFrameEditor.tsx")
    const pageForm = read("apps/cms/src/components/forms/PageForm.tsx")

    expect(shell).toContain("export function MobileFrameEditor")
    expect(shell).toContain("<MobileSectionList")
    expect(shell).toContain("<MobileInspectorBar")
    expect(shell).toContain("<MobilePageSettings")
    expect(shell).toContain("<MobileSeoSettings")
    expect(shell).toContain("focusedFrame")
    expect(shell).toContain('if (screen.type === "section")')
    expect(shell).toContain("const block = api.blocks[index]")
    expect(shell).toContain("if (!block) return null")
    expect(shell).toContain("onFocusedSectionChange(index)")
    expect(shell).toContain("window.scrollTo({ top: 0 })")
    expect(shell).toContain("onSelectElement(null)")
    expect(shell).toContain("selected.blockIndex !== screen.index")
    expect(shell).toContain('className="-mx-4 flex min-h-[calc(100dvh-4.5rem)] flex-col"')
    expect(shell).toContain('<div className="min-h-0">')
    expect(shell).not.toContain('className="flex h-[calc(100dvh-4.5rem)] min-h-0 flex-col"')
    expect(shell).not.toContain('className="min-h-0 flex-1 overflow-hidden"')
    expect(shell).toContain('import { MobileBackPill } from "@/components/common/mobile-back-pill"')
    expect(shell).toContain("<MobileBackPill onBack={onBack} />")
    expect(shell).toContain('aria-label={t("switchSection", { label })}')
    expect(shell).toContain('aria-label={t("previousSection")}')
    expect(shell).toContain('aria-label={t("nextSection")}')
    expect(shell).toContain("const [trashPillVisible, setTrashPillVisible] = React.useState(true)")
    expect(shell).toContain("setTrashPillVisible(window.scrollY <= 24)")
    expect(shell).toContain('window.addEventListener("scroll", onScroll, { passive: true })')
    expect(shell).toContain("isInspectorIdle && (")
    expect(shell).toContain('position="top-right"')
    expect(shell).toContain('offset="3.75rem"')
    expect(shell).toContain("visible={trashPillVisible}")
    expect(shell).toContain('ariaLabel={t("deleteSection")}')
    expect(shell).toContain('"data-mobile-trash-pill"')
    expect(shell).toContain("<MobileInspectorBar block={block} blockIndex={index}")
    expect(shell).not.toContain("onSelectElement({ blockIndex: index, field: \"\" })")
    expect(shell).not.toContain("!selected.field")
    expect(shell).not.toContain("CanvasBlockRenderer")
    expect(shell).not.toContain("CanvasMode")

    expect(pageForm).toContain('import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"')
    expect(pageForm).toContain("mobileFocusedSectionIndex")
    expect(pageForm).toContain("setMobileFocusedSectionIndex")
    expect(pageForm).toContain("frameMobileMode")
    expect(pageForm).toContain("focusedBlockIndex: mobileFocusedSectionIndex")
    expect(pageForm).toContain("showChrome: false")
    expect(pageForm).toContain("showGutters: false")
    expect(pageForm).toContain("allowInlineEditing: false")
    expect(pageForm).toContain("<MobileFrameEditor")
    expect(pageForm).toContain("onOpenBlockInspector={openBlockInSidebar}")
    expect(pageForm).toContain("if (!isDesktop) {")
    expect(pageForm).toContain("<MobileMediaSheetProvider>")
  })

  it("keeps nonce-bearing vaul snap css on the two-detent mobile field inspector", () => {
    const sharedCss = read("apps/cms/src/components/editor/canvas/mobile/vaulBottomSnapCss.ts")
    const inspector = read("apps/cms/src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")

    expect(sharedCss).toContain("export const VAUL_BOTTOM_SNAP_CSS")
    expect(sharedCss).toContain("[data-vaul-handle]")
    expect(inspector).toContain('from "@/components/editor/canvas/mobile/vaulBottomSnapCss"')
    expect(inspector).toContain("data-mobile-inspector-vaul-css")
    expect(inspector).toContain("const SNAP_POINTS: MobileSnap[] = [MOBILE_INSPECTOR_COLLAPSED_SNAP, 0.42, 0.92]")
    expect(inspector).toContain("dismissible={false}")
    expect(inspector).toContain('if (isIdle) setSelected({ blockIndex, field: "" })')
    expect(inspector).toContain("useInspectorKeyboardLock(!isIdle && !isDirectMediaSelection)")
    expect(inspector).toContain('import { BlockFormFields } from "@/components/editor/fields/block-form-fields"')
    expect(inspector).toContain('const isBlockSelection = state.selected?.field === ""')
    expect(inspector).toContain("<BlockFormFields")
  })

  it("keeps mobile editor context actions idempotent to avoid section-open render loops", () => {
    const context = read("apps/cms/src/components/editor/canvas/mobile/MobileEditorContext.tsx")

    expect(context).toContain("function sameElementPath")
    expect(context).toContain("if (sameElementPath(state.selected, p)) return state")
    expect(context).toContain("state.selected == null")
    expect(context).toContain("return state")
    expect(context).toContain("React.useCallback((path: ElementPath) => dispatch({ type: \"SET_SELECTED\", path }), [])")
    expect(context).toContain("React.useCallback(() => dispatch({ type: \"CLEAR_SELECTION\" }), [])")
  })
})
