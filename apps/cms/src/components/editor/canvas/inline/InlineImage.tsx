"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { Image as ImageIcon, ImagePlus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@siteinabox/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { formatCssPx, formatCssUrl, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { mediaPathFromValue, publicRendererMediaPath } from "@siteinabox/site-renderer"
import type { Media } from "@/payload-types"
import { fetchTenantMedia, useResolvedMediaTenantId } from "@/components/media/clientMedia"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { useCanvasChromeVisibility } from "../CanvasChromeVisibilityContext"
import { elementPathEq } from "../elementPath"
import type { ElementPath } from "../elementPath"
import { isCustomerPreviewView, isReadOnlyView } from "../canvasView"
import { useTranslations } from "next-intl"
import { cn } from "@siteinabox/ui/lib/utils"

export interface InlineImageProps {
  value: any
  onChange: (next: any) => void
  alt?: string | null
  className?: string
  /** Controls how the image is rendered. img = inline foreground; div =
   *  background-image on a div (for hero-style backdrops). Defaults to img. */
  as?: "img" | "div"
  /** Optional tenant id passthrough — MediaGrid/Uploader resolve from /api/users/me by default. */
  tenantId?: number | string
  /** Optional visible affordance when the image has not been selected yet. */
  emptyLabel?: string
  /** Optional class for the empty-state affordance. Falls back to className. */
  emptyClassName?: string
  /** Optional replacement label for compact image chrome. */
  changeLabel?: string
  /** Optional remove label for compact image chrome. */
  removeLabel?: string
  /** Render compact admin chrome for selecting/removing this image. */
  chrome?: "none" | "overlay"
  /** Whether clicking the rendered image opens the picker in canvas edit mode.
   *  Background images can set this false so only toolbar/inspector chrome
   *  launches media selection. */
  openOnImageClick?: boolean
  /** Stable address of this element within the page block. When provided and
   *  the canvas is in sidebar view, clicking selects this path instead of
   *  opening the media picker. */
  elementPath?: ElementPath
}

const resolveUrl = (v: any, tenantId?: number | string | null): string | null => {
  if (!v) return null
  const resolveTenantMediaPath = (value: string): string | null => {
    const mediaPath = mediaPathFromValue(value)
    if (tenantId != null && mediaPath) return publicRendererMediaPath(String(tenantId), mediaPath)
    return null
  }
  if (typeof v === "string") return resolveTenantMediaPath(v) ?? v
  if (typeof v === "object") {
    if (typeof v.url === "string") return resolveTenantMediaPath(v.url) ?? v.url
    if (typeof v.filename === "string") {
      const mediaPath = mediaPathFromValue(v.filename)
      if (tenantId != null && mediaPath) return publicRendererMediaPath(String(tenantId), mediaPath) ?? `/media/${v.filename}`
      return `/media/${v.filename}`
    }
  }
  return null
}

type AnchorRect = Pick<DOMRect, "left" | "right" | "top">

function useFixedAnchorRect(
  node: HTMLElement | null,
  enabled = true,
): AnchorRect | null {
  const [rect, setRect] = React.useState<AnchorRect | null>(null)

  React.useLayoutEffect(() => {
    if (!enabled || !node) {
      setRect(null)
      return
    }

    let frame: number | null = null
    const measure = () => {
      frame = null
      if (!node.isConnected) {
        setRect(null)
        return
      }
      const next = node.getBoundingClientRect()
      setRect({
        left: next.left,
        right: next.right,
        top: next.top,
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
  }, [enabled, node])

  return rect
}

export const InlineImage: React.FC<InlineImageProps> = ({
  value,
  onChange,
  alt,
  className,
  as = "img",
  tenantId,
  emptyLabel,
  emptyClassName,
  changeLabel,
  removeLabel,
  chrome = "none",
  openOnImageClick = true,
  elementPath,
}) => {
  const t = useTranslations("editor")
  const { view, selected, select } = useCanvasSelection()
  const canvasChrome = useCanvasChromeVisibility()
  const isCustomerPreview = isCustomerPreviewView(view)
  const isReadOnly = isReadOnlyView(view)
  const isSelected = !isCustomerPreview && isReadOnly && elementPath != null && elementPathEq(selected, elementPath)
  const [chromeAnchorNode, setChromeAnchorNode] = React.useState<HTMLElement | null>(null)
  const setChromeAnchorRef = React.useCallback((node: HTMLElement | null) => {
    setChromeAnchorNode(node)
  }, [])

  const [open, setOpen] = React.useState(false)
  const resolvedTenantId = useResolvedMediaTenantId(tenantId)
  const [items, setItems] = React.useState<Media[]>([])

  const reload = React.useCallback(async () => {
    if (resolvedTenantId == null) return
    setItems(await fetchTenantMedia(resolvedTenantId))
  }, [resolvedTenantId])

  React.useEffect(() => { if (open) void reload() }, [open, reload])

  const handleSurfaceClick = (e: React.MouseEvent) => {
    if (isReadOnly) {
      e.preventDefault()
      e.stopPropagation()
      if (elementPath != null) select(elementPath)
      return
    }
    e.stopPropagation()
    if (!openOnImageClick) return
    setOpen(true)
  }
  const handleChromeClick = (e: React.MouseEvent) => {
    if (isReadOnly) {
      e.preventDefault()
      e.stopPropagation()
      if (elementPath != null) select(elementPath)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }
  const url = resolveUrl(value, resolvedTenantId)
  const showOverlayChrome = chrome === "overlay"
  const surfaceIsEditable = !isCustomerPreview && (openOnImageClick || isReadOnly)
  const showHoverOverlayChrome = !isCustomerPreview && showOverlayChrome && view !== "mobile" && canvasChrome.visible
  const showDefaultChrome = !showOverlayChrome && className == null
  const chromeRect = useFixedAnchorRect(chromeAnchorNode, showHoverOverlayChrome)
  const actionLabel = url ? (changeLabel ?? t("replace")) : (emptyLabel ?? t("chooseImage"))
  const backgroundImage = formatCssUrl(url)
  const backgroundStyle = useCspStyleRule(
    "inline-image-background",
    url && as === "div" && backgroundImage
      ? `background-image:${backgroundImage};background-size:cover;background-position:center;`
      : null,
  )
  const overlayPosition = useCspStyleRule(
    "inline-image-chrome",
    showHoverOverlayChrome && chromeRect
      ? `left:${formatCssPx(Math.max(8, chromeRect.left + 8))};top:${formatCssPx(Math.max(8, chromeRect.top + 8))};`
      : null,
  )
  const handlePick = (media: Media) => { onChange(media); setOpen(false) }
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isReadOnly) {
      if (elementPath != null) select(elementPath)
      return
    }
    onChange(null)
  }
  const overlayChrome = showHoverOverlayChrome && chromeRect && typeof document !== "undefined"
    ? createPortal(
        <TooltipProvider delayDuration={250}>
          {overlayPosition.styleElement}
          <div
            data-siab-canvas-chrome="inline-image"
            className={`${overlayPosition.className} fixed z-[19] inline-flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 text-foreground shadow-sm backdrop-blur-sm`}
            onMouseEnter={() => canvasChrome.setVisible(true)}
            onMouseLeave={() => canvasChrome.setVisible(false)}
            onFocus={() => canvasChrome.setVisible(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                canvasChrome.setVisible(false)
              }
            }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={actionLabel}
                  className="rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={handleChromeClick}
                >
                  {url ? <ImageIcon className="size-4" /> : <ImagePlus className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{actionLabel}</TooltipContent>
            </Tooltip>
            {url && !isReadOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={removeLabel ?? t("removeImage")}
                    className="rounded-sm text-muted-foreground hover:bg-destructive hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={handleRemove}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{removeLabel ?? t("removeImage")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>,
        document.body,
      )
    : null

  return (
    <>
      {url && as === "img" && (
        <img
          ref={setChromeAnchorRef as React.RefCallback<HTMLImageElement>}
          src={url}
          alt={alt ?? ""}
          className={[surfaceIsEditable ? "rt-click-edit cursor-pointer" : undefined, className].filter(Boolean).join(" ")}
          data-rt-selected={isSelected ? "true" : undefined}
          onClick={surfaceIsEditable ? handleSurfaceClick : undefined}
        />
      )}
      {url && as === "div" && (
        <>
          {backgroundStyle.styleElement}
          <div
            ref={setChromeAnchorRef as React.RefCallback<HTMLDivElement>}
            className={[surfaceIsEditable ? "rt-click-edit cursor-pointer" : undefined, backgroundStyle.className, className].filter(Boolean).join(" ")}
            onClick={surfaceIsEditable ? handleSurfaceClick : undefined}
            aria-label={alt ?? "image"}
            role="img"
            data-rt-selected={isSelected ? "true" : undefined}
          />
        </>
      )}
      {!url && showOverlayChrome && (
        <span
          ref={setChromeAnchorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 block"
          data-rt-selected={isSelected ? "true" : undefined}
        />
      )}
      {!url && showDefaultChrome && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleChromeClick}
        >
          <ImagePlus className="size-4" />
          {emptyLabel ?? t("chooseImage")}
        </Button>
      )}
      {!url && emptyLabel && !showOverlayChrome && !showDefaultChrome && (
        <button
          type="button"
          className={[surfaceIsEditable ? "rt-click-edit cursor-pointer" : undefined, emptyClassName ?? className].filter(Boolean).join(" ")}
          data-rt-selected={isSelected ? "true" : undefined}
          onClick={surfaceIsEditable ? handleSurfaceClick : undefined}
        >
          {emptyLabel}
        </button>
      )}
      {url && showDefaultChrome && !isReadOnly && (
        <TooltipProvider delayDuration={250}>
          <div className="mt-2 flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={changeLabel ?? t("replace")}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={handleChromeClick}
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{changeLabel ?? t("replace")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={removeLabel ?? t("removeImage")}
                  className="text-muted-foreground hover:bg-destructive hover:text-white"
                  onClick={handleRemove}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{removeLabel ?? t("removeImage")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
      {overlayChrome}
      {!isReadOnly && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-full sm:w-[640px] sm:max-w-[640px] overflow-y-auto p-0"
          >
            {/* Header: title only. Default shadcn close-X sits absolute top-4 right-4. */}
            <SheetHeader className="px-6 pt-6 pb-4">
              <SheetTitle className="text-base font-semibold">{t("pickImage")}</SheetTitle>
            </SheetHeader>

            {/* Action toolbar: Upload sits in its own row with breathing room.
                pr-14 reserves space for the absolute close-X so the uploader
                never visually collides with it. */}
            {resolvedTenantId != null && (
              <div className="flex items-center gap-2 border-y border-border bg-muted/30 px-6 py-3 pr-14">
                <MediaUploader tenantId={resolvedTenantId} onUploaded={(m) => { void reload(); handlePick(m) }} />
              </div>
            )}

            {resolvedTenantId != null && (
              <div className="px-6 py-6">
                <MediaGrid items={items} selectable onSelect={handlePick} />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
