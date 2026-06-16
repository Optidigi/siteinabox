"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"

const createSchema = (t: (key: string) => string) => z.object({
  password: z.string().min(8, t("minPassword")),
  confirm: z.string()
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: t("passwordMismatch") })

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth")
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const schema = createSchema(t)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: values.password, token })
    })
    setPending(false)
    if (!res.ok) { status.error(t("resetInvalid")); return }
    status.success(t("passwordSet"))
    router.replace("/")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField name="password" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>{t("newPassword")}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField name="confirm" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>{t("confirm")}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("setting") : t("setPassword")}</Button>
      </form>
    </Form>
  )
}
