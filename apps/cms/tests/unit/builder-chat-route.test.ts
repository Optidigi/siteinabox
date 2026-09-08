import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isPreviewRequestAuthority: vi.fn(),
  hasUnvalidatedAuthSignal: vi.fn(),
  loadBuilderThread: vi.fn(),
  saveBuilderThread: vi.fn(),
  loadLatestActivePreviewGrant: vi.fn(),
  runBuilderTurn: vi.fn(),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/requestAuthority", () => ({
  isPreviewRequestAuthority: mocks.isPreviewRequestAuthority,
}))

vi.mock("@/access/authSignals", () => ({
  hasUnvalidatedAuthSignal: mocks.hasUnvalidatedAuthSignal,
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({})),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/builder/sessionStore", () => ({
  loadBuilderThread: mocks.loadBuilderThread,
  saveBuilderThread: mocks.saveBuilderThread,
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadLatestActivePreviewGrant: mocks.loadLatestActivePreviewGrant,
}))

vi.mock("@/lib/builder/runBuilderTurn", () => ({
  runBuilderTurn: mocks.runBuilderTurn,
}))

import { POST } from "@/app/(payload)/api/builder/chat/route"

const legal = { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false }

const thread = {
  displayName: "Anna",
  customerEmail: "anna@example.com",
  contactPhone: "",
  legal,
  facts: null,
  clientSlug: "tilburg-kapper",
  messages: [],
}

const chatReq = () =>
  new NextRequest("https://admin.siteinabox.nl/api/builder/chat", {
    method: "POST",
    body: JSON.stringify({ message: "Maak het thema groen en donker." }),
    headers: { "content-type": "application/json" },
  })

describe("builder chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPreviewRequestAuthority.mockReturnValue(true)
    mocks.hasUnvalidatedAuthSignal.mockReturnValue(false)
    mocks.loadBuilderThread.mockResolvedValue(thread)
    mocks.saveBuilderThread.mockImplementation(async (_payload: unknown, next: typeof thread) => next)
    mocks.runBuilderTurn.mockResolvedValue({
      ok: true,
      text: "Thema gezet.",
      facts: null,
      clientSlug: "tilburg-kapper",
      status: "maintaining",
      applied: true,
      previewSnapshot: { pageId: "1", page: {}, settings: {}, theme: null },
    })
  })

  it("rejects chat without a preview session", async () => {
    mocks.getSession.mockResolvedValue(null)
    const res = await POST(new NextRequest("https://admin.siteinabox.nl/api/builder/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard." }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(401)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
  })

  it("does not patch from a stored slug after the grant is revoked", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "anna@example.com" } })
    mocks.loadLatestActivePreviewGrant.mockResolvedValue(null)
    const res = await POST(chatReq())
    expect(res.status).toBe(403)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
  })

  it("pins maintainer writes to the grant tenant, not the thread slug", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "anna@example.com" } })
    mocks.loadLatestActivePreviewGrant.mockResolvedValue({
      clientSlug: "tilburg-kapper",
      tenant: 3,
    })
    const res = await POST(chatReq())
    expect(res.status).toBe(200)
    expect(mocks.runBuilderTurn).toHaveBeenCalledWith({}, expect.objectContaining({
      existingClientSlug: "tilburg-kapper",
      existingTenantId: 3,
      contactEmail: "anna@example.com",
    }))
    const saved = mocks.saveBuilderThread.mock.calls[0]?.[1] as {
      messages?: Array<{ role?: string; actions?: Array<{ id?: string; label?: string }> }>
    }
    expect(saved.messages?.some((entry) => (
      entry.role === "assistant"
      && entry.actions?.[0]?.id === "open-preview"
      && entry.actions?.[0]?.label === "Bekijk je site"
    ))).toBe(true)
    const body = await res.json() as { applied?: boolean; previewSnapshot?: { pageId?: string } }
    expect(body.applied).toBe(true)
    expect(body.previewSnapshot?.pageId).toBe("1")
  })
})
