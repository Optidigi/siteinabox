import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(async () => ({
    toString(): string {
      return ""
    },
  })),
  notFound: vi.fn(() => {
    throw new Error("not_found")
  }),
  getPayload: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))
vi.mock("payload", () => ({ getPayload: mocks.getPayload }))
vi.mock("@/payload.config", () => ({ default: {} }))

import { getSiabContext, UnauthenticatedSiabError } from "@/lib/context"

describe("tenant control-plane context", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headers.mockResolvedValue(new Headers({
      "x-siab-mode": "platform",
    }))
  })

  it("keeps the authenticated control plane available during billing suspension", async () => {
    const tenant = { id: 12, domain: "example.nl", status: "suspended" }
    const user = {
      id: 4,
      role: "owner",
      tenants: [{ tenant: 12 }],
    }
    mocks.getPayload.mockResolvedValue({
      auth: vi.fn(async () => ({ user })),
      findByID: vi.fn(async () => tenant),
    })

    await expect(getSiabContext()).resolves.toEqual({
      mode: "tenant",
      tenant,
    })
  })

  it("resolves super-admin membership on the platform host", async () => {
    mocks.getPayload.mockResolvedValue({
      auth: vi.fn(async () => ({
        user: { id: 1, role: "super-admin", tenants: [] },
      })),
    })

    await expect(getSiabContext()).resolves.toEqual({
      mode: "super-admin",
      tenant: null,
    })
  })

  it("keeps archived tenants inaccessible", async () => {
    mocks.getPayload.mockResolvedValue({
      auth: vi.fn(async () => ({
        user: { id: 4, role: "owner", tenants: [{ tenant: 12 }] },
      })),
      findByID: vi.fn(async () => ({
        id: 12,
        domain: "example.nl",
        status: "archived",
      })),
    })

    const error = await getSiabContext().catch((caught) => caught)
    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(410)
  })

  it("rejects unauthenticated callers", async () => {
    mocks.getPayload.mockResolvedValue({
      auth: vi.fn(async () => ({ user: null })),
    })

    await expect(getSiabContext()).rejects.toBeInstanceOf(UnauthenticatedSiabError)
  })
})
