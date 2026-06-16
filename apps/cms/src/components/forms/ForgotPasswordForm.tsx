"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"

const createSchema = (t: (key: string) => string) => z.object({ email: z.string().email(t("validEmailAddress")) })

export function ForgotPasswordForm() {
  const t = useTranslations("auth")
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const schema = createSchema(t)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { email: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    // FN-2026-0037 — pre-fix shape called .ok-blind: await fetch then
    // setSent(true) + success status UNCONDITIONALLY. A 400/500/429/network
    // error left the user thinking the email was queued. Branch on
    // res.ok and surface a real error badge otherwise. We intentionally
    // keep the SUCCESS copy generic ("If that email exists...") to
    // preserve user-enumeration resistance — but only when the server
    // actually accepted the request.
    let res: Response | null = null
    try {
      res = await fetch("/api/users/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values)
      })
    } catch {
      // Network error — distinct from 4xx/5xx
      setPending(false)
      status.error(t("networkError"))
      return
    }
    setPending(false)
    if (!res.ok) {
      // 429 (rate limit) gets a distinct message; everything else generic.
      if (res.status === 429) {
        status.error(t("tooManyRequests"))
      } else {
        status.error(t("resetSendFailed", { status: res.status }))
      }
      return
    }
    setSent(true)
    status.success(t("resetSent"))
  }

  if (sent) return <div className="text-sm text-muted-foreground">{t("checkInbox")}</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("email")}</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? t("sending") : t("sendResetLink")}</Button>
      </form>
    </Form>
  )
}
