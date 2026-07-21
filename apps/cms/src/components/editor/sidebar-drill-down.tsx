"use client"
import { useTranslations } from "next-intl"
import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { ChevronLeft, ChevronRight, GripVertical, MoreVertical, Plus, Settings, Trash2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { BlockTypePicker } from "@/components/editor/block-type-picker"
import { useBlockPresets } from "@/components/editor/BlockPresetsContext"
import { blockBySlug } from "@/blocks/registry"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { BlockFormFields } from "@/components/editor/fields/block-form-fields"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import { isEditorBlock } from "@/lib/editor/editorBlock"
import type { ElementPath } from "@/components/editor/elementPath"
import { resolveBlockLabel } from "@/lib/editor/blockLabels"

type Mode =
  | { kind: "list" }
  | { kind: "block"; blockIndex: number }
  | { kind: "page-settings" }

export interface SidebarDrillDownProps {
  blocks: EditorBlock[]
  selectedBlockIndex: number | null
  /** Full canvas selection path — used to deep-link/highlight inspector fields. */
  selectedPath?: ElementPath | null
  onSelectBlock: (i: number | null) => void
  onReorder: (from: number, to: number) => void
  onDeleteBlock: (i: number) => void
  onDuplicateBlock: (i: number) => void
  onAddBlock: (blockType: string, seed?: Record<string, unknown>) => void
  manifest: RtManifest
  seoCard: React.ReactNode
  dangerZone: React.ReactNode
  theme?: ThemeTokens | null
  renderList?: (context: SidebarListSlotContext) => React.ReactNode
  renderBlockForm?: (context: SidebarBlockFormSlotContext) => React.ReactNode
  renderPageSettings?: (context: SidebarPageSettingsSlotContext) => React.ReactNode
}

export interface SidebarListSlotContext {
  blocks: EditorBlock[]
  isEmpty: boolean
  openPageSettings: () => void
  openAddBlock: () => void
  title: React.ReactNode
  pageSettingsButton: React.ReactNode
  header: React.ReactNode
  emptyState: React.ReactNode
  blockRows: React.ReactNode
  addBlockButton: React.ReactNode
  blockTypePicker: React.ReactNode
  body: React.ReactNode
}

export interface SidebarListLayoutProps {
  header: React.ReactNode
  body: React.ReactNode
}

export interface SidebarBlockFormSlotContext {
  block: EditorBlock
  blockIndex: number
  label: string
  manifest: RtManifest
  theme?: ThemeTokens | null
  onBack: () => void
  onDelete: () => void
  requestDelete: () => void
  backButton: React.ReactNode
  deleteButton: React.ReactNode
  title: React.ReactNode
  fields: React.ReactNode
  deleteDialog: React.ReactNode
}

export interface SidebarBlockFormLayoutProps {
  actions: React.ReactNode
  title: React.ReactNode
  body: React.ReactNode
  deleteDialog?: React.ReactNode
}

export interface SidebarPageSettingsSlotContext {
  onBack: () => void
  title: React.ReactNode
  header: React.ReactNode
  body: React.ReactNode
  footer: React.ReactNode
  backButton: React.ReactNode
  seoCard: React.ReactNode
  dangerZone: React.ReactNode
}

export interface SidebarPageSettingsLayoutProps {
  header: React.ReactNode
  body: React.ReactNode
  footer: React.ReactNode
}

export const SidebarDrillDown: React.FC<SidebarDrillDownProps> = ({
  blocks,
  selectedBlockIndex,
  selectedPath,
  onSelectBlock,
  onReorder,
  onDeleteBlock,
  onDuplicateBlock,
  onAddBlock,
  manifest,
  seoCard,
  dangerZone,
  theme,
  renderList,
  renderBlockForm,
  renderPageSettings,
}) => {
  const t = useTranslations("editor")
  const presetsCtx = useBlockPresets()
  const [addBlockOpen, setAddBlockOpen] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>(
    selectedBlockIndex != null ? { kind: "block", blockIndex: selectedBlockIndex } : { kind: "list" },
  )

  // Sync external selection → mode. Whenever selectedBlockIndex changes
  // (e.g. canvas click on a different block), drill into that block.
  // When it goes null (external deselect), return to the list state.
  React.useEffect(() => {
    if (selectedBlockIndex != null) {
      setMode({ kind: "block", blockIndex: selectedBlockIndex })
    } else if (mode.kind === "block") {
      setMode({ kind: "list" })
    }
  }, [selectedBlockIndex])

  const [activeDragId, setActiveDragId] = React.useState<string | null>(null)

  const dndId = React.useId()
  const ids = React.useMemo(() => blocks.map((_, i) => String(i)), [blocks.length])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = Number(active.id)
    const to = Number(over.id)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    onReorder(from, to)
  }

  // Fallback: if we're in block mode but the block no longer exists, return to list
  const blockForMode = mode.kind === "block" ? blocks[mode.blockIndex] : undefined
  React.useEffect(() => {
    if (mode.kind === "block" && !blockForMode) {
      setMode({ kind: "list" })
    }
  }, [mode, blockForMode])

  let content: React.ReactNode

  if (mode.kind === "list") {
    const openPageSettings = () => setMode({ kind: "page-settings" })
    const openAddBlock = () => setAddBlockOpen(true)
    const title = <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("page")}</h2>
    const pageSettingsButton = (
      <button
        type="button"
        onClick={openPageSettings}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={t("pageSettings")}
      >
        <Settings className="size-3.5" />
      </button>
    )
    const header = (
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        {title}
        {pageSettingsButton}
      </header>
    )
    const emptyState = (
      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
        {t("noBlocksYet")} {t("addFirstBlockHint")}
      </p>
    )
    const blockRows = (
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragEnd={(e) => {
          setActiveDragId(null)
          onDragEnd(e)
        }}
        onDragCancel={() => setActiveDragId(null)}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {blocks.map((block, i) => (
            <BlockListRow
              key={block.id ?? i}
              id={String(i)}
              block={block}
              blockIndex={i}
              manifest={manifest}
              onSelect={() => {
                onSelectBlock(i)
                setMode({ kind: "block", blockIndex: i })
              }}
              onDuplicate={() => onDuplicateBlock(i)}
              onDelete={() => onDeleteBlock(i)}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeDragId != null ? (
            <BlockListRowGhost block={blocks[Number(activeDragId)]} manifest={manifest} />
          ) : null}
        </DragOverlay>
      </DndContext>
    )
    const addBlockButton = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 mt-1"
        onClick={openAddBlock}
      >
        <Plus className="size-3.5" aria-hidden /> {t("addBlock")}
      </Button>
    )
    const blockTypePicker = (
      <BlockTypePicker
        {...presetsCtx}
        controlledOpen={addBlockOpen}
        onOpenChange={setAddBlockOpen}
        onAdd={(slug, _atIndex, seed) => {
          onAddBlock(slug, seed)
          setAddBlockOpen(false)
        }}
      />
    )
    const body = (
      <>
        {blocks.length === 0 ? emptyState : blockRows}
        {/* Add block button lives INSIDE the scrollable list, just below the
            last block row (or below the empty-state hint when no blocks
            exist). Previously it was pinned to a sidebar footer; moving it
            into the scroll area makes the "next-action" affordance sit
            against the existing blocks rather than floating at the bottom
            of the sidebar pane. */}
        {addBlockButton}
        {/* Controlled BlockTypePicker — the list's add button owns its trigger. */}
        {blockTypePicker}
      </>
    )

    if (renderList) {
      content = (
        <>
          {renderList({
            blocks,
            isEmpty: blocks.length === 0,
            openPageSettings,
            openAddBlock,
            title,
            pageSettingsButton,
            header,
            emptyState,
            blockRows,
            addBlockButton,
            blockTypePicker,
            body,
          })}
        </>
      )
    } else {
      content = <SidebarListLayout header={header} body={body} />
    }
  } else if (mode.kind === "block") {
    if (!blockForMode) {
      // useEffect above will redirect; render nothing in the meantime
      content = null
    } else {
      content = (
        <BlockFormState
          block={blockForMode}
          blockIndex={mode.blockIndex}
          manifest={manifest}
          theme={theme}
          highlightPath={selectedPath}
          renderBlockForm={renderBlockForm}
          onBack={() => setMode({ kind: "list" })}
          onDelete={() => {
            onDeleteBlock(mode.blockIndex)
            setMode({ kind: "list" })
          }}
        />
      )
    }
  } else {
    content = (
      <PageSettingsState
        onBack={() => setMode({ kind: "list" })}
        seoCard={seoCard}
        dangerZone={dangerZone}
        renderPageSettings={renderPageSettings}
      />
    )
  }

  const transitionKey = mode.kind === "block" ? `block-${mode.blockIndex}` : mode.kind

  return (
    <div className="relative h-full overflow-hidden">
      <div
        key={transitionKey}
        className="h-full animate-in slide-in-from-right-3 duration-150"
      >
        {content}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export const SidebarListLayout: React.FC<SidebarListLayoutProps> = ({
  header,
  body,
}) => (
  <div className="flex h-full flex-col">
    {header}
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {body}
    </div>
  </div>
)

const BlockListRow: React.FC<{
  id: string
  block: EditorBlock
  blockIndex: number
  manifest: RtManifest
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}> = ({ id, block, manifest, onSelect, onDuplicate, onDelete }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const tLabels = useTranslations("editor.blockLabels")
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "sidebar-drilldown-sortable-row",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )

  const justDraggedRef = React.useRef(false)

  React.useEffect(() => {
    if (isDragging) {
      justDraggedRef.current = true
    } else if (justDraggedRef.current) {
      // Drag ended — keep the flag true briefly to swallow the trailing click.
      const timerId = setTimeout(() => {
        justDraggedRef.current = false
      }, 150)
      return () => clearTimeout(timerId)
    }
  }, [isDragging])

  const cfg = blockBySlug[block.blockType]
  const label = resolveBlockLabel(block.blockType, manifest, (slug) =>
    tLabels.has(slug as never) ? tLabels(slug as never) : undefined,
  )
  const summary = cfg?.summary ? cfg.summary(block as Record<string, unknown>) : undefined
  const Icon = cfg?.icon
  return (
    <>
      {sortableStyle.styleElement}
      <div
        ref={setNodeRef}
        className={cn(
          sortableStyle.className,
          "group/row flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/30",
          isDragging && "opacity-30",
        )}
        onClick={() => {
          if (isDragging || justDraggedRef.current) return
          onSelect()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          }
        }}
      >
      <button
        type="button"
        aria-label={t("dragToReorder")}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab rounded-sm p-0.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium leading-snug">{label}</div>
        {summary && (
          <div className="truncate text-[11px] leading-snug text-muted-foreground">{summary}</div>
        )}
      </div>
      {/* Hover-revealed actions menu — mirrors the canvas BlockGutter's
          ⋯ menu (Duplicate / Delete) so the sidebar list has parity with
          the canvas. `data-[state=open]` keeps it visible while the menu
          is open even after the pointer leaves the row. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("blockActions")}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          data-siab-editor-ui

        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
          >
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-destructive focus:text-destructive"
          >
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </>
  )
}

const BlockListRowGhost: React.FC<{ block: EditorBlock | undefined; manifest: RtManifest }> = ({ block, manifest }) => {
  const tLabels = useTranslations("editor.blockLabels")
  if (!block) return null
  const cfg = blockBySlug[block.blockType]
  const label = resolveBlockLabel(block.blockType, manifest, (slug) =>
    tLabels.has(slug as never) ? tLabels(slug as never) : undefined,
  )
  const summary = cfg?.summary ? cfg.summary(block as Record<string, unknown>) : undefined
  const Icon = cfg?.icon
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/95 backdrop-blur-sm px-2 py-1.5 shadow-lg cursor-grabbing">
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium leading-snug">{label}</div>
        {summary && (
          <div className="truncate text-[11px] leading-snug text-muted-foreground">{summary}</div>
        )}
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  )
}

const BlockFormState: React.FC<{
  block: EditorBlock
  blockIndex: number
  manifest: RtManifest
  theme?: ThemeTokens | null
  highlightPath?: ElementPath | null
  renderBlockForm?: (context: SidebarBlockFormSlotContext) => React.ReactNode
  onBack: () => void
  onDelete: () => void
}> = ({ block, blockIndex, manifest, theme, highlightPath, renderBlockForm, onBack, onDelete }) => {
  const t = useTranslations("editor")
  const tLabels = useTranslations("editor.blockLabels")
  const cfg = blockBySlug[block.blockType]
  const label = resolveBlockLabel(block.blockType, manifest, (slug) =>
    tLabels.has(slug as never) ? tLabels(slug as never) : undefined,
  )
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const backButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onBack}
      className="h-8 gap-1"
      aria-label={t("backToBlockList")}
    >
      <ChevronLeft className="size-4" aria-hidden />
      {t("back")}
    </Button>
  )
  const deleteButton = (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={() => setDeleteOpen(true)}
      className="gap-1.5"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {t("deleteBlock")}
    </Button>
  )
  const title = <span className="text-xs font-medium truncate">{label}</span>
  const fields = (
    <BlockFormFields
      block={block}
      blockIndex={blockIndex}
      manifest={manifest}
      theme={theme}
      highlightPath={highlightPath}
    />
  )
  const deleteDialog = (
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={t("deleteBlockTitle")}
      description={t("deleteBlockDescription", { label })}
      confirmLabel={t("deleteBlock")}
      variant="destructive"
      onConfirm={async () => {
        onDelete()
      }}
    />
  )

  if (renderBlockForm) {
    return (
      <>
        {renderBlockForm({
          block,
          blockIndex,
          label,
          manifest,
          theme,
          onBack,
          onDelete,
          requestDelete: () => setDeleteOpen(true),
          backButton,
          deleteButton,
          title,
          fields,
          deleteDialog,
        })}
      </>
    )
  }

  return (
    <SidebarBlockFormLayout
      actions={
        <>
          {backButton}
          {deleteButton}
        </>
      }
      title={title}
      body={fields}
      deleteDialog={deleteDialog}
    />
  )
}

export const SidebarBlockFormLayout: React.FC<SidebarBlockFormLayoutProps> = ({
  actions,
  title,
  body,
  deleteDialog,
}) => (
  <div className="flex h-full flex-col">
    {/* Actions header — back (left) + delete (right). Sits above the
        section-name header so the destructive + navigation controls are
        at the top of the pane, not pinned to a footer at the bottom. */}
    <header className="flex items-center justify-between border-b border-border px-3 py-2">
      {actions}
    </header>
    <header className="flex items-center border-b border-border px-3 py-2">
      {title}
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {body}
    </div>
    {deleteDialog}
  </div>
)

const PageSettingsState: React.FC<{
  onBack: () => void
  seoCard: React.ReactNode
  dangerZone: React.ReactNode
  renderPageSettings?: (context: SidebarPageSettingsSlotContext) => React.ReactNode
}> = ({ onBack, seoCard, dangerZone, renderPageSettings }) => {
  const t = useTranslations("editor")
  const title = <span className="text-xs font-medium">{t("pageSettings")}</span>
  const titleHeader = (
    <header className="flex items-center border-b border-border px-3 py-2">
      {title}
    </header>
  )
  const body = (
    <>
      {seoCard}
      {dangerZone}
    </>
  )
  const backButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onBack}
      className="h-8 gap-1"
      aria-label={t("backToBlockList")}
    >
      <ChevronLeft className="size-4" aria-hidden />
      {t("back")}
    </Button>
  )
  const actionsHeader = (
    <header className="flex items-center border-b border-border px-3 py-2">
      {backButton}
    </header>
  )
  const header = (
    <>
      {actionsHeader}
      {titleHeader}
    </>
  )
  const footer = null

  if (renderPageSettings) {
    return (
      <>
        {renderPageSettings({
          onBack,
          title,
          header,
          body,
          footer,
          backButton,
          seoCard,
          dangerZone,
        })}
      </>
    )
  }

  return (
    <SidebarPageSettingsLayout
      header={header}
      body={body}
      footer={footer}
    />
  )
}

export const SidebarPageSettingsLayout: React.FC<SidebarPageSettingsLayoutProps> = ({
  header,
  body,
  footer,
}) => (
  <div className="flex h-full flex-col">
    {header}
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {body}
    </div>
    {footer}
  </div>
)
