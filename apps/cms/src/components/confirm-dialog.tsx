"use client"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"

/**
 * Plain confirmation dialog for low-stakes destructive actions
 * (block presets, media items, etc.). Higher-stakes deletions
 * (users, tenants, pages, team members) use TypedConfirmDialog
 * instead — that requires typing the entity name to confirm.
 *
 * `onConfirm` may throw — its error message renders inline and the
 * dialog stays open. On success the dialog closes.
 */
export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  variant?: "default" | "destructive"
  canvasChrome?: string
  onConfirm: () => Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  canvasChrome,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogContent
        data-siab-editor-ui={canvasChrome ? "true" : undefined}
        data-siab-canvas-chrome={canvasChrome}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
