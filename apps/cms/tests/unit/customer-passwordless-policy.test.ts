import { describe, expect, it, vi } from "vitest"
import { Users } from "@/collections/Users"
import { createInitializedTestPayload, createTestRequest } from "../_helpers/testPayload"
import { paginatedFixture, userFixture } from "../_helpers/generatedDocs"

describe("customer passwordless admission", () => {
  it("rejects customer before a password token can be signed", async () => {
    const payload = await createInitializedTestPayload([Users, { slug: "tenants", fields: [] }])
    const req = await createTestRequest(payload)
    const collection = payload.collections.users!.config
    const hooks = collection.hooks.beforeLogin
    expect(hooks.length).toBeGreaterThan(0)
    for (const hook of hooks) {
      await expect(Promise.resolve().then(() => hook({ collection, context: {}, req, user: userFixture({ role: "owner", tenants: [{ tenant: 1 }] }) }))).rejects.toThrow()
    }
  })
  it.each([true, false])("Local SDK login overrideAccess=%s rejects before credential DB lookup or sid mutation", async (overrideAccess) => {
    const payload = await createInitializedTestPayload([Users, { slug: "tenants", fields: [] }])
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([userFixture({ role: "owner", tenants: [{ tenant: 1 }] })]))
    const credentialRead = vi.spyOn(payload.db, "findOne")
    const write = vi.spyOn(payload.db, "updateOne")
    await expect(payload.login({ collection: "users", data: { email: "fixture@example.com", password: "valid-fixture-password" }, overrideAccess })).rejects.toThrow()
    expect(credentialRead).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
  it.each(["forgotPassword", "resetPassword"] as const)("Local SDK %s rejects before mail or password mutation", async (operation) => {
    const payload = await createInitializedTestPayload([Users, { slug: "tenants", fields: [] }])
    vi.spyOn(payload.db, "beginTransaction").mockResolvedValue(null)
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([userFixture({ role: "owner", tenants: [{ tenant: 1 }], resetPasswordToken: "existing-token", resetPasswordExpiration: "2027-01-01T00:00:00.000Z" })]))
    const write = vi.spyOn(payload.db, "updateOne")
    const mail = vi.spyOn(payload, "sendEmail")
    const promise = operation === "forgotPassword" ? payload.forgotPassword({ collection: "users", data: { email: "fixture@example.com" }, overrideAccess: true }) : payload.resetPassword({ collection: "users", data: { token: "existing-token", password: "valid-fixture-password" }, overrideAccess: true })
    await expect(promise).rejects.toThrow()
    expect(write).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })
})
