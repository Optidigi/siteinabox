"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { inviteUser } from "@/lib/actions/inviteUser"
import { useStatusFeedback } from "@/components/status-feedback"

const createSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("validation.email")),
  confirmEmail: z.string().email(t("validation.confirmEmail")),
  name: z.string().min(1, t("validation.name")),
  role: z.enum(["owner", "editor", "viewer"], {
    message: t("validation.role")
  })
}).refine((value) => value.email.trim().toLowerCase() === value.confirmEmail.trim().toLowerCase(), {
  path: ["confirmEmail"],
  message: t("validation.emailMatch")
})
type V = z.infer<ReturnType<typeof createSchema>>

export function UserInviteForm({ tenantId }: { tenantId: number | string }) {
  const t = useTranslations("users")
  const tTable = useTranslations("table")
  const tCommon = useTranslations("common")
  const status = useStatusFeedback()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const schema = createSchema(t)
  const form = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", confirmEmail: "", name: "", role: "editor" }
  })

  const onSubmit = async (v: V) => {
    setPending(true)
    // FN-2026-0036 — inviteUser is a server action that THROWS on failure
    // (Forbidden, duplicate email, validation). Without try/catch the
    // exception propagates past `setPending(false)` and the button stays
    // disabled in "Sending..." state forever. Wrap and surface a status badge.
    try {
      const res = await inviteUser({
        email: v.email,
        name: v.name,
        role: v.role,
        tenantId,
      })
      if (!res.ok) {
        // Distinguish field-level error from generic; surface inline if
        // the server returned a path. Today inviteUser returns { ok, error?, field? } shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = res as any
        if (r.field === "email" || r.field === "name") {
          form.setError(r.field as "email" | "name", { message: r.error || "Invalid" })
          status.error(`${r.field}: ${r.error || "Invalid"}`)
        } else {
          status.error(r.error || t("inviteFailed"))
        }
        return
      }
      status.success(t("inviteSent"))
      setOpen(false)
      form.reset()
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("inviteFailed")
      status.error(msg)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="mr-1 h-4 w-4" /> {t("invite")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>
            {t("inviteDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
            <FormField name="email" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>{tTable("email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="confirmEmail" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>{t("confirmEmail")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="off"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>{tTable("name")}</FormLabel><FormControl><Input enterKeyHint="next" autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="role" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>{tTable("role")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="owner">{tCommon("role.owner")}</SelectItem>
                    <SelectItem value="editor">{tCommon("role.editor")}</SelectItem>
                    <SelectItem value="viewer">{tCommon("role.viewer")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={pending}>{pending ? t("sending") : t("sendInvite")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
