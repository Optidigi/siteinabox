import { notFound, redirect } from "next/navigation"
import { getPayload } from "payload"
import { headers, cookies } from "next/headers"
import { localeCookieName, localeFromAcceptLanguage, resolveLocale } from "@/i18n/config"
import { recordAuthenticatedBuilderActivity } from "@/lib/preview/inactivePreviews"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { BuilderAuthGate } from "@/components/builder/BuilderAuthGate"
import { BuilderShell } from "@/components/builder/BuilderShell"
import { loadBuilderThread, saveBuilderThread } from "@/lib/builder/sessionStore"
import { defaultBuilderMessages } from "@/lib/builder/thread"
import { previewAuth } from "@/lib/preview/betterAuth"
import { hasActivePreviewGrant, loadLatestActivePreviewGrant } from "@/lib/preview/previewAccess"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { isLocalPreviewSessionBypass } from "@/lib/requestAuthority"
import config from "@/payload.config"

export async function renderBuilderWorkspace({
  intent,
  requiredClientSlug,
}: {
  intent: "login" | "register"
  requiredClientSlug?: string
}) {
  if (!(await isPreviewHost())) notFound()

  const session = await previewAuth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email || session?.user.emailVerified !== true) {
    const headerStore = await headers()
    if (isLocalPreviewSessionBypass(headerStore)) {
      return <BuilderAuthGate intent={intent} localSessionHref="/api/builder/dev-session" />
    }
    redirect(intent === "register" ? "/login?intent=register" : "/login")
  }

  const payload = await getPayload({ config })
  await recordAuthenticatedBuilderActivity(payload, email)
  const quotaService = new BuilderQuotaService(payload)
  const remaining = quotaService.view(await quotaService.account(email)).remaining
  const locale = resolveLocale((await cookies()).get(localeCookieName)?.value, localeFromAcceptLanguage((await headers()).get("accept-language")))
  if (requiredClientSlug) {
    const allowed = await hasActivePreviewGrant(email, requiredClientSlug, payload)
    if (!allowed) redirect("/builder")
  }

  let thread = await loadBuilderThread(payload, email)
  const grant = await loadLatestActivePreviewGrant(email, payload)
  const clientSlug = requiredClientSlug ?? thread?.clientSlug ?? grant?.clientSlug ?? null
  if (thread && clientSlug && thread.clientSlug !== clientSlug) {
    thread = await saveBuilderThread(payload, { ...thread, clientSlug })
  }

  return (
    <BuilderShell
      locale={locale}
      initialRemaining={remaining}
      email={email}
      initialMessages={thread?.messages ?? defaultBuilderMessages()}
      initialFacts={thread?.facts ?? null}
      initialClientSlug={clientSlug}
    />
  )
}
