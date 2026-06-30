"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { Separator } from "@siteinabox/ui/components/separator"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@siteinabox/ui/components/form"
import { Alert, AlertDescription } from "@siteinabox/ui/components/alert"
import { AlertTriangle, Mail } from "lucide-react"
import { validateNextRedirect } from "@/lib/auth/validateNextRedirect"
import { useTranslations } from "next-intl"
import { useStatusFeedback } from "@/components/status-feedback"
import { authClient } from "@/lib/auth-client"
import { SOCIAL_AUTH_PROVIDER_LABELS, type SocialAuthProvider } from "@/lib/socialAuth/providers"

const createSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("validEmail")),
  password: z.string().optional(),
})

// FN-2026-0043 — surface a friendly inline alert for the documented gate
// reasons in src/lib/gateDecision.ts. The middleware bounces a tenant
// user from the super-admin host (or a super-admin from a tenant host)
// to /login?error=<reason> with no UI signal pre-fix; users would re-
// enter credentials and get the same redirect, looking identical to a
// password failure.
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

const SocialProviderIcon = ({ provider }: { provider: SocialAuthProvider }) => {
  if (provider === "apple") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 2h9.5v9.5H2zM12.5 2H22v9.5h-9.5zM2 12.5h9.5V22H2zM12.5 12.5H22V22h-9.5z" fill="currentColor" />
    </svg>
  )
}

export function LoginForm({
  socialProviders = [],
  allowPasswordLogin = false,
}: {
  socialProviders?: SocialAuthProvider[]
  allowPasswordLogin?: boolean
}) {
  const t = useTranslations("auth")
  const router = useRouter()
  const params = useSearchParams()
  const status = useStatusFeedback()
  const [pending, setPending] = useState(false)
  const [passwordMode, setPasswordMode] = useState(false)
  const errorParam = params.get("error")
  const errorCopy = errorParam
    ? ERROR_KEYS[errorParam]
      ? t(ERROR_KEYS[errorParam] as any)
      : t("signInError", { error: errorParam })
    : null
  const schema = createSchema(t)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  })

  const onPasswordSignIn = async (values: z.infer<typeof schema>) => {
    if (!allowPasswordLogin) return
    if (!values.password) {
      form.setError("password", { message: t("passwordRequired") })
      return
    }
    setPending(true)
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
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
    if (passwordMode && allowPasswordLogin) {
      await onPasswordSignIn(values)
      return
    }
    await onMagicLinkSignIn()
  }

  const onSocialSignIn = async (provider: SocialAuthProvider) => {
    setPending(true)
    const next = validateNextRedirect(params.get("next"))
    await authClient.signIn.social(
      {
        provider,
        requestSignUp: true,
        callbackURL: `/api/siab-auth/complete?next=${encodeURIComponent(next)}`,
        errorCallbackURL: "/login?error=social-session"
      },
      {
        onError: () => {
          setPending(false)
          status.error(t("socialSignInFailed"))
        }
      }
    )
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

  return (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errorCopy && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <AlertDescription>{errorCopy}</AlertDescription>
          </Alert>
        )}
        <h2 className="text-center text-xl font-semibold">{t("signIn")}</h2>
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <div className="flex items-center">
              <FormLabel>{t("email")}</FormLabel>
              {allowPasswordLogin && (
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
                className="rounded-lg"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        {passwordMode && allowPasswordLogin && (
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
                  className="rounded-lg"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        )}
        <Button type="submit" disabled={pending} className="w-full rounded-lg">
          {!passwordMode && <Mail aria-hidden />}
          {pending
            ? passwordMode
              ? t("signingIn")
              : t("sending")
            : passwordMode
              ? t("signIn")
              : t("continueWithMagicLink")}
        </Button>
        {passwordMode && allowPasswordLogin && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="w-full rounded-lg border-transparent ring-1 ring-foreground/25 dark:ring-foreground/30"
            onClick={() => void onMagicLinkSignIn()}
          >
          <Mail aria-hidden />
          {pending ? t("sending") : t("continueWithMagicLink")}
          </Button>
        )}
        {socialProviders.length > 0 && (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase text-muted-foreground">{t("or")}</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid gap-2">
          {socialProviders.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              disabled={pending}
              className="w-full rounded-lg border-transparent ring-1 ring-foreground/25 dark:ring-foreground/30"
              aria-label={t("continueWith", { provider: SOCIAL_AUTH_PROVIDER_LABELS[provider] })}
              onClick={() => void onSocialSignIn(provider)}
            >
              <SocialProviderIcon provider={provider} />
              <span>{t("continueWith", { provider: SOCIAL_AUTH_PROVIDER_LABELS[provider] })}</span>
            </Button>
          ))}
            </div>
          </>
        )}
      </form>
    </Form>
  )
}
