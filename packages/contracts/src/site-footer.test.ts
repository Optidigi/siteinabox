import { describe, expect, it } from "vitest"
import { FOOTER_VARIANTS } from "./site"
import { SiteSettingsSchema } from "./runtime"

describe("first-party footer contract", () => {
  it("exposes exactly the implemented footer variants", () => {
    expect(FOOTER_VARIANTS).toEqual(["footer-01"])
  })

  it("defaults an explicitly configured footer to footer-01", () => {
    const parsed = SiteSettingsSchema.parse({
      siteName: "Atelier Noord",
      siteUrl: "https://atelier-noord.example",
      description: null,
      language: "nl",
      contactEmail: null,
      chrome: { footer: {} },
    })
    expect(parsed.chrome?.footer).toEqual({ variant: "footer-01" })
  })

  it("rejects unknown footer variants", () => {
    const result = SiteSettingsSchema.safeParse({
      siteName: "Atelier Noord",
      siteUrl: "https://atelier-noord.example",
      description: null,
      language: "nl",
      contactEmail: null,
      chrome: { footer: { variant: "footer-99" } },
    })
    expect(result.success).toBe(false)
  })
})
