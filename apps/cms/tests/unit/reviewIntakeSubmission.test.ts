import { describe, expect, it } from "vitest"
import { buildGenerationInput, hashStableValue } from "@/lib/intake/normalizeIntake"
import {
  defaultReviewedGenerationInput,
  prepareReviewedGenerationInputUpdate,
} from "@/lib/intake/reviewIntakeSubmission"
import type { IntakeSubmission } from "@/payload-types"

const normalized = {
  businessName: "Review Demo",
  tenantSlug: "review-demo",
  primaryDomain: "review-demo.nl",
  siteUrl: "https://review-demo.nl",
  language: "nl",
  serviceArea: ["Limburg"],
  goals: ["Advies"],
  requestedPages: [{ slug: "index", title: "Home", purpose: "Homepage" }],
  companyFacts: {
    source: "kvk",
    companyName: "Review Demo",
    secondaryActivities: [],
    mainActivity: "Advies",
  },
  intakeBrief: {
    services: ["Advies"],
    serviceArea: ["Limburg"],
    workModes: [],
    proofTrust: [],
    contactPreferences: {
      selectedActions: ["message"],
      formOptions: ["message"],
      locationOptions: ["region"],
    },
    callsToAction: ["message"],
    visualPreferences: {},
    tone: [],
    addOnInterest: [],
  },
}

const submission = (): IntakeSubmission => ({
  id: 42,
  businessName: "Review Demo",
  source: "public-intake",
  status: "normalized",
  idempotencyKey: "public-intake:normalized:demo",
  raw: {},
  normalized,
  normalizedHash: hashStableValue(normalized),
  statusTransitions: [
    {
      status: "submitted",
      at: "2026-06-29T10:00:00.000Z",
    },
    {
      status: "normalized",
      at: "2026-06-29T10:00:01.000Z",
      message: "Public intake stored for manual review",
    },
  ],
  updatedAt: "2026-06-29T10:00:01.000Z",
  createdAt: "2026-06-29T10:00:00.000Z",
})

describe("reviewIntakeSubmission", () => {
  it("builds a draft reviewed GenerationInput from normalized intake", () => {
    const generated = defaultReviewedGenerationInput(submission())

    expect(generated.status).toBe("draft")
    expect(generated.companyFacts.companyName).toBe("Review Demo")
    expect(generated.brief.services).toEqual(["Advies"])
    expect(generated.normalizedIntake.tenantSlug).toBe("review-demo")
  })

  it("marks valid reviewed input as admin-approved with review metadata", () => {
    const staged = submission()
    const update = prepareReviewedGenerationInputUpdate({
      submission: staged,
      generationInputJson: JSON.stringify(buildGenerationInput(normalized as any, "ai-prepared")),
      reviewNotes: "Ready for generation.",
      reviewerId: 7,
      now: "2026-06-30T09:00:00.000Z",
    })

    expect(update.reviewedGenerationInput.status).toBe("admin-approved")
    expect(update.reviewedGenerationInput.approvedAt).toBe("2026-06-30T09:00:00.000Z")
    expect(update.reviewedGenerationInput.approvedBy).toBe("7")
    expect(update.reviewedGenerationInput.notes).toBe("Ready for generation.")
    expect(update.reviewNotes).toBe("Ready for generation.")
    expect(update.reviewedBy).toBe(7)
    expect(update.statusTransitions.at(-1)).toMatchObject({
      status: "normalized",
      message: "Admin approved reviewed GenerationInput for generation handoff",
    })
  })

  it("rejects reviewed input for a different normalized intake", () => {
    const input = buildGenerationInput({ ...normalized, tenantSlug: "other-demo" } as any, "ai-prepared")

    expect(() =>
      prepareReviewedGenerationInputUpdate({
        submission: submission(),
        generationInputJson: JSON.stringify(input),
        reviewerId: 7,
      }),
    ).toThrow("Reviewed GenerationInput must use the staged submission's normalized intake.")
  })
})
