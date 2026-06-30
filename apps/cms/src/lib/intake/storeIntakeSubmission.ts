import type { PublicIntakeSubmission } from "@siteinabox/contracts/generation"
import type { Payload } from "payload"
import { generationWorkflowStatuses } from "@/collections/IntakeSubmissions"
import { hashStableValue, normalizeIntakeSubmission } from "./normalizeIntake"

type WorkflowStatus = (typeof generationWorkflowStatuses)[number]

type PayloadDoc = Record<string, any>

type Transition = {
  status: WorkflowStatus
  at: string
  message?: string
}

export type IntakeStorageResult = {
  ok: boolean
  reused: boolean
  status: WorkflowStatus
  intakeSubmissionId?: string | number
  normalizedHash?: string
  error?: Record<string, unknown>
}

const now = () => new Date().toISOString()

const transition = (status: WorkflowStatus, message?: string): Transition => ({
  status,
  at: now(),
  ...(message ? { message } : {}),
})

const errorPayload = (err: unknown): Record<string, unknown> => ({
  message: err instanceof Error ? err.message : "Unknown intake storage error",
})

const submittedBusinessName = (raw: PublicIntakeSubmission): string => {
  const value = "businessName" in raw ? raw.businessName : raw.company?.companyName
  return typeof value === "string" && value.trim() ? value.trim() : "Invalid intake"
}

const submittedContactName = (raw: PublicIntakeSubmission): string | null | undefined =>
  "contactName" in raw ? raw.contactName : "finalDetails" in raw ? raw.finalDetails.name : undefined

const submittedContactEmail = (raw: PublicIntakeSubmission): string | null | undefined =>
  "contactEmail" in raw ? raw.contactEmail : "finalDetails" in raw ? raw.finalDetails.email : undefined

const findOne = async (payload: Payload, collection: string, where: Record<string, unknown>): Promise<PayloadDoc | null> => {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return (result.docs[0] as PayloadDoc | undefined) ?? null
}

const storedResult = (doc: PayloadDoc, reused: boolean): IntakeStorageResult => ({
  ok: doc.status === "normalized",
  reused,
  status: doc.status as WorkflowStatus,
  intakeSubmissionId: doc.id,
  normalizedHash: doc.normalizedHash,
  error: doc.error as Record<string, unknown> | undefined,
})

export async function storeIntakeSubmission(
  payload: Payload,
  raw: PublicIntakeSubmission,
): Promise<IntakeStorageResult> {
  try {
    const normalized = normalizeIntakeSubmission(raw)
    const normalizedHash = hashStableValue(normalized)
    const idempotencyKey = `public-intake:normalized:${hashStableValue({ raw, normalized })}`
    const existing = await findOne(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
    if (existing) return storedResult(existing, true)

    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: normalized.businessName,
        contactName: normalized.contact?.name,
        contactEmail: normalized.contact?.email,
        source: raw.source ?? "public-intake",
        status: "normalized",
        idempotencyKey,
        raw,
        normalized,
        normalizedHash,
        statusTransitions: [
          transition("submitted"),
          transition("normalized", "Public intake stored for manual review"),
        ],
      },
      depth: 0,
      overrideAccess: true,
    } as any) as PayloadDoc

    return storedResult(intake, false)
  } catch (err) {
    const idempotencyKey = `public-intake:invalid:${hashStableValue(raw)}`
    const existing = await findOne(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
    if (existing) return storedResult(existing, true)

    const failure = errorPayload(err)
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: submittedBusinessName(raw),
        contactName: submittedContactName(raw),
        contactEmail: submittedContactEmail(raw),
        source: raw.source ?? "public-intake",
        status: "failed",
        idempotencyKey,
        raw,
        error: failure,
        statusTransitions: [
          transition("submitted"),
          transition("failed", "Normalization failed"),
        ],
      },
      depth: 0,
      overrideAccess: true,
    } as any) as PayloadDoc

    return storedResult(intake, false)
  }
}
