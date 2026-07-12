import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/email/sendEmail", async () => {
  const actual = await vi.importActual<any>("@/lib/email/sendEmail")
  return {
    ...actual,
    sendEmail: mocks.sendEmail,
  }
})

import { notifyTenantOfFormSubmission } from "@/collections/Forms"

const verifiedTenant = {
  id: 7,
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "verified",
    sendingDomain: "mail.client.nl",
    senderEmail: "noreply@mail.client.nl",
  },
}

const formDoc = {
  id: 99,
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

const payloadStub = (overrides: {
  subscriptionEmail?: string | null
  tenant?: any
  sendRejects?: boolean
} = {}) => {
  const payload = {
    find: vi.fn(async () => ({
      docs: overrides.subscriptionEmail === null
        ? []
        : [{
            email: overrides.subscriptionEmail === undefined ? "owner@client.nl" : overrides.subscriptionEmail,
            user: {
              email: overrides.subscriptionEmail === undefined ? "owner@client.nl" : overrides.subscriptionEmail,
              tenants: [{ tenant: 7 }],
            },
          }],
    })),
    findByID: vi.fn(async () => overrides.tenant === undefined ? verifiedTenant : overrides.tenant),
    create: vi.fn(),
    logger: { warn: vi.fn() },
  }
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
    const payload = payloadStub()

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

  it("skips without platform fallback when tenant sender is not verified", async () => {
    const payload = payloadStub({
      tenant: { id: 7, emailSending: { provider: "cloudflare", status: "pending" } },
    })

    await notifyTenantOfFormSubmission({ doc: formDoc, payload })

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith("[forms] tenant notification skipped", expect.objectContaining({
      reason: "tenant_sender_unverified",
      tenantId: "7",
      formId: 99,
    }))
  })

  it("skips when no tenant member subscribes to form notifications", async () => {
    const payload = payloadStub({ subscriptionEmail: null })

    await notifyTenantOfFormSubmission({ doc: formDoc, payload })

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith("[forms] tenant notification skipped", expect.objectContaining({
      reason: "missing_subscription",
      tenantId: "7",
      formId: 99,
    }))
  })

  it("keeps form storage non-blocking when sending fails", async () => {
    const payload = payloadStub({ sendRejects: true })

    await expect(notifyTenantOfFormSubmission({ doc: formDoc, payload })).resolves.toBeUndefined()

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(payload.logger.warn).toHaveBeenCalledWith("[forms] tenant notification delivery partially failed", expect.objectContaining({
      tenantId: "7",
      formId: 99,
      failed: 1,
      attempted: 1,
    }))
  })
})
