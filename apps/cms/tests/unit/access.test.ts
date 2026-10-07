import { userFixture } from "../_helpers/generatedDocs"
import { describe, it, expect } from "vitest"
import { accessArgs } from "../_helpers/accessArgs"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { isTenantMember } from "@/access/isTenantMember"
import { isOwnerInTenant } from "@/access/isOwnerInTenant"
import { canManageUsers } from "@/access/canManageUsers"

// Fixtures match Payload's actual call shape: access functions receive { req, ... }
// where req contains the authenticated user (or null). After Wave 1 the user's
// tenant lives in `tenants[].tenant` (plugin-multi-tenant native shape).
const su = accessArgs({ req: { user: userFixture({ id: 1, role: "super-admin", tenants: [] }) } })
const owner = accessArgs({ req: { user: userFixture({ id: 2, role: "owner", tenants: [{ tenant: 42 }] }) } })
const editor = accessArgs({ req: { user: userFixture({ id: 3, role: "editor", tenants: [{ tenant: 42 }] }) } })
const viewer = accessArgs({ req: { user: userFixture({ id: 4, role: "viewer", tenants: [{ tenant: 42 }] }) } })
const anon = accessArgs({ req: { user: null } })

describe("isSuperAdmin", () => {
  it("true only for super-admin role", () => {
    expect(isSuperAdmin(su)).toBe(true)
    expect(isSuperAdmin(owner)).toBe(false)
    expect(isSuperAdmin(anon)).toBe(false)
  })
})

describe("isTenantMember", () => {
  it("true for any role with tenant set", () => {
    expect(isTenantMember(owner)).toBe(true)
    expect(isTenantMember(editor)).toBe(true)
    expect(isTenantMember(viewer)).toBe(true)
    expect(isTenantMember(su)).toBe(false)
    expect(isTenantMember(anon)).toBe(false)
  })
})

describe("isOwnerInTenant", () => {
  it("true for owner role", () => {
    expect(isOwnerInTenant(owner)).toBe(true)
    expect(isOwnerInTenant(editor)).toBe(false)
  })
})

describe("canManageUsers — Users collection access", () => {
  it("super-admin can manage anyone", () => {
    expect(canManageUsers(su)).toBe(true)
  })
  it("owner sees only own-tenant users via where filter", () => {
    expect(canManageUsers(owner)).toEqual({ "tenants.tenant": { equals: 42 } })
  })
  it("editor/viewer can only manage themselves", () => {
    expect(canManageUsers(editor)).toEqual({ id: { equals: 3 } })
    expect(canManageUsers(viewer)).toEqual({ id: { equals: 4 } })
  })
  it("anon cannot manage users", () => {
    expect(canManageUsers(anon)).toBe(false)
  })
})
