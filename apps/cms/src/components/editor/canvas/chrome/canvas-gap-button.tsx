"use client"
import * as React from "react"
import { Plus } from "lucide-react"
import { BlockTypePicker } from "@/components/editor/canvas/chrome/block-type-picker"
import { useBlockPresets } from "@/components/editor/canvas/BlockPresetsContext"
import { useTranslations } from "next-intl"

/**
 * A hover-revealed zone between canvas blocks.
 * Clicking the "+" button opens the BlockTypePicker dialog in controlled mode;
 * picking a type calls onInsert(slug) which the parent uses to splice a new
 * block into the blocks array at this gap's position.
 */
export const CanvasGapButton: React.FC<{
  /** Insert a freshly-created block of the picked type at this gap.
   *  `seed` carries preset field values when inserting from a preset. */
  onInsert: (blockType: string, seed?: Record<string, unknown>) => void
}> = ({ onInsert }) => {
  const t = useTranslations("editor")
  const presetsCtx = useBlockPresets()
  const [open, setOpen] = React.useState(false)
  return (
    <div className="group/gap relative flex h-6 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 transition-opacity group-hover/gap:opacity-100" />
      <button
        data-siab-editor-ui
        data-siab-canvas-chrome="insert-gap"
        type="button"
        aria-label={t("insertBlockHere")}
        onClick={() => setOpen(true)}
        className="relative z-10 inline-flex size-6 items-center justify-center rounded-full border border-border bg-popover text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover/gap:opacity-100 hover:bg-accent hover:text-accent-foreground focus:opacity-100"
      >
        <Plus className="size-3.5" />
      </button>
      {/* BlockTypePicker in fully controlled mode — no trigger rendered */}
      <BlockTypePicker
        {...presetsCtx}
        controlledOpen={open}
        onOpenChange={setOpen}
        onAdd={(slug, _atIndex, seed) => {
          onInsert(slug, seed)
          setOpen(false)
        }}
      />
    </div>
  )
}
