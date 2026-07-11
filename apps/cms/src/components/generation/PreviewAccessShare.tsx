"use client"

import * as React from "react"
import { useActionState } from "react"
import { Copy, ExternalLink, Loader2, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { sendPreviewAccessAction, type PreviewAccessActionState } from "@/lib/actions/previewAccess"
import { useTranslations } from "next-intl"

const initialState: PreviewAccessActionState = {
  ok: false,
  message: "",
}

export function PreviewAccessShare({
  generationRunId,
  defaultEmail,
  previewUrl,
  disabledReason,
}: {
  generationRunId: string | number
  defaultEmail?: string | null
  previewUrl?: string | null
  disabledReason?: string | null
}) {
  const t = useTranslations("generationOperations.previewAccess")
  const [state, formAction, pending] = useActionState(sendPreviewAccessAction.bind(null, generationRunId), initialState)
  const activePreviewUrl = state.previewUrl || previewUrl || ""

  const copyLink = async () => {
    if (!activePreviewUrl) return
    await navigator.clipboard.writeText(activePreviewUrl)
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <form action={formAction} className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="preview-customer-email">{t("sendPreview")}</Label>
          <Input
            id="preview-customer-email"
            name="email"
            type="email"
            defaultValue={defaultEmail ?? ""}
            placeholder="customer@example.com"
            disabled={Boolean(disabledReason) || pending}
            required
          />
        </div>
        <Button type="submit" disabled={Boolean(disabledReason) || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
          {t("sendPreview")}
        </Button>
      </form>

      {activePreviewUrl && (
        <div className="flex flex-col gap-2 md:flex-row">
          <Input value={activePreviewUrl} readOnly aria-label={t("previewUrl")} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              <Copy className="size-4" aria-hidden />
              {t("copy")}
            </Button>
            <Button asChild variant="outline">
              <a href={activePreviewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t("open")}
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {disabledReason || t("helper")}
      </div>

      {state.message && (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertTitle>{state.ok ? t("sentTitle") : t("failedTitle")}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
