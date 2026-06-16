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
import { useTranslations } from "next-intl"

/**
 * UnsavedChangesDialog — stateless, props-driven shadcn Dialog used by
 * `useNavigationGuard` to prompt the operator before discarding dirty
 * form state on an in-app click or browser back/forward navigation.
 *
 * Mirrors the aesthetic of `TypedConfirmDialog`: confirm = destructive
 * button, cancel = outline button, no close X (escape and outside-click
 * are intentionally suppressed so a stray click can't silently nuke
 * unsaved work).
 *
 * Native shadcn Dialog handles focus return on close; title +
 * description provide screen-reader context.
 */

type Props = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title?: string
  description?: string
}

export function UnsavedChangesDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description
}: Props) {
  const t = useTranslations("common")
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title ?? t("discardChangesTitle")}</DialogTitle>
          <DialogDescription>{description ?? t("discardChangesDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("keepEditing")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {t("discardChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
