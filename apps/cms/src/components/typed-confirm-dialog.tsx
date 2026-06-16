"use client"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { useTranslations } from "next-intl"

/**
 * Typed-confirmation dialog for destructive actions.
 *
 * Usage:
 *   <TypedConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete user"
 *     description={<>This removes <strong>{u.email}</strong>'s access. Irreversible.</>}
 *     confirmPhrase={u.email}
 *     confirmLabel="Delete user"
 *     onConfirm={async () => { await fetch(`/api/users/${u.id}`, { method: "DELETE" }) }}
 *   />
 *
 * The destructive button stays disabled until the user types `confirmPhrase`
 * exactly into the input. `onConfirm` may throw — its error message renders
 * inline and the dialog stays open. On success the dialog closes and the
 * input/error state resets.
 */
export type TypedConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmPhrase: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
}

export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel,
  onConfirm
}: TypedConfirmDialogProps) {
  const t = useTranslations("common")
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state every time the dialog opens, so reopening after a cancelled
  // attempt doesn't show stale input or error from the previous open.
  useEffect(() => {
    if (open) {
      setValue("")
      setError(null)
      setPending(false)
    }
  }, [open])

  const matches = value.trim() === confirmPhrase
  const canSubmit = matches && !pending

  const submit = async () => {
    if (!canSubmit) return
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
    <Dialog open={open} onOpenChange={(o) => (pending ? null : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-2">
          <Label htmlFor="confirm-phrase" className="text-sm font-normal">
            {t.rich("typeToConfirm", {
              phrase: () => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{confirmPhrase}</code>,
            })}
          </Label>
          <Input
            id="confirm-phrase"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={!canSubmit}
          >
            {pending ? t("working") : (confirmLabel ?? t("delete"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
