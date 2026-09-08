import { z } from "zod"
import { interpretMaintainerIntent, type MaintainerIntent } from "@/lib/agent/interpretMaintainer"
import {
  BuilderFactsSchema,
  applyModuleAnswer,
  canGenerateFirstHomepage,
  firstSiteMissing,
  hasModuleAnswer,
  heuristicExtractBuilderFacts,
  looksLikeChitchat,
  looksLikeOfferList,
  mergeBuilderFacts,
  messageLooksLikeBrief,
  namedBuilderOffers,
  type BuilderFacts,
} from "./facts"
import { shouldApplyContactAnswer } from "./choices"
import {
  composeAskBriefReply,
  composeAskLookReply,
  composeConfirmGenerateReply,
  composeFirstSiteReply,
  composeMaintainerNoneReply,
  composeUnavailableReply,
  unavailableAsksIn,
} from "./catalogHonesty"
import type { BuilderChatMessage } from "./thread"

export const BuilderTurnPlanSchema = z.object({
  facts: BuilderFactsSchema,
  decision: z.enum(["ask", "generate", "maintain", "refuse"]),
  reply: z.string().trim().min(8).max(1600),
  maintainerKind: z.enum([
    "setTheme",
    "setAppointments",
    "setHours",
    "setContact",
    "updateSectionProps",
    "replaceSection",
    "regenerate",
    "none",
  ]).default("none"),
  headingOrBody: z.enum(["heading", "body"]).nullable().optional(),
  headingOrBodyValue: z.string().trim().max(400).nullable().optional(),
  variant: z.string().trim().max(40).nullable().optional(),
  open: z.string().trim().max(8).nullable().optional(),
  close: z.string().trim().max(8).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(160).nullable().optional(),
})

export type BuilderTurnPlan = z.infer<typeof BuilderTurnPlanSchema>

export const maintainerIntentFromPlan = (plan: BuilderTurnPlan, message: string): MaintainerIntent => {
  const kind = plan.maintainerKind
  if (kind === "regenerate") return { kind: "regenerate" }
  if (kind === "setTheme") return { kind: "setTheme" }
  if (kind === "setAppointments") return { kind: "setAppointments" }
  if (kind === "setHours" && plan.open && plan.close) {
    return { kind: "setHours", open: plan.open, close: plan.close }
  }
  if (kind === "setContact") {
    return { kind: "setContact", phone: plan.phone ?? undefined, address: plan.address ?? undefined }
  }
  if (kind === "replaceSection" && plan.variant) {
    return { kind: "replaceSection", variant: plan.variant }
  }
  if (kind === "updateSectionProps" && plan.headingOrBody && plan.headingOrBodyValue) {
    return { kind: "updateSectionProps", field: plan.headingOrBody, value: plan.headingOrBodyValue }
  }
  return interpretMaintainerIntent(message)
}

const fallbackPlan = (input: {
  message: string
  previous: BuilderFacts | null
  recentMessages?: BuilderChatMessage[]
  hasExistingSite: boolean
}): BuilderTurnPlan => {
  const choiceLabels = [...(input.recentMessages ?? [])]
    .reverse()
    .find((entry) => entry.role === "assistant")
    ?.choices
    ?.map((choice) => choice.label) ?? []
  const extracted = heuristicExtractBuilderFacts(input.message, input.previous, { choiceLabels })
  const unavailable = unavailableAsksIn(input.message)
  if (input.hasExistingSite) {
    const intent = interpretMaintainerIntent(input.message)
    if (intent.kind === "none" && unavailable.length > 0) {
      return BuilderTurnPlanSchema.parse({
        facts: extracted,
        decision: "refuse",
        reply: composeUnavailableReply(unavailable),
        maintainerKind: "none",
      })
    }
    return BuilderTurnPlanSchema.parse({
      facts: extracted,
      decision: "maintain",
      reply: intent.kind === "none" ? composeMaintainerNoneReply() : "Ik pas het aan.",
      maintainerKind: intent.kind,
      headingOrBody: intent.kind === "updateSectionProps" ? intent.field : null,
      headingOrBodyValue: intent.kind === "updateSectionProps" ? intent.value : null,
      variant: intent.kind === "replaceSection" ? intent.variant : null,
      open: intent.kind === "setHours" ? intent.open : null,
      close: intent.kind === "setHours" ? intent.close : null,
      phone: intent.kind === "setContact" ? intent.phone ?? null : null,
      address: intent.kind === "setContact" ? intent.address ?? null : null,
    })
  }

  if (
    unavailable.length > 0
    && !messageLooksLikeBrief(input.message)
    && !hasModuleAnswer(input.message)
    && !looksLikeOfferList(input.message)
  ) {
    return BuilderTurnPlanSchema.parse({
      facts: extracted,
      decision: "refuse",
      reply: composeUnavailableReply(unavailable),
      maintainerKind: "none",
    })
  }

  const facts = shouldApplyContactAnswer(input.message, extracted, input.recentMessages)
    ? applyModuleAnswer(input.message, extracted)
    : extracted
  if (canGenerateFirstHomepage(facts, input.message, input.previous)) {
    return BuilderTurnPlanSchema.parse({
      facts,
      decision: "generate",
      reply: composeFirstSiteReply(facts, { unavailable }),
      maintainerKind: "none",
    })
  }

  const missing = firstSiteMissing(facts)
  const named = namedBuilderOffers(facts).map((offer) => offer.value)
  let reply = composeAskBriefReply()
  if (missing.includes("diensten")) {
    reply = named.length > 0
      ? `Ik zet ${named.join(" en ")} erin. Noem nog een tweede dienst, in je eigen woorden.`
      : "Welke twee diensten bied je aan? Gewoon zoals jij ze noemt."
  } else if (missing.includes("plaats")) {
    reply = "In welke plaats of regio werk je?"
  } else if (missing.includes("contactvoorkeur")) {
    reply = "Hoe nemen bezoekers contact op? Tik een optie hieronder."
  } else if (missing.includes("uitstraling")) {
    reply = composeAskLookReply()
  } else {
    reply = composeConfirmGenerateReply()
  }
  if (looksLikeChitchat(input.message) && missing.length > 0) {
    reply = `Goed. ${reply}`
  }

  return BuilderTurnPlanSchema.parse({
    facts,
    decision: "ask",
    reply,
    maintainerKind: "none",
  })
}

const replySellsCompleteSite = (reply: string): boolean =>
  /\b(complete (multi-?page )?site|alle pagina'?s|volledige website|FAQ-pagina|portfoliopagina)\b/i.test(reply)

/**
 * Policy stays deterministic (catalog + brief gates). Kept for tests: Mastra may
 * never override ask/refuse/generate decisions, only optional copy when it agrees.
 */
export const overlayMastraPlan = (
  safe: BuilderTurnPlan,
  mastra: BuilderTurnPlan,
): BuilderTurnPlan => {
  const facts = mergeBuilderFacts(safe.facts, mastra.facts)
  if (safe.decision === "refuse") {
    const reply = mastra.decision === "refuse" && mastra.reply.length >= 8 && !replySellsCompleteSite(mastra.reply)
      ? mastra.reply
      : safe.reply
    if (!/catalogus|nog niet|FAQ|portfolio|over-ons/i.test(reply)) {
      return { ...safe, facts }
    }
    return { ...safe, facts, reply }
  }
  if (safe.decision === "ask") {
    const reply = mastra.decision === "ask" && mastra.reply.length >= 8 && !replySellsCompleteSite(mastra.reply)
      ? mastra.reply
      : safe.reply
    return { ...safe, facts, reply }
  }
  if (safe.decision === "generate") {
    const reply = mastra.decision === "generate"
      && mastra.reply.length >= 40
      && /homepage|hero|diensten|catalogus/i.test(mastra.reply)
      && !replySellsCompleteSite(mastra.reply)
      ? mastra.reply
      : safe.reply
    return { ...safe, facts: { ...facts, briefStage: "ready" }, reply, maintainerKind: "none" }
  }
  return BuilderTurnPlanSchema.parse({
    ...safe,
    facts,
    reply: mastra.decision === "maintain" && mastra.reply.length >= 8 ? mastra.reply : safe.reply,
    maintainerKind: mastra.maintainerKind !== "none" ? mastra.maintainerKind : safe.maintainerKind,
    headingOrBody: mastra.headingOrBody ?? safe.headingOrBody,
    headingOrBodyValue: mastra.headingOrBodyValue ?? safe.headingOrBodyValue,
    variant: mastra.variant ?? safe.variant,
    open: mastra.open ?? safe.open,
    close: mastra.close ?? safe.close,
    phone: mastra.phone ?? safe.phone,
    address: mastra.address ?? safe.address,
  })
}

export async function planBuilderTurn(input: {
  message: string
  previous: BuilderFacts | null
  recentMessages?: BuilderChatMessage[]
  hasExistingSite: boolean
}): Promise<BuilderTurnPlan> {
  return fallbackPlan(input)
}
