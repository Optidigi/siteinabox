import { describe, expect, it } from "vitest"
import { createSettingsSchema } from "@/components/forms/SettingsForm"

describe("customer settings validation", () => {
  const schema = createSettingsSchema(key => key)
  it.each([null, "", undefined])("accepts unrelated settings without a public URL: %s", siteUrl => {
    const parsed = schema.parse({ siteName: "Private workspace", siteUrl })
    expect(parsed.siteUrl).toBeNull()
  })
  it("preserves a valid public URL and rejects malformed input", () => {
    expect(schema.parse({ siteName: "Live site", siteUrl: "https://example.test" }).siteUrl).toBe("https://example.test")
    expect(schema.safeParse({ siteName: "Private site", siteUrl: "invalid" }).success).toBe(false)
  })
})
