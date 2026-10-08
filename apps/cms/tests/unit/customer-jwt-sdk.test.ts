import { describe, expect, it, vi } from "vitest"
import { createLocalReq, executeAuthStrategies, jwtSign, JWTAuthentication } from "payload"
import { Users } from "@/collections/Users"
import { installCustomerJwtStrategy } from "@/lib/auth/customerJwtStrategy"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { userFixture } from "../_helpers/generatedDocs"

const authority = vi.hoisted(() => ({ validate: vi.fn() }))
vi.mock("@/lib/auth/customerSessionBridge", () => ({ validateCustomerPayloadSession: authority.validate }))

async function fixture(role: "owner" | "super-admin" = "owner") {
  const payload = await createInitializedTestPayload([Users, { slug: "tenants", fields: [] }])
  payload.secret = "test-jwt-customer-secret"
  const user = userFixture({ role, tenants: role === "owner" ? [{ tenant: 1 }] : [], sessions: [{ id: "sid", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() }] })
  vi.spyOn(payload, "findByID").mockResolvedValue(user)
  const { token } = await jwtSign({ fieldsToSign: { id: user.id, email: user.email, collection: "users", sid: "sid" }, secret: payload.secret, tokenExpiration: 60 })
  const headers = new Headers({ authorization: `JWT ${token}`, DisableAutologin: "true" })
  return { payload, headers, user }
}

describe("installed Payload JWT dispatch", () => {
  it("demonstrates an earlier veto cannot block terminal native JWT", async () => {
    const { payload, headers } = await fixture()
    payload.authStrategies.unshift({ name: "unsafe-veto", authenticate: async () => ({ user: null }) })
    expect((await executeAuthStrategies({ payload, headers })).user?.id).toBe(1)
  })
  it.each([false, true])("terminal decorator uses current authority=%s in Local/REST and GraphQL dispatch", async (allowed) => {
    for (const isGraphQL of [false, true]) {
      const { payload, headers } = await fixture()
      authority.validate.mockResolvedValue(allowed)
      installCustomerJwtStrategy(payload)
      const result = await executeAuthStrategies({ payload, headers, isGraphQL })
      expect(Boolean(result.user)).toBe(allowed)
      expect(payload.authStrategies.at(-1)?.authenticate).not.toBe(JWTAuthentication)
    }
  })
  it.each(["REST", "GraphQL"] as const)("keeps the external %s request and disclosure context unchanged", async (payloadAPI) => {
    const { payload, headers } = await fixture()
    authority.validate.mockResolvedValue(true)
    const req = await createLocalReq({ req: { headers, payloadAPI, context: { disclosure: "external" } } }, payload)
    installCustomerJwtStrategy(payload)
    expect((await executeAuthStrategies({ payload, headers, req, isGraphQL: payloadAPI === "GraphQL" })).user?.id).toBe(1)
    expect(req.payloadAPI).toBe(payloadAPI)
    expect(req.context).toEqual({ disclosure: "external" })
    expect(payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ req: expect.objectContaining({ payloadAPI: "local", context: { disclosure: "external" } }) }))
  })
  it("store exception cannot resurrect the native fallback", async () => {
    const { payload, headers } = await fixture()
    authority.validate.mockRejectedValue(new Error("store unavailable"))
    installCustomerJwtStrategy(payload)
    expect((await executeAuthStrategies({ payload, headers })).user).toBeNull()
  })
  it("preserves an independent API key strategy without invoking the JWT bridge", async () => {
    const { payload, headers, user } = await fixture()
    const validate = authority.validate.mockClear()
    payload.authStrategies.unshift({ name: "fixture-api-key", authenticate: async () => ({ user: { ...user, _strategy: "api-key" } }) })
    installCustomerJwtStrategy(payload)
    expect((await executeAuthStrategies({ payload, headers })).user?._strategy).toBe("api-key")
    expect(validate).not.toHaveBeenCalled()
  })
  it("fails boot on duplicate, replaced or non-terminal native JWT", async () => {
    for (const topology of ["duplicate", "replaced", "non-terminal"]) {
      const { payload } = await fixture()
      if (topology === "duplicate") payload.authStrategies.push({ name: "local-jwt", authenticate: JWTAuthentication })
      if (topology === "replaced") payload.authStrategies.at(-1)!.authenticate = async () => ({ user: null })
      if (topology === "non-terminal") payload.authStrategies.push({ name: "later", authenticate: async () => ({ user: null }) })
      expect(() => installCustomerJwtStrategy(payload)).toThrow("topology")
    }
  })
})
