"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Mail } from "lucide-react"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/components/button"
import { Input } from "@siteinabox/ui/components/input"
import { requestBuilderMagicLinkAction } from "@/lib/actions/requestBuilderMagicLink"
import { BuilderLogo } from "@/components/builder/BuilderLogo"
import { BuilderThemeToggle } from "@/components/builder/BuilderThemeToggle"

const initialState = { ok: false, message: "" }

export function BuilderAuthGate({
  intent,
  localSessionHref = null,
}: {
  intent: "login" | "register"
  localSessionHref?: string | null
}) {
  const t = useTranslations("auth")
  const [state, formAction, pending] = useActionState(requestBuilderMagicLinkAction, initialState)
  const isRegister = intent === "register"
  const termsHref = CURRENT_INTAKE_TERMS_ACCEPTANCE.url
  const title = isRegister ? t("createAccount") : t("signIn")

  return (
    <div data-siab-builder className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between border-b-2 border-[var(--border)] bg-[var(--card)] px-5 py-4">
        <BuilderLogo />
        <BuilderThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center p-4 sm:items-center sm:p-8">
        <form action={formAction} className="w-full max-w-md border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Site in a Box
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--card-foreground)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {t("createAccountSubtitle")}
          </p>
          <input type="hidden" name="intent" value={intent} />

          {isRegister ? (
            <div className="mt-5 grid gap-1.5">
              <label htmlFor="builder-register-name" className="text-sm font-semibold">{t("name")}</label>
              <Input id="builder-register-name" name="displayName" required minLength={2} autoComplete="name" />
            </div>
          ) : null}

          <div className="mt-4 grid gap-1.5">
            <label htmlFor="builder-register-email" className="text-sm font-semibold">{t("email")}</label>
            <Input
              id="builder-register-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
            />
          </div>

          {isRegister ? (
            <div className="mt-5 flex flex-col gap-3 border-t-2 border-[var(--border)] pt-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" name="businessUseAccepted" required className="mt-1 size-4 shrink-0" />
                <span>{t("businessUse")}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" name="termsAccepted" required className="mt-1 size-4 shrink-0" />
                <span>
                  {t("termsAcceptLead")}{" "}
                  <a className="font-semibold underline" href={termsHref} target="_blank" rel="noopener noreferrer">
                    {t("termsLinkLabel")}
                  </a>
                  .
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" name="marketingOptIn" className="mt-1 size-4 shrink-0" />
                <span className="text-[var(--muted-foreground)]">{t("marketingOptIn")}</span>
              </label>
            </div>
          ) : null}

          <Button type="submit" variant="brand" disabled={pending} className="mt-6 w-full">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
            {isRegister ? t("sendRegisterLink") : t("continueWithMagicLink")}
          </Button>

          {state.message ? (
            <p role={state.ok ? "status" : "alert"} className={`mt-3 text-sm ${state.ok ? "text-[var(--muted-foreground)]" : "text-[var(--destructive)]"}`}>
              {state.ok ? t("magicLinkGenericSuccess") : state.message}
            </p>
          ) : null}

          {localSessionHref ? (
            <p className="mt-6 text-sm text-[var(--muted-foreground)]">
              Lokale ontwikkeling:{" "}
              <a className="font-semibold underline" href={localSessionHref}>
                open builder zonder e-mail
              </a>
              .
            </p>
          ) : null}

          <p className="mt-6 text-sm text-[var(--muted-foreground)]">
            {isRegister ? t("haveAccount") : t("noAccount")}{" "}
            <a className="font-semibold underline" href={isRegister ? "/login" : "/login?intent=register"}>
              {isRegister ? t("signIn") : t("register")}
            </a>
          </p>
        </form>
      </main>
    </div>
  )
}
