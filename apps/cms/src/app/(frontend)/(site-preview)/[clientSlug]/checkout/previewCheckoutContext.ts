import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"

export const requirePreviewCheckoutContext = async (clientSlug: string, requestHeaders?: Headers) => {
  const t = await getTranslations("preview")
  const session = await previewAuth.api.getSession({
    headers: requestHeaders ?? await headers(),
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  if (!customerEmail) throw new Error(t("previewLoginRequired"))

  return loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
  })
}

export const requirePreviewCheckoutActorContext = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => {
  const t = await getTranslations("preview")
  const session = await previewAuth.api.getSession({
    headers: requestHeaders ?? await headers(),
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  const previewUserId = session?.user?.id
  if (!customerEmail || !previewUserId) throw new Error(t("previewLoginRequired"))
  const context = await loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
  })
  return {
    ...context,
    previewUserId: String(previewUserId),
  }
}
