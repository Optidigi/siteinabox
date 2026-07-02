import { describe, expect, it, vi } from "vitest"
import { canDeleteUsers, preventUnsafeUserDelete } from "@/collections/Users"

const makeReq = (user: any, payload: any = {}) => ({
  user,
  payload,
  t: ((key: string) => key) as any,
})

describe("Users delete safety", () => {
  it("scopes owner deletes to the owner's tenant", () => {
    expect(canDeleteUsers({
      req: makeReq({ id: 1, role: "owner", tenants: [{ tenant: 42 }] }),
    } as any)).toEqual({ "tenants.tenant": { equals: 42 } })
  })

  it("rejects delete access for owners without a tenant", () => {
    expect(canDeleteUsers({
      req: makeReq({ id: 1, role: "owner", tenants: [] }),
    } as any)).toBe(false)
  })

  it("blocks self-delete before deleting any user row", async () => {
    const payload = {
      findByID: vi.fn(),
      count: vi.fn(),
    }

    await expect(preventUnsafeUserDelete({
      id: 7,
      req: makeReq({ id: 7, role: "super-admin" }, payload),
    } as any)).rejects.toThrow()

    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.count).not.toHaveBeenCalled()
  })

  it("allows explicit internal cleanup deletes", async () => {
    const payload = {
      findByID: vi.fn(),
      count: vi.fn(),
    }

    await expect(preventUnsafeUserDelete({
      context: { allowUnsafeUserDelete: true },
      id: 7,
      req: makeReq({ id: 7, role: "super-admin" }, payload),
    } as any)).resolves.toBeUndefined()

    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.count).not.toHaveBeenCalled()
  })

  it("blocks deleting the last super-admin", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 10, role: "super-admin" }),
      count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
    }

    await expect(preventUnsafeUserDelete({
      id: 10,
      req: makeReq({ id: 1, role: "super-admin" }, payload),
    } as any)).rejects.toThrow()

    expect(payload.count).toHaveBeenCalledWith({
      collection: "users",
      overrideAccess: true,
      where: { role: { equals: "super-admin" } },
    })
  })

  it("allows deleting a super-admin when another super-admin remains", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 10, role: "super-admin" }),
      count: vi.fn().mockResolvedValue({ totalDocs: 2 }),
    }

    await expect(preventUnsafeUserDelete({
      id: 10,
      req: makeReq({ id: 1, role: "super-admin" }, payload),
    } as any)).resolves.toBeUndefined()
  })
})
