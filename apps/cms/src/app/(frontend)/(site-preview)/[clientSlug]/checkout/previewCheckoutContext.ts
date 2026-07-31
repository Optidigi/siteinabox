import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"

const loadPreviewCheckoutBase = async (
  clientSlug: string,
  requestHeaders?: Headers,
  requireActor = false,
) => {
  const t = await getTranslations("preview")
  const session = await previewAuth.api.getSession({
    headers: requestHeaders ?? await headers(),
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  const previewUserId = session?.user?.id
  if (!customerEmail || (requireActor && !previewUserId)) {
    throw new Error(t("previewLoginRequired"))
  }

  const context = await loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
  })
  return {
    context,
    previewUserId: previewUserId ? String(previewUserId) : null,
  }
}

export const requirePreviewCheckoutContext = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => (await loadPreviewCheckoutBase(clientSlug, requestHeaders)).context

export const requirePreviewCheckoutActorContext = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => {
  const { context, previewUserId } = await loadPreviewCheckoutBase(
    clientSlug,
    requestHeaders,
    true,
  )
  if (!previewUserId) throw new Error("Preview actor identity is required.")
  return {
    ...context,
    previewUserId,
  }
}
