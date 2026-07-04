import type { NormalizedIntake, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

export type MockGenerationFixture = "generic" | "invalid"

const cloneSpec = (spec: SiteGenerationSpec): SiteGenerationSpec =>
  JSON.parse(JSON.stringify(spec)) as SiteGenerationSpec

const inlineText = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockText = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const genericSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Generated Business",
    tenantSlug: "generated-business",
    primaryDomain: "generated-business.test",
    siteUrl: "https://generated-business.test",
    language: "nl",
    serviceArea: [],
    goals: [],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Generated homepage" }],
  },
  tenant: {
    name: "Generated Business",
    slug: "generated-business",
    domain: "generated-business.test",
    status: "provisioning",
  },
  theme: {
    colors: {
      accent: "#2563eb",
      bg: "#ffffff",
      ink: "#111827",
      muted: "#4b5563",
      card: "#f8fafc",
      secondary: "#059669",
      rule: "#e5e7eb",
    },
    fonts: {
      title: "Inter",
      heading: "Inter",
      text: "Inter",
    },
    radius: "8px",
    density: "comfortable",
    borderStyle: "solid",
    mode: "light",
    stylePreset: "catalog-clean",
  },
  settings: {
    siteName: "Generated Business",
    siteUrl: "https://generated-business.test",
    description: "A generated draft website based on reusable catalog blocks.",
    language: "nl",
    contactEmail: "hello@example.com",
    branding: { primaryColor: "#2563eb" },
    chrome: {
      header: {
        variant: "default",
        behavior: "sticky",
        activeMode: "path",
        mobileMenu: "drawer",
        cta: { label: "Contact", href: "/#contact" },
      },
      footer: {
        variant: "default",
        tagline: "Generated with reusable catalog blocks.",
        copyright: "(c) Generated Business",
        legalLinks: [],
        columns: [
          {
            id: "main",
            items: [
              {
                id: "brand",
                type: "brand",
                label: "Generated Business",
                text: "Reusable catalog draft.",
                links: [],
              },
            ],
          },
          {
            id: "contact",
            items: [
              {
                id: "email",
                type: "contact",
                label: "Contact",
                text: null,
                links: [{ label: "hello@example.com", href: "mailto:hello@example.com" }],
              },
            ],
          },
        ],
      },
      banner: {
        variant: "default",
        visible: false,
        title: null,
        message: "Preview draft ready.",
        link: null,
        dismissible: true,
      },
    },
    contact: { phone: null, address: null, social: [] },
    navHeader: [
      { label: "Home", href: "/" },
      { label: "Diensten", href: "/#services" },
      { label: "Contact", href: "/#contact" },
    ],
    navFooter: [
      { label: "Home", href: "/" },
      { label: "Contact", href: "mailto:hello@example.com", external: true },
    ],
    serviceArea: [],
  },
  pages: [
    {
      slug: "index",
      title: "Home",
      status: "draft",
      seo: {
        title: "Generated Business",
        description: "Generated draft site.",
        ogImage: null,
      },
      blocks: [
        {
          blockType: "hero",
          designVariant: "tailwindPlusSimpleCentered",
          anchor: "top",
          eyebrow: inlineText("Nieuwe website"),
          headline: inlineText("Generated Business"),
          subheadline: blockText("Een compacte draft op basis van herbruikbare catalogusblokken."),
          pills: [{ label: "Snel online" }, { label: "CMS bewerkbaar" }],
          cta: { label: "Neem contact op", href: "/#contact" },
          image: null,
        },
        {
          blockType: "featureList",
          designVariant: "tailwindPlusCentered2x2",
          anchor: "services",
          title: inlineText("Wat we doen"),
          intro: blockText("De belangrijkste diensten en voordelen, klaar om in het CMS te verfijnen."),
          features: [
            {
              title: inlineText("Heldere positionering"),
              description: blockText("Copy en structuur volgen de intake en blijven volledig bewerkbaar."),
              icon: "sparkles",
            },
            {
              title: inlineText("Responsive basis"),
              description: blockText("De layout gebruikt goedgekeurde Tailwind cataloguspatronen."),
              icon: "layout",
            },
            {
              title: inlineText("Snelle preview"),
              description: blockText("Na generatie kan de klant de preview bekijken en goedkeuren."),
              icon: "eye",
            },
            {
              title: inlineText("Publicatiegate"),
              description: blockText("Live activatie volgt pas na akkoord en betaalstatus."),
              icon: "credit-card",
            },
          ],
        },
        {
          blockType: "richText",
          designVariant: "tailblocksContentA",
          anchor: "process",
          body: {
            t: "root",
            variant: "block",
            children: [
              { t: "heading", level: 2, children: [{ t: "text", v: "Van intake naar live site" }] },
              { t: "paragraph", children: [{ t: "text", v: "Een korte route van bewerkbare draft naar gecontroleerde publicatie." }] },
            ],
          },
        },
        {
          blockType: "stats",
          designVariant: "tailwindPlusSimple",
          anchor: "proof",
          title: inlineText("Klaar om te verfijnen"),
          intro: blockText("De draft gebruikt uitsluitend goedgekeurde catalogusvarianten en blijft volledig CMS-bewerkbaar."),
          items: [
            {
              value: "100%",
              label: "CMS-data",
              description: blockText("Geen per-klant broncode of losse runtimepaden."),
            },
            {
              value: "3",
              label: "Bronfamilies",
              description: blockText("Tailwind Plus, Preline UI en Tailblocks vormen de UI-basis."),
            },
            {
              value: "1",
              label: "Renderer",
              description: blockText("Live, preview en canvas delen dezelfde rendering foundation."),
            },
          ],
        },
        {
          blockType: "cta",
          designVariant: "tailblocksCtaA",
          anchor: "start",
          eyebrow: inlineText("Klaar voor de volgende stap"),
          headline: inlineText("Plan een intake"),
          description: blockText("Laat je gegevens achter en we maken de draft verder passend."),
          primary: { label: "Contact", href: "/#contact" },
          secondary: null,
          backgroundImage: null,
        },
        {
          blockType: "contactSection",
          designVariant: "prelineCenteredNewsletter",
          anchor: "contact",
          title: inlineText("Contact"),
          description: blockText("Stuur een bericht, dan nemen we contact op."),
          formName: "generated-contact",
          submitLabel: "Versturen",
          fields: [
            { name: "name", label: "Naam", type: "text", required: true },
            { name: "email", label: "E-mail", type: "email", required: true },
            { name: "message", label: "Bericht", type: "textarea", required: true },
          ],
          provider: {
            provider: "siab",
            action: "/api/forms",
            method: "POST",
            hiddenFields: [{ name: "source", value: "generated-site" }],
            honeypotField: "company",
            fallbackHref: "mailto:hello@example.com",
            successMessage: "Bedankt, we nemen contact op.",
            errorMessage: "Verzenden is niet gelukt. Mail ons rechtstreeks.",
            requiresConsent: false,
            analyticsEnabled: true,
          },
        },
      ],
    },
  ],
  blocks: [
    { slug: "hero", label: "Hero", defaultAnchor: "top" },
    { slug: "featureList", label: "Services", defaultAnchor: "services" },
    { slug: "richText", label: "Proces", defaultAnchor: "process" },
    { slug: "stats", label: "Bewijs", defaultAnchor: "proof" },
    { slug: "cta", label: "Call to action", defaultAnchor: "start" },
    { slug: "contactSection", label: "Contact", defaultAnchor: "contact" },
  ],
  assets: [],
  generatedAt: "2026-06-25T00:00:00.000Z",
  generator: {
    name: "mock-site-generation",
    version: "phase-6",
    model: "fixture",
  },
}

export const loadMockSiteGenerationSpec = (
  normalized: NormalizedIntake,
  fixture: MockGenerationFixture = "generic",
): SiteGenerationSpec => {
  const spec = cloneSpec(genericSiteGenerationSpec)
  const generatedAt = new Date().toISOString()
  const contactEmail = normalized.contact?.email ?? spec.settings.contactEmail
  const contactHref = contactEmail ? `mailto:${contactEmail}` : "/#contact"
  const requestedPages = normalized.requestedPages.length > 0
    ? normalized.requestedPages
    : [{ slug: "index", title: "Home", purpose: "Generated homepage" }]

  const rewritten: SiteGenerationSpec = {
    ...spec,
    intake: normalized,
    tenant: {
      name: normalized.businessName,
      slug: normalized.tenantSlug,
      domain: normalized.primaryDomain,
      status: "provisioning",
    },
    settings: {
      ...spec.settings,
      siteName: normalized.businessName,
      siteUrl: normalized.siteUrl,
      language: normalized.language,
      contactEmail,
      contact: {
        ...spec.settings.contact,
        phone: normalized.contact?.phone ?? spec.settings.contact?.phone,
      },
      serviceArea: normalized.serviceArea.map((name) => ({ name })),
      navHeader: [
        { label: "Home", href: "/" },
        { label: "Diensten", href: "/#services" },
        { label: "Proces", href: "/#process" },
        { label: "Bewijs", href: "/#proof" },
        { label: "Contact", href: "/#contact" },
      ],
      navFooter: [
        { label: "Home", href: "/" },
        { label: "Contact", href: contactHref, external: contactHref.startsWith("mailto:") },
      ],
      chrome: {
        ...spec.settings.chrome,
        footer: {
          ...spec.settings.chrome?.footer,
          copyright: `(c) ${normalized.businessName}`,
          columns: spec.settings.chrome?.footer?.columns?.map((column) => ({
            ...column,
            items: column.items?.map((item) => ({
              ...item,
              label: item.type === "brand" ? normalized.businessName : item.label,
              links: item.type === "contact" ? [{ label: contactEmail ?? "Contact", href: contactHref }] : item.links,
            })),
          })),
        },
      },
    },
    pages: spec.pages.map((page, index) => ({
      ...page,
      title: requestedPages[index]?.title ?? page.title,
      seo: {
        ...page.seo,
        title: normalized.businessName,
        description: `${normalized.businessName} - generated preview draft.`,
      },
      blocks: page.blocks.map((block) => {
        if (block.blockType === "hero") {
          return {
            ...block,
            headline: inlineText(normalized.businessName),
            subheadline: blockText(
              normalized.goals.length > 0
                ? normalized.goals.join(". ")
                : `Een bewerkbare preview voor ${normalized.businessName}.`,
            ),
          }
        }
        if (block.blockType === "contactSection") {
          return {
            ...block,
            provider: {
              ...block.provider,
              fallbackHref: contactHref,
            },
          }
        }
        return block
      }),
    })),
    generatedAt,
    generator: {
      name: "mock-site-generation",
      version: "phase-6",
      model: "fixture",
    },
  }

  if (fixture === "invalid") {
    return {
      ...rewritten,
      tenant: {
        ...rewritten.tenant,
        slug: "Invalid Slug",
      },
    }
  }

  return rewritten
}
