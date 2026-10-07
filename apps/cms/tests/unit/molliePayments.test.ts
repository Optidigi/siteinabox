import type { MolliePayment } from "@/lib/payments/mollieAdapter"
import { createTaskRunner } from "../_helpers/taskRunner"
import { NextRequest } from "next/server"
import type { AccountingDocument, BillingAgreement, CommerceNotificationDelivery, ManagedDomain, PaymentAttempt, PublishedSiteSnapshot, SiteGenerationRun } from "@/payload-types"
import { asDocRecord } from "../_helpers/payloadApi"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { payloadUpdateFixture, type PayloadUpdateOptions } from "../_helpers/payloadUpdateFixture"
import { accountingDocumentFixture, agreementAcceptanceFixture, billingAgreementFixture, checkoutProfileFixture, commerceNotificationFixture, generationRunFixture, managedDomainFixture, orderFixture, pageFixture, paginatedFixture, paymentAttemptFixture, publishedSnapshotFixture, siteSettingsFixture, tenantFixture } from "../_helpers/generatedDocs"
import { matchesWhere } from "../_helpers/mockPayload"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("payload", async (importOriginal) => ({
  ...await importOriginal<typeof import("payload")>(),
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/commerce/orderLock", () => ({
  withCommerceOrderLock: vi.fn(async (
    _payload: unknown,
    _orderId: string | number,
    operation: () => Promise<unknown>,
  ) => operation()),
}))

vi.mock("@/lib/domains/verification", () => ({
  verifyDnssecChain: vi.fn(async () => ({
    status: "verified",
    reason: null,
  })),
  verifyParentDsAbsent: vi.fn(async () => ({
    status: "absent",
    records: [],
    reason: null,
  })),
  verifyAuthoritativeDns: vi.fn(async (_domain: string, nameServers: string[]) => ({
    status: "verified",
    delegatedNameServers: nameServers,
    respondingNameServers: nameServers,
    reason: null,
  })),
  verifyPreservedDnsRecords: vi.fn(async () => ({
    status: "verified",
    recursiveEquivalent: true,
    authoritativeEquivalent: true,
    reason: null,
  })),
  verifyHttpsEndpoint: vi.fn(async () => ({
    status: "verified",
    httpStatus: 404,
    reason: null,
  })),
}))

import { getPayload } from "payload"
import {
  synchronizeMolliePayment,
  createApplicationRecurringMolliePayment,
  createMandateRecoveryMolliePayment,
  createMollieCheckoutForGenerationRun,
  requestMollieRefund,
} from "@/lib/payments/molliePayments"
import { mollieApiKeyMode, mollieDomainProvisioningEnabled } from "@/lib/payments/mollieAdapter"
import { fulfillPaidOrder } from "@/lib/payments/fulfillOrder"
import { provisionPaidDomainOrder } from "@/lib/domains/provisioning"
import { CloudflareIndeterminateWriteError } from "@/lib/domains/cloudflare"
import { fulfillOrderTask } from "@/lib/jobs/fulfillOrderTask"
import { requestMollieRefundTask } from "@/lib/jobs/requestMollieRefundTask"
import {
  queueMolliePaymentSync,
  syncMolliePaymentTask,
} from "@/lib/jobs/syncMolliePaymentTask"
import { retryPostPaymentAutomation } from "@/lib/payments/postPaymentActivation"
import {
  recoverMissingMollieCustomerReferences,
  recoverMissingMolliePaymentReferences,
} from "@/lib/commerce/reconciliation"
import { processBillingAgreement } from "@/lib/billing/billingLifecycle"
import { POST as mollieWebhookPOST } from "@/app/(payload)/api/payments/mollie/webhook/route"

const registrant = {
  companyName: "Acme Studio",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "client@example.com",
  street: "Main Street",
  number: "10",
  suffix: null,
  zipcode: "1011AB",
  city: "Amsterdam",
  country: "NL",
  state: null,
  phoneCountryCode: "+31",
  phoneAreaCode: "20",
  phoneSubscriberNumber: "1234567",
  locale: "nl_NL",
}

const enableProductionCommerceRelease = () => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("COMMERCE_RELEASE_STAGE", "production")
  vi.stubEnv(
    "COMMERCE_RELEASE_EVIDENCE_VERSION",
    "commerce-production-readiness-2026-07-30.1",
  )
  vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED", "1")
  vi.stubEnv("OPENPROVIDER_API_BASE_URL", "https://api.openprovider.eu/v1beta")
  vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://api.cloudflare.com/client/v4")
  vi.stubEnv("OPENPROVIDER_USERNAME", "test-user")
  vi.stubEnv("OPENPROVIDER_PASSWORD", "test-password")
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-token")
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "test-account")
  vi.stubEnv(
    "DOMAIN_MIGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  )
  vi.stubEnv("COMMERCE_ORIGIN_ISOLATION_VERIFIED", "1")
}

const enableSandboxCommerceRelease = () => {
  vi.stubEnv("COMMERCE_RELEASE_STAGE", "sandbox")
  vi.stubEnv(
    "COMMERCE_RELEASE_EVIDENCE_VERSION",
    "commerce-production-readiness-2026-07-30.1",
  )
  vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED", "1")
  vi.stubEnv("OPENPROVIDER_API_BASE_URL", "https://sandbox.openprovider.test/v1beta")
  vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://sandbox.cloudflare.test/client/v4")
}

const recordValue = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? asDocRecord(value) : {}
const requiredFixtureAmount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Missing numeric financial fixture amount")
  return value
}
type FixtureOverrides = Partial<SiteGenerationRun> & {
  cancelBeforeRecurringClaim?: boolean
  cancelBeforeBillingSyncClaim?: boolean
  recoverBeforeChargebackTenantMutation?: boolean
}
const createPayloadStub = async (overrides: FixtureOverrides = {}) => {
  const payload = await createInitializedTestPayload()
  const tenant = tenantFixture({
    id: 1,
    name: "Acme Studio",
    slug: "acme-studio",
    domain: "acme.test",
    status: "provisioning",
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  })
  const run = generationRunFixture({
    id: 500,
    intakeSubmission: 400,
    status: "preview_ready",
    clientApproval: { status: "approved" },
    payment: null,
    domainOrder: null,
    tenant: 1,
    pages: [100],
    idempotencyKey: "run-500",
    normalizedIntake: {},
    normalizedIntakeHash: "hash",
    provider: "mock",
    model: "fixture",
    promptVersion: "site-generation-v1",
    generationInputHash: "input",
    errors: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  })
  const page = pageFixture({
    id: 100,
    tenant: 1,
    title: "Home",
    slug: "index",
    status: "published",
    blocks: [{
      blockType: "hero",
      variant: "hero-01",
      anchor: "top",
      heading: "Acme Studio",
      body: "A compact published page.",
      primaryAction: { label: "Contact", href: "#contact" },
      image: null,
    }],
    updatedAt: "2026-06-26T10:00:00.000Z",
  })
  const settings = siteSettingsFixture({
    id: 300,
    tenant: 1,
    siteName: "Acme Studio",
    siteUrl: "https://clientsite.nl",
    language: "nl",
    updatedAt: "2026-06-26T10:00:00.000Z",
  })
  const orderDomain = typeof recordValue(overrides.domainOrder).domain === "string" ? String(recordValue(overrides.domainOrder).domain) : tenant.domain
  const orderTld = orderDomain.split(".").at(-1)
  const intendedTlds = new Set([
    "nl",
    "com",
    "eu",
    "org",
    "net",
    "be",
    "de",
    "info",
    "online",
    "shop",
  ])
  const tldCapabilityVersion = orderTld && intendedTlds.has(orderTld)
    ? `tld-${orderTld}-2026-07-29.1`
    : null
  const providerPrice = Number(recordValue(overrides.domainOrder).providerPriceAmount ?? "10.00")
  const grossAmountMinor = providerPrice > 10
    ? 49_900 + Math.round((providerPrice - 10) * 100)
    : 49_900
  const netAmountMinor = Math.round(grossAmountMinor / 1.21)
  const vatAmountMinor = grossAmountMinor - netAmountMinor
  const profile = checkoutProfileFixture({
    id: 800,
    profileKey: "run:500:checkout-profile:1",
    profileVersion: 1,
    generationRun: 500,
    tenant: 1,
    customerName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    customerEmail: "client@example.com",
    partyType: "registered_business",
    contractingPartyName: "Acme Studio",
    kvkNumber: "12345678",
    domainRegistrantSource: "contracting_party",
    billingAddress: {
      street: "Main Street",
      number: "10",
      suffix: null,
      zipcode: "1011AB",
      city: "Amsterdam",
      country: "NL",
      phoneCountryCode: "+31",
      phoneAreaCode: "20",
      phoneSubscriberNumber: "1234567",
    },
    createdAt: "2026-07-26T10:00:00.000Z",
  })
  const order = orderFixture({
    id: 600,
    orderNumber: "SIAB-500-TEST",
    generationRun: 500,
    tenant: 1,
    state: "accepted",
    checkoutProfileKey: profile.profileKey,
    catalogVersion: "2026-07-26.1",
    ...(tldCapabilityVersion ? {
      quoteEvidence: {
        tldCapability: {
          tld: orderTld,
          capabilityVersion: tldCapabilityVersion,
          effectiveFrom: "2026-07-29T12:00:00.000Z",
        },
      },
    } : {}),
    acceptedAt: "2026-07-27T10:00:00.000Z",
    packageCode: "siteinabox-monthly",
    billingPeriod: "monthly",
    customerName: "Ada Lovelace",
    customerEmail: "client@example.com",
    companyName: "Acme Studio",
    billingAddress: { country: "NL" },
    domainRegistrant: registrant,
    domain: orderDomain,
    subtotalNetMinor: netAmountMinor,
    vatAmountMinor,
    totalGrossMinor: grossAmountMinor,
    subtotalNet: netAmountMinor / 100,
    vatAmount: vatAmountMinor / 100,
    totalGross: grossAmountMinor / 100,
    netLineItems: [{
      code: "siteinabox-monthly",
      description: "Siteinabox maandabonnement",
      quantity: 1,
      netAmountMinor,
    }],
    lineItems: [],
    currency: "EUR",
    paymentStatus: "pending",
  })
  const acceptance = agreementAcceptanceFixture({ id: 700, tenant: 1, actorEmail: "client@example.com", order: 600, acceptanceVersion: "platform-terms-2026-07-07" })
  const snapshots: PublishedSiteSnapshot[] = []
  const billingAgreements: BillingAgreement[] = []
  const paymentAttempts: PaymentAttempt[] = []
  const accountingDocuments: AccountingDocument[] = []
  const managedDomains: ManagedDomain[] = []
  const commerceNotifications: CommerceNotificationDelivery[] = []
  const projection = recordValue(overrides.payment)
  if (typeof projection.externalReference === "string" && projection.externalReference) {
    const agreement = billingAgreementFixture({
      id: 900,
      idempotencyKey: "mollie:billing-agreement:order:600:v1",
      originatingOrder: 600,
      checkoutProfile: profile.id,
      tenant: 1,
      state: projection.status === "completed" ? "active" : "mandate_pending",
      provider: "mollie",
      providerCustomerId: typeof projection.mollieCustomerId === "string" ? projection.mollieCustomerId : "cst_test123",
      providerMandateId: projection.status === "completed" ? "mdt_test123" : null,
      catalogVersion: "2026-07-26.1",
      packageCode: "siteinabox-monthly",
      billingPeriod: "monthly",
      currency: "EUR",
      recurringNetAmountMinor: 1_900,
      renewalIntent: true,
      reconciliationRequired: false,
      createdAt: "2026-07-26T10:00:00.000Z",
      updatedAt: "2026-07-26T10:00:00.000Z",
    })
    billingAgreements.push(agreement)
    paymentAttempts.push(paymentAttemptFixture({
      id: 901,
      idempotencyKey: "mollie:first-payment:order:600:v1",
      order: 600,
      billingAgreement: agreement.id,
      tenant: 1,
      attemptNumber: 1,
      state: projection.status === "completed" ? "paid" : "pending_provider",
      purpose: "first_payment",
      sequenceType: "first",
      provider: "mollie",
      providerPaymentId: projection.externalReference,
      providerStatus: typeof projection.providerStatus === "string" ? projection.providerStatus : "open",
      checkoutUrl: typeof projection.checkoutUrl === "string" ? projection.checkoutUrl : undefined,
      currency: "EUR",
      netAmountMinor,
      vatAmountMinor,
      grossAmountMinor,
      reconciliationRequired: false,
      createdAt: "2026-07-26T10:00:00.000Z",
    }))
  }
  let cancellationRacePending = overrides.cancelBeforeRecurringClaim === true
  let paymentSyncCancellationRacePending =
    overrides.cancelBeforeBillingSyncClaim === true
  let chargebackRecoveryRacePending =
    overrides.recoverBeforeChargebackTenantMutation === true
  const update = vi.fn(async (args: PayloadUpdateOptions) => {
    const { collection, data } = args
    const id = "id" in args ? args.id : undefined
    const where = "where" in args ? args.where : undefined
    if (collection === "billing-agreements" && where) {
      if (cancellationRacePending && "lastPaymentAttemptAt" in data) {
        cancellationRacePending = false
        const agreement = billingAgreements[0]
        if (agreement) {
          Object.assign(agreement, {
            state: "cancellation_scheduled",
            renewalIntent: false,
            cancelAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-07-27T10:00:00.000Z",
          })
        }
      }
      if (
        paymentSyncCancellationRacePending &&
        "currentPeriodEndsAt" in data
      ) {
        paymentSyncCancellationRacePending = false
        const agreement = billingAgreements[0]
        if (agreement) {
          Object.assign(agreement, {
            state: "cancellation_scheduled",
            renewalIntent: false,
            cancelAt: "2026-08-01T10:00:00.000Z",
            cancellationEvidence: {
              version: 1,
              requestedAt: "2026-07-27T10:00:00.000Z",
            },
            updatedAt: "2026-07-27T10:00:00.000Z",
          })
        }
      }
      const docs = billingAgreements.filter((agreement) =>
        matchesWhere(asDocRecord(agreement), where)
      )
      for (const agreement of docs) {
        Object.assign(agreement, data)
        agreement.updatedAt = new Date(
          new Date(String(agreement.updatedAt)).getTime() + 1,
        ).toISOString()
      }
      return { docs, errors: [], totalDocs: docs.length }
    }
    for (const [slug, doc] of [
      ["site-generation-runs", run], ["tenants", tenant], ["site-settings", settings],
    ] as const) {
      if (collection !== slug) continue
      const docs = where && !matchesWhere(asDocRecord(doc), where) ? [] : [doc]
      for (const entry of docs) Object.assign(entry, data)
      return where ? { docs, errors: [], totalDocs: docs.length } : { ...doc }
    }
    if (collection === "orders") {
      if (where) {
        const docs = matchesWhere(asDocRecord(order), where) ? [order] : []
        for (const entry of docs) Object.assign(entry, data)
        return { docs, errors: [], totalDocs: docs.length }
      }
      Object.assign(order, data)
      return { ...order }
    }
    if (collection === "published-site-snapshots") {
      const snapshot = snapshots.find((entry) => String(entry.id) === String(id))
      if (!snapshot) throw new Error(`Missing published-site-snapshots ${id}`)
      Object.assign(snapshot, data)
      return { ...snapshot }
    }
    if (where) {
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts],
        ["accounting-documents", accountingDocuments],
        ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection !== slug) continue
        const matched = docs.filter((entry) => matchesWhere(asDocRecord(entry), where))
        for (const entry of matched) Object.assign(entry, data)
        return { docs: matched, errors: [], totalDocs: matched.length }
      }
    }
    for (const [slug, docs] of [
      ["payment-attempts", paymentAttempts],
      ["billing-agreements", billingAgreements],
      ["accounting-documents", accountingDocuments],
      ["managed-domains", managedDomains],
      ["commerce-notification-deliveries", commerceNotifications],
    ] as const) {
      if (collection !== slug) continue
      const doc = docs.find((entry) => String(entry.id) === String(id))
      if (!doc) throw new Error(`Missing ${collection} ${id}`)
      Object.assign(doc, data)
      return { ...doc }
    }
    throw new Error(`Unexpected update ${collection}`)
  })
  const findByID = vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
      if (collection === "site-generation-runs" && String(id) === "500") return run
      if (collection === "tenants" && String(id) === "1") {
        if (
          chargebackRecoveryRacePending &&
          billingAgreements[0]?.state === "suspended"
        ) {
          chargebackRecoveryRacePending = false
          Object.assign(billingAgreements[0]!, {
            state: "active",
            serviceSuspensionStatus: "none",
            reconciliationRequired: false,
            restoredAt: "2026-08-15T10:05:00.000Z",
            updatedAt: "2026-08-15T10:05:00.000Z",
          })
          Object.assign(tenant, {
            status: "active",
            billingSuspensionAgreement: null,
            billingSuspendedAt: null,
          })
        }
        return tenant
      }
      if (collection === "orders" && String(id) === "600") return order
      if (collection === "checkout-profiles" && String(id) === String(profile.id)) return profile
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts],
        ["billing-agreements", billingAgreements],
        ["accounting-documents", accountingDocuments],
        ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection !== slug) continue
        const doc = docs.find((entry) => String(entry.id) === String(id))
        if (doc) return doc
      }
      if (collection === "published-site-snapshots") {
        const snapshot = snapshots.find((entry) => String(entry.id) === String(id))
        if (snapshot) return snapshot
      }
      throw new Error(`Missing ${collection} ${id}`)
    })
  const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => {
      if (collection === "orders") {
        return paginatedFixture(matchesWhere(asDocRecord(order), where) ? [order] : [])
      }
      if (collection === "published-site-snapshots") {
        if (where?.and) {
          return paginatedFixture(snapshots.filter((snapshot) => matchesWhere(asDocRecord(snapshot), where)))
        }
        const clause = where ?? {}
        const sourceRun = recordValue(clause.sourceGenerationRun)?.equals
        if (sourceRun != null) {
          return paginatedFixture(snapshots.filter((snapshot) => String(snapshot.sourceGenerationRun) === String(sourceRun)))
        }
        const tenantId = recordValue(clause.tenant)?.equals
        if (tenantId != null) {
          return paginatedFixture(snapshots.filter((snapshot) => String(snapshot.tenant) === String(tenantId)))
        }
        return paginatedFixture(snapshots)
      }
      if (collection === "pages") return paginatedFixture([page])
      if (collection === "site-settings") return paginatedFixture([settings])
      if (collection === "agreement-acceptances") {
        const orderEquals = recordValue(where?.order)?.equals
        if (orderEquals != null) {
          return paginatedFixture(String(acceptance.order) === String(orderEquals) ? [acceptance] : [])
        }
        const clauses = where?.and
        if (!clauses) return paginatedFixture([acceptance])
        const tenantId = recordValue(clauses.find((clause) => clause.tenant)?.tenant)?.equals
        const actorEmail = recordValue(clauses.find((clause) => clause.actorEmail)?.actorEmail)?.equals
        if (tenantId != null && actorEmail != null) {
          return paginatedFixture(String(acceptance.tenant) === String(tenantId) && acceptance.actorEmail === actorEmail
              ? [acceptance]
              : [])
        }
        return paginatedFixture([acceptance])
      }
      if (collection === "checkout-profiles") {
        return paginatedFixture(matchesWhere(asDocRecord(profile), where) ? [profile] : [])
      }
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts],
        ["billing-agreements", billingAgreements],
        ["accounting-documents", accountingDocuments],
        ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection === slug) {
          return paginatedFixture(docs.filter((doc) => matchesWhere(asDocRecord(doc), where)))
        }
      }
      return paginatedFixture([])
    })
  const create = vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
      if (collection === "published-site-snapshots") {
        const snapshot = Object.assign(publishedSnapshotFixture({ id: snapshots.length + 10 }), data)
        snapshots.unshift(snapshot)
        return snapshot
      }
      if (collection === "site-settings") return settings
      const dataFields = asDocRecord(data)
      const uniqueKey = typeof dataFields.idempotencyKey === "string"
        ? "idempotencyKey" : typeof dataFields.evidenceKey === "string" ? "evidenceKey" : null
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts], ["billing-agreements", billingAgreements],
        ["accounting-documents", accountingDocuments], ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection === slug && uniqueKey && docs.some(doc => asDocRecord(doc)[uniqueKey] === dataFields[uniqueKey])) {
          throw new Error(`duplicate key value violates ${collection}.${uniqueKey}`)
        }
      }
      switch (collection) {
        case "payment-attempts": {
          const doc = Object.assign(paymentAttemptFixture({ id: 1_000 + paymentAttempts.length }), data, { updatedAt: data.createdAt ?? "2026-07-26T10:00:00.000Z" })
          paymentAttempts.push(doc); return doc
        }
        case "billing-agreements": {
          const doc = Object.assign(billingAgreementFixture({ id: 1_100 + billingAgreements.length }), data, { updatedAt: data.createdAt ?? "2026-07-26T10:00:00.000Z" })
          billingAgreements.push(doc); return doc
        }
        case "accounting-documents": {
          const doc = Object.assign(accountingDocumentFixture({ id: 1_200 + accountingDocuments.length }), data)
          accountingDocuments.push(doc); return doc
        }
        case "managed-domains": {
          const doc = Object.assign(managedDomainFixture({ id: 1_300 + managedDomains.length }), data, {
            edgeRoutingStatus: "active" as const, httpsStatus: "verified" as const, adminHttpsStatus: "verified" as const,
          })
          managedDomains.push(doc); return doc
        }
        case "commerce-notification-deliveries": {
          const doc = Object.assign(commerceNotificationFixture({ id: 1_400 + commerceNotifications.length }), data)
          commerceNotifications.push(doc); return doc
        }
      }
      throw new Error(`Unexpected create ${collection}`)
    })
  const queue = vi.spyOn(payload.jobs, "queue").mockResolvedValue({ id: 1, input: {}, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" })
  vi.spyOn(payload.db, "beginTransaction").mockResolvedValue("tx-domain-registration")
  vi.spyOn(payload.db, "commitTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload.db, "rollbackTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload.logger, "warn")
  vi.spyOn(payload.logger, "error")
  vi.spyOn(payload.logger, "info")
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(update))
  vi.mocked(getPayload).mockResolvedValue(payload)
  return {
    payload,
    run,
    tenant,
    settings,
    order,
    update,
    snapshots,
    billingAgreements,
    paymentAttempts,
    accountingDocuments,
    managedDomains,
    commerceNotifications,
    queue,
  }
}

const configureRecoverableSubscription = (
  fixture: Awaited<ReturnType<typeof createPayloadStub>>,
) => {
  Object.assign(fixture.order, {
    state: "accepted",
    paymentStatus: "failed",
    orderKind: "subscription_renewal",
    servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
    servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
  })
  Object.assign(fixture.billingAgreements[0]!, {
    state: "suspended",
    providerCustomerId: "cst_test123",
    serviceSuspensionStatus: "billing_suspended",
    currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
    currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
    reconciliationRequired: false,
    updatedAt: "2026-08-15T10:00:00.000Z",
  })
  Object.assign(fixture.paymentAttempts[0]!, {
    state: "failed",
    purpose: "recurring",
    sequenceType: "recurring",
    reconciliationRequired: false,
    failedAt: "2026-08-15T09:55:00.000Z",
    createdAt: "2026-08-15T09:50:00.000Z",
  })
}

describe("Mollie payment flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "disabled")
    vi.stubEnv("COMMERCE_RELEASE_EVIDENCE_VERSION", "")
    vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED", "")
    vi.stubEnv("MOLLIE_API_KEY", "test_xxx")
    vi.stubEnv("SITE_URL", "https://admin.siteinabox.nl")
    vi.stubEnv("MOLLIE_WEBHOOK_BASE_URL", "")
    vi.stubEnv("OPENPROVIDER_API_BASE_URL", "https://api.openprovider.eu/v1beta")
    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://api.cloudflare.com/client/v4")
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({ id: "cst_test123", name: "Acme Studio", email: "client@example.com" }), { status: 201 })
      }
      return new Response(JSON.stringify({ customerId: "cst_test123", sequenceType: "first",
        id: "tr_test123",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        metadata: {
          generationRunId: 500,
          tenantId: 1,
          orderId: 600,
          customerEmail: "client@example.com",
          clientSlug: "acme",
        },
        _links: { checkout: { href: "https://www.mollie.com/checkout/test" } },
      }), { status: 201 })
    }))
  })

  it("creates approved-run checkout with run, tenant, customer, and idempotency metadata", async () => {
    enableSandboxCommerceRelease()
    const { payload, update, billingAgreements } = await createPayloadStub()
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        expect(billingAgreements[0]).not.toHaveProperty("providerCustomerId")
        expect(billingAgreements[0]).toMatchObject({
          reconciliationRequired: true,
          failureReason: "A Mollie customer provider write is in progress.",
        })
        return new Response(JSON.stringify({
          id: "cst_test123",
          name: "Acme Studio",
          email: "client@example.com",
        }), { status: 201 })
      }
      return new Response(JSON.stringify({ customerId: "cst_test123", sequenceType: "first",
        id: "tr_test123",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        _links: {
          checkout: { href: "https://www.mollie.com/checkout/test" },
        },
      }), { status: 201 })
    }))

    const result = await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: " Client@Example.com ",
      clientSlug: "acme",
      actor: 42,
    })

    expect(result.checkoutUrl).toBe("https://www.mollie.com/checkout/test")
    expect(result.reused).toBe(false)
    expect(billingAgreements[0]).toMatchObject({
      providerCustomerId: "cst_test123",
      reconciliationRequired: false,
      failureReason: null,
    })
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/customers", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "mollie:billing-agreement:order:600:v1:customer",
      }),
    }))
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/payments", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "mollie:first-payment:order:600:authority-v3:attempt-1",
      }),
    }))
    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      amount: { currency: "EUR", value: "499.00" },
      sequenceType: "first",
      customerId: "cst_test123",
      redirectUrl: "https://admin.siteinabox.nl/acme/checkout?payment=return",
      webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "acme.test",
      idempotencyKey: "mollie:first-payment:order:600:authority-v3:attempt-1",
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
        purpose: "first_payment",
      },
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
      id: 500,
      data: {
        payment: expect.objectContaining({
          status: "pending_provider",
          provider: "mollie",
          externalReference: "tr_test123",
          customerEmail: "client@example.com",
          checkoutUrl: "https://www.mollie.com/checkout/test",
          mollieCustomerId: "cst_test123",
          mollieSequenceType: "first",
          renewalInterval: "1 month",
        }),
      },
    }))
  })

  it("keeps a provider-bound payment reconcilable when local projection fails", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      update,
    } = await createPayloadStub()
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected Payload update implementation.")
    let failProjection = true
    update.mockImplementation(async (args) => {
      if (
        failProjection &&
        args.collection === "site-generation-runs" &&
        recordValue(args.data).payment
      ) {
        failProjection = false
        throw new Error("simulated local payment projection failure")
      }
      return originalUpdate(args)
    })
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("simulated local payment projection failure")
    expect(paymentAttempts).toHaveLength(1)
    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      providerPaymentId: "tr_test123",
      checkoutUrl: "https://www.mollie.com/checkout/test",
      reconciliationRequired: true,
      failureCode: "provider_write_indeterminate",
      failureMessage: "simulated local payment projection failure",
    })
    const paymentPosts = () => vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments"
    )
    expect(paymentPosts()).toHaveLength(1)

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .resolves.toMatchObject({
        reused: true,
        checkoutUrl: "https://www.mollie.com/checkout/test",
        paymentAttempt: {
          providerPaymentId: "tr_test123",
          reconciliationRequired: true,
        },
      })
    expect(paymentPosts()).toHaveLength(1)
  })

  it("persists an indeterminate customer write and never dispatches it again", async () => {
    enableSandboxCommerceRelease()
    const { payload, billingAgreements } = await createPayloadStub()
    const providerWrite = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mollie.com/v2/customers")
      expect(billingAgreements[0]).toMatchObject({
        reconciliationRequired: true,
        failureReason: "A Mollie customer provider write is in progress.",
      })
      throw new TypeError("connection closed after customer acceptance")
    })
    vi.stubGlobal("fetch", providerWrite)
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("provider transport")
    expect(providerWrite).toHaveBeenCalledTimes(1)
    expect(billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "Mollie API: provider transport.",
    })
    expect(billingAgreements[0]).not.toHaveProperty("providerCustomerId")

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("customer creation requires reconciliation")
    expect(providerWrite).toHaveBeenCalledTimes(1)
  })

  it("terminalizes a deterministically rejected customer attempt without permanent blocking", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
    } = await createPayloadStub()
    const rejectedWrite = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mollie.com/v2/customers")
      return new Response(JSON.stringify({ status: 422, title: "Fixture provider rejection",
        detail: "Customer data was rejected.",
      }), { status: 422 })
    })
    vi.stubGlobal("fetch", rejectedWrite)
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("422")
    expect(rejectedWrite).toHaveBeenCalledTimes(1)
    expect(billingAgreements[0]).toMatchObject({
      state: "pending_first_payment",
      reconciliationRequired: false,
      failureReason: "Mollie customer creation failed with HTTP 422.",
    })
    expect(paymentAttempts).toHaveLength(1)
    expect(paymentAttempts[0]).toMatchObject({
      attemptNumber: 1,
      state: "failed",
      reconciliationRequired: false,
      failureCode: "mollie_http_422",
      failureMessage: "Mollie customer creation failed with HTTP 422.",
    })
    expect(paymentAttempts[0]?.stateHistory).toContainEqual(
      expect.objectContaining({ state: "failed" }),
    )

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({ id: "cst_afterrejection" }), {
          status: 201,
        })
      }
      expect(url).toBe("https://api.mollie.com/v2/payments")
      return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_afterrejection", sequenceType: "first",
        id: "tr_aftercustomerrejection",
        status: "open",
        _links: {
          checkout: {
            href: "https://www.mollie.com/checkout/after-customer-rejection",
          },
        },
      }), { status: 201 })
    }))

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .resolves.toMatchObject({
        reused: false,
        paymentAttempt: {
          attemptNumber: 2,
          providerPaymentId: "tr_aftercustomerrejection",
        },
      })
    expect(paymentAttempts).toHaveLength(2)
    expect(paymentAttempts.map((entry) => entry.attemptNumber)).toEqual([1, 2])
  })

  it("resumes an exact recovered customer with one payment POST", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
    } = await createPayloadStub()
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("connection closed after customer acceptance")
    }))
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("provider transport")
    const agreement = billingAgreements[0]!
    await expect(recoverMissingMollieCustomerReferences(payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => [{
        id: "cst_recoveredaftertimeout",
        metadata: {
          billingAgreementId: agreement.id,
          orderId: 600,
          tenantId: 1,
        },
      }]),
    })).resolves.toEqual({ examined: 1, recovered: 1 })
    expect(agreement).toMatchObject({
      providerCustomerId: "cst_recoveredaftertimeout",
      reconciliationRequired: false,
      failureReason: null,
    })

    const providerWrite = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mollie.com/v2/payments")
      return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_recoveredaftertimeout", sequenceType: "first",
        id: "tr_aftercustomerrecovery",
        status: "open",
        _links: {
          checkout: {
            href: "https://www.mollie.com/checkout/after-customer-recovery",
          },
        },
      }), { status: 201 })
    })
    vi.stubGlobal("fetch", providerWrite)
    const results = await Promise.allSettled([
      createMollieCheckoutForGenerationRun(payload, input),
      createMollieCheckoutForGenerationRun(payload, input),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(providerWrite).toHaveBeenCalledTimes(1)
    expect(paymentAttempts).toHaveLength(1)
    expect(paymentAttempts[0]).toMatchObject({
      idempotencyKey:
        "mollie:first-payment:order:600:authority-v3:attempt-1",
      attemptNumber: 1,
      state: "pending_provider",
      providerPaymentId: "tr_aftercustomerrecovery",
      reconciliationRequired: false,
    })
    expect(paymentAttempts[0]?.stateHistory).toContainEqual(
      expect.objectContaining({
        state: "pending_provider",
        reason: "mollie_customer_authority_confirmed",
      }),
    )
  })

  it("lets only one worker dispatch after customer authority is confirmed", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      update,
    } = await createPayloadStub()
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected Payload update implementation.")
    let customerBound!: () => void
    let releaseOriginal!: () => void
    const customerBoundPromise = new Promise<void>((resolve) => {
      customerBound = resolve
    })
    const releaseOriginalPromise = new Promise<void>((resolve) => {
      releaseOriginal = resolve
    })
    update.mockImplementation(async (args) => {
      const result = await originalUpdate(args)
      if (
        args.collection === "billing-agreements" &&
        typeof recordValue(args.data).providerCustomerId === "string"
      ) {
        customerBound()
        await releaseOriginalPromise
      }
      return result
    })
    const providerWrite = vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({
          id: "cst_confirmedrace",
        }), { status: 201 })
      }
      expect(url).toBe("https://api.mollie.com/v2/payments")
      return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_confirmedrace", sequenceType: "first",
        id: "tr_confirmedrace",
        status: "open",
        _links: {
          checkout: { href: "https://www.mollie.com/checkout/confirmed-race" },
        },
      }), { status: 201 })
    })
    vi.stubGlobal("fetch", providerWrite)
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    const originalWorker = createMollieCheckoutForGenerationRun(payload, input)
    await customerBoundPromise
    expect(billingAgreements[0]).toMatchObject({
      providerCustomerId: "cst_confirmedrace",
      reconciliationRequired: false,
    })
    const resumedWorker = createMollieCheckoutForGenerationRun(payload, input)
    await vi.waitFor(() =>
      expect(providerWrite.mock.calls.filter(([url]) =>
        url === "https://api.mollie.com/v2/payments",
      )).toHaveLength(1)
    )
    releaseOriginal()
    const results = await Promise.allSettled([originalWorker, resumedWorker])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(providerWrite.mock.calls.filter(([url]) =>
      url === "https://api.mollie.com/v2/customers",
    )).toHaveLength(1)
    expect(providerWrite.mock.calls.filter(([url]) =>
      url === "https://api.mollie.com/v2/payments",
    )).toHaveLength(1)
    expect(paymentAttempts).toHaveLength(1)
    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      providerPaymentId: "tr_confirmedrace",
      reconciliationRequired: false,
    })
  })

  it("does not redispatch after restart from a reclaimed payment attempt", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
    } = await createPayloadStub()
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("connection closed after customer acceptance")
    }))
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("provider transport")
    const agreement = billingAgreements[0]!
    await recoverMissingMollieCustomerReferences(payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => [{
        id: "cst_recoveredbeforerestart",
        metadata: {
          billingAgreementId: agreement.id,
          orderId: 600,
          tenantId: 1,
        },
      }]),
    })
    const providerWrite = vi.fn(async () => {
      throw new TypeError("connection closed after payment acceptance")
    })
    vi.stubGlobal("fetch", providerWrite)

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("provider transport")
    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_write_indeterminate",
    })
    expect(paymentAttempts[0]?.stateHistory).toContainEqual(
      expect.objectContaining({
        state: "pending_provider",
        reason: "mollie_customer_authority_confirmed",
      }),
    )

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("requires reconciliation")
    expect(providerWrite).toHaveBeenCalledTimes(1)
  })

  it("recovers a provider-committed payment after its response is lost without a second POST", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      tenant,
      order,
      paymentAttempts,
      accountingDocuments,
      queue,
    } = await createPayloadStub({
      domainOrder: { domain: "clientsite.nl" },
    })
    Object.assign(tenant, { status: "active" })
    let providerPayment: {
      id: string
      status: string
      amount: { currency: string; value: string }
      customerId: string
      sequenceType: "first"
      paidAt: string
      metadata: Record<string, unknown>
      _embedded: { refunds: never[]; chargebacks: never[] }
    } | null = null
    let paymentPostCount = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({
          id: "cst_responselost",
          name: "Acme Studio",
          email: "client@example.com",
        }), { status: 201 })
      }
      if (url === "https://api.mollie.com/v2/payments" && init?.method === "POST") {
        paymentPostCount += 1
        const body = JSON.parse(String(init.body)) as {
          amount: { currency: string; value: string }
          customerId: string
          sequenceType: "first"
          metadata: Record<string, unknown>
        }
        providerPayment = {
          id: "tr_committedresponselost",
          status: "paid",
          amount: body.amount,
          customerId: body.customerId,
          sequenceType: body.sequenceType,
          paidAt: "2026-07-28T10:05:00.000Z",
          metadata: body.metadata,
          _embedded: { refunds: [], chargebacks: [] },
        }
        throw new TypeError("connection closed after payment acceptance")
      }
      if (url.startsWith("https://api.mollie.com/v2/payments/tr_committedresponselost")) {
        if (!providerPayment) throw new Error("Provider payment was not committed.")
        return new Response(JSON.stringify(providerPayment), { status: 200 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))
    const input = {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    }

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("provider transport")
    expect(paymentPostCount).toBe(1)
    expect(paymentAttempts).toHaveLength(1)
    const attempt = paymentAttempts[0]!
    expect(attempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_write_indeterminate",
    })
    expect(attempt).not.toHaveProperty("providerPaymentId")

    await expect(createMollieCheckoutForGenerationRun(payload, input))
      .rejects.toThrow("requires reconciliation")
    expect(paymentPostCount).toBe(1)
    if (!providerPayment) throw new Error("Expected a committed provider payment.")
    const listRecentMolliePayments = vi.fn(async () => [providerPayment!])
    await expect(recoverMissingMolliePaymentReferences(payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments,
    }, new Date(Date.now() + 3 * 60_000))).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: ["tr_committedresponselost"],
    })
    expect(listRecentMolliePayments).toHaveBeenCalledTimes(1)
    expect(attempt).toMatchObject({
      providerPaymentId: "tr_committedresponselost",
      reconciliationRequired: true,
    })

    await queueMolliePaymentSync(payload, "tr_committedresponselost")
    expect(queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "sync-mollie-payment",
      input: { paymentId: "tr_committedresponselost" },
    }))
    const syncHandler = createTaskRunner(syncMolliePaymentTask)
    await expect(syncHandler({
      input: { paymentId: "tr_committedresponselost" },
      req: { payload },
    })).resolves.toMatchObject({
      output: {
        status: "paid",
        paymentAttemptId: String(attempt.id),
        orderId: "600",
        fulfillmentQueued: true,
      },
    })
    expect(attempt).toMatchObject({
      state: "paid",
      providerPaymentId: "tr_committedresponselost",
      reconciliationRequired: false,
    })
    expect(order).toMatchObject({
      state: "fulfillment_pending",
      paymentStatus: "paid",
      providerPaymentId: "tr_committedresponselost",
    })
    expect(accountingDocuments.filter((document) =>
      document.documentType === "invoice",
    )).toHaveLength(1)

    const fulfillmentJob = queue.mock.calls.find(([job]) => job.task === "fulfill-order")?.[0]
    if (!fulfillmentJob?.input?.orderId || !fulfillmentJob.input.paymentAttemptId) {
      throw new Error("Expected synchronization to queue fulfillment.")
    }
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "shadow")
    const fulfillmentHandler = createTaskRunner(fulfillOrderTask)
    const fulfillmentResult = await fulfillmentHandler({
      input: {
        orderId: fulfillmentJob.input.orderId,
        paymentAttemptId: fulfillmentJob.input.paymentAttemptId,
      },
      req: { payload },
    })
    expect(fulfillmentResult).toMatchObject({
      output: { status: "fulfilled", orderId: "600", message: "" },
    })
    expect(order.state).toBe("fulfilled")
    expect(paymentPostCount).toBe(1)
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).startsWith(
        "https://api.mollie.com/v2/payments/tr_committedresponselost",
      ) && init?.method !== "POST"
    )).toHaveLength(1)
  })

  it("creates one new stable attempt after a cancelled first-payment attempt", async () => {
    enableSandboxCommerceRelease()
    let paymentNumber = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({
          id: "cst_test123",
          name: "Acme Studio",
          email: "client@example.com",
        }), { status: 201 })
      }
      paymentNumber += 1
      return new Response(JSON.stringify({
        id: `tr_retry${paymentNumber}`,
        customerId: "cst_test123", sequenceType: "first",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        metadata: { orderId: 600 },
        _links: {
          checkout: {
            href: `https://www.mollie.com/checkout/retry-${paymentNumber}`,
          },
        },
      }), { status: 201 })
    }))
    const fixture = await createPayloadStub()
    await createMollieCheckoutForGenerationRun(fixture.payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })
    Object.assign(fixture.paymentAttempts[0]!, {
      state: "cancelled",
      reconciliationRequired: false,
      cancelledAt: "2026-07-28T10:05:00.000Z",
    })
    Object.assign(fixture.order, {
      paymentStatus: "cancelled",
      providerPaymentId: "tr_retry1",
    })
    Object.assign(fixture.run, {
      payment: {
        status: "cancelled",
        provider: "mollie",
        externalReference: "tr_retry1",
      },
    })

    const retried = await createMollieCheckoutForGenerationRun(fixture.payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })

    expect(retried).toMatchObject({
      reused: false,
      checkoutUrl: "https://www.mollie.com/checkout/retry-2",
      paymentAttempt: {
        attemptNumber: 2,
        idempotencyKey:
          "mollie:first-payment:order:600:authority-v3:attempt-2",
      },
    })
    expect(fixture.paymentAttempts).toHaveLength(2)
    const paymentWrites = vi.mocked(fetch).mock.calls.filter(
      ([url]) => url === "https://api.mollie.com/v2/payments",
    )
    expect(paymentWrites).toHaveLength(2)
  })

  it("adds the selected domain extra fee to the first Mollie payment amount", async () => {
    enableSandboxCommerceRelease()
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/customers")
      ? Response.json({ id: "cst_test123", name: "Acme Studio", email: "client@example.com" }, { status: 201 })
      : Response.json({ id: "tr_test123", status: "open", amount: { currency: "EUR", value: "501.50" },
          customerId: "cst_test123", sequenceType: "first",
          _links: { checkout: { href: "https://www.mollie.com/checkout/test" } } }, { status: 201 })))
    const { payload } = await createPayloadStub({
      domainOrder: {
        status: "ready_to_register",
        domain: "acme.nl",
        providerPriceAmount: "12.50",
        providerPriceCurrency: "EUR",
        maxProviderPriceAmount: "10.00",
        maxProviderPriceCurrency: "EUR",
      },
    })

    await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
      selectedDomain: "acme.nl",
    })

    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      amount: { currency: "EUR", value: "501.50" },
    })
  })

  it("rejects malformed current-catalog migration charges before provider work", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      order,
      billingAgreements,
      paymentAttempts,
    } = await createPayloadStub()
    Object.assign(order, {
      orderKind: "initial_subscription",
      catalogVersion: "2026-07-29.1",
      quoteEvidence: {
        domainMode: "new_registration",
        migrationServiceFeeNetMinor: 4_900,
        migration: { classification: "assisted_standard" },
      },
      netLineItems: [{
        code: "migration-assisted-standard-per-domain",
        quantity: 1,
        netAmountMinor: 4_900,
      }],
    })

    await expect(createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })).rejects.toThrow("migration service fee")
    expect(billingAgreements).toHaveLength(0)
    expect(paymentAttempts).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects a retired migration source before current-catalog provider work", async () => {
    enableSandboxCommerceRelease()
    const { payload, order, billingAgreements, paymentAttempts } = await createPayloadStub()
    Object.assign(order, {
      orderKind: "initial_subscription",
      catalogVersion: "2026-07-29.1",
      quoteEvidence: {
        domainMode: "existing_domain",
        migrationServiceFeeNetMinor: 0,
        migration: {
          classification: "automatic",
          sourceMechanism: "validated_provider_export_v1",
        },
      },
    })

    await expect(createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })).rejects.toThrow("zero-fee automatic migration")
    expect(billingAgreements).toHaveLength(0)
    expect(paymentAttempts).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("allows only one provider payment write when first-payment schedulers race", async () => {
    enableSandboxCommerceRelease()
    const { payload, paymentAttempts, billingAgreements } = await createPayloadStub()

    const results = await Promise.allSettled([
      createMollieCheckoutForGenerationRun(payload, {
        runId: 500,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
      }),
      createMollieCheckoutForGenerationRun(payload, {
        runId: 500,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
      }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(paymentAttempts).toHaveLength(1)
    expect(billingAgreements).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toHaveLength(1)
  })

  it("reuses an existing matching pending Mollie checkout", async () => {
    const { payload, update } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test123",
        checkoutUrl: "https://www.mollie.com/checkout/test",
        customerEmail: "client@example.com",
        clientSlug: "acme",
      },
    })
    const result = await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })

    expect(result.reused).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("blocks checkout before preview approval", async () => {
    const { payload } = await createPayloadStub({ clientApproval: { status: "pending" } })

    await expect(createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
    })).rejects.toThrow("approved preview")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["paid", "paid", "completed"],
    ["canceled", "cancelled", "canceled"],
    ["pending", "pending_provider", "pending_provider"],
    ["failed", "failed", "failed"],
    ["expired", "expired", "expired"],
  ])("maps synchronized Mollie status %s to attempt state %s", async (
    mollieStatus,
    expectedState,
    expectedProjectionStatus,
  ) => {
    const { payload, run, update } = await createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_test123" },
    })

    const result = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: mollieStatus,
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
      },
    }))

    expect(result.state).toBe(expectedState)
    expect(run.payment).toMatchObject({
      status: expectedProjectionStatus,
      provider: "mollie",
      externalReference: "tr_test123",
      providerStatus: mollieStatus,
    })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "tenants" }))
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "published-site-snapshots" }))
    expect(run.errors).toBeNull()
  })

  it("ignores an order-only provider payment instead of synthesizing a payment attempt", async () => {
    const { payload } = await createPayloadStub()

    await expect(synchronizeMolliePayment(payload, "tr_orderonly", async () => ({
      id: "tr_orderonly",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: { orderId: 600 },
    }))).rejects.toThrow("not linked to a payment attempt")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reports duplicate webhook delivery while keeping the operation idempotent", async () => {
    const { payload } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_test123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })

    const result = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }))

    expect(result).toMatchObject({ ok: true, state: "paid", duplicate: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("creates application-owned recurring payments against a valid Mollie mandate", async () => {
    enableSandboxCommerceRelease()
    const { payload, billingAgreements, paymentAttempts } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_first123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
          method: "directdebit",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        const body = JSON.parse(String(init?.body))
        expect(body).toMatchObject({
          customerId: "cst_test123",
          mandateId: "mdt_test123",
          sequenceType: "recurring",
          webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
          metadata: {
            billingAgreementId: billingAgreements[0]?.id,
            mandateId: "mdt_test123",
            sequenceType: "recurring",
            orderId: 600,
          },
        })
        expect(body).not.toHaveProperty("redirectUrl")
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", mandateId: "mdt_test123", sequenceType: "recurring",
          id: "tr_recurring123",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const result = await createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })
    Object.assign(result.paymentAttempt, {
      idempotencyKey: "mollie:recurring:order:600:v1",
    })
    const legacyReuse = await createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })

    expect(result.reused).toBe(false)
    expect(legacyReuse.reused).toBe(true)
    expect(result.paymentAttempt).toMatchObject({
      state: "pending_provider",
      purpose: "recurring",
      sequenceType: "recurring",
      providerPaymentId: "tr_recurring123",
    })
    expect(paymentAttempts).toHaveLength(2)
    expect(vi.mocked(fetch).mock.calls.some(([url]) =>
      String(url).includes("/subscriptions"),
    )).toBe(false)
  })

  it("allows only one provider write when recurring-payment schedulers race", async () => {
    enableSandboxCommerceRelease()
    const { payload, billingAgreements, paymentAttempts, order } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforerace",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      orderKind: "subscription_renewal",
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", mandateId: "mdt_test123", sequenceType: "recurring",
          id: "tr_recurringrace",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const input = {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    }
    const results = await Promise.allSettled([
      createApplicationRecurringMolliePayment(payload, input),
      createApplicationRecurringMolliePayment(payload, input),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(paymentAttempts.filter((attempt) =>
      attempt.purpose === "recurring",
    )).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toHaveLength(1)
  })

  it("does not create a recurring provider payment when cancellation wins the claim", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      cancelBeforeRecurringClaim: true,
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforecancel",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
        }), { status: 200 })
      }
      throw new Error(`Unexpected provider write ${url}`)
    }))

    await expect(createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })).rejects.toThrow("cancelled before provider write")

    expect(paymentAttempts.find((attempt) =>
      attempt.purpose === "recurring"
    )).toMatchObject({
      state: "cancelled",
      reconciliationRequired: false,
      failureCode: "collection_cancelled_before_provider_write",
    })
    expect(vi.mocked(fetch).mock.calls.some(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toBe(false)
  })

  it("reconciles a crash after the recurring claim before one safe provider retry", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforeclaimcrash",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    const attempt = paymentAttempts[0]!
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      providerPaymentId: null,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(attempt, {
      idempotencyKey:
        "mollie:recurring:order:600:authority-v2:attempt-1",
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerPaymentId: null,
      providerStatus: null,
      reconciliationRequired: true,
      createdAt: "2026-07-28T10:00:00.000Z",
    })
    Object.assign(billingAgreements[0]!, {
      state: "active",
      renewalIntent: true,
      lastPaymentAttemptAt: attempt.createdAt,
      reconciliationRequired: true,
      failureReason: "A recurring Mollie provider write is in progress.",
    })

    await expect(recoverMissingMolliePaymentReferences(payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => []),
    }, new Date("2026-07-28T10:03:00.000Z"))).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: [],
    })
    expect(attempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: false,
      failureCode: "provider_absence_reconciled",
    })
    expect(billingAgreements[0]).toMatchObject({
      lastPaymentAttemptAt: null,
      reconciliationRequired: false,
      failureReason: null,
    })

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", mandateId: "mdt_test123", sequenceType: "recurring",
          id: "tr_recurringafterreconciliation",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const retryInput = {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    }
    const retries = await Promise.allSettled([
      createApplicationRecurringMolliePayment(payload, retryInput),
      createApplicationRecurringMolliePayment(payload, retryInput),
    ])
    expect(retries.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1)
    expect(retries.filter((result) => result.status === "rejected"))
      .toHaveLength(1)
    expect(attempt).toMatchObject({
      providerPaymentId: "tr_recurringafterreconciliation",
      reconciliationRequired: false,
    })
    expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toHaveLength(1)
  })

  it("releases a recurring agreement claim after Mollie definitively rejects creation", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforerejection",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      orderKind: "subscription_renewal",
    })
    let paymentWrites = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        paymentWrites += 1
        if (paymentWrites === 1) {
          return new Response(JSON.stringify({ status: 422, title: "Fixture provider rejection",
            detail: "The recurring payment was rejected.",
          }), { status: 422 })
        }
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", mandateId: "mdt_test123", sequenceType: "recurring",
          id: "tr_recurringafterrejection",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    await expect(createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })).rejects.toThrow("422")
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: false,
      lastPaymentAttemptAt: null,
    })
    expect(paymentAttempts.find((attempt) =>
      attempt.purpose === "recurring" && attempt.attemptNumber === 1
    )).toMatchObject({
      state: "failed",
      reconciliationRequired: false,
    })

    await expect(createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
      attemptNumber: 2,
    })).resolves.toMatchObject({
      paymentAttempt: expect.objectContaining({
        providerPaymentId: "tr_recurringafterrejection",
      }),
    })
    expect(paymentWrites).toBe(2)
  })

  it("records a revoked mandate as a dunning failure without an external payment write", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforerevocation",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "invalid",
        }), { status: 200 })
      }
      throw new Error(`Unexpected provider write ${url}`)
    }))

    const result = await createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })

    expect(result.paymentAttempt).toMatchObject({
      state: "failed",
      reconciliationRequired: false,
      failureCode: "mandate_invalid",
    })
    expect(billingAgreements[0]).toMatchObject({
      state: "past_due",
      reconciliationRequired: false,
      failureReason: "Mollie mandate status is invalid.",
    })
    expect(paymentAttempts.filter((attempt) =>
      attempt.purpose === "recurring"
    )).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.some(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toBe(false)
  })

  it("replaces a revoked mandate through the frozen due payment and restores billing-owned suspension", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
      tenant,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_firstbeforerecovery",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "invalid",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        const body = JSON.parse(String(init?.body))
        expect(body).toMatchObject({
          customerId: "cst_test123",
          sequenceType: "first",
          redirectUrl: "https://admin.siteinabox.nl/settings?billing=return#billing",
          metadata: {
            billingAgreementId: billingAgreements[0]?.id,
            sequenceType: "first",
            purpose: "recurring",
            orderId: 600,
          },
        })
        expect(body).not.toHaveProperty("mandateId")
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", sequenceType: "first",
          id: "tr_mandaterecovery",
          status: "open",
          _links: {
            checkout: { href: "https://www.mollie.com/checkout/recover" },
          },
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    await createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })
    Object.assign(billingAgreements[0]!, {
      state: "suspended",
      serviceSuspensionStatus: "billing_suspended",
      suspendedAt: "2026-08-15T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-15T10:00:00.000Z",
    })
    Object.assign(tenant, {
      status: "suspended",
      billingSuspensionAgreement: billingAgreements[0]?.id,
      billingSuspendedAt: "2026-08-15T10:00:00.000Z",
    })

    const recovery = await createMandateRecoveryMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      tenantId: 1,
    })
    expect(recovery).toMatchObject({
      checkoutUrl: "https://www.mollie.com/checkout/recover",
      reused: false,
    })
    expect(recovery.paymentAttempt).toMatchObject({
      purpose: "recurring",
      sequenceType: "first",
      state: "pending_provider",
      providerPaymentId: "tr_mandaterecovery",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_mandaterecovery",
      async () => ({
        id: "tr_mandaterecovery",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_replacement",
        sequenceType: "first",
        paidAt: "2026-08-15T10:05:00.000Z",
        metadata: {
          paymentAttemptId: recovery.paymentAttempt.id,
          billingAgreementId: billingAgreements[0]?.id,
          orderId: 600,
          purpose: "recurring",
          sequenceType: "first",
          mollieCustomerId: "cst_test123",
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      providerMandateId: "mdt_replacement",
      currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
      nextChargeAt: "2026-09-01T10:00:00.000Z",
      serviceSuspensionStatus: "none",
      reconciliationRequired: false,
    })
    expect(tenant).toMatchObject({
      status: "active",
      billingSuspensionAgreement: null,
    })
    expect(paymentAttempts.filter((attempt) =>
      attempt.purpose === "recurring"
    )).toHaveLength(2)
  })

  it("rejects unresolved reconciliation and non-subscription recovery obligations", async () => {
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_initialauthority",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      orderKind: "domain_renewal",
      paymentStatus: "failed",
    })
    Object.assign(billingAgreements[0]!, {
      state: "past_due",
      reconciliationRequired: true,
      failureReason: "Provider state is unresolved.",
    })
    paymentAttempts.push(paymentAttemptFixture({
      id: 999,
      order: 600,
      billingAgreement: billingAgreements[0]?.id,
      tenant: 1,
      attemptNumber: 2,
      state: "failed",
      purpose: "domain_renewal",
      sequenceType: "recurring",
      provider: "mollie",
      currency: "EUR",
      netAmountMinor: requiredFixtureAmount(order.subtotalNetMinor),
      vatAmountMinor: requiredFixtureAmount(order.vatAmountMinor),
      grossAmountMinor: requiredFixtureAmount(order.totalGrossMinor),
      reconciliationRequired: false,
      createdAt: "2026-08-15T10:00:00.000Z",
    }))

    await expect(createMandateRecoveryMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      tenantId: 1,
    })).rejects.toThrow("not available")

    billingAgreements[0]!.reconciliationRequired = false
    await expect(createMandateRecoveryMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      tenantId: 1,
    })).rejects.toThrow("reconciled failed or charged-back payment")
  })

  it("coalesces concurrent mandate-recovery submissions into one Mollie POST", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedcycle",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    let releaseProvider!: () => void
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve
    })
    vi.stubGlobal("fetch", vi.fn(async () => {
      await providerGate
      return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", sequenceType: "first",
        id: "tr_singlerecovery",
        status: "open",
        _links: {
          checkout: { href: "https://www.mollie.com/checkout/single-recovery" },
        },
      }), { status: 201 })
    }))

    const first = createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const second = createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })
    await expect(second).rejects.toThrow("already claimed")
    releaseProvider()
    await expect(first).resolves.toMatchObject({
      reused: false,
      checkoutUrl: "https://www.mollie.com/checkout/single-recovery",
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fixture.paymentAttempts.filter((attempt) =>
      String(attempt.idempotencyKey).startsWith("mollie:mandate-recovery:")
    )).toHaveLength(1)
  })

  it("blocks recurring collection until mandate recovery is authoritatively synchronized", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedbeforerecoveryrace",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    Object.assign(fixture.billingAgreements[0]!, {
      state: "past_due",
      providerMandateId: "mdt_test123",
      renewalIntent: true,
    })
    let releaseProvider!: () => void
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/payments") {
        await providerGate
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", sequenceType: "first",
          id: "tr_recoverywon",
          status: "open",
          _links: {
            checkout: { href: "https://www.mollie.com/checkout/recovery-won" },
          },
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const recovery = createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A mandate-recovery Mollie provider write is in progress.",
    })

    await expect(createApplicationRecurringMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      orderId: 600,
      purpose: "domain_renewal",
    })).rejects.toThrow("active customer mandate")
    expect(fetch).toHaveBeenCalledTimes(1)

    releaseProvider()
    const recoveryResult = await recovery
    expect(recoveryResult).toMatchObject({
      checkoutUrl: "https://www.mollie.com/checkout/recovery-won",
    })
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A mandate-recovery Mollie provider write is in progress.",
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await expect(createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })).resolves.toMatchObject({
      reused: true,
      checkoutUrl: "https://www.mollie.com/checkout/recovery-won",
    })
    await synchronizeMolliePayment(
      fixture.payload,
      "tr_recoverywon",
      async () => ({
        id: "tr_recoverywon",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        metadata: {
          paymentAttemptId: recoveryResult.paymentAttempt.id,
          billingAgreementId: fixture.billingAgreements[0]?.id,
          orderId: 600,
          purpose: "recurring",
          sequenceType: "first",
          mollieCustomerId: "cst_test123",
        },
      }),
    )
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A mandate-recovery Mollie provider write is in progress.",
    })
    await expect(createApplicationRecurringMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      orderId: 600,
      purpose: "domain_renewal",
    })).rejects.toThrow("active customer mandate")

    await synchronizeMolliePayment(
      fixture.payload,
      "tr_recoverywon",
      async () => ({
        id: "tr_recoverywon",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_replacementafterrace",
        sequenceType: "first",
        paidAt: "2026-08-15T10:05:00.000Z",
        metadata: {
          paymentAttemptId: recoveryResult.paymentAttempt.id,
          billingAgreementId: fixture.billingAgreements[0]?.id,
          orderId: 600,
          purpose: "recurring",
          sequenceType: "first",
          mollieCustomerId: "cst_test123",
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )
    expect(fixture.billingAgreements[0]).toMatchObject({
      state: "active",
      providerMandateId: "mdt_replacementafterrace",
      reconciliationRequired: false,
      failureReason: null,
    })
  })

  it("blocks mandate recovery until recurring collection is authoritatively synchronized", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedbeforecollectionrace",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    Object.assign(fixture.billingAgreements[0]!, {
      state: "past_due",
      providerMandateId: "mdt_test123",
      renewalIntent: true,
    })
    let releaseProvider!: () => void
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/customers/cst_test123/mandates/mdt_test123")) {
        return new Response(JSON.stringify({
          id: "mdt_test123",
          status: "valid",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        await providerGate
        return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", mandateId: "mdt_test123", sequenceType: "recurring",
          id: "tr_collectionwon",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const recurring = createApplicationRecurringMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      orderId: 600,
      purpose: "domain_renewal",
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A recurring Mollie provider write is in progress.",
    })

    await expect(createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })).rejects.toThrow("not available")
    expect(vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "https://api.mollie.com/v2/payments",
    )).toHaveLength(1)

    releaseProvider()
    const recurringResult = await recurring
    expect(recurringResult).toMatchObject({
      paymentAttempt: expect.objectContaining({
        providerPaymentId: "tr_collectionwon",
      }),
    })
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A recurring Mollie provider write is in progress.",
    })
    await expect(createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })).rejects.toThrow("not available")

    const recurringProviderPayment = (status: "pending" | "failed") => ({
      id: "tr_collectionwon",
      status,
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_test123",
      mandateId: "mdt_test123",
      sequenceType: "recurring" as const,
      metadata: {
        paymentAttemptId: recurringResult.paymentAttempt.id,
        billingAgreementId: fixture.billingAgreements[0]?.id,
        orderId: 600,
        idempotencyKey: recurringResult.paymentAttempt.idempotencyKey,
        purpose: "domain_renewal",
        sequenceType: "recurring",
        mollieCustomerId: "cst_test123",
        mandateId: "mdt_test123",
      },
    })
    await synchronizeMolliePayment(
      fixture.payload,
      "tr_collectionwon",
      async () => recurringProviderPayment("pending"),
    )
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A recurring Mollie provider write is in progress.",
    })
    await synchronizeMolliePayment(
      fixture.payload,
      "tr_collectionwon",
      async () => recurringProviderPayment("failed"),
    )
    expect(fixture.billingAgreements[0]).toMatchObject({
      state: "past_due",
      reconciliationRequired: false,
      failureReason: "Mollie payment state is failed.",
    })
  })

  it("does not reuse a pending recovery checkout from an older obligation", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_newerfailedcycle",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    fixture.paymentAttempts.push(paymentAttemptFixture({
      ...fixture.paymentAttempts[0],
      id: 899,
      order: 599,
      attemptNumber: 2,
      idempotencyKey: "mollie:mandate-recovery:order:599:obligation-898",
      state: "pending_provider",
      purpose: "recurring",
      sequenceType: "first",
      providerPaymentId: "tr_oldrecovery",
      checkoutUrl: "https://www.mollie.com/checkout/old-obligation",
      reconciliationRequired: false,
      createdAt: "2026-07-15T09:50:00.000Z",
    }))
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", sequenceType: "first",
        id: "tr_currentrecovery",
        status: "open",
        _links: {
          checkout: { href: "https://www.mollie.com/checkout/current-obligation" },
        },
      }), { status: 201 })
    ))

    const result = await createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })

    expect(result).toMatchObject({
      reused: false,
      checkoutUrl: "https://www.mollie.com/checkout/current-obligation",
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("releases the mandate-recovery agreement claim after deterministic rejection", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedbeforerecoveryrejection",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ status: 422, title: "Fixture provider rejection",
        detail: "The mandate-recovery payment was rejected.",
      }), { status: 422 })
    ))

    await expect(createMandateRecoveryMolliePayment(fixture.payload, {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    })).rejects.toThrow("422")

    expect(fixture.paymentAttempts.at(-1)).toMatchObject({
      state: "failed",
      reconciliationRequired: false,
    })
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: false,
      lastPaymentAttemptAt: null,
      failureReason: "Mollie rejected the mandate-recovery provider write.",
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("reconciles an absent recovery payment before one concurrency-safe retry", async () => {
    enableSandboxCommerceRelease()
    const fixture = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedbeforetimeout",
        providerStatus: "failed",
        mollieCustomerId: "cst_test123",
      },
    })
    configureRecoverableSubscription(fixture)
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("connection closed after provider acceptance")
    }))
    const input = {
      billingAgreementId: String(fixture.billingAgreements[0]?.id),
      tenantId: 1,
    }

    await expect(
      createMandateRecoveryMolliePayment(fixture.payload, input),
    ).rejects.toThrow("provider transport")
    await expect(
      createMandateRecoveryMolliePayment(fixture.payload, input),
    ).rejects.toThrow("already claimed")

    expect(fetch).toHaveBeenCalledTimes(1)
    const recoveryAttempt = fixture.paymentAttempts.at(-1)
    expect(recoveryAttempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_write_indeterminate",
    })
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A mandate-recovery Mollie provider write is in progress.",
    })

    await expect(recoverMissingMolliePaymentReferences(fixture.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => []),
    }, new Date(Date.now() + 3 * 60_000))).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: [],
    })
    expect(recoveryAttempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: false,
      failureCode: "provider_absence_reconciled",
    })
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: false,
      failureReason: null,
      lastPaymentAttemptAt: null,
    })

    let releaseProvider!: () => void
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve
    })
    vi.stubGlobal("fetch", vi.fn(async () => {
      await providerGate
      return new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" }, customerId: "cst_test123", sequenceType: "first",
        id: "tr_recoveredafterabsence",
        status: "open",
        _links: {
          checkout: {
            href: "https://www.mollie.com/checkout/recovered-after-absence",
          },
        },
      }), { status: 201 })
    }))

    const retry = createMandateRecoveryMolliePayment(fixture.payload, input)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await expect(
      createMandateRecoveryMolliePayment(fixture.payload, input),
    ).rejects.toThrow("already claimed")
    releaseProvider()
    await expect(retry).resolves.toMatchObject({
      checkoutUrl:
        "https://www.mollie.com/checkout/recovered-after-absence",
      reused: false,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fixture.paymentAttempts.filter((attempt) =>
      String(attempt.idempotencyKey).startsWith("mollie:mandate-recovery:")
    )).toHaveLength(1)
    expect(fixture.billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A mandate-recovery Mollie provider write is in progress.",
    })
  })

  it("preserves cancellation when a provider-committed payment settles after finalization", async () => {
    const {
      payload,
      billingAgreements,
      paymentAttempts,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_latecommitted",
        providerStatus: "pending",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      paymentStatus: "open",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerPaymentId: "tr_latecommitted",
      providerStatus: "pending",
    })
    Object.assign(billingAgreements[0]!, {
      state: "cancelled",
      renewalIntent: false,
      cancelAt: "2026-08-01T10:00:00.000Z",
      cancelledAt: "2026-08-01T10:00:00.000Z",
      endedAt: "2026-08-01T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })

    await synchronizeMolliePayment(payload, "tr_latecommitted", async () => ({
      id: "tr_latecommitted",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_test123",
      mandateId: "mdt_test123",
      sequenceType: "recurring",
      paidAt: "2026-08-01T10:00:01.000Z",
      metadata: {
        paymentAttemptId: paymentAttempts[0]?.id,
        billingAgreementId: billingAgreements[0]?.id,
        orderId: 600,
        purpose: "recurring",
        sequenceType: "recurring",
        mollieCustomerId: "cst_test123",
        mandateId: "mdt_test123",
      },
      _embedded: { refunds: [], chargebacks: [] },
    }))

    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-09-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
  })

  it("reconciles a full refund into one issued credit note and remains duplicate-safe", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
      billingAgreements,
      managedDomains,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refund123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    managedDomains.push(managedDomainFixture({
      id: 1_301,
      tenant: 1,
      state: "active",
      custodyStatus: "managed",
      domainNameAscii: "customer-owned.nl",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareDnsRecordIds: ["mx", "dkim", "website"],
    }))
    const custodyBeforeRefund = structuredClone(managedDomains[0])
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mollie.com/v2/payments/tr_refund123/refunds")
      return new Response(JSON.stringify({
        id: "re_test123",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    }))

    const requested = await requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })
    expect(requested).toMatchObject({
      providerRefundId: "re_test123",
      reused: false,
      document: {
        documentType: "credit_note",
        state: "pending_provider",
      },
    })
    expect(accountingDocuments).toHaveLength(2)
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: true,
    })
    const whilePending = await processBillingAgreement({
      payload,
      agreement: billingAgreements[0]!,
      now: new Date("2026-08-26T12:00:00.000Z"),
      providerWritesAllowed: () => true,
    })
    expect(whilePending).toEqual({
      status: "waiting_reconciliation",
      paymentRequested: false,
    })

    await synchronizeMolliePayment(
      payload,
      "tr_refund123",
      async () => ({
        id: "tr_refund123",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: true,
    })

    const providerPayment = {
      id: "tr_refund123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_test123",
      mandateId: "mdt_test123",
      sequenceType: "first",
      paidAt: "2026-07-26T12:00:00.000Z",
      metadata: {
        paymentAttemptId: paymentAttempts[0]?.id,
        orderId: 600,
      },
      _embedded: {
        refunds: [{
          id: "re_test123",
          status: "refunded",
          amount: { currency: "EUR", value: "499.00" },
          createdAt: "2026-07-26T12:05:00.000Z",
        }],
        chargebacks: [],
      },
    }
    const first = await synchronizeMolliePayment(
      payload,
      "tr_refund123",
      async () => providerPayment,
    )
    const duplicate = await synchronizeMolliePayment(
      payload,
      "tr_refund123",
      async () => providerPayment,
    )

    expect(first.state).toBe("refunded")
    expect(duplicate).toMatchObject({ state: "refunded", duplicate: true })
    expect(accountingDocuments).toHaveLength(2)
    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      nextChargeAt: null,
      reconciliationRequired: false,
    })
    const afterRefund = await processBillingAgreement({
      payload,
      agreement: billingAgreements[0]!,
      now: new Date("2026-08-26T12:00:00.000Z"),
      providerWritesAllowed: () => true,
    })
    expect(afterRefund.paymentRequested).toBe(false)
    expect(managedDomains[0]).toMatchObject({
      id: custodyBeforeRefund?.id,
      state: custodyBeforeRefund?.state,
      custodyStatus: custodyBeforeRefund?.custodyStatus,
      domainNameAscii: custodyBeforeRefund?.domainNameAscii,
      authoritativeDnsStatus: custodyBeforeRefund?.authoritativeDnsStatus,
      cloudflareDnsRecordIds: custodyBeforeRefund?.cloudflareDnsRecordIds,
    })
    expect(accountingDocuments.find((document) =>
      document.documentType === "credit_note",
    )).toMatchObject({
      state: "issued",
      providerOperationId: "re_test123",
      grossAmountMinor: 49_900,
    })
  })

  it("reconciles an indeterminate refund response into its pending credit note", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundindeterminate",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Provider response connection closed.")
    }))

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })).rejects.toThrow("provider transport")

    const pendingDocument = accountingDocuments.find((document) =>
      document.documentType === "credit_note",
    )
    expect(pendingDocument).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
    })
    expect(pendingDocument?.providerOperationId).toBeUndefined()

    const result = await synchronizeMolliePayment(
      payload,
      "tr_refundindeterminate",
      async () => ({
        id: "tr_refundindeterminate",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: {
          refunds: [{
            id: "re_discoveredaftertimeout",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-26T12:05:00.000Z",
            metadata: { accountingDocumentId: pendingDocument?.id },
          }],
          chargebacks: [],
        },
      }),
    )

    expect(result.state).toBe("refunded")
    expect(accountingDocuments).toHaveLength(2)
    expect(pendingDocument).toMatchObject({
      state: "issued",
      reconciliationRequired: false,
      providerOperationId: "re_discoveredaftertimeout",
    })
  })

  it("keeps a chargeback terminal when a later synchronization sees an older pending state", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      accountingDocuments,
      managedDomains,
      tenant,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_chargeback123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    tenant.status = "active"
    managedDomains.push(managedDomainFixture({
      id: 1_300,
      tenant: 1,
      state: "active",
      domainNameAscii: "acme.test",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareDnsRecordIds: ["mx", "dkim", "website"],
    }))
    const chargeback = await synchronizeMolliePayment(
      payload,
      "tr_chargeback123",
      async () => ({
        id: "tr_chargeback123",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: {
          refunds: [],
          chargebacks: [{
            id: "chb_test_123",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-27T12:00:00.000Z",
          }],
        },
      }),
    )
    const stale = await synchronizeMolliePayment(
      payload,
      "tr_chargeback123",
      async () => ({
        id: "tr_chargeback123",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(chargeback.state).toBe("chargeback")
    expect(stale.state).toBe("chargeback")
    expect(paymentAttempts[0]).toMatchObject({
      state: "chargeback",
      reconciliationRequired: true,
      chargebackAmountMinor: 49_900,
    })
    expect(billingAgreements[0]).toMatchObject({
      state: "suspended",
      serviceSuspensionStatus: "billing_suspended",
      reconciliationRequired: false,
    })
    expect(tenant).toMatchObject({
      status: "suspended",
      billingSuspensionAgreement: billingAgreements[0]?.id,
    })
    expect(accountingDocuments.some((document) =>
      document.providerOperationId === "chb_test_123" &&
      document.documentType === "credit_note",
    )).toBe(true)
    expect(managedDomains[0]).toMatchObject({
      state: "active",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareDnsRecordIds: ["mx", "dkim", "website"],
    })
  })

  it("compensates a stale chargeback tenant suspension when recovery wins the race", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      tenant,
    } = await createPayloadStub({
      recoverBeforeChargebackTenantMutation: true,
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_chargebackrecoveryrace",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    tenant.status = "active"

    await synchronizeMolliePayment(
      payload,
      "tr_chargebackrecoveryrace",
      async () => ({
        id: "tr_chargebackrecoveryrace",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: {
          refunds: [],
          chargebacks: [{
            id: "chb_recovery_race",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-08-15T10:00:00.000Z",
          }],
        },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      serviceSuspensionStatus: "none",
      reconciliationRequired: false,
    })
    expect(tenant).toMatchObject({
      status: "active",
      billingSuspensionAgreement: null,
    })
  })

  it("requires reconciliation before crediting cumulative refunds and chargebacks above capture", async () => {
    const { payload, paymentAttempts, accountingDocuments } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_combinedreversal",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })

    const result = await synchronizeMolliePayment(
      payload,
      "tr_combinedreversal",
      async () => ({
        id: "tr_combinedreversal",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: {
          refunds: [{
            id: "re_combinedreversal",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-27T11:00:00.000Z",
          }],
          chargebacks: [{
            id: "chb_combined_reversal",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-27T12:00:00.000Z",
          }],
        },
      }),
    )

    expect(result.state).toBe("chargeback")
    expect(paymentAttempts[0]).toMatchObject({
      reconciliationRequired: true,
      failureCode: "provider_state_conflict",
      refundedAmountMinor: 49_900,
      chargebackAmountMinor: 49_900,
    })
    expect(accountingDocuments.filter((document) =>
      document.documentType === "credit_note",
    )).toHaveLength(0)
  })

  it("does not let a superseded terminal attempt regress the paid order authority", async () => {
    const {
      payload,
      run,
      order,
      billingAgreements,
      paymentAttempts,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_oldattempt",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    const oldAttempt = paymentAttempts[0]!
    Object.assign(oldAttempt, {
      state: "pending_provider",
      providerStatus: "open",
    })
    paymentAttempts.push(paymentAttemptFixture({
      ...oldAttempt,
      id: 902,
      idempotencyKey: "mollie:first-payment:order:600:authority-v3:attempt-2",
      attemptNumber: 2,
      state: "paid",
      providerPaymentId: "tr_newattempt",
      providerStatus: "paid",
      paidAt: "2026-07-27T10:00:00.000Z",
    }))
    Object.assign(order, {
      state: "fulfilled",
      paymentStatus: "paid",
      providerPaymentId: "tr_newattempt",
      paidAt: "2026-07-27T10:00:00.000Z",
    })
    Object.assign(run, {
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_newattempt",
        providerStatus: "paid",
      },
    })
    Object.assign(billingAgreements[0]!, {
      state: "active",
      currentPeriodStartsAt: "2026-07-27T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-27T10:00:00.000Z",
    })

    const result = await synchronizeMolliePayment(
      payload,
      "tr_oldattempt",
      async () => ({
        id: "tr_oldattempt",
        status: "failed",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        metadata: { paymentAttemptId: oldAttempt.id, orderId: 600 },
      }),
    )

    expect(result).toMatchObject({ state: "failed", fulfillmentRequired: false })
    expect(order).toMatchObject({
      state: "fulfilled",
      paymentStatus: "paid",
      providerPaymentId: "tr_newattempt",
    })
    expect(run.payment).toMatchObject({
      status: "completed",
      externalReference: "tr_newattempt",
    })
    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      currentPeriodEndsAt: "2026-08-27T10:00:00.000Z",
    })
  })

  it.each([
    {
      billingPeriod: "monthly",
      paidAt: "2026-01-31T12:00:00.000Z",
      periodEndsAt: "2026-02-28T12:00:00.000Z",
    },
    {
      billingPeriod: "annual",
      paidAt: "2028-02-29T12:00:00.000Z",
      periodEndsAt: "2029-02-28T12:00:00.000Z",
    },
  ])("anchors $billingPeriod activation coverage to the paid first payment", async ({
    billingPeriod,
    paidAt,
    periodEndsAt,
  }) => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
    } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: `tr_first${billingPeriod}`,
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, { billingPeriod })
    Object.assign(billingAgreements[0]!, { billingPeriod })

    await synchronizeMolliePayment(
      payload,
      `tr_first${billingPeriod}`,
      async () => ({
        id: `tr_first${billingPeriod}`,
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt,
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      currentPeriodStartsAt: paidAt,
      currentPeriodEndsAt: periodEndsAt,
      nextChargeAt: periodEndsAt,
    })
  })

  it("keeps a paid in-flight renewal through a previously scheduled cancellation", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_recurringcancelrace",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "open",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerStatus: "open",
    })
    Object.assign(billingAgreements[0]!, {
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-08-01T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_recurringcancelrace",
      async () => ({
        id: "tr_recurringcancelrace",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "recurring",
        paidAt: "2026-08-01T10:00:01.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-09-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
  })

  it("merges a cancellation committed after a paid webhook loaded the agreement", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
    } = await createPayloadStub({
      cancelBeforeBillingSyncClaim: true,
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_paidwebhookcancelrace",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "open",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerStatus: "open",
    })
    Object.assign(billingAgreements[0]!, {
      state: "active",
      renewalIntent: true,
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_paidwebhookcancelrace",
      async () => ({
        id: "tr_paidwebhookcancelrace",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "recurring",
        paidAt: "2026-08-01T10:00:01.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-09-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
  })

  it.each(["failed", "expired"] as const)(
    "does not extend scheduled cancellation coverage for an in-flight %s payment",
    async (providerStatus) => {
      const {
        payload,
        paymentAttempts,
        billingAgreements,
        order,
      } = await createPayloadStub({
        payment: {
          status: "completed",
          provider: "mollie",
          externalReference: `tr_cancel${providerStatus}`,
          providerStatus: "open",
          mollieCustomerId: "cst_test123",
        },
      })
      Object.assign(order, {
        state: "accepted",
        paymentStatus: "open",
        orderKind: "subscription_renewal",
        servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
        servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      })
      Object.assign(paymentAttempts[0]!, {
        purpose: "recurring",
        sequenceType: "recurring",
        state: "pending_provider",
        providerStatus: "open",
      })
      Object.assign(billingAgreements[0]!, {
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt: "2026-09-01T10:00:00.000Z",
        currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
        currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
      })

      await synchronizeMolliePayment(
        payload,
        `tr_cancel${providerStatus}`,
        async () => ({
          id: `tr_cancel${providerStatus}`,
          status: providerStatus,
          amount: { currency: "EUR", value: "499.00" },
          customerId: "cst_test123",
          mandateId: "mdt_test123",
          sequenceType: "recurring",
          metadata: {
            paymentAttemptId: paymentAttempts[0]?.id,
            orderId: 600,
          },
          _embedded: { refunds: [], chargebacks: [] },
        }),
      )

      expect(billingAgreements[0]).toMatchObject({
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt: "2026-08-01T10:00:00.000Z",
        reconciliationRequired: false,
      })
    },
  )

  it("removes newly advanced coverage when that recurring payment is charged back", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_cancelchargeback",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "open",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerStatus: "open",
    })
    Object.assign(billingAgreements[0]!, {
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-08-01T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_cancelchargeback",
      async () => ({
        id: "tr_cancelchargeback",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "recurring",
        paidAt: "2026-08-01T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )
    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-09-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
      reconciliationRequired: false,
    })

    await synchronizeMolliePayment(
      payload,
      "tr_cancelchargeback",
      async () => ({
        id: "tr_cancelchargeback",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        amountRefunded: { currency: "EUR", value: "0.00" },
        amountChargedBack: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "recurring",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: {
          refunds: [],
          chargebacks: [{
            id: "chb_cancelled_subscription",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-08-03T10:00:00.000Z",
          }],
        },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-08-01T10:00:00.000Z",
      serviceSuspensionStatus: "billing_suspended",
      reconciliationRequired: false,
    })
  })

  it("restores only the tenant suspension owned by the paid billing agreement", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
      tenant,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_recurringrestore",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "open",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerStatus: "open",
    })
    Object.assign(billingAgreements[0]!, {
      state: "suspended",
      serviceSuspensionStatus: "billing_suspended",
      suspendedAt: "2026-08-15T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })
    Object.assign(tenant, {
      status: "suspended",
      billingSuspensionAgreement: billingAgreements[0]!.id,
      billingSuspendedAt: "2026-08-15T10:00:00.000Z",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_recurringrestore",
      async () => ({
        id: "tr_recurringrestore",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "recurring",
        paidAt: "2026-08-16T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      serviceSuspensionStatus: "none",
      currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
      nextChargeAt: "2026-09-01T10:00:00.000Z",
      graceStartedAt: null,
      graceEndsAt: null,
    })
    expect(tenant).toMatchObject({
      status: "active",
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    })
    expect(order).toMatchObject({ state: "fulfilled", paymentStatus: "paid" })
  })

  it("marks a provider amount mismatch for reconciliation without satisfying the order", async () => {
    const { payload, paymentAttempts, order } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_amountmismatch",
        providerStatus: "open",
      },
    })

    await expect(synchronizeMolliePayment(
      payload,
      "tr_amountmismatch",
      async () => ({
        id: "tr_amountmismatch",
        status: "paid",
        amount: { currency: "EUR", value: "498.00" },
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_amount_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it("marks a provider currency mismatch for reconciliation without satisfying the order", async () => {
    const { payload, paymentAttempts, order, queue } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_currencymismatch",
        providerStatus: "open",
      },
    })

    await expect(synchronizeMolliePayment(
      payload,
      "tr_currencymismatch",
      async () => ({
        id: "tr_currencymismatch",
        status: "paid",
        amount: { currency: "USD", value: "499.00" },
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_amount_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
    expect(queue).not.toHaveBeenCalled()
  })

  it("requires provider amount evidence before satisfying the order", async () => {
    const { payload, paymentAttempts, order } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_amountmissing",
        providerStatus: "open",
      },
    })

    await expect(synchronizeMolliePayment(
      payload,
      "tr_amountmissing",
      async () => ({
        id: "tr_amountmissing",
        status: "paid",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_amount_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it.each([
    {
      label: "order",
      payment: {
        customerId: "cst_test123",
        sequenceType: "first" as const,
        metadata: { orderId: 601 },
      },
    },
    {
      label: "customer",
      payment: {
        customerId: "cst_other",
        sequenceType: "first" as const,
        metadata: { orderId: 600 },
      },
    },
    {
      label: "sequence",
      payment: {
        customerId: "cst_test123",
        sequenceType: "recurring" as const,
        metadata: { orderId: 600 },
      },
    },
  ])("blocks a mismatched Mollie $label authority before state advancement", async ({ payment }) => {
    const { payload, paymentAttempts, order } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_authoritymismatch",
        providerStatus: "open",
      },
    })

    await expect(synchronizeMolliePayment(
      payload,
      "tr_authoritymismatch",
      async () => ({
        id: "tr_authoritymismatch",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        ...payment,
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          ...payment.metadata,
        },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_authority_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it.each([
    "purpose",
    "customer",
    "sequence",
    "paymentAttemptId",
    "idempotencyKey",
    "billingAgreementId",
  ] as const)(
    "requires %s authority on newly created Mollie payments",
    async (missing) => {
      const { payload, paymentAttempts, billingAgreements, order } = await createPayloadStub({
        payment: {
          status: "pending_provider",
          provider: "mollie",
          externalReference: `tr_missing${missing}`,
          providerStatus: "open",
        },
      })
      const attempt = paymentAttempts[0]!
      const agreement = billingAgreements[0]!
      Object.assign(attempt, {
        idempotencyKey: "mollie:first-payment:order:600:authority-v3:attempt-1",
      })
      const payment: MolliePayment = {
        id: `tr_missing${missing}`,
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: String(agreement.providerCustomerId),
        sequenceType: "first",
        metadata: {
          paymentAttemptId: attempt.id,
          billingAgreementId: agreement.id,
          orderId: 600,
          idempotencyKey: attempt.idempotencyKey,
          purpose: "first_payment",
        },
      }
      if (missing === "purpose") {
        delete (payment.metadata as Record<string, unknown>).purpose
      } else if (missing === "customer") {
        delete payment.customerId
      } else if (missing === "sequence") {
        delete payment.sequenceType
      } else {
        delete (payment.metadata as Record<string, unknown>)[missing]
      }

      await expect(synchronizeMolliePayment(
        payload,
        String(payment.id),
        async () => payment,
      )).rejects.toThrow("does not match")

      expect(attempt).toMatchObject({
        state: "pending_provider",
        reconciliationRequired: true,
        failureCode: "provider_authority_mismatch",
      })
      expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
    },
  )

  it("requires the recurring payment mandate to match its billing agreement", async () => {
    const { payload, paymentAttempts, billingAgreements } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_mandatemismatch",
        providerStatus: "open",
      },
    })
    const attempt = paymentAttempts[0]!
    const agreement = billingAgreements[0]!
    Object.assign(attempt, {
      idempotencyKey: "mollie:recurring:order:600:authority-v2:attempt-1",
      purpose: "recurring",
      sequenceType: "recurring",
    })
    Object.assign(agreement, { providerMandateId: "mdt_expected" })

    await expect(synchronizeMolliePayment(
      payload,
      "tr_mandatemismatch",
      async () => ({
        id: "tr_mandatemismatch",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: agreement.providerCustomerId as string,
        mandateId: "mdt_other",
        sequenceType: "recurring",
        metadata: {
          paymentAttemptId: attempt.id,
          billingAgreementId: agreement.id,
          orderId: 600,
          idempotencyKey: attempt.idempotencyKey,
          purpose: "recurring",
          mandateId: "mdt_expected",
        },
      }),
    )).rejects.toThrow("mandate does not match")

    expect(attempt).toMatchObject({
      reconciliationRequired: true,
      failureCode: "provider_authority_mismatch",
    })
  })

  it("does not repeat a refund provider write after a definitive rejection", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
      billingAgreements,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundrejected",
        providerStatus: "paid",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ status: 422, title: "Fixture provider rejection", detail: "Refund is not permitted." }), { status: 422 }),
    ))

    const input = {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit" as const,
    }
    await expect(requestMollieRefund(payload, input)).rejects.toThrow("422")
    await expect(requestMollieRefund(payload, input)).rejects.toThrow(
      "new provider write is not allowed",
    )

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: false,
    })
    expect(accountingDocuments.find((document) =>
      document.documentType === "credit_note",
    )).toMatchObject({
      state: "failed",
      reconciliationRequired: false,
    })
  })

  it("does not claim the billing agreement when refund provider writes are disabled", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundreleaseblocked",
        providerStatus: "paid",
      },
    })
    const providerWrite = vi.fn()
    vi.stubGlobal("fetch", providerWrite)

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })).rejects.toThrow("staged commerce release gate")

    expect(providerWrite).not.toHaveBeenCalled()
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: false,
    })
  })

  it("releases the refund claim when local attempt transition fails before provider write", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      update,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundlocaltransitionfailure",
        providerStatus: "paid",
      },
    })
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected Payload update implementation.")
    let failAttemptTransition = true
    update.mockImplementation(async (args) => {
      if (
        failAttemptTransition &&
        args.collection === "payment-attempts" &&
        recordValue(args.data).state === "refund_pending"
      ) {
        failAttemptTransition = false
        throw new Error("simulated local attempt transition failure")
      }
      return originalUpdate(args)
    })
    const providerWrite = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "re_afterlocalretry",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    )
    vi.stubGlobal("fetch", providerWrite)
    const input = {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit" as const,
    }

    await expect(requestMollieRefund(payload, input))
      .rejects.toThrow("simulated local attempt transition failure")
    expect(providerWrite).not.toHaveBeenCalled()
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: false,
      failureReason: null,
    })

    await expect(requestMollieRefund(payload, input)).resolves.toMatchObject({
      providerRefundId: "re_afterlocalretry",
      reused: false,
    })
    expect(providerWrite).toHaveBeenCalledTimes(1)
  })

  it("blocks a second automatic refund scenario while one refund is unresolved", async () => {
    enableSandboxCommerceRelease()
    const { payload, paymentAttempts, accountingDocuments } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundsingleflight",
        providerStatus: "paid",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        id: "re_singleflight",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 }),
    ))

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })).resolves.toMatchObject({ providerRefundId: "re_singleflight" })
    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "duplicate_payment",
    })).rejects.toThrow("Another refund is awaiting provider resolution")

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(accountingDocuments.filter((document) =>
      document.documentType === "credit_note",
    )).toHaveLength(1)
  })

  it("keeps refund HTTP 503 indeterminate until authoritative reconciliation", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      accountingDocuments,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refund503",
        providerStatus: "paid",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ status: 503, title: "Fixture provider rejection",
        detail: "Service unavailable after request handling.",
      }), { status: 503 })
    ))

    const input = {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit" as const,
    }
    await expect(requestMollieRefund(payload, input)).rejects.toThrow("503")
    await expect(requestMollieRefund(payload, input)).rejects.toThrow(
      "requires reconciliation",
    )

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(paymentAttempts[0]).toMatchObject({
      state: "refund_pending",
      reconciliationRequired: true,
      failureCode: "refund_write_indeterminate",
    })
    const pendingDocument = accountingDocuments.find((document) =>
      document.documentType === "credit_note"
    )
    expect(pendingDocument).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
    })
    expect(pendingDocument).not.toHaveProperty("providerOperationId")
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: true,
      failureReason:
        "A full Mollie refund is being requested; recurring collection is paused.",
    })
  })

  it.each([
    {
      label: "network timeout",
      response: () => Promise.reject(new TypeError("connection closed")),
    },
    {
      label: "HTTP 409",
      response: () => Promise.resolve(
        new Response(JSON.stringify({ status: 409, title: "Fixture provider rejection", detail: "Conflict." }), { status: 409 }),
      ),
    },
  ])("blocks a second refund write after an indeterminate $label", async ({ response }) => {
    enableSandboxCommerceRelease()
    const { payload, paymentAttempts, billingAgreements } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundindeterminatewrite",
        providerStatus: "paid",
      },
    })
    vi.stubGlobal("fetch", vi.fn(response))
    const input = {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit" as const,
    }

    await expect(requestMollieRefund(payload, input)).rejects.toThrow()
    await expect(requestMollieRefund(payload, input)).rejects.toThrow(
      "requires reconciliation",
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: true,
    })
  })

  it("preserves one refund operation when dispatch races authoritative synchronization", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      accountingDocuments,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundsyncrace",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    let refundWriteStarted!: () => void
    let releaseRefund!: () => void
    const refundWriteStartedPromise = new Promise<void>((resolve) => {
      refundWriteStarted = resolve
    })
    const releaseRefundPromise = new Promise<void>((resolve) => {
      releaseRefund = resolve
    })
    const providerWrite = vi.fn(async (url: string) => {
      expect(url).toBe(
        "https://api.mollie.com/v2/payments/tr_refundsyncrace/refunds",
      )
      refundWriteStarted()
      await releaseRefundPromise
      return new Response(JSON.stringify({
        id: "re_refundsyncrace",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    })
    vi.stubGlobal("fetch", providerWrite)

    const refund = requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })
    await refundWriteStartedPromise
    const synchronized = await synchronizeMolliePayment(
      payload,
      "tr_refundsyncrace",
      async () => ({
        id: "tr_refundsyncrace",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )
    expect(synchronized).toMatchObject({
      state: "refund_pending",
      fulfillmentRequired: false,
    })
    expect(billingAgreements[0]).toMatchObject({
      reconciliationRequired: true,
    })

    releaseRefund()
    await expect(refund).resolves.toMatchObject({
      providerRefundId: "re_refundsyncrace",
      reused: false,
    })

    expect(providerWrite).toHaveBeenCalledTimes(1)
    expect(paymentAttempts[0]).toMatchObject({
      state: "refund_pending",
      providerRefundIds: ["re_refundsyncrace"],
      reconciliationRequired: false,
    })
    expect(accountingDocuments.find((document) =>
      document.documentType === "credit_note"
    )).toMatchObject({
      state: "pending_provider",
      providerOperationId: "re_refundsyncrace",
      reconciliationRequired: false,
    })
  })

  it("lets a full-refund pause win a concurrent recurring collection claim", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundcollectionrace",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "pending",
    })
    let releaseRefund!: () => void
    let refundWriteStarted!: () => void
    const refundWriteStartedPromise = new Promise<void>((resolve) => {
      refundWriteStarted = resolve
    })
    const refundReleasePromise = new Promise<void>((resolve) => {
      releaseRefund = resolve
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe(
        "https://api.mollie.com/v2/payments/tr_refundcollectionrace/refunds",
      )
      refundWriteStarted()
      await refundReleasePromise
      return new Response(JSON.stringify({
        id: "re_collectionrace",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    }))

    const refund = requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })
    await refundWriteStartedPromise
    await expect(createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: String(order.id),
    })).rejects.toThrow("active customer mandate")
    releaseRefund()
    await expect(refund).resolves.toMatchObject({
      providerRefundId: "re_collectionrace",
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(billingAgreements[0]).toMatchObject({
      renewalIntent: true,
      reconciliationRequired: true,
    })
  })

  it("does not automate refund scenarios that the decision matrix assigns to review", async () => {
    const { payload, paymentAttempts, accountingDocuments } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_manualreview",
        providerStatus: "paid",
      },
    })

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "customer_cancellation_after_provider_commit",
    })).rejects.toThrow("manual review")
    expect(accountingDocuments).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("coalesces pending synchronization jobs by Mollie payment id", () => {
    expect(syncMolliePaymentTask.concurrency).toMatchObject({
      exclusive: true,
      supersedes: true,
    })
    const concurrency = syncMolliePaymentTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency.key({
      input: { paymentId: "tr_test123" },
      queue: "default",
    })).toBe("mollie-payment:tr_test123")
  })

  it("queues one fulfillment and one invoice when duplicate sync workers are scheduled together", async () => {
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
      queue,
    } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_serializedworkers",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        id: "tr_serializedworkers",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        paidAt: "2026-07-28T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }), { status: 200 }),
    ))
    const handler = createTaskRunner(syncMolliePaymentTask)
    let exclusiveLane: Promise<unknown> = Promise.resolve()
    const runWorker = () => {
      const result = exclusiveLane.then(() =>
        handler({
          input: { paymentId: "tr_serializedworkers" },
          req: { payload },
        }),
      )
      exclusiveLane = result.then(() => undefined, () => undefined)
      return result
    }

    const results = await Promise.all([runWorker(), runWorker()])

    expect(results.map((result) => result.output.fulfillmentQueued)).toEqual([true, false])
    const queuedJobs = queue.mock.calls
    const fulfillmentQueues = queuedJobs.filter(
      ([entry]) => entry.task === "fulfill-order",
    )
    expect(fulfillmentQueues).toHaveLength(1)
    expect(fulfillmentQueues[0]?.[0]).toEqual(expect.objectContaining({
      task: "fulfill-order",
      input: expect.objectContaining({ orderId: "600" }),
    }))
    expect(queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "deliver-commerce-notification",
    }))
    expect(accountingDocuments.filter((document) =>
      document.documentType === "invoice",
    )).toHaveLength(1)
  })

  it("does not claim fulfillment when the first authoritative sync is already refunded", async () => {
    const {
      payload,
      order,
      paymentAttempts,
      queue,
    } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_refundedbeforesync",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })

    const result = await synchronizeMolliePayment(
      payload,
      "tr_refundedbeforesync",
      async () => ({
        id: "tr_refundedbeforesync",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        paidAt: "2026-07-28T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: {
          refunds: [{
            id: "re_beforefirstsync",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-28T10:01:00.000Z",
          }],
          chargebacks: [],
        },
      }),
    )

    expect(result).toMatchObject({
      state: "refunded",
      fulfillmentRequired: false,
    })
    expect(order).toMatchObject({
      state: "accepted",
      paymentStatus: "refunded",
    })
    expect(queue).not.toHaveBeenCalledWith(expect.objectContaining({
      task: "deliver-commerce-notification",
    }))
  })

  it.each([
    {
      expectedState: "refund_pending",
      refunds: [{
        id: "re_adjustedbeforefulfillment",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
        createdAt: "2026-07-28T10:01:00.000Z",
      }],
      chargebacks: [],
    },
    {
      expectedState: "refunded",
      refunds: [{
        id: "re_adjustedbeforefulfillment",
        status: "refunded",
        amount: { currency: "EUR", value: "499.00" },
        createdAt: "2026-07-28T10:01:00.000Z",
      }],
      chargebacks: [],
    },
    {
      expectedState: "chargeback",
      refunds: [],
      chargebacks: [{
        id: "chb_adjusted_before_fulfillment",
        amount: { currency: "EUR", value: "499.00" },
        createdAt: "2026-07-28T10:01:00.000Z",
      }],
    },
  ])(
    "terminalizes paid fulfillment before provider commitment on $expectedState",
    async ({ expectedState, refunds, chargebacks }) => {
      const {
        payload,
        order,
        paymentAttempts,
      } = await createPayloadStub({
        payment: {
          status: "pending_provider",
          provider: "mollie",
          externalReference: "tr_adjustedbeforefulfillment",
          providerStatus: "open",
          mollieCustomerId: "cst_test123",
        },
      })
      const providerPayment = (adjustments: {
        refunds: typeof refunds
        chargebacks: typeof chargebacks
      }) => ({
        id: "tr_adjustedbeforefulfillment",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        paidAt: "2026-07-28T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: adjustments,
      })

      const paid = await synchronizeMolliePayment(
        payload,
        "tr_adjustedbeforefulfillment",
        async () => providerPayment({ refunds: [], chargebacks: [] }),
      )
      expect(paid.fulfillmentRequired).toBe(true)
      expect(order.state).toBe("fulfillment_pending")

      const adjusted = await synchronizeMolliePayment(
        payload,
        "tr_adjustedbeforefulfillment",
        async () => providerPayment({ refunds, chargebacks }),
      )
      expect(adjusted).toMatchObject({
        state: expectedState,
        fulfillmentRequired: false,
      })
      expect(order.state).toBe("exception")
    },
  )

  it("rejects a direct registrar workflow after payment adjustment before provider commitment", async () => {
    const {
      payload,
      run,
      order,
      paymentAttempts,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_adjustedbeforecommit",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "refunded",
    })
    Object.assign(paymentAttempts[0]!, { state: "refunded" })
    const loginOpenProvider = vi.fn(async () => "should-not-run")

    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: String(paymentAttempts[0]!.id),
      selectedDomain: "clientsite.nl",
      dependencies: { loginOpenProvider },
    })).rejects.toThrow("no provider write was attempted")
    expect(loginOpenProvider).not.toHaveBeenCalled()
  })

  it("loses the registrar commitment race when payment is adjusted first", async () => {
    const {
      payload,
      run,
      order,
      paymentAttempts,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_racebeforeregistrarcommit",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test123",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
      providerPaymentId: "tr_racebeforeregistrarcommit",
    })
    let releaseTransaction!: () => void
    let signalTransaction!: () => void
    const transactionReleased = new Promise<void>((resolve) => {
      releaseTransaction = resolve
    })
    const transactionReached = new Promise<void>((resolve) => {
      signalTransaction = resolve
    })
    vi.mocked(payload.db.beginTransaction).mockImplementation(async () => {
      signalTransaction()
      await transactionReleased
      return "tx-race"
    })
    const registerOpenProviderDomain = vi.fn()
    const provision = provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: String(paymentAttempts[0]!.id),
      selectedDomain: "clientsite.nl",
      dependencies: {
        now: () => "2026-07-28T10:00:00.000Z",
        loginOpenProvider: vi.fn(async () => "op-token"),
        findOpenProviderDomain: vi.fn(async () => null),
        checkOpenProviderDomainAvailability: vi.fn(async () => ({
          status: "available" as const,
          domain: "clientsite.nl",
          available: true,
          premium: false,
          price: null,
          internalReason: null,
        })),
        findOpenProviderCustomerByReference: vi.fn(async () => ({
          handle: "OWNER-CLIENT",
          comments: "domain-registration:order:600:v1",
          raw: {},
        })),
        createOpenProviderCustomerHandle: vi.fn(),
        listCloudflareZones: vi.fn(async () => [{
          id: "zone_race",
          name: "clientsite.nl",
          status: "active" as const,
          nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          raw: {},
        }]),
        createOrReuseCloudflareZone: vi.fn(),
        registerOpenProviderDomain,
      },
    })
    await transactionReached
    const adjusted = await synchronizeMolliePayment(
      payload,
      "tr_racebeforeregistrarcommit",
      async () => ({
        id: "tr_racebeforeregistrarcommit",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        sequenceType: "first",
        paidAt: "2026-07-28T09:59:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: {
          refunds: [{
            id: "re_racebeforeregistrarcommit",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-28T10:00:01.000Z",
          }],
          chargebacks: [],
        },
      }),
    )
    expect(adjusted.state).toBe("refunded")
    releaseTransaction()

    await expect(provision).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no registration was sent"),
    })
    expect(registerOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("preserves committed registrar custody after a chargeback without activating the site", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    const {
      payload,
      order,
      paymentAttempts,
      managedDomains,
      snapshots,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_chargebackaftercommit",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "chargeback",
    })
    Object.assign(paymentAttempts[0]!, { state: "chargeback" })
    managedDomains.push(managedDomainFixture({
      id: 1_300,
      domainNameAscii: "clientsite.nl",
      tld: "nl",
      provisioningIdempotencyKey: "domain-registration:order:600:v1",
      originatingOrder: 600,
      registrantProfile: 800,
      tenant: 1,
      state: "active",
      custodyStatus: "managed",
      initialOperation: "registration",
      registrantOwnership: "customer",
      provider: "openprovider",
      providerDomainId: "9001",
      providerCustomerHandle: "OWNER-CLIENT",
      providerRegistrationState: "confirmed",
      registrationRequestedAt: "2026-07-28T10:00:00.000Z",
      registrantVerificationStatus: "not_required",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      adminHttpsStatus: "verified",
      entitlementStatus: "active",
      customerStatus: "active",
      renewalIntent: true,
      providerAutorenew: "off",
      transferOutCodeDeliveryStatus: "not_requested",
      transferOutProviderMissingCount: 0,
      reconciliationRequired: false,
      createdAt: "2026-07-28T10:00:00.000Z",
      updatedAt: "2026-07-28T10:00:00.000Z",
    }))

    await expect(fulfillPaidOrder(payload, {
      orderId: order.id,
      paymentAttemptId: String(paymentAttempts[0]!.id),
    })).resolves.toMatchObject({ status: "custody_preserved" })
    expect(order.state).toBe("exception")
    expect(managedDomains[0]).toMatchObject({
      state: "active",
      entitlementStatus: "blocked",
      customerStatus: "manual_review",
      failureReason: "initial_payment_chargeback",
    })
    expect(snapshots).toHaveLength(0)
  })

  it("does not revoke fulfilled service solely because a refund attempt failed", async () => {
    const {
      payload,
      order,
      paymentAttempts,
      update,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedrefundafterfulfillment",
      },
    })
    Object.assign(order, {
      state: "fulfilled",
      paymentStatus: "paid",
    })
    Object.assign(paymentAttempts[0]!, { state: "refund_failed" })

    await expect(fulfillPaidOrder(payload, {
      orderId: order.id,
      paymentAttemptId: String(paymentAttempts[0]!.id),
    })).resolves.toMatchObject({ status: "fulfilled" })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "managed-domains",
    }))
  })

  it("finalizes an already-active domain when a failed refund races before order completion", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    const {
      payload,
      tenant,
      order,
      paymentAttempts,
      managedDomains,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedrefundduringfinalization",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
      providerPaymentId: "tr_failedrefundduringfinalization",
    })
    Object.assign(paymentAttempts[0]!, { state: "refund_failed" })
    Object.assign(tenant, {
      domain: "clientsite.nl",
      domainVerification: { status: "verified" },
      emailSending: {
        provider: "cloudflare",
        mode: "subdomain",
        status: "verified",
        sendingDomain: "mail.clientsite.nl",
        senderEmail: "noreply@mail.clientsite.nl",
      },
    })
    managedDomains.push(managedDomainFixture({
      id: 1_300,
      domainNameAscii: "clientsite.nl",
      tld: "nl",
      provisioningIdempotencyKey: "domain-registration:order:600:v1",
      originatingOrder: 600,
      registrantProfile: 800,
      tenant: 1,
      state: "active",
      custodyStatus: "managed",
      initialOperation: "registration",
      registrantOwnership: "customer",
      provider: "openprovider",
      providerDomainId: "9001",
      providerCustomerHandle: "OWNER-CLIENT",
      providerRegistrationState: "confirmed",
      registrationRequestedAt: "2026-07-28T10:00:00.000Z",
      registrantVerificationStatus: "not_required",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      adminHttpsStatus: "verified",
      entitlementStatus: "active",
      customerStatus: "active",
      renewalIntent: true,
      providerAutorenew: "off",
      transferOutCodeDeliveryStatus: "not_requested",
      transferOutProviderMissingCount: 0,
      reconciliationRequired: false,
      createdAt: "2026-07-28T10:00:00.000Z",
      updatedAt: "2026-07-28T10:00:00.000Z",
    }))

    await expect(fulfillPaidOrder(payload, {
      orderId: order.id,
      paymentAttemptId: String(paymentAttempts[0]!.id),
    })).resolves.toMatchObject({ status: "fulfilled" })
    expect(order.state).toBe("fulfilled")
    expect(managedDomains[0]).toMatchObject({
      state: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
  })

  it("keeps an exception-stopped failed refund outside the registrar boundary", async () => {
    const {
      payload,
      run,
      order,
      paymentAttempts,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_failedrefundexception",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "exception",
      paymentStatus: "paid",
      providerPaymentId: "tr_failedrefundexception",
    })
    Object.assign(paymentAttempts[0]!, { state: "refund_failed" })
    const registerOpenProviderDomain = vi.fn()

    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: String(paymentAttempts[0]!.id),
      selectedDomain: "clientsite.nl",
      dependencies: { registerOpenProviderDomain },
    })).rejects.toThrow("no provider write was attempted")
    expect(registerOpenProviderDomain).not.toHaveBeenCalled()
  })

  it("refunds one superseded captured payment without a second sale invoice", async () => {
    enableSandboxCommerceRelease()
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      accountingDocuments,
      order,
      queue,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_duplicatecapture",
        providerStatus: "open",
        mollieCustomerId: "cst_test123",
      },
    })
    const duplicateAttempt = paymentAttempts[0]!
    Object.assign(duplicateAttempt, {
      idempotencyKey:
        "mollie:first-payment:order:600:authority-v3:attempt-1",
      state: "pending_provider",
      providerPaymentId: "tr_duplicatecapture",
      providerStatus: "open",
    })
    paymentAttempts.push(paymentAttemptFixture({
      ...duplicateAttempt,
      id: 902,
      attemptNumber: 2,
      idempotencyKey:
        "mollie:first-payment:order:600:authority-v3:attempt-2",
      state: "paid",
      providerPaymentId: "tr_authoritativecapture",
      providerStatus: "paid",
      paidAt: "2026-07-28T09:55:00.000Z",
    }))
    Object.assign(order, {
      state: "fulfilled",
      paymentStatus: "paid",
      providerPaymentId: "tr_authoritativecapture",
      paidAt: "2026-07-28T09:55:00.000Z",
    })
    const providerPayment: MolliePayment = {
      id: "tr_duplicatecapture",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_test123",
      mandateId: "mdt_test123",
      sequenceType: "first",
      paidAt: "2026-07-28T10:00:00.000Z",
      metadata: {
        paymentAttemptId: duplicateAttempt.id,
        billingAgreementId: billingAgreements[0]?.id,
        orderId: order.id,
        idempotencyKey: duplicateAttempt.idempotencyKey,
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
        purpose: "first_payment",
      },
      _embedded: { refunds: [], chargebacks: [] },
    }

    queue.mockRejectedValueOnce(new Error("temporary queue outage"))
    await expect(synchronizeMolliePayment(
      payload,
      providerPayment.id,
      async () => providerPayment,
    )).rejects.toThrow("temporary queue outage")

    const first = await synchronizeMolliePayment(
      payload,
      providerPayment.id,
      async () => providerPayment,
    )
    const repeated = await synchronizeMolliePayment(
      payload,
      providerPayment.id,
      async () => providerPayment,
    )

    expect(first).toMatchObject({
      fulfillmentRequired: false,
      state: "paid",
    })
    expect(repeated).toMatchObject({
      duplicate: true,
      fulfillmentRequired: false,
    })
    expect(order).toMatchObject({
      state: "fulfilled",
      providerPaymentId: "tr_authoritativecapture",
    })
    expect(accountingDocuments.filter((document) =>
      document.documentType === "invoice"
    )).toEqual([
      expect.objectContaining({ paymentAttempt: 902 }),
    ])
    expect(accountingDocuments.filter((document) =>
      document.refundScenario === "duplicate_payment"
    )).toEqual([
      expect.objectContaining({
        documentType: "payment_adjustment",
        reason: "overpayment_refund",
        paymentAttempt: duplicateAttempt.id,
        state: "pending_provider",
        netAmountMinor: 0,
        vatAmountMinor: 0,
        grossAmountMinor: duplicateAttempt.grossAmountMinor,
        providerStatus: "refund_job_queued",
      }),
    ])
    expect(queue).toHaveBeenCalledTimes(2)
    expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: String(duplicateAttempt.id),
        scenario: "duplicate_payment",
      },
    }))

    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        id: "re_duplicatecapture",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    ))
    const refundInput = {
      paymentAttemptId: String(duplicateAttempt.id),
      scenario: "duplicate_payment" as const,
    }
    await expect(requestMollieRefund(payload, refundInput)).resolves.toMatchObject({
      providerRefundId: "re_duplicatecapture",
      reused: false,
    })
    await expect(requestMollieRefund(payload, refundInput)).resolves.toMatchObject({
      providerRefundId: "re_duplicatecapture",
      reused: true,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(accountingDocuments.filter((document) =>
      document.documentType === "invoice"
    )).toHaveLength(1)
    expect(accountingDocuments.filter((document) =>
      document.documentType === "credit_note"
    )).toHaveLength(0)
    expect(accountingDocuments.filter((document) =>
      document.documentType === "payment_adjustment"
    )).toEqual([
      expect.objectContaining({
        reason: "overpayment_refund",
        netAmountMinor: 0,
        vatAmountMinor: 0,
        grossAmountMinor: duplicateAttempt.grossAmountMinor,
        providerOperationId: "re_duplicatecapture",
      }),
    ])
    const saleInvoiceGross = accountingDocuments
      .filter((document) => document.documentType === "invoice")
      .reduce((total, document) => total + Number(document.grossAmountMinor), 0)
    const vatCreditGross = accountingDocuments
      .filter((document) => document.documentType === "credit_note")
      .reduce((total, document) => total + Number(document.grossAmountMinor), 0)
    expect(saleInvoiceGross - vatCreditGross).toBe(order.totalGrossMinor)
    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      renewalIntent: true,
      reconciliationRequired: false,
    })
  })

  it("does not cancel newer paid coverage when an older payment is fully refunded", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_historicalcoverage",
        providerStatus: "paid",
        mollieCustomerId: "cst_test123",
      },
    })
    const attempt = paymentAttempts[0]!
    Object.assign(attempt, {
      paidAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-06-01T09:55:00.000Z",
    })
    Object.assign(billingAgreements[0]!, {
      state: "active",
      renewalIntent: true,
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
      nextChargeAt: "2026-08-01T10:00:00.000Z",
    })

    await synchronizeMolliePayment(
      payload,
      "tr_historicalcoverage",
      async () => ({
        id: "tr_historicalcoverage",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test123",
        mandateId: "mdt_test123",
        sequenceType: "first",
        paidAt: "2026-06-01T10:00:00.000Z",
        metadata: {
          paymentAttemptId: attempt.id,
          billingAgreementId: billingAgreements[0]?.id,
          orderId: 600,
          idempotencyKey: attempt.idempotencyKey,
          purpose: "first_payment",
        },
        _embedded: {
          refunds: [{
            id: "re_historicalcoverage",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-28T10:00:00.000Z",
          }],
          chargebacks: [],
        },
      }),
    )

    expect(attempt.state).toBe("refunded")
    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      renewalIntent: true,
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      nextChargeAt: "2026-08-01T10:00:00.000Z",
    })
  })

  it("serializes all refund scenarios for one captured payment", () => {
    const concurrency = requestMollieRefundTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency).toMatchObject({ exclusive: true })
    expect(concurrency.supersedes).not.toBe(true)
    expect(concurrency.key({
      input: {
        paymentAttemptId: "901",
        scenario: "duplicate_payment",
      },
      queue: "default",
    })).toBe("mollie-refund:901")
    expect(concurrency.key({
      input: {
        paymentAttemptId: "901",
        scenario: "unfulfillable_before_provider_commit",
      },
      queue: "default",
    })).toBe("mollie-refund:901")
  })

  it("serializes and coalesces duplicate fulfillment workers for one paid order", () => {
    const concurrency = fulfillOrderTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency).toMatchObject({ exclusive: true, supersedes: true })
    expect(concurrency.key({
      input: { orderId: "600", paymentAttemptId: "901" },
      queue: "default",
    })).toBe("fulfill-order:600")
  })

  it("completes a test-mode paid checkout without creating a subscription or provisioning a domain", async () => {
    const { payload, run, tenant } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      throw new Error(`Unexpected provider fetch ${url}`)
    }))

    const result = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
      },
    }))

    expect(result.state).toBe("paid")
    expect(result.fulfillmentRequired).toBe(true)
    expect(mollieApiKeyMode()).toBe("test")
    expect(mollieDomainProvisioningEnabled()).toBe(false)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain: "clientsite.nl",
      note: "Mollie payment synchronized; fulfillment is queued separately.",
    })
    const fulfillment = await fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })
    expect(fulfillment.status).toBe("waiting")
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "blocked",
        step: "activation_gate",
        message: "Activation requires verified domain ownership.",
      },
    })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "clientsite.nl",
    })
    expect(tenant).toMatchObject({
      domain: "acme.test",
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fails closed for .be fulfillment without frozen capability evidence", async () => {
    const { payload, run, order } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_paidmissingcapability",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.be",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, { quoteEvidence: undefined })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
    })

    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: 901,
      selectedDomain: "clientsite.be",
    })).rejects.toThrow("frozen TLD capability evidence")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("terminally rejects an unsafe historical TLD order without provider writes", async () => {
    const { payload, run, order, update, managedDomains } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_paidunsafetld",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.de",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
    })
    const input = {
      order: order,
      paymentAttemptId: 901,
      selectedDomain: "clientsite.de",
      dependencies: {
        now: () => "2026-07-29T17:30:00.000Z",
      },
    }

    await expect(provisionPaidDomainOrder(payload, run, input))
      .resolves.toMatchObject({ status: "unfulfillable" })
    const lifecycleUpdatesAfterFirst = update.mock.calls.filter(
      ([args]) => args.collection === "managed-domains",
    ).length
    await expect(provisionPaidDomainOrder(payload, run, input))
      .resolves.toMatchObject({
        status: "unfulfillable",
        message: expect.stringContaining("terminal manual review"),
      })

    expect(update.mock.calls.filter(
      ([args]) => args.collection === "managed-domains",
    )).toHaveLength(lifecycleUpdatesAfterFirst)
    expect(managedDomains[0]).toMatchObject({
      state: "manual_review",
      failureReason:
        "current_tld_safety_contract_unmet:preconfigured_authoritative_dns_not_proven",
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    "nl",
    "com",
    "org",
    "net",
    "info",
    "online",
    "shop",
  ] as const)(
    "honors a previously accepted safe .%s order after live payment",
    async (tld) => {
    const selectedDomain = `clientsite.${tld}`
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_ADMIN_HANDLE", "ADMIN-NL")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv(
      "CLOUDFLARE_RENDERER_TUNNEL_ID",
      "11111111-1111-4111-8111-111111111111",
    )
    vi.stubEnv(
      "CLOUDFLARE_CMS_TUNNEL_ID",
      "22222222-2222-4222-8222-222222222222",
    )
    const {
      payload,
      run,
      tenant,
      settings,
      snapshots,
      managedDomains,
      commerceNotifications,
    } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test123",
        selectedDomain,
      },
      domainOrder: {
        status: "ready_to_register",
        domain: selectedDomain,
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    let cloudflareZoneCreated = false
    let openproviderCustomerCreated = false
    let openproviderDomainRegistered = false
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/email/sending/subdomains")) {
        if (url.endsWith("/email/sending/subdomains/subdomain_123")) {
          return new Response(JSON.stringify({
            success: true,
            result: {
              enabled: true,
              name: `mail.${selectedDomain}`,
              tag: "subdomain_123",
              dkim_selector: "cf-bounce",
              return_path_domain: `cf-bounce.mail.${selectedDomain}`,
            },
          }), { status: 200 })
        }
        if (url.endsWith("/email/sending/subdomains")) {
          return new Response(JSON.stringify({
            success: true,
            result: [{
              enabled: true,
              name: `mail.${selectedDomain}`,
              tag: "subdomain_123",
              dkim_selector: "cf-bounce",
              return_path_domain: `cf-bounce.mail.${selectedDomain}`,
            }],
          }), { status: 200 })
        }
        throw new Error(`Unexpected fetch ${url}`)
      }
      if (url.includes("/ssl/verification")) {
        return new Response(JSON.stringify({
          success: true,
          result: [{ certificate_status: "active" }],
        }), { status: 200 })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones?") && !url.includes("dns_records")) {
        return new Response(JSON.stringify({
          success: true,
          result: cloudflareZoneCreated
            ? [{
                id: "zone_123",
                name: selectedDomain,
                status: "active",
                name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
              }]
            : [],
        }), { status: 200 })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones") && !url.includes("dns_records")) {
        cloudflareZoneCreated = true
        return new Response(JSON.stringify({
          success: true,
          result: {
            id: "zone_123",
            name: selectedDomain,
            status: "active",
            name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          },
        }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/auth/login")) {
        return new Response(JSON.stringify({ data: { token: "op-token" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/domains/check")) {
        return new Response(JSON.stringify({
          data: { results: [{ domain: selectedDomain, status: "free" }] },
        }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/customers")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({
            data: {
              results: openproviderCustomerCreated
                ? [{
                    handle: "OWNER-CLIENT",
                    comments: "domain-registration:order:600:v1",
                  }]
                : [],
            },
          }), { status: 200 })
        }
        openproviderCustomerCreated = true
        return new Response(JSON.stringify({ data: { handle: "OWNER-CLIENT" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/domains")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({
            data: {
              results: openproviderDomainRegistered
                ? [{
                    id: 9001,
                    domain: { name: "clientsite", extension: tld },
                    status: "ACT",
                    owner_handle: "OWNER-CLIENT",
                    name_servers: [
                      { name: "ada.ns.cloudflare.com" },
                      { name: "bob.ns.cloudflare.com" },
                    ],
                    autorenew: "off",
                    verification_email_status: "not applicable",
                  }]
                : [],
            },
          }), { status: 200 })
        }
        openproviderDomainRegistered = true
        return new Response(JSON.stringify({ code: 0, data: { id: 9001, status: "ACT" } }), { status: 200 })
      }
      if (url.includes("dns_records")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({
          success: true,
          result: { id: "record_123", name: selectedDomain, content: "renderer.siteinabox.nl", proxied: true },
        }), { status: 200 })
      }
      throw new Error(`Unexpected fetch ${url}`)
    }))

    const result = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain,
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
      },
    }))

    expect(result.state).toBe("paid")
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: selectedDomain,
    })
    const fulfillment = await fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })
    expect(fulfillment.status, JSON.stringify(fulfillment)).toBe("fulfilled")
    expect(mollieApiKeyMode()).toBe("live")
    expect(mollieDomainProvisioningEnabled()).toBe(true)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain,
      mollieCustomerId: "cst_test123",
    })
    expect(run.domainOrder).toMatchObject({
      status: "registered",
      domain: selectedDomain,
      providerReference: "9001",
      cloudflareZoneId: "zone_123",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: null,
      emailSending: {
        provider: "cloudflare",
        mode: "subdomain",
        status: "not_configured",
        sendingDomain: `mail.${selectedDomain}`,
        senderEmail: `noreply@mail.${selectedDomain}`,
        cloudflareZoneId: "zone_123",
      },
    })
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "activated",
        step: "publish_activate",
        message: "Published and activated automatically after completed payment and provisioning.",
        snapshotId: 10,
      },
    })
    expect(tenant).toMatchObject({
      domain: selectedDomain,
      status: "active",
      activeSnapshot: 10,
      domainVerification: expect.objectContaining({ status: "verified" }),
      emailSending: expect.objectContaining({
        provider: "cloudflare",
        mode: "subdomain",
        status: "not_configured",
        sendingDomain: `mail.${selectedDomain}`,
        senderEmail: `noreply@mail.${selectedDomain}`,
        cloudflareZoneId: "zone_123",
      }),
    })
    expect(vi.mocked(fetch).mock.calls.some(([url]) =>
      String(url).includes("/email/sending/subdomains"))).toBe(false)
    expect(settings).toMatchObject({
      siteUrl: `https://${selectedDomain}`,
      aliases: [{ host: `www.${selectedDomain}` }],
    })
    expect(snapshots[0]).toMatchObject({
      id: 10,
      status: "active",
      tenant: 1,
      sourceGenerationRun: 500,
      domain: selectedDomain,
    })
    expect(managedDomains).toContainEqual(expect.objectContaining({
      domainNameAscii: selectedDomain,
      tld,
      state: "active",
      providerDomainId: "9001",
      providerRegistrationState: "confirmed",
      registrantVerificationStatus: "not_required",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      entitlementStatus: "active",
      customerStatus: "active",
    }))
    expect(commerceNotifications).toContainEqual(expect.objectContaining({
      kind: "payment_received",
      recipient: "client@example.com",
      status: "queued",
    }))
    const subscriptionCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/subscriptions"))
    expect(subscriptionCall).toBeUndefined()
    await expect(fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })).resolves.toMatchObject({ status: "fulfilled" })
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith("/v1beta/domains") && init?.method === "POST")).toHaveLength(1)
    const registrationRequest = vi.mocked(fetch).mock.calls.find(([url, init]) =>
      String(url).endsWith("/v1beta/domains") && init?.method === "POST")
    expect(JSON.parse(String(registrationRequest?.[1]?.body))).toMatchObject({
      owner_handle: "OWNER-CLIENT",
      admin_handle: "ADMIN-NL",
      tech_handle: "TECH-NL",
      billing_handle: "BILL-NL",
      autorenew: "off",
    })
    },
  )

  it("waits when authoritative registrant verification status is absent", async () => {
    const {
      payload,
      run,
      order,
      managedDomains,
      commerceNotifications,
      queue,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_paidverificationpending",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test123",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
      providerPaymentId: "tr_paidverificationpending",
    })
    const providerDomain = {
      id: 9001,
      domain: "clientsite.nl",
      status: "ACT",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "ADMIN-NL",
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      renewalDate: "2027-07-29",
      registryExpiryDate: null,
      autorenew: "off" as const,
      verificationEmailStatus: null,
      verificationEmailExpiresAt: "2026-08-12T12:00:00.000Z",
      verificationEmailDescription: "Registrant must verify the provider email.",
      raw: {},
    }
    const findDomain = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(providerDomain)
    const dependencies = {
      now: () => "2026-07-29T12:00:00.000Z",
      loginOpenProvider: vi.fn(async () => "op-token"),
      findOpenProviderDomain: findDomain,
      checkOpenProviderDomainAvailability: vi.fn(async () => ({
        status: "available" as const,
        domain: "clientsite.nl",
        available: true,
        premium: false,
        price: null,
        internalReason: null,
      })),
      findOpenProviderCustomerByReference: vi.fn(async () => ({
        handle: "OWNER-CLIENT",
        comments: "domain-registration:order:600:v1",
        raw: {},
      })),
      createOpenProviderCustomerHandle: vi.fn(),
      listCloudflareZones: vi.fn(async () => [{
        id: "zone_123",
        name: "clientsite.nl",
        status: "active" as const,
        nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
        raw: {},
      }]),
      createOrReuseCloudflareZone: vi.fn(),
      registerOpenProviderDomain: vi.fn(async () => ({
        id: 9001,
        domain: "clientsite.nl",
        status: "registered" as const,
        raw: {},
      })),
    }

    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: 901,
      selectedDomain: "clientsite.nl",
      dependencies,
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("verification is required"),
    })
    expect(findDomain).toHaveBeenCalledTimes(2)
    expect(managedDomains[0]).toMatchObject({
      providerRegistrationState: "confirmed",
      registrantVerificationStatus: "pending",
      registrantVerificationDueAt: "2026-08-12T12:00:00.000Z",
      customerStatus: "verification_required",
      reconciliationRequired: true,
      failureReason: "registrant_verification_pending",
    })
    expect(commerceNotifications).toContainEqual(expect.objectContaining({
      kind: "domain_verification_required",
      recipient: "client@example.com",
      status: "queued",
    }))
    expect(queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "deliver-commerce-notification",
    }))
  })

  it("queues the governed full refund when a paid .nl domain loses the availability race", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    const { payload, managedDomains, queue } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/login")) {
        return Response.json({ data: { token: "op-token" } })
      }
      if (url.includes("/domains?") && init?.method === "GET") {
        return Response.json({ data: { results: [] } })
      }
      if (url.includes("/domains/check")) {
        return Response.json({
          data: { results: [{ domain: "clientsite.nl", status: "active" }] },
        })
      }
      throw new Error(`Unexpected provider fetch ${url}`)
    }))
    const synchronized = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
      },
    }))

    await expect(fulfillPaidOrder(payload, {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    })).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("refund was queued"),
    })
    expect(managedDomains[0]).toMatchObject({
      state: "manual_review",
      customerStatus: "manual_review",
      failureReason: "paid_domain_became_unavailable_before_provider_commit",
    })
    expect(queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: "901",
        scenario: "unfulfillable_before_provider_commit",
      },
    }))
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) =>
      init?.method === "POST" && (
        String(url).endsWith("/customers") ||
        String(url).endsWith("/domains") ||
        String(url).includes("api.cloudflare.com")
      ))).toBe(false)
  })

  it("adopts a delayed Cloudflare zone after an indeterminate create without a duplicate write", async () => {
    const { payload, run, order, managedDomains } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_paidindeterminatezone",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
      providerPaymentId: "tr_paidindeterminatezone",
    })
    const zone = {
      id: "zone_123",
      name: "clientsite.nl",
      status: "active" as const,
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      raw: {},
    }
    const createZone = vi.fn()
      .mockRejectedValue(new CloudflareIndeterminateWriteError("Cloudflare zone creation"))
    const listZones = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([zone])
    const registerDomain = vi.fn(async () => ({
      id: 9001,
      domain: "clientsite.nl",
      status: "requested" as const,
      raw: {},
    }))
    const dependencies = {
      now: () => "2026-07-26T12:00:00.000Z",
      loginOpenProvider: vi.fn(async () => "op-token"),
      findOpenProviderDomain: vi.fn(async () => null),
      checkOpenProviderDomainAvailability: vi.fn(async () => ({
        status: "available" as const,
        domain: "clientsite.nl",
        available: true,
        premium: false,
        price: null,
        internalReason: null,
      })),
      findOpenProviderCustomerByReference: vi.fn(async () => ({
        handle: "OWNER-CLIENT",
        comments: "domain-registration:order:600:v1",
        raw: {},
      })),
      createOpenProviderCustomerHandle: vi.fn(),
      createOrReuseCloudflareZone: createZone,
      listCloudflareZones: listZones,
      registerOpenProviderDomain: registerDomain,
    }

    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: 901,
      selectedDomain: "clientsite.nl",
      dependencies,
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("awaiting reconciliation"),
    })
    await expect(provisionPaidDomainOrder(payload, run, {
      order: order,
      paymentAttemptId: 901,
      selectedDomain: "clientsite.nl",
      dependencies,
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("still processing"),
    })

    expect(createZone).toHaveBeenCalledTimes(1)
    expect(registerDomain).toHaveBeenCalledTimes(1)
    expect(managedDomains[0]).toMatchObject({
      cloudflareZoneId: "zone_123",
      cloudflareZoneStatus: "active",
      providerRegistrationState: "prepared",
      reconciliationRequired: true,
      failureReason: "openprovider_registration_readback_pending",
    })
  })

  it("persists an indeterminate registration and never blindly repeats the provider POST", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_ADMIN_HANDLE", "ADMIN-NL")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv(
      "CLOUDFLARE_RENDERER_TUNNEL_ID",
      "11111111-1111-4111-8111-111111111111",
    )
    vi.stubEnv(
      "CLOUDFLARE_CMS_TUNNEL_ID",
      "22222222-2222-4222-8222-222222222222",
    )
    const { payload, managedDomains } = await createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    let cloudflareZoneCreated = false
    let openproviderCustomerCreated = false
    let registrationPosts = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/login")) return Response.json({ data: { token: "op-token" } })
      if (url.includes("/domains/check")) {
        return Response.json({ data: { results: [{ domain: "clientsite.nl", status: "free" }] } })
      }
      if (url.includes("/domains?") && init?.method === "GET") {
        return Response.json({ data: { results: [] } })
      }
      if (url.includes("/customers?") && init?.method === "GET") {
        return Response.json({
          data: {
            results: openproviderCustomerCreated
              ? [{
                  handle: "OWNER-CLIENT",
                  comments: "domain-registration:order:600:v1",
                }]
              : [],
          },
        })
      }
      if (url.endsWith("/customers") && init?.method === "POST") {
        openproviderCustomerCreated = true
        return Response.json({ data: { handle: "OWNER-CLIENT" } })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones?")) {
        return Response.json({
          success: true,
          result: cloudflareZoneCreated
            ? [{
                id: "zone_123",
                name: "clientsite.nl",
                status: "active",
                name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
              }]
            : [],
        })
      }
      if (url.endsWith("/client/v4/zones") && init?.method === "POST") {
        cloudflareZoneCreated = true
        return Response.json({
          success: true,
          result: {
            id: "zone_123",
            name: "clientsite.nl",
            status: "active",
            name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          },
        })
      }
      if (url.endsWith("/v1beta/domains") && init?.method === "POST") {
        registrationPosts += 1
        throw new TypeError("socket closed after dispatch")
      }
      throw new Error(`Unexpected provider fetch ${url}`)
    }))
    const synchronized = await synchronizeMolliePayment(payload, "tr_test123", async () => ({
      id: "tr_test123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test123",
        sequenceType: "first",
      },
    }))
    const input = {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    }

    await expect(fulfillPaidOrder(payload, input)).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no retry was sent"),
    })
    await expect(fulfillPaidOrder(payload, input)).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no registration retry was sent"),
    })
    expect(registrationPosts).toBe(1)
    expect(managedDomains[0]).toMatchObject({
      state: "registration_pending",
      providerRegistrationState: "indeterminate",
      reconciliationRequired: true,
      failureReason: "openprovider_registration_indeterminate",
    })
  })

  it("blocks a domain-provisioning retry without an order-bound paid attempt", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    const { payload, run, order } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "exception",
      paymentStatus: "paid",
    })

    const result = await retryPostPaymentAutomation(
      payload,
      500,
      "domain_provisioning",
    )

    expect(result).toEqual({
      status: "blocked",
      message:
        "Domain provisioning retry requires one paid order-bound payment attempt.",
    })
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "blocked",
        step: "domain_provisioning",
      },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("blocks a domain-provisioning retry after a refund enters progress", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    enableProductionCommerceRelease()
    const {
      payload,
      order,
      paymentAttempts,
    } = await createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refundpending",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, {
      state: "exception",
      paymentStatus: "paid",
    })
    Object.assign(paymentAttempts[0]!, {
      state: "refund_pending",
    })

    const result = await retryPostPaymentAutomation(
      payload,
      500,
      "domain_provisioning",
    )

    expect(result).toEqual({
      status: "blocked",
      message:
        "Domain provisioning retry requires one paid order-bound payment attempt.",
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("accepts the unsigned classic form webhook and rejects malformed content", async () => {
    const invalidBodyResponse = await mollieWebhookPOST(new NextRequest("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "not-an-id=1",
    }))
    expect(invalidBodyResponse.status).toBe(400)

    const raw = "id=tr_test123"
    const { payload } = await createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_test123" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" },
      id: "tr_test123",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }), { status: 200 })))

    const okResponse = await mollieWebhookPOST(new NextRequest("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: raw,
    }))
    expect(okResponse.status).toBe(200)
    expect(await okResponse.json()).toEqual({ ok: true })
    const wrongContentType = await mollieWebhookPOST(new NextRequest(
      "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "tr_test123" }),
      },
    ))
    expect(wrongContentType.status).toBe(415)
  })

  it("queues unknown webhook ids without provider lookup or internal-state disclosure", async () => {
    const { payload, update, queue } = await createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_expected" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ amount: { currency: "EUR", value: "499.00" },
      id: "tr_unknown",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }), { status: 200 })))

    const response = await mollieWebhookPOST(new NextRequest("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "id=tr_unknown",
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
    expect(queue).toHaveBeenCalledWith({
      task: "sync-mollie-payment",
      input: { paymentId: "tr_unknown" },
      queue: "default",
      overrideAccess: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("returns after enqueueing and never performs a Mollie lookup in the route", async () => {
    const { payload, update, queue } = await createPayloadStub()
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", { status: 404 })))

    const response = await mollieWebhookPOST(new NextRequest("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "id=tr_missing",
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
    expect(queue).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects an oversized webhook body before queueing work", async () => {
    const { payload, queue } = await createPayloadStub()
    vi.mocked(getPayload).mockResolvedValue(payload)
    const response = await mollieWebhookPOST(new NextRequest(
      "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": "5000",
        },
        body: `id=tr_test&padding=${"a".repeat(5_000)}`,
      },
    ))

    expect(response.status).toBe(413)
    expect(queue).not.toHaveBeenCalled()
  })

  it("acknowledges an obsolete Mollie 404 without a task retry", async () => {
    const { payload } = await createPayloadStub()
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ status: 404,
        title: "Not Found",
        detail: "The payment does not exist.",
      }), { status: 404 })
    ))
    const handler = createTaskRunner(syncMolliePaymentTask)

    await expect(handler({
      input: { paymentId: "tr_obsolete" },
      req: { payload },
    })).resolves.toMatchObject({
      output: {
        status: "ignored",
        fulfillmentQueued: false,
      },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
