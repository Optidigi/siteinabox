import { describe, expect, it } from "vitest"

import {
  MigrationSourceAuthorizations,
  protectMigrationSourceAuthorization,
  validateMigrationSourceAuthorization,
} from "@/collections/MigrationSourceAuthorizations"
import { accessArgs } from "../_helpers/accessArgs"
import { hookArgsFor } from "../_helpers/hookFixtures"

describe("migration source authorization collection", () => {
  it("is internal-only and keeps OAuth authority out of reads", () => {
    for (const access of [
      MigrationSourceAuthorizations.access?.create,
      MigrationSourceAuthorizations.access?.read,
      MigrationSourceAuthorizations.access?.update,
      MigrationSourceAuthorizations.access?.delete,
    ]) {
      expect(access?.(accessArgs({
        req: { user: { role: "super-admin" } },
      }))).toBe(false)
    }
    const encrypted = MigrationSourceAuthorizations.fields.find(
      (field) => "name" in field && field.name === "encryptedAuthority",
    )
    expect(encrypted && "access" in encrypted
      ? encrypted.access?.read?.(accessArgs({ req: {} }))
      : undefined).toBe(false)
    expect(MigrationSourceAuthorizations.admin?.hidden).toBe(true)
  })

  it("requires protected authority while live and clears it at terminal state", () => {
    expect(() => validateMigrationSourceAuthorization(hookArgsFor(
      validateMigrationSourceAuthorization,
      {
        operation: "create",
        data: { state: "pending", encryptedAuthority: null },
        req: {},
        collection: {},
        context: {},
      },
    ))).toThrow("requires protected PKCE state")
    expect(() => validateMigrationSourceAuthorization(hookArgsFor(
      validateMigrationSourceAuthorization,
      {
        operation: "update",
        data: { state: "revoked", encryptedAuthority: "sealed" },
        originalDoc: { state: "authorized", encryptedAuthority: "sealed" },
        req: {},
        collection: {},
        context: {},
      },
    ))).toThrow("cannot retain credentials")
    expect(validateMigrationSourceAuthorization(hookArgsFor(
      validateMigrationSourceAuthorization,
      {
        operation: "update",
        data: { state: "revoked", encryptedAuthority: null },
        originalDoc: { state: "authorized", encryptedAuthority: "sealed" },
        req: {},
        collection: {},
        context: {},
      },
    ))).toMatchObject({ state: "revoked", encryptedAuthority: null })
  })

  it("rejects lifecycle mutation without the reviewed internal context", () => {
    expect(() => protectMigrationSourceAuthorization(hookArgsFor(
      protectMigrationSourceAuthorization,
      {
        operation: "update",
        data: { state: "revoked", encryptedAuthority: null },
        req: {},
        collection: {},
        context: {},
      },
    ))).toThrow("reviewed OAuth lifecycle")
    expect(() => protectMigrationSourceAuthorization(hookArgsFor(
      protectMigrationSourceAuthorization,
      {
        operation: "update",
        data: { domainNameAscii: "other.example" },
        req: {},
        collection: {},
        context: { migrationSourceAuthorizationLifecycle: true },
      },
    ))).toThrow("immutable")
  })
})
