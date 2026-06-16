"use client"
import * as React from "react"
import { useId } from "react"
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
import { ChevronRight, GripVertical, Plus } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { BlockTypePicker } from "@/components/editor/canvas/chrome/block-type-picker"
import { useBlockPresets } from "@/components/editor/canvas/BlockPresetsContext"
import { blockBySlug } from "@/blocks/registry"
import type { CanvasBlocksApi } from "@/components/editor/canvas/useCanvasBlocks"
import type { RtManifest } from "@/lib/richText/manifest"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface MobileSectionListProps {
  api: Pick<CanvasBlocksApi, "blocks" | "reorderBlocks" | "insertBlockAt">
  manifest: RtManifest
  onOpenSection: (i: number) => void
  pageTitle: string
  onOpenPageSettings: () => void
  onOpenSeo: () => void
  onDeletePage: () => void
  renderList?: (context: MobileSectionListSlotContext) => React.ReactNode
}

export interface MobileSectionListSlotContext {
  blocks: any[]
  isEmpty: boolean
  pageTitle: string
  openAddSection: () => void
  header: React.ReactNode
  sectionsHeader: React.ReactNode
  emptyState: React.ReactNode
  sectionCards: React.ReactNode
  addSectionButton: React.ReactNode
  pageActionsTitle: React.ReactNode
  pageRows: React.ReactNode
  blockTypePicker: React.ReactNode
}

export interface MobileSectionListLayoutProps {
  header: React.ReactNode
  sectionsHeader: React.ReactNode
  emptyState: React.ReactNode
  sectionCards: React.ReactNode
  addSectionButton: React.ReactNode
  pageActionsTitle: React.ReactNode
  pageRows: React.ReactNode
  blockTypePicker: React.ReactNode
}

interface SortableCardProps {
  id: string
  block: any
  index: number
  onOpen: () => void
}

const SortableSectionCard: React.FC<SortableCardProps> = ({ id, block, index, onOpen }) => {
  const t = useTranslations("editor")
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "mobile-section-sortable-card",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )
  const cfg = blockBySlug[block?.blockType]
  const label = cfg
    ? (typeof cfg.labels?.singular === "string" ? cfg.labels.singular : cfg.slug)
    : (block?.blockType ?? "?")
  const preview = cfg?.summary ? cfg.summary(block) : undefined
  const Icon = cfg?.icon

  return (
    <>
      {sortableStyle.styleElement}
      <div
        ref={setNodeRef}
        className={cn(
          sortableStyle.className,
          "rounded-lg border border-border bg-background flex items-center gap-2 min-h-[64px] transition-colors hover:bg-accent/50",
          isDragging && "opacity-50",
        )}
        data-mobile-section-card
        data-section-index={index}
      >
      <button
        type="button"
        aria-label={t("dragToReorder")}
        className="flex h-11 w-11 shrink-0 items-center justify-center cursor-grab rounded-sm text-muted-foreground hover:bg-muted active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-5" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit ${label} section`}
        className="flex flex-1 items-center gap-3 min-w-0 py-3 pr-3 text-left"
      >
        {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm text-foreground leading-snug">{label}</div>
          {preview && (
            <div className="truncate text-xs text-muted-foreground leading-snug mt-0.5">{preview}</div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      </div>
    </>
  )
}

export const MobileSectionList: React.FC<MobileSectionListProps> = ({
  api,
  onOpenSection,
  pageTitle,
  onOpenPageSettings,
  onOpenSeo,
  onDeletePage,
  renderList,
}) => {
  const t = useTranslations("editor")
  const { blocks, reorderBlocks, insertBlockAt } = api
  const presetsCtx = useBlockPresets()
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const dndId = useId()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = React.useMemo(() => blocks.map((_, i) => String(i)), [blocks.length])

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = Number(active.id)
    const to = Number(over.id)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    reorderBlocks(from, to)
  }

  const openAddSection = () => setPickerOpen(true)
  const header = (
    <header className="flex items-center justify-between gap-3 pb-1">
      <h1 className="truncate text-base font-semibold text-foreground" data-mobile-page-title>
        {pageTitle || t("untitledPage")}
      </h1>
    </header>
  )
  const sectionsHeader = (
    <div className="flex items-center justify-between">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{t("sections")}</h2>
      <span className="text-[11px] text-muted-foreground">{t("dragToReorder")}</span>
    </div>
  )
  const emptyState = blocks.length === 0 ? (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {t("noSectionsYet")}
    </div>
  ) : null
  const sectionCards = (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {blocks.map((block, i) => (
            <SortableSectionCard
              key={block.id ?? i}
              id={String(i)}
              block={block}
              index={i}
              onOpen={() => onOpenSection(i)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
  const addSectionButton = (
    <Button
      type="button"
      variant="default"
      className="w-full mt-1 gap-2"
      onClick={openAddSection}
      data-mobile-add-section
    >
      <Plus className="size-4" /> {t("addSection")}
    </Button>
  )
  const pageActionsTitle = (
    <h2 className="text-xs uppercase tracking-wide text-muted-foreground pb-1">{t("page")}</h2>
  )
  const pageRows = (
    <>
      <PageRow label={t("pageSettings")} onClick={onOpenPageSettings} data-test="mobile-row-page-settings" />
      <PageRow label="SEO" onClick={onOpenSeo} data-test="mobile-row-seo" />
      <PageRow label={t("deletePage")} onClick={onDeletePage} variant="destructive" data-test="mobile-row-delete" />
    </>
  )
  const blockTypePicker = (
    <BlockTypePicker
      {...presetsCtx}
      controlledOpen={pickerOpen}
      onOpenChange={setPickerOpen}
      onAdd={(slug, _atIndex, seed) => {
        insertBlockAt(blocks.length, slug, seed)
        setPickerOpen(false)
      }}
    />
  )

  if (renderList) {
    return (
      <>
        {renderList({
          blocks,
          isEmpty: blocks.length === 0,
          pageTitle,
          openAddSection,
          header,
          sectionsHeader,
          emptyState,
          sectionCards,
          addSectionButton,
          pageActionsTitle,
          pageRows,
          blockTypePicker,
        })}
      </>
    )
  }

  return (
    <MobileSectionListLayout
      header={header}
      sectionsHeader={sectionsHeader}
      emptyState={emptyState}
      sectionCards={sectionCards}
      addSectionButton={addSectionButton}
      pageActionsTitle={pageActionsTitle}
      pageRows={pageRows}
      blockTypePicker={blockTypePicker}
    />
  )
}

export const MobileSectionListLayout: React.FC<MobileSectionListLayoutProps> = ({
  header,
  sectionsHeader,
  emptyState,
  sectionCards,
  addSectionButton,
  pageActionsTitle,
  pageRows,
  blockTypePicker,
}) => {
  const t = useTranslations("editor")
  return (
    <div className="flex flex-col gap-4 p-4" data-mobile-section-list>
      {header}

      <section className="space-y-2" aria-label={t("sections")}>
        {sectionsHeader}
        {emptyState}
        {sectionCards}
        {addSectionButton}
      </section>

      <section className="space-y-1" aria-label={t("pageActions")}>
        {pageActionsTitle}
        {pageRows}
      </section>

      {blockTypePicker}
    </div>
  )
}

const PageRow: React.FC<{
  label: string
  onClick: () => void
  variant?: "default" | "destructive"
  "data-test"?: string
}> = ({ label, onClick, variant = "default", ...attrs }) => (
  <button
    type="button"
    onClick={onClick}
    data-mobile-page-row
    data-test={attrs["data-test"]}
    className={[
      "flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-3 text-left text-sm transition-colors min-h-[48px]",
      variant === "destructive" ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent/50",
    ].join(" ")}
  >
    <span>{label}</span>
    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
  </button>
)
