import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sourceCheckoutEnabled: vi.fn(() => true),
  inspectPublicEvidence: vi.fn(),
  createAuthorization: vi.fn(),
  authorizationContext: vi.fn(),
  completeAuthorization: vi.fn(),
  requireCheckoutContext: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: mocks.getPayload }))
vi.mock("@/lib/domains/migrationCheckout", () => ({
  inspectExistingDomainPublicEvidence: mocks.inspectPublicEvidence,
}))
vi.mock("@/lib/domains/cloudflareSourceOAuth", () => ({
  cloudflareSourceCheckoutEnabled: mocks.sourceCheckoutEnabled,
  createCloudflareSourceAuthorization: mocks.createAuthorization,
  cloudflareSourceAuthorizationContext: mocks.authorizationContext,
  completeCloudflareSourceAuthorization: mocks.completeAuthorization,
  cloudflareOAuthCookieName: (state: string) =>
    `siab_cf_source_${state.slice(0, 12)}`,
}))
vi.mock(
  "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext",
  () => ({
    requirePreviewCheckoutContext: mocks.requireCheckoutContext,
  }),
)

const checkoutContext = {
  payload: { marker: "payload" },
  run: { id: 50 },
  tenant: { id: 10 },
  clientSlug: "example",
  customerEmail: "customer@example.com",
}

describe("Cloudflare source OAuth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sourceCheckoutEnabled.mockReturnValue(true)
    mocks.requireCheckoutContext.mockResolvedValue(checkoutContext)
    mocks.inspectPublicEvidence.mockResolvedValue({
      probableDnsProvider: "cloudflare",
    })
    mocks.createAuthorization.mockResolvedValue({
      authorizationUrl:
        "https://dash.cloudflare.com/oauth2/auth?state=opaque-state",
      browserBinding: "browser-binding",
      cookieName: "siab_cf_source_opaque",
    })
    mocks.getPayload.mockResolvedValue(checkoutContext.payload)
    mocks.authorizationContext.mockResolvedValue({ clientSlug: "example" })
    mocks.completeAuthorization.mockResolvedValue({
      authorizationKey: "opaque-authorization",
      clientSlug: "example",
      domain: "example.nl",
    })
  })

  it("starts only a bound Cloudflare source grant and sets a protected correlation cookie", async () => {
    const { POST } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/start/route"
    )
    const response = await POST(new Request(
      "https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/start",
      {
        method: "POST",
        headers: {
          host: "preview.siteinabox.nl",
          "x-forwarded-host": "preview.siteinabox.nl",
          origin: "https://preview.siteinabox.nl",
        },
        body: new URLSearchParams({
          clientSlug: "example",
          domain: "example.nl",
        }),
      },
    ))

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://dash.cloudflare.com/oauth2/auth?state=opaque-state",
    )
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("siab_cf_source_opaque=browser-binding")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=lax")
    expect(cookie).toContain(
      "Path=/api/domain-migration-source/cloudflare/callback",
    )
    expect(mocks.createAuthorization).toHaveBeenCalledWith(
      checkoutContext.payload,
      expect.objectContaining({
        generationRunId: 50,
        tenantId: "10",
        clientSlug: "example",
        customerEmail: "customer@example.com",
        domain: "example.nl",
      }),
    )
  })

  it("fails closed when disabled and does not authorize a provider mismatch", async () => {
    const { POST } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/start/route"
    )
    mocks.sourceCheckoutEnabled.mockReturnValue(false)
    const request = () => new Request(
      "https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/start",
      {
        method: "POST",
        headers: {
          host: "preview.siteinabox.nl",
          "x-forwarded-host": "preview.siteinabox.nl",
          origin: "https://preview.siteinabox.nl",
        },
        body: new URLSearchParams({
          clientSlug: "example",
          domain: "example.nl",
        }),
      },
    )
    const disabled = await POST(request())
    expect(disabled.status).toBe(404)

    mocks.sourceCheckoutEnabled.mockReturnValue(true)
    mocks.inspectPublicEvidence.mockResolvedValue({
      probableDnsProvider: "other",
    })
    const mismatch = await POST(request())
    expect(mismatch.status).toBe(303)
    expect(responsePath(mismatch)).toBe(
      "/example/checkout?cloudflareSource=provider-mismatch",
    )
    expect(mocks.createAuthorization).not.toHaveBeenCalled()
  })

  it("completes the callback with an opaque handle and clears correlation state", async () => {
    const { GET } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/callback/route"
    )
    const state = "a".repeat(43)
    const response = await GET(new Request(
      `https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback?state=${state}&code=one-time-code`,
      {
        headers: {
          host: "preview.siteinabox.nl",
          "x-forwarded-host": "preview.siteinabox.nl",
          cookie: `siab_cf_source_${state.slice(0, 12)}=browser-binding`,
        },
      },
    ))

    expect(response.status).toBe(303)
    expect(responsePath(response)).toBe(
      "/example/checkout?cloudflareSource=opaque-authorization",
    )
    expect(mocks.completeAuthorization).toHaveBeenCalledWith(
      checkoutContext.payload,
      expect.objectContaining({
        state,
        code: "one-time-code",
        browserBinding: "browser-binding",
        context: {
          generationRunId: 50,
          tenantId: "10",
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
      }),
    )
    expect(response.headers.get("set-cookie")).toMatch(
      /siab_cf_source_aaaaaaaaaaaa=.*Max-Age=0/i,
    )
    expect(response.headers.get("set-cookie")).toContain(
      "Path=/api/domain-migration-source/cloudflare/callback",
    )
  })

  it("rejects unknown state before session or provider exchange", async () => {
    const { GET } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/callback/route"
    )
    mocks.authorizationContext.mockResolvedValue(null)
    const response = await GET(new Request(
      `https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback?state=${"a".repeat(43)}&code=code`,
      {
        headers: {
          host: "preview.siteinabox.nl",
          "x-forwarded-host": "preview.siteinabox.nl",
        },
      },
    ))

    expect(response.status).toBe(400)
    expect(mocks.completeAuthorization).not.toHaveBeenCalled()
  })

  it("rejects host disagreement and missing or cross-site OAuth start origins", async () => {
    const { POST } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/start/route"
    )
    const request = (headers: Record<string, string>) => new Request(
      "https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/start",
      {
        method: "POST",
        headers,
        body: new URLSearchParams({
          clientSlug: "example",
          domain: "example.nl",
        }),
      },
    )

    expect((await POST(request({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "attacker.example",
      origin: "https://attacker.example",
    }))).status).toBe(404)
    expect((await POST(request({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl",
    }))).status).toBe(403)
    expect((await POST(request({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl",
      origin: "https://attacker.example",
    }))).status).toBe(403)
    expect(mocks.createAuthorization).not.toHaveBeenCalled()
  })

  it("blocks callback work when the complete source gate is disabled", async () => {
    const { GET } = await import(
      "@/app/(payload)/api/domain-migration-source/cloudflare/callback/route"
    )
    mocks.sourceCheckoutEnabled.mockReturnValue(false)
    const response = await GET(new Request(
      `https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback?state=${"a".repeat(43)}&code=code`,
      {
        headers: {
          host: "preview.siteinabox.nl",
          "x-forwarded-host": "preview.siteinabox.nl",
        },
      },
    ))

    expect(response.status).toBe(404)
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.completeAuthorization).not.toHaveBeenCalled()
  })
})

const responsePath = (response: Response): string => {
  const location = response.headers.get("location")
  if (!location) throw new Error("Expected redirect location.")
  const url = new URL(location)
  return `${url.pathname}${url.search}`
}
