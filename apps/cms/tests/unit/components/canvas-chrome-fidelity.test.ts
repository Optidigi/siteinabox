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
    const siteChrome = read("src/components/editor/canvas/SiteChromePreview.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const siteHeader = read("src/components/layout/SiteHeader.tsx")

    expect(canvasMode).toContain('import { createPortal } from "react-dom"')
    expect(canvasMode).toContain('import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"')
    expect(canvasMode).toContain('import { CanvasChromeVisibilityProvider } from "@/components/editor/canvas/CanvasChromeVisibilityContext"')
    expect(canvasMode).toContain('data-siab-canvas-chrome="insert-gap"')
    expect(canvasMode).toContain("pointer-events-none fixed z-[19]")
    expect(canvasMode).toContain("pointer-events-auto relative z-10")
    expect(gutterOverlay).toContain('dataChrome = "block-gutter"')
    expect(gutterOverlay).toContain("data-siab-canvas-chrome={dataChrome}")
    expect(gutterOverlay).toContain("[data-siab-cms-sticky-chrome]")
    expect(pageForm).toContain("data-siab-cms-sticky-chrome")
    expect(siteHeader).toContain("data-siab-cms-sticky-chrome")
    expect(inlineImage).toContain('data-siab-canvas-chrome="inline-image"')
    expect(inlineImage).toContain("useCanvasChromeVisibility")
    expect(canvasMode).toContain("document.body")
    expect(gutterOverlay).toContain("document.body")
    expect(inlineImage).toContain("document.body")
    expect(canvasMode).toContain("${overlayPosition.className} pointer-events-none fixed z-[19]")
    expect(gutterOverlay).toContain("${position.className} fixed z-[19]")
    expect(inlineImage).toContain("${overlayPosition.className} fixed z-[19]")
    expect(read("../../packages/site-renderer/src/canvas.css")).toContain('.rt-canvas[data-rt-view] [data-amicare-nav]')
    expect(read("../../packages/site-renderer/src/canvas.css")).toContain("z-index: 0;")
    expect(read("../../packages/site-renderer/src/canvas.css")).not.toContain(".site-renderer[data-siab-site-renderer] .rt-canvas :is([data-site-chrome], [data-amicare-nav], .site-frame-root > nav, .site-frame-root > footer)")
    expect(canvasMode).not.toContain("${overlayPosition.className} fixed z-40")
    expect(gutterOverlay).not.toContain("${position.className} fixed z-40")
    expect(inlineImage).not.toContain("${overlayPosition.className} fixed z-40")
    expect(canvasMode).not.toContain("${overlayPosition.className} pointer-events-none fixed z-[20]")
    expect(gutterOverlay).not.toContain("${position.className} fixed z-[20]")
    expect(inlineImage).not.toContain("${overlayPosition.className} fixed z-[20]")
    expect(siteChrome).toContain("overlayTargetSelector={siteChromeTargetSelector(zone)}")
    expect(siteChrome).toContain("document.querySelectorAll<HTMLElement>(overlayTargetSelector)")
    expect(siteChrome).toContain("target.addEventListener(\"click\", onClick)")
    expect(siteChrome).toContain("<CanvasChromeGutterOverlay")
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

  it("keeps one block gutter active and clears it on section leave", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")

    expect(canvasMode).toContain("const [activeBlockGutterIndex, setActiveBlockGutterIndex] = React.useState<number | null>(null)")
    expect(canvasMode).toContain("const setBlockGutterVisible = React.useCallback((index: number, next: boolean) => {")
    expect(canvasMode).toContain("setActiveBlockGutterIndex(index)")
    expect(canvasMode).toContain("setActiveBlockGutterIndex((current) => current === index ? null : current)")
    expect(canvasMode).toContain("gutterVisible={activeBlockGutterIndex === index}")
    expect(canvasMode).toContain("gutterVisible={activeBlockGutterIndex === i}")
    expect(canvasMode).not.toContain("blockGutterHideTimerRef")
    expect(canvasMode).not.toContain("window.setTimeout")
    expect(canvasMode).not.toContain("const [gutterVisible, setGutterVisible] = React.useState(false)")
    expect(gutterOverlay).toContain("type AnchorRect = Pick<DOMRect, \"bottom\" | \"left\" | \"right\" | \"top\" | \"width\">")
    expect(gutterOverlay).toContain('const hiddenAfterAnchorScrolledAway = rect ? dataChrome !== "site-chrome-gutter" && rect.bottom < cmsChromeBottom : false')
  })

  it("keeps Amicare canvas block breakpoints aligned to the live site renderer", () => {
    const hero = read("src/components/editor/canvas/blocks/Hero.tsx")
    const richText = read("src/components/editor/canvas/blocks/RichText.tsx")

    expect(hero).toContain("@min-[48rem]/site-frame:flex-row")
    expect(hero).toContain("@min-[64rem]/site-frame:px-24")
    expect(hero).toContain("@min-[48rem]/site-frame:rotate-3")
    expect(hero).not.toContain("@min-[816px]/site-frame")
    expect(hero).not.toContain("@min-[1088px]/site-frame")

    expect(richText).toContain("@min-[48rem]/site-frame:py-24")
    expect(richText).toContain("@min-[64rem]/site-frame:px-24")
    expect(richText).not.toContain("@min-[816px]/site-frame")
    expect(richText).not.toContain("@min-[1088px]/site-frame")
  })

  it("keeps CTA edit affordance classes layout-neutral", () => {
    const inlineCta = read("src/components/editor/canvas/inline/InlineCtaButton.tsx")
    const canvasCss = read("../../packages/site-renderer/src/canvas.css")

    expect(inlineCta).toContain('[className, "rt-click-edit"].filter(Boolean).join(" ")')
    expect(inlineCta).not.toContain('"rt-click-edit rounded-[var(--radius-md)] [font-family:var(--font-text)]"')
    expect(inlineCta).not.toContain('"rt-click-edit cursor-pointer rounded-[var(--radius-md)] [font-family:var(--font-text)]"')
    expect(canvasCss).toContain('.site-renderer[data-siab-site-renderer][data-legacy-tenant="amicare"] .rt-canvas .amicare-button-primary.rt-click-edit')
    expect(canvasCss).toContain("width: auto;")
    expect(canvasCss).not.toContain("display: flex;\n  flex-direction: column;\n  gap: 1.75rem;")
  })

  it("keeps Amicare hero card and footer utility styles aligned with the live renderer", () => {
    const canvasCss = read("../../packages/site-renderer/src/canvas.css")

    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-4"]')
    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-5"]')
    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-6"]')
    expect(canvasCss).toContain(":where(.text-\\[12px\\])")
    expect(canvasCss).toContain(":where(.text-\\[14px\\])")
    expect(canvasCss).toContain(".cms-block--hero > div:nth-of-type(3) > p")
    expect(canvasCss).not.toContain(".cms-block--hero p {\n  max-width: 28rem;")
    expect(canvasCss).not.toContain(".cms-block--hero p {\n    font-size: 1.125rem;")
  })
})
