import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import type { Payload } from "payload"
import { COLOR_SCHEME_IDS, FONT_SCHEME_IDS, SHAPE_SCHEME_IDS } from "@siteinabox/contracts"
import {
  defaultMastraChatReasoningEffort,
  defaultMastraModelId,
  mastraOpenAIProviderOptions,
} from "@/lib/ai-generation/mastraProvider"
import { composeUnavailableReply, sitegenCatalogDigest, unavailableAsksIn } from "./catalogHonesty"
import { choicesFromAssistantText, shouldApplyContactAnswer } from "./choices"
import {
  BuilderFactsSchema,
  applyModuleAnswer,
  hasMinimumFirstSiteBrief,
  heuristicExtractBuilderFacts,
  looksLikeOfferList,
  messageLooksLikeBrief,
  firstSiteMissing,
  prepareFirstSiteGenerateFacts,
  type BuilderFacts,
} from "./facts"
import { generatePreview, type BuilderChatResult } from "./generatePreview"
import type { BuilderContact, BuilderLegalAcceptance } from "./rawIntake"
import { BuilderChoiceSchema, type BuilderChatMessage, type BuilderChoice } from "./thread"

const FIRST_SITE_INSTRUCTIONS = [
  "Je bent de Site in a Box-builder. Doel: een passende eerste homepage, geen script en geen formulier.",
  "Nederlands, kort, als een collega. Elke beurt één vraag. Tools doen het werk. Geen markdown, geen sterretjes, geen **vet**.",
  "Volgorde: (1) naam alleen als je twijfelt of het een bedrijfsnaam is — verzin geen naam uit een sfeerzin zoals “ik ben speciaal”; (2) vak en werkgebied; (3) twee of meer diensten in hun woorden; (4) hoe bezoekers contact opnemen; (5) uitstraling als die nog onbekend is.",
  "Eén vraag per beurt. Knoppen alleen via askUser, en alleen voor díe vraag. Nooit contactknoppen bij een naam- of diensten-vraag.",
  "Slordige taal is data. Geen moraal, geen “houd het netjes”. Bevestig wilde parses in één vraag: “Mars is de plaats, geen dienst?”. Plaatsnamen zijn geen diensten.",
  "Als ze een gap niet kunnen of willen invullen: vul jij in vanuit wat je wél weet, zeg dat kort, en ga door. Niet blijven hangen.",
  "Look: geen hex of variant-IDs. Vraag sfeer in gewone taal of laat ze een knop tikken. Als ze het niet weten: kies jij uit vak en toon (praktisch → emerald of amber, clear-modern, sharp/soft; intiem → terracotta of red, friendly-organic of editorial, soft/rounded; studio/coach → blue of terracotta, editorial, soft), zeg welke keuze, en genereer.",
  "noteBrief vóór generateHomepage: vak, bezoekersverhaal (intro/situation/approach), letterlijke diensten, gebied, contact, thema-IDs. Geen generieke “Wij helpen klanten lokaal” als jij het vak kent.",
  "Geen foto’s in deze ronde: hero-01. Afsprakenblok alleen als ze een afspraak willen. CTA anders.",
  "Neem diensten letterlijk, ook erotisch of ongewoon. Herschrijf ze niet. Geen geopolitiek, geen live weer.",
  "Heel Nederland is een geldig gebied. voelen/langskomen → afspraak. Geen telefoonnummer nodig om te bouwen.",
  "Als selectedActions al bellen én WhatsApp heeft, drop WhatsApp niet. Bellen en WhatsApp = phone-whatsapp.",
  "Als je genoeg hebt (ook na zelf ingevulde look): noteBrief en generateHomepage.",
  sitegenCatalogDigest(),
  "Verzin geen KVK, reviews, prijzen of HTML.",
].join(" ")

const lastAssistantChoiceLabels = (messages: BuilderChatMessage[] | undefined): string[] => {
  const last = [...(messages ?? [])].reverse().find((entry) => entry.role === "assistant")
  return last?.choices?.map((choice) => choice.label) ?? []
}

const applyContactPatch = (
  facts: BuilderFacts,
  contact: "phone" | "whatsapp" | "phone-whatsapp" | "appointment" | "form",
): BuilderFacts => {
  if (contact === "phone-whatsapp") {
    return BuilderFactsSchema.parse({
      ...facts,
      formType: "none",
      selectedActions: ["phone", "whatsapp"],
      briefStage: "ready",
    })
  }
  if (contact === "phone") {
    return BuilderFactsSchema.parse({
      ...facts,
      formType: "none",
      selectedActions: facts.selectedActions.includes("whatsapp") ? ["phone", "whatsapp"] : ["phone"],
      briefStage: "ready",
    })
  }
  if (contact === "whatsapp") {
    const selectedActions = [...new Set([...facts.selectedActions.filter((item) => item !== "message"), "whatsapp" as const])]
    return BuilderFactsSchema.parse({
      ...facts,
      formType: facts.formType === "appointment" ? "appointment" : "none",
      selectedActions: selectedActions.length > 0 ? selectedActions : ["whatsapp"],
      briefStage: "ready",
    })
  }
  if (contact === "appointment") {
    return BuilderFactsSchema.parse({
      ...facts,
      formType: "appointment",
      selectedActions: ["appointment", ...facts.selectedActions.filter((item) => item !== "appointment")],
      briefStage: "ready",
    })
  }
  return BuilderFactsSchema.parse({
    ...facts,
    formType: "message",
    selectedActions: facts.selectedActions.includes("message") ? facts.selectedActions : ["message", ...facts.selectedActions],
    briefStage: "ready",
  })
}

export async function runFirstSiteTurn(input: {
  payload: Payload
  message: string
  previous: BuilderFacts | null
  recentMessages?: BuilderChatMessage[]
  contact: BuilderContact
  legal: BuilderLegalAcceptance
}): Promise<BuilderChatResult> {
  const choiceLabels = lastAssistantChoiceLabels(input.recentMessages)
  let facts = heuristicExtractBuilderFacts(input.message, input.previous, { choiceLabels })
  if (shouldApplyContactAnswer(input.message, facts, input.recentMessages)) {
    facts = applyModuleAnswer(input.message, facts)
  }

  const unavailable = unavailableAsksIn(input.message)
  if (
    unavailable.length > 0
    && !hasMinimumFirstSiteBrief(facts)
    && !messageLooksLikeBrief(input.message)
    && !shouldApplyContactAnswer(input.message, facts, input.recentMessages)
    && !looksLikeOfferList(input.message)
  ) {
    return {
      ok: true,
      text: composeUnavailableReply(unavailable),
      facts,
      status: "unavailable",
      choices: [],
    }
  }

  const generatedRef: { current: BuilderChatResult | null } = { current: null }
  let askedChoices: BuilderChoice[] = []
  const effort = defaultMastraChatReasoningEffort()
  const providerOptions = mastraOpenAIProviderOptions(effort)

  const noteBrief = createTool({
    id: "noteBrief",
    description: "Sla identiteit, bezoekersverhaal, diensten, gebied, contact en thema-IDs op. Diensten letterlijk, zonder te herschrijven.",
    inputSchema: z.object({
      businessName: z.string().trim().min(2).max(120).optional(),
      trade: z.string().trim().min(2).max(80).optional(),
      region: z.string().trim().min(2).max(120).optional(),
      offers: z.array(z.object({ value: z.string().trim().min(3).max(60) })).min(1).max(6).optional(),
      intro: z.string().trim().min(20).max(500).optional(),
      audience: z.string().trim().min(8).max(240).optional(),
      situation: z.string().trim().min(20).max(360).optional(),
      approach: z.string().trim().min(20).max(400).optional(),
      contact: z.enum(["phone", "whatsapp", "phone-whatsapp", "appointment", "form"]).optional(),
      colorSchemeId: z.enum(COLOR_SCHEME_IDS).optional(),
      fontSchemeId: z.enum(FONT_SCHEME_IDS).optional(),
      shapeSchemeId: z.enum(SHAPE_SCHEME_IDS).optional(),
      appearanceMode: z.enum(["light", "dark"]).optional(),
      notes: z.string().trim().max(500).optional(),
    }),
    execute: async (patch) => {
      let next = { ...facts }
      if (patch.businessName) next.businessName = patch.businessName
      if (patch.trade) next.trade = patch.trade
      if (patch.region) next.region = patch.region
      if (patch.offers?.length) {
        next.offers = patch.offers.length >= 2
          ? patch.offers
          : [...patch.offers, ...facts.offers.filter((offer) => offer.value !== patch.offers?.[0]?.value)].slice(0, 6)
      }
      if (patch.intro) next.intro = patch.intro
      if (patch.audience) next.audience = patch.audience
      if (patch.situation) next.situation = patch.situation
      if (patch.approach) next.approach = patch.approach
      if (patch.colorSchemeId) {
        next.colorSchemeId = patch.colorSchemeId
        next.lookConfirmed = true
      }
      if (patch.fontSchemeId) {
        next.fontSchemeId = patch.fontSchemeId
        next.lookConfirmed = true
      }
      if (patch.shapeSchemeId) {
        next.shapeSchemeId = patch.shapeSchemeId
        next.lookConfirmed = true
      }
      if (patch.appearanceMode) {
        next.appearanceMode = patch.appearanceMode
        next.lookConfirmed = true
      }
      if (patch.notes) next.notes = patch.notes
      if (patch.contact) next = applyContactPatch(next, patch.contact)
      facts = BuilderFactsSchema.parse(next)
      return { ok: true, facts, missing: firstSiteMissing(facts), enough: hasMinimumFirstSiteBrief(facts) }
    },
  })

  const askUser = createTool({
    id: "askUser",
    description: "Toon tot vier knoppen die exact bij jouw vraag horen. Niet aanroepen als je geen vraag stelt.",
    inputSchema: z.object({
      choices: z.array(BuilderChoiceSchema).min(1).max(4),
    }),
    execute: async (patch) => {
      askedChoices = patch.choices
      return { ok: true, choices: askedChoices }
    },
  })

  const generateHomepage = createTool({
    id: "generateHomepage",
    description: "Bouw de eerste homepage wanneer vak, gebied, diensten en contact bekend zijn. Look mag jij hebben afgeleid.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!hasMinimumFirstSiteBrief(facts)) {
        return { ok: false, missing: firstSiteMissing(facts), reason: "brief_incomplete" }
      }
      const ready = prepareFirstSiteGenerateFacts(facts)
      facts = ready
      const result = await generatePreview(input.payload, ready, input.contact, input.legal)
      generatedRef.current = result
      return result.ok
        ? { ok: true, clientSlug: result.clientSlug }
        : { ok: false, error: result.error ?? "generate_failed" }
    },
  })

  const agent = new Agent({
    id: "siab-first-site",
    name: "Site in a Box first-site builder",
    instructions: {
      role: "system",
      content: FIRST_SITE_INSTRUCTIONS,
      providerOptions,
    },
    model: defaultMastraModelId(),
    tools: { noteBrief, askUser, generateHomepage },
  })

  const history = (input.recentMessages ?? []).slice(-8)
    .map((entry) => `${entry.role}: ${entry.text}`)
    .join("\n")
  const result = await agent.generate(
    [
      history,
      `Bekende feiten: ${JSON.stringify(facts)}`,
      `Hint ontbrekend (geen harde poort): ${JSON.stringify(firstSiteMissing(facts))}`,
      "Antwoord in 1–2 zinnen. Eén vraag. Geen markdown. Geen herhaalde keuzelijst.",
      input.message,
    ].filter(Boolean).join("\n\n"),
    { toolChoice: "auto", providerOptions, maxSteps: 4 },
  )

  const spoken = typeof result.text === "string" ? result.text.trim() : ""
  const generated = generatedRef.current
  if (generated) {
    return {
      ...generated,
      facts,
      text: spoken.length >= 8 ? spoken : generated.text,
      choices: generated.ok ? [] : askedChoices,
    }
  }

  const text = spoken.length >= 8
    ? spoken
    : "Oké — zeg het in je eigen woorden, of tik een knop als die bij mijn vraag past."
  const choices = askedChoices.length > 0 ? askedChoices : choicesFromAssistantText(text, facts)
  return {
    ok: true,
    text,
    facts,
    status: "needs_brief",
    choices,
  }
}
