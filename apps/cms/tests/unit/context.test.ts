import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not_found")
  }),
  getPayload: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: mocks.headers }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))
vi.mock("payload", () => ({ getPayload: mocks.getPayload }))
vi.mock("@/payload.config", () => ({ default: {} }))

import { getSiabContext } from "@/lib/context"

describe("tenant control-plane context", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headers.mockResolvedValue(new Headers({
      "x-siab-mode": "tenant",
      "x-siab-host": "example.nl",
    }))
  })

  it("keeps the authenticated control plane available during billing suspension", async () => {
    const tenant = { id: 12, domain: "example.nl", status: "suspended" }
    mocks.getPayload.mockResolvedValue({
      find: vi.fn(async () => ({ docs: [tenant] })),
    })

    await expect(getSiabContext()).resolves.toEqual({
      mode: "tenant",
      tenant,
    })
  })

  it("keeps archived tenants inaccessible", async () => {
    mocks.getPayload.mockResolvedValue({
      find: vi.fn(async () => ({
        docs: [{ id: 12, domain: "example.nl", status: "archived" }],
      })),
    })

    const error = await getSiabContext().catch((caught) => caught)
    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(410)
  })
})
