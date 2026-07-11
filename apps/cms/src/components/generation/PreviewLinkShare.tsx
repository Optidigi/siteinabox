"use client"

import * as React from "react"
import { Copy, ExternalLink, Link2, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { useLocale, useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@siteinabox/ui/components/select"

type PreviewPageOption = {
  id: string
  label: string
  slug?: string | null
}

type PreviewTokenResponse = {
  token?: string
  exp?: number
  message?: string
}

const formatExpiry = (exp: number | null | undefined, locale: string) => {
  if (!exp) return null
  const date = new Date(exp * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(locale)
}

export function PreviewLinkShare({
  tenantId,
  pages,
  disabledReason,
}: {
  tenantId: string | null
  pages: PreviewPageOption[]
  disabledReason?: string | null
}) {
  const t = useTranslations("generationOperations.previewLink")
  const locale = useLocale()
  const [pageId, setPageId] = React.useState(pages[0]?.id ?? "")
  const [previewUrl, setPreviewUrl] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null)
  const [status, setStatus] = React.useState<"idle" | "creating" | "ready" | "copied" | "error">("idle")
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!pages.some((page) => page.id === pageId)) {
      setPageId(pages[0]?.id ?? "")
      setPreviewUrl("")
      setExpiresAt(null)
      setStatus("idle")
    }
  }, [pageId, pages])

  const canCreate = Boolean(tenantId && pageId && !disabledReason)

  const createLink = async () => {
    if (!tenantId || !pageId) return
    setStatus("creating")
    setMessage(null)
    setPreviewUrl("")
    setExpiresAt(null)

    try {
      const response = await fetch("/api/preview-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, pageId }),
      })
      const body = (await response.json().catch(() => ({}))) as PreviewTokenResponse
      if (!response.ok || !body.token || !body.exp) {
        throw new Error(body.message || t("createFailedMessage"))
      }
      const url = new URL(`/preview/${body.token}`, window.location.origin)
      setPreviewUrl(url.toString())
      setExpiresAt(body.exp)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : t("createFailedMessage"))
    }
  }

  const copyLink = async () => {
    if (!previewUrl) return
    try {
      await navigator.clipboard.writeText(previewUrl)
      setStatus("copied")
      setMessage(t("copiedMessage"))
    } catch {
      setStatus("error")
      setMessage(t("copyFailedMessage"))
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="text-sm font-medium">{t("title")}</div>
          <Select value={pageId} onValueChange={setPageId} disabled={pages.length === 0 || Boolean(disabledReason)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectPage")} />
            </SelectTrigger>
            <SelectContent>
              {pages.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={createLink} disabled={!canCreate || status === "creating"}>
          {status === "creating" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : previewUrl ? (
            <RotateCcw className="size-4" aria-hidden />
          ) : (
            <Link2 className="size-4" aria-hidden />
          )}
          {previewUrl ? t("refreshLink") : t("createLink")}
        </Button>
      </div>

      {previewUrl && (
        <div className="flex flex-col gap-2 md:flex-row">
          <Input value={previewUrl} readOnly aria-label={t("previewLink")} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              <Copy className="size-4" aria-hidden />
              {t("copy")}
            </Button>
            <Button asChild variant="outline">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t("open")}
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {disabledReason || (expiresAt ? t("expires", { date: formatExpiry(expiresAt, locale)! }) : t("expiryHelper"))}
      </div>

      {(status === "error" || status === "copied") && message && (
        <Alert variant={status === "error" ? "destructive" : "default"}>
          <AlertTitle>{status === "error" ? t("failedTitle") : t("readyTitle")}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
