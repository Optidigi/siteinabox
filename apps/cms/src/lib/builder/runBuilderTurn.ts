import type { Payload } from "payload"
import { z } from "zod"
import { runExistingSiteTurn } from "@/lib/agent/siteEditorAgent"
import { loadTenantById, loadTenantBySlug } from "@/lib/agent/tools"
import { BuilderFactsSchema, heuristicExtractBuilderFacts, type BuilderFacts } from "./facts"
import { unavailableAsksIn } from "./catalogHonesty"
import { withBuilderPreview } from "./canvasSnapshot"
import { choicesForFirstSite } from "./choices"
import { canUseMastraSiteEditor } from "./extractWithMastra"
import { runFirstSiteTurn } from "./firstSiteAgent"
import { generatePreview, type BuilderChatResult } from "./generatePreview"
import { planBuilderTurn } from "./planTurn"
import { type BuilderContact, type BuilderLegalAcceptance } from "./rawIntake"
import { BuilderChatMessageSchema, BuilderLegalSchema } from "./thread"

export const BuilderChatRequestSchema = z.object({
  message: z.string().trim().min(2).max(4000),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().trim().max(40).default(""),
  legal: BuilderLegalSchema,
  previousFacts: BuilderFactsSchema.nullable().optional(),
  recentMessages: z.array(BuilderChatMessageSchema).max(12).optional(),
  existingClientSlug: z.string().trim().min(1).max(120).nullable().optional(),
  existingTenantId: z.union([z.string(), z.number()]).nullable().optional(),
})

export type BuilderChatRequest = z.infer<typeof BuilderChatRequestSchema>
export type { BuilderChatResult } from "./generatePreview"

export async function runBuilderTurn(payload: Payload, request: BuilderChatRequest): Promise<BuilderChatResult> {
  if (!request.legal.businessUseAccepted || !request.legal.termsAccepted) {
    return {
      ok: false,
      text: "Vink eerst aan dat je dit voor je bedrijf aanvraagt en dat je akkoord gaat met de voorwaarden.",
      error: "legal_required",
    }
  }

  const hasExistingSite = Boolean(request.existingClientSlug || request.existingTenantId != null)
  const contact: BuilderContact = {
    name: request.contactName,
    email: request.contactEmail.trim().toLowerCase(),
    phone: request.contactPhone,
  }
  const legal: BuilderLegalAcceptance = request.legal

  if (hasExistingSite) {
    const tenant = request.existingTenantId != null
      ? await loadTenantById(payload, request.existingTenantId)
      : await loadTenantBySlug(payload, request.existingClientSlug ?? "")
    const facts = heuristicExtractBuilderFacts(request.message, request.previousFacts ?? null)
    if (!tenant) {
      return {
        ok: false,
        text: "Ik kan deze preview-site nu niet wijzigen. Vraag een nieuwe toegangslink of begin opnieuw na registratie.",
        facts,
        clientSlug: request.existingClientSlug ?? undefined,
        error: "tenant_not_found",
      }
    }

    const edited = await runExistingSiteTurn({
      ctx: { payload, tenantId: tenant.id },
      message: request.message,
      pageSlug: "index",
      selectedBlockIndex: null,
      role: "owner",
      recentMessages: request.recentMessages,
      allowRegenerate: true,
      facts,
      useMastra: canUseMastraSiteEditor(),
    })
    if (!edited.regenerate) {
      const slug = tenant.slug ?? request.existingClientSlug
      return withBuilderPreview({
        ok: true,
        text: edited.text,
        facts,
        clientSlug: slug,
        status: "maintaining",
      }, contact.email, edited.applied)
    }
    const generated = await generatePreview(
      payload,
      request.previousFacts ?? facts,
      contact,
      legal,
      tenant.id,
      { draft: edited.text, unavailable: unavailableAsksIn(request.message) },
    )
    return generated
  }

  if (canUseMastraSiteEditor()) {
    try {
      return await runFirstSiteTurn({
        payload,
        message: request.message,
        previous: request.previousFacts ?? null,
        recentMessages: request.recentMessages,
        contact,
        legal,
      })
    } catch {
      // Deterministic gates remain the fallback when the talking agent fails.
    }
  }

  const plan = await planBuilderTurn({
    message: request.message,
    previous: request.previousFacts ?? null,
    recentMessages: request.recentMessages,
    hasExistingSite: false,
  })
  const facts = plan.facts

  if (plan.decision === "ask" || plan.decision === "refuse") {
    return {
      ok: true,
      text: plan.reply,
      facts,
      status: plan.decision === "refuse" ? "unavailable" : "needs_brief",
      choices: plan.decision === "ask" ? choicesForFirstSite(facts, false) : [],
    }
  }

  if (plan.decision !== "generate") {
    return {
      ok: true,
      text: plan.reply,
      facts,
      status: "needs_brief",
      choices: choicesForFirstSite(facts, false),
    }
  }

  return generatePreview(payload, facts, contact, legal, undefined, {
    draft: plan.reply,
    unavailable: unavailableAsksIn(request.message),
  })
}
