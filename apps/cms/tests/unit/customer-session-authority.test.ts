import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CustomerAuthAccount, CustomerSessionBinding } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { paginatedFixture, tenantFixture, userFixture } from "../_helpers/generatedDocs"
const io = vi.hoisted(() => ({ getPayload: vi.fn(), baRead: vi.fn<(args: { model: string }) => Promise<unknown>>() }))
vi.mock("payload", async (original) => ({ ...await original<typeof import("payload")>(), getPayload: io.getPayload }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("@/lib/betterAuth", () => ({ auth: { $context: Promise.resolve({ adapter: { findOne: io.baRead } }) } }))
import { validateCustomerPayloadSession } from "@/lib/auth/customerSessionBridge"
const now = "2026-10-07T00:00:00.000Z"
const bindingFixture = (patch: Partial<CustomerSessionBinding> = {}): CustomerSessionBinding => ({ id: 1, betterAuthSessionId: "ba-session", user: 1, payloadSessionId: "sid", state: "active", createdAt: now, updatedAt: now, ...patch })
const accountFixture = (patch: Partial<CustomerAuthAccount> = {}): CustomerAuthAccount => ({ id: 1, user: 1, authEpoch: "1970-01-01T00:00:00.000Z", createdAt: now, updatedAt: now, ...patch })
function fixture(binding: CustomerSessionBinding | null = bindingFixture(), account = accountFixture()) {
  const payload = createTestPayload()
  const user = { ...userFixture({ role: "owner", tenants: [{ tenant: 1 }], sessions: [{ id: "sid", createdAt: now, expiresAt: "2027-01-01T00:00:00.000Z" }] }), _sid: "sid" }
  vi.spyOn(payload, "find").mockResolvedValueOnce(paginatedFixture(binding ? [binding] : [])).mockResolvedValue(paginatedFixture([account]))
  vi.spyOn(payload, "findByID").mockResolvedValue(tenantFixture())
  io.getPayload.mockResolvedValue(payload)
  io.baRead.mockImplementation(async ({ model }) => model === "session" ? { id: "ba-session", userId: "ba-user", createdAt: new Date(now), expiresAt: new Date("2027-01-01T00:00:00.000Z") } : { id: "ba-user", payloadUserId: "1", email: user.email, emailVerified: true })
  return { payload, user }
}
beforeEach(() => vi.clearAllMocks())
describe("durable customer session request authority", () => {
  it("admits verified BA binding without creating authority on reads", async () => {
    const { payload, user } = fixture()
    const create = vi.spyOn(payload, "create")
    expect(await validateCustomerPayloadSession(payload, user)).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })
  it.each(["issuing", "revoked"] as const)("denies %s claims despite surviving native sid", async (state) => {
    const { payload, user } = fixture(bindingFixture({ state }))
    expect(await validateCustomerPayloadSession(payload, user)).toBe(false)
    expect(io.baRead).not.toHaveBeenCalled()
  })
  it("missing or tombstoned binding denies customer", async () => {
    for (const binding of [null, bindingFixture({ revokedAt: now })]) {
      const { payload, user } = fixture(binding)
      expect(await validateCustomerPayloadSession(payload, user)).toBe(false)
    }
  })
  it("BA-only deletion denies surviving JWT", async () => {
    const { payload, user } = fixture()
    io.baRead.mockResolvedValue(null)
    expect(await validateCustomerPayloadSession(payload, user)).toBe(false)
  })
  it("global epoch denies pre-created BA despite stale SDK sid resurrection", async () => {
    const { payload, user } = fixture(bindingFixture(), accountFixture({ authEpoch: "2026-10-08T00:00:00.000Z" }))
    expect(await validateCustomerPayloadSession(payload, user)).toBe(false)
  })
  it("unverified or relinked identity denies binding", async () => {
    for (const patch of [{ emailVerified: false }, { payloadUserId: "999" }, { email: "attacker@example.com" }]) {
      const { payload, user } = fixture()
      io.baRead.mockImplementation(async ({ model }) => model === "session" ? { id: "ba-session", userId: "ba-user", createdAt: new Date(now), expiresAt: new Date("2027-01-01T00:00:00.000Z") } : { id: "ba-user", payloadUserId: "1", email: user.email, emailVerified: true, ...patch })
      expect(await validateCustomerPayloadSession(payload, user)).toBe(false)
    }
  })
  it("archived tenant denies bound identity", async () => {
    const { payload, user } = fixture()
    vi.spyOn(payload, "findByID").mockResolvedValue(tenantFixture({ status: "archived" }))
    await expect(validateCustomerPayloadSession(payload, user)).rejects.toBeInstanceOf(Response)
  })
  it("revoked customer binding cannot become super-admin authority", async () => {
    const { payload, user } = fixture(bindingFixture({ state: "revoked" }))
    expect(await validateCustomerPayloadSession(payload, { ...user, role: "super-admin", tenants: [] })).toBe(false)
  })
})
