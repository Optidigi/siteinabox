import { beforeEach, describe, expect, it, vi } from "vitest"
import { asPayload, type MockDoc } from "../_helpers/mockPayload"

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

const createPayload = () => {
  const deliveries: MockDoc[] = []
  const tenant = { id: 1, name: "Acme Studio" }
  let nextId = 10
  const find = vi.fn(async ({ collection, where }: {
    collection: string
    where?: Record<string, { equals?: unknown }>
  }) => {
    if (collection !== "commerce-notification-deliveries") return { docs: [] }
    const key = where?.notificationKey?.equals
    return {
      docs: key == null
        ? deliveries
        : deliveries.filter((entry) => entry.notificationKey === key),
    }
  })
  const create = vi.fn(async ({ collection, data }: {
    collection: string
    data: Record<string, unknown>
  }) => {
    if (collection !== "commerce-notification-deliveries") throw new Error("unexpected create")
    const duplicate = deliveries.find((entry) => entry.notificationKey === data.notificationKey)
    if (duplicate) throw new Error("unique violation")
    const delivery = { id: nextId++, ...data }
    deliveries.push(delivery)
    return delivery
  })
  const findByID = vi.fn(async ({ collection, id }: {
    collection: string
    id: string | number
  }) => {
    if (collection === "tenants") return tenant
    if (collection === "commerce-notification-deliveries") {
      const delivery = deliveries.find((entry) => String(entry.id) === String(id))
      if (!delivery) throw new Error("missing delivery")
      return delivery
    }
    throw new Error(`unexpected find ${collection}`)
  })
  const update = vi.fn(async (args: {
    collection: string
    id?: string | number
    where?: Record<string, unknown>
    data: Record<string, unknown>
  }) => {
    if (args.collection !== "commerce-notification-deliveries") throw new Error("unexpected update")
    if (args.id != null) {
      const delivery = deliveries.find((entry) => String(entry.id) === String(args.id))
      if (!delivery) throw new Error("missing delivery")
      Object.assign(delivery, args.data)
      return delivery
    }
    const delivery = deliveries.find((entry) =>
      String(entry.id) === String(
        ((args.where?.and as Array<Record<string, { equals?: unknown }>> | undefined)?.[0]?.id?.equals),
      ))
    if (!delivery || !["queued", "failed", "processing"].includes(String(delivery.status))) {
      return { docs: [] }
    }
    Object.assign(delivery, args.data)
    return { docs: [delivery] }
  })
  return {
    deliveries,
    create,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      jobs: { queue: vi.fn() },
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("commerce notification delivery evidence", () => {
  it("deduplicates the same governed reminder key under retries", async () => {
    const store = createPayload()
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

  it("claims once, sends transactionally, and skips duplicate workers after success", async () => {
    const store = createPayload()
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

  it("persists a retry lease after a transient mail failure", async () => {
    const store = createPayload()
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
})
