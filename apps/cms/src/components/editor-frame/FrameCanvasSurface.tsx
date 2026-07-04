"use client"
import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
  type IframeEditorMobileMode,
  type IframeEditorSelection,
} from "@siteinabox/contracts/iframe-editor"
import { CanvasSurface } from "@/components/editor/canvas/CanvasSurface"
import { CanvasSelectionProvider } from "@/components/editor/canvas/CanvasSelectionContext"
import { BlockPresetsProvider } from "@/components/editor/canvas/BlockPresetsContext"
import { SiteChromeActionFrame, type SiteChromeSelection, type SiteChromeSelectPoint } from "@/components/editor/canvas/SiteChromePreview"
import { useFrameCanvasBlocks } from "@/components/editor-frame/useFrameCanvasBlocks"
import { elementPathToIframeSelection, iframeSelectionToElementPath } from "@/lib/editor/elementPathBridge"
import type { ElementPath } from "@/components/editor/canvas/elementPath"
import type { RtManifest } from "@/lib/richText/manifest"
import { rendererThemeToCmsTheme } from "@/lib/theme/rendererTheme"
import type { PageEditorFrameView } from "@/components/editor/iframe/PageEditorFrameHost"

export interface FrameCanvasSurfaceProps {
  manifest: RtManifest
  tenantCss: string | null
  view: PageEditorFrameView
  page: Page
  settings: SiteSettings
  theme: ThemeTokenSpec | null
  tenantId: string | number
  tenantSlug?: string | null
  domain?: string | null
  selection: IframeEditorSelection | null
  mobileMode?: IframeEditorMobileMode
  /** Current revision known to the frame; forwarded to `useFrameCanvasBlocks`
   *  for outbound mutation messages. */
  revision: number
  emit: (message: IframeEditorMessage) => void
}

/**
 * Iframe editor-frame counterpart to the shared `CanvasSurface` render body.
 * Wraps the render surface with frame-local selection + block-preset providers
 * instead of the CMS RHF-backed ones: block mutations and selection changes are
 * mirrored optimistically here and echoed to the parent CMS via `postMessage`
 * (`useFrameCanvasBlocks`).
 */
export function FrameCanvasSurface({
  manifest,
  tenantCss,
  view,
  page,
  settings,
  theme,
  tenantId,
  tenantSlug,
  domain,
  selection,
  mobileMode = { mode: "fullPage" },
  revision,
  emit,
}: FrameCanvasSurfaceProps) {
  const pageId = String(page.id ?? page.slug ?? "page")
  const blocksApi = useFrameCanvasBlocks({
    pageId,
    blocks: page.blocks ?? [],
    manifest,
    revision,
    emit,
  })

  const [selected, setSelectedState] = React.useState<ElementPath | null>(() =>
    iframeSelectionToElementPath(selection, blocksApi.blocks),
  )

  React.useEffect(() => {
    setSelectedState(iframeSelectionToElementPath(selection, blocksApi.blocks))
    // Re-derive only when the parent-driven `selection` changes — `select`
    // (below) already keeps `selected` and outbound state in sync for
    // locally-initiated changes, so re-running this on every blocks mirror
    // update would fight with in-flight local selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  const select = React.useCallback<React.Dispatch<React.SetStateAction<ElementPath | null>>>(
    (update) => {
      setSelectedState((prev) => {
        const next = typeof update === "function"
          ? (update as (value: ElementPath | null) => ElementPath | null)(prev)
          : update
        emit({
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "selection.changed",
          messageId: crypto.randomUUID(),
          selection: elementPathToIframeSelection(next, blocksApi.blocks, pageId),
        })
        return next
      })
    },
    [emit, blocksApi.blocks, pageId],
  )

  const cmsTheme = React.useMemo(() => rendererThemeToCmsTheme(theme), [theme])
  const canvasSelectionView = mobileMode.allowInlineEditing === false ? "sidebar" : view
  const forceSharedRendererShell = mobileMode.mode !== "focusedSection"
  const selectedChrome = React.useMemo<SiteChromeSelection | null>(() => {
    const zone = selection?.fieldPath?.[1]
    return zone === "header" || zone === "footer" ? { zone } : null
  }, [selection])
  const selectChrome = React.useCallback((next: SiteChromeSelection, point?: SiteChromeSelectPoint) => {
    emit({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "chrome.select",
      messageId: crypto.randomUUID(),
      selection: { pageId, fieldPath: ["chrome", next.zone] },
      point,
    })
  }, [emit, pageId])
  const requestBlockInspector = React.useCallback((index: number) => {
    const block = blocksApi.blocks[index]
    const blockId = block && typeof block === "object" && "id" in block && typeof block.id === "string"
      ? block.id
      : null
    if (!blockId) return
    emit({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "edit.start",
      messageId: crypto.randomUUID(),
      expectedRevision: revision,
      pageId,
      blockId,
      fieldPath: ["blocks", String(index)],
      mode: "settings",
    })
  }, [blocksApi.blocks, emit, pageId, revision])
  const renderHeaderChrome = React.useCallback((defaultChrome: React.ReactNode) => (
    <SiteChromeActionFrame
      zone="header"
      selected={selectedChrome}
      onSelect={selectChrome}
    >
      {defaultChrome}
    </SiteChromeActionFrame>
  ), [selectChrome, selectedChrome])
  const renderFooterChrome = React.useCallback((defaultChrome: React.ReactNode) => (
    <SiteChromeActionFrame
      zone="footer"
      selected={selectedChrome}
      onSelect={selectChrome}
    >
      {defaultChrome}
    </SiteChromeActionFrame>
  ), [selectChrome, selectedChrome])

  return (
    <CanvasSelectionProvider value={{ view: canvasSelectionView, selected, select }}>
      <BlockPresetsProvider tenantId={tenantId} manifest={manifest}>
        <CanvasSurface
          manifest={manifest}
          tenantCss={tenantCss}
          view={view}
          theme={cmsTheme}
          rendererSettings={settings}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          tenantDomain={domain}
          pageTitle={page.title || "Untitled"}
          blocksApi={blocksApi}
          renderHeaderChrome={renderHeaderChrome}
          renderFooterChrome={renderFooterChrome}
          onOpenBlockInspector={requestBlockInspector}
          focusedBlockId={mobileMode.mode === "focusedSection" ? mobileMode.focusedBlockId : undefined}
          focusedBlockIndex={mobileMode.mode === "focusedSection" ? mobileMode.focusedBlockIndex : undefined}
          showChrome={mobileMode.showChrome}
          showGutters={mobileMode.showGutters}
          allowInlineEditing={mobileMode.allowInlineEditing}
          forceSharedRendererShell={forceSharedRendererShell}
        />
      </BlockPresetsProvider>
    </CanvasSelectionProvider>
  )
}
