"use client"
import * as React from "react"
import { GripVertical, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface BlockGutterProps {
  onDelete: () => void
  onDuplicate: () => void
  /** dnd-kit listeners/attributes for the drag handle, forwarded from the
   *  sortable wrapper in the frame canvas surface. Pass undefined if DnD not wired. */
  dragHandleProps?: Record<string, unknown>
}

/**
 * Top-right overlay chip rendered inside each canvas block.
 * Contains a drag handle (for dnd-kit reordering) and a ⋯ menu
 * (Delete, Duplicate).
 *
 * Positioned as an absolute overlay inside the block's top-right corner so
 * it is never clipped by the canvas pane's overflow-x: hidden. Previously
 * the gutter sat to the LEFT of the block boundary (`-translate-x-full`),
 * which made it invisible when the canvas has overflow-x: hidden.
 *
 * Visibility is controlled by the parent's `group/block` hover state —
 * the chip is transparent until the block is hovered (or keyboard-focused).
 */
export const BlockGutter: React.FC<BlockGutterProps> = ({
  onDelete,
  onDuplicate,
  dragHandleProps,
}) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")

  return (
  <div
    data-siab-editor-ui
    data-siab-canvas-chrome="block-gutter"
    className={cn(
      "absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 rounded-md",
      "border border-border bg-background/95 backdrop-blur-sm shadow-sm p-0.5",
      "opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100",
    )}
  >
    <button
      type="button"
      aria-label={t("dragToReorder")}
      className="cursor-grab rounded-sm p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
      {...(dragHandleProps ?? {})}
    >
      <GripVertical className="size-4" />
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("blockActions")}
          className="rounded-sm p-1 text-muted-foreground hover:bg-accent"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>{t("duplicate")}</DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          {tCommon("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  )
}
