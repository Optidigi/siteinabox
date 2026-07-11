import { describe, expect, it } from "vitest"
import { legalReleaseSchema, validateLegalReleaseTransition } from "./legal"

const release = {
  documentType: "platform-terms" as const,
  locale: "nl",
  documentVersion: "2026-07-07.1",
  acceptanceVersion: "terms-2026-07-07",
  publishedAt: "2026-07-07T10:00:00.000Z",
  effectiveAt: "2026-07-07T10:00:00.000Z",
  contentHash: `sha256:${"a".repeat(64)}`,
  sourceCommit: "abcdef1",
  change: {
    category: "editorial" as const,
    summary: "Initial reviewed publication",
    rationale: "Establishes the immutable source",
    customerAction: "none" as const,
    consentAction: "none" as const,
  },
}

describe("legal release classification", () => {
  it("accepts a valid editorial release", () => {
    expect(legalReleaseSchema.safeParse(release).success).toBe(true)
  })

  it("rejects contradictory category actions", () => {
    const result = legalReleaseSchema.safeParse({
      ...release,
      change: { ...release.change, customerAction: "mandatory_reaccept", noticeDays: 30 },
    })
    expect(result.success).toBe(false)
  })

  it("requires a new acceptance version for material re-acceptance", () => {
    const next = legalReleaseSchema.parse({
      ...release,
      documentVersion: "2026-08-01.1",
      replaces: release.documentVersion,
      change: {
        ...release.change,
        category: "contract_material",
        customerAction: "mandatory_reaccept",
        noticeDays: 30,
      },
    })
    const previous = legalReleaseSchema.parse(release)
    expect(validateLegalReleaseTransition(next, previous)).toContain("re-acceptance requires a new acceptanceVersion")
  })
})
