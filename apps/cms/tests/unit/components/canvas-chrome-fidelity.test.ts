import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("canvas chrome fidelity", () => {
  it("hosts desktop canvas chrome app-side instead of hand-editing registry primitives", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")

    expect(pageForm).toContain('import { CanvasMode } from "@/components/editor/canvas/CanvasMode"')
    expect(pageForm).not.toContain('import { CanvasMode } from "@siteinabox/ui/components/canvas-mode"')
    expect(canvasMode).toContain('import { CanvasBlockRenderer } from "@/components/editor/canvas/CanvasBlockRenderer"')
    expect(canvasMode).toContain('import { CanvasMobile } from "@/components/editor/canvas/mobile/CanvasMobile"')
  })

  it("uses the editor-specific laptop breakpoint before showing desktop canvas", () => {
    const constants = read("src/lib/editor/constants.ts")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const runbook = read("docs/runbooks/canvas-architecture.md")

    expect(constants).toContain("export const EDITOR_DESKTOP_BREAKPOINT = 1280")
    expect(pageForm).toContain("EDITOR_DESKTOP_BREAKPOINT")
    expect(pageForm).toContain("window.matchMedia(`(min-width: ${EDITOR_DESKTOP_BREAKPOINT}px)`)")
    expect(pageForm).toContain("const pageEditorStyleCache = new Map")
    expect(pageForm).toContain("const cachedStyle = pageEditorStyleCache.get(tenantStyleCacheKey)")
    expect(pageForm).toContain("tenantCss ?? cachedStyle?.tenantCss ?? null")
    expect(pageForm).toContain("pageEditorStyleCache.set(tenantStyleCacheKey")
    expect(pageForm).toContain("if (tenantCss != null) setStableTenantCss(tenantCss)")
    expect(pageForm).toContain("tenantCss={stableTenantCss}")
    expect(canvasMode).toContain("useIsMobile(EDITOR_DESKTOP_BREAKPOINT)")
    expect(canvasMode).toContain("[&_[data-mobile-back-pill]]:!inline-flex")
    expect(canvasMode).toContain("[&_[data-mobile-trash-pill]]:!inline-flex")
    expect(pageForm).toContain("[&_[data-mobile-save-pill]]:!inline-flex")
    expect(runbook).toContain("## Mobile (<1280px)")
  })

  it("keeps insert affordance anchors layout-neutral inside the tenant canvas", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")

    expect(canvasMode).toContain("const CanvasGapOverlay")
    expect(canvasMode).toContain('className="relative h-0"')
    expect(canvasMode).toContain("data-siab-canvas-gap-anchor")
    expect(canvasMode).not.toContain("group/gap relative flex h-6")
  })

  it("uses a canvas-specific rounded picker instead of the registry picker tile hover", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")

    expect(canvasMode).toContain("const CanvasBlockPickerDialog")
    expect(canvasMode).toContain("const CanvasPresetRow")
    expect(canvasMode).not.toContain('import { BlockTypePicker }')
    expect(canvasMode).toContain("hover:bg-accent/40")
    expect(canvasMode).toContain("rounded-md p-3")
    expect(canvasMode).toContain("mt-2 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1")
    expect(canvasMode).not.toContain("sm:grid-cols-2")
  })

  it("portals editor-owned canvas controls outside tenant-scoped .rt-canvas styling", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")

    expect(canvasMode).toContain('import { createPortal } from "react-dom"')
    expect(canvasMode).toContain('import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"')
    expect(canvasMode).toContain('import { CanvasChromeVisibilityProvider } from "@/components/editor/canvas/CanvasChromeVisibilityContext"')
    expect(canvasMode).toContain('data-siab-canvas-chrome="insert-gap"')
    expect(gutterOverlay).toContain('dataChrome = "block-gutter"')
    expect(gutterOverlay).toContain("data-siab-canvas-chrome={dataChrome}")
    expect(inlineImage).toContain('data-siab-canvas-chrome="inline-image"')
    expect(inlineImage).toContain("useCanvasChromeVisibility")
    expect(canvasMode).toContain("document.body")
    expect(gutterOverlay).toContain("document.body")
    expect(inlineImage).toContain("document.body")
  })

  it("shares block hover visibility with nested image canvas chrome", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")

    expect(canvasMode).toContain("<CanvasChromeVisibilityProvider value={{ visible: gutterVisible, setVisible: setGutterVisible }}>")
    expect(inlineImage).toContain("const canvasChrome = useCanvasChromeVisibility()")
    expect(inlineImage).toContain('const showHoverOverlayChrome = showOverlayChrome && view !== "mobile" && canvasChrome.visible')
    expect(inlineImage).toContain("onMouseEnter={() => canvasChrome.setVisible(true)}")
    expect(inlineImage).toContain("onMouseLeave={() => canvasChrome.setVisible(false)}")
  })
})
