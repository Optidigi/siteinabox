import type { StaticLabel } from "payload"

export const adminText = (en: string, nl: string): StaticLabel => ({ en, nl })

export const adminValidationText = (
  language: string | undefined,
  en: string,
  nl: string,
): string => language === "nl" ? nl : en

const dutchEnumLabels: Record<string, string> = {
  acknowledged: "Bevestigd", activated: "Geactiveerd", annual: "Jaarlijks",
  cancelled: "Geannuleerd", critical: "Kritiek", directory: "Bedrijvengids",
  drafted: "Concept", enforcement: "Handhaving", error: "Fout", expired: "Verlopen",
  explicit_acceptance: "Expliciete acceptatie", failed: "Mislukt", forms: "Formulieren",
  generated: "Gegenereerd", generating: "Wordt gegenereerd", info: "Informatie",
  initial: "Eerste kennisgeving", intake: "Intake", mail: "E-mail", manual: "Handmatig",
  marketing: "Marketing", monthly: "Maandelijks", none: "Geen", notified: "Gemeld",
  notice_window_elapsed: "Kennisgevingstermijn verstreken", objection: "Bezwaar",
  objected: "Bezwaar gemaakt", one_time: "Eenmalig", open: "Open", opt_in: "Aanmelden",
  opt_out: "Afmelden", paid: "Betaald", payments: "Betalingen", pending: "In afwachting",
  permanent: "Permanent", processing: "Wordt verwerkt", qualifying_continued_use: "Kwalificerend voortgezet gebruik",
  quarterly: "Per kwartaal", queued: "In wachtrij", registered: "Geregistreerd",
  reminder: "Herinnering", resolved: "Opgelost", retryable: "Opnieuw te proberen",
  satisfied: "Voldaan", scheduled: "Ingepland", sent: "Verzonden", suppress: "Onderdrukken",
  suppressed: "Onderdrukt", suppression: "Onderdrukking", superseded: "Vervangen",
  system: "Systeem", transaction_acceptance: "Transactieacceptatie", unsuppress: "Onderdrukking opheffen",
  validated: "Gevalideerd", validating: "Wordt gevalideerd", verified: "Geverifieerd",
  waived: "Kwijtgescholden", waiver: "Kwijtschelding", warning: "Waarschuwing",
  submitted: "Ingediend", normalized: "Genormaliseerd", applying: "Wordt toegepast",
  draft_ready: "Concept gereed", preview_ready: "Preview gereed", domains: "Domeinen",
}

const humanize = (value: string) => value.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase())

export const adminEnumOption = (value: string) => ({
  label: adminText(humanize(value), dutchEnumLabels[value] ?? humanize(value)),
  value,
})
