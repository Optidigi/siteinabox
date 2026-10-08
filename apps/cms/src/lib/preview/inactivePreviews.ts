import type { Payload, PayloadRequest } from "payload"
import { z } from "zod"
import { relationshipId } from "@/lib/relationshipId"
import type { PreviewAccessGrant } from "@/payload-types"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { quotaAccountSchema } from "@/lib/builder/quotaSchemas"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import { sendEmail, asMailLogPayload } from "@/lib/email/sendEmail"

export const inactivePreviewPolicySchema = z.object({ enabled: z.boolean(), inactiveDays: z.number().int().min(1).max(365), noticeDays: z.number().int().min(1).max(30) }).strict().refine((policy) => policy.noticeDays < policy.inactiveDays, "Notice must precede inactivity expiry.")
// A02 is an engineering default. No customer expiry or notice activates until
// the retention/disclosure review ratifies the configured policy.
export const inactivePreviewPolicy = inactivePreviewPolicySchema.parse({ enabled: false, inactiveDays: 30, noticeDays: 7 })
const DAY = 86_400_000

export function inactivePreviewDecision(input: {
  now: number; activityAt: string; policy: z.infer<typeof inactivePreviewPolicySchema>;
  exempt: boolean; expiredAt?: string | null; noticeState?: string | null;
  noticeActivityAt?: string | null; noticeSentAt?: string | null; expiresAt?: string | null;
}): "skip" | "notice" | "expire" {
  const policy = inactivePreviewPolicySchema.parse(input.policy)
  const activity = Date.parse(input.activityAt)
  if (!policy.enabled || input.exempt || input.expiredAt || !Number.isFinite(activity) || input.now < activity + (policy.inactiveDays - policy.noticeDays) * DAY) return "skip"
  if (input.noticeState && input.noticeActivityAt === input.activityAt) {
    const sent = Date.parse(input.noticeSentAt ?? ""), expiry = Date.parse(input.expiresAt ?? "")
    return input.noticeState === "sent" && Number.isFinite(sent) && Number.isFinite(expiry) && input.now >= Math.max(expiry, sent + policy.noticeDays * DAY) ? "expire" : "skip"
  }
  return "notice"
}

export async function recordAuthenticatedBuilderActivity(payload: Payload, email: string): Promise<void> {
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const customerEmail = z.email().parse(email.trim().toLowerCase())
  await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    const owner = await service.account(customerEmail, req)
    const lastActivityAt = new Date().toISOString()
    if (owner) await service.cas("builder-quota-accounts", owner, { lastActivityAt }, quotaAccountSchema, req)
    else {
      assertLiveBuilderTransaction(payload, req)
      await payload.create({ collection: "builder-quota-accounts", req, overrideAccess: true, data: { customerEmail, lastActivityAt, visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 0, attempts: 0, revision: 0, ingressRequests: 0, ingressDay: "1970-01-01" } })
    }
  }))
}

async function protectedObligations(payload: Payload, grant: PreviewAccessGrant, req: Partial<PayloadRequest>): Promise<boolean> {
  const tenant = relationshipId(grant.tenant)
  if (!tenant) return true
  const guarded = () => assertLiveBuilderTransaction(payload, req)
  // Conservative exemptions: accepted commercial/legal evidence, any payment
  // or domain/billing claim, customer CMS membership, or a published snapshot.
  guarded()
  const orders = await payload.find({ collection: "orders", where: { or: [{ tenant: { equals: tenant } }, { customerEmail: { equals: grant.customerEmail } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  if (orders.docs.length) return true
  guarded()
  const approvals = await payload.find({ collection: "site-approvals", where: { tenant: { equals: tenant } }, limit: 1, depth: 0, overrideAccess: true, req })
  if (approvals.docs.length) return true
  guarded()
  const memberships = await payload.find({ collection: "users", where: { "tenants.tenant": { equals: tenant } }, limit: 1, depth: 0, overrideAccess: true, req })
  if (memberships.docs.length) return true
  for (const collection of ["managed-domains", "domain-migrations", "billing-agreements", "domain-renewal-cycles", "payment-attempts", "published-site-snapshots"] as const) {
    guarded()
    const found = await payload.find({ collection, where: { tenant: { equals: tenant } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (found.docs.length) return true
  }
  return false
}

/** Bounded batch; the caller persists/continues nextAfterId. Never deletes data. */
export async function processInactivePreviews(payload: Payload, options: {
  afterId?: number; limit?: number; policy?: z.infer<typeof inactivePreviewPolicySchema>;
  sendNotice?: typeof sendEmail;
} = {}): Promise<{ examined: number; notices: number; expired: number; unknown: number; nextAfterId: number | null }> {
  const policy = inactivePreviewPolicySchema.parse(options.policy ?? inactivePreviewPolicy)
  if (!policy.enabled) return { examined: 0, notices: 0, expired: 0, unknown: 0, nextAfterId: null }
  const afterId = z.number().int().nonnegative().parse(options.afterId ?? 0)
  const limit = z.number().int().min(1).max(100).parse(options.limit ?? 20)
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const batch = await payload.find({ collection: "preview-access-grants", where: { id: { greater_than: afterId } }, sort: "id", limit, depth: 0, overrideAccess: true })
  let notices = 0, expired = 0, unknown = 0
  for (const candidate of batch.docs) {
    const claimed = await service.retry(() => service.transaction(async (req) => {
      await service.lockGlobal(req)
      assertLiveBuilderTransaction(payload, req)
      const grant = await payload.findByID({ collection: "preview-access-grants", id: candidate.id, depth: 0, overrideAccess: true, req })
      const account = await service.account(grant.customerEmail.trim().toLowerCase(), req)
      const activityAt = account?.lastActivityAt ?? grant.createdAt
      const exempt = grant.revokedAt != null || await protectedObligations(payload, grant, req)
      const now = Date.now()
      const decision = inactivePreviewDecision({ now, activityAt, policy, exempt, expiredAt: grant.inactiveExpiredAt,
        noticeState: grant.inactiveNoticeState, noticeActivityAt: grant.inactiveNoticeActivityAt,
        noticeSentAt: grant.inactiveNoticeSentAt, expiresAt: grant.inactiveExpiresAt })
      if (decision === "skip") return null
      assertLiveBuilderTransaction(payload, req)
      if (decision === "expire") {
        await payload.update({ collection: "preview-access-grants", id: grant.id, req, overrideAccess: true, data: { inactiveExpiredAt: new Date(now).toISOString(), revokedAt: new Date(now).toISOString() } })
        return { kind: "expire" as const, grant }
      }
      const claimAt = new Date(now).toISOString()
      const expiresAt = new Date(Math.max(Date.parse(activityAt) + policy.inactiveDays * DAY, now + policy.noticeDays * DAY)).toISOString()
      await payload.update({ collection: "preview-access-grants", id: grant.id, req, overrideAccess: true, data: { inactiveNoticeState: "sending", inactiveNoticeClaimedAt: claimAt, inactiveNoticeActivityAt: activityAt, inactiveNoticeSentAt: null, inactiveExpiresAt: expiresAt } })
      return { kind: "notice" as const, grant, claimAt, activityAt, expiresAt }
    }))
    if (!claimed) continue
    if (claimed.kind === "expire") { expired++; continue }
    // Verify durable claim after commit before the external mail boundary.
    const durable = await payload.findByID({ collection: "preview-access-grants", id: claimed.grant.id, depth: 0, overrideAccess: true })
    if (durable.inactiveNoticeState !== "sending" || durable.inactiveNoticeClaimedAt !== claimed.claimAt) { unknown++; continue }
    try {
      const url = `https://admin.siteinabox.nl/builder/${encodeURIComponent(claimed.grant.clientSlug)}`
      const text = `Je onbetaalde websitevoorbeeld verloopt na inactiviteit op ${claimed.expiresAt}. Open je voorbeeld om het te behouden: ${url}\nYour unpaid website preview expires after inactivity on ${claimed.expiresAt}. Open your preview to keep it: ${url}`
      await (options.sendNotice ?? sendEmail)({ to: claimed.grant.customerEmail, subject: "Websitevoorbeeld verloopt / Website preview expiry", text, html: `<p>${text}</p>`, intent: "preview.expiry_notice", payload: asMailLogPayload(payload) })
      await service.retry(() => service.transaction(async (req) => {
        await service.lockGlobal(req)
        assertLiveBuilderTransaction(payload, req)
        const result = await payload.update({ collection: "preview-access-grants", where: { and: [{ id: { equals: claimed.grant.id } }, { inactiveNoticeClaimedAt: { equals: claimed.claimAt } }, { inactiveNoticeState: { equals: "sending" } }] }, req, overrideAccess: true, data: { inactiveNoticeState: "sent", inactiveNoticeSentAt: new Date().toISOString() } })
        if (result.docs.length !== 1) throw new Error("preview_notice_claim_lost")
      }))
      notices++
    } catch {
      // Unknown delivery is retained and never silently retried or expired.
      unknown++
    }
  }
  return { examined: batch.docs.length, notices, expired, unknown, nextAfterId: batch.docs.length === limit ? batch.docs.at(-1)?.id ?? null : null }
}
