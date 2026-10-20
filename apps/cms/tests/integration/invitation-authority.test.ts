import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import type { User } from "@/payload-types"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import { cast } from "../_helpers/cast"

const boundary = vi.hoisted(() => ({ cookie: "", send: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: boundary.cookie, host: "admin.siteinabox.nl" }) }))
vi.mock("@/lib/betterAuth", () => ({ auth: { api: { signInMagicLink: boundary.send } } }))
import { inviteUser, resendUserInvitation } from "@/lib/actions/inviteUser"

let payload: Payload
let fx: Awaited<ReturnType<typeof seedFixture>>
beforeAll(async () => { payload = await getTestPayload() }, 30_000)
beforeEach(async () => {
  await resetTestData(payload)
  fx = await seedFixture(payload)
  boundary.cookie = ""
  boundary.send.mockReset().mockResolvedValue({ status: true })
}, 30_000)
async function signIn(user: User) {
  const session = await payload.login({ collection: "users", data: { email: user.email, password: "test1234" } })
  boundary.cookie = "payload-token=" + session.token
}

describe("invitation authority through real Payload access and session", () => {
  it("allows owner editor/viewer invitations and super-admin owner provisioning", async () => {
    await signIn(fx.owner1)
    for (const role of ["editor", "viewer"] as const) {
      const result = await inviteUser({ email: role + "-positive@test.local", name: role, role, tenantId: fx.t1.id })
      expect(result).toMatchObject({ ok: true, delivery: "sent" })
    }
    await signIn(fx.sa)
    expect(await inviteUser({ email: "owner-positive@test.local", name: "Owner", role: "owner", tenantId: fx.t2.id }))
      .toMatchObject({ ok: true })
  })

  it("rejects anonymous, editor, viewer and cross-tenant actions before creation or mail", async () => {
    const input = { email: "denied@test.local", name: "Denied", role: "editor" as const, tenantId: fx.t1.id }
    await expect(inviteUser(input)).rejects.toThrow("Forbidden")
    for (const caller of [fx.editor1, fx.viewer1, fx.owner2]) {
      await signIn(caller)
      await expect(inviteUser(input)).rejects.toThrow("Forbidden")
      await expect(resendUserInvitation({ userId: fx.editor1.id, tenantId: fx.t1.id })).rejects.toThrow("Forbidden")
    }
    expect((await payload.find({ collection: "users", overrideAccess: true, where: { email: { equals: input.email } } })).totalDocs).toBe(0)
    expect(boundary.send).not.toHaveBeenCalled()
  })

  it("competing same-email creates preserve one matching member, and conflicting membership is not overwritten", async () => {
    await signIn(fx.owner1)
    const input = { email: "competing@test.local", name: "Concurrent", role: "viewer" as const, tenantId: fx.t1.id }
    const results = await Promise.all([inviteUser(input), inviteUser(input)])
    expect(results.every((result) => result.ok)).toBe(true)
    if (!results[0]!.ok || !results[1]!.ok) throw new Error("Expected successful matching retries")
    expect(results[0]!.id).toBe(results[1]!.id)
    expect((await payload.find({ collection: "users", overrideAccess: true, where: { email: { equals: input.email } } })).totalDocs).toBe(1)
    const sent = boundary.send.mock.calls.length
    await signIn(fx.owner2)
    expect(await inviteUser({ ...input, tenantId: fx.t2.id })).toMatchObject({ ok: false })
    expect(boundary.send).toHaveBeenCalledTimes(sent)
    const current = await payload.findByID({ collection: "users", id: results[0]!.id, overrideAccess: true, depth: 0 })
    expect(current.tenants?.[0]?.tenant).toBe(fx.t1.id)
    expect(current.role).toBe("viewer")
  })

  it("resend rechecks current recipient membership and caller role on every attempt", async () => {
    await signIn(fx.owner1)
    expect(await resendUserInvitation({ userId: fx.editor1.id, tenantId: fx.t1.id })).toEqual({ ok: true })
    await payload.update({ collection: "users", id: fx.editor1.id, overrideAccess: true, data: { tenants: [{ tenant: fx.t2.id }] } })
    await expect(resendUserInvitation({ userId: fx.editor1.id, tenantId: fx.t1.id })).rejects.toThrow()
    await payload.update({ collection: "users", id: fx.owner1.id, overrideAccess: true, data: { role: "viewer" } })
    await expect(resendUserInvitation({ userId: fx.viewer1.id, tenantId: fx.t1.id })).rejects.toThrow("Forbidden")
    expect(boundary.send).toHaveBeenCalledTimes(1)
  })

  it("unknown provider responses never claim delivery, and forged metadata/origins are not accepted", async () => {
    await signIn(fx.owner1)
    boundary.send.mockResolvedValueOnce(undefined)
    expect(await resendUserInvitation({ userId: fx.editor1.id, tenantId: fx.t1.id })).toMatchObject({ ok: false })
    const calls = boundary.send.mock.calls.length
    expect(await inviteUser(cast<Parameters<typeof inviteUser>[0]>({
      email: "origin-forged@test.local", name: "Forged", role: "viewer", tenantId: fx.t1.id,
      adminUrl: "https://attacker.example", metadata: { role: "super-admin" },
    }))).toMatchObject({ ok: false, code: "validation_failed" })
    expect(boundary.send).toHaveBeenCalledTimes(calls)
  })

  it("retries a failed delivery using the same persisted membership without changing its identity", async () => {
    await signIn(fx.owner1)
    const input = { email: "retry@test.local", name: "Retry", role: "editor" as const, tenantId: fx.t1.id }
    boundary.send.mockRejectedValueOnce(new Error("unknown provider outcome"))
    const first = await inviteUser(input)
    expect(first).toMatchObject({ ok: false, code: "delivery_failed", userCreated: true })
    const before = await payload.find({ collection: "users", where: { email: { equals: input.email } }, overrideAccess: true, showHiddenFields: true })
    const second = await inviteUser(input)
    expect(second).toMatchObject({ ok: true, id: before.docs[0]!.id })
    const after = await payload.find({ collection: "users", where: { email: { equals: input.email } }, overrideAccess: true, showHiddenFields: true })
    expect(after.totalDocs).toBe(1)
    expect(after.docs[0]).toMatchObject({ id: before.docs[0]!.id, email: input.email, role: "editor", updatedAt: before.docs[0]!.updatedAt })
    expect(boundary.send).toHaveBeenCalledTimes(2)
  })

  it("rejects original privileged create intent with Forbidden before field stripping", async () => {
    await expect(payload.create({ collection: "users", user: fx.owner1, overrideAccess: false,
      data: { email: "role-forgery@test.local", password: "test1234", role: "super-admin", tenants: [] },
    })).rejects.toMatchObject({ status: 403 })
  })

  it("rejects a forged owner role before user creation or privileged mail", async () => {
    await signIn(fx.owner1)
    await expect(inviteUser(cast<Parameters<typeof inviteUser>[0]>({
      email: "forged@test.local", name: "Forged", role: "super-admin", tenantId: fx.t1.id,
    }))).rejects.toThrow()
    const result = await payload.find({ collection: "users", where: { email: { equals: "forged@test.local" } }, overrideAccess: true })
    expect(result.totalDocs).toBe(0)
    expect(boundary.send).not.toHaveBeenCalled()
  })
})
