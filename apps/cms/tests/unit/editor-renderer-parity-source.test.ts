import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")
const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8")

describe("page editor renderer parity", () => {
  it("renders the exact shared page renderer without an alternate canvas tree", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    expect(runtime).toContain("<ClientSitePageRenderer")
    expect(runtime).toContain("includeBehaviorScripts={false}")
    expect(runtime).not.toContain("FrameCanvasSurface")
    expect(runtime).not.toContain("tenantCss")
    expect(runtime).not.toContain("manifest")
  })

  it("loads only public renderer CSS in the isolated editor document", () => {
    const layout = read("src/app/(editor-frame)/layout.tsx")
    expect(layout).toContain('import "@/styles/generated-site-renderer.css"')
    expect(layout).not.toContain("ThemeProvider")
    expect(layout).not.toContain("site-renderer-canvas")
    expect(layout).not.toContain("editor-frame-ui")
  })

  it("keeps editing in the parent sidebar and the iframe transport read-only", () => {
    const form = read("src/components/forms/PageForm.tsx")
    const host = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    expect(form).toContain("<SidebarDrillDown")
    expect(form).not.toContain("CanvasSelectionProvider")
    expect(form).not.toContain("<ModeBar")
    expect(form).not.toContain("frameMutations")
    expect(host).not.toContain("onBlocksInsert")
    expect(host).not.toContain("onFieldCommit")
    expect(host).not.toContain("MutationObserver")
    expect(host).not.toContain("ResizeObserver")
  })

  it("reveals the iframe only after renderer, load, fonts, and layout are ready", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    const host = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    expect(runtime).toContain("waitForWindowLoad")
    expect(runtime).toContain("document.fonts?.ready")
    expect(runtime).toContain("await waitForAnimationFrame()\n      await waitForAnimationFrame()")
    expect(host).toContain('ready ? "opacity-100" : "pointer-events-none opacity-0"')
    expect(host).toContain("animate-pulse")
  })

  it("waits for breakpoint resolution before mounting mobile or desktop editor chrome", () => {
    const core = read("src/components/editor/usePageEditorCore.ts")
    const form = read("src/components/forms/PageForm.tsx")
    expect(core).toContain("useState<boolean | null>(null)")
    expect(core).toContain("isDesktop: boolean | null")
    expect(core).toContain("if (isDesktop !== false || mobileFocusedSectionIndex == null) return undefined")
    expect(form).toContain("data-siab-editor-breakpoint-skeleton")
    expect(form).toContain("isDesktop === null && !readOnly")
    expect(form).toContain("isDesktop === false && !readOnly")
    expect(form).toContain("(isDesktop || readOnly) && isDesktop !== null")
  })

  it("resyncs iframe snapshot revision on ready and rejects only stale revisions", () => {
    const host = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const preview = read("src/components/preview/PreviewCustomizer.tsx")
    const contract = readRepo("packages/contracts/src/iframe-editor.ts")
    expect(host).toContain("if (!readyRef.current)")
    expect(host).toContain("revisionRef.current = 0")
    expect(preview).toContain("if (!readyRef.current)")
    expect(preview).toContain("revisionRef.current = 0")
    expect(contract).toContain("parsed.data.expectedRevision < options.currentRevision")
  })

  it("uses the CMS document as the sole full-page scroll owner", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    const host = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    expect(runtime).toContain('type: "renderer.height"')
    expect(runtime).toContain("new ResizeObserver(reportHeight)")
    expect(runtime).toContain('data-siab-editor-parent-scroll="true"')
    expect(host).toContain('message.type === "renderer.height"')
    expect(host).toContain('scrolling="no"')
    expect(host).not.toContain('h-[calc(100dvh-6.5rem)]')
  })

  it("does not retain the removed canvas implementation or preference", () => {
    for (const path of [
      "src/components/editor/canvas/CanvasSurface.tsx",
      "src/components/editor/canvas/CanvasBlockRenderer.tsx",
      "src/components/editor-frame/FrameCanvasSurface.tsx",
      "src/components/editor-frame/useFrameCanvasBlocks.ts",
      "src/components/editor/mode/mode-bar.tsx",
      "src/lib/actions/setUserEditorMode.ts",
      "src/styles/site-renderer-canvas.css",
    ]) expect(existsSync(path), path).toBe(false)
  })
})
