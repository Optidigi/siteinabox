import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { queryRows } from "@/lib/record"

export async function boundWorkspace(payload: Payload, key: string, domain: string | null, password = "Synthetic-password-42!") {
  const email = key + "@test.invalid"
  const inserted = queryRows<{ firstVerifiedAt: string | Date }>(await payload.db.drizzle.execute(sql`
    INSERT INTO preview_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
    VALUES(${key + '-source'},'Synthetic free',${email},true,now(),now()) RETURNING "firstVerifiedAt"`))
  const account = await payload.create({ collection: "customer-accounts", overrideAccess: true, data: {
    email, previewUserId: key + "-source", verifiedAt: new Date(inserted[0]!.firstVerifiedAt).toISOString(),
  } })
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, context: { skipProjection: true },
    data: { name: "Free workspace", slug: key, domain, status: "provisioning" } })
  await payload.update({ collection: "customer-accounts", id: account.id, overrideAccess: true, data: { tenant: tenant.id } })
  const user = await payload.create({ collection: "users", overrideAccess: true, data: {
    name: "Free owner", email, password, role: "owner", tenants: [{ tenant: tenant.id }],
  } })
  const page = await payload.create({ collection: "pages", overrideAccess: true, context: { skipProjection: true },
    data: { tenant: tenant.id, title: "Private AI draft", slug: "index", status: "draft", blocks: [] } })
  return { account, tenant, user, page }
}

export async function securedPayment(payload: Payload, tenantId: number, email: string) {
  // Authoritative isolated records, not a browser return or a payment transition.
  // M19 owns the real provider/payment-to-workspace transition.
  const legal = await payload.create({ collection: "legal-documents", overrideAccess: true, data: {
    releaseKey: `m16-private-terms-${tenantId}`, documentType: "platform-terms", locale: "nl", documentVersion: "fixture",
    acceptanceVersion: "fixture", content: "Synthetic legal fixture", contentHash: "m16-fixture-hash", sourceCommit: "fixture",
    publishedAt: "2026-10-01T00:00:00Z", effectiveAt: "2026-10-01T00:00:00Z", changeCategory: "editorial",
    changeSummary: "Fixture", changeRationale: "Private workspace proof", customerAction: "none", consentAction: "none",
  } })
  const order = await payload.create({ collection: "orders", overrideAccess: true, data: {
    orderNumber: `M16-PRIVATE-PAID-${tenantId}`, tenant: tenantId, state: "fulfillment_pending", customerName: "Synthetic owner",
    customerEmail: email, companyName: "Synthetic company", billingAddress: { country: "NL" }, packageCode: "fixture",
    billingPeriod: "annual", renewalTerms: "Fixture", lineItems: [{ code: "website", totalGross: 121 }], currency: "EUR",
    subtotalNet: 100, vatAmount: 21, totalGross: 121, domain: "selected-but-not-activated.test", domainRegistrant: { owner: "customer" },
    legalDocuments: [legal.id], paymentStatus: "paid", paymentProvider: "manual", paidAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  } })
  await payload.create({ collection: "payment-attempts", overrideAccess: true, data: {
    idempotencyKey: `m16-private-paid-attempt-${tenantId}`, order: order.id, tenant: tenantId, attemptNumber: 1, purpose: "first_payment",
    state: "paid", sequenceType: "first", provider: "manual", providerStatus: "paid", currency: "EUR",
    netAmountMinor: 10_000, vatAmountMinor: 2100, grossAmountMinor: 12_100, reconciliationRequired: false,
    createdAt: new Date().toISOString(), paidAt: new Date().toISOString(),
  } })
}
