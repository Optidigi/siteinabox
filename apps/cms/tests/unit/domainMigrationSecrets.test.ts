import { describe, expect, it } from "vitest"

import {
  openMigrationSecret,
  sealMigrationSecret,
} from "@/lib/domains/migrationSecrets"

const env = {
  DOMAIN_MIGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
} as unknown as NodeJS.ProcessEnv

describe("domain migration secret envelope", () => {
  it("encrypts transfer codes with migration-bound authenticated encryption", () => {
    const sealed = sealMigrationSecret("sensitive-epp-code", "migration:42", env)

    expect(sealed).not.toContain("sensitive-epp-code")
    expect(openMigrationSecret(sealed, "migration:42", env)).toBe("sensitive-epp-code")
    expect(() => openMigrationSecret(sealed, "migration:43", env)).toThrow()
  })

  it("fails closed without an independent 256-bit key", () => {
    expect(() => sealMigrationSecret("code", "migration:42", {} as NodeJS.ProcessEnv))
      .toThrow("DOMAIN_MIGRATION_ENCRYPTION_KEY")
    expect(() => sealMigrationSecret("code", "migration:42", {
      DOMAIN_MIGRATION_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"),
    } as unknown as NodeJS.ProcessEnv)).toThrow("32 bytes")
  })
})
