import { describe, it, expect } from "vitest"
import { Users } from "@/collections/Users"
import { expectNamedField, fieldOptionValues, fieldOptions, fieldRequired, fieldValidator } from "../_helpers/payloadFields"

describe("Users collection config", () => {
  it("uses 'users' slug", () => { expect(Users.slug).toBe("users") })

  it("auth is enabled with API key support", () => {
    expect(Users.auth).toBeTruthy()
    expect(Users.auth && typeof Users.auth === "object" && "useAPIKey" in Users.auth && Users.auth.useAPIKey).toBe(true)
  })

  it("has role enum with four values", () => {
    const role = expectNamedField(Users.fields, "role")
    expect(fieldOptionValues(fieldOptions(role))).toEqual([
      "super-admin", "owner", "editor", "viewer",
    ])
  })

  it("has tenants array field with a `tenant` relationship row", () => {
    const tenants = expectNamedField(Users.fields, "tenants")
    expect(tenants.type).toBe("array")
    const row = expectNamedField("fields" in tenants ? tenants.fields : undefined, "tenant")
    expect(row.type).toBe("relationship")
    expect("relationTo" in row && row.relationTo).toBe("tenants")
    expect(fieldRequired(row)).toBe(true)
  })

  it("does not have a singular `tenant` field (plugin-native shape uses tenants[])", () => {
    const tenant = Users.fields.find((field) => "name" in field && field.name === "tenant")
    expect(tenant).toBeUndefined()
  })

  it("validates super-admin must have empty tenants[] and others have exactly one", () => {
    const tenants = expectNamedField(Users.fields, "tenants")
    const validate = fieldValidator(tenants)
    expect(typeof validate).toBe("function")
    if (!validate) throw new Error("expected tenants validator")
    expect(validate([], { siblingData: { role: "super-admin" }, operation: "create" })).toBe(true)
    expect(validate([{ tenant: "t1" }], { siblingData: { role: "super-admin" }, operation: "create" })).toMatch(/super-admin/)
    expect(validate([], { siblingData: { role: "editor" }, operation: "create" })).toMatch(/exactly one/i)
    expect(validate([{ tenant: "t1" }], { siblingData: { role: "editor" }, operation: "create" })).toBe(true)
    expect(validate([{ tenant: "t1" }, { tenant: "t2" }], { siblingData: { role: "editor" }, operation: "create" })).toMatch(/exactly one/i)
  })

  it("validator treats undefined/null tenants the same as empty array", () => {
    const tenants = expectNamedField(Users.fields, "tenants")
    const validate = fieldValidator(tenants)
    if (!validate) throw new Error("expected tenants validator")
    expect(validate(undefined, { siblingData: { role: "super-admin" }, operation: "update" })).toBe(true)
    expect(validate(null, { siblingData: { role: "super-admin" }, operation: "update" })).toBe(true)
    expect(validate(undefined, { siblingData: { role: "editor" }, operation: "update" })).toMatch(/exactly one/i)
    expect(validate(null, { siblingData: { role: "editor" }, operation: "update" })).toMatch(/exactly one/i)
  })
})