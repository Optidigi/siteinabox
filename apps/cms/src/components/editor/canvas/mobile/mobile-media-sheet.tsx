"use client"
import * as React from "react"
import { X } from "lucide-react"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@siteinabox/ui/components/sheet"
import { Button } from "@siteinabox/ui/components/button"
import {
  useMobileMediaSheet,
  type MediaItem,
} from "@/components/editor/canvas/MobileMediaSheetContext"
import { useTranslations } from "next-intl"

export type { MediaItem }

export interface MobileMediaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (media: MediaItem) => void
  tenantId?: number | string
}

export const MobileMediaSheet: React.FC<MobileMediaSheetProps> = ({
  open,
  onOpenChange,
  onPick,
  tenantId,
}) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { resolveTenantId, fetchMedia, MediaPickerComponent } = useMobileMediaSheet()
  const [resolvedTenantId, setResolvedTenantId] = React.useState<number | string | null>(
    tenantId ?? null,
  )
  const [items, setItems] = React.useState<MediaItem[]>([])

  React.useEffect(() => {
    if (resolvedTenantId != null) return
    let cancelled = false
    void (async () => {
      const tid = await resolveTenantId()
      if (tid != null && !cancelled) setResolvedTenantId(tid)
    })()
    return () => {
      cancelled = true
    }
  }, [resolvedTenantId, resolveTenantId])

  const reload = React.useCallback(async () => {
    if (resolvedTenantId == null) return
    const fetched = await fetchMedia(resolvedTenantId)
    setItems(fetched)
  }, [resolvedTenantId, fetchMedia])

  React.useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[100dvh] z-[60] overflow-y-auto px-4 pb-4"
        data-mobile-media-sheet
        data-siab-editor-ui
        data-siab-canvas-chrome="mobile-media-sheet"
      >
        <SheetHeader className="flex-row items-center justify-between gap-3 pb-3">
          <SheetTitle>{t("chooseImage")}</SheetTitle>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-border bg-muted text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              aria-label={tCommon("close")}
              data-mobile-media-close
            >
              <X className="size-4" aria-hidden />
            </Button>
          </SheetClose>
        </SheetHeader>
        {resolvedTenantId != null && (
          <MediaPickerComponent
            items={items}
            tenantId={resolvedTenantId}
            onPick={(m) => {
              onPick(m)
              onOpenChange(false)
            }}
            onUploaded={(m) => {
              void reload()
              onPick(m)
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
