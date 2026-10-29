import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { User, Tenant, MicrosoftMailService } from "@/payload-types"
import type { Payload as PayloadInstance } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "./_helpers"
import { prepareMailQuote, acceptMailOrder, createMailPayment, settleMailOrderExternally, fundSponsoredMailOrder } from "@/lib/microsoftMailProvisioning/commerce"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { parseMicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
import { encryptPartnerSecret } from "@/lib/microsoftMailProvisioning/partnerConnection"
import { checkoutLegalDocuments } from "@/lib/legal/checkoutLegal"
import { hasManualWorkspaceAccess, hasWorkspaceAccountAccess } from "@/lib/workspace/manualAccess"
import { assertPlatformCollectionAllowed } from "@/lib/tenants/platformBilling"
import { fulfillMicrosoftMailOrder } from "@/lib/microsoftMailProvisioning/fulfillment"
import { synchronizeMolliePayment } from "@/lib/payments/molliePayments"

let payload: PayloadInstance
let admin: User
let counter = 0
const setupKey = Buffer.alloc(32, 12).toString("base64")
beforeAll(async () => {
  payload = await getTestPayload()
  admin = await payload.create({ collection: "users", overrideAccess: true, data: { email: "mail-operator@fixture.test", password: "Synthetic-Mail-Operator-42!", role: "super-admin", name: "Synthetic operator" } })
  for (const type of ["platform-terms", "platform-privacy"] as const) await payload.create({ collection: "legal-documents", overrideAccess: true, data: {
    releaseKey: `${type}:mail-fixture:nl`, documentType: type, locale: "nl", documentVersion: "mail-fixture", acceptanceVersion: "mail-fixture",
    content: "Synthetic legal fixture", contentHash: `${type}-fixture-hash`, sourceCommit: "fixture", publishedAt: "2026-10-01T00:00:00Z", effectiveAt: "2026-10-01T00:00:00Z",
    changeCategory: "editorial", changeSummary: "Fixture", changeRationale: "Email commerce proof", customerAction: "none", consentAction: "none",
  } })
}, 60_000)
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
afterAll(async () => { await payload?.destroy() })

async function customer(bound = false) {
  const n = ++counter
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, context: { skipProjection: true }, data: { name: `Email fixture ${n}`, slug: `email-fixture-${n}`, domain: null, status: "active", enabledServices: ["email"] } })
  if (bound) {
    const sourceId = `mail-source-${n}`, email = `owner-${n}@fixture.test`
    const result = await payload.db.drizzle.execute(sql`INSERT INTO preview_auth_users (id,name,email,"emailVerified","createdAt","updatedAt") VALUES (${sourceId},'Synthetic source',${email},true,now(),now()) RETURNING "firstVerifiedAt"`)
    const instant = result.rows[0]?.firstVerifiedAt
    if (!(instant instanceof Date) && typeof instant !== "string") throw new Error("Verified fixture source missing")
    await payload.create({ collection: "customer-accounts", overrideAccess: true, data: { email, previewUserId: sourceId, verifiedAt: new Date(instant).toISOString(), tenant: tenant.id } })
  }
  const owner = await payload.create({ collection: "users", overrideAccess: true, data: { email: `owner-${n}@fixture.test`, password: "Synthetic-Mail-Owner-42!", role: "owner", name: "Synthetic owner", language: "nl", tenants: [{ tenant: tenant.id }] } })
  const service = await payload.create({ collection: "microsoft-mail-services", overrideAccess: true, context: { microsoftMailServiceMutation: true }, data: { tenant: tenant.id,
    domain: `email-fixture-${n}.test`, domainAuthorizedAt: new Date().toISOString(), domainAuthorizedBy: admin.id, status: "draft" } })
  return { tenant, owner, service }
}

async function draft(input: { tenant: Tenant; owner: User; service: MicrosoftMailService }, provider: "manual" | "mollie" = "manual", suffix = "one") {
  const parsed = parseMicrosoftMailProvisioningRequest({ tenantId: input.tenant.id, domain: input.service.domain,
    customer: { companyName: input.tenant.name, website: `https://${input.service.domain}`, phone: "+31201234567", address: { street: "Synthetic 1", city: "Amsterdam", postalCode: "1000AA", country: "NL" },
      primaryContact: { firstName: "Operations", lastName: "Fixture", email: "operations@fixture.test", phone: "+31201234567" } },
    mailboxUsers: [{ localPart: suffix, displayName: "Mailbox fixture", setupEmail: input.owner.email }], retainInfoForward: false })
  if (!parsed.ok) throw new Error("Invalid fixture request")
  const now = new Date().toISOString()
  return new PayloadMicrosoftMailProvisioningStore(payload).create({ idempotencyKey: `mail-commerce-fixture:${input.tenant.id}:${suffix}`, mode: "live", tenantId: input.tenant.id, domain: input.service.domain,
    tenantPrefix: parsed.value.tenantPrefix, request: parsed.value, state: "prepared", currentStep: null, completedSteps: [], actionUrl: null, issueCode: null, createdAt: now, updatedAt: now,
    data: { customerConsent: { mcaAccepted: true, serviceAuthorized: true, actorUserId: String(input.owner.id), signatoryFirstName: "Synthetic", signatoryLastName: "Owner", signatoryEmail: input.owner.email, acceptedAt: now },
      quote: { version: 2, operation: "initial", baseQuantity: 0, targetQuantity: 1, annualUnitNetMinor: 5604, providerAnnualUnitCostMinor: 4932,
        servicePeriodStartsAt: null, servicePeriodEndsAt: null, providerCommitmentStartsAt: null, providerCommitmentEndsAt: null, serviceId: input.service.id, productId: "1bdd7ebb-f994-421f-ae98-b6a57bd9f947", commitmentTermId: "annual-fixture", quantity: 1, currency: "EUR",
        unitNetMinor: 5604, providerUnitCostMinor: 4932, platformNetMinor: 0, platformDiscountNetMinor: 0, subtotalNetMinor: 5604, vatAmountMinor: 1177, totalGrossMinor: 6781,
        issuedAt: now, expiresAt: new Date(Date.now() + 900_000).toISOString(), pricingHash: "fixture", paymentProvider: provider, legacyInfoForwardTo: null, routingHash: "0".repeat(64) } } })
}

async function configured() {
  const env = { MICROSOFT_MAIL_ALLOWED_DOMAINS: Array.from({ length: 100 }, (_, i) => `email-fixture-${i + 1}.test`).join(","), MICROSOFT_MAIL_CHECKOUT_ENABLED: "true", MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED: "true", PAX8_CLIENT_ID: "synthetic", PAX8_CLIENT_SECRET: "synthetic", PAX8_ORDER_EMAIL: "operations@fixture.test", PAX8_MPN_ID: "synthetic",
    MICROSOFT_PARTNER_TENANT_ID: "00000000-0000-0000-0000-000000000001", MICROSOFT_PARTNER_APP_CLIENT_ID: "00000000-0000-0000-0000-000000000002", MICROSOFT_PARTNER_APP_CLIENT_SECRET: "synthetic",
    MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY: setupKey, MICROSOFT_PARTNER_APP_REDIRECT_URI: "https://admin.fixture.test/operations/microsoft-mail/consent/callback", MICROSOFT_GDAP_ROLE_DEFINITION_IDS: "role", MICROSOFT_PARTNER_SECURITY_GROUP_ID: "group",
    MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY: setupKey, MICROSOFT_MAIL_CURRENCY: "EUR", MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR: "5604", CLOUDFLARE_API_TOKEN: "synthetic", CLOUDFLARE_ACCOUNT_ID: "0".repeat(32),
    CLOUDFLARE_EMAIL_API_TOKEN: "siab-test-synthetic-mail-transport-token-long", EMAIL_FROM: "noreply@fixture.test", SITE_URL: "https://admin.fixture.test", EXCHANGE_WORKER_URL: "https://worker.fixture.test/jobs", EXCHANGE_WORKER_SHARED_SECRET: "x".repeat(40) }
  for (const [key,value] of Object.entries(env)) vi.stubEnv(key,value)
  const prior = await payload.find({ collection: "microsoft-partner-connections", where: { partnerTenantId: { equals: env.MICROSOFT_PARTNER_TENANT_ID } }, limit: 1, overrideAccess: true })
  if (!prior.docs[0]) await payload.create({ collection: "microsoft-partner-connections", overrideAccess: true, context: { microsoftPartnerConnectionMutation: true }, data: { partnerTenantId: env.MICROSOFT_PARTNER_TENANT_ID, clientId: env.MICROSOFT_PARTNER_APP_CLIENT_ID,
    userPrincipalName: "integration@partner.fixture.test", userObjectId: "synthetic-user", encryptedRefreshToken: encryptPartnerSecret("synthetic-refresh-token"), status: "connected", connectedAt: new Date().toISOString(), refreshedAt: new Date().toISOString(), connectedBy: admin.id } })
}
async function legalVersion() {
  const legal = await checkoutLegalDocuments(payload,"nl")
  if (!legal || !("id" in legal.terms) || !("id" in legal.privacy)) throw new Error("Missing fixture legal evidence")
  return `${legal.terms.id}:${legal.terms.contentHash}:${legal.privacy.id}:${legal.privacy.contentHash}`
}
function tokenFetch() {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    if (new URL(String(input)).hostname === "worker.fixture.test") return Response.json({ healthy: true, protocolVersion: 1, moduleVersion: "3.10.1", dnsToolAvailable: true })
    if (new URL(String(input)).hostname === "login.microsoftonline.com") return Response.json({ access_token: "synthetic-partner-token", refresh_token: "synthetic-rotated-refresh", expires_in: 3600 })
    throw new Error("Unexpected provider connection in a synthetic integration test")
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

describe("payment-gated email and customer pricing", () => {
  it("supports an email-only account without granting website collection access", async () => {
    const { tenant, owner } = await customer()
    expect(tenant.domain).toBeNull()
    expect(await hasWorkspaceAccountAccess(payload, String(tenant.id))).toBe(true)
    expect(await hasManualWorkspaceAccess(payload, String(tenant.id))).toBe(false)
    await expect(payload.find({ collection: "pages", user: owner, overrideAccess: false })).rejects.toThrow()
  })
  it("requires the controlled policy action and records a platform exemption without waiving provider orders", async () => {
    const { tenant } = await customer()
    await expect(payload.update({ collection: "tenants", id: tenant.id, data: { platformPricing: { mode: "exempt", reason: "Managed account" } }, user: admin, overrideAccess: false })).rejects.toThrow(/commercial policy action/)
    const saved = await payload.update({ collection: "tenants", id: tenant.id, data: { platformPricing: { mode: "exempt", reason: "Managed account" } }, user: admin, overrideAccess: true, context: { tenantCommercialPolicyMutation: true } })
    expect(saved.platformPricing?.mode).toBe("exempt")
    expect(Array.isArray(saved.commercialPolicyHistory) && saved.commercialPolicyHistory.length).toBe(1)
    await expect(assertPlatformCollectionAllowed(payload, { tenant: tenant.id, orderKind: "initial_subscription" })).rejects.toThrow(/managed/)
    await expect(assertPlatformCollectionAllowed(payload, { tenant: tenant.id, orderKind: "microsoft_mail_initial" })).resolves.toBeUndefined()
  })
  it("rejects another workspace owner and unpaid requests before any provider write", async () => {
    const one = await customer(), two = await customer()
    const run = await draft(one)
    const fetchSpy = tokenFetch()
    await expect(acceptMailOrder(payload, { runId: Number(run.id), tenantId: one.tenant.id, actor: two.owner, legalAccepted: true, legalVersion: "wrong" })).rejects.toThrow(/workspace's owner/)
    await expect(acceptMailOrder(payload, { runId: Number(run.id), tenantId: one.tenant.id, actor: one.owner, legalAccepted: false, legalVersion: "wrong" })).rejects.toThrow(/Accept/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it("freezes a paid-order quote and acceptance without any website generation record", async () => {
    const c = await customer(); const run = await draft(c)
    await configured(); const fetchSpy = tokenFetch()
    const order = await acceptMailOrder(payload, { runId: Number(run.id), tenantId: c.tenant.id, actor: c.owner, legalAccepted: true, legalVersion: await legalVersion() })
    expect(order.orderKind).toBe("microsoft_mail_initial")
    expect(order.generationRun).toBeFalsy()
    expect(order.paymentStatus).toBe("pending")
    expect((await payload.find({ collection: "agreement-acceptances", where: { order: { equals: order.id } }, overrideAccess: true })).docs).toHaveLength(2)
    const other = await draft(c, "manual", "two")
    await expect(acceptMailOrder(payload, { runId: Number(other.id), tenantId: c.tenant.id, actor: c.owner, legalAccepted: true, legalVersion: await legalVersion() })).rejects.toThrow(/existing email order/)
    expect(fetchSpy.mock.calls.every(call => new URL(String(call[0])).hostname === "login.microsoftonline.com" || new URL(String(call[0])).hostname === "worker.fixture.test")).toBe(true)
  })
  it("records one immutable external receipt and invoice, and denies wrong amounts or owner self-settlement", async () => {
    const c = await customer(true); const run = await draft(c)
    await configured(); const fetchSpy = tokenFetch()
    const order = await acceptMailOrder(payload, { runId: Number(run.id), tenantId: c.tenant.id, actor: c.owner, legalAccepted: true, legalVersion: await legalVersion() })
    fetchSpy.mockClear()
    const receipt = { orderId: order.id, actor: admin, amountMinor: order.totalGrossMinor!, currency: order.currency, reference: "EXT-FIXTURE-001", receivedAt: new Date(Date.now() - 60_000).toISOString() }
    await expect(settleMailOrderExternally(payload, { ...receipt, actor: c.owner })).rejects.toThrow(/super-admin/)
    await expect(settleMailOrderExternally(payload, { ...receipt, amountMinor: 1 })).rejects.toThrow(/exact externally billed/)
    await settleMailOrderExternally(payload, receipt)
    await settleMailOrderExternally(payload, receipt)
    const attempts = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, overrideAccess: true })
    expect(attempts.docs).toHaveLength(1)
    expect(attempts.docs[0]?.provider).toBe("manual")
    expect((await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })).paymentStatus).toBe("paid")
    expect((await payload.find({ collection: "accounting-documents", where: { order: { equals: order.id } }, overrideAccess: true })).docs).toHaveLength(1)
    await expect(settleMailOrderExternally(payload, { ...receipt, reference: "DIFFERENT" })).rejects.toThrow(/immutable/)
    expect(fetchSpy).not.toHaveBeenCalled()
    // Enabling website support does not make an email receipt website payment.
    await payload.update({ collection: "tenants", id: c.tenant.id, user: admin, overrideAccess: true, context: { tenantCommercialPolicyMutation: true }, data: { enabledServices: ["email", "website"] } })
    expect(await hasManualWorkspaceAccess(payload, String(c.tenant.id))).toBe(false)
    // A duplicate job for an old fulfilled order must not reset later seats.
    const fulfilled = await payload.update({ collection: "orders", id: order.id, overrideAccess: true, context: { legalOrderLifecycleMutation: true }, data: { state: "fulfilled" } })
    await payload.update({ collection: "microsoft-mail-services", id: c.service.id, overrideAccess: true, context: { microsoftMailServiceMutation: true }, data: { quantity: 5 } })
    expect((await fulfillMicrosoftMailOrder(payload,fulfilled,attempts.docs[0]!)).status).toBe("fulfilled")
    expect((await payload.findByID({ collection: "microsoft-mail-services", id: c.service.id, overrideAccess: true })).quantity).toBe(5)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it("binds Mollie metadata to the frozen order and prevents test payments unlocking live provisioning", async () => {
    const c = await customer(); const run = await draft(c,"mollie")
    await configured(); tokenFetch()
    const order = await acceptMailOrder(payload, { runId: Number(run.id), tenantId: c.tenant.id, actor: c.owner, legalAccepted: true, legalVersion: await legalVersion() })
    vi.stubEnv("MOLLIE_API_KEY","test_synthetic_fixture")
    vi.stubEnv("COMMERCE_RELEASE_STAGE","sandbox")
    vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED","1")
    vi.stubEnv("COMMERCE_RELEASE_EVIDENCE_VERSION","commerce-production-readiness-2026-07-30.1")
    vi.stubEnv("OPENPROVIDER_API_BASE_URL","https://registrar.fixture.test")
    vi.stubEnv("CLOUDFLARE_API_BASE_URL","https://dns.fixture.test")
    let payment: Record<string, unknown> = {}
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.hostname !== "api.mollie.com") throw new Error("Unexpected provider access")
      if (init?.method === "POST") { const body = JSON.parse(String(init.body)); payment = { ...body, id: "tr_MailFixture", mode: "test", status: "open", _links: { checkout: { href: "https://www.mollie.com/checkout/fixture" } } }; return Response.json(payment) }
      return Response.json({ ...payment, status: "paid", paidAt: new Date().toISOString() })
    })
    vi.stubGlobal("fetch", spy)
    expect(await createMailPayment(payload, order.id)).toBe("https://www.mollie.com/checkout/fixture")
    expect(await createMailPayment(payload, order.id)).toBe("https://www.mollie.com/checkout/fixture")
    expect(spy.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
    const result = await synchronizeMolliePayment(payload,"tr_MailFixture")
    const paidOrder = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })
    const attempt = await payload.findByID({ collection: "payment-attempts", id: result.paymentAttemptId, overrideAccess: true })
    expect(attempt.providerMode).toBe("test")
    spy.mockClear()
    await expect(fulfillMicrosoftMailOrder(payload,paidOrder,attempt)).rejects.toThrow(/matching settled/)
    expect(spy).not.toHaveBeenCalled()
  })
})

it("sponsors an exact owner-confirmed order without Mollie or customer invoice, replaying once", async () => {
  const c = await customer()
  await configured(); const fetchSpy = tokenFetch()
  vi.stubEnv("MICROSOFT_MAIL_SPONSORED_DOMAINS", c.service.domain)
  await payload.update({ collection: "tenants", id: c.tenant.id, user: admin, overrideAccess: true, context: { tenantCommercialPolicyMutation: true }, data: { emailPaymentMethod: "manual", platformPricing: { mode: "exempt", reason: "Approved synthetic sponsorship" } } })
  const run = await draft(c)
  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  await store.update(run.id, { data: { ...run.data, quote: { ...run.data.quote as object, sponsored: true } } })
  const order = await acceptMailOrder(payload, { runId: Number(run.id), tenantId: c.tenant.id, actor: c.owner, legalAccepted: true, legalVersion: await legalVersion() })
  const other = await customer()
  await expect(fundSponsoredMailOrder(payload, order, other.owner)).rejects.toThrow(/sponsorship authority/)
  fetchSpy.mockClear()
  await fundSponsoredMailOrder(payload, order, c.owner)
  await fundSponsoredMailOrder(payload, order, c.owner)
  const attempts = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, overrideAccess: true })
  expect(attempts.totalDocs).toBe(1)
  expect(attempts.docs[0]?.stateHistory).toEqual(expect.arrayContaining([expect.objectContaining({ funding: "siteinabox_sponsorship" })]))
  const saved = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })
  expect((await payload.find({ collection: "accounting-documents", where: { order: { equals: order.id } }, overrideAccess: true })).totalDocs).toBe(0)
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(saved.state).toBe("fulfillment_pending")
  expect(saved.paymentStatus).toBe("paid")
  vi.stubEnv("MICROSOFT_MAIL_SPONSORED_DOMAINS", "")
  await expect(fundSponsoredMailOrder(payload, order, c.owner)).rejects.toThrow(/sponsorship authority/)
})

it("keeps customer and operator identities separate when support confirms and sponsors", async () => {
 const c = await customer(); await configured(); const fetchSpy = tokenFetch()
 vi.stubEnv("MICROSOFT_MAIL_SPONSORED_DOMAINS", c.service.domain)
 await payload.update({ collection: "tenants", id: c.tenant.id, user: admin, overrideAccess: true, context: { tenantCommercialPolicyMutation: true }, data: { emailPaymentMethod: "manual", platformPricing: { mode: "exempt", reason: "Approved support test" } } })
 const run = await draft(c)
 await new PayloadMicrosoftMailProvisioningStore(payload).update(run.id, { data: { ...run.data, quote: { ...run.data.quote as object, sponsored: true } } })
 const order = await acceptMailOrder(payload, { runId: Number(run.id), tenantId: c.tenant.id, actor: admin, legalAccepted: true, legalVersion: await legalVersion() })
 expect(order.customerEmail).toBe(c.owner.email)
 expect(order.quoteEvidence).toMatchObject({ confirmedBy: String(admin.id) })
 const acceptances = await payload.find({ collection: "agreement-acceptances", where: { order: { equals: order.id } }, depth: 0, overrideAccess: true })
 expect(acceptances.docs.every(value => value.actorEmail === admin.email)).toBe(true)
 fetchSpy.mockClear()
 await fundSponsoredMailOrder(payload, order, admin)
 const attempts = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, overrideAccess: true })
 expect(attempts.docs[0]?.stateHistory).toEqual(expect.arrayContaining([expect.objectContaining({ funding: "siteinabox_sponsorship", actorId: String(admin.id) })]))
 expect(fetchSpy).not.toHaveBeenCalled()
})

it("requires an explicit Dutch legal choice when English documents are unavailable", async () => {
 const c = await customer(); await configured(); tokenFetch()
 const owner = await payload.update({ collection: "users", id: c.owner.id, overrideAccess: true, data: { language: "en" } })
 const run = await draft(c)
 const input = { runId: Number(run.id), tenantId: c.tenant.id, actor: owner, legalAccepted: true, legalVersion: await legalVersion() }
 await expect(acceptMailOrder(payload, input)).rejects.toThrow(/agreements are unavailable/)
 const order = await acceptMailOrder(payload, { ...input, legalLocale: "nl" })
 expect(order.quoteEvidence).toMatchObject({ legal: { locale: "nl" }, confirmedBy: String(owner.id) })
 expect((await payload.findByID({ collection: "users", id: owner.id, overrideAccess: true })).language).toBe("en")
 const evidence = await payload.find({ collection: "agreement-acceptances", where: { order: { equals: order.id } }, depth: 1, overrideAccess: true })
 expect(evidence.totalDocs).toBe(2)
 expect(evidence.docs.every(value => typeof value.document === "object" && value.document?.locale === "nl")).toBe(true)
})
