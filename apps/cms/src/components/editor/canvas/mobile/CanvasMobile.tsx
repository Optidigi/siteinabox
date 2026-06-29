"use client"
import * as React from "react"
import { useCanvasBlocks } from "@/components/editor/canvas/useCanvasBlocks"
import { MobileSectionList } from "@/components/editor/canvas/mobile/mobile-section-list"
import { MobileSectionEdit } from "@/components/editor/canvas/mobile/mobile-section-edit"
import { MobilePageSettings } from "@/components/editor/canvas/mobile/mobile-page-settings"
import { MobileSeoSettings } from "@/components/editor/canvas/mobile/mobile-seo-settings"
import { CanvasSelectionProvider } from "@/components/editor/canvas/CanvasSelectionContext"
import { MobileEditorProvider, useMobileEditor } from "@/components/editor/canvas/mobile/MobileEditorContext"
import type { ElementPath } from "@/components/editor/canvas/elementPath"
import type { CanvasModeProps } from "@/components/editor/canvas/CanvasMode"
import { toCssVars } from "@/lib/theme/toCssVars"
import { useMobileSubview } from "@/lib/editor/useMobileSubview"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"
import { resolveLegacyTenant } from "@siteinabox/site-renderer"

export const CanvasMobile: React.FC<CanvasModeProps> = (props) => {
  return (
    <MobileEditorProvider>
      <CanvasMobileInner {...props} />
    </MobileEditorProvider>
  )
}

const CanvasMobileInner: React.FC<CanvasModeProps> = ({
  manifest,
  tenantCss,
  dangerZone: _dangerZone,
  seoCard: _seoCard,
  theme,
  rendererSettings,
  tenantSlug,
  tenantDomain,
  reorderBlocks,
  deleteBlock,
  duplicateBlock,
  pageTitle,
  onDeletePage,
  renderMobileList,
  renderMobileSectionEdit,
  renderMobileInspector,
  renderMobilePageSettings,
  renderMobileSeoSettings,
}) => {
  const { state, setSelected, clearSelection } = useMobileEditor()
  const { blocks, activeIndex, setActiveIndex, updateBlock, insertBlockAt } = useCanvasBlocks(manifest)
  const api = { blocks, activeIndex, setActiveIndex, updateBlock, insertBlockAt, reorderBlocks, deleteBlock, duplicateBlock }
  const { view, goto } = useMobileSubview()
  const cspNonce = useCspNonce()
  const legacyTenant = rendererSettings
    ? resolveLegacyTenant({ tenantSlug, domain: tenantDomain, settings: rendererSettings })
    : null

  // Bridge MobileEditorContext.selected → CanvasSelectionContext.select.
  // Inline primitives call `select(path)`; we route it into setSelected so the
  // inspector bar reacts. SetStateAction support: if a primitive passes a
  // functional updater, evaluate it against the current selection.
  const select = React.useCallback((next: React.SetStateAction<ElementPath | null>) => {
    const resolved = typeof next === "function" ? (next as (p: ElementPath | null) => ElementPath | null)(state.selected) : next
    if (resolved == null) clearSelection()
    else setSelected(resolved)
  }, [state.selected, setSelected, clearSelection])

  return (
    <CanvasSelectionProvider value={{ view: "mobile", selected: state.selected, select }}>
      {tenantCss && <style nonce={cspNonce} suppressHydrationWarning data-rt-tenant-css dangerouslySetInnerHTML={{ __html: tenantCss }} />}
      {theme && <style nonce={cspNonce} suppressHydrationWarning data-rt-theme-overrides dangerouslySetInnerHTML={{ __html: toCssVars(theme) }} />}
      {view.kind !== "overview" && (
        <MobileBackPill onBack={() => { clearSelection(); goto({ kind: "overview" }) }} />
      )}

      {view.kind === "overview" && (
        <div className="flex w-full flex-col pb-24">
          <MobileSectionList
            api={api}
            manifest={manifest}
            onOpenSection={(i) => goto({ kind: "section", index: i })}
            pageTitle={pageTitle}
            onOpenPageSettings={() => goto({ kind: "page-settings" })}
            onOpenSeo={() => goto({ kind: "seo" })}
            onDeletePage={onDeletePage}
            renderList={renderMobileList}
          />
        </div>
      )}

      {view.kind === "page-settings" && (
        <div className="fixed inset-0 z-30 flex flex-col bg-background overflow-hidden">
          <MobilePageSettings renderPageSettings={renderMobilePageSettings} />
        </div>
      )}

      {view.kind === "seo" && (
        <div className="fixed inset-0 z-30 flex flex-col bg-background overflow-hidden">
          <MobileSeoSettings renderSeoSettings={renderMobileSeoSettings} />
        </div>
      )}

      {view.kind === "section" && (
        <div className="fixed inset-0 z-30 flex flex-col bg-background overflow-hidden">
          <MobileSectionEdit
            api={api}
            index={view.index}
            manifest={manifest}
            theme={theme}
            legacyTenant={legacyTenant}
            onBack={() => { clearSelection(); goto({ kind: "overview" }) }}
            onPrev={view.index > 0 ? () => { clearSelection(); goto({ kind: "section", index: view.index - 1 }, { replace: true }) } : undefined}
            onNext={view.index < blocks.length - 1 ? () => { clearSelection(); goto({ kind: "section", index: view.index + 1 }, { replace: true }) } : undefined}
            onJumpToSection={(i) => { clearSelection(); goto({ kind: "section", index: i }, { replace: true }) }}
            renderSectionEdit={renderMobileSectionEdit}
            renderInspector={renderMobileInspector}
          />
        </div>
      )}
    </CanvasSelectionProvider>
  )
}
