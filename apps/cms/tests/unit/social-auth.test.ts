import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveBaseURL } from "better-auth"

vi.mock("@/payload.config", () => ({ default: {} }))

const fakeFind = vi.fn()

vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ find: fakeFind })),
  }
})

import { getEnabledSocialAuthProviders } from "@/lib/socialAuth/providers"
import { buildCmsAuthHeaders, buildCmsAuthRequest, getBetterAuthBaseURL, getTrustedSocialAuthOrigins, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"
import { resolvePayloadUserForMagicLink, resolvePayloadUserForSocialSignup } from "@/lib/socialAuth/payloadUser"

describe("social auth provider configuration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.MICROSOFT_CLIENT_ID
    delete process.env.MICROSOFT_CLIENT_SECRET
    delete process.env.APPLE_CLIENT_ID
    delete process.env.APPLE_CLIENT_SECRET
  })

  it("enables only providers with a client id and secret", () => {
    process.env.GOOGLE_CLIENT_ID = "google-id"
    process.env.GOOGLE_CLIENT_SECRET = "google-secret"
    process.env.APPLE_CLIENT_ID = "apple-id"

    expect(getEnabledSocialAuthProviders()).toEqual(["google"])
  })
})

describe("Payload social auth user resolution", () => {
  beforeEach(() => {
    fakeFind.mockReset()
  })

  it("requires a verified provider email", async () => {
    await expect(
      resolvePayloadUserForSocialSignup({ email: "owner@example.com", emailVerified: false }),
    ).rejects.toThrow("verified email")
    expect(fakeFind).not.toHaveBeenCalled()
  })

  it("resolves exactly one invited Payload user by normalized email", async () => {
    const payloadUser = {
      id: 42,
      email: "owner@example.com",
      role: "owner",
      tenants: [{ tenant: 1 }],
    }
    fakeFind.mockResolvedValueOnce({ totalDocs: 1, docs: [payloadUser] })

    await expect(
      resolvePayloadUserForSocialSignup({ email: " OWNER@EXAMPLE.COM ", emailVerified: true }),
    ).resolves.toBe(payloadUser)

    expect(fakeFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        where: { email: { equals: "owner@example.com" } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      }),
    )
  })

  it("rejects missing or ambiguous Payload users", async () => {
    fakeFind.mockResolvedValueOnce({ totalDocs: 2, docs: [{}, {}] })

    await expect(
      resolvePayloadUserForSocialSignup({ email: "owner@example.com", emailVerified: true }),
    ).rejects.toThrow("No invited CMS user")
  })

  it("rejects users that violate role/tenant invariants", async () => {
    fakeFind.mockResolvedValueOnce({
      totalDocs: 1,
      docs: [{ id: 1, email: "owner@example.com", role: "owner", tenants: [] }],
    })

    await expect(
      resolvePayloadUserForSocialSignup({ email: "owner@example.com", emailVerified: true }),
    ).rejects.toThrow("not eligible")
  })

  it("allows magic links only for existing eligible Payload users", async () => {
    const payloadUser = {
      id: 7,
      email: "editor@example.com",
      role: "editor",
      tenants: [{ tenant: 1 }],
    }
    fakeFind.mockResolvedValueOnce({ totalDocs: 1, docs: [payloadUser] })

    await expect(resolvePayloadUserForMagicLink(" EDITOR@EXAMPLE.COM ")).resolves.toBe(payloadUser)
    expect(fakeFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        where: { email: { equals: "editor@example.com" } },
      }),
    )
  })
})

describe("social auth host validation", () => {
  beforeEach(() => {
    fakeFind.mockReset()
    delete process.env.BETTER_AUTH_ALLOWED_HOSTS
    delete process.env.BETTER_AUTH_URL
    delete process.env.SITE_URL
    process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN = "siteinabox.nl"
  })

  it("allows the configured super-admin admin host", async () => {
    const req = new Request("https://admin.siteinabox.nl/api/auth/sign-in/social", {
      headers: { host: "admin.siteinabox.nl" },
    })

    await expect(isAllowedSocialAuthHost(req)).resolves.toBe(true)
    expect(fakeFind).not.toHaveBeenCalled()
  })

  it("configures Better Auth dynamic base URL for generated admin hosts", () => {
    process.env.BETTER_AUTH_ALLOWED_HOSTS = "preview.example.com, admin.extra.test"
    process.env.SITE_URL = "https://admin.siteinabox.nl"

    expect(getBetterAuthBaseURL()).toEqual({
      allowedHosts: ["admin.*", "preview.example.com", "admin.extra.test"],
      protocol: "https",
      fallback: "https://admin.siteinabox.nl",
    })
  })

  it("allows localhost dynamic auth bases only in development", () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "development")
    expect(getBetterAuthBaseURL()).toEqual({
      allowedHosts: ["admin.*", "localhost:*", "127.0.0.1:*"],
      protocol: "http",
    })
    vi.stubEnv("NODE_ENV", originalNodeEnv)
  })

  it("allows generated tenant admin hosts from Payload tenant domains", async () => {
    fakeFind
      .mockResolvedValueOnce({ docs: [{ id: 7, domain: "ami-care.nl", status: "active" }] })
      .mockResolvedValueOnce({ docs: [{ id: 7, domain: "ami-care.nl", status: "active" }] })
    const req = new Request("https://admin.ami-care.nl/api/auth/sign-in/social", {
      headers: { host: "admin.ami-care.nl" },
    })

    await expect(isAllowedSocialAuthHost(req)).resolves.toBe(true)
    await expect(getTrustedSocialAuthOrigins(req)).resolves.toEqual(["https://admin.ami-care.nl"])
    expect(fakeFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "tenants",
        where: { domain: { equals: "ami-care.nl" } },
      }),
    )
  })

  it("keeps tenant admin origins first while also trusting the canonical CMS fallback", async () => {
    process.env.SITE_URL = "https://admin.siteinabox.nl"
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 7, domain: "ami-care.nl", status: "active" }] })
    const req = new Request("https://admin.ami-care.nl/api/auth/sign-in/magic-link", {
      headers: { host: "admin.ami-care.nl" },
    })

    await expect(getTrustedSocialAuthOrigins(req)).resolves.toEqual([
      "https://admin.ami-care.nl",
      "https://admin.siteinabox.nl",
    ])
  })

  it("rejects unknown tenant admin hosts", async () => {
    fakeFind.mockResolvedValueOnce({ docs: [] })
    const req = new Request("https://admin.unknown.example/api/auth/sign-in/social", {
      headers: { host: "admin.unknown.example" },
    })

    await expect(isAllowedSocialAuthHost(req)).resolves.toBe(false)
  })

  it("rejects suspended tenant admin hosts", async () => {
    fakeFind.mockResolvedValueOnce({
      docs: [{ id: 7, domain: "ami-care.nl", status: "suspended" }],
    })
    const req = new Request("https://admin.ami-care.nl/api/auth/sign-in/social", {
      headers: { host: "admin.ami-care.nl" },
    })

    await expect(isAllowedSocialAuthHost(req)).resolves.toBe(false)
  })

  it("trusts the configured canonical Better Auth origin without a request", async () => {
    process.env.BETTER_AUTH_URL = "https://admin.siteinabox.nl/"

    await expect(getTrustedSocialAuthOrigins()).resolves.toEqual(["https://admin.siteinabox.nl"])
  })

  it("normalizes internal direct auth headers to the trusted request admin host before Better Auth generates URLs", () => {
    process.env.SITE_URL = "https://admin.siteinabox.nl"
    const next = buildCmsAuthHeaders(new Headers({
      host: "0.0.0.0:3000",
      "x-forwarded-host": "admin.siteinabox.nl",
      "x-forwarded-proto": "https",
    }))

    expect(next.get("host")).toBe("admin.siteinabox.nl")
    expect(next.get("x-forwarded-host")).toBe("admin.siteinabox.nl")
    expect(next.get("x-forwarded-proto")).toBe("https")
    expect(resolveBaseURL(getBetterAuthBaseURL(), "/api/auth", next, false, true)).toBe(
      "https://admin.siteinabox.nl/api/auth",
    )
  })

  it("derives tenant server-action auth headers from middleware tenant context when host is internal", () => {
    const next = buildCmsAuthHeaders(new Headers({
      host: "0.0.0.0:3000",
      "x-siab-host": "ami-care.nl",
    }))

    expect(next.get("host")).toBe("admin.ami-care.nl")
    expect(next.get("x-forwarded-host")).toBe("admin.ami-care.nl")
    expect(resolveBaseURL(getBetterAuthBaseURL(), "/api/auth", next, false, true)).toBe(
      "https://admin.ami-care.nl/api/auth",
    )
  })

  it("builds a fresh auth request without cloning framework request internals", async () => {
    const request = new Request("https://0.0.0.0:3000/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        host: "0.0.0.0:3000",
        "content-type": "application/json",
        "x-forwarded-host": "admin.siteinabox.nl",
      },
      body: JSON.stringify({ email: "admin@example.com" }),
    })

    const next = buildCmsAuthRequest(request)

    expect(next.url).toBe("https://0.0.0.0:3000/api/auth/sign-in/magic-link")
    expect(next.method).toBe("POST")
    expect(next.headers.get("host")).toBe("admin.siteinabox.nl")
    expect(next.headers.get("x-forwarded-host")).toBe("admin.siteinabox.nl")
    await expect(next.json()).resolves.toEqual({ email: "admin@example.com" })
  })
})
