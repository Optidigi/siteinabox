// Backend authority also loads through Payload's owning configuration CLI.
import type { Payload, PayloadRequest } from "payload"
import { relationshipId } from "@/lib/relationshipId"
import { initialPaymentIsFinanciallySecured } from "@/lib/payments/initialPaymentPolicy"
import { normalizePublicDomainHost } from "@siteinabox/contracts"

export async function hasManualWorkspaceAccess(payload: Payload, tenantId: string, req?: Partial<PayloadRequest>): Promise<boolean> {
  const accounts = await payload.find({ collection: "customer-accounts", overrideAccess: true, req,
    depth: 0, limit: 1, where: { tenant: { equals: tenantId } } })
  // Preserve existing operator-provisioned CMS access. A verified builder
  // workspace is bound atomically by M14 and cannot enter this legacy path.
  // Compatibility is not a new commercial entitlement or payment transition.
  if (accounts.totalDocs === 0) return true
  const orders = await payload.find({ collection: "orders", overrideAccess: true, req, depth: 0, limit: 100,
    where: { and: [{ tenant: { equals: tenantId } }, { paymentStatus: { equals: "paid" } },
      { state: { in: ["fulfillment_pending", "fulfilled"] } }] } })
  if (orders.totalDocs > 100) return false
  for (const order of orders.docs) {
    const attempts = await payload.find({ collection: "payment-attempts", overrideAccess: true, req, depth: 0, limit: 2,
      where: { and: [{ order: { equals: order.id } }, { purpose: { equals: "first_payment" } },
        { state: { in: ["paid", "refund_failed"] } }] } })
    if (attempts.totalDocs !== 1) continue
    const attempt = attempts.docs[0]!
    if (relationshipId(order.tenant) === tenantId && relationshipId(attempt.tenant) === tenantId &&
      initialPaymentIsFinanciallySecured(order, attempt)) return true
  }
  return false
}

export async function canRepublishWorkspace(payload: Payload, tenantId: string, req?: Partial<PayloadRequest>): Promise<boolean> {
  if (!await hasManualWorkspaceAccess(payload, tenantId, req)) return false
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true, req })
  const domain = normalizePublicDomainHost(tenant.domain)
  if (tenant.status !== "active" || !domain) return false
  // A paid private workspace is not first-live authority. Existing snapshots
  // establish republish history even on older tenants without the pointer.
  const snapshots = await payload.find({ collection: "published-site-snapshots", overrideAccess: true, req, depth: 0, limit: 1,
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: "active" } }, { domain: { equals: domain } }] } })
  return snapshots.docs.some(snapshot => snapshot.status === "active" && relationshipId(snapshot.tenant) === tenantId &&
    normalizePublicDomainHost(snapshot.domain) === domain)
}
