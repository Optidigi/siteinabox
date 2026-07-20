"use client"
import * as React from "react"
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
import { ChevronLeft, ChevronRight, GripVertical, Image as ImageIcon, Plus, Trash2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import { MobileMediaSheet } from "@/components/editor/mobile/mobile-media-sheet"
import { MobileIconSheet } from "@/components/editor/mobile/mobile-icon-sheet"
import { resolveLucideIcon } from "@/components/editor/icon-picker"
import type { ElementSpec } from "@/components/editor/blockElements"
import type { RtManifest } from "@/lib/richText/manifest"
import { useMobileEditor, type DrillFrame } from "@/components/editor/mobile/MobileEditorContext"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useBlockArrayFieldController } from "@/components/editor/fields/fieldController"
import {
  asCtaValue,
  asIconValue,
  asRtRootValue,
  resolveMediaDisplayUrl,
  type EditorArrayItem,
  type EditorIconValue,
  type EditorMediaValue,
} from "@/lib/editor/blockFieldValues"

export interface MobileArrayDrilldownProps {
  spec: ElementSpec
  blockIndex: number
  manifest: RtManifest
}

export const MobileArrayDrilldown: React.FC<MobileArrayDrilldownProps> = ({ spec, blockIndex, manifest }) => {
  const { state, pushDrill, popDrill, clearSelection } = useMobileEditor()
  const { items, updateItem, removeItem, reorderItems, appendItem } = useBlockArrayFieldController({
    blockIndex,
    field: spec.field,
  })
  const activeFrame: DrillFrame | undefined = state.drillStack[state.drillStack.length - 1]
  const inItemMode = activeFrame != null && activeFrame.field === spec.field

  if (inItemMode && activeFrame) {
    const item = items[activeFrame.itemIndex] ?? {}
    const onChange = (next: EditorArrayItem) => updateItem(activeFrame.itemIndex, next)
    const onRemove = () => {
      removeItem(activeFrame.itemIndex)
      clearSelection()
    }

    if (activeFrame.subField) {
      const subSpec = spec.itemFields?.find((s) => s.field === activeFrame.subField)
      if (!subSpec) return null
      return (
        <MobileArraySubFieldEditor
          sub={subSpec}
          value={item[subSpec.field]}
          onChange={(nextValue) => onChange({ ...item, [subSpec.field]: nextValue })}
          blockIndex={blockIndex}
          itemIndex={activeFrame.itemIndex}
          manifest={manifest}
          onBack={() => popDrill()}
        />
      )
    }

    return (
      <MobileArrayItemEditor
        spec={spec}
        item={item}
        itemIndex={activeFrame.itemIndex}
        onChange={onChange}
        onRemove={onRemove}
        onBack={() => popDrill()}
        onOpenSubField={(subField) =>
          pushDrill({ blockIndex, field: spec.field, itemIndex: activeFrame.itemIndex, subField })
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col" data-mobile-array-list>
      <div className="flex items-center gap-2 pb-2">
        <span className="text-sm font-medium truncate">{spec.label}</span>
      </div>
      <SortableArrayList
        items={items}
        spec={spec}
        onReorder={reorderItems}
        onOpenItem={(i) => pushDrill({ blockIndex, field: spec.field, itemIndex: i })}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-3 gap-1.5"
        onClick={() => {
          const { insertedIndex } = appendItem()
          pushDrill({ blockIndex, field: spec.field, itemIndex: insertedIndex })
        }}
      >
        <Plus className="size-4" />
        Add {spec.itemLabel ? spec.itemLabel({}, items.length) : "item"}
      </Button>
    </div>
  )
}

const SortableArrayList: React.FC<{
  items: EditorArrayItem[]
  spec: ElementSpec
  onReorder: (from: number, to: number) => void
  onOpenItem: (i: number) => void
}> = ({ items, spec, onReorder, onOpenItem }) => {
  const ids = React.useMemo(() => items.map((_, i) => String(i)), [items.length])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = Number(active.id)
    const to = Number(over.id)
    if (Number.isNaN(from) || Number.isNaN(to)) return
    onReorder(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {items.map((item, i) => (
            <SortableArrayRow
              key={item.id ?? i}
              id={String(i)}
              label={spec.itemLabel ? spec.itemLabel(item, i) : `${spec.label} ${i + 1}`}
              onOpen={() => onOpenItem(i)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

const SortableArrayRow: React.FC<{ id: string; label: string; onOpen: () => void }> = ({ id, label, onOpen }) => {
  const t = useTranslations("editor")
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "mobile-array-sortable-row",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )
  return (
    <>
      {sortableStyle.styleElement}
      <div
        ref={setNodeRef}
        className={cn(
          sortableStyle.className,
          "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2 min-h-[44px]",
          isDragging && "opacity-50",
        )}
      >
      <button
        type="button"
        aria-label={t("dragToReorder")}
        {...attributes}
        {...listeners}
        className="flex h-11 w-11 shrink-0 items-center justify-center cursor-grab rounded-sm text-muted-foreground hover:bg-accent active:cursor-grabbing touch-none"
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-1 text-left text-sm min-w-0"
      >
        <span className="truncate">{label}</span>
      </button>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </>
  )
}

const MobileArrayItemEditor: React.FC<{
  spec: ElementSpec
  item: EditorArrayItem
  itemIndex: number
  onChange: (next: EditorArrayItem) => void
  onRemove: () => void
  onBack: () => void
  onOpenSubField: (subField: string) => void
}> = ({ spec, item, itemIndex, onRemove, onBack, onOpenSubField }) => {
  const t = useTranslations("editor")
  const subFields = spec.itemFields ?? []
  const itemLabel = spec.itemLabel ? spec.itemLabel(item, itemIndex) : `${spec.label} ${itemIndex + 1}`

  return (
    <div className="flex h-full flex-col" data-mobile-array-item>
      <div className="flex items-center gap-2 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          onClick={onBack}
          aria-label={t("backToList")}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">{itemLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label={t("removeItem", { item: itemLabel })}
        >
          <Trash2 className="size-5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-4">
        {subFields.map((sub) => (
          <SubFieldRow
            key={sub.field}
            sub={sub}
            value={item[sub.field]}
            onOpen={() => onOpenSubField(sub.field)}
          />
        ))}
      </div>
    </div>
  )
}

const SubFieldRow: React.FC<{
  sub: ElementSpec
  value: unknown
  onOpen: () => void
}> = ({ sub, value, onOpen }) => {
  const preview = subFieldPreview(sub, value)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent/50 min-h-[56px]"
      data-mobile-subfield-row
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{sub.label}</div>
        <div className="mt-0.5 truncate text-sm text-foreground">
          {preview ?? <span className="text-muted-foreground">—</span>}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function subFieldPreview(sub: ElementSpec, value: unknown): React.ReactNode {
  if (value == null || value === "") return null
  if (sub.kind === "text") {
    return String(value)
  }
  if (sub.kind === "richtext") {
    return rtPreview(value)
  }
  if (sub.kind === "icon") {
    const iconName = asIconValue(value)
    if (!iconName) return null
    const Icon = resolveLucideIcon(iconName)
    return (
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <span>{iconName}</span>
      </span>
    )
  }
  if (sub.kind === "image") {
    const url = resolveMediaDisplayUrl(value)
    if (url) return url
    if (typeof value === "object" && value !== null && "filename" in value && typeof value.filename === "string") {
      return value.filename
    }
    return String(value)
  }
  if (sub.kind === "cta") {
    const cta = asCtaValue(value)
    return cta.label || cta.href || null
  }
  return null
}

type RtPreviewNode = {
  t?: string
  v?: string
  children?: RtPreviewNode[]
  items?: RtPreviewNode[]
}

function rtPreview(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return truncate(value, 80)
    return null
  }
  const root = value as RtPreviewNode
  const collected: string[] = []
  const walk = (node: RtPreviewNode) => {
    if (!node) return
    if (node.t === "text" && typeof node.v === "string") {
      collected.push(node.v)
      return
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk)
    }
    if (Array.isArray(node.items)) {
      node.items.forEach(walk)
    }
  }
  if (Array.isArray(root.children)) root.children.forEach(walk)
  const joined = collected.join(" ").trim()
  return joined ? truncate(joined, 80) : null
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}

const MobileArraySubFieldEditor: React.FC<{
  sub: ElementSpec
  value: unknown
  onChange: (next: unknown) => void
  blockIndex: number
  itemIndex: number
  manifest: RtManifest
  onBack: () => void
}> = ({ sub, value, onChange, blockIndex, itemIndex, manifest, onBack }) => {
  const t = useTranslations("editor")

  return (
    <div className="flex h-full min-h-0 flex-col" data-mobile-subfield-editor>
      <div className="flex items-center gap-2 pb-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          onClick={onBack}
          aria-label={t("backToItem")}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="text-sm font-medium truncate">{sub.label}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SubFieldRenderer
          sub={sub}
          value={value}
          onChange={onChange}
          blockIndex={blockIndex}
          itemIndex={itemIndex}
          manifest={manifest}
          hideLabel
        />
      </div>
    </div>
  )
}

const SubFieldRenderer: React.FC<{
  sub: ElementSpec
  value: unknown
  onChange: (next: unknown) => void
  blockIndex: number
  itemIndex: number
  manifest: RtManifest
  hideLabel?: boolean
}> = ({ sub, value, onChange, blockIndex, itemIndex, manifest, hideLabel }) => {
  if (sub.kind === "richtext") {
    return (
      <div className="space-y-1">
        {!hideLabel && <Label className="text-xs text-muted-foreground">{sub.label}</Label>}
        <LexicalField
          key={`mobile-${blockIndex}.${itemIndex}.${sub.field}`}
          variant={sub.variant ?? "inline"}
          value={asRtRootValue(value)}
          onChange={onChange}
          manifest={manifest}
          placeholder={sub.label}
        />
      </div>
    )
  }
  if (sub.kind === "text") {
    return (
      <div className="space-y-1">
        {!hideLabel && <Label className="text-xs text-muted-foreground">{sub.label}</Label>}
        <Input
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  if (sub.kind === "icon") {
    return <SubFieldIcon label={sub.label} value={value} onChange={onChange} hideLabel={hideLabel} />
  }
  if (sub.kind === "image") {
    return <SubFieldImage label={sub.label} value={value} onChange={onChange} hideLabel={hideLabel} />
  }
  return <p className="text-xs text-muted-foreground">Unknown sub-field kind: {String(sub.kind)}</p>
}

const SubFieldIcon: React.FC<{
  label: string
  value: unknown
  onChange: (next: EditorIconValue) => void
  hideLabel?: boolean
}> = ({ label, value, onChange, hideLabel }) => {
  const t = useTranslations("editor")
  const [open, setOpen] = React.useState(false)
  const iconName = asIconValue(value)
  const Icon = resolveLucideIcon(iconName)
  return (
    <div className="space-y-1">
      {!hideLabel && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-3 text-sm hover:bg-accent/30"
      >
        {Icon ? <Icon className="size-5 shrink-0" /> : null}
        <span className={Icon ? undefined : "text-muted-foreground"}>{iconName ?? t("chooseIcon")}</span>
      </button>
      <MobileIconSheet open={open} onOpenChange={setOpen} value={iconName} onChange={onChange} />
    </div>
  )
}

const SubFieldImage: React.FC<{
  label: string
  value: unknown
  onChange: (next: EditorMediaValue) => void
  hideLabel?: boolean
}> = ({ label, value, onChange, hideLabel }) => {
  const t = useTranslations("editor")
  const [open, setOpen] = React.useState(false)
  const url = resolveMediaDisplayUrl(value)
  return (
    <div className="space-y-1.5">
      {!hideLabel && <Label className="text-xs text-muted-foreground">{label}</Label>}
      {url ? (
        <img src={url} alt="" className="w-full max-h-40 object-cover rounded-md border border-border" />
      ) : (
        <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground gap-2">
          <ImageIcon className="size-4" /> {t("noImage")}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(true)}>
          {url ? t("replace") : t("choose")}
        </Button>
        {url && (
          <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        )}
      </div>
      <MobileMediaSheet open={open} onOpenChange={setOpen} onPick={onChange} />
    </div>
  )
}
