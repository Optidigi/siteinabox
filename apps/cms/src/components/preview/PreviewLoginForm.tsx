"use client"

import * as React from "react"
import { useActionState } from "react"
import { Mail, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { requestPreviewMagicLinkAction } from "@/lib/actions/requestPreviewMagicLink"

const initialState = {
  ok: false,
  message: "",
}

export function PreviewLoginForm({
  clientSlug,
  callbackPath,
}: {
  clientSlug: string
  callbackPath: string
}) {
  const [state, formAction, pending] = useActionState(
    requestPreviewMagicLinkAction.bind(null, clientSlug, callbackPath),
    initialState,
  )

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="preview-email">Email</Label>
        <Input
          id="preview-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
        Send magic link
      </Button>
      {state.message && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertTitle>{state.ok ? "Email sent" : "Access unavailable"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
