import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  createTransport: mocks.createTransport,
}))

describe("sendEmail", () => {
  const originalToken = process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN
  const originalFrom = process.env.EMAIL_FROM

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN
    delete process.env.EMAIL_FROM
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
    mocks.sendMail.mockResolvedValue({ messageId: "test-message" })
  })

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN
    } else {
      process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN = originalToken
    }
    if (originalFrom === undefined) {
      delete process.env.EMAIL_FROM
    } else {
      process.env.EMAIL_FROM = originalFrom
    }
  })

  it("throws before creating a transport when the Cloudflare token is missing", async () => {
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })).rejects.toThrow("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid")
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it("throws before creating a transport when the Cloudflare token is a placeholder", async () => {
    process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN = "<cloudflare-email-smtp-token>"
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })).rejects.toThrow("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid")
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it("sends through Cloudflare SMTP with implicit TLS", async () => {
    process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN = " cf-token "
    process.env.EMAIL_FROM = "noreply@example.com"
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await sendEmail({
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })

    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.mx.cloudflare.net",
      port: 465,
      secure: true,
      auth: {
        user: "api_token",
        pass: "cf-token",
      },
    })
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "noreply@example.com",
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })
  })
})
