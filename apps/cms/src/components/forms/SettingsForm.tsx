"use client"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { SegmentedPill } from "@/components/common/segmented-pill"
import { FLOATING_PILL_CLASS } from "@/components/editor/mode/mode-bar"
import { Button } from "@siteinabox/ui/components/button"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { useIsMobile } from "@siteinabox/ui/hooks/use-mobile"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { parsePayloadError } from "@/lib/api"
import { countLeafDirty } from "@/lib/countLeafDirty"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { cn } from "@siteinabox/ui/lib/utils"
import { ArrowLeft, Download, Image, Settings as SettingsIcon, ShieldCheck } from "lucide-react"
import { normalizeUploadId } from "@/lib/uploadValues"
import { DEFAULT_CLIENT_SETTINGS_CONTRACT, type SettingsContract } from "@/lib/settingsContract"
import { useStatusFeedback } from "@/components/status-feedback"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

// OBS-81 — Settings is client-facing and intentionally slim by default:
// General, Brand, and Operations. Legal details, opening hours, and
// header/footer-specific content stay out of this surface until there is a
// clearer SIAB-wide contract for them.
//
// FN-2026-0067 — Navigation tab removed; nav management is moving to a
// dedicated /sites/<slug>/nav route (header + footer scopes, page-driven
// + external link entries). The schema's `navigation` array stays for
// now until the new nav surface lands.
//
// FN-2026-0034 — minimal zod schema covering the required + format-validated
// fields. Other fields (.passthrough so the form doesn't strip optional
// nested data on save). The collection's server-side validators remain the
// authority on shape; this gives the user immediate inline feedback for
// the obvious failures (empty siteName, malformed contactEmail, malformed
// hex color) without waiting for a server round-trip.
const createSettingsSchema = (t: (key: string, values?: Record<string, string | number | Date>) => string) => z.object({
  siteName: z.string().min(1, t("validation.siteNameRequired")),
  siteUrl: z.string().url(t("validation.siteUrlInvalid")),
  contactEmail: z.union([
    z.string().email(t("validation.emailInvalid")),
    z.literal(""),
    z.null()
  ]).optional(),
  branding: z.object({
    logo: z.any().nullish(),
    favicon: z.any().nullish(),
    primaryColor: z.union([
      z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, t("validation.hexInvalid")), // lint:no-css:ignore — hex in validation message string, not CSS
      z.literal(""),
      z.null()
    ]).optional()
  }).passthrough().optional(),
  chrome: z.object({
    footer: z.object({
      tagline: z.string().nullish(),
      copyright: z.string().nullish(),
    }).passthrough().optional(),
  }).passthrough().optional(),
  maintenance: z.object({
    enabled: z.boolean().optional(),
    message: z.string().nullish(),
  }).passthrough().optional(),
}).passthrough()

type Values = z.infer<ReturnType<typeof createSettingsSchema>>
type SectionKey = "general" | "brand" | "operations"

export function SettingsForm({
  initial,
  canEdit,
  settingsContract = DEFAULT_CLIENT_SETTINGS_CONTRACT,
}: {
  initial: any
  canEdit: boolean
  settingsContract?: SettingsContract
}) {
  const router = useRouter()
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const status = useStatusFeedback()
  const settingsSchema = createSettingsSchema(t)
  const form = useForm<Values>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial
  })
  const [pending, setPending] = useState(false)
  const [section, setSection] = useState<SectionKey>("general")
  const [showSaved, setShowSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [dataRequestPending, setDataRequestPending] = useState(false)
  const isMobile = useIsMobile()

  // FN-2026-0050 — guard against accidental nav loss with unsaved settings.
  // Same shape every other form in the admin uses.
  const guard = useNavigationGuard(form.formState.isDirty || pending)

  useEffect(() => {
    const subscription = form.watch(() => setShowSaved(false))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true)
    setSaveFailed(false)
    // FN-2026-0056 — never send `tenant` on PATCH. Pre-fix the form spread
    // `{ ...values, tenant: tenantId }` into the body, which (a) the server
    // rejects with 500 for any non-matching tenant id (cross-tenant write),
    // and (b) is meaningless for in-place updates: the row's tenant is
    // already the current tenant. Strip it.
    const { tenant: _ignore, id: _idIgnore, ...patchBody } = values as Values & {
      tenant?: unknown
      id?: unknown
    }
    patchBody.branding = {
      ...patchBody.branding,
      logo: normalizeUploadId(patchBody.branding?.logo),
      favicon: normalizeUploadId(patchBody.branding?.favicon),
    }
    let res: Response
    try {
      res = await fetch(`/api/site-settings/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchBody)
      })
    } catch {
      setPending(false)
      setSaveFailed(true)
      return
    }
    setPending(false)
    if (!res.ok) {
      setSaveFailed(true)
      // FN-2026-0034 — surface field-tied errors inline; the registry
      // SaveStatusBar owns failed-save feedback.
      const detail = await parsePayloadError(res)
      if (detail.field) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form.setError(detail.field as any, { type: "server", message: detail.message })
        } catch {
          // RHF rejects unknown paths; the save-status badge still shows failure.
        }
      }
      return
    }
    // FN-2026-0051 — clear dirty baseline post-save so navigationGuard
    // detaches; mirrors PageForm / TenantEditForm post-fix shape.
    form.reset(values)
    setShowSaved(true)
    router.refresh()
  })

  const generalFields = [
    { name: "siteName", type: "text", label: t("siteName"), required: true },
    { name: "siteUrl", type: "url", label: t("siteUrl"), required: true },
    settingsContract.general.description
      ? {
          name: "description",
          type: "textarea",
          label: t("description"),
        }
      : null,
    settingsContract.general.contactEmail
      ? {
          name: "contactEmail",
          type: "email",
          label: t("contactEmail"),
        }
      : null,
  ].filter(Boolean)

  const brandingFields = [
    settingsContract.identity.branding.logo
      ? { name: "logo", type: "upload", relationTo: "media", label: t("logo") }
      : null,
    settingsContract.identity.branding.favicon
      ? { name: "favicon", type: "upload", relationTo: "media", label: t("favicon") }
      : null,
  ].filter(Boolean)

  const brandFields = [
    brandingFields.length
      ? { type: "group", name: "branding", label: t("branding"), fields: brandingFields }
      : null,
  ].filter(Boolean)

  const operationsFields = [
    settingsContract.operations.maintenance
      ? { type: "group", name: "maintenance", label: t("maintenance"), fields: [
          { name: "enabled", type: "checkbox", label: t("maintenanceEnabled") },
          { name: "message", type: "textarea", label: t("maintenanceMessage") },
        ]}
      : null,
  ].filter(Boolean)

  const sections = [
    { key: "general" as const, label: t("general"), Icon: SettingsIcon, fields: generalFields },
    { key: "brand" as const, label: t("brand"), Icon: Image, fields: brandFields },
    { key: "operations" as const, label: t("operations"), Icon: ShieldCheck, fields: operationsFields },
  ].filter((candidate) => candidate.key !== "brand" || brandFields.length > 0)

  const goBack = () => router.back()
  const requestDataExport = async () => {
    setDataRequestPending(true)
    try {
      const res = await fetch("/api/users/request-data", { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      status.success(t("dataExportRequested"))
    } catch {
      status.error(t("dataExportFailed"))
    } finally {
      setDataRequestPending(false)
    }
  }
  const dirtyCount = countLeafDirty(form.formState.dirtyFields)
  const errorCount = countLeafErrors(form.formState.errors)
  // Save-affordance status — mirrors the page editor's saveStatus machine.
  const saveStatus: SaveStatus = deriveSaveStatus({
    pending,
    hasError: errorCount > 0 || saveFailed,
    isDirty: form.formState.isDirty,
    showSaved,
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-4">
        {/* Toolbar row — section switch (left) + Save (right). Mirrors the
            navigation page shell: a SegmentedPill inside the shared
            FLOATING_PILL_CLASS surface, paired with the canonical SaveButton. */}
        <div className="flex items-center justify-between gap-3">
          <div className={cn(FLOATING_PILL_CLASS, "inline-flex")}>
            <SegmentedPill<SectionKey>
              ariaLabel={t("sectionLabel")}
              value={section}
              onValueChange={(next) => next && setSection(next)}
              allowDeselect={false}
              items={sections.map((s) => ({
                value: s.key,
                label: s.label,
                icon: s.Icon,
                ariaLabel: s.label,
              }))}
            />
          </div>
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => guard.guardedNavigate(goBack)}>
                <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
              </Button>
              {canEdit && (
                <SaveButton type="submit" pending={pending} isDirty={form.formState.isDirty} dirtyCount={dirtyCount} errorCount={errorCount} />
              )}
            </div>
          )}
        </div>

        {/* All sections stay mounted (inactive ones hidden) so react-hook-form
            keeps every field registered — switching sections never drops edits. */}
        <Card>
          <CardContent className="space-y-3">
            {sections.map(({ key, fields }) => (
              <div key={key} className={cn("space-y-3", key !== section && "hidden")}>
                {fields.map((f: any, i: number) => <FieldRenderer key={i} field={f} />)}
                {key === "operations" && (
                  <section className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">{t("privacy")}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{t("dataExportDescription")}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={requestDataExport}
                        disabled={dataRequestPending}
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4" />
                        {dataRequestPending ? t("requestingDataExport") : t("requestDataExport")}
                      </Button>
                    </div>
                  </section>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </form>
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
      {canEdit && <SaveStatusBar status={saveStatus} errorCount={errorCount} onRetry={onSubmit} />}
      {isMobile && (
        <>
          <MobileBackPill
            onBack={() => guard.guardedNavigate(goBack)}
            position="top-right"
            offset={canEdit ? "3.75rem" : undefined}
          />
          {canEdit && (
            <MobileSavePill
              status={saveStatus}
              dirtyCount={dirtyCount}
              errorCount={errorCount}
              onSave={onSubmit}
            />
          )}
        </>
      )}
    </FormProvider>
  )
}
