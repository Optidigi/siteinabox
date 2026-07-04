import { describe, expect, it } from "vitest"
import { legacyPreviewTokensEnabled } from "@/lib/preview/legacyPreview"

describe("signed preview token compatibility gate", () => {
  it("allows HMAC preview tokens outside production for local compatibility", () => {
    expect(legacyPreviewTokensEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true)
    expect(legacyPreviewTokensEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(true)
  })

  it("fails closed in production unless explicitly enabled", () => {
    expect(legacyPreviewTokensEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false)
    expect(legacyPreviewTokensEnabled({
      NODE_ENV: "production",
      ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE: "1",
    } as NodeJS.ProcessEnv)).toBe(true)
    expect(legacyPreviewTokensEnabled({
      NODE_ENV: "production",
      ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE: "true",
    } as NodeJS.ProcessEnv)).toBe(false)
  })
})
