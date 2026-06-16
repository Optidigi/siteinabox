"use client"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { slugify } from "@/lib/slugify"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"

const createSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t("validation.nameMin")),
  slug: z.string().regex(/^[a-z0-9-]+$/, t("validation.slug")),
  domain: z.string().min(3, t("validation.domain")),
  siteRepo: z.string().optional()
})
type Values = z.infer<ReturnType<typeof createSchema>>

export function TenantForm() {
  const t = useTranslations("sites")
  const router = useRouter()
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const schema = createSchema(t)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", domain: "", siteRepo: "" }
  })

  // FN-2026-0042 — auto-derive slug from Name on Name onBlur, but ONLY
  // while the slug has not been manually touched. The ref tracks
  // explicit user edits to the slug input; once the user types in slug,
  // we never overwrite it from name again.
  const slugTouched = useRef(false)
  const onNameBlur = () => {
    if (slugTouched.current) return
    const name = form.getValues("name")
    const currentSlug = form.getValues("slug")
    if (currentSlug && currentSlug !== "") return
    const derived = slugify(name ?? "")
    if (derived) form.setValue("slug", derived, { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = async (values: Values) => {
    setPending(true)
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, status: "provisioning" })
    })
    setPending(false)
    if (!res.ok) {
      status.error(t("createFailed"))
      return
    }
    status.success(t("created"))
    router.replace(`/sites/${values.slug}/onboarding`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("name")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                onBlur={(e) => {
                  field.onBlur()
                  onNameBlur()
                  // hand off the bubble — RHF's field.onBlur handles the
                  // form-level mark-touched
                  e.preventDefault?.()
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
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
                onChange={(e) => {
                  // FN-2026-0042 — once the user types in slug, lock the
                  // auto-derive off so we never overwrite their work.
                  slugTouched.current = true
                  field.onChange(e)
                }}
              />
            </FormControl>
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
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="siteRepo" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>{t("siteRepoOptional")}</FormLabel><FormControl><Input placeholder="Optidigi/siteinabox:sites/clientasite" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={pending}>{pending ? t("creating") : t("create")}</Button>
      </form>
    </Form>
  )
}
