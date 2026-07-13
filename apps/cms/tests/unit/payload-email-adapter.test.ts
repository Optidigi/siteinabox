import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/email/sendEmail", () => ({
  getPlatformMailSender: () => "noreply@siteinabox.nl",
  sendEmail: mocks.sendEmail,
}))

import { htmlToPlainText, payloadEmailAdapter } from "@/lib/email/payloadEmailAdapter"

describe("Payload Cloudflare email adapter", () => {
  beforeEach(() => vi.clearAllMocks())

  it("delegates lazily to the shared auth.password_reset transport with text and logging", async () => {
    mocks.sendEmail.mockResolvedValue({ provider: "cloudflare-rest" })
    const payload = { create: vi.fn(), logger: { warn: vi.fn() } } as any
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
})
