import { createInitializedTestPayload } from "../_helpers/testPayload"
import { tenantFixture, userFixture, paginatedFixture } from "../_helpers/generatedDocs"
import type { Form, Tenant, TenantNotificationSubscription } from "@/payload-types"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/email/sendEmail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/sendEmail")>("@/lib/email/sendEmail")
  return {
    ...actual,
    sendEmail: mocks.sendEmail,
  }
})

import { notifyTenantOfFormSubmission } from "@/collections/Forms"

const verifiedTenant = tenantFixture({
  id: 7,
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "verified",
    sendingDomain: "mail.client.nl",
    senderEmail: "noreply@mail.client.nl",
  },
})

const formDoc: Form = {
  id: 99,
  status: "new",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  tenant: 7,
  formName: "Contact",
  pageUrl: "https://client.nl/contact",
  name: "Ada",
  email: "ada@example.com",
  message: "Please call me.",
  data: {
    name: "Ada",
    email: "ada@example.com",
    message: "Please call me.",
    extra: "Stored in Forms, not mail logs.",
  },
}

const payloadStub = async (overrides: {
  subscriptionEmail?: string | null
  tenant?: Tenant
  sendRejects?: boolean
} = {}) => {
  const payload = await createInitializedTestPayload()
  const email = overrides.subscriptionEmail === undefined ? "owner@client.nl" : overrides.subscriptionEmail
  const subscriptions: TenantNotificationSubscription[] = email === null ? [] : [{
    id: 1, subscriptionKey: "forms:7:1", tenant: 7,
    user: userFixture({ email, tenants: [{ tenant: 7 }] }), email,
    formSubmissions: true, publishingAndSiteStatus: false, domainAndDns: false,
    billingAndPayments: false, teamAndAccess: false, operationalDigest: false,
    appointmentBookings: false, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
  }]
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => {
    if (collection !== "tenant-notification-subscriptions") throw new Error(`Unexpected collection ${collection}`)
    return paginatedFixture(subscriptions)
  })
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection }) => {
    if (collection !== "tenants") throw new Error(`Unexpected collection ${collection}`)
    return overrides.tenant ?? verifiedTenant
  })
  vi.spyOn(payload.logger, "warn")
  if (overrides.sendRejects) {
    mocks.sendEmail.mockRejectedValueOnce(new Error("provider unavailable"))
  } else {
    mocks.sendEmail.mockResolvedValueOnce({ provider: "test", providerMessageId: "msg_1" })
  }
  return payload
}

beforeEach(() => {
  mocks.sendEmail.mockReset()
})

describe("generated-site form tenant notifications", () => {
  it("sends a tenant notification from the verified tenant sender with submitter Reply-To", async () => {
    const payload = await payloadStub()

    await notifyTenantOfFormSubmission({ doc: formDoc, payload })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@client.nl",
      from: "noreply@mail.client.nl",
      replyTo: "ada@example.com",
      intent: "forms.tenant_notification",
      tenant: "7",
      payload,
    }))
    expect(mocks.sendEmail.mock.calls[0]?.[0].html).toContain("Please call me.")
  })

  it("uses the platform sender while tenant-branded email is pending", async () => {
    const payload = await payloadStub({
      tenant: tenantFixture({ id: 7, emailSending: { provider: "cloudflare", status: "pending" } }),
    })

    await notifyTenantOfFormSubmission({ doc: formDoc, payload })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@client.nl",
      from: "noreply@siteinabox.nl",
      replyTo: "ada@example.com",
      intent: "forms.tenant_notification",
    }))
  })

  it("skips when no tenant member subscribes to form notifications", async () => {
    const payload = await payloadStub({ subscriptionEmail: null })

    await notifyTenantOfFormSubmission({ doc: formDoc, payload })

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      reason: "missing_subscription",
      tenantId: "7",
      formId: 99,
    }), "[forms] tenant notification skipped")
  })

  it("keeps form storage non-blocking when sending fails", async () => {
    const payload = await payloadStub({ sendRejects: true })

    await expect(notifyTenantOfFormSubmission({ doc: formDoc, payload })).resolves.toBeUndefined()

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "7",
      formId: 99,
      failed: 1,
      attempted: 1,
    }), "[forms] tenant notification delivery partially failed")
  })
})
