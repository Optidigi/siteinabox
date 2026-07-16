import type { GeneratedPageSpec, OfficialTenantSiteGenerationSpec, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { RtBlock, RtInline, RtRoot } from "@siteinabox/contracts/rich-text"
import type { TenantPrivacyDisclosure } from "@siteinabox/contracts/site"

export const TENANT_PRIVACY_PAGE_SLUG = "privacy-en-cookieverklaring"
export const TENANT_PRIVACY_TEMPLATE_VERSION = "tenant-privacy-shadcnui-blocks-2026-07-15.1"

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
const inlineRoot = (value: string): RtRoot => ({ t: "root", variant: "inline", children: [text(value)] })

const clean = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

const derivedDisclosure = (spec: SiteGenerationSpec): TenantPrivacyDisclosure | null => {
  if (spec.settings.privacyDisclosure?.enabled === false) return null
  if (spec.settings.privacyDisclosure) return spec.settings.privacyDisclosure

  const email = clean(spec.settings.contactEmail) ?? clean(spec.intake.contact?.email)
  if (!email) return null
  const facts = spec.intake.companyFacts
  const formType = spec.intake.intakeBrief?.contactPreferences.formType

  return {
    enabled: true,
    version: TENANT_PRIVACY_TEMPLATE_VERSION,
    effectiveAt: spec.generatedAt ?? "2026-07-10T00:00:00.000Z",
    controller: {
      legalName: clean(spec.settings.nap?.legalName) ?? spec.tenant.name,
      tradeName: spec.settings.siteName,
      email,
      privacyEmail: email,
      kvkNumber: clean(spec.settings.nap?.kvkNumber) ?? clean(facts?.kvkNumber),
      address: clean(spec.settings.contact?.address) ?? clean(facts?.address),
    },
    contactMethods: {
      email: true,
      phone: Boolean(clean(spec.settings.contact?.phone) ?? clean(spec.intake.contact?.phone)),
      whatsapp: Boolean(spec.intake.intakeBrief?.contactPreferences.whatsappNumber),
      forms: formType && formType !== "none"
        ? { enabled: true, mode: "cms", retention: { kind: "days", days: 90 } }
        : { enabled: false, mode: "direct" },
    },
    marketingTechnologies: [],
    additionalProcessors: [],
  }
}

export function withDerivedTenantPrivacyDisclosure(spec: SiteGenerationSpec): SiteGenerationSpec {
  if (!spec.settings || typeof spec.settings !== "object") return spec
  if (spec.settings.privacyDisclosure) return spec
  const disclosure = derivedDisclosure(spec)
  return disclosure
    ? { ...spec, settings: { ...spec.settings, privacyDisclosure: disclosure } }
    : spec
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
    paragraph(text("Noodzakelijke technieken kunnen worden gebruikt voor beveiliging, formulierafhandeling en de werking van de website. Er worden momenteel geen optionele browseranalytics of marketingtechnieken door de Site in a Box-runtime geactiveerd.")),
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

const privacyPage = (disclosure: TenantPrivacyDisclosure, siteName: string): GeneratedPageSpec => ({
  slug: TENANT_PRIVACY_PAGE_SLUG,
  title: "Privacy- en cookieverklaring",
  status: "draft",
  seo: {
    title: `Privacy- en cookieverklaring | ${siteName}`,
    description: `Lees hoe ${siteName} persoonsgegevens en websitegegevens verwerkt.`,
  },
  blocks: [
    {
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      metadata: { source: "system", systemRole: "tenant-privacy", templateVersion: TENANT_PRIVACY_TEMPLATE_VERSION },
      eyebrow: inlineRoot("Privacy en cookies"),
      headline: inlineRoot("Privacy- en cookieverklaring"),
      subheadline: blockRoot([paragraph(text(`Informatie over de verwerking van persoonsgegevens via ${siteName}.`))]),
    },
    {
      blockType: "contentSection",
      designVariant: "shadcnui-blocks.legal-content-01",
      metadata: { source: "system", systemRole: "tenant-privacy", templateVersion: TENANT_PRIVACY_TEMPLATE_VERSION },
      body: disclosureBody(disclosure),
    },
  ],
})

export function materializeTenantPrivacyPage<T extends SiteGenerationSpec | OfficialTenantSiteGenerationSpec>(spec: T): T {
  if (!spec.settings || typeof spec.settings !== "object" || !Array.isArray(spec.pages)) return spec
  const disclosure = spec.settings.privacyDisclosure
  if (!disclosure || disclosure.enabled === false) return spec
  const existing = spec.pages.find((page) =>
    page.slug === TENANT_PRIVACY_PAGE_SLUG || page.slug === "privacy",
  )
  const slug = existing?.slug ?? TENANT_PRIVACY_PAGE_SLUG
  const legalLinks = spec.settings.chrome?.footer?.legalLinks ?? []
  const hasLink = legalLinks.some((link) => link.href === `/${slug}`)
  const pages = existing ? spec.pages : [...spec.pages, privacyPage(disclosure, spec.settings.siteName)]
  const blocks = [...(spec.blocks ?? [])]
  for (const entry of [
    { slug: "hero" as const, label: "Hero" },
    { slug: "contentSection" as const, label: "Legal content" },
  ]) {
    if (!blocks.some((block) => block.slug === entry.slug)) blocks.push(entry)
  }

  return {
    ...spec,
    settings: {
      ...spec.settings,
      privacyDisclosure: disclosure,
      chrome: {
        ...(spec.settings.chrome ?? {}),
        footer: {
          ...(spec.settings.chrome?.footer ?? {}),
          legalLinks: hasLink
            ? legalLinks
            : [...legalLinks, { label: "Privacy en cookies", href: `/${slug}` }],
        },
      },
    },
    pages,
    blocks,
  } as T
}

export function isMaterializedTenantPrivacyBlock(pageSlug: string, block: Record<string, unknown>): boolean {
  if (pageSlug !== TENANT_PRIVACY_PAGE_SLUG) return false
  const metadata = block.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false
  if ((metadata as Record<string, unknown>).source !== "system" || (metadata as Record<string, unknown>).systemRole !== "tenant-privacy") return false
  return (
    (block.blockType === "hero" && block.designVariant === "shadcnui-blocks.hero-01") ||
    (block.blockType === "contentSection" && block.designVariant === "shadcnui-blocks.legal-content-01")
  )
}
