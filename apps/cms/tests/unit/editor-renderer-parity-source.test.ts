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
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    expect(form).toContain("<SidebarDrillDown")
    expect(form).not.toContain("CanvasSelectionProvider")
    expect(form).not.toContain("<ModeBar")
    expect(form).not.toContain("frameMutations")
    expect(host).not.toContain("onBlocksInsert")
    expect(host).not.toContain("onFieldCommit")
    expect(host).not.toContain("MutationObserver")
    expect(host).not.toContain("ResizeObserver")
    // Field deep-link uses select-only editSlots markers — no canvas commit path.
    expect(runtime).toContain("editSlots={selectSlots}")
    expect(runtime).toContain("createEditorSelectSlots")
    expect(runtime).not.toContain("onFieldCommit")
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
    const editorRuntime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    const rendererRuntime = read("src/components/renderer-frame/RendererFrameRuntime.tsx")
    expect(host).toContain("if (!readyRef.current)")
    expect(host).toContain("revisionRef.current = 0")
    expect(preview).toContain("if (!readyRef.current)")
    expect(preview).toContain("revisionRef.current = 0")
    expect(contract).toContain("parsed.data.expectedRevision < options.currentRevision")
    expect(editorRuntime).toContain("ThemeTokenSpecSchema.nullable().safeParse")
    expect(editorRuntime).toContain("PageSchema.safeParse")
    expect(editorRuntime).toContain("SiteSettingsSchema.safeParse")
    expect(rendererRuntime).toContain("ThemeTokenSpecSchema.nullable().safeParse")
    expect(rendererRuntime).toContain("PageSchema.safeParse")
    expect(rendererRuntime).toContain("SiteSettingsSchema.safeParse")
    expect(editorRuntime).toContain("applyThemeAttributes(document, frameTheme)")
    expect(rendererRuntime).toContain("applyThemeAttributes(document, frameTheme)")
  })

  it("scrolls canvas only for parent/inspector selection, not local canvas clicks", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    expect(runtime).toContain('selectionOriginRef = React.useRef<"local" | "parent">("parent")')
    expect(runtime).toContain('selectionOriginRef.current = "local"')
    expect(runtime).toContain('selectionOriginRef.current = "parent"')
    expect(runtime).toContain('const shouldScroll = !skipScroll && selectionOriginRef.current === "parent"')
    expect(runtime).toContain("if (shouldScroll) blockNode.scrollIntoView")
  })

  it("normalizes canvas wire page/settings before live snapshots", () => {
    const form = read("src/components/forms/PageForm.tsx")
    const core = read("src/components/editor/usePageEditorCore.ts")
    const framePage = read("src/app/(editor-frame)/editor-frame/pages/[id]/page.tsx")
    const wire = read("src/lib/projection/ensureCanvasWire.ts")
    expect(wire).toContain("export function ensureCanvasWireSettings")
    expect(wire).toContain("export function ensureCanvasWirePage")
    expect(wire).toContain("language.trim()")
    expect(wire).toContain('"nl"')
    expect(form).toContain("ensureCanvasWirePage(pageToJson(")
    expect(core).toContain("ensureCanvasWireSettings(stripCanvasConsent(projected)")
    expect(framePage).toContain("ensureCanvasWireSettings(stripCanvasConsent(")
  })

  it("uses parent scroll with renderer.height sync without cookie chrome", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    const host = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const form = read("src/components/forms/PageForm.tsx")
    const css = read("src/styles/generated-site-renderer.css")
    const siabCss = read("src/styles/siab.css")
    const framePage = read("src/app/(editor-frame)/editor-frame/pages/[id]/page.tsx")
    expect(runtime).toContain('type: "renderer.height"')
    expect(runtime).toContain("new ResizeObserver(reportHeight)")
    expect(runtime).toContain('data-siab-preview-viewport="true"')
    expect(runtime).toContain('data-siab-editor-parent-scroll={parentScroll ? "true" : undefined}')
    expect(runtime).toContain("if (!parentScroll || !readyForVariant) return")
    expect(runtime).not.toContain("isViewportFixedConsentBanner")
    expect(runtime).not.toContain("suppressInFrameConsentBanner")
    expect(runtime).toContain("renderer-frame-preview-viewport")
    expect(host).toContain('message.type === "renderer.height"')
    expect(host).toContain('scrolling={isDesktopLayout ? "no" : undefined}')
    expect(host).toContain('data-siab-editor-parent-scroll={isDesktopLayout ? "true" : undefined}')
    expect(host).toContain('if (layout === "desktop") query.set("parentScroll", "true")')
    expect(host).not.toContain("EditorConsentBannerOverlay")
    expect(host).toContain("h-full min-h-0 overflow-hidden")
    expect(host).not.toContain("min-h-[32rem]")
    expect(host).not.toContain("min-h-[640px]")
    expect(framePage).toContain("parentScroll={parentScroll}")
    expect(framePage).toContain("stripCanvasConsent")
    expect(form).toContain("flex min-w-0 flex-1 pb-24")
    expect(form).toContain('sticky top-[calc(6.5rem+0.5rem)] h-[calc(100dvh-6.5rem)]')
    expect(form).not.toContain('zone="banner"')
    expect(runtime).toContain("hostWindow.innerHeight")
    expect(runtime).not.toContain("const next = window.innerHeight")
    const mobileFrame = read("src/components/editor/iframe/MobileFrameEditor.tsx")
    expect(mobileFrame).toContain("relative flex min-h-0 flex-1 flex-col overflow-hidden")
    expect(css).toContain("data-siab-editor-parent-scroll")
    expect(css).toContain(':not([data-siab-editor-frame-runtime]) [data-siab-cookie-consent="true"]')
    expect(css).toContain('[data-siab-cookie-consent="true"]')
    expect(css).toContain("bottom: max(1rem, env(safe-area-inset-bottom))")
    expect(css).not.toContain("position: absolute")
    expect(css).toContain("--siab-ed-ink")
    expect(css).toContain('data-siab-editor-hover="field"')
    expect(css).toContain("outline-offset: 2px")
    expect(css).not.toContain("box-shadow: inset 0 0 0 2px var(--siab-ed-ink)")
    expect(css).not.toContain("var(--color-accent")
    expect(siabCss).not.toContain("[data-siab-editor-consent-overlay]")
    expect(siabCss).not.toContain("box-shadow: inset 3px 0 0 0 var(--siab-ed-ink)")
    expect(siabCss).toContain("[data-siab-inspector-field]:hover")
    expect(host).toContain("PAGE_SNAPSHOT_DEBOUNCE_MS")
    expect(runtime).toContain("lastPaintedRef")
    expect(runtime).toContain("data-siab-editor-hover")
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
