import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("canvas chrome fidelity", () => {
  it("keeps legacy desktop canvas chrome app-side while customer preview targets the renderer iframe host", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const frameHost = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const previewCustomizer = read("src/components/preview/PreviewCustomizer.tsx")

    expect(previewCustomizer).toContain("data-siab-renderer-frame")
    expect(previewCustomizer).toContain("/renderer-frame/preview/")
    expect(pageForm).toContain('import { PageEditorFrameHost')
    expect(pageForm).not.toContain('import { CanvasMode }')
    expect(pageForm).not.toContain('import { CanvasMode } from "@siteinabox/ui/components/canvas-mode"')
    expect(canvasSurface).toContain('import { CanvasBlockRenderer, type CanvasSectionChromeProps } from "@/components/editor/canvas/CanvasBlockRenderer"')
    expect(frameHost).toContain("data-siab-editor-frame-layout")
  })

  it("uses the editor-specific laptop breakpoint before showing desktop chrome", () => {
    const constants = read("src/lib/editor/constants.ts")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const frameHost = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const runbook = read("docs/runbooks/canvas-architecture.md")

    expect(constants).toContain("export const EDITOR_DESKTOP_BREAKPOINT = 1280")
    expect(pageForm).toContain("EDITOR_DESKTOP_BREAKPOINT")
    expect(pageForm).toContain("window.matchMedia(`(min-width: ${EDITOR_DESKTOP_BREAKPOINT}px)`)")
    expect(pageForm).toContain("const pageEditorStyleCache = new Map")
    expect(pageForm).toContain("const cachedStyle = pageEditorStyleCache.get(tenantStyleCacheKey)")
    expect(pageForm).toContain("tenantCss ?? cachedStyle?.tenantCss ?? null")
    expect(pageForm).toContain("pageEditorStyleCache.set(tenantStyleCacheKey")
    expect(pageForm).toContain("if (tenantCss != null) setStableTenantCss(tenantCss)")
    expect(frameHost).toContain('layout === "mobile"')
    expect(pageForm).toContain("[&_[data-mobile-save-pill]]:!inline-flex")
    expect(runbook).toContain("## Mobile (<1280px)")
    expect(runbook).toContain("data-siab-editor-frame-layout=\"mobile\"")
  })

  it("keeps insert affordance anchors layout-neutral inside the tenant canvas", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")

    expect(canvasSurface).toContain("const CanvasGapOverlay")
    expect(canvasSurface).toContain('className="relative h-0"')
    expect(canvasSurface).toContain('data-siab-canvas-chrome="insert-gap"')
    expect(canvasSurface).toContain("bg-transparent")
    expect(canvasSurface).not.toContain("group/gap relative flex h-6")
  })

  it("uses a canvas-specific rounded picker instead of the registry picker tile hover", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")

    expect(canvasSurface).toContain("const CanvasBlockPickerDialog")
    expect(canvasSurface).toContain("const CanvasPresetRow")
    expect(canvasSurface).not.toContain('import { BlockTypePicker }')
    expect(canvasSurface).toContain("hover:bg-accent/40")
    expect(canvasSurface).toContain("rounded-md p-3")
    expect(canvasSurface).toContain("mt-2 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1")
    expect(canvasSurface).not.toContain("sm:grid-cols-2")
  })

  it("portals editor-owned canvas controls outside tenant-scoped .rt-canvas styling", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")
    const siteChrome = read("src/components/editor/canvas/SiteChromePreview.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const siteHeader = read("src/components/layout/SiteHeader.tsx")

    expect(canvasSurface).toContain('import { createPortal } from "react-dom"')
    expect(canvasSurface).toContain('import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"')
    expect(canvasSurface).toContain('import { CanvasChromeVisibilityProvider } from "@/components/editor/canvas/CanvasChromeVisibilityContext"')
    expect(canvasSurface).toContain('data-siab-canvas-chrome="insert-gap"')
    expect(canvasSurface).toContain("data-siab-editor-ui")
    expect(canvasSurface).toContain("pointer-events-none fixed z-[19]")
    expect(canvasSurface).toContain("pointer-events-auto relative z-10")
    expect(gutterOverlay).toContain("data-siab-editor-ui")
    expect(gutterOverlay).toContain('dataChrome = "block-gutter"')
    expect(gutterOverlay).toContain("data-siab-canvas-chrome={dataChrome}")
    expect(gutterOverlay).toContain("[data-siab-cms-sticky-chrome]")
    expect(pageForm).toContain("data-siab-cms-sticky-chrome")
    expect(siteHeader).toContain("data-siab-cms-sticky-chrome")
    expect(inlineImage).toContain("data-siab-editor-ui")
    expect(inlineImage).toContain('data-siab-canvas-chrome="inline-image"')
    expect(inlineImage).toContain("useCanvasChromeVisibility")
    expect(canvasSurface).toContain("document.body")
    expect(gutterOverlay).toContain("document.body")
    expect(inlineImage).toContain("document.body")
    expect(canvasSurface).toContain("${overlayPosition.className} pointer-events-none fixed z-[19]")
    expect(gutterOverlay).toContain("${position.className} fixed z-[19]")
    expect(inlineImage).toContain("${overlayPosition.className} fixed z-[19]")
    expect(read("../../packages/site-renderer/src/canvas.css")).toContain('.rt-canvas[data-rt-view] [data-amicare-nav]')
    expect(read("../../packages/site-renderer/src/canvas.css")).toContain("z-index: 0;")
    expect(read("../../packages/site-renderer/src/canvas.css")).not.toContain(".site-renderer[data-siab-site-renderer] .rt-canvas :is([data-site-chrome], [data-amicare-nav], .site-frame-root > nav, .site-frame-root > footer)")
    expect(canvasSurface).not.toContain("${overlayPosition.className} fixed z-40")
    expect(gutterOverlay).not.toContain("${position.className} fixed z-40")
    expect(inlineImage).not.toContain("${overlayPosition.className} fixed z-40")
    expect(canvasSurface).not.toContain("${overlayPosition.className} pointer-events-none fixed z-[20]")
    expect(gutterOverlay).not.toContain("${position.className} fixed z-[20]")
    expect(inlineImage).not.toContain("${overlayPosition.className} fixed z-[20]")
    expect(siteChrome).toContain("overlayTargetSelector={siteChromeTargetSelector(zone)}")
    expect(siteChrome).toContain("document.querySelectorAll<HTMLElement>(overlayTargetSelector)")
    expect(siteChrome).toContain("target.addEventListener(\"click\", onClick)")
    expect(siteChrome).toContain("data-siab-editor-ui")
    expect(siteChrome).toContain("<CanvasChromeGutterOverlay")
  })

  it("marks independently portaled iframe editor chrome for CMS token isolation", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")
    const floatingToolbar = read("src/components/editor/richText/toolbar/floating-toolbar.tsx")
    const slashMenu = read("src/components/editor/richText/toolbar/slash-menu.tsx")
    const fontChip = read("src/components/editor/richText/toolbar/font-chip.tsx")
    const styleChip = read("src/components/editor/richText/toolbar/style-chip.tsx")
    const colorChip = read("src/components/editor/richText/toolbar/color-chip.tsx")
    const blockChip = read("src/components/editor/richText/toolbar/block-chip.tsx")
    const linkPopover = read("src/components/editor/richText/toolbar/link-popover.tsx")
    const themedNodeDialog = read("src/components/editor/richText/toolbar/themed-node-dialog.tsx")
    const iconPicker = read("src/components/editor/icon-picker.tsx")
    const mediaPicker = read("src/components/media/MediaPicker.tsx")
    const confirmDialog = read("src/components/confirm-dialog.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")
    const sidebar = read("src/components/editor/sidebar-drill-down.tsx")
    const mobileInspectorSheet = read("src/components/editor/iframe/MobileBlockInspectorSheet.tsx")
    const blockFormFields = read("src/components/editor/fields/block-form-fields.tsx")
    const arrayItemCard = read("src/components/editor/fields/array-item-card.tsx")
    const fieldRenderer = read("src/components/editor/FieldRenderer.tsx")
    const mobileComponentEditor = read("src/components/editor/canvas/mobile/mobile-component-editor.tsx")
    const mobileIconSheet = read("src/components/editor/canvas/mobile/mobile-icon-sheet.tsx")
    const mobileMediaSheet = read("src/components/editor/canvas/mobile/mobile-media-sheet.tsx")
    const mobileInspectorBar = read("src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")

    expect(canvasSurface).toContain('data-siab-canvas-chrome="block-picker-dialog"')
    expect(inlineImage).toContain('data-siab-canvas-chrome="inline-image-picker"')
    expect(floatingToolbar).toContain('data-siab-canvas-chrome="rich-text-toolbar"')
    expect(slashMenu).toContain('data-siab-canvas-chrome="rich-text-slash-menu"')
    expect(iconPicker).toContain('data-siab-canvas-chrome="icon-picker"')
    expect(mediaPicker).toContain('data-siab-canvas-chrome="media-picker"')
    expect(confirmDialog).toContain("data-siab-canvas-chrome={canvasChrome}")
    expect(gutterOverlay).toContain('data-siab-canvas-chrome={`${dataChrome}-menu`}')
    expect(sidebar).toContain('data-siab-canvas-chrome="sidebar-block-menu"')
    expect(mobileInspectorSheet).toContain('data-siab-canvas-chrome="mobile-block-inspector"')
    expect(blockFormFields).toContain('data-siab-canvas-chrome="block-field-select"')
    expect(arrayItemCard).toContain('data-siab-canvas-chrome="array-field-select"')
    expect(fieldRenderer).toContain('data-siab-canvas-chrome="rich-text-field-select"')
    expect(mobileComponentEditor).toContain('data-siab-canvas-chrome="mobile-field-select"')
    expect(mobileIconSheet).toContain('data-siab-canvas-chrome="mobile-icon-sheet"')
    expect(mobileMediaSheet).toContain('data-siab-canvas-chrome="mobile-media-sheet"')
    expect(mobileInspectorBar).toContain('data-siab-canvas-chrome="mobile-inspector-bar"')
    for (const source of [fontChip, styleChip, colorChip, blockChip]) {
      expect(source).toContain('data-siab-canvas-chrome="rich-text-popover"')
      expect(source).toContain("data-siab-editor-ui")
    }
    for (const source of [
      canvasSurface,
      inlineImage,
      floatingToolbar,
      slashMenu,
      linkPopover,
      themedNodeDialog,
      iconPicker,
      mediaPicker,
      confirmDialog,
      gutterOverlay,
      sidebar,
      mobileInspectorSheet,
      blockFormFields,
      arrayItemCard,
      fieldRenderer,
      mobileComponentEditor,
      mobileIconSheet,
      mobileMediaSheet,
      mobileInspectorBar,
    ]) {
      expect(source).toContain("data-siab-editor-ui")
    }
    expect(linkPopover).toContain('data-siab-canvas-chrome="rich-text-dialog"')
    expect(themedNodeDialog).toContain('data-siab-canvas-chrome="rich-text-dialog"')
  })

  it("uses stable renderer chrome markers before legacy structural fallbacks", () => {
    const runtime = read("src/components/editor-frame/EditorFrameRuntime.tsx")
    const genericChrome = read("../../packages/site-renderer/src/chrome.tsx")
    const amicareRenderer = read("../../packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx")

    expect(runtime).toContain('[data-site-chrome="header"]')
    expect(runtime).toContain('[data-site-chrome="footer"]')
    expect(runtime.indexOf('[data-site-chrome="header"]')).toBeLessThan(runtime.indexOf("[data-siab-site-header]"))
    expect(runtime.indexOf('[data-site-chrome="footer"]')).toBeLessThan(runtime.indexOf("[data-siab-site-footer]"))
    expect(genericChrome).toContain('data-site-chrome="header"')
    expect(genericChrome).toContain('data-site-chrome="footer"')
    expect(amicareRenderer).toContain('data-site-chrome="header"')
    expect(amicareRenderer).toContain('data-site-chrome="footer"')
  })

  it("shares block hover visibility with nested image canvas chrome", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const inlineImage = read("src/components/editor/canvas/inline/InlineImage.tsx")

    expect(canvasSurface).toContain("<CanvasChromeVisibilityProvider value={{ visible: gutterVisible, setVisible: setGutterVisible }}>")
    expect(inlineImage).toContain("const canvasChrome = useCanvasChromeVisibility()")
    expect(inlineImage).toContain('const showHoverOverlayChrome = !isCustomerPreview && showOverlayChrome && view !== "mobile" && canvasChrome.visible')
    expect(inlineImage).toContain("const surfaceIsEditable = !isCustomerPreview && (openOnImageClick || isReadOnly)")
    expect(inlineImage).toContain("onMouseEnter={() => canvasChrome.setVisible(true)}")
    expect(inlineImage).toContain("onMouseLeave={() => canvasChrome.setVisible(false)}")
  })

  it("keeps one block gutter active and clears it on section leave", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")

    expect(canvasSurface).toContain("const [activeBlockGutterIndex, setActiveBlockGutterIndex] = React.useState<number | null>(null)")
    expect(canvasSurface).toContain("const setBlockGutterVisible = React.useCallback((index: number, next: boolean) => {")
    expect(canvasSurface).toContain("setActiveBlockGutterIndex(index)")
    expect(canvasSurface).toContain("setActiveBlockGutterIndex((current) => current === index ? null : current)")
    expect(canvasSurface).toContain("gutterVisible={activeBlockGutterIndex === index}")
    expect(canvasSurface).toContain("gutterVisible={activeBlockGutterIndex === i}")
    expect(canvasSurface).not.toContain("blockGutterHideTimerRef")
    expect(canvasSurface).not.toContain("window.setTimeout")
    expect(canvasSurface).not.toContain("const [gutterVisible, setGutterVisible] = React.useState(false)")
    expect(gutterOverlay).toContain("type AnchorRect = Pick<DOMRect, \"bottom\" | \"left\" | \"right\" | \"top\" | \"width\">")
    expect(gutterOverlay).toContain('const hiddenAfterAnchorScrolledAway = rect ? dataChrome !== "site-chrome-gutter" && rect.bottom < cmsChromeBottom : false')
  })

  it("attaches shared-shell sortable chrome to editable block sections directly", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const blockRenderer = read("src/components/editor/canvas/CanvasBlockRenderer.tsx")
    const renderedItemStart = canvasSurface.indexOf("const SortableRenderedBlockItem")
    const renderedItemEnd = canvasSurface.indexOf("/**\n * Desktop canvas render surface", renderedItemStart)
    const renderedItem = canvasSurface.slice(renderedItemStart, renderedItemEnd)

    expect(blockRenderer).toContain("sectionChromeProps?: CanvasSectionChromeProps")
    expect(blockRenderer).toContain("export function mergeCanvasSectionProps")
    expect(blockRenderer).toContain("<section {...unknownSectionProps}>")

    expect(renderedItem).toContain("children: (sectionChromeProps: CanvasSectionChromeProps) => React.ReactNode")
    expect(renderedItem).toContain("const anchorRef = React.useRef<HTMLElement | null>(null)")
    expect(renderedItem).toContain("ref: setRefs")
    expect(renderedItem).toContain('"data-rt-selected": isActive ? "true" : undefined')
    expect(renderedItem).toContain("{children(sectionChromeProps)}")
    expect(renderedItem).not.toContain("<div\n        ref={setRefs}")
    expect(canvasSurface).toContain("sectionChromeProps={sectionChromeProps}")
    expect(canvasSurface).toMatch(/renderBlocks=\{isCustomerPreviewView\(view\)\s*\?\s*undefined/)
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
    expect(canvasCss).toContain('.site-renderer[data-siab-site-renderer][data-tenant-renderer="amicare"] .rt-canvas .amicare-button-primary.rt-click-edit')
    expect(canvasCss).toContain("width: auto;")
    expect(canvasCss).not.toContain("display: flex;\n  flex-direction: column;\n  gap: 1.75rem;")
  })

  it("keeps Amicare hero card and footer utility styles aligned with the live renderer", () => {
    const canvasCss = read("../../packages/site-renderer/src/canvas.css")

    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-4"]')
    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-5"]')
    expect(canvasCss).toContain('[class~="@min-[48rem]/site-frame:grid-cols-6"]')
    expect(canvasCss).toContain(':where(.rounded-2xl)')
    expect(canvasCss).toContain("border-radius: var(--radius-lg, 1rem);")
    expect(canvasCss).toContain(":where(.text-\\[12px\\])")
    expect(canvasCss).toContain(":where(.text-\\[14px\\])")
    expect(canvasCss).toContain(".cms-block--hero > div:nth-of-type(3) > p")
    expect(canvasCss).not.toContain(".cms-block--hero p {\n  max-width: 28rem;")
    expect(canvasCss).not.toContain(".cms-block--hero p {\n    font-size: 1.125rem;")
  })

  it("isolates CMS editor UI from Amicare renderer styling in the canvas stylesheet", () => {
    const canvasStylesheet = read("src/styles/site-renderer-canvas.css")
    const rendererCanvasCss = read("../../packages/site-renderer/src/canvas.css")

    const editorFrameLayout = read("src/app/(editor-frame)/layout.tsx")

    expect(editorFrameLayout).toContain('import "@/styles/shadcn.css"')
    expect(editorFrameLayout).toContain('import "@/styles/editor-frame-ui.css"')
    expect(editorFrameLayout).toContain('import "@/styles/editor-frame-canvas-affordances.css"')
    expect(canvasStylesheet).not.toContain(".rt-canvas .rt-slot")
    expect(canvasStylesheet).not.toContain(".rt-canvas .rt-click-edit")
    expect(canvasStylesheet).not.toContain("--popover:")

    expect(rendererCanvasCss).toContain('[data-amicare-nav]')
    expect(rendererCanvasCss).toContain('.site-renderer[data-siab-site-renderer][data-tenant-renderer="amicare"] [data-amicare-nav]')
    expect(rendererCanvasCss).toContain('.site-renderer[data-siab-site-renderer][data-tenant-renderer="amicare"] .site-frame-root > footer')
  })

  it("uses one canonical renderer theme injection in the shared shell path", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const palettePicker = read("src/components/editor/theme/palette-picker.tsx")

    expect(canvasSurface).toContain("useSharedRendererShell")
    expect(canvasSurface).toContain("includeThemeStyle")
    expect(canvasSurface).toContain("theme && !useSharedRendererShell")
    expect(canvasSurface).toContain("data-rt-theme-overrides")
    expect(canvasSurface).not.toContain("data-siab-canvas-theme-overrides")
    expect(canvasSurface).not.toContain("amicareCanvasThemeCss")
    expect(canvasSurface).not.toContain("rendererThemeCss")
    expect(canvasSurface).not.toContain("AMICARE_CANVAS_THEME_SCOPE")
    expect(canvasSurface).not.toContain("themeToCssVars")

    expect(palettePicker).toContain("EditorFrameDocumentContext")
    expect(palettePicker).toContain("disableRuntimeThemeOverrides")
    expect(palettePicker).toContain("restoreRuntimeThemeOverrides")
    expect(palettePicker).toContain("createDefaultPaletteProbe")
    expect(palettePicker).toContain('".site-renderer[data-siab-site-renderer] .rt-canvas, .rt-canvas"')
    expect(palettePicker).toContain('closest<HTMLElement>(".site-renderer[data-siab-site-renderer]")')
    expect(palettePicker).toContain('attribute.name !== "data-siab-site-renderer"')
    expect(palettePicker).toContain("defaultView.getComputedStyle(anchor)")
  })

  it("forwards parent sticky chrome inset into the iframe for gutter clamping", () => {
    const frameHost = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const gutterOverlay = read("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx")

    expect(frameHost).toContain("--siab-parent-chrome-bottom")
    expect(frameHost).toContain("measureParentChromeBottom")
    expect(gutterOverlay).toContain("--siab-parent-chrome-bottom")

    const editorFrameUi = read("src/styles/editor-frame-ui.css")
    expect(editorFrameUi).toContain("[data-siab-editor-ui]")
    expect(editorFrameUi).toContain("[data-siab-editor-ui] *")
    expect(editorFrameUi).toContain("[data-radix-popper-content-wrapper]:has([data-siab-editor-ui]) *")
    expect(editorFrameUi).toContain("--color-background: var(--background)")
    expect(editorFrameUi).toContain("--color-card-foreground: var(--card-foreground)")
    expect(editorFrameUi).toContain("--color-primary: var(--primary)")
    expect(editorFrameUi).toContain("--color-secondary: var(--secondary)")
    expect(editorFrameUi).toContain("--color-muted: var(--muted)")
    expect(editorFrameUi).toContain("--color-input: var(--input)")
    expect(editorFrameUi).toContain("--color-destructive: var(--destructive)")
    expect(editorFrameUi).toContain('[data-siab-canvas-chrome="insert-gap"]')
    expect(editorFrameUi).toContain("background-color: transparent")
    expect(editorFrameUi).toContain(':is(button, [role="button"], [role="menuitem"]):is(:hover, :focus-visible, [data-state="open"])')
    expect(editorFrameUi).not.toMatch(/--(?:background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|border|input|ring):\s*(?:#[0-9a-fA-F]{3,8}|oklch\(|rgb\(|hsl\()/)

    const affordances = read("src/styles/editor-frame-canvas-affordances.css")
    expect(affordances).toContain(".rt-canvas .rt-slot")
    expect(affordances).toContain("--rt-affordance")
    expect(affordances).toContain("--siab-editor-frame-viewport-height")
    expect(affordances).toContain('.rt-canvas[data-rt-view="canvas"] .cms-block--hero')
    expect(affordances).toContain(".cms-block--source-amicare-zen-hero")
    expect(affordances).toContain("calc(var(--siab-editor-frame-viewport-height, 100vh) * 0.9)")
  })
})
