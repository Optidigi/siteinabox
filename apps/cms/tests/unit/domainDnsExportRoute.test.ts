import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exportDomainDnsPortability: vi.fn(),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
  })),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/domains/offboarding", () => ({
  exportDomainDnsPortability: mocks.exportDomainDnsPortability,
}))

import { GET } from "@/app/(payload)/api/domains/[managedDomainId]/dns-export/route"

const request = () =>
  new NextRequest("https://admin.example.nl/api/domains/10/dns-export")

const context = {
  params: Promise.resolve({ managedDomainId: "10" }),
}

describe("customer DNS portability export route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        email: "owner@example.test",
        role: "owner",
        tenants: [{ tenant: 7 }],
      },
    })
    mocks.exportDomainDnsPortability.mockResolvedValue({
      schemaVersion: 2,
      format: "siteinabox-dns-portability-v2",
      domain: "example.nl",
      exportedAt: "2026-07-29T18:00:00.000Z",
      authoritativeNameservers: [
        "ada.ns.cloudflare.com",
        "bob.ns.cloudflare.com",
      ],
      provider: "cloudflare",
      complete: true,
      dnssec: {
        parentStatus: "present",
        parentDsRecords: ["12345 13 2 ABCD"],
      },
      records: [
        {
          type: "MX",
          name: "example.nl",
          ttl: 3_600,
          priority: 10,
          target: "mail.example.net",
          proxied: false,
        },
        {
          type: "TXT",
          name: "selector._domainkey.example.nl",
          ttl: 300,
          content: "v=DKIM1; p=public-key",
          proxied: false,
        },
      ],
    })
  })

  it("returns an owner-scoped no-store attachment with preserved mail records", async () => {
    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="example.nl-dns-export.json"',
    )
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(await response.json()).toMatchObject({
      complete: true,
      records: expect.arrayContaining([
        expect.objectContaining({ type: "MX", target: "mail.example.net" }),
        expect.objectContaining({
          type: "TXT",
          name: "selector._domainkey.example.nl",
        }),
      ]),
    })
    expect(mocks.exportDomainDnsPortability).toHaveBeenCalledWith(
      expect.anything(),
      {
        managedDomainId: "10",
        actor: { email: "owner@example.test", tenantId: "7" },
      },
    )
  })

  it("rejects unauthenticated and non-owner callers", async () => {
    mocks.auth.mockResolvedValueOnce({ user: null })
    await expect(GET(request(), context)).resolves.toMatchObject({ status: 401 })

    mocks.auth.mockResolvedValueOnce({
      user: { email: "editor@example.test", role: "editor", tenants: [{ tenant: 7 }] },
    })
    await expect(GET(request(), context)).resolves.toMatchObject({ status: 403 })
    expect(mocks.exportDomainDnsPortability).not.toHaveBeenCalled()
  })

  it("does not leak a cross-tenant export", async () => {
    mocks.exportDomainDnsPortability.mockRejectedValueOnce(
      new Error("Domain offboarding requires the authenticated contracting customer."),
    )

    const response = await GET(request(), context)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ message: "DNS export unavailable" })
  })

  it("fails closed when live provider reads are unavailable", async () => {
    mocks.exportDomainDnsPortability.mockRejectedValueOnce(
      new Error("Commerce release stage does not allow provider reads."),
    )

    const response = await GET(request(), context)

    expect(response.status).toBe(409)
    expect(response.headers.get("content-disposition")).toBeNull()
  })
})
