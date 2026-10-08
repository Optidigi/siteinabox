"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { Alert, AlertDescription } from "@siteinabox/ui/components/alert"
import { AlertTriangle, Mail } from "lucide-react"
import { validateNextRedirect } from "@/lib/auth/validateNextRedirect"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"
import { authClient } from "@/lib/auth-client"
import { requestUnifiedMagicLinkAction } from "@/lib/actions/requestUnifiedMagicLink"

const createSchema = (t: (key: string) => string, isRegister: boolean) => z.object({
  email: z.string().email(t("validEmail")),
  password: z.string().optional(),
  displayName: isRegister
    ? z.string().trim().min(2, t("nameRequired"))
    : z.string().optional(),
  businessUseAccepted: isRegister
    ? z.boolean().refine((value) => value === true, t("termsRequired"))
    : z.boolean().optional(),
  termsAccepted: isRegister
    ? z.boolean().refine((value) => value === true, t("termsRequired"))
    : z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
})

const ERROR_KEYS: Record<string, string> = {
  "wrong-host": "wrongHost",
  "super-admin-on-tenant-host": "superAdminOnSiteHost",
  "cross-tenant": "crossSite",
  "no-user": "noUser",
  forbidden: "forbidden",
  "social-unlinked": "socialUnlinked",
  "social-session": "socialSession",
  "magic-link-session": "magicLinkSession"
}

export function LoginForm({
  unifyPublicAuth = false,
}: {
  unifyPublicAuth?: boolean
}) {
  const t = useTranslations("auth")
  const router = useRouter()
  const params = useSearchParams()
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const [passwordMode, setPasswordMode] = useState(false)
  const isRegister = unifyPublicAuth && params.get("intent") === "register"
  const showCmsPassword = params.get("intent") === "operator" && !isRegister
  const errorParam = params.get("error")
  const errorCopy = errorParam
    ? ERROR_KEYS[errorParam]
      ? t(ERROR_KEYS[errorParam])
      : t("signInError", { error: errorParam })
    : null
  const schema = createSchema(t, isRegister)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      businessUseAccepted: false,
      termsAccepted: false,
      marketingOptIn: false,
    }
  })

  const onPasswordSignIn = async (values: z.infer<typeof schema>) => {
    if (!showCmsPassword) return
    if (!values.password) {
      form.setError("password", { message: t("passwordRequired") })
      return
    }
    setPending(true)
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: values.email, password: values.password })
    })
    setPending(false)
    if (!res.ok) {
      status.error(t("invalidCredentials"))
      return
    }
    const next = validateNextRedirect(params.get("next"))
    router.replace(next)
  }

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (passwordMode && showCmsPassword) {
      await onPasswordSignIn(values)
      return
    }
    if (unifyPublicAuth) {
      await onUnifiedMagicLink(values)
      return
    }
    await onMagicLinkSignIn()
  }

  const onUnifiedMagicLink = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const formData = new FormData()
    formData.set("intent", isRegister ? "register" : "login")
    formData.set("email", values.email)
    if (isRegister) {
      formData.set("displayName", values.displayName ?? "")
      if (values.businessUseAccepted) formData.set("businessUseAccepted", "true")
      if (values.termsAccepted) formData.set("termsAccepted", "true")
      if (values.marketingOptIn) formData.set("marketingOptIn", "true")
    }
    const result = await requestUnifiedMagicLinkAction({ ok: false, message: "" }, formData)
    setPending(false)
    if (result.ok) status.success(result.message || t("magicLinkGenericSuccess"))
    else status.error(result.message || t("magicLinkFailed"))
  }

  const onMagicLinkSignIn = async () => {
    const validEmail = await form.trigger("email")
    if (!validEmail) return

    setPending(true)
    const next = validateNextRedirect(params.get("next"))
    await authClient.signIn.magicLink(
      {
        email: form.getValues("email"),
        callbackURL: `/api/siab-auth/complete?next=${encodeURIComponent(next)}`,
        errorCallbackURL: "/login?error=magic-link-session",
      },
      {
        onSuccess: () => {
          setPending(false)
          status.success(t("magicLinkSent"))
        },
        onError: () => {
          setPending(false)
          status.error(t("magicLinkFailed"))
        },
      }
    )
  }

  const togglePasswordMode = () => {
    setPasswordMode((current) => {
      const next = !current
      if (!next) {
        form.clearErrors("password")
        form.setValue("password", "")
      }
      return next
    })
  }

  const termsHref = CURRENT_INTAKE_TERMS_ACCEPTANCE.url

  return (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errorCopy && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <AlertDescription>{errorCopy}</AlertDescription>
          </Alert>
        )}
        <h2 className="text-left text-xl font-semibold">{isRegister ? t("createAccount") : t("signIn")}</h2>
        {isRegister ? (
          <p className="text-sm text-muted-foreground">{t("createAccountSubtitle")}</p>
        ) : null}
        {isRegister ? (
          <FormField name="displayName" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("name")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        ) : null}
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <div className="flex items-center">
              <FormLabel>{t("email")}</FormLabel>
              {showCmsPassword && (
                <Button
                  type="button"
                  variant="link"
                  className="ml-auto h-auto p-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={togglePasswordMode}
                >
                  {passwordMode ? t("magicLinkLogin") : t("passwordLogin")}
                </Button>
              )}
            </div>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={passwordMode ? "next" : "send"}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        {passwordMode && showCmsPassword && (
          <FormField name="password" control={form.control} render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel>{t("password")}</FormLabel>
                <a className="ml-auto text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" href="/forgot-password">{t("forgotPassword")}</a>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        )}
        {isRegister ? (
          <div className="grid gap-3 border-t pt-4">
            <FormField name="businessUseAccepted" control={form.control} render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  <span>{t("businessUse")}</span>
                </label>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField name="termsAccepted" control={form.control} render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  <span>
                    {t("termsAcceptLead")}{" "}
                    <a className="font-semibold underline" href={termsHref} target="_blank" rel="noopener noreferrer">
                      {t("termsLinkLabel")}
                    </a>
                    .
                  </span>
                </label>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField name="marketingOptIn" control={form.control} render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  <span>{t("marketingOptIn")}</span>
                </label>
              </FormItem>
            )}/>
          </div>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {!passwordMode && <Mail aria-hidden />}
          {pending
            ? passwordMode
              ? t("signingIn")
              : t("sending")
            : passwordMode
              ? t("signIn")
              : isRegister
                ? t("sendRegisterLink")
                : t("continueWithMagicLink")}
        </Button>
        {passwordMode && showCmsPassword && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="w-full"
            onClick={() => {
              if (unifyPublicAuth) void onUnifiedMagicLink(form.getValues())
              else void onMagicLinkSignIn()
            }}
          >
          <Mail aria-hidden />
          {pending ? t("sending") : t("continueWithMagicLink")}
          </Button>
        )}
        {unifyPublicAuth ? (
          <p className="text-sm text-muted-foreground">
            {isRegister ? t("haveAccount") : t("noAccount")}{" "}
            <a className="font-semibold underline" href={isRegister ? "/login" : "/login?intent=register"}>
              {isRegister ? t("signIn") : t("register")}
            </a>
          </p>
        ) : null}
      </form>
    </Form>
  )
}
