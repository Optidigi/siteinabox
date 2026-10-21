import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { BuilderAuthGate } from "@/components/builder/BuilderAuthGate"
import { BuilderShell } from "@/components/builder/BuilderShell"
import { loadBuilderThread, saveBuilderThread } from "@/lib/builder/sessionStore"
import { defaultBuilderMessages } from "@/lib/builder/thread"
import { getVerifiedPreviewCustomer } from "@/lib/auth/verifiedPreviewSession"
import { CustomerAccessNotice } from "@/components/builder/CustomerAccessNotice"
import { loadVerifiedCustomerGrant } from "@/lib/preview/previewAccess"
import { CustomerIdentityError } from "@/lib/auth/verifiedCustomer"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { isLocalPreviewSessionBypass } from "@/lib/requestAuthority"

export async function renderBuilderWorkspace({
  intent,
  requiredClientSlug,
}: {
  intent: "login" | "register"
  requiredClientSlug?: string
}) {
  if (!(await isPreviewHost())) notFound()

  let customer
  try { customer = await getVerifiedPreviewCustomer(await headers()) }
  catch (error) { return <CustomerAccessNotice error={error} /> }
  if (!customer) {
    const headerStore = await headers()
    if (isLocalPreviewSessionBypass(headerStore)) {
      return <BuilderAuthGate intent={intent} localSessionHref="/api/builder/dev-session" />
    }
    redirect(intent === "register" ? "/login?intent=register" : "/login")
  }

  const { payload, account } = customer
  const email = account.email
  let preview
  try {
    preview = await loadVerifiedCustomerGrant({ payload, email, authority: customer.authority, clientSlug: requiredClientSlug })
  } catch (error) {
    if (!(error instanceof CustomerIdentityError) && requiredClientSlug &&
        error instanceof Error && error.message === "Preview access is not available") redirect("/builder")
    return <CustomerAccessNotice error={error} />
  }
  let thread = await loadBuilderThread(payload, email, account.id)
  if (!thread) return <BuilderAuthGate intent="register" />
  const clientSlug = preview?.clientSlug ?? null
  if (thread && clientSlug && thread.clientSlug !== clientSlug) {
    thread = await saveBuilderThread(payload, { ...thread, clientSlug }, account.id)
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
