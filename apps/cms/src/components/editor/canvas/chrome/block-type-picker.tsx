"use client"
import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export type BlockTypeDef = {
  slug: string
  icon?: React.ComponentType<{ className?: string }>
  labels?: { singular?: string }
  description?: string
  fields: unknown[]  // only .length read internally
}

export type BlockPresetDef = {
  id: string | number
  name: string
  description?: string | null
  blockType: string
  data: Record<string, unknown>
}

export type BlockTypePickerProps = {
  blockTypes: BlockTypeDef[]
  presets: BlockPresetDef[]
  presetsError?: string | null
  onReloadPresets: () => void | Promise<void>
  onDeletePreset: (preset: BlockPresetDef) => Promise<void>
  sanitizePresetData?: (slug: string, data: Record<string, unknown>) => Record<string, unknown>
  onAdd: (slug: string, atIndex: number, seed?: Record<string, unknown>) => void
  defaultIndex?: number
  controlledOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Block-type picker dialog with expandable tiles for inserting from a saved
 * block preset.
 *
 * Pure UI primitive — receives all data and side-effect callbacks as props.
 * Pair with a BlockPresetsProvider (or equivalent caller-side wiring) to
 * supply blockTypes/presets/onReloadPresets/onDeletePreset.
 *
 * Two ways to use it:
 *
 *  - Default trigger (legacy "+ Add block" button): omit `controlledOpen`
 *    and `onOpenChange`. The picker renders its own outline button.
 *  - Programmatic (from an InsertSlot): pass `controlledOpen` and
 *    `onOpenChange`. No trigger button is rendered.
 *
 * `onAdd(slug, atIndex, seed?)` lets the caller insert at an arbitrary
 * index, and optionally pass a seed object with pre-filled field values
 * (this is how preset-insert works — the seed comes from the preset's
 * `data` blob, optionally run through `sanitizePresetData` if the caller
 * provides one to drop fields that no longer exist in the live block
 * config).
 *
 * Preset reload is triggered automatically when the dialog opens; the
 * caller's `onReloadPresets` callback should populate the `presets` array
 * (typically via React state inside the BlockPresetsProvider).
 */
export function BlockTypePicker({
  blockTypes,
  presets,
  presetsError = null,
  onReloadPresets,
  onDeletePreset,
  sanitizePresetData,
  onAdd,
  defaultIndex,
  controlledOpen,
  onOpenChange,
}: BlockTypePickerProps) {
  const t = useTranslations("editor")
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o)
    else setInternalOpen(o)
  }

  // Per-tile expansion: which slug's preset list is currently visible.
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setExpandedSlug(null)
      onReloadPresets()
    }
  }, [open, onReloadPresets])

  const presetsBySlug = useMemo(() => {
    const out: Record<string, BlockPresetDef[]> = {}
    for (const p of presets) {
      const slug = p.blockType
      if (!out[slug]) out[slug] = []
      out[slug].push(p)
    }
    return out
  }, [presets])

  const insertAt = defaultIndex ?? Number.MAX_SAFE_INTEGER

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <Plus className="mr-1 h-4 w-4" /> {t("addBlock")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl" data-siab-editor-ui data-siab-canvas-chrome="block-picker">
        <DialogHeader>
          <DialogTitle>{t("addBlockTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("pickBlockType")}
          </DialogDescription>
        </DialogHeader>
        {presetsError && (
          <p className="text-xs text-destructive">
            {t("presetLoadFailed", { message: presetsError })}
          </p>
        )}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {blockTypes.map((b) => {
            const tilePresets = presetsBySlug[b.slug] ?? []
            const isExpanded = expandedSlug === b.slug
            const hasPresets = tilePresets.length > 0

            return (
              <div key={b.slug} className="rounded-md border">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 p-3 text-left",
                    "hover:bg-accent",
                    isExpanded && "bg-accent/50"
                  )}
                  onClick={() => {
                    if (hasPresets) {
                      setExpandedSlug(isExpanded ? null : b.slug)
                    } else {
                      onAdd(b.slug, insertAt)
                      setOpen(false)
                    }
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {b.icon && (
                      <b.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {typeof b.labels?.singular === "string" ? b.labels.singular : b.slug}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.description ?? t("fieldCount", { count: b.fields.length })}
                        {hasPresets && ` · ${t("presetCount", { count: tilePresets.length })}`}
                      </div>
                    </div>
                  </div>
                  {hasPresets && (
                    <span className="text-muted-foreground" aria-hidden>
                      {isExpanded ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                    </span>
                  )}
                </button>
                {isExpanded && hasPresets && (
                  <div className="border-t">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onAdd(b.slug, insertAt)
                        setOpen(false)
                      }}
                    >
                      <span className="text-muted-foreground">+</span>
                      <span>{t("blankBlock", { type: b.slug })}</span>
                    </button>
                    {tilePresets.map((preset) => (
                      <PresetRow
                        key={preset.id}
                        preset={preset}
                        onInsert={() => {
                          const seed = sanitizePresetData ? sanitizePresetData(b.slug, preset.data) : preset.data
                          onAdd(b.slug, insertAt, seed)
                          setOpen(false)
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

/**
 * One row inside an expanded tile. Click the row body to insert; the trash
 * icon opens a TypedConfirmDialog requiring the preset name.
 *
 * Confirm copy reminds the operator that deleting a preset doesn't touch
 * already-inserted blocks — they're independent copies, that's the model.
 */
function PresetRow({
  preset,
  onInsert,
  onDelete,
  onDeleted
}: {
  preset: BlockPresetDef
  onInsert: () => void
  onDelete: (preset: BlockPresetDef) => Promise<void>
  onDeleted: () => void
}) {
  const t = useTranslations("editor")
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 border-t px-3 py-2 text-sm hover:bg-accent">
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onInsert}>
        <div className="font-medium truncate">{preset.name}</div>
        {preset.description && (
          <div className="text-xs text-muted-foreground truncate">{preset.description}</div>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setConfirmOpen(true)
        }}
        aria-label={t("deletePresetLabel", { name: preset.name })}
        className="h-7 w-7"
      >
        <Trash2 className="h-3.5 w-3.5"/>
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deletePresetTitle", { name: preset.name })}
        description={t("deletePresetDescription")}
        confirmLabel={t("deletePreset")}
        canvasChrome="block-preset-delete-dialog"
        onConfirm={async () => {
          await onDelete(preset)  // throws on failure; ConfirmDialog handles error
          onDeleted()
        }}
      />
    </div>
  )
}
