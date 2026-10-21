import { resolvePayloadUserForMagicLink } from "@/lib/socialAuth/payloadUser"
import { asMailLogPayload, getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { inviteTemplate } from "@/lib/email/templates/invite"
import { siteLiveNoticeTemplate } from "@/lib/email/templates/siteLiveNotice"
import { verifyPrivilegedMagicLinkMetadata } from "@/lib/auth/privilegedMagicLinkMetadata"
import { relationshipId } from "@/lib/relationshipId"
import { AccountLinkError } from "@/lib/auth/accountLinkTypes"

async function getMailPayload() {
  const [{ getPayload }, configModule] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  return getPayload({ config: configModule.default })
}

const metadataText = (metadata: unknown, key: string): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const metadataTenant = (metadata: unknown): string | number | null => {
  const value = metadataText(metadata, "tenantId")
  if (!value) return null
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && String(numeric) === value ? numeric : value
}

const privilegedMetadataMatchesRequest = (metadata: unknown, email: string, url: string): boolean => {
  const recipientEmail = metadataText(metadata, "recipientEmail")?.toLowerCase()
  const adminUrl = metadataText(metadata, "adminUrl")
  if (!recipientEmail || recipientEmail !== email.trim().toLowerCase() || !adminUrl) return false
  try {
    return new URL(url).origin === new URL(adminUrl).origin
  } catch {
    return false
  }
}

export async function authorizeCmsMagicLink(input: { email: string; url: string; metadata?: unknown }) {
  const user = await resolvePayloadUserForMagicLink(input.email)
  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (tenantId) {
    const tenant = await (await getMailPayload()).findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
    if (tenant.status === "archived" || tenant.status === "suspended") throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
  }
  const intent = metadataText(input.metadata, "intent")
  if (intent && intent !== "user_invite" && intent !== "site_live_handoff") throw new AccountLinkError("E_ACCOUNT_LINK_PURPOSE")
  if (intent === "user_invite" || intent === "site_live_handoff") {
    if (!verifyPrivilegedMagicLinkMetadata(input.metadata, intent) ||
      !privilegedMetadataMatchesRequest(input.metadata, input.email, input.url)) throw new AccountLinkError("E_ACCOUNT_LINK_AUTHORITY")
    const tenant = user.tenants?.[0]?.tenant
    if (!tenant || relationshipId(tenant) !== String(metadataTenant(input.metadata)) ||
      (intent === "user_invite" && user.role !== metadataText(input.metadata, "role"))) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
  }
  return { user, intent }
}

export async function sendCmsMagicLinkEmail(input: { email: string; url: string; metadata?: unknown; locale?: "nl" | "en" }) {
  const { intent } = await authorizeCmsMagicLink(input)

  if (intent === "user_invite") {
    if (!verifyPrivilegedMagicLinkMetadata(input.metadata, "user_invite") ||
      !privilegedMetadataMatchesRequest(input.metadata, input.email, input.url)) {
      throw new Error("Unsigned or invalid privileged invitation metadata.")
    }
    const tenantId = metadataTenant(input.metadata)
    const tenantName = metadataText(input.metadata, "tenantName")
    const recipientName = metadataText(input.metadata, "recipientName")
    const role = metadataText(input.metadata, "role")
    if (tenantId == null || !tenantName || !recipientName || !role || !["owner", "editor", "viewer"].includes(role)) {
      throw new Error("Invitation magic-link metadata is incomplete or invalid.")
    }
    const message = inviteTemplate({
      tenantName,
      recipientName,
      role: role as "owner" | "editor" | "viewer",
      inviteUrl: input.url,
    })
    await sendEmail({
      to: input.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      intent: "auth.magic_link",
      tenant: tenantId,
      payload: asMailLogPayload(await getMailPayload()),
    })
    return
  }

  if (intent === "site_live_handoff") {
    if (!verifyPrivilegedMagicLinkMetadata(input.metadata, "site_live_handoff") ||
      !privilegedMetadataMatchesRequest(input.metadata, input.email, input.url)) {
      throw new Error("Unsigned or invalid privileged live-handoff metadata.")
    }
    const siteUrl = metadataText(input.metadata, "siteUrl")
    const adminUrl = metadataText(input.metadata, "adminUrl")
    if (!siteUrl || !adminUrl) {
      throw new Error("Live handoff magic-link metadata is missing siteUrl or adminUrl.")
    }
    const message = siteLiveNoticeTemplate({ siteUrl, adminUrl, magicLoginUrl: input.url })
    await sendEmail({
      to: input.email,
      from: getPlatformMailSender(),
      subject: message.subject,
      html: message.html,
      text: message.text,
      intent: "site.live_notice",
      tenant: metadataTenant(input.metadata),
      payload: asMailLogPayload(await getMailPayload()),
    })
    return
  }

  const message = magicLinkTemplate({ loginUrl: input.url, locale: input.locale })
  await sendEmail({
    to: input.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    intent: "auth.magic_link",
    payload: asMailLogPayload(await getMailPayload()),
  })
}
