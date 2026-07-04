"use client"
import * as React from "react"
import { useId } from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronRight, Copy, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import { SitePageRenderer, createRendererMediaResolver, resolveTenantRenderer } from "@siteinabox/site-renderer"
import { CanvasBlockRenderer, type CanvasSectionChromeProps } from "@/components/editor/canvas/CanvasBlockRenderer"
import { Button } from "@siteinabox/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { formatCssPx, formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@siteinabox/ui/components/dialog"
import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"
import { CanvasChromeVisibilityProvider } from "@/components/editor/canvas/CanvasChromeVisibilityContext"
import { useBlockPresets } from "@/components/editor/canvas/BlockPresetsContext"
import type { BlockPresetDef, BlockTypeDef } from "@/components/editor/canvas/chrome/block-type-picker"
import type { CanvasBlocksApi } from "@/components/editor/canvas/CanvasBlocksApi"
import { useCanvasSelection } from "@/components/editor/canvas/CanvasSelectionContext"
import { useScrollToSelection } from "@/components/editor/canvas/useScrollToSelection"
import {
  remapSelectionAfterDelete,
  remapSelectionAfterInsert,
  remapSelectionAfterReorder,
} from "@/components/editor/canvas/elementPath"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import { toCssVars } from "@/lib/theme/toCssVars"
import { isCustomerPreviewView, isReadOnlyView, type CanvasView } from "@/components/editor/canvas/canvasView"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"

export interface CanvasSurfaceProps {
  manifest: RtManifest
  tenantCss: string | null
  view: CanvasView
  readOnly?: boolean
  theme?: ThemeTokens | null
  rendererSettings?: any
  tenantId?: number | string | null
  tenantSlug?: string | null
  tenantDomain?: string | null
  pageTitle: string
  headerChrome?: React.ReactNode
  footerChrome?: React.ReactNode
  renderHeaderChrome?: (defaultChrome: React.ReactNode) => React.ReactNode
  renderFooterChrome?: (defaultChrome: React.ReactNode) => React.ReactNode
  onOpenBlockInspector?: (index: number) => void
  /** Block-array mutation surface. The iframe editor frame passes
   *  `useCanvasBlocks(manifest)` (RHF-backed); the iframe editor frame passes
   *  `useFrameCanvasBlocks(...)` (postMessage-backed). CanvasSurface never
   *  talks to either transport directly. */
  blocksApi: CanvasBlocksApi
  /** Forces the `SitePageRenderer`-driven shared shell path regardless of
   *  tenant/view. The in-process CMS canvas only needs this for Amicare +
   *  customer preview (default tenant chrome comes from `headerChrome`/
   *  `footerChrome`, which wrap CMS-only interactive chrome components).
   *  `FrameCanvasSurface` (iframe editor frame) has no such CMS chrome
   *  available across the postMessage boundary, so it always forces this on
   *  to get real header/footer chrome from the renderer for every tenant. */
  forceSharedRendererShell?: boolean
}

type AnchorRect = Pick<DOMRect, "left" | "right" | "top" | "width">

const SHARED_SITE_CHROME_SELECTOR =
  "[data-site-chrome], [data-site-chrome-wrapper], [data-site-chrome-menu-trigger], [data-amicare-nav], .site-frame-root > nav, .site-frame-root > footer"

function shouldSuppressCanvasNavigation(target: HTMLElement | null) {
  if (!target) return false
  if (target.closest("[data-siab-editor-ui], [data-siab-canvas-chrome], [role='dialog'], [data-radix-popper-content-wrapper]")) {
    return false
  }

  const link = target.closest<HTMLAnchorElement>("a[href]")
  if (link && !link.classList.contains("rt-click-edit")) return true

  const submitter = target.closest<HTMLButtonElement | HTMLInputElement>("button, input")
  if (!submitter || !submitter.closest(".rt-canvas")) return false
  if (submitter instanceof HTMLButtonElement) return submitter.type === "submit"
  return submitter instanceof HTMLInputElement && submitter.type === "submit"
}

function useFixedAnchorRect(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
): AnchorRect | null {
  const [rect, setRect] = React.useState<AnchorRect | null>(null)

  React.useLayoutEffect(() => {
    if (!enabled) return
    const node = ref.current
    if (!node) return

    let frame: number | null = null
    const measure = () => {
      frame = null
      const next = node.getBoundingClientRect()
      setRect({
        left: next.left,
        right: next.right,
        top: next.top,
        width: next.width,
      })
    }
    const schedule = () => {
      if (frame != null) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(node)
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)

    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, true)
    }
  }, [enabled, ref])

  return rect
}

const CanvasGapOverlay: React.FC<{
  onInsert: (blockType: string, seed?: Record<string, unknown>) => void
}> = ({ onInsert }) => {
  const t = useTranslations("editor")
  const presetsCtx = useBlockPresets()
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const rect = useFixedAnchorRect(anchorRef, true)
  const overlayPosition = useCspStyleRule(
    "canvas-gap-overlay",
    rect
      ? `left:${formatCssPx(rect.left)};top:${formatCssPx(rect.top - 16)};width:${formatCssPx(rect.width)};`
      : null,
  )

  const overlay = rect && typeof document !== "undefined"
    ? createPortal(
        <>
          {overlayPosition.styleElement}
          <div
            data-siab-editor-ui
            data-siab-canvas-chrome="insert-gap"
            className={`${overlayPosition.className} pointer-events-none fixed z-[19] flex h-8 items-center justify-center bg-transparent group/gap`}
          >
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 transition-opacity group-hover/gap:opacity-100" />
            {/* lint:ui-composition:ignore -- low-level canvas overlay trigger needs exact pointer/opacity behavior. */}
            <button
              type="button"
              aria-label={t("insertBlockHere")}
              onClick={() => setOpen(true)}
              className="pointer-events-auto relative z-10 inline-flex size-6 items-center justify-center rounded-full border border-border bg-popover text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover/gap:opacity-100 hover:bg-accent hover:text-accent-foreground focus:opacity-100"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </>,
        document.body,
      )
    : null

  return (
    <>
      <div
        ref={anchorRef}
        className="relative h-0"
        aria-hidden="true"
        data-siab-canvas-gap-anchor
      />
      {overlay}
      <CanvasBlockPickerDialog
        {...presetsCtx}
        open={open}
        onOpenChange={setOpen}
        onAdd={(slug, _atIndex, seed) => {
          onInsert(slug, seed)
          setOpen(false)
        }}
      />
    </>
  )
}

const CanvasBlockPickerDialog: React.FC<{
  blockTypes: BlockTypeDef[]
  presets: BlockPresetDef[]
  presetsError?: string | null
  onReloadPresets: () => void | Promise<void>
  onDeletePreset: (preset: BlockPresetDef) => Promise<void>
  sanitizePresetData?: (slug: string, data: Record<string, unknown>) => Record<string, unknown>
  onAdd: (slug: string, atIndex: number, seed?: Record<string, unknown>) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({
  blockTypes,
  presets,
  presetsError = null,
  onReloadPresets,
  onDeletePreset,
  sanitizePresetData,
  onAdd,
  open,
  onOpenChange,
}) => {
  const t = useTranslations("editor")
  const [expandedSlug, setExpandedSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setExpandedSlug(null)
    void onReloadPresets()
  }, [open, onReloadPresets])

  const presetsBySlug = React.useMemo(() => {
    const grouped: Record<string, BlockPresetDef[]> = {}
    for (const preset of presets) {
      const group = grouped[preset.blockType] ?? []
      group.push(preset)
      grouped[preset.blockType] = group
    }
    return grouped
  }, [presets])

  const insert = (slug: string, seed?: Record<string, unknown>) => {
    onAdd(slug, Number.MAX_SAFE_INTEGER, seed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        data-siab-editor-ui
        data-siab-canvas-chrome="block-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("addBlockTitle")}</DialogTitle>
          <DialogDescription>{t("pickBlockType")}</DialogDescription>
        </DialogHeader>
        {presetsError && (
          <p className="text-xs text-destructive">
            {t("presetLoadFailed", { message: presetsError })}
          </p>
        )}
        <div className="mt-2 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
          {blockTypes.map((blockType) => {
            const tilePresets = presetsBySlug[blockType.slug] ?? []
            const isExpanded = expandedSlug === blockType.slug
            const hasPresets = tilePresets.length > 0
            const Icon = blockType.icon
            const label = typeof blockType.labels?.singular === "string" ? blockType.labels.singular : blockType.slug

            return (
              <div
                key={blockType.slug}
                className={cn(
                  "rounded-md border border-border bg-card text-card-foreground transition-colors",
                  isExpanded && "border-ring",
                )}
              >
                {/* lint:ui-composition:ignore -- block picker rows use native button semantics inside a custom grid surface. */}
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    if (!hasPresets) {
                      insert(blockType.slug)
                      return
                    }
                    setExpandedSlug(isExpanded ? null : blockType.slug)
                  }}
                >
                  {Icon && <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {blockType.description ?? t("fieldCount", { count: blockType.fields.length })}
                      {hasPresets && ` · ${t("presetCount", { count: tilePresets.length })}`}
                    </span>
                  </span>
                  {hasPresets && (
                    <span className="mt-0.5 text-muted-foreground" aria-hidden>
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </span>
                  )}
                </button>
                {isExpanded && hasPresets && (
                  <div className="space-y-1 border-t border-border p-2">
                    {/* lint:ui-composition:ignore -- menu row needs native button behavior without Button chrome. */}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => insert(blockType.slug)}
                    >
                      <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                      <span>{t("blankBlock", { type: label })}</span>
                    </button>
                    {tilePresets.map((preset) => (
                      <CanvasPresetRow
                        key={preset.id}
                        preset={preset}
                        onInsert={() => {
                          const seed = sanitizePresetData
                            ? sanitizePresetData(blockType.slug, preset.data)
                            : preset.data
                          insert(blockType.slug, seed)
                        }}
                        onDelete={onDeletePreset}
                        onDeleted={onReloadPresets}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const CanvasPresetRow: React.FC<{
  preset: BlockPresetDef
  onInsert: () => void
  onDelete: (preset: BlockPresetDef) => Promise<void>
  onDeleted: () => void | Promise<void>
}> = ({ preset, onInsert, onDelete, onDeleted }) => {
  const t = useTranslations("editor")
  const status = useStatusFeedback()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  return (
    <div className="flex items-center gap-2 rounded-md transition-colors hover:bg-accent/40">
      {/* lint:ui-composition:ignore -- preset list row is a compact selectable row inside the canvas picker. */}
      <button
        type="button"
        className="min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onInsert}
      >
        <span className="block truncate font-medium">{preset.name}</span>
        {preset.description && (
          <span className="block truncate text-xs text-muted-foreground">{preset.description}</span>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="mr-1 size-7"
        onClick={(event) => {
          event.stopPropagation()
          setConfirmOpen(true)
        }}
        aria-label={t("deletePresetLabel", { name: preset.name })}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deletePresetTitle", { name: preset.name })}
        description={t("deletePresetDescription")}
        confirmLabel={t("deletePreset")}
        onConfirm={async () => {
          await onDelete(preset)
          status.success(t("deletedPreset", { name: preset.name }))
          await onDeleted()
        }}
      />
    </div>
  )
}

const CanvasBlockContextMenu: React.FC<{
  menu: { index: number; point: { x: number; y: number } } | null
  onClose: () => void
  onOpenInspector: (index: number) => void
  onDuplicate: (index: number) => void
  onDelete: (index: number) => void
}> = ({ menu, onClose, onOpenInspector, onDuplicate, onDelete }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")

  React.useEffect(() => {
    if (!menu) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [menu, onClose])

  // siab-responsive-ignore-next-line -- CMS context menu is positioned against the browser viewport.
  const left = menu && typeof document !== "undefined" ? Math.max(8, Math.min(menu.point.x, window.innerWidth - 240)) : 0
  // siab-responsive-ignore-next-line -- CMS context menu is positioned against the browser viewport.
  const top = menu && typeof document !== "undefined" ? Math.max(8, Math.min(menu.point.y, window.innerHeight - 144)) : 0
  const menuPosition = useCspStyleRule(
    "canvas-block-menu",
    menu && typeof document !== "undefined"
      ? `left:${formatCssPx(left)};top:${formatCssPx(top)};`
      : null,
  )

  if (!menu || typeof document === "undefined") return null

  return createPortal(
    <div
      data-siab-editor-ui
      className="fixed inset-0 z-50 font-sans"
      role="presentation"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      {menuPosition.styleElement}
      <div
        data-siab-editor-ui
        role="menu"
        aria-label={t("blockActions")}
        className={`${menuPosition.className} fixed min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md`}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {/* lint:ui-composition:ignore -- menuitem uses native button semantics in a portal role=menu. */}
        <button
          type="button"
          role="menuitem"
          className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          onClick={() => {
            onClose()
            onOpenInspector(menu.index)
          }}
        >
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          {t("openInspector")}
        </button>
        {/* lint:ui-composition:ignore -- menuitem uses native button semantics in a portal role=menu. */}
        <button
          type="button"
          role="menuitem"
          className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          onClick={() => {
            onClose()
            onDuplicate(menu.index)
          }}
        >
          <Copy className="size-4 text-muted-foreground" aria-hidden />
          {t("duplicate")}
        </button>
        {/* lint:ui-composition:ignore -- menuitem uses native button semantics in a portal role=menu. */}
        <button
          type="button"
          role="menuitem"
          className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 focus:bg-destructive/10"
          onClick={() => {
            onClose()
            onDelete(menu.index)
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {tCommon("delete")}
        </button>
      </div>
    </div>,
    document.body,
  )
}

interface SortableBlockItemProps {
  id: string
  block: any
  index: number
  isActive: boolean
  manifest: RtManifest
  tenantId?: number | string | null
  tenantRendererKey?: "amicare" | null
  onActivate: () => void
  onUpdate: (next: any) => void
  onDelete: () => void
  onDuplicate: () => void
  readOnly?: boolean
  gutterVisible: boolean
  setGutterVisible: (next: boolean) => void
}

const SortableBlockItem: React.FC<SortableBlockItemProps> = ({
  id,
  block,
  index,
  isActive,
  manifest,
  tenantId,
  tenantRendererKey,
  onActivate,
  onUpdate,
  onDelete,
  onDuplicate,
  readOnly = false,
  gutterVisible,
  setGutterVisible,
}) => {
  const t = useTranslations("editor")
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: readOnly })
  const anchorRef = React.useRef<HTMLDivElement | null>(null)

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      anchorRef.current = node
    },
    [setNodeRef],
  )

  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "canvas-sortable-block",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )

  return (
    <>
      {sortableStyle.styleElement}
      <div
        ref={setRefs}
        className={cn(sortableStyle.className, "relative", isDragging && "opacity-50")}
        onMouseEnter={() => setGutterVisible(true)}
        onMouseLeave={() => setGutterVisible(false)}
        onFocusCapture={() => setGutterVisible(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setGutterVisible(false)
          }
        }}
      >
        {!readOnly && (
          <CanvasChromeGutterOverlay
            anchorRef={anchorRef}
            visible={gutterVisible}
            setVisible={setGutterVisible}
            dragHandleRef={setActivatorNodeRef}
            dragHandleProps={{ ...attributes, ...listeners }}
            optionsLabel={t("blockActions")}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        )}
        <CanvasChromeVisibilityProvider value={{ visible: gutterVisible, setVisible: setGutterVisible }}>
          <CanvasBlockRenderer
            block={block}
            index={index}
            isActive={isActive}
            manifest={manifest}
            tenantId={tenantId}
            tenantRendererKey={tenantRendererKey}
            onActivate={onActivate}
            onUpdate={readOnly ? () => {} : onUpdate}
          />
        </CanvasChromeVisibilityProvider>
      </div>
    </>
  )
}

const SortableRenderedBlockItem: React.FC<{
  id: string
  index: number
  isActive: boolean
  readOnly?: boolean
  children: (sectionChromeProps: CanvasSectionChromeProps) => React.ReactNode
  onActivate: () => void
  onDelete: () => void
  onDuplicate: () => void
  gutterVisible: boolean
  setGutterVisible: (next: boolean) => void
}> = ({
  id,
  index,
  isActive,
  readOnly = false,
  children,
  onActivate,
  onDelete,
  onDuplicate,
  gutterVisible,
  setGutterVisible,
}) => {
  const t = useTranslations("editor")
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: readOnly })
  const anchorRef = React.useRef<HTMLElement | null>(null)

  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node)
      anchorRef.current = node
    },
    [setNodeRef],
  )

  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "canvas-rendered-sortable-block",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )
  const sectionChromeProps = React.useMemo<CanvasSectionChromeProps>(() => ({
    ref: setRefs,
    className: cn(sortableStyle.className, "relative", isDragging && "opacity-50"),
    "data-block-index": index,
    "data-rt-selected": isActive ? "true" : undefined,
    onClick: (event) => {
      if ((event.target as HTMLElement | null)?.closest("[data-siab-editor-ui], [data-siab-canvas-chrome]")) return
      onActivate()
    },
    onMouseEnter: () => setGutterVisible(true),
    onMouseLeave: () => setGutterVisible(false),
    onFocusCapture: () => setGutterVisible(true),
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setGutterVisible(false)
      }
    },
  }), [index, isActive, isDragging, onActivate, setGutterVisible, setRefs, sortableStyle.className])

  return (
    <>
      {sortableStyle.styleElement}
      {!readOnly && (
        <CanvasChromeGutterOverlay
          anchorRef={anchorRef}
          visible={gutterVisible}
          setVisible={setGutterVisible}
          dragHandleRef={setActivatorNodeRef}
          dragHandleProps={{ ...attributes, ...listeners }}
          optionsLabel={t("blockActions")}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      )}
      {children(sectionChromeProps)}
    </>
  )
}

/**
 * Desktop canvas render surface — the shared DnD/gutter/inline-edit body
 * Shared canvas render body behind the iframe editor frame (`FrameCanvasSurface`)
 * frame's canvas. Parameterized on `blocksApi` (`CanvasBlocksApi`) instead of
 * calling `useCanvasBlocks` itself, so callers can back block mutations with
 * whatever transport is appropriate (RHF vs. postMessage).
 */
export const CanvasSurface: React.FC<CanvasSurfaceProps> = ({
  manifest,
  tenantCss,
  view,
  theme,
  rendererSettings,
  tenantId,
  tenantSlug,
  tenantDomain,
  readOnly = false,
  pageTitle,
  headerChrome,
  footerChrome,
  renderHeaderChrome,
  renderFooterChrome,
  onOpenBlockInspector,
  blocksApi,
  forceSharedRendererShell = false,
}) => {
  const t = useTranslations("editor")
  const cspNonce = useCspNonce()
  const {
    blocks,
    activeIndex,
    setActiveIndex,
    updateBlock,
    insertBlockAt,
    deleteBlock,
    duplicateBlock,
    reorderBlocks,
  } = blocksApi
  const { select, selected } = useCanvasSelection()

  React.useEffect(() => {
    setActiveIndex(selected?.field === "" ? selected.blockIndex : null)
  }, [selected?.blockIndex, selected?.field, setActiveIndex])

  const paneRef = React.useRef<HTMLDivElement>(null)
  const [activeBlockGutterIndex, setActiveBlockGutterIndex] = React.useState<number | null>(null)
  const [blockContextMenu, setBlockContextMenu] = React.useState<{ index: number; point: { x: number; y: number } } | null>(null)
  const [deleteTargetIndex, setDeleteTargetIndex] = React.useState<number | null>(null)
  useScrollToSelection(paneRef, selected)

  const setBlockGutterVisible = React.useCallback((index: number, next: boolean) => {
    if (next) {
      setActiveBlockGutterIndex(index)
      return
    }
    setActiveBlockGutterIndex((current) => current === index ? null : current)
  }, [])

  const onCanvasClick = (event: React.MouseEvent) => {
    setBlockContextMenu(null)
    if (event.target === event.currentTarget) {
      setActiveIndex(null)
      select(null)
    }
  }

  const effectiveReadOnly = readOnly || isReadOnlyView(view)

  const onCanvasContextMenu = (event: React.MouseEvent) => {
    if (effectiveReadOnly) {
      event.preventDefault()
      event.stopPropagation()
      setBlockContextMenu(null)
      return
    }
    const target = event.target as HTMLElement | null
    if (target?.closest(SHARED_SITE_CHROME_SELECTOR)) return
    event.preventDefault()
    event.stopPropagation()
    const blockNode = target?.closest<HTMLElement>("[data-block-index]")
    if (!blockNode) {
      setBlockContextMenu(null)
      return
    }
    const index = Number(blockNode.dataset.blockIndex)
    if (!Number.isInteger(index)) return
    setActiveIndex(index)
    select({ blockIndex: index, field: "" })
    setBlockContextMenu({ index, point: { x: event.clientX, y: event.clientY } })
  }

  const deleteBlockWithRemap = (i: number) => {
    select((prev) => remapSelectionAfterDelete(prev, i))
    deleteBlock(i)
  }

  const requestDeleteBlock = (i: number) => {
    setDeleteTargetIndex(i)
  }

  const reorderBlocksWithRemap = (from: number, to: number) => {
    select((prev) => remapSelectionAfterReorder(prev, from, to))
    reorderBlocks(from, to)
  }

  const insertBlockAtWithRemap = (i: number, slug: string, seed?: Record<string, unknown>) => {
    select((prev) => remapSelectionAfterInsert(prev, i))
    insertBlockAt(i, slug, seed)
  }

  const duplicateBlockWithRemap = (i: number) => {
    select((prev) => remapSelectionAfterInsert(prev, i + 1))
    duplicateBlock(i)
  }

  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const sortableIds = blocks.map((_, i) => String(i))
  const rendererTheme = React.useMemo(() => cmsThemeToRendererTheme(theme), [theme])
  const mediaResolver = React.useMemo(
    () => tenantId != null ? createRendererMediaResolver(String(tenantId)) : undefined,
    [tenantId],
  )
  const tenantRendererKey = rendererSettings
    ? resolveTenantRenderer({ tenantSlug, domain: tenantDomain, settings: rendererSettings })
    : null
  const effectiveTenantCss = tenantRendererKey ? null : tenantCss
  const useSharedAmicareShell = tenantRendererKey === "amicare"
  const useSharedPreviewShell = isCustomerPreviewView(view) && Boolean(rendererSettings)
  const useSharedRendererShell = forceSharedRendererShell || useSharedAmicareShell || useSharedPreviewShell
  const rendererPage = React.useMemo(() => ({
    title: pageTitle || "Untitled",
    slug: "index",
    status: "published" as const,
    blocks,
    updatedAt: new Date(0).toISOString(),
  }), [blocks, pageTitle])
  const deleteTargetBlock = deleteTargetIndex != null ? blocks[deleteTargetIndex] : undefined
  const deleteTargetConfig = deleteTargetBlock
    ? manifest.blocks?.find((blockType) => blockType.slug === deleteTargetBlock.blockType)
    : undefined
  const deleteTargetLabel = deleteTargetBlock
    ? (deleteTargetConfig?.label ?? deleteTargetBlock.blockType)
    : ""
  const suppressCanvasNavigation = !isCustomerPreviewView(view)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (effectiveReadOnly || !over || active.id === over.id) return
    const from = Number(active.id)
    const to = Number(over.id)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    reorderBlocksWithRemap(from, to)
  }

  return (
    <div className="w-full">
      <div
        ref={paneRef}
        className="min-w-0 overflow-x-hidden bg-transparent"
        onClick={onCanvasClick}
      >
        {effectiveTenantCss && (
          <style nonce={cspNonce} suppressHydrationWarning data-rt-tenant-css dangerouslySetInnerHTML={{ __html: effectiveTenantCss }} />
        )}
        {theme && !useSharedRendererShell && (
          <style nonce={cspNonce} suppressHydrationWarning data-rt-theme-overrides dangerouslySetInnerHTML={{ __html: toCssVars(theme) }} />
        )}
        {useSharedRendererShell ? (
          <div
            onContextMenuCapture={onCanvasContextMenu}
            onClickCapture={(event) => {
              if (suppressCanvasNavigation && shouldSuppressCanvasNavigation(event.target as HTMLElement | null)) {
                event.preventDefault()
              }
            }}
            onSubmitCapture={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <SitePageRenderer
                  page={rendererPage as any}
                  settings={rendererSettings}
                  theme={rendererTheme}
                  tenantSlug={tenantSlug}
                  domain={tenantDomain}
                  mediaResolver={mediaResolver}
                  nonce={cspNonce}
                  includeThemeStyle
                  includeBehaviorScripts={false}
                  renderHeader={renderHeaderChrome
                    ? ({ defaultChrome }) => renderHeaderChrome(defaultChrome)
                    : undefined}
                  renderFooter={renderFooterChrome
                    ? ({ defaultChrome }) => renderFooterChrome(defaultChrome)
                    : undefined}
                  canvasAttributes={{ "data-rt-view": view } as React.HTMLAttributes<HTMLDivElement>}
                  canvasClassName={suppressCanvasNavigation ? "[&_a[href]:not(.rt-click-edit)]:pointer-events-none" : undefined}
                  formAction="#"
                  renderBlocks={isCustomerPreviewView(view)
                    ? undefined
                    : () => (
                      <>
                        {!effectiveReadOnly && (
                          <CanvasGapOverlay
                            onInsert={(slug, seed) => insertBlockAtWithRemap(0, slug, seed)}
                          />
                        )}
                        {blocks.length === 0 && (
                          <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                            <p>{t("noBlocksYet")} {!isReadOnlyView(view) ? t("addFirstBlockHint") : t("switchToCanvasToAddBlocks")}</p>
                          </div>
                        )}
                        {blocks.map((block, index) => (
                          <React.Fragment key={`${block.blockType}-${index}`}>
                            <SortableRenderedBlockItem
                              id={String(index)}
                              index={index}
                              isActive={!isCustomerPreviewView(view) && activeIndex === index}
                              onActivate={() => {
                                if (isCustomerPreviewView(view)) return
                                setActiveIndex(index)
                                select(null)
                              }}
                              onDelete={() => requestDeleteBlock(index)}
                              onDuplicate={() => duplicateBlockWithRemap(index)}
                              readOnly={effectiveReadOnly}
                              gutterVisible={activeBlockGutterIndex === index}
                              setGutterVisible={(next) => setBlockGutterVisible(index, next)}
                            >
                              {(sectionChromeProps) => (
                                <CanvasBlockRenderer
                                  block={block}
                                  index={index}
                                  isActive={activeIndex === index}
                                  manifest={manifest}
                                  onActivate={() => {
                                    if (isCustomerPreviewView(view)) return
                                    setActiveIndex(index)
                                    select(null)
                                  }}
                                  onUpdate={effectiveReadOnly ? () => {} : updateBlock(index)}
                                  tenantId={tenantId}
                                  tenantRendererKey={tenantRendererKey}
                                  sectionChromeProps={sectionChromeProps}
                                />
                              )}
                            </SortableRenderedBlockItem>
                            {!effectiveReadOnly && (
                              <CanvasGapOverlay
                                onInsert={(slug, seed) => insertBlockAtWithRemap(index + 1, slug, seed)}
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                />
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div
            className={cn("rt-canvas w-full", suppressCanvasNavigation && "[&_a[href]:not(.rt-click-edit)]:pointer-events-none")}
            data-rt-view={view}
            data-rt-mode={theme?.mode === "dark" ? "dark" : "light"}
            onContextMenuCapture={onCanvasContextMenu}
            onClickCapture={(event) => {
              if (suppressCanvasNavigation && shouldSuppressCanvasNavigation(event.target as HTMLElement | null)) {
                event.preventDefault()
              }
            }}
            onSubmitCapture={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <div
              className="site-frame-root"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setActiveIndex(null)
                  select(null)
                }
              }}
            >
              {headerChrome}
              {!effectiveReadOnly && (
                <CanvasGapOverlay
                  onInsert={(slug, seed) => insertBlockAtWithRemap(0, slug, seed)}
                />
              )}
              {blocks.length === 0 && (
                <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                  <p>{t("noBlocksYet")} {!isReadOnlyView(view) ? t("addFirstBlockHint") : t("switchToCanvasToAddBlocks")}</p>
                </div>
              )}
              <DndContext
                id={dndId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, i) => (
                    <React.Fragment key={i}>
                      <SortableBlockItem
                        id={String(i)}
                        block={block}
                        index={i}
                        isActive={!isCustomerPreviewView(view) && activeIndex === i}
                        manifest={manifest}
                        onActivate={() => {
                          if (isCustomerPreviewView(view)) return
                          setActiveIndex(i)
                          select(null)
                        }}
                        onUpdate={updateBlock(i)}
                        tenantId={tenantId}
                        tenantRendererKey={tenantRendererKey}
                        onDelete={() => requestDeleteBlock(i)}
                        onDuplicate={() => duplicateBlockWithRemap(i)}
                        readOnly={effectiveReadOnly}
                        gutterVisible={activeBlockGutterIndex === i}
                        setGutterVisible={(next) => setBlockGutterVisible(i, next)}
                      />
                      {!effectiveReadOnly && (
                        <CanvasGapOverlay
                          onInsert={(slug, seed) => insertBlockAtWithRemap(i + 1, slug, seed)}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </SortableContext>
              </DndContext>
              {footerChrome}
            </div>
          </div>
        )}
      </div>
      {!effectiveReadOnly && (
        <>
          <CanvasBlockContextMenu
            menu={blockContextMenu}
            onClose={() => setBlockContextMenu(null)}
            onOpenInspector={(index) => {
              select({ blockIndex: index, field: "" })
              onOpenBlockInspector?.(index)
            }}
            onDuplicate={duplicateBlockWithRemap}
            onDelete={requestDeleteBlock}
          />
          <ConfirmDialog
            open={deleteTargetIndex !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTargetIndex(null)
            }}
            title={t("deleteBlockTitle")}
            description={t("deleteBlockDescription", { label: deleteTargetLabel })}
            confirmLabel={t("deleteBlock")}
            variant="destructive"
            onConfirm={async () => {
              if (deleteTargetIndex == null) return
              deleteBlockWithRemap(deleteTargetIndex)
              setDeleteTargetIndex(null)
            }}
          />
        </>
      )}
    </div>
  )
}
