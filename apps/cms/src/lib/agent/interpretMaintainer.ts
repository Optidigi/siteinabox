import type { BuilderFacts } from "@/lib/builder/facts"

export type MaintainerIntent =
  | { kind: "setTheme" }
  | { kind: "setAppointments" }
  | { kind: "setHours"; open: string; close: string }
  | { kind: "setContact"; phone?: string; address?: string }
  | { kind: "updateSectionProps"; field: "heading" | "body"; value: string }
  | { kind: "replaceSection"; variant: string }
  | { kind: "regenerate" }
  | { kind: "none" }

const THEME_SIGNAL = /\b(donker|dark|licht|kleur|groen|blauw|rood|terracotta|amber|oranje|strak|scherp|rond|klassiek|editorial|vriendelijk|font|lettertype|thema)\b/i
const APPOINTMENT_SIGNAL = /\b(afspraak|boek|agenda)\b/i
const REGEN_SIGNAL = /\b(begin opnieuw|opnieuw genereren|start over)\b/i
const VARIANT_SIGNAL = /\b((?:hero|services|cta|appointments)-\d{2})\b/i
const HOURS_SIGNAL = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/
const PHONE_SIGNAL = /\btelefoon\s*[:\-]\s*([+\d][\d\s-]{7,})/i
const ADDRESS_SIGNAL = /\badres\s*[:\-]\s*(.+)$/i

const normalizeClock = (value: string): string => {
  const [hours, minutes] = value.replace(".", ":").split(":")
  return `${(hours ?? "00").padStart(2, "0")}:${(minutes ?? "00").padStart(2, "0")}`
}

export const interpretMaintainerIntent = (message: string): MaintainerIntent => {
  if (REGEN_SIGNAL.test(message)) return { kind: "regenerate" }
  const heading = message.match(/^(?:titel|kop|heading)\s*[:\-]\s*(.+)$/i)
  if (heading?.[1]?.trim()) {
    return { kind: "updateSectionProps", field: "heading", value: heading[1].trim() }
  }
  const body = message.match(/^(?:tekst|body|alinea)\s*[:\-]\s*(.+)$/i)
  if (body?.[1]?.trim()) {
    return { kind: "updateSectionProps", field: "body", value: body[1].trim() }
  }
  const variant = message.match(VARIANT_SIGNAL)
  if (variant?.[1]) return { kind: "replaceSection", variant: variant[1].toLowerCase() }
  const hours = message.match(HOURS_SIGNAL)
  if (hours?.[1] && hours[2]) {
    return { kind: "setHours", open: normalizeClock(hours[1]), close: normalizeClock(hours[2]) }
  }
  const phone = message.match(PHONE_SIGNAL)
  const address = message.match(ADDRESS_SIGNAL)
  if (phone?.[1] || address?.[1]) {
    return {
      kind: "setContact",
      ...(phone?.[1] ? { phone: phone[1].trim() } : {}),
      ...(address?.[1] ? { address: address[1].trim() } : {}),
    }
  }
  if (THEME_SIGNAL.test(message)) return { kind: "setTheme" }
  if (APPOINTMENT_SIGNAL.test(message)) return { kind: "setAppointments" }
  return { kind: "none" }
}

export const describeMaintainerIntent = (intent: MaintainerIntent, facts: BuilderFacts): string => {
  if (intent.kind === "setTheme") {
    return `Ik heb het thema gezet op ${facts.colorSchemeId}, ${facts.fontSchemeId}, ${facts.shapeSchemeId} (${facts.appearanceMode}).`
  }
  if (intent.kind === "setAppointments") {
    return "Ik heb afspraken op deze site gezet. Zeg gerust als de tijden anders moeten."
  }
  if (intent.kind === "setHours") {
    return `Ik heb de openingstijden gezet op ${intent.open}–${intent.close} op werkdagen.`
  }
  if (intent.kind === "setContact") {
    return "Ik heb de contactgegevens op de site aangepast."
  }
  if (intent.kind === "updateSectionProps") {
    return `Ik heb de ${intent.field === "heading" ? "titel" : "tekst"} van het geselecteerde blok aangepast.`
  }
  if (intent.kind === "replaceSection") {
    return `Ik heb het blok gezet op catalogusvariant ${intent.variant}.`
  }
  if (intent.kind === "regenerate") {
    return "Ik maak de site opnieuw op dezelfde tenant."
  }
  return "Dat kan ik zo niet toepassen. Ik kan thema, titels, catalogusvarianten, openingstijden of contactgegevens aanpassen — of de homepage opnieuw genereren. FAQ, over-ons en portfolio kan ik nog niet toevoegen."
}
