"use client"
import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, Trash2, ExternalLink } from "lucide-react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import type { NavEntry, NavPageOption } from "./navTypes"

type NavEntryLabels = {
  typeLabel: Record<NavEntry["type"], string>
  untitledPage: string
  pageNotFound: string
  untitledSection: string
  untitledLink: string
  notOnSite: string
  drag: string
  edit: string
  delete: string
}

/** Display label + secondary line for an entry, resolved against pages. */
export function describeEntry(
  entry: NavEntry,
  pages: NavPageOption[],
  labels?: Pick<NavEntryLabels, "untitledPage" | "pageNotFound" | "untitledSection" | "untitledLink">,
): { label: string; detail: string; warn: boolean } {
  if (entry.type === "page") {
    const page = pages.find((p) => p.id === entry.page)
    return {
      label: entry.label?.trim() || page?.title || labels?.untitledPage || "Untitled page link",
      detail: page ? `/${page.slug}` : labels?.pageNotFound || "page not found",
      warn: !page,
    }
  }
  if (entry.type === "section") {
    const page = entry.page != null ? pages.find((p) => p.id === entry.page) : undefined
    const base = page ? `/${page.slug}` : ""
    return {
      label: entry.label?.trim() || labels?.untitledSection || "Untitled section link",
      detail: `${base}#${entry.anchor ?? ""}`,
      warn: entry.page != null && !page,
    }
  }
  return {
    label: entry.label?.trim() || labels?.untitledLink || "Untitled link",
    detail: entry.url ?? "",
    warn: false,
  }
}

export function NavEntryRow({
  id,
  entry,
  pages,
  onEdit,
  onDelete,
  labels,
}: {
  id: string
  entry: NavEntry
  pages: NavPageOption[]
  onEdit: () => void
  onDelete: () => void
  labels: NavEntryLabels
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const transformValue = formatRuntimeCssValue(CSS.Transform.toString(transform))
  const transitionValue = formatRuntimeCssValue(transition)
  const sortableStyle = useCspStyleRule(
    "navigation-sortable-row",
    `${transformValue ? `transform:${transformValue};` : ""}${transitionValue ? `transition:${transitionValue};` : ""}`,
  )
  const { label, detail, warn } = describeEntry(entry, pages, labels)

  return (
    <>
      {sortableStyle.styleElement}
      <div
        ref={setNodeRef}
        className={cn(
          sortableStyle.className,
          "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5",
          isDragging && "opacity-60 shadow-md",
        )}
      >
        <button
          type="button"
          aria-label={labels.drag}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <Badge variant="secondary" className="shrink-0">
          {labels.typeLabel[entry.type]}
        </Badge>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{label}</div>
          <div
            className={cn(
              "truncate text-xs",
              warn ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {entry.type === "custom" && entry.external && (
              <ExternalLink className="mr-1 inline size-3 align-[-1px]" aria-hidden />
            )}
            {detail}
            {warn && labels.notOnSite}
          </div>
        </div>

        <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.edit} onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={labels.delete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </>
  )
}
