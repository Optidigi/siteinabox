import type { Payload } from "payload"
import { processStoredIntakeSubmission } from "@/lib/intake/processIntakeSubmission"
import { storeIntakeSubmission } from "@/lib/intake/storeIntakeSubmission"
import { createOrRefreshPreviewGrant } from "@/lib/preview/previewAccess"
import { composeFirstSiteReply } from "./catalogHonesty"
import { withBuilderPreview, type BuilderPreviewSnapshot } from "./canvasSnapshot"
import { prepareFirstSiteGenerateFacts, type BuilderFacts } from "./facts"
import type { BuilderChoice } from "./thread"
import { buildRawIntakeFromBuilderFacts, type BuilderContact, type BuilderLegalAcceptance } from "./rawIntake"

export type { BuilderPreviewSnapshot }

export type BuilderChatResult = {
  ok: boolean
  text: string
  facts?: BuilderFacts
  clientSlug?: string
  status?: string
  error?: string
  choices?: BuilderChoice[]
  applied?: boolean
  previewSnapshot?: BuilderPreviewSnapshot | null
}

export const generatePreview = async (
  payload: Payload,
  facts: BuilderFacts,
  contact: BuilderContact,
  legal: BuilderLegalAcceptance,
  pinTenantId?: string | number,
  honesty?: { draft: string; unavailable: string[] },
): Promise<BuilderChatResult> => {
  const readyFacts = prepareFirstSiteGenerateFacts(facts)
  const reply = composeFirstSiteReply(readyFacts, {
    unavailable: honesty?.unavailable ?? [],
  })
  const intake = buildRawIntakeFromBuilderFacts({ facts: readyFacts, contact, legal })
  const stored = await storeIntakeSubmission(payload, intake)
  if (!stored.ok || stored.intakeSubmissionId == null) {
    return {
      ok: false,
      text: "We konden je gegevens nu niet opslaan. Probeer het zo opnieuw.",
      facts: readyFacts,
      error: typeof stored.error?.message === "string" ? stored.error.message : "store_failed",
    }
  }

  const processed = await processStoredIntakeSubmission(
    payload,
    stored.intakeSubmissionId,
    pinTenantId != null ? { retireUnspecifiedPages: true, pinTenantId } : undefined,
  )
  if (!processed.ok || processed.status !== "preview_ready" || processed.generationRunId == null) {
    const detail = typeof processed.error?.message === "string" ? processed.error.message : processed.status
    return {
      ok: false,
      text: "De homepage is nog niet klaar. Zeg “probeer opnieuw” als ik het nog een keer mag bouwen.",
      facts: readyFacts,
      status: processed.status,
      error: detail || "generate_failed",
    }
  }

  const grant = await createOrRefreshPreviewGrant({
    generationRunId: processed.generationRunId,
    customerEmail: contact.email,
    sendEmail: false,
  })

  return withBuilderPreview({
    ok: true,
    text: reply,
    facts: readyFacts,
    clientSlug: grant.clientSlug,
    status: processed.status,
  }, contact.email, true)
}
