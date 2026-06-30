import { GenerationInputSchema, NormalizedIntakeSchema, type GenerationInput } from "@siteinabox/contracts/generation"
import { buildGenerationInput, hashStableValue } from "@/lib/intake/normalizeIntake"
import type { IntakeSubmission } from "@/payload-types"

type ReviewableSubmission = Pick<
  IntakeSubmission,
  "id" | "normalized" | "normalizedHash" | "reviewedGenerationInput" | "statusTransitions"
>

export type ReviewedGenerationInputUpdate = {
  reviewedGenerationInput: GenerationInput
  reviewNotes: string | null
  reviewedAt: string
  reviewedBy: string | number
  statusTransitions: NonNullable<IntakeSubmission["statusTransitions"]>
}

const cleanNotes = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

const parseJsonObject = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error("Reviewed GenerationInput must be valid JSON.")
  }
}

const assertMatchesSubmission = (input: GenerationInput, submission: ReviewableSubmission): void => {
  const normalized = NormalizedIntakeSchema.parse(submission.normalized)
  const expectedHash = submission.normalizedHash ?? hashStableValue(normalized)
  const actualHash = hashStableValue(input.normalizedIntake)
  if (actualHash !== expectedHash) {
    throw new Error("Reviewed GenerationInput must use the staged submission's normalized intake.")
  }
}

export function defaultReviewedGenerationInput(submission: ReviewableSubmission): GenerationInput {
  if (submission.reviewedGenerationInput) {
    const parsed = GenerationInputSchema.safeParse(submission.reviewedGenerationInput)
    if (parsed.success) return parsed.data
  }

  const normalized = NormalizedIntakeSchema.parse(submission.normalized)
  return buildGenerationInput(normalized, "draft")
}

export function prepareReviewedGenerationInputUpdate(input: {
  submission: ReviewableSubmission
  generationInputJson: string
  reviewNotes?: unknown
  reviewerId: string | number
  now?: string
}): ReviewedGenerationInputUpdate {
  const parsed = GenerationInputSchema.parse(parseJsonObject(input.generationInputJson))
  assertMatchesSubmission(parsed, input.submission)

  const reviewedAt = input.now ?? new Date().toISOString()
  const reviewedGenerationInput: GenerationInput = {
    ...parsed,
    status: "admin-approved",
    approvedAt: reviewedAt,
    approvedBy: String(input.reviewerId),
    notes: cleanNotes(input.reviewNotes),
  }

  return {
    reviewedGenerationInput,
    reviewNotes: cleanNotes(input.reviewNotes),
    reviewedAt,
    reviewedBy: input.reviewerId,
    statusTransitions: [
      ...(input.submission.statusTransitions ?? []),
      {
        status: "normalized",
        at: reviewedAt,
        message: "Admin approved reviewed GenerationInput for generation handoff",
      },
    ],
  }
}
