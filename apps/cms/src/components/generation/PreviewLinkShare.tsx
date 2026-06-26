"use client"

import * as React from "react"
import { Copy, ExternalLink, Link2, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
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

const formatExpiry = (exp?: number | null) => {
  if (!exp) return null
  const date = new Date(exp * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("nl-NL")
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
        throw new Error(body.message || "Preview link could not be created.")
      }
      const url = new URL(`/preview/${body.token}`, window.location.origin)
      setPreviewUrl(url.toString())
      setExpiresAt(body.exp)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Preview link could not be created.")
    }
  }

  const copyLink = async () => {
    if (!previewUrl) return
    try {
      await navigator.clipboard.writeText(previewUrl)
      setStatus("copied")
      setMessage("Preview link copied.")
    } catch {
      setStatus("error")
      setMessage("Copy failed. Select the link and copy it manually.")
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="text-sm font-medium">Customer preview link</div>
          <Select value={pageId} onValueChange={setPageId} disabled={pages.length === 0 || Boolean(disabledReason)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a page" />
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
          {previewUrl ? "Refresh link" : "Create link"}
        </Button>
      </div>

      {previewUrl && (
        <div className="flex flex-col gap-2 md:flex-row">
          <Input value={previewUrl} readOnly aria-label="Preview link" className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
            <Button asChild variant="outline">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Open
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {disabledReason || (expiresAt ? `Expires ${formatExpiry(expiresAt)}.` : "Links expire 30 minutes after creation.")}
      </div>

      {(status === "error" || status === "copied") && message && (
        <Alert variant={status === "error" ? "destructive" : "default"}>
          <AlertTitle>{status === "error" ? "Preview link failed" : "Ready to share"}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
