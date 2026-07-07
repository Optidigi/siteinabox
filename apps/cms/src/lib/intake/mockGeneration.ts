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
    version: 2,
    appearance: { mode: "light" },
    colors: { schemeId: "blue-professional" },
    fonts: { schemeId: "clear-modern" },
    shape: { schemeId: "soft" },
    density: { schemeId: "comfortable" },
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
        variant: "tailwindplus.marketing.header.with-stacked-flyout-menu",
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
        variant: "tailwindplus.marketing.banner.with-button",
        visible: true,
        title: "Nieuwe draft",
        message: "Preview draft ready.",
        link: { label: "Contact", href: "/#contact" },
        dismissible: true,
      },
    },
    contact: { phone: null, address: null, social: [] },
    navHeader: [
      { label: "Home", href: "/" },
      { label: "Workflow", href: "/#workflow" },
      { label: "Platform", href: "/#platform-grid" },
      { label: "Updates", href: "/#newsletter" },
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
          designVariant: "tailwindplus.marketing.hero.with-stats",
          anchor: "top",
          headline: inlineText("Generated Business"),
          subheadline: blockText("Een compacte draft op basis van vrije publieke bronblokken en gestructureerde CMS-slots."),
          image: {
            url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
            alt: "Team reviewing a website preview",
            width: 1600,
            height: 1067,
          },
          links: [
            { label: "Workflow", href: "/#workflow" },
            { label: "Platform", href: "/#platform-grid" },
            { label: "Updates", href: "/#newsletter" },
            { label: "Contact", href: "mailto:hello@example.com" },
          ],
          stats: [
            { value: "4", label: "vrije publieke varianten" },
            { value: "0", label: "gegenereerde bronbestanden" },
            { value: "1", label: "gedeeld rendererpad" },
            { value: "100%", label: "gestructureerde slots" },
          ],
        },
        {
          blockType: "contentSection",
          designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
          anchor: "workflow",
          eyebrow: inlineText("Workflow"),
          title: inlineText("Content en screenshot blijven gestructureerd"),
          intro: blockText("De sticky contentsectie gebruikt vaste Tailwind Plus layout en vult alleen goedgekeurde CMS-slots."),
          body: blockText("SiaB bewaart de tekst, screenshot en drie feature-rijen als data. De providerbron bepaalt de sticky positie, spacing, achtergrond en responsive framing."),
          bridge: blockText("Deze tussenparagraaf blijft een expliciet CMS-slot, zodat de bronlayout compleet blijft zonder vrije layoutvelden."),
          image: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
            alt: "Preview workflow screenshot",
            width: 1824,
            height: 1080,
          },
          features: [
            { title: inlineText("Publiceerbare snapshots."), description: blockText("Preview en live runtime lezen dezelfde gevalideerde publicatievorm.") },
            { title: inlineText("Veilige infrastructuur."), description: blockText("Domeinen, certificaten en hosting blijven platformverantwoordelijkheid.") },
            { title: inlineText("Herstelbare content."), description: blockText("CMS-data blijft de bron, niet gegenereerde clientcode.") },
          ],
          secondaryTitle: inlineText("Geen tenant source nodig"),
          secondaryBody: blockText("Nieuwe websites worden samengesteld uit gevalideerde tenantdata en actieve providercomponenten."),
        },
        {
          blockType: "bentoGrid",
          designVariant: "tailwindplus.marketing.bento.three-column-bento-grid",
          anchor: "platform-grid",
          title: inlineText("Platformbouwstenen"),
          intro: blockText("Vier vaste bento-posities tonen hoe providergeometrie vast blijft terwijl content bewerkbaar is."),
          items: [
            {
              title: inlineText("Mobiel vriendelijk"),
              description: blockText("De linker kaart gebruikt de vaste mobile-preview positie uit de bronlayout."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png",
                alt: "Mobiele preview",
                width: 720,
                height: 1280,
              },
            },
            {
              title: inlineText("Snel geladen"),
              description: blockText("De public runtime rendert snapshots zonder per-tenant buildstappen."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-performance.png",
                alt: "Performance preview",
                width: 1024,
                height: 768,
              },
            },
            {
              title: inlineText("Fail-closed"),
              description: blockText("Onbekende provider-ID's vallen niet stil terug naar generieke layout."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png",
                alt: "Security preview",
                width: 1024,
                height: 512,
              },
            },
            {
              title: inlineText("Platform API's"),
              description: blockText("CMS, preview, publicatie en renderer blijven platformgrenzen."),
              image: null,
            },
          ],
        },
        {
          blockType: "newsletter",
          designVariant: "tailwindplus.marketing.newsletter.side-by-side-with-details",
          anchor: "newsletter",
          title: inlineText("Ontvang updates over je lancering"),
          description: blockText("De nieuwsbriefsectie gebruikt een eigen section contract en houdt formulier- en consentgedrag buiten vrije layoutvelden."),
          emailLabel: "E-mailadres",
          emailPlaceholder: "jij@example.com",
          submitLabel: "Aanmelden",
          benefits: [
            {
              title: inlineText("Lanceringstips"),
              description: blockText("Korte praktische updates over content, publicatie en vervolgacties."),
            },
            {
              title: inlineText("Geen vrije code"),
              description: blockText("Alle nieuwsbriefdata blijft gestructureerd en CMS-bewerkbaar."),
            },
          ],
          provider: {
            provider: "siab",
            action: "/api/newsletter",
            method: "POST",
            requiresConsent: true,
            analyticsEnabled: true,
          },
        },
      ],
    },
  ],
  blocks: [
    {
      slug: "hero",
      label: "Hero",
      defaultAnchor: "top",
      fields: [
        { name: "headline", label: "Headline", kind: "richtext", variant: "inline", role: "title" },
        { name: "subheadline", label: "Subheadline", kind: "richtext", variant: "block", role: "text" },
        { name: "image", label: "Image", kind: "image" },
        {
          name: "links",
          label: "Links",
          kind: "array",
          itemLabel: "Link",
          itemFields: [
            { name: "label", label: "Label", kind: "text" },
            { name: "href", label: "Href", kind: "text" },
          ],
        },
        {
          name: "stats",
          label: "Stats",
          kind: "array",
          itemLabel: "Stat",
          itemFields: [
            { name: "value", label: "Value", kind: "text" },
            { name: "label", label: "Label", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "bentoGrid",
      label: "Bento grid",
      defaultAnchor: "platform-grid",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        {
          name: "items",
          label: "Items",
          kind: "array",
          itemLabel: "Item",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "image", label: "Image", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "contentSection",
      label: "Content section",
      defaultAnchor: "workflow",
      fields: [
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        { name: "body", label: "Body", kind: "richtext", variant: "block", role: "text" },
        { name: "bridge", label: "Bridge paragraph", kind: "richtext", variant: "block", role: "text" },
        { name: "image", label: "Image", kind: "image" },
        {
          name: "features",
          label: "Features",
          kind: "array",
          itemLabel: "Feature",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
          ],
        },
        { name: "secondaryTitle", label: "Secondary title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "secondaryBody", label: "Secondary body", kind: "richtext", variant: "block", role: "text" },
      ],
    },
    {
      slug: "newsletter",
      label: "Newsletter",
      defaultAnchor: "newsletter",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "emailLabel", label: "Email label", kind: "text" },
        { name: "emailPlaceholder", label: "Email placeholder", kind: "text" },
        { name: "submitLabel", label: "Submit label", kind: "text" },
        {
          name: "benefits",
          label: "Benefits",
          kind: "array",
          itemLabel: "Benefit",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
          ],
        },
      ],
    },
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
        { label: "Workflow", href: "/#workflow" },
        { label: "Platform", href: "/#platform-grid" },
        { label: "Updates", href: "/#newsletter" },
      ],
      navFooter: [
        { label: "Home", href: "/" },
        { label: "Contact", href: contactHref, external: contactHref.startsWith("mailto:") },
      ],
      chrome: {
        ...spec.settings.chrome,
        header: {
          ...spec.settings.chrome?.header,
          cta: { label: "Contact", href: contactHref },
        },
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
