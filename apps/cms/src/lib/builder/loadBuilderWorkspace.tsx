import { notFound, redirect } from "next/navigation"
import { getPayload } from "payload"
import { headers } from "next/headers"
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
  if (!email) {
    const headerStore = await headers()
    const localSessionHref = isLocalPreviewSessionBypass(headerStore) ? "/api/builder/dev-session" : null
    return <BuilderAuthGate intent={intent} localSessionHref={localSessionHref} />
  }

  const payload = await getPayload({ config })
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
      email={email}
      initialMessages={thread?.messages ?? defaultBuilderMessages()}
      initialFacts={thread?.facts ?? null}
      initialClientSlug={clientSlug}
    />
  )
}
