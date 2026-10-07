"use client"
import { useEffect, useState, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@siteinabox/ui/components/sheet"
import { Button } from "@siteinabox/ui/components/button"
import { MediaGrid } from "./MediaGrid"
import { MediaUploader } from "./MediaUploader"
import { clientMediaSchema, type ClientMedia } from "@/components/clientPayload"
import { useTranslations } from "next-intl"
import { fetchTenantMedia, useResolvedMediaTenantId } from "@/components/media/clientMedia"

type Props = { value?: unknown; onChange: (v: unknown) => void; relationTo?: string; tenantId?: number | string }

export function MediaPicker({ value, onChange, tenantId }: Props) {
  const t = useTranslations("media")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ClientMedia[]>([])
  const resolvedTenantId = useResolvedMediaTenantId(tenantId)

  const reload = useCallback(async () => {
    if (resolvedTenantId == null) return
    setItems(await fetchTenantMedia(resolvedTenantId))
  }, [resolvedTenantId])

  useEffect(() => { if (open) reload() }, [open, reload])

  // FN-2026-0062 — pre-fix this useEffect eagerly normalized a populated
  // Media object to its bare id by calling `onChange(value.id)` on mount.
  // Two consequences:
  //   1. RHF marks the field dirty the moment the form renders, even
  //      though the user hasn't touched anything — the unsaved-changes
  //      badge ticks up on page load.
  //   2. The form value becomes a bare number while the picker's `items`
  //      list is empty (it only loads when the user opens the sheet), so
  //      the display lookup `items.find(m => m.id === id)` returns
  //      undefined and the image visually clears.
  // The submit-side `normalizeUploadId` in PageForm already handles the
  // populated→id conversion at PATCH/POST time, which is the ONLY moment
  // the conversion needs to happen. Eager mount-time normalization was
  // belt-on-a-belt and harmful.
  //
  // Lazy fetch fallback: when the form value is a bare id (e.g. after
  // an API/RSC round trip), look up the Media doc once so the display
  // can render. Fresh picker selections keep the full Media object so
  // editor previews can update immediately; submit handlers normalize
  // populated objects to ids before sending them to Payload.
  const [resolvedById, setResolvedById] = useState<ClientMedia | null>(null)
  const parsedValue = clientMediaSchema.safeParse(value)
  const populatedValue = parsedValue.success ? parsedValue.data : null
  const valueId = populatedValue?.id ?? (typeof value === "string" || typeof value === "number" ? value : null)
  useEffect(() => {
    if (valueId == null) {
      if (resolvedById !== null) setResolvedById(null)
      return
    }
    // Skip lookup if the form already holds the populated object OR if
    // the items grid already has it.
    if (typeof value === "object" && value) return
    if (items.find((m) => (m.id) === valueId)) return
    if (resolvedById && (resolvedById.id) === valueId) return
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/media/${valueId}`)
      if (!res.ok) return
      const body: unknown = await res.json()
      const parsed = clientMediaSchema.safeParse(body)
      if (!cancelled && parsed.success) setResolvedById(parsed.data)
    })()
    return () => { cancelled = true }
  }, [valueId, value, items, resolvedById])

  // Resolve display media: prefer the populated object on the form,
  // then the items grid (after the user has opened the picker), then
  // the lazy by-id fetch above.
  const current =
    populatedValue ??
    items.find((m) => (m.id) === valueId) ??
    (resolvedById && (resolvedById.id) === valueId ? resolvedById : null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-md border p-3">
        {current?.url
          ? <img src={current.url} alt={current.alt ?? ""} className="h-10 w-10 object-cover rounded" />
          : <div className="h-10 w-10 rounded bg-muted" />}
        <div className="text-sm flex-1 min-w-0 truncate">
          {current
            ? <><div className="font-medium truncate">{current.filename}</div><div className="text-xs text-muted-foreground truncate">{current.alt ?? ""}</div></>
            : t("noSelection")}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" type="button">{t("choose")}</Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            // Phone: full width so the sheet doesn't overflow viewport
            // (375px screens were getting clipped at 640px). Desktop:
            // 640px panel as before.
            className="w-full sm:w-[640px] sm:max-w-[640px] overflow-y-auto p-0"
            data-siab-editor-ui

          >
            {/* Header: title only. Default shadcn close-X sits absolute top-4 right-4
                — its 16px right inset gives the Upload toolbar room to breathe
                without colliding. */}
            <SheetHeader className="px-6 pt-6 pb-4">
              <SheetTitle className="text-base font-semibold">{t("chooseMedia")}</SheetTitle>
            </SheetHeader>

            {/* Action toolbar: Upload sits in its own row, left-aligned with the
                grid content below. Right padding accounts for the absolute close-X
                so the uploader never visually collides with it. */}
            {resolvedTenantId != null && (
              <div className="flex items-center gap-2 border-y border-border bg-muted/30 px-6 py-3 pr-14">
                <MediaUploader tenantId={resolvedTenantId} onUploaded={(media) => { void reload(); onChange(media); setOpen(false) }} />
              </div>
            )}

            <div className="px-6 py-6">
                <MediaGrid items={items} selectable onSelect={(m) => { onChange(m); setOpen(false) }} />
            </div>
          </SheetContent>
        </Sheet>
        {value != null && (
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange(null)}>{tCommon("clear")}</Button>
        )}
      </div>
    </div>
  )
}
