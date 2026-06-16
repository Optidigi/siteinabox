"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@siteinabox/ui/components/dialog"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@siteinabox/ui/components/select"
import { Switch } from "@siteinabox/ui/components/switch"
import { useTranslations } from "next-intl"
import { Plus, Copy } from "lucide-react"
import { parsePayloadError } from "@/lib/api"
import { useStatusFeedback } from "@/components/status-feedback"

const createBaseSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("validation.email")),
  name: z.string().min(1, t("validation.name")),
  password: z.string().min(8, t("validation.password")),
  role: z.enum(["super-admin", "owner", "editor", "viewer"], {
    message: t("validation.role")
  }),
  tenantId: z.string().optional(),
  enableAPIKey: z.boolean().default(false)
})
const createSchema = (t: (key: string) => string) => createBaseSchema(t).refine(
  (d) => d.role === "super-admin" || (d.tenantId && d.tenantId !== ""),
  { path: ["tenantId"], message: t("siteRequired") }
)

type Tenant = { id: number | string; name: string; slug: string }

export function CreateUserForm() {
  const t = useTranslations("users")
  const tCommon = useTranslations("common")
  const tApiKey = useTranslations("apiKey")
  const tTable = useTranslations("table")
  const status = useStatusFeedback()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ apiKey: string; email: string } | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const router = useRouter()

  const schema = createSchema(t)
  type FormValues = z.infer<ReturnType<typeof createBaseSchema>>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as import("react-hook-form").Resolver<FormValues>,
    defaultValues: { email: "", name: "", password: "", role: "editor", tenantId: "", enableAPIKey: false }
  })

  const role = form.watch("role")
  const enableAPIKey = form.watch("enableAPIKey")

  // Load tenants when dialog opens
  useEffect(() => {
    if (!open) return
    fetch("/api/tenants?limit=200&sort=name").then((r) => r.json()).then((j) => {
      setTenants((j.docs ?? []).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })))
    }).catch(() => {})
  }, [open])

  const onSubmit = async (v: FormValues) => {
    setPending(true)
    // Step 1: create the user. Payload silently ignores `apiKey` on create
    // (verified during prod orchestrator-user setup), so we set it via PATCH
    // immediately afterward when needed.
    const createBody: any = {
      email: v.email, name: v.name, password: v.password, role: v.role
    }
    if (v.role !== "super-admin" && v.tenantId) {
      const tenantId = isNaN(Number(v.tenantId)) ? v.tenantId : Number(v.tenantId)
      createBody.tenants = [{ tenant: tenantId }]
    }
    if (v.enableAPIKey) {
      createBody.enableAPIKey = true
    }
    const createRes = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createBody)
    })
    if (!createRes.ok) {
      setPending(false)
      // FN-2026-0048 — surface parsed Payload error message instead of
      // raw JSON envelope. If the error is field-tied, set inline.
      const detail = await parsePayloadError(createRes)
      if (detail.field === "email" || detail.field === "name" || detail.field === "password") {
        form.setError(detail.field as "email" | "name" | "password", { message: detail.message })
        status.error(`${detail.field}: ${detail.message}`)
      } else {
        status.error(t("createFailed", { message: detail.message }))
      }
      return
    }
    const createJson = await createRes.json()
    const newId = createJson?.doc?.id ?? createJson?.id

    if (v.enableAPIKey && newId != null) {
      // Step 2: PATCH the new user with a generated API key.
      const apiKey = crypto.randomUUID()
      const patchRes = await fetch(`/api/users/${newId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey })
      })
      setPending(false)
      if (!patchRes.ok) {
        // FN-2026-0048 — parsed message instead of raw text slice.
        const detail = await parsePayloadError(patchRes)
        status.error(t("apiKeySetFailed", { message: detail.message }))
        // Still show what we tried so the operator can retry the PATCH manually
        setCreatedKey({ apiKey: "(failed to set — open the user record and regenerate)", email: v.email })
        return
      }
      setCreatedKey({ apiKey, email: v.email })
    } else {
      setPending(false)
      status.success(t("created"))
      setOpen(false)
      form.reset()
      router.refresh()
    }
  }

  const dismissKey = () => {
    setCreatedKey(null)
    setOpen(false)
    form.reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(b) => { setOpen(b); if (!b) { setCreatedKey(null); form.reset() } }}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="mr-1 h-4 w-4"/> {t("create")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdKey ? t("created") : t("create")}</DialogTitle>
          <DialogDescription>
            {createdKey
              ? t("createdKeyDescription")
              : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{createdKey.email}</strong> {t("created")}.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
              <code className="text-xs flex-1 break-all">{createdKey.apiKey}</code>
              <Button variant="outline" size="sm" type="button"
                onClick={() => { navigator.clipboard.writeText(createdKey.apiKey); status.success(tApiKey("copied")) }}>
                <Copy className="h-3 w-3"/>
              </Button>
            </div>
            <Button onClick={dismissKey} className="w-full">{tCommon("done")}</Button>
          </div>
        ) : (
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
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{tTable("name")}</FormLabel><FormControl><Input autoComplete="name" enterKeyHint="next" {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <FormField name="password" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>{t("password")}</FormLabel><FormControl><Input type="password" autoComplete="new-password" enterKeyHint="next" {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <FormField name="role" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{tTable("role")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="super-admin">{tCommon("role.super-admin")}</SelectItem>
                      <SelectItem value="owner">{tCommon("role.owner")}</SelectItem>
                      <SelectItem value="editor">{tCommon("role.editor")}</SelectItem>
                      <SelectItem value="viewer">{tCommon("role.viewer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              {role !== "super-admin" && (
                <FormField name="tenantId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("site")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("selectSite")}/></SelectTrigger></FormControl>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={String(t.id)} value={String(t.id)}>{t.name} ({t.slug})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
              )}
              <FormField name="enableAPIKey" control={form.control} render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>{t("enableApiKey")}</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange}/></FormControl>
                </FormItem>
              )}/>
              {enableAPIKey && (
                <p className="text-xs text-muted-foreground">{t("apiKeyOnce")}</p>
              )}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? t("creating") : t("create")}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
