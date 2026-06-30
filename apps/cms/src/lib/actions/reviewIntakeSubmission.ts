"use server"

import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { processReviewedIntakeSubmission } from "@/lib/intake/processIntakeSubmission"
import { prepareReviewedGenerationInputUpdate } from "@/lib/intake/reviewIntakeSubmission"
import type { IntakeSubmission } from "@/payload-types"

export async function approveIntakeGenerationInputAction(
  intakeSubmissionId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  const submission = await payload.findByID({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    user,
    depth: 0,
  }) as IntakeSubmission

  const update = prepareReviewedGenerationInputUpdate({
    submission,
    generationInputJson: String(formData.get("reviewedGenerationInput") ?? ""),
    reviewNotes: formData.get("reviewNotes"),
    reviewerId: user.id,
  })

  await payload.update({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    data: update as any,
    user,
    depth: 0,
  })

  revalidatePath(`/generation-runs/submissions/${intakeSubmissionId}`)
  revalidatePath("/generation-runs")
}

export async function generateReviewedIntakeDraftAction(
  intakeSubmissionId: string | number,
  _formData?: FormData,
): Promise<void> {
  await requireRole(["super-admin"])
  const payload = await getPayload({ config })

  await processReviewedIntakeSubmission(payload, intakeSubmissionId)

  revalidatePath(`/generation-runs/submissions/${intakeSubmissionId}`)
  revalidatePath("/generation-runs")
}
