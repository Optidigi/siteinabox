import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

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
