"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { MobileBackPill } from "@/components/common/mobile-back-pill"
import { PageHeader } from "@/components/page-header"
import { useIsMobile } from "@siteinabox/ui/hooks/use-mobile"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { parsePayloadError } from "@/lib/api"
import { countLeafDirty } from "@/lib/countLeafDirty"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { useTranslations } from "next-intl"
import type { User } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

// Mirrors Users.ts validateTenants: super-admin must have empty tenants[],
// non-super-admin must have exactly one. The server validator is the source
// of truth; this client schema is just there to keep the form coherent and
// produce reasonable error messages before hitting the wire.
const createSchema = (t: (key: string) => string) => z
  .object({
    name: z.string().min(1, t("validation.name")),
    role: z.enum(["super-admin", "owner", "editor", "viewer"]),
    tenantId: z.string().optional()
  })
  .refine(
    (d) => d.role === "super-admin" || (d.tenantId && d.tenantId !== ""),
    { path: ["tenantId"], message: t("siteRequired") }
  )
type Values = z.infer<ReturnType<typeof createSchema>>

type TenantLite = { id: number | string; name: string; slug: string }

export function UserEditForm({ user, tenants }: { user: User; tenants: TenantLite[] }) {
  const t = useTranslations("users")
  const tCommon = useTranslations("common")
  const tTable = useTranslations("table")
  const router = useRouter()
  const status = useStatusFeedback()
  const [savePending, setSavePending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const isMobile = useIsMobile()

  // Extract current tenant id from the user's tenants[] array (Wave 1 shape).
  const currentTenantId = user.tenants?.[0]?.tenant
  const currentTenantIdString =
    currentTenantId == null
      ? ""
      : typeof currentTenantId === "object"
        ? String(currentTenantId.id)
        : String(currentTenantId)

  const schema = createSchema(t)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name ?? "",
      role: user.role,
      tenantId: currentTenantIdString
    }
  })

  const role = form.watch("role")

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
    // Map the form's flat tenantId back to the validator's array shape.
    // Server still enforces the invariant; this is just the wire format.
    const body: Record<string, unknown> = {
      name: values.name,
      role: values.role,
      tenants:
        values.role === "super-admin"
          ? []
          : [{ tenant: isNaN(Number(values.tenantId)) ? values.tenantId : Number(values.tenantId) }]
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    setSavePending(false)
    if (!res.ok) {
      setSaveFailed(true)
      const detail = await parsePayloadError(res)
      // Surface specific path errors inline; otherwise SaveStatusBar shows failure.
      if (detail.field === "name" || detail.field === "role" || detail.field === "tenants") {
        const formField = detail.field === "tenants" ? "tenantId" : detail.field
        form.setError(formField as "name" | "role" | "tenantId", { message: detail.message })
      }
      return
    }
    // FN-2026-0031 — sister of FN-2026-0012: advance RHF's dirty
    // baseline synchronously so useNavigationGuard detaches its
    // beforeunload listener before the next nav can race.
    form.reset(values)
    setShowSaved(true)
    router.refresh()
  }

  const onDelete = async () => {
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(`${t("delete")} (${res.status}): ${detail.message}`)
    }
    status.success(t("removed", { email: user.email }))
    router.replace("/users")
    router.refresh()
  }

  const submitForm = form.handleSubmit(onSubmit)
  const goBack = () => router.push("/users")
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
    <div className="flex w-full max-w-5xl flex-col gap-4">
      {/* Header row — back + save sit beside the title (desktop). Phone gets
          the floating MobileBackPill + MobileSavePill, mirroring the editor. */}
      <PageHeader
        title={t("edit")}
        subtitle={user.email}
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
              <CardHeader><CardTitle>{t("account")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormItem>
                  <FormLabel>{tTable("email")}</FormLabel>
                  <FormControl>
                    <Input value={user.email} disabled readOnly />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("emailLockedDescription")}
                  </p>
                </FormItem>
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>{tTable("name")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("roleAccess")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField name="role" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tTable("role")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="super-admin">{tCommon("role.super-admin")}</SelectItem>
                        <SelectItem value="owner">{tCommon("role.owner")}</SelectItem>
                        <SelectItem value="editor">{tCommon("role.editor")}</SelectItem>
                        <SelectItem value="viewer">{tCommon("role.viewer")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("roleDescription")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />

                {role !== "super-admin" && (
                  <FormField name="tenantId" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("site")}</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("selectSite")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={String(t.id)} value={String(t.id)}>
                              {t.name} <span className="text-muted-foreground">({t.slug})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
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
          {t("deleteDescription", { email: user.email })}
          {user.role !== "super-admin" && (
            <> {t("deleteDescriptionReinvite")}</>
          )}
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
        title={t("deleteConfirmTitle")}
        description={
          <>
            {t("deleteConfirmDescription", { email: user.email })}
          </>
        }
        confirmPhrase={user.email}
        confirmLabel={t("remove")}
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
