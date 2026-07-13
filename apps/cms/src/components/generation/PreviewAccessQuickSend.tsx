"use client"

import { useActionState, useEffect } from "react"
import { Loader2, Mail } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { useStatusFeedback } from "@/components/status-feedback"
import { sendPreviewAccessAction, type PreviewAccessActionState } from "@/lib/actions/previewAccess"

const initialState: PreviewAccessActionState = { ok: false, message: "" }

export function PreviewAccessQuickSend({
  generationRunId,
  email,
  label,
}: {
  generationRunId: string | number
  email: string
  label: string
}) {
  const status = useStatusFeedback()
  const [state, action, pending] = useActionState(
    sendPreviewAccessAction.bind(null, generationRunId),
    initialState,
  )

  useEffect(() => {
    if (!state.message) return
    if (state.ok) status.success(state.message)
    else status.error(state.message)
  }, [state, status])

  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <Button type="submit" size="icon" aria-label={label} disabled={pending}>
        {pending
          ? <Loader2 className="size-4 animate-spin" aria-hidden />
          : <Mail className="size-4" aria-hidden />}
      </Button>
    </form>
  )
}
