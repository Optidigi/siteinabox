"use client"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Button } from "@siteinabox/ui/components/button"
import { StickyFormFooter } from "@/components/sticky-form-footer"
import { SaveButton } from "@/components/save-ui/save-button"
import { SaveStatusBar, type SaveStatus } from "@/components/save-ui/save-status-bar"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { Badge } from "@siteinabox/ui/components/badge"
import { roleVariant } from "@/lib/badge-helpers"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/save-ui/unsaved-changes-dialog"
import { parsePayloadError } from "@/lib/api"
import { countLeafErrors } from "@/lib/countLeafErrors"
import type { User } from "@/payload-types"
import { useStatusFeedback } from "@/components/status-feedback"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

const createNameSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t("validation.nameRequired")),
})
const createPasswordSchema = (t: (key: string) => string) => z.object({
  currentPassword: z.string().min(1, t("validation.currentPasswordRequired")),
  newPassword: z.string().min(8, t("validation.minPassword")),
  confirm: z.string()
}).refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: t("validation.passwordMismatch") })

export function ProfileForm({ user }: { user: User }) {
  const router = useRouter()
  const t = useTranslations("profile")
  const status = useStatusFeedback()
  const [namePending, setNamePending] = useState(false)
  const [showNameSaved, setShowNameSaved] = useState(false)
  const [nameSaveFailed, setNameSaveFailed] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const nameSchema = createNameSchema(t)
  const passwordSchema = createPasswordSchema(t)

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user.name ?? "" }
  })

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" }
  })
  const nameErrorCount = countLeafErrors(nameForm.formState.errors)
  const nameSaveStatus: SaveStatus = deriveSaveStatus({
    pending: namePending,
    hasError: nameErrorCount > 0 || nameSaveFailed,
    isDirty: nameForm.formState.isDirty,
    showSaved: showNameSaved,
  })

  useEffect(() => {
    const subscription = nameForm.watch(() => setShowNameSaved(false))
    return () => subscription.unsubscribe()
  }, [nameForm])

  // Block accidental nav loss when either form has unsaved edits or a
  // save is in flight. Hook installs a native beforeunload prompt (tab
  // close / refresh / address-bar nav) plus a click + popstate guard for
  // in-app navigation. pending/confirm/cancel surface the custom dialog below.
  const guard = useNavigationGuard(
    nameForm.formState.isDirty ||
      passwordForm.formState.isDirty ||
      namePending ||
      passwordPending,
  )

  const onUpdateName = async (v: z.infer<typeof nameSchema>) => {
    setNamePending(true)
    setNameSaveFailed(false)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v.name })
    })
    setNamePending(false)
    if (!res.ok) {
      // FN-2026-0055 — surface a parsed Payload error instead of a raw
      // response.text().slice. Same `parsePayloadError` helper used
      // everywhere else.
      const detail = await parsePayloadError(res)
      setNameSaveFailed(true)
      nameForm.setError("name", { type: "server", message: detail.message })
      return
    }
    // FN-2026-0032 — advance RHF dirty baseline synchronously (sister of
    // FN-2026-0012). The password-form path already calls passwordForm.
    // reset(); the name-form path was missing the equivalent.
    nameForm.reset(v)
    setShowNameSaved(true)
    router.refresh()
  }

  const onUpdatePassword = async (v: z.infer<typeof passwordSchema>) => {
    setPasswordPending(true)
    // Audit-p1 #7 sub-fix A — single POST to the verified-self-change
    // endpoint. The server re-checks `currentPassword` and rotates the
    // user's session on success (sub-fix B), invalidating every other
    // pre-rotation JWT. The endpoint sets a fresh `payload-token` cookie
    // on the 200 response so this tab stays logged in across the rotation.
    //
    // Replaces the previous client-side login pre-check + naive PATCH —
    // a stolen cookie could bypass that pair (the audit's repro). The new
    // endpoint authoritatively binds "knew current password" to "is
    // allowed to set a new password" on the server.
    const res = await fetch("/api/users/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    })
    setPasswordPending(false)
    if (!res.ok) {
      // Map server status to a user-friendly message; preserve the prior
      // UX where 403 surfaces as "current password incorrect" (the only
      // 403 the endpoint emits comes from payload.login throwing).
      if (res.status === 403) {
        status.error(t("currentPasswordIncorrect"))
        return
      }
      const txt = await res.text()
      status.error(t("passwordUpdateFailed", { message: txt.slice(0, 100) }))
      return
    }
    status.success(t("passwordChanged"))
    passwordForm.reset()
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>{t("account")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">{t("email")}</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">{t("role")}</span>
            <div>
              <Badge variant={roleVariant(user.role)}>
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("name")}</CardTitle></CardHeader>
        <CardContent>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onUpdateName)} noValidate className="space-y-3">
              <FormField name="name" control={nameForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("displayName")}</FormLabel>
                  <FormControl><Input {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <StickyFormFooter>
                <SaveButton type="submit" pending={namePending} isDirty={nameForm.formState.isDirty} errorCount={nameErrorCount} />
              </StickyFormFooter>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("changePassword")}</CardTitle></CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} noValidate className="space-y-3">
              <FormField name="currentPassword" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("currentPassword")}</FormLabel>
                  <FormControl><Input type="password" autoComplete="current-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="newPassword" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("newPassword")}</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="confirm" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("confirm")}</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <StickyFormFooter>
                <Button type="submit" size="touch" disabled={passwordPending} className="w-full md:w-auto">
                  {passwordPending ? t("updating") : t("changePassword")}
                </Button>
              </StickyFormFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
      <SaveStatusBar
        status={nameSaveStatus}
        errorCount={nameErrorCount}
        onRetry={nameForm.handleSubmit(onUpdateName)}
      />
    </div>
  )
}
