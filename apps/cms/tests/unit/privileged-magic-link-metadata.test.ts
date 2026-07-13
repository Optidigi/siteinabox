import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  resolvePayloadUserForMagicLink: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("payload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("payload")>()),
  getPayload: mocks.getPayload,
}))
vi.mock("@/lib/email/sendEmail", () => ({
  getPlatformMailSender: () => "noreply@siteinabox.nl",
  sendEmail: mocks.sendEmail,
}))
vi.mock("@/lib/socialAuth/payloadUser", () => ({
  resolvePayloadUserForMagicLink: mocks.resolvePayloadUserForMagicLink,
}))

import {
  signPrivilegedMagicLinkMetadata,
  verifyPrivilegedMagicLinkMetadata,
} from "@/lib/auth/privilegedMagicLinkMetadata"
import { sendCmsMagicLinkEmail } from "@/lib/auth/sendCmsMagicLinkEmail"

const secret = "test-privileged-metadata-secret"
const now = new Date("2026-07-13T12:00:00.000Z")

describe("privileged CMS magic-link metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BETTER_AUTH_SECRET = secret
    mocks.getPayload.mockResolvedValue({ create: vi.fn() })
    mocks.resolvePayloadUserForMagicLink.mockResolvedValue({ id: 1 })
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
  })

  it("is purpose-bound, claim-bound, recipient-bound, short-lived, and timing-safe verifiable", () => {
    const metadata = signPrivilegedMagicLinkMetadata("user_invite", {
      recipientEmail: "member@example.com",
      tenantId: "1",
      tenantName: "Example",
      recipientName: "Member",
      role: "viewer",
      adminUrl: "https://admin.example.nl",
    }, { now, secret })

    expect(verifyPrivilegedMagicLinkMetadata(metadata, "user_invite", { now, secret })).toBe(true)
    expect(verifyPrivilegedMagicLinkMetadata(metadata, "site_live_handoff", { now, secret })).toBe(false)
    expect(verifyPrivilegedMagicLinkMetadata({ ...metadata, role: "owner" }, "user_invite", { now, secret })).toBe(false)
    expect(verifyPrivilegedMagicLinkMetadata({ ...metadata, _siabPrivilegedSignature: "not-base64url" }, "user_invite", { now, secret })).toBe(false)
    expect(verifyPrivilegedMagicLinkMetadata(metadata, "user_invite", {
      now: new Date(now.getTime() + 61_000),
      secret,
    })).toBe(false)
  })

  it("executes a valid internally signed invitation through the Cloudflare-backed mail service", async () => {
    const metadata = signPrivilegedMagicLinkMetadata("user_invite", {
      recipientEmail: "member@example.com",
      tenantId: "1",
      tenantName: "Example",
      recipientName: "Member",
      role: "viewer",
      adminUrl: "https://admin.example.nl",
    })

    await sendCmsMagicLinkEmail({
      email: "member@example.com",
      url: "https://admin.example.nl/api/auth/magic-link/verify?token=secret",
      metadata,
    })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "member@example.com",
      subject: "Je bent uitgenodigd voor Example",
      intent: "auth.magic_link",
      tenant: 1,
    }))
  })

  it("executes a valid internally signed live handoff through the Cloudflare-backed mail service", async () => {
    const metadata = signPrivilegedMagicLinkMetadata("site_live_handoff", {
      recipientEmail: "owner@example.com",
      tenantId: "2",
      siteUrl: "https://example.nl",
      adminUrl: "https://admin.example.nl",
    })

    await sendCmsMagicLinkEmail({
      email: "owner@example.com",
      url: "https://admin.example.nl/api/auth/magic-link/verify?token=secret",
      metadata,
    })

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.com",
      subject: "Je Site in a Box-website staat live",
      intent: "site.live_notice",
      tenant: 2,
    }))
  })

  it.each([
    ["unsigned invitation", {
      intent: "user_invite",
      recipientEmail: "member@example.com",
      tenantId: "1",
      tenantName: "Forged tenant",
      recipientName: "Member",
      role: "owner",
      adminUrl: "https://admin.example.nl",
    }],
    ["unsigned live handoff", {
      intent: "site_live_handoff",
      recipientEmail: "member@example.com",
      tenantId: "1",
      siteUrl: "https://attacker.example",
      adminUrl: "https://admin.example.nl",
    }],
  ])("rejects %s metadata from the public endpoint without privileged content", async (_label, metadata) => {
    await expect(sendCmsMagicLinkEmail({
      email: "member@example.com",
      url: "https://admin.example.nl/api/auth/magic-link/verify?token=secret",
      metadata,
    })).rejects.toThrow("Unsigned or invalid privileged")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("rejects rebinding a signed envelope to a different recipient or admin host", async () => {
    const metadata = signPrivilegedMagicLinkMetadata("user_invite", {
      recipientEmail: "member@example.com",
      tenantId: "1",
      tenantName: "Example",
      recipientName: "Member",
      role: "viewer",
      adminUrl: "https://admin.example.nl",
    })

    await expect(sendCmsMagicLinkEmail({
      email: "other@example.com",
      url: "https://admin.example.nl/api/auth/magic-link/verify?token=secret",
      metadata,
    })).rejects.toThrow("Unsigned or invalid privileged")
    await expect(sendCmsMagicLinkEmail({
      email: "member@example.com",
      url: "https://admin.other.example/api/auth/magic-link/verify?token=secret",
      metadata,
    })).rejects.toThrow("Unsigned or invalid privileged")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("keeps ordinary unsigned login metadata on the generic auth.magic_link template", async () => {
    await sendCmsMagicLinkEmail({
      email: "member@example.com",
      url: "https://admin.example.nl/api/auth/magic-link/verify?token=secret",
      metadata: { arbitrary: "public" },
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "member@example.com",
      subject: "Log in bij Site in a Box",
      intent: "auth.magic_link",
    }))
  })
})
