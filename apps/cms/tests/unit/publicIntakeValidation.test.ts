import { describe, expect, it } from "vitest"
import { parsePublicIntakeSubmission } from "@/lib/intake/publicIntakeValidation"

const validBody = () => ({
  businessName: "Public Intake Bakery",
  domain: "public-intake.test",
  contactName: "Sam Public",
  contactEmail: "sam@example.com",
  source: "operator",
  pages: [{ title: "Home", slug: "home" }],
})

describe("parsePublicIntakeSubmission", () => {
  it("rejects public mockFixture controls", () => {
    const result = parsePublicIntakeSubmission({
      ...validBody(),
      mockFixture: "invalid",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: ["mockFixture"], message: "mockFixture is not accepted by the public intake API" },
      ])
    }
  })

  it("rejects unknown public intake fields before persistence", () => {
    const result = parsePublicIntakeSubmission({
      ...validBody(),
      arbitraryControl: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path.join("."))).toContain("")
    }
  })

  it("forces public submissions to the public-intake source", () => {
    const result = parsePublicIntakeSubmission(validBody())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.intake.source).toBe("public-intake")
    }
  })
})
