import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return {
    ...actual,
    getPlatformMailSender: () => "noreply@siteinabox.nl",
    sendEmail: mocks.sendEmail,
  }
})

import { createTestPayload } from "../_helpers/testPayload"
import { payloadEmailAdapter, htmlToPlainText } from "@/lib/email/payloadEmailAdapter"

describe("Payload Cloudflare email adapter", () => {
  beforeEach(() => vi.clearAllMocks())

  it("delegates lazily to the shared auth.password_reset transport with text and logging", async () => {
    mocks.sendEmail.mockResolvedValue({ provider: "cloudflare-rest" })
    const payload = createTestPayload()
    const adapter = payloadEmailAdapter({ payload })

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    await adapter.sendEmail({
      to: "admin@example.nl",
      subject: "Reset",
      html: "<p>Reset <a href=\"https://admin.example.nl/reset\">here</a></p>",
    })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@example.nl",
      subject: "Reset",
      intent: "auth.password_reset",
      payload,
      text: expect.stringContaining("Reset here"),
    }))
  })

  it("converts basic HTML into readable plain text", () => {
    expect(htmlToPlainText("<p>First &amp; second</p><p>Next</p>"))
      .toBe("First & second\n\nNext")
  })

  it("preserves recipient addresses in Nodemailer's nested input lists", async () => {
    const payload = createTestPayload()
    await payloadEmailAdapter({ payload }).sendEmail({
      to: ["first@example.nl", [{ name: "Second", address: "second@example.nl" }]],
      subject: "Fixture", html: "<p>Fixture</p>",
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ["first@example.nl", "second@example.nl"] }))
  })

  it("rejects an address-less input before calling the transport", async () => {
    const payload = createTestPayload()
    await expect(payloadEmailAdapter({ payload }).sendEmail({
      to: { name: "Missing address" }, subject: "Fixture", html: "<p>Fixture</p>",
    })).rejects.toThrow("recipient address")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
