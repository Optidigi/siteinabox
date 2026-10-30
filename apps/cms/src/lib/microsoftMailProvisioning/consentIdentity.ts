import { z } from "zod"

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function validMicrosoftMailSignatoryName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 128 && !/^admin$/i.test(value.trim())
}

const correctionSchema = z.object({
  id: z.string().uuid(), source: z.literal("operator-confirmed"), orderId: z.number().int().positive(),
  actorUserId: z.string().min(1), actorEmail: z.string().email(), originalAcceptedAt: z.string().datetime(),
  previousFirstName: z.string(), previousLastName: z.string(),
  firstName: z.string().refine(validMicrosoftMailSignatoryName), lastName: z.string().refine(validMicrosoftMailSignatoryName),
  recordedAt: z.string().datetime(), reason: z.string().trim().min(1).max(1000),
}).strict()

/** Correct a recorded actor's legal name without rewriting their original acceptance. */
export function microsoftMailProviderConsent(data: Record<string, unknown>): Record<string, unknown> {
  const consent = record(data.customerConsent)
  if (data.mcaSignatoryCorrection == null) return consent
  const parsed = correctionSchema.safeParse(data.mcaSignatoryCorrection)
  if (!parsed.success) throw new Error("Invalid Microsoft agreement name correction evidence.")
  const correction = parsed.data
  if (String(correction.orderId) !== String(data.commerceOrderId) || correction.actorUserId !== consent.actorUserId ||
      correction.actorEmail !== consent.actorEmail || correction.originalAcceptedAt !== consent.acceptedAt ||
      correction.previousFirstName !== consent.signatoryFirstName || correction.previousLastName !== consent.signatoryLastName ||
      consent.mcaAccepted !== true || consent.serviceAuthorized !== true || consent.confirmSignatoryAuthority !== true ||
      Date.parse(correction.recordedAt) < Date.parse(correction.originalAcceptedAt) || Date.parse(correction.recordedAt) > Date.now()) {
    throw new Error("Microsoft agreement name correction does not match the accepted order and actor.")
  }
  return { ...consent, signatoryFirstName: correction.firstName.trim(), signatoryLastName: correction.lastName.trim() }
}
