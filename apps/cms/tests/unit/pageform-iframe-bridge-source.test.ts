import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("page editor iframe bridge source contract", () => {
  it("defines PageEditorFrameHost as the iframe bridge to the editor-frame runtime", () => {
    const host = read("apps/cms/src/components/editor/iframe/PageEditorFrameHost.tsx")

    expect(host).not.toContain("isIframePageEditorEnabled")
    expect(host).not.toContain("NEXT_PUBLIC_IFRAME_PAGE_EDITOR")
    expect(host).toContain("export function PageEditorFrameHost")
    expect(host).toContain("export type PageEditorFrameLayout")
    expect(host).toContain("/editor-frame/pages/")
    expect(host).toContain("tenantSlug")
    expect(host).toContain("URLSearchParams")
    expect(host).toContain("@siteinabox/contracts/iframe-editor")
    expect(host).toContain("validateIframeEditorMessage")
    expect(host).toContain('type === "renderer.ready"')
    expect(host).toContain('type === "selection.changed"')
    expect(host).toContain('type === "error"')
    expect(host).toContain('type: "page.replace"')
    expect(host).toContain('type: "theme.patch"')
    expect(host).toContain("theme,")
    expect(host).toContain("--siab-parent-chrome-bottom")
    expect(host).toContain("expectedRevision")
    expect(host).toMatch(/<iframe\b/i)
    expect(host).not.toContain('sandbox="allow-same-origin allow-scripts allow-forms"')
    expect(host).toContain("selection.set")
    expect(host).toContain("onSelectionChanged")
    expect(host).toContain("onChromeSelect")
    expect(host).toContain("onOpenBlockInspector")
    expect(host).toContain('message.type === "chrome.select"')
    expect(host).toContain("message.point")
    expect(host).toContain("rect.left + message.point.x")
    expect(host).toContain("rect.top + message.point.y")
    expect(host).toContain('message.type === "edit.start" && message.mode === "settings"')
    expect(host).toContain("findBlockIndexByWireId")
    expect(host).toContain("Retry frame")
    expect(host).toContain("setRetryKey")
    expect(host).toContain("data-siab-editor-frame-layout")
    expect(host).toContain("measureFrameDocumentHeight")
    expect(host).toContain("measureEditorFrameViewportHeight")
    expect(host).toContain("writeFrameViewportHeight")
    expect(host).toContain("--siab-editor-frame-viewport-height")
    expect(host).toContain("DESKTOP_CANVAS_VIEWPORT_OFFSET")
    expect(host).toContain("MOBILE_CANVAS_VIEWPORT_OFFSET")
    expect(host).toContain("editor-frame-auto-height")
    expect(host).toContain('const shouldAutoSizeFrame = view === "canvas"')
    expect(host).toContain("ResizeObserver")
    expect(host).toContain("MutationObserver")
    expect(host).toContain("body.children")
    expect(host).toContain("getBoundingClientRect")
    expect(host).not.toContain("clientHeight")
    expect(host).toContain("frameDocument.body")
    expect(host).toContain('view === "sidebar" && "h-[calc(100dvh-6.5rem)]"')
    expect(host).not.toContain('h-[calc(100dvh-9rem)]')
    expect(host).toContain("const pageRef = React.useRef(page)")
    expect(host).toContain("pageRef.current = page")
    expect(host).toContain("findBlockIndexByWireId(pageRef.current.blocks ?? [], message.blockId)")
    expect(host).toMatch(/const postToFrame = React\.useCallback\([\s\S]*?\}, \[\]\)/)
  })

  it("wires PageForm to render PageEditorFrameHost for desktop and mobile without CanvasMode fallback", () => {
    const form = read("apps/cms/src/components/forms/PageForm.tsx")

    expect(form).toContain(
      'import { PageEditorFrameHost, type PageEditorFrameView } from "@/components/editor/iframe/PageEditorFrameHost"',
    )
    expect(form).not.toContain('import { CanvasMode }')
    expect(form).not.toContain("isIframePageEditorEnabled")
    expect(form).not.toContain("NEXT_PUBLIC_IFRAME_PAGE_EDITOR")
    expect(form).not.toContain("<CanvasMode")
    expect(form).toContain("const canRenderEditorFrame = frameSettings != null")
    expect(form).toContain("const frameEditorLayout = isDesktop ? \"desktop\" : \"mobile\"")
    expect(form).toContain("const frameEditorView: PageEditorFrameView = readOnly ? \"sidebar\" : isDesktop ? mode : \"canvas\"")
    expect(form).toContain("const pageEditorFrame = canRenderEditorFrame ? (")
    expect(form).toContain("EditorFrameDocumentContext")
    expect(form).toContain("onFrameDocument={setEditorFrameDocument}")
    expect(form).toContain("layout={frameEditorLayout}")
    expect(form).toContain("view={frameEditorView}")

    const pageEditorFrameHostOccurrences = form.match(/<PageEditorFrameHost\b/g) ?? []
    expect(pageEditorFrameHostOccurrences.length).toBe(1)

    const canvasViewIndex = form.indexOf('mode === "canvas"')
    const sidebarViewIndex = form.indexOf('mode === "sidebar"')
    expect(canvasViewIndex).toBeGreaterThan(-1)
    expect(sidebarViewIndex).toBeGreaterThan(-1)

    expect(form).toContain("{pageEditorFrame}")
    expect(form).toContain("<SidebarDrillDown")
    expect(form).toContain("selection={frameSelection}")
    expect(form).toContain("frameSelection")
    expect(form).toContain("<BlockPresetsProvider")
    expect(form).toContain("<MobileMediaSheetProvider>")
    expect(form).toContain("<MobileSavePill")

    expect(form).toContain("handleFrameChromeSelect")
    expect(form).toContain("selectChrome({ zone }, point)")
    expect(form).toContain("const handleFrameChromeGeometry = useCallback(")
    expect(form).toContain("quick-menu")
    expect(form).toContain('`chrome.select`')
    expect(form).not.toContain("rect.x + rect.width / 2")
    const onChromeSelectOccurrences = form.match(/onChromeSelect=\{handleFrameChromeSelect\}/g) ?? []
    expect(onChromeSelectOccurrences.length).toBe(1)
    const inspectorOccurrences = form.match(/onOpenBlockInspector=\{openBlockInSidebar\}/g) ?? []
    expect(inspectorOccurrences.length).toBe(1)

    expect(form).toContain('import { MobileFrameEditor } from "@/components/editor/iframe/MobileFrameEditor"')
    expect(form).toContain("mobileFocusedSectionIndex")
    expect(form).toContain("frameMobileMode")
    expect(form).toContain('mode: "focusedSection"')
    expect(form).toContain("allowInlineEditing: false")
    expect(form).toContain("<MobileFrameEditor")
    expect(form).not.toContain("MobileBlockInspectorSheet")
    expect(form).not.toContain("mobileBlockInspectorIndex")
  })

  it("wires EditorFrameRuntime to hand canvas/sidebar editing off to FrameCanvasSurface once the view is known", () => {
    const runtime = read("apps/cms/src/components/editor-frame/EditorFrameRuntime.tsx")

    expect(runtime).toContain("manifest: RtManifest")
    expect(runtime).toContain("resolveTenantRenderer")
    expect(runtime).toContain("effectiveTenantCss")

    expect(runtime).toContain("const emitReady = () =>")
    expect(runtime).toContain("receivedParentCommandRef.current = true")
    expect(runtime).toContain("window.setInterval")
    expect(runtime).toContain("window.clearInterval")

    expect(runtime).toContain('message.type === "editor.view.set"')
    expect(runtime).toContain("setFrameView(message.view)")
    expect(runtime).toContain('message.type === "editor.mobileMode.set"')
    expect(runtime).toContain("setMobileMode")
    expect(runtime).toContain('import { FrameCanvasSurface } from "@/components/editor-frame/FrameCanvasSurface"')
    expect(runtime).toContain("if (frameView) {")
    expect(runtime).toContain("<FrameCanvasSurface")
    expect(runtime).toContain("<SitePageRenderer")

    expect(runtime).toContain("[data-amicare-nav]")

    expect(runtime).toContain('type: "chrome.select"')
    expect(runtime).toContain("point: { x: event.clientX, y: event.clientY }")
    expect(runtime).toContain('type: "geometry.changed"')
    expect(runtime).toContain("blockId: `chrome:${zone}`")

    expect(runtime).toContain('revisioned.type === "theme.patch"')
    expect(runtime).toContain('revisioned.expectedRevision < revisionRef.current')
    expect(runtime).toContain('if ("theme" in revisioned) setFrameTheme')
    expect(runtime).toContain("if (frameView) return")
  })

  it("keeps the iframe canvas surface transport-neutral while forwarding chrome and inspector actions", () => {
    const surface = read("apps/cms/src/components/editor-frame/FrameCanvasSurface.tsx")

    expect(surface).toContain('import { CanvasSurface } from "@/components/editor/canvas/CanvasSurface"')
    expect(surface).toContain("useFrameCanvasBlocks")
    expect(surface).toContain("SiteChromeActionFrame")
    expect(surface).toContain("type SiteChromeSelectPoint")
    expect(surface).toContain('type: "edit.start"')
    expect(surface).toContain('mode: "settings"')
    expect(surface).toContain("point?: SiteChromeSelectPoint")
    expect(surface).toContain("point,")
    expect(surface).toContain("onOpenBlockInspector={requestBlockInspector}")
    expect(surface).toContain("renderHeaderChrome={renderHeaderChrome}")
    expect(surface).toContain("renderFooterChrome={renderFooterChrome}")
    expect(surface).toContain("mobileMode?: IframeEditorMobileMode")
    expect(surface).toContain("allowInlineEditing={mobileMode.allowInlineEditing}")
    expect(surface).toContain("focusedBlockIndex={mobileMode.mode === \"focusedSection\" ? mobileMode.focusedBlockIndex : undefined}")
  })
})
