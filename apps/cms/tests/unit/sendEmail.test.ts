import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MailTransportProvider } from "@/lib/email/sendEmail"

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

  it("rejects missing or placeholder Cloudflare tokens before creating a transport", async () => {
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })).rejects.toThrow("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid")
    expect(mocks.createTransport).not.toHaveBeenCalled()

    process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN = "<cloudflare-email-smtp-token>"
    await expect(sendEmail({
      to: "customer@example.com",
      subject: "Preview access",
      html: "<p>Login</p>",
    })).rejects.toThrow("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid")
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it("logs and alerts provider setup failures when Payload logging is available", async () => {
    const payload = mockPayload()
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      intent: "auth.magic_link",
      to: "customer@example.com",
      subject: "Magic link",
      html: "<p>Secret login body</p>",
      payload,
    }, {
      now: () => new Date("2026-07-01T12:01:00.000Z"),
    })).rejects.toThrow("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid")

    expect(mocks.createTransport).not.toHaveBeenCalled()
    expect(payload.create).toHaveBeenCalledWith({
      collection: "mail-logs",
      overrideAccess: true,
      data: expect.objectContaining({
        flow: "auth.magic_link",
        sender: "noreply@siteinabox.nl",
        recipient: "customer@example.com",
        status: "failed",
        provider: "cloudflare-smtp",
        providerErrorMessage: "CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid - cannot send email",
        retryState: "none",
        failedAt: "2026-07-01T12:01:00.000Z",
      }),
    })
    expect(payload.create).toHaveBeenCalledWith({
      collection: "operational-alerts",
      overrideAccess: true,
      data: expect.objectContaining({
        severity: "error",
        status: "open",
        source: "mail",
        message: "Outbound mail failed for auth.magic_link",
      }),
    })
  })

  it("keeps Cloudflare SMTP compatible with implicit TLS", async () => {
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

  it("uses the platform sender by default and logs metadata only", async () => {
    const now = new Date("2026-07-01T12:00:00.000Z")
    const provider = mockProvider({ providerMessageId: "provider-123" })
    const payload = mockPayload()
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await sendEmail({
      intent: "auth.magic_link",
      to: "customer@example.com",
      subject: "Magic link",
      html: "<p>Secret login body</p>",
      payload,
    }, {
      provider,
      now: () => now,
    })

    expect(provider.send).toHaveBeenCalledWith({
      from: "noreply@siteinabox.nl",
      to: "customer@example.com",
      subject: "Magic link",
      html: "<p>Secret login body</p>",
      text: undefined,
      replyTo: undefined,
    })
    expect(payload.create).toHaveBeenCalledWith({
      collection: "mail-logs",
      overrideAccess: true,
      data: {
        flow: "auth.magic_link",
        sender: "noreply@siteinabox.nl",
        recipient: "customer@example.com",
        status: "sent",
        provider: "cloudflare-smtp",
        providerMessageId: "provider-123",
        retryState: "none",
        sentAt: "2026-07-01T12:00:00.000Z",
      },
    })
    const loggedData = (payload.create.mock.calls as unknown as Array<[{
      data: Record<string, unknown>
    }]>)[0]?.[0].data
    expect(JSON.stringify(loggedData)).not.toContain("Magic link")
    expect(JSON.stringify(loggedData)).not.toContain("Secret login body")
  })

  it("honors explicit sender and reply-to for future tenant flows", async () => {
    const provider = mockProvider({ providerMessageId: "tenant-message" })
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await sendEmail({
      intent: "forms.tenant_notification",
      tenant: 42,
      from: "noreply@mail.tenant.example",
      replyTo: "visitor@example.com",
      to: "owner@example.com",
      subject: "New form submission",
      html: "<p>New message</p>",
    }, { provider })

    expect(provider.send).toHaveBeenCalledWith({
      from: "noreply@mail.tenant.example",
      replyTo: "visitor@example.com",
      to: "owner@example.com",
      subject: "New form submission",
      html: "<p>New message</p>",
      text: undefined,
    })
  })

  it("maps provider failures and logs failed metadata", async () => {
    const error = Object.assign(new Error("550 5.7.1 Sender denied"), {
      responseCode: 550,
      response: "550 5.7.1 Sender denied",
    })
    const provider = mockProvider(undefined, error)
    const payload = mockPayload()
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      intent: "forms.tenant_notification",
      tenant: 42,
      from: "noreply@mail.tenant.example",
      to: "owner@example.com",
      subject: "New form submission",
      html: "<p>New message</p>",
      payload,
    }, {
      provider,
      now: () => new Date("2026-07-01T12:05:00.000Z"),
    })).rejects.toMatchObject({
      normalized: {
        provider: "cloudflare-smtp",
        providerErrorCode: "550",
        providerErrorMessage: "550 5.7.1 Sender denied",
        retryState: "permanent",
      },
    })

    expect(payload.create).toHaveBeenCalledWith({
      collection: "mail-logs",
      overrideAccess: true,
      data: {
        flow: "forms.tenant_notification",
        tenant: 42,
        sender: "noreply@mail.tenant.example",
        recipient: "owner@example.com",
        status: "failed",
        provider: "cloudflare-smtp",
        providerErrorCode: "550",
        providerErrorMessage: "550 5.7.1 Sender denied",
        retryState: "permanent",
        failedAt: "2026-07-01T12:05:00.000Z",
      },
    })
  })

  it("raises metadata-only alerts for important mail failures without sending recursive email", async () => {
    const error = Object.assign(new Error("550 5.7.1 Sender denied"), {
      responseCode: 550,
      response: "550 5.7.1 Sender denied",
    })
    const provider = mockProvider(undefined, error)
    const payload = mockPayload()
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      intent: "preview.site_ready",
      tenant: { id: 42 },
      from: "noreply@mail.tenant.example",
      to: "customer@example.com",
      subject: "Your site is ready",
      html: "<p>Secret preview body</p>",
      payload,
    }, {
      provider,
      now: () => new Date("2026-07-01T12:10:00.000Z"),
    })).rejects.toThrow("Email send failed")

    expect(provider.send).toHaveBeenCalledTimes(1)
    expect(payload.create).toHaveBeenCalledWith({
      collection: "operational-alerts",
      overrideAccess: true,
      data: expect.objectContaining({
        severity: "error",
        status: "open",
        source: "mail",
        message: "Outbound mail failed for preview.site_ready",
        tenant: 42,
        occurrenceCount: 1,
        firstSeenAt: "2026-07-01T12:10:00.000Z",
        lastSeenAt: "2026-07-01T12:10:00.000Z",
      }),
    })
    expect(payload.logger.error).toHaveBeenCalledWith("[mail] outbound delivery alert", expect.objectContaining({
      severity: "error",
      reason: "important_mail_failure",
      flow: "preview.site_ready",
      tenant: 42,
      sender: "noreply@mail.tenant.example",
      recipient: "customer@example.com",
      provider: "cloudflare-smtp",
      providerErrorCode: "550",
      retryState: "permanent",
      action: "Check sender/domain verification, recipient validity, and provider rejection code.",
    }))
    expect(payload.create).toHaveBeenCalledWith({
      collection: "operational-alerts",
      overrideAccess: true,
      data: expect.objectContaining({
        severity: "error",
        status: "open",
        source: "mail",
        dedupeKey: "mail:important_mail_failure:preview.site_ready:42:noreply@mail.tenant.example:customer@example.com:cloudflare-smtp:550",
        message: "Outbound mail failed for preview.site_ready",
        tenant: 42,
        occurrenceCount: 1,
        firstSeenAt: "2026-07-01T12:10:00.000Z",
        lastSeenAt: "2026-07-01T12:10:00.000Z",
      }),
    })
    expect(JSON.stringify(payload.logger.error.mock.calls)).not.toContain("Your site is ready")
    expect(JSON.stringify(payload.logger.error.mock.calls)).not.toContain("Secret preview body")
    expect(JSON.stringify(payload.create.mock.calls)).not.toContain("Your site is ready")
    expect(JSON.stringify(payload.create.mock.calls)).not.toContain("Secret preview body")
  })

  it("raises a warning when retryable failures repeat in the alert window", async () => {
    const error = Object.assign(new Error("421 temporary failure"), {
      responseCode: 421,
      response: "421 temporary failure",
    })
    const provider = mockProvider(undefined, error)
    const payload = mockPayload({ totalDocs: 3 })
    const { sendEmail } = await import("@/lib/email/sendEmail")

    await expect(sendEmail({
      intent: "forms.tenant_notification",
      tenant: 42,
      from: "noreply@mail.tenant.example",
      to: "owner@example.com",
      subject: "New form submission",
      html: "<p>Stored form body</p>",
      payload,
    }, {
      provider,
      now: () => new Date("2026-07-01T12:15:00.000Z"),
    })).rejects.toThrow("Email send failed")

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "mail-logs",
      limit: 3,
      depth: 0,
      overrideAccess: true,
    }))
    expect(payload.logger.warn).toHaveBeenCalledWith("[mail] outbound delivery alert", expect.objectContaining({
      severity: "warning",
      reason: "repeated_mail_failures",
      flow: "forms.tenant_notification",
      tenant: 42,
      failuresInWindow: 3,
      windowMinutes: 15,
      retryState: "retryable",
    }))
    expect(payload.update).toHaveBeenCalledWith({
      collection: "operational-alerts",
      id: 123,
      data: expect.objectContaining({
        severity: "warning",
        message: "Repeated outbound mail failures for forms.tenant_notification",
        occurrenceCount: 3,
        lastSeenAt: "2026-07-01T12:15:00.000Z",
      }),
      depth: 0,
      overrideAccess: true,
    })
    expect(JSON.stringify(payload.logger.warn.mock.calls)).not.toContain("New form submission")
    expect(JSON.stringify(payload.logger.warn.mock.calls)).not.toContain("Stored form body")
    expect(JSON.stringify(payload.update.mock.calls)).not.toContain("New form submission")
    expect(JSON.stringify(payload.update.mock.calls)).not.toContain("Stored form body")
  })

  it("classifies transient SMTP failures as retryable", async () => {
    const { normalizeProviderError } = await import("@/lib/email/sendEmail")

    expect(normalizeProviderError(Object.assign(new Error("421 temporary failure"), {
      responseCode: 421,
      response: "421 temporary failure",
    }))).toMatchObject({
      providerErrorCode: "421",
      retryState: "retryable",
    })
    expect(normalizeProviderError(Object.assign(new Error("socket timed out"), {
      code: "ETIMEDOUT",
    }))).toMatchObject({
      providerErrorCode: "ETIMEDOUT",
      retryState: "retryable",
    })
  })

  it("redacts secret-shaped provider error text before logging", async () => {
    const { normalizeProviderError } = await import("@/lib/email/sendEmail")

    const normalized = normalizeProviderError(Object.assign(new Error("Provider rejected Bearer cf-secret api_token=cf-secret"), {
      response: "Provider rejected Bearer cf-secret api_token=cf-secret",
    }))

    expect(normalized.providerErrorMessage).toContain("Bearer [redacted]")
    expect(normalized.providerErrorMessage).toContain("api_token=[redacted]")
    expect(normalized.providerErrorMessage).not.toContain("cf-secret")
  })
})

function mockProvider(result?: { providerMessageId?: string }, error?: unknown): MailTransportProvider & { send: ReturnType<typeof vi.fn> } {
  return {
    provider: "cloudflare-smtp",
    send: vi.fn(async () => {
      if (error) throw error
      return {
        provider: "cloudflare-smtp",
        ...result,
      }
    }),
  }
}

function mockPayload(options: { totalDocs?: number } = {}) {
  return {
    create: vi.fn(async () => ({})),
    find: vi.fn(async (args: { collection: string }) => {
      if (args.collection === "operational-alerts" && options.totalDocs != null) {
        return { docs: [{ id: 123, occurrenceCount: 2 }], totalDocs: 1 }
      }
      return { docs: [], totalDocs: options.totalDocs ?? 1 }
    }),
    update: vi.fn(async () => ({})),
    logger: { warn: vi.fn(), error: vi.fn() },
  }
}
