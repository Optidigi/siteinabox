import { z } from "zod"

import { COLOR_SCHEME_IDS, FONT_SCHEME_IDS, SHAPE_SCHEME_IDS } from "@siteinabox/contracts"

const offerSchema = z.object({ value: z.string().trim().min(3).max(60) })

export const BuilderFactsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  intro: z.string().trim().min(20).max(500),
  offers: z.array(offerSchema).min(1).max(6),
  audience: z.string().trim().min(8).max(240),
  situation: z.string().trim().min(20).max(360),
  approach: z.string().trim().min(20).max(400),
  region: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(500).default(""),
  selectedActions: z.array(z.enum(["message", "appointment", "quote", "phone", "whatsapp"])).min(1),
  formType: z.enum(["message", "quote", "appointment", "multiple", "none"]),
  briefStage: z.enum(["offer", "modules", "ready"]).default("offer"),
  colorSchemeId: z.enum(COLOR_SCHEME_IDS).default("monochrome"),
  fontSchemeId: z.enum(FONT_SCHEME_IDS).default("clear-modern"),
  shapeSchemeId: z.enum(SHAPE_SCHEME_IDS).default("soft"),
  appearanceMode: z.enum(["light", "dark"]).default("light"),
  trade: z.string().trim().max(80).default(""),
  lookConfirmed: z.boolean().default(false),
})

export type BuilderFacts = z.infer<typeof BuilderFactsSchema>

export const GENERIC_INTRO = "Wij helpen klanten lokaal en persoonlijk verder."
const GENERIC_SITUATION = "Klanten zoeken een duidelijke, professionele eerste indruk online."
const GENERIC_APPROACH = "We luisteren, geven helder advies en lossen het praktisch op."
const GENERIC_AUDIENCE = "Lokale klanten en ondernemers in de buurt"

const pad = (value: string, min: number, filler: string): string => {
  const cleaned = value.replace(/\s+/g, " ").trim()
  if (cleaned.length >= min) return cleaned.slice(0, min === 20 ? 500 : 400)
  return `${cleaned} ${filler}`.replace(/\s+/g, " ").trim()
}

const firstSentence = (value: string): string => {
  const match = value.trim().match(/^(.{8,80}?)(?:[.!?\n]|$)/)
  return (match?.[1] ?? value).replace(/\s+/g, " ").trim()
}

const titleCaseNl = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")

const OFFER_LIST_PREFIX =
  /\b(?:doe(?:n)?|aanbied(?:t|en)?|diensten(?: zijn)?)\b[:\s]+(.+?)(?:\.|$)/i

const CONTACT_CHUNK =
  /^(vooral\s+)?(bellen|whatsapp(?:en)?|afspraak|formulier|telefoon|opbellen)(\s+maken)?$/i

const NATIONWIDE_AREA =
  /\b(heel nederland|landelijk|heel het land|door heel nederland|in heel nl)\b/i

const PLACEHOLDER_AREA = /^(nederland|netherlands|nl)$/i

const splitOfferChunks = (source: string): string[] =>
  source
    .split(/[,;/]|\s+en\s+|\s+&\s+/i)
    .map((part) =>
      part
        .replace(/^(?:ik bied|gebruik|ik die)\s+/i, "")
        .replace(/[.?!:]+$/g, "")
        .trim(),
    )
    .filter((part) => part.length >= 3 && part.length <= 60)
    .filter((part) => !/^(ik|wij|we|het|een|de|voor|via)\b/i.test(part))
    .filter((part) => !NATIONWIDE_AREA.test(part) && !/^(heel nederland|landelijk|nederland)$/i.test(part))

export const looksLikeOfferList = (message: string): boolean => {
  const text = message.replace(/\s+/g, " ").trim()
  if (text.length < 7 || text.length > 120) return false
  const chunks = splitOfferChunks(text)
  if (chunks.length < 2) return false
  if (chunks.every((part) => CONTACT_CHUNK.test(part))) return false
  return true
}

const leadingPlaceAndOffers = (text: string): { place: string; rest: string } | null => {
  const match = text.match(/^([a-zà-ÿ][a-zà-ÿ-]{2,20})\s*,\s*(.+)$/i)
  if (!match?.[1] || !match[2]) return null
  if (NATIONWIDE_AREA.test(match[1])) return null
  if (!looksLikeOfferList(match[2])) return null
  return { place: titleCaseNl(match[1]), rest: match[2] }
}

/** Named services after "doe" / "aanbied", or a short "X en Y" list. */
export const extractOfferList = (
  message: string,
  previous: Array<{ value: string }> | undefined,
): Array<{ value: string }> => {
  const text = message.replace(/\s+/g, " ").trim()
  const leading = leadingPlaceAndOffers(text)
  const listedSource = text.match(OFFER_LIST_PREFIX)?.[1]?.trim()
  const listed = listedSource
    || leading?.rest
    || (looksLikeOfferList(text) ? text : "")
  const source = listed.replace(/\s+in\s+[a-zà-ÿ-]{3,}\.?$/i, "").trim()
  const chunks = splitOfferChunks(source)
    .filter((part) => !CONTACT_CHUNK.test(part))
    .filter((part) => !leading || titleCaseNl(part) !== leading.place)
    .map((part) => ({ value: titleCaseNl(part) }))
    .slice(0, 6)
  const offers = chunks.length > 0 ? chunks : previous
  const ensured = (offers && offers.length > 0 ? offers : [{ value: "Diensten" }, { value: "Adviesgesprek" }])
  return ensured.length >= 2 ? ensured.slice(0, 6) : [...ensured, { value: "Adviesgesprek" }]
}

const CHOICE_NAME_BLOCKLIST =
  /^(bellen en whatsapp|vooral bellen|via whatsapp|afspraak maken|een formulier|maak de homepage|warm terracotta, zacht|strak blauw, modern|groen en praktisch|rood en opvallend)$/i

const looksLikeContactOnly = (text: string): boolean => {
  const chunks = splitOfferChunks(text)
  if (chunks.length > 0 && chunks.every((part) => CONTACT_CHUNK.test(part))) return true
  return /^(vooral\s+)?bellen en whatsapp$/i.test(text)
}

const shouldIgnoreAsBusinessName = (text: string, extraLabels: string[]): boolean => {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return true
  if (CHOICE_NAME_BLOCKLIST.test(normalized)) return true
  if (looksLikeContactOnly(normalized)) return true
  if (
    looksLikeOfferList(normalized)
    && !/\b(?:ik ben|wij zijn|bedrijf(?:snaam)?|studio|zaak)\b/i.test(normalized)
  ) {
    return true
  }
  return extraLabels.some((label) => label.replace(/\s+/g, " ").trim().toLowerCase() === normalized.toLowerCase())
}

const businessNameFromMessage = (
  text: string,
  previous: string | undefined,
  extraLabels: string[] = [],
): string => {
  if (shouldIgnoreAsBusinessName(text, extraLabels)) {
    return previous || "Nieuw bedrijf"
  }
  const named = text.match(/(?:bedrijf(?:snaam)?|studio|zaak)\s*(?:heet|is|:)\s*([^.,]{2,80})/i)
  if (named?.[1]?.trim()) return named[1].trim()
  const localTrade = text.match(/^ik ben (?:een )?([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,3}) in ([a-zà-ÿ-]+)/i)
  if (localTrade?.[1] && localTrade[2]) return `${titleCaseNl(localTrade[1])} ${titleCaseNl(localTrade[2])}`
  if (previous) return previous
  if (/^ik ben\b/i.test(text) && !/\bin\s+[a-zà-ÿ-]+/i.test(text)) {
    return "Nieuw bedrijf"
  }
  if (text.length < 48 && text.split(/\s+/).filter(Boolean).length < 8) {
    return "Nieuw bedrijf"
  }
  return titleCaseNl(firstSentence(text).slice(0, 80)) || "Nieuw bedrijf"
}

export const hasUsableArea = (region: string): boolean => {
  const trimmed = region.replace(/\s+/g, " ").trim()
  if (!trimmed) return false
  return !PLACEHOLDER_AREA.test(trimmed)
}

const regionFromMessage = (text: string, previous: string | undefined): string => {
  if (NATIONWIDE_AREA.test(text)) return "Heel Nederland"
  const leading = leadingPlaceAndOffers(text)
  if (leading) return leading.place
  const place = text.match(/\b(?:in|te|uit)\s+([a-zà-ÿ-]{3,})(?:\s|$|[.,!?])/i)?.[1]
  if (place && !/^(heel|het|een|de)$/i.test(place)) return titleCaseNl(place)
  return previous || "Nederland"
}

const THIN_GREETING = /^(hey|hoi|hi|hello|hallo|help)(?:[,\s!.]*(help|please|alsjeblieft)?)?$/i

export const looksLikeConfirm = (message: string): boolean => {
  const text = message.replace(/\s+/g, " ").trim()
  return /^(oké|oke|ok|ja|prima|goed|doen|doe maar|klinkt goed|is goed|vooruit)([,.!\s].*)?$/i.test(text)
    || /\b(klinkt goed|is goed|doe maar|ga maar (?:bouwen|maken)|maak (?:maar |de )?homepage)\b/i.test(text)
}

export const looksLikeLookDefer = (message: string): boolean => {
  const text = message.replace(/\s+/g, " ").trim()
  return /^(maakt niet uit|kies (jij|maar)|jouw keuze|weet ik niet|geen idee|gewoon doen|is goed zo|maakt me niet uit)([,.!\s].*)?$/i.test(text)
}

export const looksLikeChitchat = (message: string): boolean => {
  const text = message.replace(/\s+/g, " ").trim()
  if (looksLikeOfferList(text)) return false
  if (/\b(?:bellen|whatsapp|afspraak|formulier)\b/i.test(text)) return false
  if (THIN_GREETING.test(text)) return true
  if (/^(hoi|hey|hi|hallo|hello)\b.{0,48}$/i.test(text) && !/\b(?:in|te|uit)\s+[a-zà-ÿ-]{3,}/i.test(text)) return true
  return /\b(hoe is het|hoe gaat het|hoe is het weer|weer morgen)\b/i.test(text)
    && !/\b(?:in|te|uit)\s+[a-zà-ÿ-]{3,}/i.test(text)
}

export const messageLooksLikeBrief = (message: string): boolean => {
  const text = message.replace(/\s+/g, " ").trim()
  if (THIN_GREETING.test(text) || looksLikeChitchat(text)) return false
  const words = text.split(" ").filter(Boolean)
  if (text.length < 32 || words.length < 8) return false
  const hasPlace = /\b(?:in|te|uit)\s+[a-zà-ÿ-]{3,}/i.test(text)
  const hasTrade = /\b(?:wij zijn|bedrijf|studio|zaak|kapper|schilder|coach|fotograaf|hovenier|loodgieter|klusser|timmerman)\b/i.test(text)
    || /^ik ben (?:een )?.+\bin\s+[a-zà-ÿ-]+/i.test(text)
  return hasTrade || hasPlace
}

export const hasModuleAnswer = (message: string): boolean =>
  /\b(?:afspraak|boek|agenda|formulier|whatsapp(?:en)?|bellen|opbellen|bel me|telefoon|mail|contactform|alleen bellen|langskomen|afspreken|voelen)\b/i.test(message)

export const looksLikeBuildNow = (message: string): boolean =>
  /^(maak de homepage)$/i.test(message.replace(/\s+/g, " ").trim())
  || /\b(?:maak|bouw|genereer)\b[\s\S]{0,40}\b(?:site|website|homepage|voorstel)\b/i.test(message)
  || /\b(?:site|website|homepage)\s+voor me\b/i.test(message)
  || /\bprobeer(?: het)? opnieuw\b/i.test(message)

export const looksLikeGenerateAsk = (message: string): boolean =>
  hasModuleAnswer(message) || looksLikeBuildNow(message)

const starterBuilderFacts = (): BuilderFacts => BuilderFactsSchema.parse({
  businessName: "Nieuw bedrijf",
  intro: GENERIC_INTRO,
  offers: [{ value: "Diensten" }, { value: "Adviesgesprek" }],
  audience: GENERIC_AUDIENCE,
  situation: GENERIC_SITUATION,
  approach: GENERIC_APPROACH,
  region: "Nederland",
  notes: "",
  selectedActions: ["message"],
  formType: "message",
  briefStage: "offer",
  colorSchemeId: "monochrome",
  fontSchemeId: "clear-modern",
  shapeSchemeId: "soft",
  appearanceMode: "light",
  trade: "",
  lookConfirmed: false,
})

export type BuilderFactIngestOptions = {
  choiceLabels?: string[]
}

export const lookPatchFromText = (text: string): Partial<BuilderFacts> => {
  const patch: Partial<BuilderFacts> = {}
  if (/terracotta|klei|roest/i.test(text)) patch.colorSchemeId = "terracotta-warm"
  else if (/groen|emerald/i.test(text)) patch.colorSchemeId = "emerald-calm"
  else if (/\brood\b|rose|roze|opvallend/i.test(text)) patch.colorSchemeId = "red-confident"
  else if (/blauw/i.test(text)) patch.colorSchemeId = "blue-professional"
  else if (/amber|oranje/i.test(text)) patch.colorSchemeId = "amber-warm"
  if (/klassiek|editorial/i.test(text)) patch.fontSchemeId = "classic-editorial"
  else if (/vriendelijk|organisch|zacht/i.test(text)) patch.fontSchemeId = "friendly-organic"
  if (/strak|scherp/i.test(text)) patch.shapeSchemeId = "sharp"
  else if (/rond/i.test(text)) patch.shapeSchemeId = "rounded"
  else if (/zacht/i.test(text)) patch.shapeSchemeId = "soft"
  if (/donker|dark/i.test(text)) patch.appearanceMode = "dark"
  else if (/\blicht\b|light/i.test(text)) patch.appearanceMode = "light"
  if (Object.keys(patch).length > 0) patch.lookConfirmed = true
  return patch
}

export const heuristicExtractBuilderFacts = (
  message: string,
  previous: BuilderFacts | null,
  options?: BuilderFactIngestOptions,
): BuilderFacts => {
  const extraLabels = options?.choiceLabels ?? []
  const text = message.replace(/\s+/g, " ").trim()
  if (!previous && looksLikeChitchat(text) && !looksLikeOfferList(text) && !hasModuleAnswer(text)) {
    return starterBuilderFacts()
  }
  const choiceOnly = shouldIgnoreAsBusinessName(text, extraLabels) && !looksLikeOfferList(text)
  const thinFollowUp = Boolean(
    previous
    && !messageLooksLikeBrief(text)
    && !hasModuleAnswer(text)
    && !looksLikeOfferList(text)
    && !choiceOnly
    && Object.keys(lookPatchFromText(text)).length === 0
    && !NATIONWIDE_AREA.test(text)
    && !looksLikeLookDefer(text)
    && !looksLikeBuildNow(text)
  )
  if (thinFollowUp && previous) return previous

  const look = lookPatchFromText(text)
  const businessName = businessNameFromMessage(text, previous?.businessName, extraLabels)
  const ensuredOffers = extractOfferList(text, previous?.offers)

  const draft = {
    businessName,
    intro: pad(previous?.intro || (choiceOnly ? previous?.intro || "" : text), 20, GENERIC_INTRO),
    offers: ensuredOffers.slice(0, 6),
    audience: pad(previous?.audience || GENERIC_AUDIENCE, 8, "in de regio"),
    situation: pad(previous?.situation || GENERIC_SITUATION, 20, "Zij willen snel weten wat we doen."),
    approach: pad(previous?.approach || GENERIC_APPROACH, 20, "Contact is laagdrempelig."),
    region: regionFromMessage(text, previous?.region),
    notes: previous?.notes || "",
    selectedActions: previous?.selectedActions?.length ? previous.selectedActions : ["message"],
    formType: previous?.formType ?? "message",
    briefStage: previous?.briefStage ?? "offer",
    colorSchemeId: look.colorSchemeId ?? previous?.colorSchemeId ?? "monochrome",
    fontSchemeId: look.fontSchemeId ?? previous?.fontSchemeId ?? "clear-modern",
    shapeSchemeId: look.shapeSchemeId ?? previous?.shapeSchemeId ?? "soft",
    appearanceMode: look.appearanceMode ?? previous?.appearanceMode ?? "light",
    trade: previous?.trade || "",
    lookConfirmed: Boolean(previous?.lookConfirmed) || Boolean(look.lookConfirmed),
  }

  return BuilderFactsSchema.parse(draft)
}

export const mergeBuilderFacts = (base: BuilderFacts, patch: Partial<BuilderFacts>): BuilderFacts =>
  BuilderFactsSchema.parse({
    ...base,
    ...patch,
    offers: patch.offers?.length ? patch.offers : base.offers,
    selectedActions: patch.selectedActions?.length ? patch.selectedActions : base.selectedActions,
    trade: patch.trade ?? base.trade,
    lookConfirmed: patch.lookConfirmed ?? base.lookConfirmed,
  })

export const isBuilderBriefReady = (message: string, facts?: BuilderFacts | null): boolean => {
  if (facts?.briefStage === "modules" || facts?.briefStage === "ready") return true
  return messageLooksLikeBrief(message)
}

export const MODULE_QUESTION =
  "Wil je dat bezoekers een afspraak kunnen maken, een formulier achterlaten, WhatsAppen, of vooral bellen? Dan zet ik de juiste module klaar."

export const applyModuleAnswer = (message: string, facts: BuilderFacts): BuilderFacts => {
  const text = message.toLowerCase()
  let formType = facts.formType
  let selectedActions = [...facts.selectedActions]
  const phoneAndWhatsapp = /\bbellen\b/.test(text) && /\bwhatsapp(?:en)?/.test(text)
  if (phoneAndWhatsapp) {
    formType = "none"
    selectedActions = ["phone", "whatsapp"]
  } else if (/\bafspraak|\bboek|\bagenda/.test(text)) {
    formType = "appointment"
    if (!selectedActions.includes("appointment")) selectedActions = ["appointment", ...selectedActions]
  } else if (/\bformulier|\bmail|\bbericht/.test(text)) {
    formType = "message"
    if (!selectedActions.includes("message")) selectedActions = ["message", ...selectedActions]
  } else if (/\balleen bellen|\btelefoon|\bbellen/.test(text)) {
    formType = "none"
    selectedActions = ["phone"]
  } else if (/\bwhatsapp(?:en)?/.test(text)) {
    formType = formType === "appointment" ? formType : "none"
    selectedActions = selectedActions.includes("whatsapp")
      ? selectedActions
      : [...selectedActions.filter((item) => item !== "message"), "whatsapp"]
    if (selectedActions.length === 0) selectedActions = ["whatsapp"]
  }
  if (!phoneAndWhatsapp && /\bwhatsapp(?:en)?/.test(text) && !selectedActions.includes("whatsapp")) {
    selectedActions = [...selectedActions, "whatsapp"]
  }
  if (/\b(?:langskomen|afspreken|voelen)\b/.test(text) && !selectedActions.includes("appointment")) {
    formType = "appointment"
    selectedActions = ["appointment", ...selectedActions]
  }
  return BuilderFactsSchema.parse({
    ...facts,
    formType,
    selectedActions,
    briefStage: "ready",
  })
}

export const isBuilderGenerateReady = (message: string, facts: BuilderFacts): boolean => {
  if (facts.briefStage === "ready") return true
  if (!isBuilderBriefReady(message, facts)) return false
  return hasModuleAnswer(message)
}

const GENERIC_OFFERS = /^(diensten|adviesgesprek|advies)$/i

export const namedBuilderOffers = (facts: BuilderFacts): Array<{ value: string }> =>
  facts.offers.filter((offer) => !GENERIC_OFFERS.test(offer.value))

export const firstSiteMissing = (facts: BuilderFacts): string[] => {
  const missing: string[] = []
  if (namedBuilderOffers(facts).length < 2) missing.push("diensten")
  if (!hasUsableArea(facts.region)) missing.push("plaats")
  if (facts.briefStage !== "ready") missing.push("contactvoorkeur")
  if (!facts.lookConfirmed) missing.push("uitstraling")
  return missing
}

export const firstSiteRequiredMissing = (facts: BuilderFacts): string[] =>
  firstSiteMissing(facts).filter((item) => item !== "uitstraling")

/** Write clamp for generateHomepage — conversation is not gated on look. */
export const hasMinimumFirstSiteBrief = (facts: BuilderFacts): boolean =>
  namedBuilderOffers(facts).length >= 2
  && hasUsableArea(facts.region)
  && facts.briefStage === "ready"

const stillGeneric = (value: string, filler: string): boolean =>
  !value || value.includes(filler)

export const inferLookFromFacts = (facts: BuilderFacts): BuilderFacts => {
  if (facts.lookConfirmed) return facts
  const blob = [
    facts.trade,
    facts.businessName,
    facts.notes,
    facts.intro,
    ...facts.offers.map((offer) => offer.value),
  ].join(" ").toLowerCase()
  let colorSchemeId = facts.colorSchemeId
  let fontSchemeId = facts.fontSchemeId
  let shapeSchemeId = facts.shapeSchemeId
  if (/handjob|blowjob|erot|escort|intiem|massage|tantra/.test(blob)) {
    colorSchemeId = "terracotta-warm"
    fontSchemeId = "friendly-organic"
    shapeSchemeId = "soft"
  } else if (/coach|studio|fotograaf|therapie/.test(blob)) {
    colorSchemeId = "blue-professional"
    fontSchemeId = "classic-editorial"
    shapeSchemeId = "soft"
  } else if (/kapper|hovenier|loodgieter|schilder|klus|timmerman/.test(blob)) {
    colorSchemeId = "emerald-calm"
    fontSchemeId = "clear-modern"
    shapeSchemeId = "soft"
  } else if (colorSchemeId === "monochrome") {
    colorSchemeId = "amber-warm"
  }
  return BuilderFactsSchema.parse({
    ...facts,
    colorSchemeId,
    fontSchemeId,
    shapeSchemeId,
    lookConfirmed: true,
  })
}

export const composeVisitorBrief = (facts: BuilderFacts): BuilderFacts => {
  const named = namedBuilderOffers(facts)
  const offerText = named.map((offer) => offer.value).join(", ") || "hun aanbod"
  const trade = facts.trade.trim()
    || (facts.businessName !== "Nieuw bedrijf" ? facts.businessName : "een lokale onderneming")
  const place = hasUsableArea(facts.region) ? facts.region : "hun regio"
  const intro = stillGeneric(facts.intro, GENERIC_INTRO)
    ? pad(`${facts.businessName} is ${trade} in ${place}. Bezoekers komen voor ${offerText}.`, 20, GENERIC_INTRO)
    : facts.intro
  const situation = stillGeneric(facts.situation, GENERIC_SITUATION)
    ? pad(`Mensen in ${place} zoeken iemand voor ${offerText} en willen meteen zien of het klikt.`, 20, GENERIC_SITUATION)
    : facts.situation
  const contactBit = facts.selectedActions.includes("whatsapp") && facts.selectedActions.includes("phone")
    ? "Ze bellen of appen."
    : facts.formType === "appointment"
      ? "Ze plannen een afspraak."
      : "Ze nemen laagdrempelig contact op."
  const approach = stillGeneric(facts.approach, GENERIC_APPROACH)
    ? pad(`De site legt het vak uit in hun woorden en maakt de volgende stap duidelijk. ${contactBit}`, 20, GENERIC_APPROACH)
    : facts.approach
  const audience = stillGeneric(facts.audience, GENERIC_AUDIENCE)
    ? pad(`Mensen in ${place} die ${offerText} zoeken`, 8, GENERIC_AUDIENCE)
    : facts.audience
  return BuilderFactsSchema.parse({
    ...facts,
    intro: intro.slice(0, 500),
    situation: situation.slice(0, 360),
    approach: approach.slice(0, 400),
    audience: audience.slice(0, 240),
  })
}

export const prepareFirstSiteGenerateFacts = (facts: BuilderFacts): BuilderFacts =>
  composeVisitorBrief(inferLookFromFacts(BuilderFactsSchema.parse({ ...facts, briefStage: "ready" })))

/** Generate when this turn completes the brief, or when the user confirms/asks to build. */
export const canGenerateFirstHomepage = (
  facts: BuilderFacts,
  message: string,
  previous: BuilderFacts | null = null,
): boolean => {
  const next = hasModuleAnswer(message) ? applyModuleAnswer(message, facts) : facts
  if (!hasMinimumFirstSiteBrief(next)) return false
  const lookReady = next.lookConfirmed
    || looksLikeLookDefer(message)
    || looksLikeBuildNow(message)
    || looksLikeConfirm(message)
    || Object.keys(lookPatchFromText(message)).length > 0
  if (!lookReady) return false
  const wasIncomplete = !previous
    || !hasMinimumFirstSiteBrief(previous)
    || !previous.lookConfirmed
  if (wasIncomplete) return true
  return looksLikeGenerateAsk(message) || looksLikeConfirm(message) || looksLikeOfferList(message)
}
