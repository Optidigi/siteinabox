import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { getVerifiedPreviewCustomer } from "@/lib/auth/verifiedPreviewSession"
import {
  loadPreviewGrantAuthority,
  loadPreviewGrantContext,
  normalizePreviewClientSlug,
} from "@/lib/preview/previewAccess"

const loadPreviewCheckoutBase = async (
  clientSlug: string,
  requestHeaders?: Headers,
  requireActor = false,
) => {
  const t = await getTranslations("preview")
  const customer = await getVerifiedPreviewCustomer(requestHeaders ?? await headers())
  const customerEmail = customer?.account.email
  const previewUserId = customer?.account.previewUserId
  if (!customerEmail || (requireActor && !previewUserId)) {
    throw new Error(t("previewLoginRequired"))
  }

  const context = await loadPreviewGrantContext({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
    customerAuthority: customer!.authority,
    intent: requireActor ? "purchase" : "read",
    renewExpired: true,
  })
  return {
    context: { ...context, customerAuthority: customer!.authority },
    previewUserId: previewUserId ? String(previewUserId) : null,
  }
}

const loadPreviewDomainSearchBase = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => {
  const customer = await getVerifiedPreviewCustomer(requestHeaders ?? await headers())
  const customerEmail = customer?.account.email
  if (!customerEmail) throw new Error("Preview login is required.")
  return loadPreviewGrantAuthority({
    clientSlug: normalizePreviewClientSlug(clientSlug),
    email: customerEmail,
    customerAuthority: customer!.authority,
    intent: "purchase",
    renewExpired: true,
  })
}

export const requirePreviewCheckoutContext = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => (await loadPreviewCheckoutBase(clientSlug, requestHeaders)).context

/** Search-only authority. Do not use this for page access, payment, or writes. */
export const requirePreviewDomainSearchContext = async (
  clientSlug: string,
  requestHeaders?: Headers,
) => loadPreviewDomainSearchBase(clientSlug, requestHeaders)

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
