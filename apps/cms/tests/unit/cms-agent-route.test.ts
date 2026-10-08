import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
  },
  runExistingSiteTurn: vi.fn(),
  streamExistingSiteTurn: vi.fn(),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/agent/siteEditorAgent", () => ({
  runExistingSiteTurn: mocks.runExistingSiteTurn,
  streamExistingSiteTurn: mocks.streamExistingSiteTurn,
  encodeSiteEditorSse: (event: unknown) => `data: ${JSON.stringify(event)}\n\n`,
}))

import { POST } from "@/app/(payload)/api/cms/agent/route"

const req = (body: unknown, accept?: string) =>
  new NextRequest("https://admin.siteinabox.nl/api/cms/agent", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(accept ? { accept } : {}),
    },
  })

describe("cms agent route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.find.mockResolvedValue({ docs: [{ id: 7, slug: "fixture-care" }] })
    mocks.runExistingSiteTurn.mockResolvedValue({
      text: "Thema gezet.",
      applied: true,
      regenerate: false,
      snapshot: { theme: null, page: null, chrome: {}, contact: {}, appointmentsEnabled: false },
    })
  })

  it("rejects unauthenticated callers", async () => {
    mocks.payload.auth.mockResolvedValue({ user: null })
    const res = await POST(req({ message: "Maak het thema groen en donker.", tenantSlug: "fixture-care" }))
    expect(res.status).toBe(403)
    expect(mocks.runExistingSiteTurn).not.toHaveBeenCalled()
  })

  it("rejects viewers", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 4, role: "viewer", tenants: [{ tenant: 7 }] },
    })
    const res = await POST(req({ message: "Maak het thema groen en donker.", tenantSlug: "fixture-care" }))
    expect(res.status).toBe(403)
    expect(mocks.runExistingSiteTurn).not.toHaveBeenCalled()
  })

  for (const role of ["owner", "editor"]) {
    for (const accept of ["application/json", "text/event-stream"]) {
      it(`denies unsupported customer AI for ${role} via ${accept}`, async () => {
        mocks.payload.auth.mockResolvedValue({ user: { id: 2, role, tenants: [{ tenant: 7 }] } })
        const res = await POST(req({ message: "Change my website", tenantSlug: "fixture-care" }, accept))
        expect(res.status).toBe(403)
        expect(mocks.runExistingSiteTurn).not.toHaveBeenCalled()
        expect(mocks.streamExistingSiteTurn).not.toHaveBeenCalled()
        expect(mocks.payload.find).not.toHaveBeenCalled()
      })
    }
  }

  it("preserves the explicitly trusted super-admin SSE editor", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "super-admin", tenants: [] },
    })
    mocks.streamExistingSiteTurn.mockImplementation(async function* () {
      yield { type: "delta", text: "Ik " }
      yield { type: "delta", text: "pas het aan." }
      yield {
        type: "done",
        result: {
          text: "Ik pas het aan.",
          applied: true,
          regenerate: false,
          snapshot: { theme: { appearance: { mode: "dark" } }, page: null },
        },
      }
    })
    const res = await POST(req({
      message: "Maak de diensten concreter.",
      tenantSlug: "fixture-care",
    }, "text/event-stream"))
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/)
    const body = await res.text()
    expect(body).toContain("\"type\":\"delta\"")
    expect(body).toContain("\"type\":\"done\"")
    expect(mocks.runExistingSiteTurn).not.toHaveBeenCalled()
    expect(mocks.streamExistingSiteTurn).toHaveBeenCalled()
  })
})
