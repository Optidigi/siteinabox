"use client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Trash2, ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { MediaUsageDialog } from "./MediaUsageDialog"
import { parsePayloadError } from "@/lib/api"
import { cn } from "@siteinabox/ui/lib/utils"
import type { Media } from "@/payload-types"
import type { MediaUsageEntry, MediaUsageMap } from "@/lib/queries/mediaUsageWalker"
import { useStatusFeedback } from "@/components/status-feedback"

/**
 * Grid of media cards. Two new behaviors over the previous version:
 *
 *  - Each card shows a "Used in N" badge when the item is referenced by
 *    pages or by site-settings. Clicking the badge opens MediaUsageDialog.
 *  - Delete uses ConfirmDialog instead of native confirm(). When the item
 *    is in use, the dialog description lists the dependents so the operator
 *    sees the impact before confirming.
 *  - In the management view (selectable=false), cards can be multi-selected
 *    via checkboxes; a sticky action bar enables bulk delete.
 */
export function MediaGrid({
  items,
  onSelect,
  selectable,
  canManage = true,
  onDeleted,
  usage,
  pagesBaseHref = "/pages"
}: {
  items: Media[]
  onSelect?: (m: Media) => void
  selectable?: boolean
  canManage?: boolean
  onDeleted?: () => void
  usage?: MediaUsageMap
  pagesBaseHref?: string | null
}) {
  const t = useTranslations("media")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const [confirmFor, setConfirmFor] = useState<Media | null>(null)
  const [usageFor, setUsageFor] = useState<Media | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  useEffect(() => {
    const liveIds = new Set(items.map((m) => m.id as number | string))
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => liveIds.has(id)))
      return next.size === current.size ? current : next
    })
    if (confirmFor && !liveIds.has(confirmFor.id as number | string)) setConfirmFor(null)
    if (usageFor && !liveIds.has(usageFor.id as number | string)) setUsageFor(null)
  }, [items, confirmFor, usageFor])

  const usageOf = (m: Media): MediaUsageEntry => {
    // Map keys are `number | string` (the union of Payload id types — pg
    // adapter uses numbers, mongo uses strings). `Media.id` is the same
    // union per payload-types.ts, so no cast is needed.
    const entry = usage?.get(m.id as number | string)
    return entry ?? { pages: [], settings: false }
  }
  const usageCount = (m: Media) => {
    const e = usageOf(m)
    return e.pages.length + (e.settings ? 1 : 0)
  }

  const onConfirmDelete = async (m: Media) => {
    const statusId = status.loading(t("deleting"))
    try {
      const res = await fetch(`/api/media/${m.id}`, { method: "DELETE" })
      if (!res.ok) {
        const { message } = await parsePayloadError(res)
        throw new Error(message || t("deleteFailed"))
      }
      status.success(t("deleted"), { id: statusId })
      setSelectedIds((current) => {
        if (!current.has(m.id as number | string)) return current
        const next = new Set(current)
        next.delete(m.id as number | string)
        return next
      })
      if (onDeleted) onDeleted()
      else router.refresh()
    } catch (err) {
      status.error(err instanceof Error ? err.message : t("deleteFailed"), { id: statusId })
      throw err
    }
  }

  const onBulkDelete = async () => {
    // Parallel deletes via Promise.allSettled so 10+ items don't take 10×
    // the round-trip time of a single delete. allSettled (vs all) means
    // one failure doesn't abort the rest — partial-success is reported
    // via the status count.
    const ids = Array.from(selectedIds)
    const statusId = status.loading(t("deleting"))
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/media/${id}`, { method: "DELETE" }))
    )
    let okCount = 0
    let failCount = 0
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) okCount++
      else failCount++
    }
    if (failCount === 0) status.success(t("deletedCount", { count: okCount }), { id: statusId })
    else status.error(t("deletedPartial", { ok: okCount, failed: failCount }), { id: statusId })
    setSelectedIds(new Set())
    if (onDeleted) onDeleted()
    else router.refresh()
  }

  // Build bulk-delete description
  const buildBulkDescription = () => {
    const ids = Array.from(selectedIds)
    const selectedItems = items.filter((m) => ids.includes(m.id as any))
    const MAX_NAMES = 5
    const shownNames = selectedItems.slice(0, MAX_NAMES).map((m) => m.filename ?? String(m.id))
    const extra = selectedItems.length - shownNames.length
    const names = shownNames.join(", ") + (extra > 0 ? ` ${t("deleteBulkMore", { count: extra })}` : "")

    // Check if any selected item is referenced somewhere
    const hasRefs = selectedItems.some((m) => usageCount(m) > 0)

    return (
      <>
        <p>
          {t("deleteBulkDescription", { count: ids.length, names })}
        </p>
        {hasRefs && (
          <p className="mt-2 text-xs">
            {t("deleteBulkReferencedWarning")}
          </p>
        )}
      </>
    )
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const partialSelected = selectedIds.size > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected || partialSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((m) => m.id as number | string)))
    }
  }

  return (
    <>
      {!selectable && canManage && items.length > 0 && (
        <div
          className={cn(
            "sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md border bg-background/95 backdrop-blur px-3 py-2 mb-3",
            selectedIds.size === 0 && "border-dashed"
          )}
        >
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <Checkbox
              checked={allSelected ? true : partialSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              aria-label={
                allSelected
                  ? t("deselectAll")
                  : partialSelected
                    ? t("deselectSelected", { count: selectedIds.size })
                    : t("selectAllItems", { count: items.length })
              }
            />
            <span>
              {allSelected
                ? t("selectedAll", { count: items.length })
                : partialSelected
                  ? t("selectedSome", { selected: selectedIds.size, total: items.length })
                  : t("selectAll")}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedIds(new Set())}>
                {t("clearSelection")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={() => setBulkConfirmOpen(true)}
              >
                {t("deleteSelected", { count: selectedIds.size })}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* FN-2026-0039 — empty-state. Pre-fix the grid rendered an empty
          div with no message, no Upload CTA. Show a friendly placeholder
          when there are no items so a fresh tenant communicates "no media
          yet" rather than "broken page". The PageHeader's Upload button
          remains the canonical upload affordance. */}
      {items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />}
          title={t("none")}
          description={t("noneDescription")}
        />
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((m) => {
          const count = usageCount(m)
          const isSelected = !selectable && selectedIds.has(m.id as any)
          return (
            <Card
              key={m.id as any}
              className={cn(
                "relative",
                selectable && "cursor-pointer hover:ring-2 hover:ring-ring",
                !selectable && canManage && "cursor-pointer transition-colors",
                isSelected && "ring-2 ring-primary bg-primary/5",
              )}
              onClick={() => {
                if (selectable) {
                  onSelect?.(m)
                  return
                }
                if (!canManage) return
                // Management mode: tapping the card toggles selection.
                const next = new Set(selectedIds)
                if (next.has(m.id as any)) next.delete(m.id as any)
                else next.add(m.id as any)
                setSelectedIds(next)
              }}
            >
              {!selectable && canManage && (
                // Checkbox is now a pure visual indicator. Card click is the
                // sole interaction path — pointer-events-none avoids the
                // double-toggle that would otherwise happen when the click
                // hits both the checkbox and the card.
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <Checkbox
                    checked={isSelected}
                    aria-label={`${isSelected ? t("selected") : t("notSelected")}: ${m.filename}`}
                  />
                </div>
              )}
              <CardContent className="p-2 space-y-2">
                {(m.mimeType ?? "").startsWith("image/")
                  ? <img src={m.url ?? ""} alt={m.alt ?? ""} className="aspect-video w-full object-cover rounded" />
                  : <div className="aspect-video flex items-center justify-center bg-muted text-xs text-muted-foreground rounded">{m.mimeType}</div>}
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs truncate min-w-0">
                    <div className="font-medium truncate">{m.filename}</div>
                    <div className="text-muted-foreground truncate">{m.alt ?? "—"}</div>
                    {usage && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setUsageFor(m) }}
                        className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${count > 0 ? "border-primary/30 text-primary hover:bg-primary/5" : "border-border text-muted-foreground"}`}
                        aria-label={count > 0 ? t("usedInPlace", { count }) : t("notUsedAnywhere")}
                      >
                        {count > 0 ? t("usedIn", { count }) : t("unused")}
                      </button>
                    )}
                  </div>
                  {!selectable && canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmFor(m) }}
                      aria-label={`${tCommon("delete")} ${m.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}

      {usageFor && (
        <MediaUsageDialog
          open={!!usageFor}
          onOpenChange={(o) => !o && setUsageFor(null)}
          filename={usageFor.filename ?? ""}
          pages={usageOf(usageFor).pages}
          settings={usageOf(usageFor).settings}
          pagesBaseHref={pagesBaseHref}
        />
      )}

      {canManage && confirmFor && (
        <ConfirmDialog
          open={!!confirmFor}
          onOpenChange={(o) => !o && setConfirmFor(null)}
          title={t("deleteTitle", { filename: confirmFor.filename ?? "" })}
          description={
            <>
              {t("deleteDescription", { filename: confirmFor.filename ?? "" })}
              {(() => {
                const e = usageOf(confirmFor)
                const total = e.pages.length + (e.settings ? 1 : 0)
                if (total === 0) return <> {t("deleteNotReferenced")}</>
                return (
                  <>
                    {" "}{t("deleteReferencedBy")}
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      {e.pages.map((p) => (
                        <li key={String(p.id)}>{p.title}{p.slug ? ` (/${p.slug})` : ""}</li>
                      ))}
                      {e.settings && <li>{t("settingsLogo")}</li>}
                    </ul>
                    <p className="mt-2 text-xs">
                      {t("deleteBrokenWarning")}
                    </p>
                  </>
                )
              })()}
            </>
          }
          confirmLabel={tCommon("delete")}
          onConfirm={() => onConfirmDelete(confirmFor)}
        />
      )}

      {canManage && (
        <ConfirmDialog
          open={bulkConfirmOpen}
          onOpenChange={setBulkConfirmOpen}
          title={t("deleteBulkTitle", { count: selectedIds.size })}
          description={buildBulkDescription()}
          confirmLabel={t("deleteSelected", { count: selectedIds.size })}
          onConfirm={onBulkDelete}
        />
      )}
    </>
  )
}
