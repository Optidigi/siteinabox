"use client"
import * as React from "react"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { Button } from "@siteinabox/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CanvasBlockRenderer } from "@/components/editor/canvas/CanvasBlockRenderer"
import { MobileInspectorBar, type MobileInspectorBarProps } from "@/components/editor/canvas/mobile/mobile-inspector-bar"
import { MobileFloatingPill } from "@/components/common/mobile-floating-pill"
import { useMobileEditor } from "@/components/editor/canvas/mobile/MobileEditorContext"
import { blockBySlug } from "@/blocks/registry"
import type { CanvasBlocksApi } from "@/components/editor/canvas/useCanvasBlocks"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useTranslations } from "next-intl"


export interface MobileSectionEditProps {
  api: Pick<CanvasBlocksApi, "blocks" | "updateBlock" | "deleteBlock" | "duplicateBlock" | "reorderBlocks">
  index: number
  manifest: RtManifest
  theme?: ThemeTokens | null
  tenantId?: number | string | null
  tenantRendererKey?: "amicare" | null
  onBack: () => void
  onPrev?: () => void
  onNext?: () => void
  onJumpToSection: (i: number) => void
  renderSectionEdit?: (context: MobileSectionEditSlotContext) => React.ReactNode
  renderInspector?: MobileInspectorBarProps["renderInspector"]
}

export interface MobileSectionEditSlotContext {
  block: any
  index: number
  label: string
  isIdle: boolean
  header: React.ReactNode
  canvas: React.ReactNode
  inspectorBar: React.ReactNode
  trashPill: React.ReactNode
  deleteDialog: React.ReactNode
}

export interface MobileSectionEditLayoutProps {
  header: React.ReactNode
  canvas: React.ReactNode
  inspectorBar: React.ReactNode
  trashPill?: React.ReactNode
  deleteDialog?: React.ReactNode
}

/**
 * Focused section view for mobile canvas mode.
 *
 * Top chrome: ‹ Back · prev/next chevrons · section-name dropdown · save Badge.
 * Body: the single rendered section, full mobile width.
 * Bottom: MobileInspectorBar (vaul) — hidden when idle, opens on selection.
 *
 * Selection state lives in MobileEditorContext (legacy same-DOM mobile editor).
 */
export const MobileSectionEdit: React.FC<MobileSectionEditProps> = ({
  api,
  index,
  manifest,
  theme,
  tenantId,
  tenantRendererKey,
  onBack,
  onPrev,
  onNext,
  onJumpToSection,
  renderSectionEdit,
  renderInspector,
}) => {
  const t = useTranslations("editor")
  const { blocks, updateBlock, deleteBlock } = api
  const block = blocks[index]
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const { state: editorState } = useMobileEditor()
  const isIdle = editorState.selected == null && editorState.drillStack.length === 0

  // Guard: if the block was deleted from elsewhere (e.g. trash icon in
  // the inspector bar), navigate back. We track first-seen via a ref so
  // the RHF re-hydration transient (block briefly undefined on mount)
  // doesn't pop the user back to overview.
  const blockEverExistedRef = React.useRef(false)
  React.useEffect(() => {
    if (block) {
      blockEverExistedRef.current = true
      return
    }
    if (blockEverExistedRef.current) onBack()
  }, [block, onBack])

  if (!block) return null

  const cfg = blockBySlug[block?.blockType]
  const label = cfg
    ? (typeof cfg.labels?.singular === "string" ? cfg.labels.singular : cfg.slug)
    : (block?.blockType ?? "?")

  const header = (
    <header className="sticky top-0 z-30 flex min-w-0 items-center justify-center border-b border-border bg-background px-16 py-3">
      <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-11 rounded-full shrink-0"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label={t("previousSection")}
          data-mobile-prev
        >
          <ChevronLeft className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-0 max-w-[11rem] rounded-full border-border bg-muted px-4 font-medium shadow-sm"
              aria-label={t("switchSection", { label })}
              data-mobile-section-name
            >
              <span className="truncate">{label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="min-w-[14rem]"
            data-siab-editor-ui
            data-siab-canvas-chrome="mobile-section-menu"
          >
            {blocks.map((b, i) => {
              const c = blockBySlug[b?.blockType]
              const l = c ? (typeof c.labels?.singular === "string" ? c.labels.singular : c.slug) : b?.blockType
              const Icon = c?.icon
              return (
                <DropdownMenuItem
                  key={b.id ?? i}
                  onClick={() => onJumpToSection(i)}
                  className={i === index ? "bg-accent" : undefined}
                >
                  {Icon && <Icon className="mr-2 size-4 text-muted-foreground" aria-hidden />}
                  <span>{l}</span>
                  <span className="ml-2 text-xs text-muted-foreground">#{i + 1}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-11 rounded-full shrink-0"
          onClick={onNext}
          disabled={!onNext}
          aria-label={t("nextSection")}
          data-mobile-next
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </header>
  )
  const canvas = (
      <div
        data-mobile-canvas
        className="flex-1 min-h-0 overflow-y-auto touch-pan-x touch-pan-y"
        onClickCapture={(e) => {
          if ((e.target as HTMLElement | null)?.closest("a[href]")) e.preventDefault()
        }}
      >
        <div
          className={tenantRendererKey === "amicare" ? "site-renderer site-renderer--tenant site-renderer--tenant-amicare" : undefined}
          data-siab-site-renderer={tenantRendererKey === "amicare" ? "true" : undefined}
          data-tenant-renderer={tenantRendererKey === "amicare" ? "amicare" : undefined}
        >
          <div className="rt-canvas w-full" data-rt-view="mobile" data-rt-mode={theme?.mode ?? "light"}>
            <div className="site-frame-root">
              <CanvasBlockRenderer
                block={block}
                index={index}
                isActive
                manifest={manifest}
                onActivate={() => {}}
                onUpdate={updateBlock(index)}
                tenantId={tenantId}
                tenantRendererKey={tenantRendererKey}
              />
            </div>
          </div>
        </div>
      </div>
  )
  const inspectorBar = (
      <MobileInspectorBar
        block={block}
        manifest={manifest}
        theme={theme}
        renderInspector={renderInspector}
      />
  )
  const trashPill = isIdle ? (
        <MobileFloatingPill
          position="bottom-right"
          icon={<Trash2 className="h-5 w-5" aria-hidden />}
          onClick={() => setDeleteOpen(true)}
          ariaLabel={t("deleteSection")}
          variant="destructive"
          dataAttrs={{ "data-mobile-trash-pill": "" }}
        />
  ) : null
  const deleteDialog = (
    <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteSectionTitle")}
        description={t("deleteBlockDescription", { label })}
        confirmLabel={t("deleteSection")}
        variant="destructive"
        onConfirm={async () => {
          deleteBlock(index)
          onBack()
        }}
      />
  )

  if (renderSectionEdit) {
    return (
      <>
        {renderSectionEdit({
          block,
          index,
          label,
          isIdle,
          header,
          canvas,
          inspectorBar,
          trashPill,
          deleteDialog,
        })}
      </>
    )
  }

  return (
    <MobileSectionEditLayout
      header={header}
      canvas={canvas}
      inspectorBar={inspectorBar}
      trashPill={trashPill}
      deleteDialog={deleteDialog}
    />
  )
}

export const MobileSectionEditLayout: React.FC<MobileSectionEditLayoutProps> = ({
  header,
  canvas,
  inspectorBar,
  trashPill,
  deleteDialog,
}) => (
  <div data-mobile-section-edit className="flex h-full min-h-0 flex-col">
    {header}
    {canvas}
    {inspectorBar}
    {trashPill}
    {deleteDialog}
  </div>
)
