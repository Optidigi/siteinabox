import { afterEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { createCloudflareRestProvider, createNodemailerProvider } from "@/lib/email/sendEmail"
import { MailSendError, sendEmail } from "@/lib/email/sendEmail"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { magicLink } from "better-auth/plugins"

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const input = { from: "sender@example.test", to: "recipient@example.test", subject: "Fixture", html: "<p>Fixture</p>" }

describe("mail provider acceptance evidence", () => {
  it("does not infer SMTP acceptance from an ID without recipient evidence", async () => {
    const provider = createNodemailerProvider({ sendMail: vi.fn().mockResolvedValue({ messageId: "fixture-id", accepted: 42 }) })
    await expect(provider.send(input)).rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE" })
  })

  it("preserves an explicit SMTP recipient rejection", async () => {
    const provider = createNodemailerProvider({ sendMail: vi.fn().mockResolvedValue({ messageId: "fixture-id", accepted: [], rejected: [input.to] }) })
    await expect(provider.send(input)).rejects.toMatchObject({ code: "E_SMTP_RECIPIENT_REJECTED" })
  })

  it("does not retry a partial SMTP acceptance as a wholly unsent message", async () => {
    const provider = createNodemailerProvider({ sendMail: vi.fn().mockResolvedValue({ messageId: "fixture-id", accepted: [input.to], rejected: ["other@example.test"] }) })
    await expect(provider.send({ ...input, to: [input.to, "other@example.test"] })).rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE", providerMessageId: "fixture-id" })
  })

  it("keeps malformed successful REST writes indeterminate with payload-free diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: { message_id: 42 } })))
    const provider = createCloudflareRestProvider({ accountId: "fixture-account", token: "synthetic-mail-token" })
    await expect(provider.send(input)).rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE" })
  })

  it("matches SMTP receipts to normalized mailboxes while retaining display headers", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "fixture-id", accepted: [{ address: "RECIPIENT@example.test" }], rejected: [] })
    const provider = createNodemailerProvider({ sendMail })
    const to = '"Fixture, Person" <recipient@example.test>'
    await expect(provider.send({ ...input, to })).resolves.toMatchObject({ providerMessageId: "fixture-id" })
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to }))
  })

  it.each([408, 503])("keeps HTTP %s write outcomes indeterminate", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, errors: [{ code: 123, message: "private provider content" }] }, { status })))
    await expect(createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" }).send(input)).rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE" })
  })

  it.each([200, 400, 429].flatMap((status) => ["delivered", "queued"].map((field) => ({ status, field }))))(
    "keeps unsuccessful HTTP $status with $field evidence indeterminate", async ({ status, field }) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, result: { [field]: [input.to] } }, { status })))
      const provider = createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" })
      await expect(sendEmail(input, { provider })).rejects.toMatchObject({
        normalized: { providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", retryState: "manual_review" },
      })
    },
  )

  it("retains retryable REST throttling without conflicting acceptance evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false }, { status: 429 })))
    const provider = createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" })
    await expect(sendEmail(input, { provider })).rejects.toMatchObject({
      normalized: { retryState: "retryable" },
    })
  })

  it("never reports suppressed recipients as accepted just because an ID exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: { message_id: "fixture", suppressed_recipients: [input.to], delivered: [], queued: [], permanent_bounces: [] } })))
    await expect(createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" }).send(input)).rejects.toMatchObject({ code: "E_CLOUDFLARE_SUPPRESSED" })
  })

  it.each([
    { delivered: [input.to] },
    { queued: [input.to] },
    { permanent_bounces: [input.to] },
    { suppressed_recipients: [input.to] },
  ].flatMap((disposition) => [
    { ...disposition, message_id: "fixture-partial" },
    { ...disposition, message_id: undefined },
  ]))("keeps incomplete REST recipient evidence indeterminate: %j", async (disposition) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: {
      delivered: [], queued: [], permanent_bounces: [], suppressed_recipients: [], ...disposition,
    } })))
    const provider = createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" })
    await expect(provider.send({ ...input, to: [input.to, "other@example.test"] })).rejects.toMatchObject({
      code: "E_PROVIDER_WRITE_INDETERMINATE",
      ...(disposition.message_id ? { providerMessageId: disposition.message_id } : {}),
    })
  })

  it.each(["delivered", "queued", "permanent_bounces", "suppressed_recipients"].flatMap((field) =>
    ["", " ", "not-a-mailbox", "recipient@example.test\n"].map((entry) => ({ field, entry })),
  ))("keeps malformed REST $field entries indeterminate: $entry", async ({ field, entry }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: {
      message_id: "fixture-malformed", delivered: [], queued: [], permanent_bounces: [], [field]: [entry],
    } })))
    await expect(createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" }).send(input))
      .rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE", providerMessageId: "fixture-malformed" })
  })

  it.each([
    { delivered: [], queued: [] },
    { delivered: [input.to], queued: ["other@example.test"] },
  ])("retains asynchronous and complete REST acceptance: %j", async (disposition) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: {
      message_id: "fixture-complete", permanent_bounces: [], ...disposition,
    } })))
    await expect(createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" })
      .send({ ...input, to: [input.to, "other@example.test"] })).resolves.toMatchObject({ providerMessageId: "fixture-complete" })
  })

  it("retains definite rejection when every REST recipient is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: {
      message_id: "fixture-rejected", delivered: [], queued: [], permanent_bounces: [input.to], suppressed_recipients: ["other@example.test"],
    } })))
    await expect(createCloudflareRestProvider({ accountId: "fixture", token: "synthetic-token" })
      .send({ ...input, to: [input.to, "other@example.test"] })).rejects.toMatchObject({ code: "E_CLOUDFLARE_SUPPRESSED", providerMessageId: "fixture-rejected" })
  })

  it("retains indeterminate classification across the actual account-link SDK API", async () => {
    const error = new MailSendError({ provider: "cloudflare-rest", providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", providerErrorMessage: "Acceptance unknown; reconcile before retry", retryState: "manual_review" })
    const auth = betterAuth({ baseURL: "https://admin.siteinabox.nl", secret: "synthetic-mail-boundary-secret-over-32-chars", database: memoryAdapter({ user: [], session: [], account: [], verification: [] }), telemetry: { enabled: false }, plugins: [magicLink({ sendMagicLink: async () => { throw error } })] })
    await expect(auth.api.signInMagicLink({ headers: new Headers({ host: "admin.siteinabox.nl" }), body: { email: input.to } })).rejects.toBe(error)
  })

  it("does not retain a raw provider cause containing a mail credential", async () => {
    vi.stubEnv("CLOUDFLARE_EMAIL_SMTP_TOKEN", "synthetic-private-credential")
    const raw = Object.assign(new Error("Rejected synthetic-private-credential"), { code: "EAUTH", response: "Rejected synthetic-private-credential" })
    const error = await sendEmail(input, { provider: { provider: "cloudflare-smtp", send: async () => { throw raw } } }).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(MailSendError)
    expect(inspect(error)).not.toContain("synthetic-private-credential")
  })
})
