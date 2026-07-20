"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { Upload } from "lucide-react"
import { parsePayloadError } from "@/lib/api"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"

export function MediaUploader({
  tenantId,
  onUploaded,
  refreshOnUploaded = false,
}: {
  tenantId: number | string
  onUploaded?: (m: unknown) => void
  refreshOnUploaded?: boolean
}) {
  const router = useRouter()
  const t = useTranslations("media")
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const uploadStartedAt = performance.now()
    // FN-2026-0038 — `disabled={pending}` on the visible Button forwards
    // through Radix Slot to a <span>, where `disabled` is a no-op. The
    // hidden <input> stayed pickable, so a fast re-pick during an in-
    // flight upload fired a second concurrent POST /api/media. Early-
    // return on pending here is the load-bearing guard; the input also
    // gets `disabled={pending}` below as defense-in-depth (browsers
    // honour the prop on the <input> directly even when triggered via a
    // wrapping <label>).
    if (pending) {
      e.target.value = ""
      return
    }
    setPending(true)
    const statusId = status.loading(t("uploading"))
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("_payload", JSON.stringify({ alt: file.name, tenant: tenantId }))
      const res = await fetch("/api/media", { method: "POST", body: fd })
      if (!res.ok) {
        // Surface server-side validation/storage error with detail so a
        // silent failure can't masquerade as success. Previously this was
        // a bare "Upload failed" status with no actionable info.
        const { message } = await parsePayloadError(res)
        status.error(message || `${t("uploadFailed")} (${res.status})`, { id: statusId })
        captureCmsBrowserEvent({
          event: "cms_media_upload_failed",
          cms_action: "media-upload",
          cms_result: "failure",
          cms_object_type: "media",
          cms_error_type: `http-${res.status}`,
          cms_duration_ms: performance.now() - uploadStartedAt,
        })
        return
      }
      const json = await res.json()
      const uploaded = json.doc ?? json
      status.success(t("uploaded", { name: file.name }), { id: statusId })
      captureCmsBrowserEvent({
        event: "cms_media_uploaded",
        cms_action: "media-upload",
        cms_result: "success",
        cms_object_type: "media",
        cms_object_id: uploaded?.id,
        cms_duration_ms: performance.now() - uploadStartedAt,
      })
      onUploaded?.(uploaded)
      if (refreshOnUploaded) router.refresh()
    } catch (err) {
      // Network failure / aborted request / FormData encoding error — same
      // category as a non-OK response from the operator's perspective.
      status.error(err instanceof Error ? err.message : t("uploadFailed"), { id: statusId })
      captureCmsBrowserEvent({
        event: "cms_media_upload_failed",
        cms_action: "media-upload",
        cms_result: "failure",
        cms_object_type: "media",
        cms_error_type: "network",
        cms_duration_ms: performance.now() - uploadStartedAt,
      })
    } finally {
      setPending(false)
      e.target.value = "" // allow re-picking the same file
    }
  }

  return (
    <label>
      <input
        type="file"
        hidden
        onChange={onPick}
        accept="image/*,video/mp4,application/pdf"
        disabled={pending}
      />
      <Button asChild variant="outline" disabled={pending}>
        <span><Upload className="mr-1 h-4 w-4" />{pending ? t("uploading") : t("upload")}</span>
      </Button>
    </label>
  )
}
