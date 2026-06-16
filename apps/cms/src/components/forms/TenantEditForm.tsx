"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { useIsMobile } from "@siteinabox/ui/hooks/use-mobile"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { parsePayloadError } from "@/lib/api"
import { fetchTenantManifestFromRepo } from "@/lib/actions/fetchTenantManifestFromRepo"
import { manifestSchema } from "@/lib/richText/manifest"
import { countLeafDirty } from "@/lib/countLeafDirty"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { statusLabel } from "@/lib/i18nLabels"
import { useTranslations } from "next-intl"
import type { Tenant } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

// Mirrors the create-side schema in TenantForm.tsx, plus optional notes +
// the status enum. Slug regex matches the Tenants collection's expectation
// (lowercase ASCII + digits + hyphens) — keep in sync with src/collections/Tenants.ts
// if that ever validates more strictly.
const createSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t("validation.nameMin")),
  slug: z.string().regex(/^[a-z0-9-]+$/, t("validation.slug")),
  domain: z.string().min(3, t("validation.domain")),
  status: z.enum(["provisioning", "active", "suspended", "archived"], {
    message: t("validation.status")
  }),
  siteRepo: z.string().optional(),
  notes: z.string().optional(),
  // Edited as raw JSON text in the form; the superRefine below checks it
  // parses and matches the rich-text manifest schema. Empty string = no
  // manifest (the column is nullable).
  siteManifest: z.string()
}).superRefine((val, ctx) => {
  const raw = val.siteManifest.trim()
  if (!raw) return
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["siteManifest"], message: t("validation.json") })
    return
  }
  const result = manifestSchema.safeParse(parsed)
  if (!result.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["siteManifest"],
      message: result.error.issues[0]?.message ?? t("validation.manifest"),
    })
  }
})
type Values = z.infer<ReturnType<typeof createSchema>>

type Counts = { pages: number; media: number; forms: number; siteSettings: number }

export function TenantEditForm({ tenant, counts }: { tenant: Tenant; counts: Counts }) {
  const t = useTranslations("sites")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const status = useStatusFeedback()
  const [savePending, setSavePending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [manifestSyncPending, setManifestSyncPending] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const isMobile = useIsMobile()

  const schema = createSchema(t)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      status: tenant.status,
      siteRepo: tenant.siteRepo ?? "",
      notes: tenant.notes ?? "",
      siteManifest: tenant.siteManifest ? JSON.stringify(tenant.siteManifest, null, 2) : ""
    }
  })

  // Block accidental nav loss when the form has unsaved edits or a save
  // is in flight. Hook installs a native beforeunload prompt (tab close /
  // refresh / address-bar nav) plus a click + popstate guard for in-app
  // navigation. pending/confirm/cancel surface the custom dialog below.
  const guard = useNavigationGuard(form.formState.isDirty || savePending)

  useEffect(() => {
    const subscription = form.watch(() => setShowSaved(false))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (values: Values) => {
    setSavePending(true)
    setSaveFailed(false)
    // siteManifest is edited as raw text; the schema's superRefine already
    // guaranteed it parses + matches manifestSchema, so JSON.parse is safe
    // here. Empty → null (clears the manifest).
    const manifestRaw = values.siteManifest.trim()
    const payload = { ...values, siteManifest: manifestRaw ? JSON.parse(manifestRaw) : null }
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
    setSavePending(false)
    if (!res.ok) {
      setSaveFailed(true)
      // Surface the specific Payload validation error rather than dumping
      // raw JSON in status feedback. Payload's REST shape is
      // `{errors:[{message,name,...,data:{errors:[{path,message}]}}]}`
      // — flatten to the most useful inner field error if present, else
      // fall back to the top-level message.
      const detail = await parsePayloadError(res)
      if (detail.field === "slug" || detail.field === "domain") {
        form.setError(detail.field as "slug" | "domain", { message: detail.message })
      }
      return
    }
    // FN-2026-0030 — same fix as FN-2026-0012's PageForm patch (commit
    // 0033768): advance RHF's dirty baseline synchronously so
    // useNavigationGuard detaches the beforeunload listener within the
    // same frame. Without `form.reset(values)`, isDirty stays true
    // through the next render tick and a hard refresh in the ~1s window
    // after save still triggers the OS-native "Leave site?" prompt.
    form.reset(values)
    setShowSaved(true)
    if (values.slug !== tenant.slug) {
      // Slug change moves the tenant to a new URL — replace so back button
      // doesn't 404, then refresh so the destination's RSC cache reflects
      // the new tenant data.
      router.replace(`/sites/${values.slug}/edit`)
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const onDelete = async () => {
    const res = await fetch(`/api/tenants/${tenant.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(`${t("delete")} (${res.status}): ${detail.message}`)
    }
    status.success(t("deleted", { name: tenant.name }))
    // router.refresh() AFTER replace() — without it, the /sites listing's
    // RSC cache still holds the now-deleted tenant and re-renders it as a
    // ghost row until the user manually refreshes.
    router.replace("/sites")
    router.refresh()
  }

  const syncManifestFromRepo = async () => {
    setManifestSyncPending(true)
    try {
      const result = await fetchTenantManifestFromRepo(tenant.id)
      if (!result.ok) {
        status.error(t("syncFailed", { message: result.error }))
        return
      }
      form.setValue("siteManifest", JSON.stringify(result.manifest, null, 2), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      status.success(t("syncLoaded", { repo: result.repo, path: result.path }))
    } catch (err) {
      status.error(err instanceof Error ? err.message : t("syncFailed", { message: "" }))
    } finally {
      setManifestSyncPending(false)
    }
  }

  const submitForm = form.handleSubmit(onSubmit)
  const goBack = () => router.push("/sites")
  const dirtyCount = countLeafDirty(form.formState.dirtyFields)
  const errorCount = countLeafErrors(form.formState.errors)

  // Save-affordance status — mirrors the page editor's saveStatus machine so
  // the SaveStatusBar / MobileSavePill show saving → saved / failed badges.
  const saveStatus: SaveStatus = deriveSaveStatus({
    pending: savePending,
    hasError: errorCount > 0 || saveFailed,
    isDirty: form.formState.isDirty,
    showSaved,
  })

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {/* Header row — back + save sit beside the title (desktop). Phone gets
          the floating MobileBackPill + MobileSavePill, mirroring the editor. */}
      <PageHeader
        title={t("edit")}
        subtitle={`${tenant.name} · ${tenant.domain}`}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        action={
          isMobile ? undefined : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => guard.guardedNavigate(goBack)}>
                <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
              </Button>
              <SaveButton
                type="button"
                onClick={submitForm}
                pending={savePending}
                isDirty={form.formState.isDirty}
                dirtyCount={dirtyCount}
                errorCount={errorCount}
              />
            </div>
          )
        }
      />

      <Form {...form}>
        <form onSubmit={submitForm} noValidate>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("identity")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>{t("name")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField name="slug" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("slug")}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("slugDescription")}</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="domain" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("domain")}</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="clientasite.nl"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("domainDescription")}</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("deployment")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField name="status" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("status")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="provisioning">{statusLabel(tCommon, "provisioning")}</SelectItem>
                        <SelectItem value="active">{statusLabel(tCommon, "active")}</SelectItem>
                        <SelectItem value="suspended">{statusLabel(tCommon, "suspended")}</SelectItem>
                        <SelectItem value="archived">{statusLabel(tCommon, "archived")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("archiveDescription")}</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="siteRepo" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>{t("siteRepo")}</FormLabel><FormControl><Input placeholder="Optidigi/siteinabox:sites/clientasite" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField name="notes" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>{t("notes")}</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{t("siteManifest")}</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={syncManifestFromRepo}
                  disabled={manifestSyncPending || !form.watch("siteRepo")?.trim()}
                >
                  <RefreshCw className={manifestSyncPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {t("syncFromRepo")}
                </Button>
              </CardHeader>
              <CardContent>
                <FormField name="siteManifest" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={12}
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="font-mono text-xs"
                        placeholder="{ }"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("manifestDescription")}</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>

      {/* WCAG 1.4.3 — text colours dropped to `foreground` so they meet 4.5:1
          against bg-destructive/5 over the card. Destructive cue preserved by
          the section's red border + bg tint + the destructive Delete button. */}
      <section className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-foreground">{t("dangerZone")}</h2>
        <p className="mt-2 text-sm text-foreground">
          {t("deleteDescription", { name: tenant.name, domain: tenant.domain, pages: counts.pages, media: counts.media, forms: counts.forms })}
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          {t("delete")}
        </Button>
      </section>

      <TypedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle", { name: tenant.name })}
        description={t("deleteDescription", { name: tenant.name, domain: tenant.domain, pages: counts.pages, media: counts.media, forms: counts.forms })}
        confirmPhrase={tenant.slug}
        confirmLabel={t("delete")}
        onConfirm={onDelete}
      />
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
      <SaveStatusBar status={saveStatus} errorCount={errorCount} onRetry={submitForm} />
      {isMobile && (
        <>
          <MobileBackPill onBack={() => guard.guardedNavigate(goBack)} position="top-right" offset="3.75rem" />
          <MobileSavePill
            status={saveStatus}
            dirtyCount={dirtyCount}
            errorCount={errorCount}
            onSave={submitForm}
          />
        </>
      )}
    </div>
  )
}
