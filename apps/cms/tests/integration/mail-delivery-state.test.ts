import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import { getTestPayload } from "./_helpers"
import { asMailLogPayload, sendEmail } from "@/lib/email/sendEmail"

describe("persisted indeterminate mail acceptance", () => {
  let payload: Payload
  beforeAll(async () => { payload = await getTestPayload() }, 120000)
  afterAll(async () => { await payload?.destroy() })

  it("stores manual-review evidence without content or an automatic second send", async () => {
    const send = vi.fn(async () => { throw Object.assign(new Error("SMTP connection lost after DATA"), { code: "ETIMEDOUT", command: "DATA" }) })
    await expect(sendEmail({ to: "mail-fixture@example.test", subject: "Private fixture subject", html: "<p>Private fixture body</p>", intent: "auth.magic_link", payload: asMailLogPayload(payload) }, { provider: { provider: "cloudflare-smtp", send } })).rejects.toMatchObject({ normalized: { retryState: "manual_review" } })
    expect(send).toHaveBeenCalledOnce()
    const logs = await payload.find({ collection: "mail-logs", where: { recipient: { equals: "mail-fixture@example.test" } }, overrideAccess: true })
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0]).toMatchObject({ status: "indeterminate", retryState: "manual_review", providerErrorCode: "ETIMEDOUT" })
    expect(JSON.stringify(logs.docs)).not.toMatch(/Private fixture/)
    const alerts = await payload.find({ collection: "operational-alerts", where: { source: { equals: "mail" } }, overrideAccess: true })
    expect(alerts.docs).toHaveLength(1)
    expect(JSON.stringify(alerts.docs)).not.toContain("mail-fixture@example.test")
  })
})
