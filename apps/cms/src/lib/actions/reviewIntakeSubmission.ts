"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { IntakeSubmission } from "@/payload-types"
import { requireRole } from "@/lib/authGate"
import { processReviewedIntakeSubmission } from "@/lib/intake/processIntakeSubmission"
import { prepareReviewedGenerationInputUpdate } from "@/lib/intake/reviewIntakeSubmission"
import { relationId } from "@/lib/queries/generationOperations"

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
    data: update as Partial<IntakeSubmission>,
    user,
    depth: 0,
  })

  revalidatePath(`/operations/intakes/${intakeSubmissionId}`)
  revalidatePath("/operations")
}

export async function generateReviewedIntakeDraftAction(
  intakeSubmissionId: string | number,
  _formData?: FormData,
): Promise<void> {
  await requireRole(["super-admin"])
  const payload = await getPayload({ config })

  await processReviewedIntakeSubmission(payload, intakeSubmissionId)

  revalidatePath(`/operations/intakes/${intakeSubmissionId}`)
  revalidatePath("/operations")
}

export async function deleteSafeIntakeSubmissionAction(
  intakeSubmissionId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const confirmation = String(formData.get("confirmDelete") ?? "").trim()
  if (confirmation !== "DELETE") {
    throw new Error("Type DELETE to confirm this request deletion.")
  }

  const payload = await getPayload({ config })
  const submission = await payload.findByID({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    user,
    depth: 0,
  }) as IntakeSubmission

  if (relationId(submission.generationRun)) {
    throw new Error("This request already has a generation run and cannot be deleted.")
  }
  if (relationId(submission.tenant)) {
    throw new Error("This request already has a tenant and cannot be deleted.")
  }

  const linkedRuns = await payload.find({
    collection: "site-generation-runs",
    where: { intakeSubmission: { equals: intakeSubmissionId } },
    limit: 1,
    depth: 0,
    user,
  })

  if (linkedRuns.totalDocs > 0) {
    throw new Error("This request is linked to a generation run and cannot be deleted.")
  }

  await payload.delete({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    user,
    depth: 0,
  })

  revalidatePath("/operations")
  redirect("/operations/intakes")
}
