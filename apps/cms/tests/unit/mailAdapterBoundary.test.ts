import { afterEach, describe, expect, it, vi } from "vitest"
import { createCloudflareRestProvider, createNodemailerProvider } from "@/lib/email/sendEmail"

afterEach(() => vi.unstubAllGlobals())
const input = { from: "sender@example.invalid", to: "recipient@example.invalid", subject: "Fixture", html: "Fixture" }
describe("mail adapter authority", () => {
  it("rejects malformed SMTP acceptance instead of asserting delivery", async () => {
    const provider = createNodemailerProvider({ sendMail: vi.fn().mockResolvedValue({ messageId: "id", accepted: 42 }) })
    await expect(provider.send(input)).rejects.toThrow()
  })
  it("does not claim success when SMTP rejects the requested recipient", async () => {
    const provider = createNodemailerProvider({ sendMail: vi.fn().mockResolvedValue({ messageId: "id", accepted: [], rejected: [input.to] }) })
    await expect(provider.send(input)).rejects.toThrow()
  })
  it("keeps malformed successful REST writes indeterminate with payload-free diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, result: { message_id: 42 } })))
    const provider = createCloudflareRestProvider({ accountId: "fixture", token: "fixture" })
    await expect(provider.send(input)).rejects.toMatchObject({ code: "E_PROVIDER_WRITE_INDETERMINATE" })
  })
})
