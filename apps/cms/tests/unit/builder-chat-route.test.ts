import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), isPreviewRequestAuthority: vi.fn(), hasUnvalidatedAuthSignal: vi.fn(),
  loadBuilderThread: vi.fn(), loadLatestActivePreviewGrant: vi.fn(), runBuilderTurn: vi.fn(),
  eligible: vi.fn(), consumeIngress: vi.fn(), reserve: vi.fn(), claim: vi.fn(), settle: vi.fn(), fail: vi.fn(), assertActive: vi.fn(), dispose: vi.fn(),
}))
vi.mock("@/lib/auth/verifiedPreviewSession", () => ({ readVerifiedPreviewSession: mocks.getSession }))
vi.mock("@/lib/requestAuthority", () => ({ isPreviewRequestAuthority: mocks.isPreviewRequestAuthority }))
vi.mock("@/access/authSignals", () => ({ hasUnvalidatedAuthSignal: mocks.hasUnvalidatedAuthSignal }))
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("@/lib/builder/sessionStore", () => ({ loadBuilderThread: mocks.loadBuilderThread }))
vi.mock("@/lib/preview/previewAccess", () => ({ loadLatestActivePreviewGrant: mocks.loadLatestActivePreviewGrant }))
vi.mock("@/lib/builder/runBuilderTurn", () => ({ runBuilderTurn: mocks.runBuilderTurn }))
vi.mock("@/lib/builder/access", () => ({ assertBuilderAccountEligible: mocks.eligible }))
vi.mock("@/lib/builder/quota", async (original) => {
  const actual = await original<typeof import("@/lib/builder/quota")>()
  return { ...actual, BuilderQuotaService: class {
    reserve = (...args: unknown[]) => { mocks.eligible(); return mocks.reserve(...args) }
    consumeIngress = mocks.consumeIngress
    claim = mocks.claim; settle = mocks.settle; fail = mocks.fail
  } }
})
vi.mock("@/lib/builder/quotaExecution", () => ({ ReservedBuilderExecution: class { assertActive = mocks.assertActive; dispose = mocks.dispose } }))
import { POST } from "@/app/(payload)/api/builder/chat/route"
const legal = { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false }
const thread = { displayName: "Anna", customerEmail: "anna@example.com", contactPhone: "", legal, facts: null, clientSlug: "tilburg-kapper", messages: [] }
const operationId = "1173a72f-c975-4c48-a033-c79a1cc0a248"
const chatReq = (body: unknown = { operationId, message: "Maak het thema groen en donker." }) => new NextRequest("https://admin.siteinabox.nl/api/builder/chat", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const quota = { limit: 12, used: 0, reserved: 1, remaining: 11 }

describe("builder chat route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.isPreviewRequestAuthority.mockReturnValue(true)
    mocks.hasUnvalidatedAuthSignal.mockReturnValue(false)
    mocks.getSession.mockResolvedValue({ session: { id: "verified-fixture-session" }, user: { id: "verified-fixture-user", email: "anna@example.com", emailVerified: true } })
    mocks.consumeIngress.mockResolvedValue(true)
    mocks.loadBuilderThread.mockResolvedValue(thread)
    mocks.reserve.mockResolvedValue({ status: "reserved", quota, lease: { operationKey: "fixture", reservationToken: operationId, customerEmail: "anna@example.com", deadlineAt: new Date(Date.now() + 60000).toISOString() } })
    mocks.settle.mockResolvedValue({ ...quota, used: 1, reserved: 0 })
    mocks.runBuilderTurn.mockResolvedValue({ ok: true, text: "Thema gezet.", facts: null, clientSlug: "tilburg-kapper", status: "maintaining", applied: true, previewSnapshot: { pageId: "1", page: amicarePublishedSiteSnapshot.pages[0], settings: amicarePublishedSiteSnapshot.settings, theme: amicarePublishedSiteSnapshot.theme } })
  })
  it("rejects chat without a preview session", async () => {
    mocks.getSession.mockResolvedValue(null)
    expect((await POST(chatReq())).status).toBe(401)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
  })
  it("requires fresh verified Better Auth and ignores request account authority", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "anna@example.com", emailVerified: false } })
    expect((await POST(chatReq())).status).toBe(403)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.getSession).toHaveBeenCalledWith(expect.any(Headers))
  })
  it("does not patch from a stored slug after the grant is revoked", async () => {
    mocks.reserve.mockRejectedValue(new Error("builder_preview_revoked"))
    const res = await POST(chatReq())
    expect(res.status).toBe(403)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
  })
  it("pins maintainer writes to the verified grant tenant and saves transcript/result through settlement", async () => {
    mocks.loadLatestActivePreviewGrant.mockResolvedValue({ clientSlug: "tilburg-kapper", tenant: 3 })
    const res = await POST(chatReq())
    expect(res.status).toBe(200)
    expect(mocks.runBuilderTurn).toHaveBeenCalledWith({}, expect.objectContaining({ existingClientSlug: "tilburg-kapper", existingTenantId: 3, contactEmail: "anna@example.com", locale: "nl" }), expect.any(Object))
    expect(mocks.settle).toHaveBeenCalledWith(expect.any(Object), expect.any(Function), expect.objectContaining({ thread: expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "assistant", actions: [expect.objectContaining({ id: "open-preview", label: "Bekijk je site" })] })]) }) }))
    expect(await res.json()).toMatchObject({ applied: true, previewSnapshot: { pageId: "1" }, operationId, quota: { used: 1, reserved: 0 } })
    expect(mocks.loadBuilderThread).toHaveBeenCalledTimes(2)
  })
  it("counts verified ingress before parsing malformed/conflicting input, and denies request exhaustion without model work", async () => {
    expect((await POST(chatReq({ message: "Missing UUID" }))).status).toBe(400)
    expect(mocks.consumeIngress).toHaveBeenCalledWith("anna@example.com")
    mocks.consumeIngress.mockResolvedValue(false)
    expect((await POST(chatReq())).status).toBe(429)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it("rejects missing UUID, oversized text and forged request identity before reservation", async () => {
    for (const body of [{ message: "Build a bakery" }, { operationId, message: "x".repeat(4001) }, { operationId, message: "Build a bakery", email: "forged@example.test" }]) expect((await POST(chatReq(body))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
  })
  it("caps actual chunked UTF-8 bytes without trusting content-length", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"message":"')); controller.enqueue(new TextEncoder().encode("é".repeat(32768))); controller.close() } })
    const req = new NextRequest("https://admin.siteinabox.nl/api/builder/chat", { method: "POST", body: stream })
    expect((await POST(req)).status).toBe(413)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it("returns immutable cached terminal result without executing or settling again", async () => {
    mocks.reserve.mockResolvedValue({ status: "complete", quota: { ...quota, used: 12, reserved: 0, remaining: 0 }, result: { ok: true, text: "Cached reply", messages: [] } })
    expect(await (await POST(chatReq())).json()).toMatchObject({ text: "Cached reply", quota: { remaining: 0 } })
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
    expect(mocks.settle).not.toHaveBeenCalled()
  })
  it("reports conflict/quota exhaustion/pending without paid work or clearing the preview", async () => {
    for (const [reason, status] of [["operation_conflict", 409], ["quota_exhausted", 429], ["busy", 409]] as const) {
      mocks.reserve.mockResolvedValue({ status: "denied", reason, quota })
      expect((await POST(chatReq())).status).toBe(status)
    }
    mocks.reserve.mockResolvedValue({ status: "pending", operationId, quota })
    expect((await POST(chatReq())).status).toBe(202)
    expect(mocks.runBuilderTurn).not.toHaveBeenCalled()
    expect(mocks.settle).not.toHaveBeenCalled()
  })
})
