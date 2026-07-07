import type { NormalizedIntake, SiteBlockManifestItem, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { Block, SiteGenerationBlockSlug } from "@siteinabox/contracts/site"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"
import {
  getProviderBlockDefinition,
  selfServeProviderBlockDefinitions,
  tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots,
  tailwindPlusMarketingBlogThreeColumnDemoSlots,
  tailwindPlusMarketingContactCenteredDemoSlots,
  tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
  tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
  tailwindPlusMarketingFeatureCentered2x2GridDemoSlots,
  tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots,
  tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
  tailwindPlusMarketingHeroWithStatsDemoSlots,
  tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots,
  tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots,
  tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots,
  tailwindPlusMarketingStatsSimpleDemoSlots,
  tailwindPlusMarketingTeamWithSmallImagesDemoSlots,
  tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots,
} from "@siteinabox/site-renderer/source-blocks"

export type MockGenerationFixture = "generic" | "invalid"

const cloneSpec = (spec: SiteGenerationSpec): SiteGenerationSpec =>
  JSON.parse(JSON.stringify(spec)) as SiteGenerationSpec

const clonePlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

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

const canonicalProviderBlock = <TBlock extends Block>(block: TBlock, anchor: string): TBlock => {
  const definition = getProviderBlockDefinition(block)
  if (!definition) {
    throw new Error(`Missing smoke fixture provider definition for ${block.blockType}:${block.designVariant ?? ""}`)
  }
  return {
    ...clonePlain(block),
    designVariant: definition.id,
    anchor,
  } as TBlock
}

const buildTailwindSmokeBlocks = (
  businessName: string,
  summary: string,
  contactHref: string,
): Block[] => [
  canonicalProviderBlock({
    ...tailwindPlusMarketingHeroSimpleCenteredDemoSlots,
    headline: inlineText(businessName),
    subheadline: blockText(summary),
    cta: { label: "Bekijk workflow", href: "/#workflow" },
    secondary: { label: "Contact", href: contactHref },
  }, "top"),
  canonicalProviderBlock(tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots, "logo-cloud"),
  canonicalProviderBlock(tailwindPlusMarketingFeatureCentered2x2GridDemoSlots, "feature-grid"),
  canonicalProviderBlock(tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots, "product-screenshot"),
  canonicalProviderBlock({
    ...tailwindPlusMarketingContentStickyProductScreenshotDemoSlots,
    features: tailwindPlusMarketingContentStickyProductScreenshotDemoSlots.features?.map(({ icon: _icon, ...feature }) => feature),
  }, "workflow"),
  canonicalProviderBlock(tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots, "platform-grid"),
  canonicalProviderBlock(tailwindPlusMarketingStatsSimpleDemoSlots, "metrics"),
  canonicalProviderBlock(tailwindPlusMarketingHeroWithStatsDemoSlots, "coverage"),
  canonicalProviderBlock(tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots, "testimonial"),
  canonicalProviderBlock(tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots, "pricing"),
  canonicalProviderBlock(tailwindPlusMarketingTeamWithSmallImagesDemoSlots, "team"),
  canonicalProviderBlock(tailwindPlusMarketingBlogThreeColumnDemoSlots, "resources"),
  canonicalProviderBlock({
    ...tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots,
    provider: { provider: "siab", action: "/api/newsletter", method: "POST", requiresConsent: true, analyticsEnabled: true },
  }, "newsletter"),
  canonicalProviderBlock({
    ...tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots,
    primary: { label: "Contact", href: contactHref },
    secondary: { label: "Bekijk prijzen", href: "/#pricing" },
  }, "cta"),
  canonicalProviderBlock({
    ...tailwindPlusMarketingContactCenteredDemoSlots,
    formName: "smoke-contact",
    provider: {
      provider: "siab",
      action: "/api/forms",
      method: "POST",
      requiresConsent: true,
      successMessage: "Thanks, we will get back to you.",
      errorMessage: "Something went wrong. Please try again.",
    },
  }, "contact"),
]

const blockLabels: Partial<Record<SiteGenerationBlockSlug, string>> = {
  bentoGrid: "Bento grid",
  blogCards: "Blog cards",
  contactSection: "Contact section",
  contentSection: "Content section",
  cta: "CTA",
  featureList: "Feature list",
  hero: "Hero",
  logoCloud: "Logo cloud",
  newsletter: "Newsletter",
  pricing: "Pricing",
  stats: "Stats",
  team: "Team",
  testimonials: "Testimonials",
}

const tailwindSmokeBlockManifest = (blocks: Block[]): SiteBlockManifestItem[] => {
  const seen = new Set<string>()
  const items: SiteBlockManifestItem[] = []
  for (const block of blocks) {
    if (seen.has(block.blockType)) continue
    seen.add(block.blockType)
    items.push({
      slug: block.blockType as SiteGenerationBlockSlug,
      label: blockLabels[block.blockType as SiteGenerationBlockSlug] ?? block.blockType,
      ...(block.anchor ? { defaultAnchor: block.anchor } : {}),
    })
  }
  return items
}

const genericSmokeBlocks = buildTailwindSmokeBlocks(
  "Generated Business",
  "Een volledige smoke preview met alle actieve lokale Tailwind bronblokken en gedeelde Tailwind chrome.",
  "mailto:hello@example.com",
)

const expectedSelfServeProviderIds = new Set(selfServeProviderBlockDefinitions.map((definition) => definition.id))
const genericSmokeProviderIds = new Set(genericSmokeBlocks.map((block) => block.designVariant).filter(Boolean))
if (
  genericSmokeProviderIds.size !== expectedSelfServeProviderIds.size ||
  [...expectedSelfServeProviderIds].some((id) => !genericSmokeProviderIds.has(id))
) {
  throw new Error("Generic smoke fixture must exercise every active self-serve provider block exactly once.")
}

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
      blocks: genericSmokeBlocks,
    },
  ],
  blocks: tailwindSmokeBlockManifest(genericSmokeBlocks),
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
  const summary = normalized.goals.length > 0
    ? normalized.goals.join(". ")
    : `Een volledige smoke preview voor ${normalized.businessName}.`
  const smokeBlocks = buildTailwindSmokeBlocks(normalized.businessName, summary, contactHref)

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
        { label: "Blokken", href: "/#feature-grid" },
        { label: "Platform", href: "/#platform-grid" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Contact", href: "/#contact" },
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
      blocks: smokeBlocks,
    })),
    blocks: tailwindSmokeBlockManifest(smokeBlocks),
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
