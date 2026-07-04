import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("mobile iframe native editor source contract", () => {
  it("hosts parent-owned section list, focused frame, and two-detent field inspector", () => {
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
    expect(shell).toContain("onSelectElement(null)")
    expect(shell).toContain("selected.blockIndex !== screen.index")
    expect(shell).toContain("<MobileInspectorBar block={block} blockIndex={index}")
    expect(shell).not.toContain("onSelectElement({ blockIndex: index, field: \"\" })")
    expect(shell).not.toContain("!selected.field")
    expect(shell).not.toContain("CanvasBlockRenderer")
    expect(shell).not.toContain("CanvasMode")

    expect(pageForm).toContain('import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"')
    expect(pageForm).toContain("mobileFocusedSectionIndex")
    expect(pageForm).toContain("setMobileFocusedSectionIndex")
    expect(pageForm).toContain("frameMobileMode")
    expect(pageForm).toContain("allowInlineEditing: false")
    expect(pageForm).toContain("<MobileFrameEditor")
    expect(pageForm).toContain("onOpenBlockInspector={openBlockInSidebar}")
    expect(pageForm).toContain("if (!isDesktop) {")
    expect(pageForm).toContain("<MobileMediaSheetProvider>")
  })

  it("keeps nonce-bearing vaul snap css on the two-detent mobile field inspector", () => {
    const sharedCss = read("apps/cms/src/components/editor/canvas/mobile/vaulBottomSnapCss.ts")
    const legacyInspector = read("apps/cms/src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")

    expect(sharedCss).toContain("export const VAUL_BOTTOM_SNAP_CSS")
    expect(sharedCss).toContain("[data-vaul-handle]")
    expect(legacyInspector).toContain('from "@/components/editor/canvas/mobile/vaulBottomSnapCss"')
    expect(legacyInspector).toContain("data-mobile-inspector-vaul-css")
    expect(legacyInspector).toContain("const SNAP_POINTS: MobileSnap[] = [MOBILE_INSPECTOR_COLLAPSED_SNAP, 0.42, 0.92]")
    expect(legacyInspector).toContain("dismissible={false}")
    expect(legacyInspector).toContain('if (isIdle) setSelected({ blockIndex, field: "" })')
    expect(legacyInspector).toContain("useInspectorKeyboardLock(!isIdle && !isDirectMediaSelection)")
    expect(legacyInspector).toContain('import { BlockFormFields } from "@/components/editor/fields/block-form-fields"')
    expect(legacyInspector).toContain('const isBlockSelection = state.selected?.field === ""')
    expect(legacyInspector).toContain("<BlockFormFields")
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
