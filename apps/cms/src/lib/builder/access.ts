import type { Payload, PayloadRequest } from "payload"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { previewClientSlugFromDomain } from "@/lib/preview/previewAccess"
import { assertLiveBuilderTransaction } from "./quotaTransaction"
import { normalizeBuilderEmail } from "./thread"

/** Internal authorization fence. The HTTP caller must also verify its session. */
export async function assertBuilderAccountEligible(
  payload: Payload,
  email: string,
  req?: Partial<PayloadRequest>,
): Promise<void> {
  const customerEmail = normalizeBuilderEmail(email)
  if (!customerEmail) throw new Error("builder_account_unavailable")
  const fence = () => { if (req) assertLiveBuilderTransaction(payload, req) }
  fence()
  const users = await payload.find({ collection: "users", where: { email: { equals: customerEmail } }, limit: 1, depth: 0, overrideAccess: true, req })
  // Paid membership never grants an additional AI editing entitlement.
  if (users.docs.length) throw new Error("builder_customer_cms_only")
  fence()
  const orders = await payload.find({
    collection: "orders", where: { and: [
      { customerEmail: { equals: customerEmail } },
      { or: [
        { acceptedAt: { exists: true } },
        { paymentStatus: { in: ["paid", "partially_refunded", "refunded", "chargeback"] } },
      ] },
    ] }, limit: 1, depth: 0, overrideAccess: true, req,
  })
  if (orders.docs.length) throw new Error("builder_checkout_frozen")
  fence()
  const sessions = await payload.find({ collection: "builder-sessions", where: { customerEmail: { equals: customerEmail } }, limit: 1, depth: 0, overrideAccess: true, req })
  const clientSlug = sessions.docs[0]?.clientSlug
  if (!clientSlug) return
  fence()
  const grants = await payload.find({
    collection: "preview-access-grants", where: { and: [
      { customerEmail: { equals: customerEmail } }, { clientSlug: { equals: clientSlug } },
      { revokedAt: { exists: false } }, { expiresAt: { greater_than: new Date().toISOString() } },
    ] }, limit: 1, sort: "-updatedAt", depth: 0, overrideAccess: true, req,
  })
  const grant = grants.docs[0]
  if (!grant) throw new Error("builder_preview_revoked")
  const tenantId = relationshipId(grant.tenant)
  const runId = relationshipId(grant.generationRun)
  if (!tenantId || !runId) throw new Error("builder_preview_unavailable")
  fence()
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true, req })
  if (tenant.status === "archived" || tenant.status === "suspended" || previewClientSlugFromDomain(tenant.domain, tenant.slug) !== clientSlug) throw new Error("builder_preview_unavailable")
  fence()
  const run = await payload.findByID({ collection: "site-generation-runs", id: runId, depth: 0, overrideAccess: true, req })
  if (run.status !== "preview_ready" || !sameRelationshipId(run.tenant, tenant.id)) throw new Error("builder_preview_unavailable")
}
