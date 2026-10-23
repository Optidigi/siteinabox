import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { RtBlock, RtInline, RtRoot } from "@siteinabox/contracts/rich-text"
import type { TenantPrivacyDisclosure } from "@siteinabox/contracts/site"

/**
 * Legal documents are settings-owned documents, not page blocks. The slug is
 * still stable so the public renderer can expose the enabled document at a
 * predictable URL.
 */
export const TENANT_PRIVACY_DOCUMENT_SLUG = "privacy-en-cookieverklaring"
export const TENANT_PRIVACY_TEMPLATE_VERSION = "tenant-privacy-owned-2026-08-13.1"

const text = (value: string, marks?: Array<"bold">): RtInline => ({
  t: "text",
  v: value,
  ...(marks ? { marks } : {}),
})
const paragraph = (...children: RtInline[]): RtBlock => ({ t: "paragraph", children })
const heading = (value: string): RtBlock => ({ t: "heading", level: 2, children: [text(value)] })
const list = (items: string[]): RtBlock => ({
  t: "list",
  ordered: false,
  items: items.map((value) => ({
    t: "listItem",
    children: [paragraph(text(value))],
  })),
})
const blockRoot = (children: RtBlock[]): RtRoot => ({ t: "root", variant: "block", children })

const clean = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

/**
 * Kept as an explicit no-op for callers that still run the legal normalization
 * stage. Enabling a legal document is a deliberate settings decision; contact
 * data alone must never publish one as a side effect of site generation.
 */
export function withDerivedTenantPrivacyDisclosure(spec: SiteGenerationSpec): SiteGenerationSpec {
  return spec
}

const disclosureBody = (disclosure: TenantPrivacyDisclosure): RtRoot => {
  const controller = disclosure.controller
  const publicName = clean(controller.tradeName) ?? controller.legalName
  const forms = disclosure.contactMethods?.forms
  const contactMethods = [
    disclosure.contactMethods?.email ? "Contact per e-mail" : null,
    disclosure.contactMethods?.phone ? "Contact per telefoon" : null,
    disclosure.contactMethods?.whatsapp ? "Contact via WhatsApp" : null,
    forms?.enabled ? "Contact via formulieren op deze website" : null,
  ].filter((entry): entry is string => Boolean(entry))
  const identity = [
    `Juridische naam: ${controller.legalName}`,
    controller.tradeName ? `Handelsnaam: ${controller.tradeName}` : null,
    controller.address ? `Adres: ${controller.address}` : null,
    controller.kvkNumber ? `KvK-nummer: ${controller.kvkNumber}` : null,
    `E-mail: ${controller.email}`,
  ].filter((entry): entry is string => Boolean(entry))
  const processors = disclosure.additionalProcessors ?? []

  return blockRoot([
    heading("1. Wie is verantwoordelijk?"),
    paragraph(text(`${publicName} is verantwoordelijk voor de verwerking van persoonsgegevens via deze website.`)),
    list(identity),
    heading("2. Contact en formulieren"),
    paragraph(text("Wanneer u contact opneemt, verwerkt de ondernemer de gegevens die u zelf verstrekt om uw vraag, aanvraag of afspraak af te handelen en misbruik te voorkomen.")),
    ...(contactMethods.length ? [list(contactMethods)] : []),
    ...(forms?.enabled
      ? [paragraph(text(forms.mode === "cms"
        ? "Een formulierbericht kan worden doorgestuurd naar de ondernemer en opgeslagen in de beheeromgeving van deze website."
        : forms.mode === "forwarded"
          ? "Formuliergegevens worden technisch verwerkt en doorgestuurd naar de ondernemer."
          : "Formuliergegevens gaan rechtstreeks naar de ondernemer of de door de ondernemer gekozen dienst."))]
      : []),
    ...(forms?.retention?.kind === "days"
      ? [paragraph(text(`Formulierinzendingen worden normaal maximaal ${forms.retention.days} dagen bewaard, tenzij eerdere verwijdering of langere wettelijke bewaring nodig is.`))]
      : []),
    heading("3. Cookies en analytics"),
    paragraph(text("Noodzakelijke technieken kunnen worden gebruikt voor beveiliging, formulierafhandeling en de werking van de website. Site in a Box kan privacyvriendelijke bezoek- en prestatiestatistieken zonder analyticscookies of lokale tracking-ID opslaan. Aanvullende interacties, sessie-informatie en conversies worden alleen verwerkt wanneer de gekozen instellingen dat toestaan. Marketingtechnieken worden niet door de standaard Site in a Box-runtime geactiveerd.")),
    heading("4. Technische dienstverlening"),
    paragraph(text("Site in a Box levert de technische websiteomgeving. Optidigi, handelend onder de naam Site in a Box, verwerkt daarbij voor zover van toepassing persoonsgegevens in opdracht van de ondernemer als verwerker.")),
    ...(processors.length
      ? [list(processors.map((processor) => `${processor.name}: ${processor.purpose}${processor.location ? ` (${processor.location})` : ""}`))]
      : []),
    heading("5. Bewaring en beveiliging"),
    paragraph(text("Persoonsgegevens worden niet langer bewaard dan nodig voor het doel waarvoor ze zijn verzameld, tenzij een wettelijke bewaarplicht of gerechtvaardigd belang langere bewaring vereist. Er worden passende technische en organisatorische beveiligingsmaatregelen toegepast.")),
    heading("6. Uw rechten"),
    paragraph(
      text("U kunt binnen de wettelijke grenzen vragen om inzage, correctie, verwijdering, beperking of overdracht van uw persoonsgegevens, bezwaar maken of toestemming intrekken. Neem contact op via "),
      { t: "link", href: `mailto:${controller.privacyEmail ?? controller.email}`, rel: "external", children: [text(controller.privacyEmail ?? controller.email)] },
      text(". U kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens."),
    ),
    heading("7. Versie en wijzigingen"),
    paragraph(text(`Versie ${disclosure.version}, geldig vanaf ${disclosure.effectiveAt.slice(0, 10)}. Deze verklaring kan worden aangepast wanneer de website, gebruikte diensten of wettelijke verplichtingen wijzigen.`)),
  ])
}

export const materializeTenantPrivacyDisclosureValue = (disclosure: TenantPrivacyDisclosure): TenantPrivacyDisclosure => ({
  ...disclosure,
  enabled: true,
  mode: disclosure.mode === "custom" ? "custom" : "template",
  title: clean(disclosure.title) ?? "Privacy- en cookieverklaring",
  body: disclosure.mode === "custom" && disclosure.body ? disclosure.body : disclosureBody(disclosure),
})

/** New template path; keep the legacy function above stable for old migrations. */
export function materializeLocalizedTenantPrivacyDisclosure(disclosure: TenantPrivacyDisclosure, locale: string): TenantPrivacyDisclosure {
  const original = materializeTenantPrivacyDisclosureValue(disclosure)
  if (disclosure.mode === "custom" && disclosure.body) return original
  const english = locale === "en", appointments = disclosure.contactMethods?.appointments
  if (!english && !appointments?.enabled) return original
  const controller = disclosure.controller, forms = disclosure.contactMethods?.forms
  const appointmentBlocks = appointments?.enabled ? [
    heading(english ? "Appointments and calendars" : "Afspraken en agenda’s"),
    paragraph(text(english
      ? `Appointment details are retained by default for ${appointments.retentionDays ?? 90} days after the appointment ends. The supported tenant setting ranges from 30 to 730 days. Processing supports booking, operational messages, changes and cancellation.`
      : `Afspraakgegevens worden standaard ${appointments.retentionDays ?? 90} dagen na afloop bewaard. De ondersteunde tenantinstelling is 30 tot 730 dagen. Verwerking ondersteunt boeken, operationele berichten, wijzigen en annuleren.`)),
    ...((appointments.calendarProviders ?? []).length ? [paragraph(text(english
      ? `Optional calendar synchronization is enabled only after owner authorization: ${(appointments.calendarProviders ?? []).join(", ")}. Only necessary appointment details are mirrored; disconnect and deletion follow the integration policy.`
      : `Optionele agendasynchronisatie vereist machtiging door de eigenaar: ${(appointments.calendarProviders ?? []).join(", ")}. Alleen noodzakelijke afspraakgegevens worden gespiegeld; ontkoppeling en verwijdering volgen het integratiebeleid.`))] : []),
  ] : []
  const body = english ? blockRoot([
    heading("1. Controller"), paragraph(text(`${clean(controller.tradeName) ?? controller.legalName} controls personal data processed through this website.`)),
    list([`Legal name: ${controller.legalName}`, `Email: ${controller.email}`, ...(controller.address ? [`Address: ${controller.address}`] : []),
      ...(controller.kvkNumber ? [`Business registration: ${controller.kvkNumber}`] : [])]),
    heading("2. Contact and forms"), paragraph(text("Information you provide is used to handle your request and prevent abuse.")),
    ...(forms?.enabled ? [paragraph(text(forms.mode === "cms" ? "Form submissions can be forwarded to the business and stored in its management workspace." : "Form submissions are forwarded to the business or its selected service.")),
      paragraph(text(forms.retention?.kind === "days" ? `Form submissions are normally retained for at most ${forms.retention.days} days, subject to justified legal exceptions.` : "The default form retention period is 90 days; ask the controller about any separately applicable schedule."))] : []),
    ...appointmentBlocks, heading("3. Cookies and analytics"), paragraph(text("Necessary technology supports security and site operation. Optional analytics or marketing requires the applicable settings and choices. A query-history limit does not establish deletion of provider data.")),
    heading("4. Service providers"), paragraph(text("The website platform processes data on the business's instructions where applicable. The business remains responsible for accurate provider and processing disclosures.")),
    ...(disclosure.additionalProcessors?.length ? [list(disclosure.additionalProcessors.map(provider => `${provider.name}: ${provider.purpose}${provider.location ? ` (${provider.location})` : ""}`))] : []),
    heading("5. Retention and rights"), paragraph(text(`Contact ${controller.privacyEmail ?? controller.email} for questions or applicable access, correction, deletion, restriction, portability or objection rights. Separate required legal/security evidence may need longer retention.`)),
  // The legacy materializer always returns a block root in template mode.
  ]) : blockRoot([...(original.body as RtRoot & { children: RtBlock[] }).children, ...appointmentBlocks])
  return { ...original, title: english && (!clean(disclosure.title) || disclosure.title === "Privacy- en cookieverklaring") ? "Privacy and cookie notice" : original.title,
    templateVersion: `tenant-privacy-template-${english ? "en" : "nl"}-2026-10-23.1`, body }
}

/**
 * Materializes the enabled settings document without adding a page or a page
 * block. The public route consumes `settings.privacyDisclosure` directly.
 */
export function materializeTenantPrivacyDisclosure<T extends SiteGenerationSpec>(spec: T): T {
  const disclosure = spec.settings?.privacyDisclosure
  if (!disclosure || disclosure.enabled !== true) return spec

  const nextDisclosure = materializeLocalizedTenantPrivacyDisclosure(disclosure, spec.settings.language)
  const legalLinks = spec.settings.chrome?.footer?.legalLinks ?? []
  const hasLink = legalLinks.some((link) => link.href === `/${TENANT_PRIVACY_DOCUMENT_SLUG}`)

  return {
    ...spec,
    settings: {
      ...spec.settings,
      privacyDisclosure: nextDisclosure,
      chrome: {
        ...(spec.settings.chrome ?? {}),
        footer: {
          ...(spec.settings.chrome?.footer ?? {}),
          legalLinks: hasLink
            ? legalLinks
            : [...legalLinks, { label: spec.settings.language === "en" ? "Privacy and cookies" : "Privacy en cookies", href: `/${TENANT_PRIVACY_DOCUMENT_SLUG}` }],
        },
      },
    },
  } as T
}
