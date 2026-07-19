import type { PublicIntakeSubmission } from "@siteinabox/contracts/generation"
import { findOneDoc } from "@/lib/payloadCollection"
import type { Payload } from "payload"
import type { IntakeSubmission } from "@/payload-types"
import { generationWorkflowStatuses } from "@/collections/IntakeSubmissions"
import { getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { renderEmailInfoTable, renderEmailLayout } from "@/lib/email/emailLayout"
import { hashStableValue, normalizeIntakeSubmission } from "./normalizeIntake"
import { recordIntakeMarketingPreference } from "@/lib/legal/communicationPreferences"
import { cleanEmailHeaderText } from "@/lib/email/templateUtils"

type WorkflowStatus = (typeof generationWorkflowStatuses)[number]

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
const ADMIN_NOTIFICATION_EMAIL = "admin@siteinabox.nl"

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

const storedResult = (doc: IntakeSubmission, reused: boolean): IntakeStorageResult => ({
  ok: doc.status !== "failed",
  reused,
  status: doc.status as WorkflowStatus,
  intakeSubmissionId: doc.id,
  normalizedHash: doc.normalizedHash ?? undefined,
  error: doc.error as Record<string, unknown> | undefined,
})

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const intakeInternalNotificationTemplate = (doc: IntakeSubmission) => {
  const status = cleanText(doc.status) ?? "onbekend"
  const businessName = cleanText(doc.businessName) ?? "Onbekend bedrijf"
  const contactName = cleanText(doc.contactName) ?? "-"
  const contactEmail = cleanText(doc.contactEmail) ?? "-"
  const source = cleanText(doc.source) ?? "-"
  const subjectBusinessName = cleanEmailHeaderText(businessName) || "Onbekend bedrijf"
  const subject = status === "failed"
    ? `Opslaan intake mislukt: ${subjectBusinessName}`
    : `Nieuwe intake opgeslagen: ${subjectBusinessName}`
  const rows: Array<[string, string]> = [
    ["Status", status],
    ["Bedrijf", businessName],
    ["Contactpersoon", contactName],
    ["E-mail", contactEmail],
    ["Bron", source],
    ["Intake ID", String(doc.id ?? "-")],
  ]
  const errorMessage = doc.error && typeof doc.error === "object"
    ? cleanText((doc.error as Record<string, unknown>).message)
    : null
  const body = `${renderEmailInfoTable(rows)}${errorMessage ? `<p><strong>Fout:</strong> ${escapeHtml(errorMessage)}</p>` : ""}`
  return {
    subject,
    html: renderEmailLayout({ eyebrow: "Interne melding", title: status === "failed" ? "Opslaan intake mislukt" : "Nieuwe intake opgeslagen", intro: "Een openbare intake is verwerkt in het CMS.", body, footer: "internal" }),
    text: [
      subject,
      `Status: ${status}`,
      `Bedrijf: ${businessName}`,
      `Contactpersoon: ${contactName}`,
      `E-mail: ${contactEmail}`,
      `Bron: ${source}`,
      `Intake ID: ${String(doc.id ?? "-")}`,
      ...(errorMessage ? [`Fout: ${errorMessage}`] : []),
    ].join("\n"),
  }
}

export async function notifyAdminOfIntakeStorage(payload: Payload, doc: IntakeSubmission) {
  try {
    const message = intakeInternalNotificationTemplate(doc)
    await sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      from: getPlatformMailSender(),
      subject: message.subject,
      html: message.html,
      text: message.text,
      intent: "intake.internal_notification",
      payload: payload as Parameters<typeof sendEmail>[0]["payload"],
    })
  } catch (error) {
    payload.logger.warn({
      intakeSubmissionId: doc.id,
      status: doc.status,
      error: error instanceof Error ? error.message : "Unknown intake notification error",
    }, "[intake] internal notification failed")
  }
}

export async function storeIntakeSubmission(
  payload: Payload,
  raw: PublicIntakeSubmission,
): Promise<IntakeStorageResult> {
  try {
    const normalized = normalizeIntakeSubmission(raw)
    const normalizedHash = hashStableValue(normalized)
    const idempotencyKey = `public-intake:normalized:${hashStableValue({ raw, normalized })}`
    const existing = await findOneDoc(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
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
    })

    if ("legal" in raw && normalized.contact?.email) {
      try {
        await recordIntakeMarketingPreference({
          payload,
          intakeId: intake.id,
          email: normalized.contact.email,
          legal: raw.legal,
        })
      } catch (error) {
        payload.logger.warn({
          intakeSubmissionId: intake.id,
          error: error instanceof Error ? error.message : "Unknown preference error",
        }, "[intake] marketing preference persistence failed")
      }
    }

    await notifyAdminOfIntakeStorage(payload, intake)
    return storedResult(intake, false)
  } catch (err) {
    const idempotencyKey = `public-intake:invalid:${hashStableValue(raw)}`
    const existing = await findOneDoc(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
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
    })

    await notifyAdminOfIntakeStorage(payload, intake)
    return storedResult(intake, false)
  }
}
