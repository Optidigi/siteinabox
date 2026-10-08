"use client"

import * as React from "react"
import { useActionState } from "react"
import { useLocale, useTranslations } from "next-intl"
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
  const t = useTranslations("preview")
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    requestPreviewMagicLinkAction.bind(null, clientSlug, callbackPath),
    initialState,
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-2">
        <Label htmlFor="preview-email">{t("email")}</Label>
        <Input
          id="preview-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className="rounded-lg"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full rounded-lg">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
        {t("sendMagicLink")}
      </Button>
      {state.message && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertTitle>{state.ok ? t("emailSent") : t("accessUnavailable")}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
