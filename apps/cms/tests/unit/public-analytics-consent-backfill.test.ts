import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import * as migration from "@/migrations/20260719_121500_restore_missing_public_analytics_consent"

describe("public analytics consent backfill", () => {
  it("is registered and only fills missing consent on existing manifests", () => {
    expect(typeof migration.up).toBe("function")
    expect(typeof migration.down).toBe("function")

    const source = readFileSync(resolve(process.cwd(), "src/migrations/20260719_121500_restore_missing_public_analytics_consent.ts"), "utf8")
    expect(source).toContain('WHERE "site_manifest" IS NOT NULL')
    expect(source).toContain(`NOT ("site_manifest" ? 'analyticsConsent')`)
    expect(source).toContain("'provider', 'posthog'")

    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")
    expect(index).toContain("20260719_121500_restore_missing_public_analytics_consent")
  })
})
