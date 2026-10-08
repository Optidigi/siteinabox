import type { BuilderExecutionContext } from "./executionContext"
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
  options: { executionContext?: BuilderExecutionContext; locale?: "nl" | "en" } = {},
): Promise<BuilderChatResult> => {
  await options.executionContext?.assertActive()
  const readyFacts = prepareFirstSiteGenerateFacts(facts)
  const reply = composeFirstSiteReply(readyFacts, {
    unavailable: honesty?.unavailable ?? [],
    locale: options.locale,
  })
  const intake = buildRawIntakeFromBuilderFacts({ facts: readyFacts, contact, legal })
  const stored = await storeIntakeSubmission(payload, intake, { executionContext: options.executionContext, locale: options.locale })
  if (!stored.ok || stored.intakeSubmissionId == null) {
    return {
      ok: false,
      text: options.locale === "en" ? "We could not save your details. Please try again shortly." : "We konden je gegevens nu niet opslaan. Probeer het zo opnieuw.",
      facts: readyFacts,
      error: typeof stored.error?.message === "string" ? stored.error.message : "store_failed",
    }
  }

  await options.executionContext?.recordGenerationReferences({ intakeSubmissionId: Number(stored.intakeSubmissionId) })
  const processed = await processStoredIntakeSubmission(
    payload,
    stored.intakeSubmissionId,
    { executionContext: options.executionContext, ...(pinTenantId != null ? { retireUnspecifiedPages: true, pinTenantId } : {}) },
  )
  if (!processed.ok || processed.status !== "preview_ready" || processed.generationRunId == null) {
    const detail = typeof processed.error?.message === "string" ? processed.error.message : processed.status
    return {
      ok: false,
      text: options.locale === "en" ? "The homepage is not ready yet. Submit a new request if you want to try again." : "De homepage is nog niet klaar. Zeg “probeer opnieuw” als ik het nog een keer mag bouwen.",
      facts: readyFacts,
      status: processed.status,
      error: detail || "generate_failed",
    }
  }

  const generationRunId = processed.generationRunId
  const createGrant = (req?: Parameters<typeof createOrRefreshPreviewGrant>[0]["req"]) => createOrRefreshPreviewGrant({
    generationRunId,
    customerEmail: contact.email,
    sendEmail: false,
    req,
  })
  const grant = options.executionContext ? await options.executionContext.withWrite(createGrant) : await createGrant()

  return withBuilderPreview({
    ok: true,
    text: reply,
    facts: readyFacts,
    clientSlug: grant.clientSlug,
    status: processed.status,
  }, contact.email, true)
}
