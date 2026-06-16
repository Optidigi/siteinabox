"use client"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@siteinabox/ui/components/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { statusLabel } from "@/lib/i18nLabels"
import type { Form as FormDoc } from "@/payload-types"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"
import { captureCmsBrowserEvent } from "@/components/analytics/CmsUsageTracker"

export function FormSubmissionSheet({
  form, open, onOpenChange
}: { form: FormDoc | null; open: boolean; onOpenChange: (b: boolean) => void }) {
  const router = useRouter()
  const t = useTranslations("formsList")
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string>("new")
  const [savedStatus, setSavedStatus] = useState<string>("new")
  const [showSaved, setShowSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (!form) return
    const next = String(form.status ?? "new")
    setStatus(next)
    setSavedStatus(next)
    setShowSaved(false)
  }, [form?.id, form?.status])

  if (!form) return null

  const dirty = status !== savedStatus
  const saveState: SaveStatus = deriveSaveStatus({
    pending,
    hasError: saveFailed,
    isDirty: dirty,
    showSaved,
  })

  const saveStatus = async () => {
    const saveStartedAt = performance.now()
    setPending(true)
    setSaveFailed(false)
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    })
    setPending(false)
    if (!res.ok) {
      setSaveFailed(true)
      captureCmsBrowserEvent({
        event: "cms_form_status_updated",
        cms_action: "form-status-update",
        cms_result: "failure",
        cms_object_type: "form-submission",
        cms_object_id: form.id,
        cms_error_type: `http-${res.status}`,
        cms_duration_ms: performance.now() - saveStartedAt,
      })
      return
    }
    setSavedStatus(status)
    setShowSaved(true)
    captureCmsBrowserEvent({
      event: "cms_form_status_updated",
      cms_action: "form-status-update",
      cms_result: "success",
      cms_object_type: "form-submission",
      cms_object_id: form.id,
      cms_duration_ms: performance.now() - saveStartedAt,
    })
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{form.email ?? t("submission")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{tTable("status")}</span>
            <Select value={status} onValueChange={(next) => { setShowSaved(false); setStatus(next) }} disabled={pending}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["new", "read", "contacted", "spam"].map((s) => <SelectItem key={s} value={s}>{statusLabel(tCommon, s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <SaveButton
              type="button"
              pending={pending}
              isDirty={dirty}
              dirtyCount={dirty ? 1 : 0}
              onClick={saveStatus}
            />
          </div>
          <div><div className="text-muted-foreground">{tTable("form")}</div><div>{form.formName}</div></div>
          {form.pageUrl && (
            <div>
              <div className="text-muted-foreground">{t("page")}</div>
              {/* FN-2026-0040 — wrap pageUrl in an anchor so triage can
                  click through to the source page. External (cross-
                  origin) link — open in new tab + noopener for safety. */}
              <a
                href={form.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate block underline hover:text-foreground"
              >
                {form.pageUrl}
              </a>
            </div>
          )}
          <div><div className="text-muted-foreground">{tTable("name")}</div><div>{form.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">{tTable("email")}</div><div>{form.email ?? "—"}</div></div>
          <div><div className="text-muted-foreground">{t("message")}</div><pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{form.message ?? ""}</pre></div>
          <div>
            <div className="text-muted-foreground">{t("fullPayload")}</div>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{JSON.stringify(form.data, null, 2)}</pre>
          </div>
        </div>
      </SheetContent>
      <SaveStatusBar status={saveState} onRetry={saveStatus} />
    </Sheet>
  )
}
