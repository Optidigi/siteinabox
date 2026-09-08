import {
  firstSiteMissing,
  firstSiteRequiredMissing,
  namedBuilderOffers,
  type BuilderFacts,
} from "./facts"
import {
  CONTACT_CHOICES,
  FEEL_CHOICES,
  GENERATE_CHOICE,
  type BuilderChatMessage,
  type BuilderChoice,
} from "./thread"

export { CONTACT_CHOICES, FEEL_CHOICES, GENERATE_CHOICE }

const normalizeChoiceText = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase()

export const knownBuilderChoiceLabels = (extra: string[] = []): string[] => [
  ...CONTACT_CHOICES.map((choice) => choice.label),
  GENERATE_CHOICE.label,
  ...FEEL_CHOICES.map((choice) => choice.label),
  ...extra,
]

export const isKnownBuilderChoiceLabel = (message: string, extra: string[] = []): boolean => {
  const normalized = normalizeChoiceText(message)
  if (!normalized) return false
  return knownBuilderChoiceLabels(extra).some((label) => normalizeChoiceText(label) === normalized)
}

const applyLookFromFeelId = (id: string): Partial<BuilderFacts> | null => {
  if (id === "feel-terracotta") {
    return { colorSchemeId: "terracotta-warm", fontSchemeId: "friendly-organic", shapeSchemeId: "soft", lookConfirmed: true }
  }
  if (id === "feel-blue") {
    return { colorSchemeId: "blue-professional", fontSchemeId: "clear-modern", shapeSchemeId: "sharp", lookConfirmed: true }
  }
  if (id === "feel-emerald") {
    return { colorSchemeId: "emerald-calm", fontSchemeId: "clear-modern", shapeSchemeId: "soft", lookConfirmed: true }
  }
  if (id === "feel-red") {
    return { colorSchemeId: "red-confident", fontSchemeId: "classic-editorial", shapeSchemeId: "rounded", lookConfirmed: true }
  }
  return null
}

export const lookPatchFromChoice = (message: string): Partial<BuilderFacts> | null => {
  const normalized = normalizeChoiceText(message)
  const feel = FEEL_CHOICES.find((choice) => normalizeChoiceText(choice.label) === normalized)
  return feel ? applyLookFromFeelId(feel.id) : null
}

const lastAssistant = (messages: BuilderChatMessage[] | undefined): BuilderChatMessage | undefined =>
  [...(messages ?? [])].reverse().find((entry) => entry.role === "assistant")

const isContactChoiceMessage = (message: string): boolean => {
  const normalized = normalizeChoiceText(message)
  return CONTACT_CHOICES.some((choice) => normalizeChoiceText(choice.label) === normalized)
}

export const shouldApplyContactAnswer = (
  message: string,
  facts: BuilderFacts,
  recentMessages?: BuilderChatMessage[],
): boolean => {
  if (isContactChoiceMessage(message)) return true
  if (!/\b(?:afspraak|boek|agenda|formulier|whatsapp(?:en)?|bellen|opbellen|bel me|telefoon|mail|contactform|alleen bellen|langskomen|afspreken|voelen)\b/i.test(message)) {
    return false
  }
  const last = lastAssistant(recentMessages)
  if (last?.choices?.some((choice) => CONTACT_CHOICES.some((entry) => entry.id === choice.id))) {
    return true
  }
  if (last && /\b(contact|bellen|whatsapp|afspraak|formulier)\b/i.test(last.text)) {
    const mixed = /\b(dienst|vak|plaats|waar werk|wat doe|bedrijfsnaam|hoe heet)\b/i.test(last.text)
    if (!mixed) return true
  }
  const required = firstSiteRequiredMissing(facts)
  return required.length === 1 && required[0] === "contactvoorkeur"
}

/** Fallback chips only — must match the fallback question order, never a second policy. */
export const choicesForFirstSite = (
  facts: BuilderFacts | null | undefined,
  generated: boolean,
): BuilderChoice[] => {
  if (generated) return []
  const missing = facts ? firstSiteMissing(facts) : ["diensten", "plaats", "contactvoorkeur"]
  if (missing.includes("diensten")) {
    const named = facts ? namedBuilderOffers(facts) : []
    if (named.length >= 1 && named[0]) {
      const label = named[1]
        ? `${named[0].value} en ${named[1].value}`
        : `${named[0].value} en nog een dienst`
      return label.length >= 8 ? [{ id: "use-offers", label: label.slice(0, 80) }] : []
    }
    return []
  }
  if (missing.includes("plaats")) return []
  if (missing.includes("contactvoorkeur")) return CONTACT_CHOICES
  if (missing.includes("uitstraling")) return FEEL_CHOICES
  return [GENERATE_CHOICE]
}

/** Keyboard for the question the assistant just asked — not a missing[] overlay. */
export const choicesFromAssistantText = (
  text: string,
  facts: BuilderFacts,
): BuilderChoice[] => {
  const asksContact = /\b(bellen|whatsapp|afspraak|formulier|contact)\b/i.test(text)
  const asksLook = /\b(kleur|sfeer|uitstraling|palet|lettertype|hoek|stijl)\b/i.test(text)
  const asksGenerate = /\b(homepage|zal ik (die |hem )?nu|maak ik|klaar om te)\b/i.test(text)
  const asksTrade = /\b(dienst|diensten|vak|wat doe|waar werk|bedrijfsnaam|hoe heet)\b/i.test(text)
  const topics = [asksContact, asksLook, asksGenerate, asksTrade].filter(Boolean).length
  if (topics > 1) return []

  if (asksContact && firstSiteRequiredMissing(facts).includes("contactvoorkeur")) {
    return CONTACT_CHOICES
  }
  if (asksLook) return FEEL_CHOICES
  if (asksGenerate && firstSiteRequiredMissing(facts).length === 0) {
    return [GENERATE_CHOICE]
  }
  return []
}
