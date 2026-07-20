import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/email/sendEmail", async () => {
  const actual = await vi.importActual<typeof import("payload")>("@/lib/email/sendEmail")
  return {
    ...actual,
    getPlatformMailSender: () => "noreply@siteinabox.nl",
    sendEmail: mocks.sendEmail,
  }
})

import { asPayload } from "../_helpers/mockPayload"

import { sendPlatformContactEmail, validatePlatformContact } from "@/lib/contact/platformContact"

const payload = asPayload({
  create: vi.fn(),
  logger: { warn: vi.fn() },
})

describe("platform contact mail", () => {
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
  })

  it("sends siteinabox.nl contact mail through the platform sender with submitter reply-to", async () => {
    await expect(sendPlatformContactEmail(payload, {
      name: "Ada",
      email: "ada@example.com",
      phone: "0612345678",
      subjectTopic: "pakket",
      message: "Can we schedule a call?",
      source: "siteinabox.nl/contact",
    })).resolves.toEqual({ ok: true })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@siteinabox.nl",
      from: "noreply@siteinabox.nl",
      replyTo: "ada@example.com",
      intent: "platform.operational",
      payload,
    }))
    expect(mocks.sendEmail.mock.calls[0]?.[0].html).toContain("Can we schedule a call?")
  })

  it("rejects invalid contact payloads before sending", async () => {
    expect(validatePlatformContact({ name: "", email: "ada@example.com", message: "Hi" })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(validatePlatformContact({ name: "Ada", email: "bad", message: "Hi" })).toMatchObject({
      ok: false,
      status: 400,
    })

    await expect(sendPlatformContactEmail(payload, {
      name: "Ada",
      email: "bad",
      message: "Hi",
    })).resolves.toMatchObject({ ok: false, status: 400 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
