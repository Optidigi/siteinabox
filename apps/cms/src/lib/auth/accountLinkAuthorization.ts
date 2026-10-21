import "server-only"
import type { Payload } from "payload"
import type { AccountLinkTarget } from "./accountLinkTypes"
import { AccountLinkError } from "./accountLinkTypes"
import { asRecord } from "@/lib/record"
import { relationshipId } from "@/lib/relationshipId"
import { assertPreviewCustomerActive } from "./payloadCustomerAccess"

export async function authorizeSdkAccountLink(payload: Payload, namespace: "cms" | "preview", input: {
  email: string; origin: string; callbackPath: string; errorCallbackPath: string; metadata: unknown
}): Promise<AccountLinkTarget> {
  const recipient = input.email.trim().toLowerCase()
  const target = { namespace, recipient, origin: input.origin, callbackPath: input.callbackPath,
    errorCallbackPath: input.errorCallbackPath }
  if (namespace === "cms") {
    const { authorizeCmsMagicLink } = await import("./sendCmsMagicLinkEmail")
    const { user, intent } = await authorizeCmsMagicLink({ email: recipient, url: input.origin, metadata: input.metadata })
    return { ...target, purpose: intent === "user_invite" ? "invitation" : intent === "site_live_handoff" ? "site_handoff" : "cms_login",
      lane: "protected", payloadUserId: String(user.id), role: user.role,
      tenantId: relationshipId(user.tenants?.[0]?.tenant) ?? undefined }
  }
  await assertPreviewCustomerActive(payload, { email: recipient })
  const metadata = asRecord(input.metadata)
  const clientSlug = typeof metadata?.previewClientSlug === "string" ? metadata.previewClientSlug.trim() : ""
  let grantTenant: string | undefined
  if (clientSlug) {
    const { loadPreviewGrantAuthority } = await import("@/lib/preview/previewAccess")
    try { grantTenant = String((await loadPreviewGrantAuthority({ email: recipient, clientSlug })).tenant.id) }
    catch { throw new AccountLinkError("E_ACCOUNT_LINK_TARGET") }
  }
  if (metadata?.previewSiteReady === true) {
    const { isPrivilegedPreviewSiteReadyMetadata } = await import("@/lib/preview/trustedSiteReadyIntent")
    if (!isPrivilegedPreviewSiteReadyMetadata({ email: recipient, clientSlug, metadata })) throw new AccountLinkError("E_ACCOUNT_LINK_AUTHORITY")
  }
  const account = (await payload.find({ collection: "customer-accounts", where: { email: { equals: recipient } },
    depth: 0, limit: 2, overrideAccess: true })).docs
  if (account.length > 1) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
  if (grantTenant && account[0]?.tenant && relationshipId(account[0].tenant) !== grantTenant) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
  return { ...target, purpose: metadata?.previewSiteReady === true ? "site_handoff" : clientSlug || account[0] ? "preview_login" : "free_verification",
    lane: account[0] ? "returning" : "acquisition", previewUserId: account[0]?.previewUserId,
    tenantId: grantTenant ?? relationshipId(account[0]?.tenant) ?? undefined,
    metadata: clientSlug ? { previewClientSlug: clientSlug } : undefined }
}

export async function assertAccountLinkTargetCurrent(payload: Payload, target: AccountLinkTarget) {
  if (target.namespace === "cms") {
    const { resolvePayloadUserForMagicLink } = await import("@/lib/socialAuth/payloadUser")
    const user = await resolvePayloadUserForMagicLink(target.recipient)
    if (String(user.id) !== target.payloadUserId || user.role !== target.role ||
      (relationshipId(user.tenants?.[0]?.tenant) ?? undefined) !== target.tenantId) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
    return
  }
  await assertPreviewCustomerActive(payload, { email: target.recipient, previewUserId: target.previewUserId })
  const slug = target.metadata?.previewClientSlug
  if (typeof slug === "string" && slug) {
    const { loadPreviewGrantAuthority } = await import("@/lib/preview/previewAccess")
    try {
      const grant = await loadPreviewGrantAuthority({ email: target.recipient, clientSlug: slug })
      if (String(grant.tenant.id) !== target.tenantId) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
    } catch { throw new AccountLinkError("E_ACCOUNT_LINK_TARGET") }
  }
}
