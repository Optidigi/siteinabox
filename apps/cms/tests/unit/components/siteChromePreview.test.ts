import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = () => readFileSync("src/components/editor/canvas/SiteChromePreview.tsx", "utf8")
const pageFormSource = () => readFileSync("src/components/forms/PageForm.tsx", "utf8")
const canvasModeSource = () => readFileSync("src/components/editor/canvas/CanvasMode.tsx", "utf8")
const gutterOverlaySource = () => readFileSync("src/components/editor/canvas/CanvasChromeGutterOverlay.tsx", "utf8")

describe("SiteChromePreview chrome actions", () => {
  it("keeps sidebar chrome labels literal instead of leaking missing i18n keys", () => {
    const file = source()
    const pageForm = pageFormSource()

    expect(file).toContain('const chromeLabel = (zone: SiteChromeZone) => zone === "header" ? "Header" : "Footer"')
    expect(file).not.toContain('t("header")')
    expect(file).not.toContain('t("footer")')
    expect(pageForm).not.toContain('t("header")')
    expect(pageForm).not.toContain('t("footer")')
  })

  it("routes chrome navigation actions to the matching Header or Footer tab", () => {
    const file = source()
    const pageForm = pageFormSource()

    expect(pageForm).toContain('return `${navigationHref}${separator}zone=${zone}`')
    expect(pageForm).toContain('navigationHref={navigationHrefFor("header")}')
    expect(pageForm).toContain('navigationHref={navigationHrefFor("footer")}')
    expect(file).toContain("onNavigate?: (href: string) => void")
    expect(pageForm).toContain("const navigateFromChrome = useCallback(")
    expect(pageForm).toContain("guard.guardedNavigate(() => router.push(href))")
    expect(pageForm).toContain("onNavigate={navigateFromChrome}")
  })

  it("uses a button action for guarded portal-menu navigation", () => {
    const file = source()

    expect(file).toContain("{navigationHref && onNavigate && (")
    expect(file).toContain('<button')
    expect(file).toContain('role="menuitem"')
    expect(file).toContain("setPoint(null)")
    expect(file).toContain("onNavigate(navigationHref)")
  })

  it("does not hand off site chrome clicks to site settings", () => {
    const file = source()
    const pageForm = pageFormSource()

    expect(file).not.toContain("settingsHref")
    expect(file).not.toContain("Settings")
    expect(file).not.toContain('t("openSiteSettings")')
    expect(pageForm).not.toContain("settingsHref")
  })

  it("lets editor chrome clicks open inspectors instead of the actions menu", () => {
    const file = source()
    const pageForm = pageFormSource()

    expect(file).toContain("export function SiteChromeActionFrame")
    expect(file).toContain("overlayTargetSelector={siteChromeTargetSelector(zone)}")
    expect(file).toContain("trigger={children}")
    expect(file).toContain("export type SiteChromeSelection")
    expect(file).toContain("export type SiteChromeSelectPoint")
    expect(file).toContain("onSelect?: (selection: SiteChromeSelection, point?: SiteChromeSelectPoint) => void")
    expect(file).toContain("if (onSelect) {")
    expect(pageForm).toContain("const [selectedChrome, setSelectedChrome] = useState<SiteChromeSelection | null>(null)")
    expect(pageForm).toContain("const [chromeQuickMenu, setChromeQuickMenu] = useState<{ selection: SiteChromeSelection; point: SiteChromeSelectPoint } | null>(null)")
    expect(pageForm).toContain("if (mode === \"canvas\" && point) setChromeQuickMenu({ selection, point })")
    expect(pageForm).toContain("onSelect={selectChrome}")
    expect(pageForm).toContain("<SiteChromeDrillDown")
    expect(pageForm).toContain("<SiteChromeQuickMenu")
  })

  it("opens chrome menus from right-click or the explicit options button, not ordinary footer clicks", () => {
    const file = source()
    const canvasMode = canvasModeSource()
    const gutterOverlay = gutterOverlaySource()

    expect(file).toContain("showOptionsButton")
    expect(file).toContain("const siteChromeTargetSelector = (zone: SiteChromeZone)")
    expect(file).toContain(".rt-canvas [data-amicare-nav]")
    expect(file).toContain(".rt-canvas .site-frame-root > footer")
    expect(file).toContain('import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"')
    expect(file).toContain("<CanvasChromeGutterOverlay")
    expect(file).toContain('dataChrome="site-chrome-gutter"')
    expect(file).toContain("visible={gutterVisible || selected}")
    expect(file).toContain("useOverlayTarget ? (")
    expect(file).toContain("trigger")
    expect(file).toContain("document.querySelectorAll<HTMLElement>(overlayTargetSelector)")
    expect(file).toContain("const nextAnchor = pickChromeTarget(nextTargets, overlayAnchorRef.current)")
    expect(file).toContain("target.addEventListener(\"click\", onClick)")
    expect(file).toContain("target.addEventListener(\"contextmenu\", onContextMenu)")
    expect(file).toContain('document.addEventListener("pointerover", onDocumentPointerOver, true)')
    expect(file).toContain('document.addEventListener("pointermove", onDocumentPointerMove, true)')
    expect(file).toContain('document.addEventListener("pointerout", onDocumentPointerOut, true)')
    expect(file).toContain('document.addEventListener("mouseover", onDocumentMouseOver, true)')
    expect(file).toContain('document.addEventListener("mousemove", onDocumentMouseMove, true)')
    expect(file).toContain('document.addEventListener("mouseout", onDocumentMouseOut, true)')
    expect(file).toContain('document.addEventListener("contextmenu", onDocumentContextMenu, true)')
    expect(file).toContain("const syncHoveredTarget = () => {")
    expect(file).toContain(".find((target) => target.matches(\":hover\"))")
    expect(file).toContain('document.querySelector(\'[data-siab-canvas-chrome="site-chrome-gutter"]:hover\')')
    expect(file).toContain("const hoverSyncInterval = window.setInterval(syncHoveredTarget, 120)")
    expect(file).toContain("const targetFromEvent = (eventTarget: EventTarget | null) => eventTarget instanceof HTMLElement")
    expect(file).toContain("eventTarget.closest<HTMLElement>(overlayTargetSelector)")
    expect(file).not.toContain("group/site-chrome")
    expect(file).not.toContain("absolute right-3 top-3 z-[60]")
    expect(file).toContain("cms-block--site-chrome")
    expect(file).toContain('data-active={selected || undefined}')
    expect(file).toContain("onContextMenu={(event) => {")
    expect(file).toContain("openAt({ x: event.clientX, y: event.clientY })")
    expect(file).toContain("onSelect()")
    expect(gutterOverlay).toContain("data-site-chrome-menu-trigger")
    expect(gutterOverlay).not.toContain("onPointerDown={(event) => {")
    expect(gutterOverlay).toContain("data-siab-canvas-chrome={dataChrome}")
    expect(gutterOverlay).toContain("createPortal(")
    expect(gutterOverlay).toContain("premeasure = false")
    expect(gutterOverlay).toContain("if (!node) return")
    expect(gutterOverlay).toContain("useFixedAnchorRect(anchorRef, premeasure || show, measureKey)")
    expect(gutterOverlay).toContain('useCspStyleRule(')
    expect(gutterOverlay).toContain('"canvas-gutter-overlay"')
    expect(gutterOverlay).toContain("function cmsChromeBottomAt(x: number)")
    expect(gutterOverlay).toContain("querySelectorAll<HTMLElement>(\"[data-siab-cms-sticky-chrome]\")")
    expect(gutterOverlay).toContain('dataChrome === "site-chrome-gutter"')
    expect(gutterOverlay).toContain("const naturalTop = rect ? Math.max(CHROME_VIEWPORT_GAP, rect.top + CHROME_VIEWPORT_GAP) : 0")
    expect(gutterOverlay).toContain("hiddenAfterAnchorScrolledAway")
    expect(gutterOverlay).not.toContain("hiddenBehindCmsChrome")
    expect(gutterOverlay).toContain("left:${formatCssPx(left)}")
    expect(gutterOverlay).toContain("top:${formatCssPx(top)}")
    expect(gutterOverlay).toContain("{position.styleElement}")
    expect(gutterOverlay).toContain("${position.className} fixed z-[19]")
    expect(canvasMode).toContain("<CanvasChromeGutterOverlay")
    expect(file).not.toContain('onSelect({ zone: "footer" }, { x: event.clientX, y: event.clientY })')
    expect(canvasMode).toContain("onContextMenuCapture={onCanvasContextMenu}")
    expect(canvasMode).toContain("const SHARED_SITE_CHROME_SELECTOR")
    expect(canvasMode).toContain("[data-amicare-nav]")
    expect(canvasMode).toContain(".site-frame-root > nav")
    expect(canvasMode).toContain(".site-frame-root > footer")
    expect(canvasMode).toContain("target?.closest(SHARED_SITE_CHROME_SELECTOR)")
  })

  it("keeps shared renderer chrome DOM direct and uses a portal overlay target for edit affordances", () => {
    const file = source()
    const pageForm = pageFormSource()

    expect(pageForm).toContain("<SiteChromeActionFrame")
    expect(file).toContain("const useOverlayTarget = showOptionsButton && !!overlayTargetSelector")
    expect(file).toContain("{useOverlayTarget ? (")
    expect(file).toContain(") : (")
    expect(file).toContain("activeAnchorRef = useOverlayTarget ? overlayAnchorRef : anchorRef")
    expect(file).toContain("const [overlayTargets, setOverlayTargets] = useState<HTMLElement[]>([])")
    expect(file).toContain("const gutterHideTimerRef = useRef<number | null>(null)")
    expect(file).toContain("const setGutterVisibleSafely = useCallback((next: boolean) => {")
    expect(file).toContain("const hideDelayMs = useOverlayTarget ? 800 : 250")
    expect(file).toContain("}, hideDelayMs)")
    expect(file).toContain("premeasure")
    expect(file).toContain("measureKey={overlayAnchor}")
    expect(file).not.toContain('<div\n        ref={anchorRef}\n        className={cn(\n          "cms-block relative",\n          `cms-block--site-chrome cms-block--site-chrome-${zone}`,\n        )}\n        data-active={selected || undefined}\n        data-site-chrome-wrapper={showOptionsButton ? "true" : undefined}\n        onMouseEnter={() => setGutterVisible(true)}\n        onMouseLeave={() => setGutterVisible(false)}\n        onFocusCapture={() => setGutterVisible(true)}\n        onBlurCapture={(event) => {')
  })

  it("disables canvas context menus in sidebar mode", () => {
    const file = source()
    const canvasMode = canvasModeSource()

    expect(file).toContain("const isReadOnly = isReadOnlyView(view)")
    expect(file).toContain("if (isReadOnly) return")
    expect(file).toContain("showOptionsButton && !isReadOnly")
    expect(canvasMode).toContain("const effectiveReadOnly = readOnly || isReadOnlyView(view)")
    expect(canvasMode).toContain("if (effectiveReadOnly) {")
    expect(canvasMode).toContain("event.preventDefault()")
    expect(canvasMode).toContain("event.stopPropagation()")
    expect(canvasMode).toContain("setBlockContextMenu(null)")
  })

  it("renders header/footer logo overrides with brand-logo fallback", () => {
    const file = source()

    expect(file).toContain("const brandLogo = mediaUrl(settings?.branding?.logo)")
    expect(file).toContain("const headerLogo = mediaUrl(settings?.chrome?.header?.logo) ?? brandLogo")
    expect(file).toContain("const footerLogo = mediaUrl(settings?.chrome?.footer?.logo) ?? brandLogo")
  })

  it("portals the actions menu to document.body so tenant canvas theme styles do not own it", () => {
    const file = source()

    expect(file).toContain('import { createPortal } from "react-dom"')
    expect(file).toContain("document.body")
    expect(file).toContain("border border-border bg-popover")
  })

  it("closes CMS context menus on outside right-click without leaking to the browser menu", () => {
    const file = source()
    const canvasMode = canvasModeSource()
    const pageForm = pageFormSource()

    for (const text of [file, canvasMode, pageForm]) {
      expect(text).toContain("onContextMenu={(event) => {")
      expect(text).toContain("event.preventDefault()")
      expect(text).toContain("event.stopPropagation()")
    }
    expect(file).toContain("setPoint(null)")
    expect(canvasMode).toContain("onClose()")
    expect(pageForm).toContain("onClose()")
  })

  it("renders full supported business identifiers in the canvas footer preview", () => {
    const file = source()

    expect(file).toContain("nap?.kvkNumber")
    expect(file).toContain("nap?.establishmentNumber")
    expect(file).toContain("hasBusinessDetails")
  })

  it("renders manifest-driven footer composition when columns are present", () => {
    const file = source()

    expect(file).toContain("<FooterColumns")
    expect(file).toContain("const footerColumns = normalizeFooterPreviewColumns(footer?.columns)")
    expect(file).toContain("column.items.map")
    expect(file).not.toContain("column.items.slice(0, 1).map")
    expect(file).toContain("onUpdateFooterTextItem && itemIndex === 0 && item.type === \"text\"")
    expect(file).not.toContain("outline-2 outline-offset-2 outline-accent")
    expect(file).not.toContain("hover:ring-1 hover:ring-accent/60")
    expect(file).not.toContain("hover:outline-accent/60")
    expect(file).toContain("function FooterItem")
    expect(file).toContain('item.type === "links"')
    expect(file).toContain('item.type === "navigation"')
    expect(file).toContain('import { RtSlot } from "./inline/RtSlot"')
    expect(file).toContain("value={inlineRootFromText(label)}")
    expect(file).toContain("value={blockRootFromText(text ?? textPlaceholder)}")
    expect(file).toContain("onUpdateTextItem({ label: rtToPlainText(next) || null })")
    expect(file).toContain("onUpdateTextItem({ text: plain || null })")
    expect(file).not.toContain("contentEditable={!!onUpdateText}")
  })

  it("blocks ordinary site links in the canvas without disabling editor CTA links", () => {
    const canvasMode = canvasModeSource()

    expect(canvasMode).toContain("[&_a[href]:not(.rt-click-edit)]:pointer-events-none")
    expect(canvasMode).toContain("function shouldSuppressCanvasNavigation")
    expect(canvasMode).toContain('closest<HTMLAnchorElement>("a[href]")')
    expect(canvasMode).toContain('!link.classList.contains("rt-click-edit")')
    expect(canvasMode).toContain("onSubmitCapture={(event) => {")
    expect(canvasMode).toContain("event.preventDefault()")
  })

  it("owns section right-clicks with a CMS block context menu", () => {
    const canvasMode = canvasModeSource()
    const pageForm = pageFormSource()

    expect(canvasMode).toContain("const CanvasBlockContextMenu")
    expect(canvasMode).toContain("role=\"menu\"")
    expect(canvasMode).toContain("onOpenInspector(menu.index)")
    expect(canvasMode).toContain("onDuplicate(menu.index)")
    expect(canvasMode).toContain("onDelete(menu.index)")
    expect(canvasMode).toContain('select({ blockIndex: index, field: "" })')
    expect(pageForm).toContain("const openBlockInSidebar = useCallback((index: number) => {")
    expect(pageForm).toContain("void handleModeChange(\"sidebar\")")
    expect(pageForm).toContain("onOpenBlockInspector={openBlockInSidebar}")
  })

  it("does not use Amicare-specific values as cross-tenant chrome fallbacks", () => {
    const file = source()

    expect(file).not.toContain("Amicare")
    expect(file).not.toContain("ami-care")
    expect(file).not.toContain("99968347")
  })
})
