import {
  PublicIntakeSubmissionSchema,
  type PublicIntakeSubmission,
} from "@siteinabox/contracts/generation"

export type PublicIntakeValidationResult =
  | { ok: true; intake: PublicIntakeSubmission }
  | { ok: false; message: string; issues: Array<{ path: Array<string | number>; message: string }> }

export const parsePublicIntakeSubmission = (body: Record<string, unknown>): PublicIntakeValidationResult => {
  if ("mockFixture" in body) {
    return {
      ok: false,
      message: "Invalid intake body",
      issues: [{ path: ["mockFixture"], message: "mockFixture is not accepted by the public intake API" }],
    }
  }

  const parsed = PublicIntakeSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid intake body",
      issues: parsed.error.issues.map((entry) => ({
        path: entry.path.filter((segment): segment is string | number =>
          typeof segment === "string" || typeof segment === "number",
        ),
        message: entry.message,
      })),
    }
  }

  return {
    ok: true,
    intake: {
      ...parsed.data,
      source: "public-intake",
    } as PublicIntakeSubmission,
  }
}
