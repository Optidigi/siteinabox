"use client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { useLocale, useTranslations } from "next-intl"

type Props = {
  open: boolean
  savedAt: number | null
  onRestore: () => void
  onDiscard: () => void
}

export function PageDraftRecoveryDialog({ open, savedAt, onRestore, onDiscard }: Props) {
  const t = useTranslations("editor")
  const locale = useLocale()
  const savedLabel = savedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(savedAt))
    : null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("restoreDraftTitle")}</DialogTitle>
          <DialogDescription>
            {savedLabel
              ? t("restoreDraftWithDate", { date: savedLabel })
              : t("restoreDraft")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDiscard}>
            {t("discardDraft")}
          </Button>
          <Button type="button" onClick={onRestore}>
            {t("restoreDraftAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
