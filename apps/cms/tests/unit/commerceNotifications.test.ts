import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CommerceNotificationDelivery, DomainRenewalCycle } from "@/payload-types"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { commerceNotificationFixture, tenantFixture, managedDomainFixture, billingAgreementFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { validRenewalCycle } from "../_helpers/commerceBuilders"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"
import { matchesWhere } from "../_helpers/mockPayload"
import { asDocRecord } from "../_helpers/payloadApi"

const mailMocks = vi.hoisted(() => {
  class MockMailSendError extends Error {
    normalized: { retryState: "retryable" | "permanent" }
    constructor(retryState: "retryable" | "permanent") {
      super("mail failed")
      this.normalized = { retryState }
    }
  }
  return { MockMailSendError }
})

vi.mock("@/lib/email/sendEmail", () => ({
  MailSendError: mailMocks.MockMailSendError,
  asMailLogPayload: (value: unknown) => value,
  sendEmail: vi.fn(async () => ({ status: "sent" })),
}))

import {
  deliverCommerceNotification,
  ensureCommerceNotification,
} from "@/lib/commerce/notifications"
import { sendEmail } from "@/lib/email/sendEmail"

const createPayload = async (cycle: Partial<DomainRenewalCycle> = {}) => {
  const payload = await createInitializedTestPayload()
  const deliveries: CommerceNotificationDelivery[] = []
  const tenant = tenantFixture({ id: 1, name: "Acme Studio" })
  const renewedCycle = validRenewalCycle({
    id: 20,
    managedDomain: 30,
    state: "renewed",
    currency: "EUR",
    providerOperationPriceNetMinor: 1_250,
    includedAllowanceNetMinor: 1_000,
    surchargeNetMinor: 250,
    vatAmountMinor: 53,
    grossAmountMinor: 303,
    financialCoverageState: "payment_secured",
    providerRenewalMode: "provider_autorenew",
    providerAutorenew: "on",
    registrarSafeCutoffAt: "2027-07-24T00:00:00.000Z",
    paymentChargeAt: "2027-05-27T00:00:00.000Z",
    providerBalanceAvailableMinor: 100_000,
    providerBalanceReservedMinor: 500,
    providerBalanceCurrency: "EUR",
    providerBalanceCheckedAt: "2027-07-19T00:00:00.000Z",
    ...cycle,
  })
  const managedDomain = managedDomainFixture({ id: 30, domainNameAscii: "example.nl" })
  const billingAgreement = billingAgreementFixture({ id: 900, originatingOrder: 600 })
  let nextId = 10
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => {
    if (collection === "managed-domains") return paginatedFixture([managedDomain])
    if (collection !== "commerce-notification-deliveries") return paginatedFixture([])
    return paginatedFixture(deliveries.filter(entry => matchesWhere(asDocRecord(entry), where)))
  })
  const create = vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
    if (collection !== "commerce-notification-deliveries") throw new Error("unexpected create")
    const key = asDocRecord(data).notificationKey
    if (deliveries.some(entry => entry.notificationKey === key)) throw new Error("unique violation")
    const delivery = commerceNotificationFixture({ id: nextId++ })
    Object.assign(delivery, data)
    deliveries.push(delivery)
    return delivery
  })
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
    if (collection === "tenants") return tenant
    if (collection === "domain-renewal-cycles") return renewedCycle
    if (collection === "billing-agreements") return billingAgreement
    if (collection === "managed-domains") return managedDomain
    if (collection === "commerce-notification-deliveries") {
      const delivery = deliveries.find(entry => String(entry.id) === String(id))
      if (!delivery) throw new Error("missing delivery")
      return delivery
    }
    throw new Error("unexpected find " + collection)
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    if (args.collection !== "commerce-notification-deliveries") throw new Error("unexpected update")
    if (args.id != null) {
      const delivery = deliveries.find(entry => String(entry.id) === String(args.id))
      if (!delivery) throw new Error("missing delivery")
      Object.assign(delivery, args.data)
      return delivery
    }
    const docs = deliveries.filter(entry => matchesWhere(asDocRecord(entry), args.where) && ["queued", "failed", "processing"].includes(entry.status))
    for (const delivery of docs) Object.assign(delivery, args.data)
    return { docs, errors: [], totalDocs: docs.length }
  }))
  vi.spyOn(payload.jobs, "queue").mockResolvedValue({ id: 1, input: {}, totalTried: 0, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" })
  for (const method of ["warn", "error", "info"] as const) vi.spyOn(payload.logger, method)
  return { deliveries, create, payload }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-01T09:00:00.000Z"))
})

afterEach(() => vi.useRealTimers())

describe("commerce notification delivery evidence", () => {
  it("deduplicates the same governed reminder key under retries", async () => {
    const store = await createPayload()
    const input = {
      payload: store.payload,
      kind: "payment_overdue_7d" as const,
      tenantId: 1,
      recipient: "Client@Example.com",
      eventAt: "2026-08-01T10:00:00.000Z",
      billingAgreementId: 900,
    }
    const first = await ensureCommerceNotification(input)
    const second = await ensureCommerceNotification(input)
    expect(second.id).toBe(first.id)
    expect(store.create).toHaveBeenCalledOnce()
    expect(store.deliveries[0]).toMatchObject({
      recipient: "client@example.com",
      status: "queued",
      kind: "payment_overdue_7d",
    })
  })

  it("keeps one delivery for a stable business event when provider timing changes", async () => {
    const store = await createPayload()
    const base = {
      payload: store.payload,
      kind: "domain_verification_required" as const,
      tenantId: 1,
      recipient: "client@example.com",
      businessEventKey: "registration:30",
      billingAgreementId: 900,
    }
    const first = await ensureCommerceNotification({
      ...base,
      eventAt: "2026-08-01T10:00:00.000Z",
    })
    const second = await ensureCommerceNotification({
      ...base,
      eventAt: "2026-08-02T10:00:00.000Z",
    })

    expect(second.id).toBe(first.id)
    expect(store.create).toHaveBeenCalledOnce()
    expect(store.deliveries[0]).toMatchObject({
      eventAt: "2026-08-02T10:00:00.000Z",
      notificationKey: expect.stringContaining("registration:30"),
    })
  })

  it("claims once, sends transactionally, and skips duplicate workers after success", async () => {
    const store = await createPayload()
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "cancellation_scheduled",
      tenantId: 1,
      recipient: "client@example.com",
      eventAt: "2026-09-01T10:00:00.000Z",
      billingAgreementId: 900,
    })
    const first = await deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2026-08-01T10:00:00.000Z"),
    })
    const duplicate = await deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2026-08-01T10:00:01.000Z"),
    })
    expect(first).toBe("sent")
    expect(duplicate).toBe("skipped")
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(store.deliveries[0]).toMatchObject({
      status: "sent",
      attemptCount: 1,
      sentAt: "2026-08-01T10:00:00.000Z",
    })
  })

  it("delivers the durable first-payment confirmation", async () => {
    const store = await createPayload()
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "payment_received",
      tenantId: 1,
      recipient: "client@example.com",
      eventAt: "2026-08-01T10:00:00.000Z",
      billingAgreementId: 900,
    })

    await expect(deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2026-08-01T10:00:01.000Z"),
    })).resolves.toBe("sent")

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      subject: "Betaling ontvangen voor Site in a Box",
      text: expect.stringContaining("De domeinregistratie"),
    }))
  })

  it("persists a retry lease after a transient mail failure", async () => {
    const store = await createPayload()
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "payment_failed_0d",
      tenantId: 1,
      recipient: "client@example.com",
      eventAt: "2026-08-01T10:00:00.000Z",
      billingAgreementId: 900,
    })
    vi.mocked(sendEmail).mockRejectedValueOnce(new mailMocks.MockMailSendError("retryable"))
    const status = await deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2026-08-01T10:00:00.000Z"),
    })
    expect(status).toBe("failed")
    expect(store.deliveries[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      nextAttemptAt: "2026-08-01T11:00:00.000Z",
      leaseUntil: null,
    })
  })

  it("cancels an obsolete warning after the renewal date already advanced", async () => {
    const store = await createPayload()
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "domain_renewal_7d",
      tenantId: 1,
      recipient: "client@example.com",
      eventAt: "2027-07-26T00:00:00.000Z",
      renewalCycleId: 20,
    })

    await expect(deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2027-07-19T00:00:00.000Z"),
    })).resolves.toBe("skipped")

    expect(store.deliveries[0]).toMatchObject({ status: "cancelled" })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("cancels an already queued warning when renewal intent was cancelled before commitment", async () => {
    const store = await createPayload({ state: "cancelled", renewalIntentSnapshot: false })
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "domain_renewal_admin_7d",
      tenantId: 1,
      recipient: "admin@siteinabox.nl",
      eventAt: "2027-07-26T00:00:00.000Z",
      renewalCycleId: 20,
    })

    await expect(deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2027-07-19T00:00:00.000Z"),
    })).resolves.toBe("skipped")

    expect(store.deliveries[0]).toMatchObject({ status: "cancelled" })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("renders the persisted actionable price evidence in the 60-day notice", async () => {
    const store = await createPayload({ state: "payment_committed" })
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "domain_renewal_60d",
      tenantId: 1,
      recipient: "client@example.com",
      eventAt: "2027-07-26T00:00:00.000Z",
      renewalCycleId: 20,
    })

    await deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2027-05-27T00:00:00.000Z"),
    })

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringMatching(
        /Providerprijs excl\. BTW: €\s?12,50.*Inbegrepen domeinvergoeding: €\s?10,00.*Bruto nu te betalen: €\s?3,03/s,
      ),
    }))
  })

  it("renders the persisted provider balance and execution evidence in the admin dossier", async () => {
    const store = await createPayload({ state: "payment_committed" })
    const delivery = await ensureCommerceNotification({
      payload: store.payload,
      kind: "domain_renewal_admin_7d",
      tenantId: 1,
      recipient: "admin@siteinabox.nl",
      eventAt: "2027-07-26T00:00:00.000Z",
      renewalCycleId: 20,
    })

    await deliverCommerceNotification({
      payload: store.payload,
      deliveryId: delivery.id,
      now: new Date("2027-07-19T00:00:00.000Z"),
    })

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringMatching(
        /Uitvoeringsmodus: provider_autorenew.*Providerbalans: €\s?1\.000,00 beschikbaar; €\s?5,00 gereserveerd/s,
      ),
    }))
  })
})
