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
          designVariant: "tailwindplus.marketing.hero.simple-centered",
          anchor: "top",
          eyebrow: inlineText("Nieuwe website"),
          headline: inlineText("Generated Business"),
          subheadline: blockText("Een compacte draft op basis van herbruikbare catalogusblokken."),
          cta: { label: "Neem contact op", href: "/#contact" },
          secondary: { label: "Meer informatie", href: "/" },
        },
        {
          blockType: "featureList",
          designVariant: "tailwindplus.marketing.feature.with-product-screenshot",
          anchor: "services",
          eyebrow: inlineText("Sneller live"),
          title: inlineText("Een website die direct bewerkbaar blijft"),
          intro: blockText("SiaB vult goedgekeurde providerblokken met gestructureerde CMS-data."),
          image: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/project-app-screenshot.png",
            alt: "CMS preview screenshot",
            width: 2432,
            height: 1442,
          },
          features: [
            { title: inlineText("Gevalideerde content"), description: blockText("Alle tekst, links en media blijven CMS-velden."), icon: "cloud-arrow-up" },
            { title: inlineText("Geen client source"), description: blockText("Nieuwe sites gebruiken platformdata, geen per-klant code."), icon: "lock-closed" },
            { title: inlineText("Zelfde renderer"), description: blockText("Canvas, preview en public runtime gebruiken dezelfde component."), icon: "server" },
          ],
        },
        {
          blockType: "featureList",
          designVariant: "tailwindplus.marketing.feature.centered-2x2-grid",
          anchor: "platform",
          title: inlineText("Wat de draft standaard regelt"),
          intro: blockText("Vier vaste featureposities houden de bronlayout intact."),
          features: [
            { title: inlineText("CMS slots"), description: blockText("Alle betekenisvolle velden zijn bewerkbaar."), icon: "cloud-arrow-up" },
            { title: inlineText("Veilige varianten"), description: blockText("Alleen actieve provider-ID's zijn toegestaan."), icon: "lock-closed" },
            { title: inlineText("Thema tokens"), description: blockText("Kleur, fonts en radius komen uit het thema."), icon: "arrow-path" },
            { title: inlineText("Public runtime"), description: blockText("Public snapshots worden vooraf gevalideerd."), icon: "finger-print" },
          ],
        },
        {
          blockType: "cta",
          designVariant: "tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
          anchor: "demo",
          headline: inlineText("Bekijk de preview en pas content aan"),
          description: blockText("De broncomponent blijft intact terwijl je labels, links en media beheert."),
          primary: { label: "Open contact", href: "/#contact" },
          secondary: { label: "Naar boven", href: "/#top" },
          backgroundImage: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
            alt: "Preview screenshot",
            width: 1824,
            height: 1080,
          },
        },
        {
          blockType: "testimonials",
          designVariant: "tailwindplus.marketing.testimonial.simple-centered",
          anchor: "review",
          logo: {
            url: "https://tailwindcss.com/plus-assets/img/logos/workcation-logo-indigo-600.svg",
            alt: "Workcation",
            width: 158,
            height: 48,
          },
          items: [
            {
              quote: "De preview was direct herkenbaar, snel aanpasbaar en klaar voor publicatie.",
              author: "Sam Intake",
              role: "Founder, Generated Business",
              avatar: {
                url: "https://tailwindcss.com/plus-assets/img/avatars/avatar-1.jpg",
                alt: "Sam Intake",
                width: 256,
                height: 256,
              },
            },
          ],
        },
        {
          blockType: "stats",
          designVariant: "tailwindplus.marketing.stats.simple",
          anchor: "stats",
          items: [
            { value: "24", label: "Projecten opgeleverd" },
            { value: "7 dagen", label: "Gemiddelde drafttijd" },
            { value: "100%", label: "CMS bewerkbaar" },
          ],
        },
        {
          blockType: "logoCloud",
          designVariant: "tailwindplus.marketing.logo-cloud.simple-with-heading",
          anchor: "partners",
          title: inlineText("Vertrouwd door teams die snel willen publiceren"),
          logos: [
            {
              name: "Transistor",
              href: "https://example.com/transistor",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/transistor-logo-gray-900.svg", alt: "Transistor", width: 158, height: 48 },
            },
            {
              name: "Reform",
              href: "https://example.com/reform",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/reform-logo-gray-900.svg", alt: "Reform", width: 158, height: 48 },
            },
            {
              name: "Tuple",
              href: "https://example.com/tuple",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/tuple-logo-gray-900.svg", alt: "Tuple", width: 158, height: 48 },
            },
            {
              name: "SavvyCal",
              href: "https://example.com/savvycal",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/savvycal-logo-gray-900.svg", alt: "SavvyCal", width: 158, height: 48 },
            },
            {
              name: "Statamic",
              href: "https://example.com/statamic",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/statamic-logo-gray-900.svg", alt: "Statamic", width: 158, height: 48 },
            },
          ],
        },
        {
          blockType: "contactSection",
          designVariant: "tailwindplus.marketing.contact.centered",
          anchor: "contact",
          title: inlineText("Neem contact op"),
          description: blockText("Vertel kort wat je nodig hebt; de CMS-formulierbinding handelt de inzending af."),
          formName: "Contact form",
          submitLabel: "Verstuur bericht",
          fields: [
            { name: "first-name", label: "Voornaam", type: "text", required: true, placeholder: "Sam" },
            { name: "last-name", label: "Achternaam", type: "text", required: true, placeholder: "Intake" },
            { name: "email", label: "E-mail", type: "email", required: true, placeholder: "sam@example.com" },
            { name: "phone", label: "Telefoon", type: "tel", required: false, placeholder: "+31 6 12345678" },
            { name: "message", label: "Bericht", type: "textarea", required: true, placeholder: "Waar kunnen we mee helpen?", maxLength: 1000 },
          ],
          provider: {
            provider: "siab",
            action: "/api/forms",
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
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "headline", label: "Headline", kind: "richtext", variant: "inline", role: "title" },
        { name: "subheadline", label: "Subheadline", kind: "richtext", variant: "block", role: "text" },
        { name: "cta", label: "Primary action", kind: "cta" },
        { name: "secondary", label: "Secondary action", kind: "cta" },
      ],
    },
    {
      slug: "featureList",
      label: "Feature list",
      defaultAnchor: "services",
      fields: [
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "title" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        { name: "image", label: "Image", kind: "image" },
        {
          name: "features",
          label: "Features",
          kind: "array",
          itemLabel: "Feature",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "icon", label: "Icon", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "cta",
      label: "CTA",
      defaultAnchor: "demo",
      fields: [
        { name: "headline", label: "Headline", kind: "richtext", variant: "inline", role: "title" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "primary", label: "Primary action", kind: "cta" },
        { name: "secondary", label: "Secondary action", kind: "cta" },
        { name: "backgroundImage", label: "Background image", kind: "image" },
      ],
    },
    {
      slug: "testimonials",
      label: "Testimonials",
      defaultAnchor: "review",
      fields: [
        { name: "logo", label: "Logo", kind: "image" },
        {
          name: "items",
          label: "Testimonials",
          kind: "array",
          itemLabel: "Testimonial",
          itemFields: [
            { name: "quote", label: "Quote", kind: "text" },
            { name: "author", label: "Author", kind: "text" },
            { name: "role", label: "Role", kind: "text" },
            { name: "avatar", label: "Avatar", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "stats",
      label: "Stats",
      defaultAnchor: "stats",
      fields: [
        {
          name: "items",
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
      slug: "logoCloud",
      label: "Logo cloud",
      defaultAnchor: "partners",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        {
          name: "logos",
          label: "Logos",
          kind: "array",
          itemLabel: "Logo",
          itemFields: [
            { name: "name", label: "Name", kind: "text" },
            { name: "image", label: "Logo image", kind: "image" },
            { name: "href", label: "Href", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "contactSection",
      label: "Contact",
      defaultAnchor: "contact",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "formName", label: "Form name", kind: "text" },
        { name: "submitLabel", label: "Submit label", kind: "text" },
        {
          name: "fields",
          label: "Fields",
          kind: "array",
          itemLabel: "Field",
          itemFields: [
            { name: "name", label: "Name", kind: "text" },
            { name: "label", label: "Label", kind: "text" },
            { name: "type", label: "Type", kind: "text" },
            { name: "required", label: "Required", kind: "checkbox" },
            { name: "placeholder", label: "Placeholder", kind: "text" },
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
        { label: "Contact", href: "/#top" },
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
            cta: { ...block.cta, href: contactHref },
            secondary: { ...block.secondary, href: "/" },
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
