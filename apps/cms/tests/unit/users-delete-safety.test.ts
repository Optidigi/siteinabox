import { describe, expect, it, vi } from "vitest"
import { canDeleteUsers, preventUnsafeUserDelete } from "@/collections/Users"
import { accessArgs } from "../_helpers/accessArgs"
import { userFixture } from "../_helpers/generatedDocs"
import type { User } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { hookRequest, hookCollection } from "../_helpers/hookFixtures"
import type { Payload, PayloadRequest } from "payload"

const makeReq = (user: Partial<User> | null, payload: Payload = createTestPayload()): PayloadRequest => hookRequest({
  user: user ? userFixture(user) : null, payload,
})

const deleteArgs = (input: { id: number; req: PayloadRequest; context?: Record<string, unknown> }): Parameters<typeof preventUnsafeUserDelete>[0] => ({
  collection: hookCollection(), context: input.context ?? {}, ...input,
})

const payloadFixture = (target?: User, totalDocs = 0) => {
  const payload = createTestPayload()
  const findByID = vi.spyOn(payload, "findByID")
  if (target) findByID.mockResolvedValue(target)
  const count = vi.spyOn(payload, "count").mockResolvedValue({ totalDocs })
  return { payload, findByID, count }
}

describe("Users delete safety", () => {
  it("scopes owner deletes to the owner's tenant", () => {
    expect(canDeleteUsers(accessArgs({
      req: makeReq({ id: 1, role: "owner", tenants: [{ tenant: 42 }] }),
    }))).toEqual({ "tenants.tenant": { equals: 42 } })
  })

  it("rejects delete access for owners without a tenant", () => {
    expect(canDeleteUsers(accessArgs({
      req: makeReq({ id: 1, role: "owner", tenants: [] }),
    }))).toBe(false)
  })

  it("blocks self-delete before deleting any user row", async () => {
    const { payload, findByID, count } = payloadFixture()

    await expect(preventUnsafeUserDelete(deleteArgs({
      id: 7,
      req: makeReq({ id: 7, role: "super-admin" }, payload),
    }))).rejects.toThrow()

    expect(findByID).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  it("allows explicit internal cleanup deletes", async () => {
    const { payload, findByID, count } = payloadFixture()

    await expect(preventUnsafeUserDelete(deleteArgs({
      context: { allowUnsafeUserDelete: true },
      id: 7,
      req: makeReq({ id: 7, role: "super-admin" }, payload),
    }))).resolves.toBeUndefined()

    expect(findByID).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  it("blocks deleting the last super-admin", async () => {
    const { payload, count } = payloadFixture(userFixture({ id: 10, role: "super-admin" }), 1)

    await expect(preventUnsafeUserDelete(deleteArgs({
      id: 10,
      req: makeReq({ id: 1, role: "super-admin" }, payload),
    }))).rejects.toThrow()

    expect(count).toHaveBeenCalledWith({
      collection: "users",
      overrideAccess: true,
      where: { role: { equals: "super-admin" } },
    })
  })

  it("allows deleting a super-admin when another super-admin remains", async () => {
    const { payload, count } = payloadFixture(userFixture({ id: 10, role: "super-admin" }), 2)

    await expect(preventUnsafeUserDelete(deleteArgs({
      id: 10,
      req: makeReq({ id: 1, role: "super-admin" }, payload),
    }))).resolves.toBeUndefined()
  })
})
