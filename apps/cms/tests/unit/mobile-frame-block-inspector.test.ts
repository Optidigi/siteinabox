import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("mobile iframe native editor source contract", () => {
  it("hosts a three-pane page editor with desktop inspector reuse", () => {
    const shell = read("apps/cms/src/components/editor/iframe/MobilePageEditorShell.tsx")
    const pager = read("apps/cms/src/components/editor/iframe/useEditorMobilePager.ts")
    const pageForm = read("apps/cms/src/components/forms/PageForm.tsx")
    const pageEditorCore = read("apps/cms/src/components/editor/usePageEditorCore.ts")

    expect(shell).toContain("export function MobilePageEditorShell")
    expect(shell).toContain("data-siab-editor-pager")
    expect(shell).toContain("data-mobile-page-editor-bar")
    expect(shell).toContain('scrollToPane("preview")')
    expect(pager).toContain('const PANES: EditorMobilePane[] = ["agent", "preview", "inspector"]')
    expect(pager).toContain('initialPane: EditorMobilePane = "preview"')

    expect(pageForm).toContain('import { MobilePageEditorShell } from "@/components/editor/iframe/MobilePageEditorShell"')
    expect(pageForm).toContain("<MobilePageEditorShell")
    expect(pageForm).toContain("preview={pageEditorFrame}")
    expect(pageForm).toContain("<CmsAgentPanel")
    expect(pageForm).toContain("<SidebarDrillDown")
    expect(pageForm).not.toContain("mobileFocusedSectionIndex")
    expect(pageForm).not.toContain("frameMobileMode")
    expect(pageForm).not.toContain("showGutters")
    expect(pageForm).not.toContain("allowInlineEditing")
    expect(pageForm).not.toContain("onOpenBlockInspector")
    expect(pageForm).not.toContain("frameMutations")
    expect(pageForm).toContain("<MobileMediaSheetProvider>")
    expect(pageEditorCore).not.toContain("focusedBlockIndex: mobileFocusedSectionIndex")
    expect(pageEditorCore).not.toContain("showChrome: false as const")
    expect(pageForm).not.toContain("CanvasBlockRenderer")
  })

  it("keeps nonce-bearing vaul snap css on leftover mobile field inspector primitives", () => {
    const sharedCss = read("apps/cms/src/components/editor/mobile/vaulBottomSnapCss.ts")
    const inspector = read("apps/cms/src/components/editor/mobile/mobile-inspector-bar.tsx")

    expect(sharedCss).toContain("export const VAUL_BOTTOM_SNAP_CSS")
    expect(sharedCss).toContain("[data-vaul-handle]")
    expect(inspector).toContain('from "@/components/editor/mobile/vaulBottomSnapCss"')
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
    const context = read("apps/cms/src/components/editor/mobile/MobileEditorContext.tsx")

    expect(context).toContain("function sameElementPath")
    expect(context).toContain("if (sameElementPath(state.selected, p)) return state")
    expect(context).toContain("state.selected == null")
    expect(context).toContain("return state")
    expect(context).toContain("React.useCallback((path: ElementPath) => dispatch({ type: \"SET_SELECTED\", path }), [])")
    expect(context).toContain("React.useCallback(() => dispatch({ type: \"CLEAR_SELECTION\" }), [])")
  })
})
