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
import { MobileFloatingPill } from "@/components/common/mobile-floating-pill"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { blockBySlug } from "@/blocks/registry"
import { resolveBlockLabel } from "@/lib/editor/blockLabels"
import { blockWireId } from "@/lib/editor/ensureBlockIds"
import type { MobileBlocksApi } from "@/components/editor/mobile/MobileBlocksApi"
import type { ElementPath } from "@/components/editor/elementPath"
import {
  MobileEditorProvider,
  useMobileEditor,
} from "@/components/editor/mobile/MobileEditorContext"
import { MobileSectionList } from "@/components/editor/mobile/mobile-section-list"
import { MobileInspectorBar } from "@/components/editor/mobile/mobile-inspector-bar"
import { MobilePageSettings } from "@/components/editor/mobile/mobile-page-settings"
import { MobileSeoSettings } from "@/components/editor/mobile/mobile-seo-settings"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useTranslations } from "next-intl"

type MobileEditorScreen =
  | { type: "list" }
  | { type: "section"; index: number }
  | { type: "page-settings" }
  | { type: "seo" }

export interface MobileFrameEditorProps {
  api: Pick<MobileBlocksApi, "blocks" | "reorderBlocks" | "insertBlockAt" | "deleteBlock" | "duplicateBlock">
  manifest: RtManifest
  theme?: ThemeTokens | null
  pageTitle: string
  selected: ElementPath | null
  onSelectElement: React.Dispatch<React.SetStateAction<ElementPath | null>>
  onFocusedSectionChange: (index: number | null) => void
  focusedFrame: React.ReactNode
  onDeletePage: () => void
}

export function MobileFrameEditor(props: MobileFrameEditorProps) {
  return (
    <MobileEditorProvider>
      <MobileFrameEditorInner {...props} />
    </MobileEditorProvider>
  )
}

function MobileFrameEditorInner({
  api,
  manifest,
  theme,
  pageTitle,
  selected,
  onSelectElement,
  onFocusedSectionChange,
  focusedFrame,
  onDeletePage,
}: MobileFrameEditorProps) {
  const [screen, setScreen] = React.useState<MobileEditorScreen>({ type: "list" })
  const { setSelected, clearSelection } = useMobileEditor()

  const openSection = React.useCallback((index: number) => {
    setScreen({ type: "section", index })
    window.scrollTo({ top: 0 })
    onFocusedSectionChange(index)
    onSelectElement(null)
    clearSelection()
  }, [clearSelection, onFocusedSectionChange, onSelectElement])

  const openList = React.useCallback(() => {
    setScreen({ type: "list" })
    window.scrollTo({ top: 0 })
    onFocusedSectionChange(null)
    onSelectElement(null)
    clearSelection()
  }, [clearSelection, onFocusedSectionChange, onSelectElement])

  React.useEffect(() => {
    if (screen.type !== "section") return
    if (api.blocks[screen.index]) return
    openList()
  }, [api.blocks, openList, screen])

  React.useEffect(() => {
    if (screen.type !== "section") {
      clearSelection()
      return
    }
    if (!selected || selected.blockIndex !== screen.index) {
      clearSelection()
      return
    }
    // Keep MobileEditorContext snap/drill in sync with core.selected, including
    // same-block field deep-links from the canvas.
    setSelected(selected)
  }, [clearSelection, screen, selected, setSelected])

  if (screen.type === "page-settings") {
    return (
      <MobileSettingsScreen onBack={() => setScreen({ type: "list" })}>
        <MobilePageSettings />
      </MobileSettingsScreen>
    )
  }

  if (screen.type === "seo") {
    return (
      <MobileSettingsScreen onBack={() => setScreen({ type: "list" })}>
        <MobileSeoSettings />
      </MobileSettingsScreen>
    )
  }

  if (screen.type === "section") {
    const index = screen.index
    const block = api.blocks[index]
    if (!block) return null
    return (
      <MobileFocusedSection
        api={api}
        index={index}
        block={block}
        manifest={manifest}
        theme={theme}
        focusedFrame={focusedFrame}
        onBack={openList}
        onPrev={index > 0 ? () => openSection(index - 1) : undefined}
        onNext={index < api.blocks.length - 1 ? () => openSection(index + 1) : undefined}
        onJumpToSection={openSection}
      />
    )
  }

  return (
    <MobileSectionList
      api={api}
      manifest={manifest}
      pageTitle={pageTitle}
      onOpenSection={openSection}
      onOpenPageSettings={() => setScreen({ type: "page-settings" })}
      onOpenSeo={() => setScreen({ type: "seo" })}
      onDeletePage={onDeletePage}
    />
  )
}

function MobileSettingsScreen({
  children,
  onBack,
}: {
  children: React.ReactNode
  onBack: () => void
}) {
  const t = useTranslations("editor")
  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed left-3 top-16 z-40 size-10 rounded-full"
        onClick={onBack}
        aria-label={t("back")}
      >
        <ChevronLeft className="size-5" />
      </Button>
      {children}
    </div>
  )
}

function MobileFocusedSection({
  api,
  index,
  block,
  manifest,
  theme,
  focusedFrame,
  onBack,
  onPrev,
  onNext,
  onJumpToSection,
}: {
  api: Pick<MobileBlocksApi, "blocks" | "deleteBlock" | "duplicateBlock">
  index: number
  block: Record<string, unknown>
  manifest: RtManifest
  theme?: ThemeTokens | null
  focusedFrame: React.ReactNode
  onBack: () => void
  onPrev?: () => void
  onNext?: () => void
  onJumpToSection: (index: number) => void
}) {
  const t = useTranslations("editor")
  const tLabels = useTranslations("editor.blockLabels")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [trashPillVisible, setTrashPillVisible] = React.useState(true)
  const { state: editorState } = useMobileEditor()
  const isInspectorIdle = editorState.selected == null && editorState.drillStack.length === 0
  const cfg = blockBySlug[String(block.blockType)]
  const label = resolveBlockLabel(String(block.blockType), manifest, (slug) =>
    tLabels.has(slug as never) ? tLabels(slug as never) : undefined,
  )

  React.useEffect(() => {
    let frame = 0
    const syncTrashVisibility = () => {
      frame = 0
      setTrashPillVisible(window.scrollY <= 24)
    }
    const onScroll = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(syncTrashVisibility)
    }

    syncTrashVisibility()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div data-mobile-frame-section-edit className="-mx-4 flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <header className="sticky top-0 z-30 flex min-w-0 items-center justify-center border-b border-border bg-background px-16 py-3">
        <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-11 rounded-full"
            onClick={onPrev}
            disabled={!onPrev}
            aria-label={t("previousSection")}
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
              >
                <span className="truncate">{label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="min-w-[14rem]"
              data-siab-editor-ui

            >
              {api.blocks.map((entry, i) => {
                const config = blockBySlug[String(entry?.blockType)]
                const itemLabel = resolveBlockLabel(String(entry?.blockType ?? ""), manifest, (slug) =>
                  tLabels.has(slug as never) ? tLabels(slug as never) : undefined,
                )
                const Icon = config?.icon
                return (
                  <DropdownMenuItem
                    key={blockWireId(entry as Record<string, unknown>) ?? i}
                    onClick={() => onJumpToSection(i)}
                    className={i === index ? "bg-accent" : undefined}
                  >
                    {Icon && <Icon className="mr-2 size-4 text-muted-foreground" aria-hidden />}
                    <span>{itemLabel}</span>
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
            className="size-11 rounded-full"
            onClick={onNext}
            disabled={!onNext}
            aria-label={t("nextSection")}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>
      <div className="min-h-0">
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {t("mobilePreviewHint")}
        </p>
        {focusedFrame}
      </div>
      <MobileInspectorBar block={block} blockIndex={index} manifest={manifest} theme={theme} />
      <MobileBackPill onBack={onBack} />
      {isInspectorIdle && (
        <MobileFloatingPill
          position="top-right"
          offset="3.75rem"
          visible={trashPillVisible}
          icon={<Trash2 className="h-5 w-5" aria-hidden />}
          onClick={() => setDeleteOpen(true)}
          ariaLabel={t("deleteSection")}
          variant="destructive"
          dataAttrs={{ "data-mobile-trash-pill": "" }}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteSectionTitle")}
        description={t("deleteBlockDescription", { label })}
        confirmLabel={t("deleteSection")}
        variant="destructive"
        onConfirm={async () => {
          api.deleteBlock(index)
          onBack()
        }}
      />
    </div>
  )
}
