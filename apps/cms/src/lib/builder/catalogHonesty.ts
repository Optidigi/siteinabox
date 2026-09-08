import { SITEGEN_FOOTERS, SITEGEN_NAVBARS, SITEGEN_SECTIONS } from "@/lib/sitegen/catalog"
import type { BuilderFacts } from "./facts"

export const SITEGEN_LIVE_BLOCK_TYPES = SITEGEN_SECTIONS.map((section) => section.blockType)

export const isLiveCatalogBlockType = (blockType: unknown): boolean =>
  typeof blockType === "string" && (SITEGEN_LIVE_BLOCK_TYPES as string[]).includes(blockType)

export const SITEGEN_UNAVAILABLE_BLOCK_TYPES = [
  "about",
  "process",
  "work",
  "reviews",
  "pricing",
  "faq",
  "contact",
] as const

export const isUnavailableCatalogBlockType = (blockType: unknown): boolean =>
  typeof blockType === "string"
  && (SITEGEN_UNAVAILABLE_BLOCK_TYPES as readonly string[]).includes(blockType)

const UNAVAILABLE_ASK: Array<{ id: (typeof SITEGEN_UNAVAILABLE_BLOCK_TYPES)[number]; pattern: RegExp; label: string }> = [
  { id: "faq", pattern: /\b(faq|veelgestelde vragen|veel gestelde)\b/i, label: "FAQ" },
  { id: "about", pattern: /\b(over ons|over mij|about)\b/i, label: "over-ons" },
  { id: "work", pattern: /\b(portfolio|projecten|werkvoorbeelden)\b/i, label: "portfolio" },
  { id: "reviews", pattern: /\b(reviews|beoordelingen|getuigenissen)\b/i, label: "reviews" },
  { id: "pricing", pattern: /\b(prijslijst|prijstabel|tarievenblok)\b/i, label: "prijzenblok" },
  { id: "contact", pattern: /\b(contactpagina|apart contactblok)\b/i, label: "contactpagina" },
]

export const sitegenCatalogDigest = (): string => {
  const sections = SITEGEN_SECTIONS.map((section) =>
    `${section.blockType}: ${section.variants.map((variant) => variant.id).join(", ")}`,
  ).join("; ")
  const chrome = [
    `navbar: ${SITEGEN_NAVBARS.map((item) => item.id).join(", ")}`,
    `footer: ${SITEGEN_FOOTERS.map((item) => item.id).join(", ")}`,
  ].join("; ")
  return [
    `Live catalogus (alleen deze blokken): ${sections}. Chrome: ${chrome}.`,
    `Nog niet in de catalogus: ${SITEGEN_UNAVAILABLE_BLOCK_TYPES.join(", ")}.`,
    "Een eerste voorstel is een homepage (hero, diensten, CTA, optioneel afspraken), geen complete multi-page site.",
    "Zonder foto’s is hero-01 de eerlijke default; hero-02 tot hero-05 vragen echte media.",
  ].join(" ")
}

export const unavailableAsksIn = (message: string): string[] =>
  UNAVAILABLE_ASK.filter((entry) => entry.pattern.test(message)).map((entry) => entry.label)

export const composeFirstSiteReply = (facts: BuilderFacts, extra?: { unavailable?: string[] }): string => {
  const modules = facts.formType === "appointment"
    ? "inclusief afsprakenmodule"
    : facts.selectedActions.includes("whatsapp")
      ? "met WhatsApp als contactactie"
      : "met een duidelijke volgende stap"
  const missing = extra?.unavailable?.length
    ? ` ${extra.unavailable.join(", ")} zit nog niet in de catalogus, dus dat laat ik weg.`
    : ""
  return `Hier is een eerste homepage voor ${facts.businessName}: hero, diensten en ${modules}.${missing} Dat is wat we nu kunnen maken — geen aparte over-ons, FAQ of portfolio. Zeg wat er anders moet aan thema, teksten of variant.`
}

export const composeAskBriefReply = (): string =>
  "Ik bouw een eerste homepage met onze bestaande blokken (hero, diensten, CTA; afspraken als je dat wilt). Geen complete site met FAQ of portfolio — die families bestaan nog niet. Welk vak doe je, en waar werk je?"

export const composeAskLookReply = (): string =>
  "Ik heb genoeg om te bouwen. Welke uitstraling past? Tik een sfeer, of zeg dat ik het kies — dan maak ik de homepage."

export const composeUnavailableReply = (labels: string[]): string =>
  `${labels.join(" en ")} kan ik nog niet als eigen blok zetten: die zitten niet in de huidige catalogus. Wat wél kan is een homepage met hero, diensten en een CTA (en afspraken als je dat wilt). Zal ik daar een eerste versie van maken?`

export const composeConfirmGenerateReply = (): string =>
  "Ik heb genoeg voor een eerste homepage met hero, diensten en CTA. Zal ik die nu maken?"

export const composeMaintainerNoneReply = (): string =>
  "Dat kan ik zo niet toepassen. Ik kan thema, titels, catalogusvarianten (hero/services/cta/appointments), openingstijden of contactgegevens aanpassen — of de homepage opnieuw genereren. FAQ, over-ons en portfolio kan ik nog niet toevoegen."
