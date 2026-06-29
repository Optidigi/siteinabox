import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Page } from "@siteinabox/contracts"
import { ComparisonBlockRenderer } from "./Comparison"
import { FAQBlockRenderer } from "./FAQ"
import { HeroBlockRenderer } from "./Hero"
import { PricingBlockRenderer } from "./Pricing"
import {
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_SOURCE_BACKED_BLOCK_VARIANTS,
  SITE_SOURCE_BACKED_CHROME_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import {
  amblastPublishedSiteSnapshot,
  amblastSiteGenerationSpec,
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
} from "@siteinabox/contracts/fixtures/tenants"
import {
  GeneratedSiteSettingsSchema,
  OfficialTenantGeneratedSiteSettingsSchema,
} from "@siteinabox/contracts/generation"
import { SiteBanner, SiteFooter, SiteHeader } from "../chrome"
import { v1FixturePage, v1FixtureSettings } from "../fixtures/v1"
import type { AmicareRenderBlock } from "../legacy-tenants/amicare/AmicarePage"
import { resolveLegacyTenant } from "../legacy-tenants/resolve"
import { SitePageRenderer } from "../SitePageRenderer"
import { PUBLIC_RENDERER_THEME_SCOPE, themeToCssVars } from "../theme"
import { rendererVariantClassName, resolveBlockVariant, runtimeVariantDataAttribute } from "./variants"

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

function assertIncludes(value: string, expected: string, label: string) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: expected output to include ${expected}`)
  }
}

function assertExcludes(value: string, unexpected: string, label: string) {
  if (value.includes(unexpected)) {
    throw new Error(`${label}: expected output not to include ${unexpected}`)
  }
}

const testInlineText = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const testBlockText = (text: string) => ({
  t: "root" as const,
  variant: "block" as const,
  children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
})

const testRichText = (parts: Array<{ heading?: string; text?: string }>) => ({
  t: "root" as const,
  variant: "block" as const,
  children: parts.flatMap((part) => {
    const nodes: Array<
      | { t: "heading"; level: 2; children: Array<{ t: "text"; v: string }> }
      | { t: "paragraph"; children: Array<{ t: "text"; v: string }> }
    > = []
    if (part.heading) nodes.push({ t: "heading", level: 2, children: [{ t: "text", v: part.heading }] })
    if (part.text) nodes.push({ t: "paragraph", children: [{ t: "text", v: part.text }] })
    return nodes
  }),
})

function assertOrdered(value: string, first: string, second: string, label: string) {
  const firstIndex = value.indexOf(first)
  const secondIndex = value.indexOf(second)
  if (firstIndex === -1 || secondIndex === -1 || firstIndex > secondIndex) {
    throw new Error(`${label}: expected ${first} before ${second}`)
  }
}

function selectorSpecificity(selector: string): [number, number, number] {
  const withoutStrings = selector.replace(/"[^"]*"|'[^']*'/g, "")
  const ids = withoutStrings.match(/#[A-Za-z0-9_-]+/g)?.length ?? 0
  const classAttributePseudo = withoutStrings.match(/(\.[A-Za-z0-9_-]+|\[[^\]]+\]|:(?!:)[A-Za-z0-9_-]+)/g)?.length ?? 0
  const withoutSpecificTokens = withoutStrings
    .replace(/#[A-Za-z0-9_-]+/g, " ")
    .replace(/(\.[A-Za-z0-9_-]+|\[[^\]]+\]|:{1,2}[A-Za-z0-9_-]+)/g, " ")
  const elements = withoutSpecificTokens
    .split(/[\s>+~*,()]+/)
    .filter((part) => part && part !== "&")
    .length
  return [ids, classAttributePseudo, elements]
}

function compareSpecificity(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!
    if (delta !== 0) return delta
  }
  return 0
}

async function readCssFixture() {
  const loadFs = Function("return import('node:fs/promises')") as () => Promise<{
    readFile: (path: URL, encoding: "utf8") => Promise<string>
  }>
  const fs = await loadFs()
  return fs.readFile(new URL("../styles.css", import.meta.url), "utf8")
}

function splitCssSelectors(selectorList: string) {
  const selectors: string[] = []
  let current = ""
  let bracketDepth = 0
  let parenDepth = 0
  let quote: string | null = null

  for (const char of selectorList) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === "[") bracketDepth += 1
    if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1)
    if (char === "(") parenDepth += 1
    if (char === ")") parenDepth = Math.max(0, parenDepth - 1)
    if (char === "," && bracketDepth === 0 && parenDepth === 0) {
      selectors.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  if (current.trim()) selectors.push(current.trim())
  return selectors
}

function assertGenericCssIsScoped(css: string) {
  const genericSelectorPattern = /\.(?:cms-block|rt-)[A-Za-z0-9_-]*/
  const allowedScopes = [
    ".site-renderer:not([data-legacy-tenant])",
    '.site-renderer[data-legacy-tenant="amicare"]',
    '.site-renderer[data-legacy-tenant="amblast"]',
  ]
  const violations: string[] = []
  let segmentStart = 0

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index]
    if (char === "{") {
      const prelude = css.slice(segmentStart, index)
      const trimmed = prelude.trim()
      if (trimmed && !trimmed.startsWith("@") && genericSelectorPattern.test(trimmed)) {
        for (const selector of splitCssSelectors(trimmed)) {
          if (genericSelectorPattern.test(selector) && !allowedScopes.some((scope) => selector.startsWith(scope))) {
            const line = css.slice(0, index).split("\n").length
            violations.push(`${line}: ${selector}`)
          }
        }
      }
      segmentStart = index + 1
    } else if (char === "}" || char === ";") {
      segmentStart = index + 1
    }
  }

  if (violations.length > 0) {
    throw new Error(`generic cms-block/rt CSS selectors must be renderer-scoped:\n${violations.join("\n")}`)
  }
}

const inlineText = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const blockText = (text: string) => ({
  t: "root" as const,
  variant: "block" as const,
  children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
})

function runVariantResolverTests() {
  const supportedVariants: Array<{
    blockType: string
    variant: string
    rendererClassName: string
  }> = [
    { blockType: "hero", variant: "tailwindPlusSimpleCentered", rendererClassName: "cms-block--source-tailwind-plus-simple-centered" },
    { blockType: "hero", variant: "minimal", rendererClassName: "" },
    { blockType: "hero", variant: "amicareZenHero", rendererClassName: "cms-block--source-amicare-zen-hero" },
    { blockType: "featureList", variant: "tailwindPlusCentered2x2", rendererClassName: "cms-block--source-tailwind-plus-centered-2x2" },
    { blockType: "featureList", variant: "services", rendererClassName: "" },
    { blockType: "featureList", variant: "amicareCareCards", rendererClassName: "cms-block--source-amicare-care-cards" },
    { blockType: "richText", variant: "tailblocksContentA", rendererClassName: "cms-block--source-tailblocks-content-a" },
    { blockType: "richText", variant: "prose", rendererClassName: "" },
    { blockType: "richText", variant: "amicareEditorial", rendererClassName: "cms-block--source-amicare-editorial" },
    { blockType: "cta", variant: "tailblocksCtaA", rendererClassName: "cms-block--source-tailblocks-cta-a" },
    { blockType: "cta", variant: "quote", rendererClassName: "" },
    { blockType: "cta", variant: "amicareQuoteContact", rendererClassName: "cms-block--source-amicare-quote-contact" },
    { blockType: "contactSection", variant: "tailwindPlusNewsletterDetails", rendererClassName: "cms-block--source-tailwind-plus-newsletter-details" },
    { blockType: "contactSection", variant: "hyperUiNewsletterCentered", rendererClassName: "cms-block--source-hyperui-newsletter-centered" },
    { blockType: "contactSection", variant: "prelineCenteredNewsletter", rendererClassName: "cms-block--source-preline-centered-newsletter" },
    { blockType: "contactSection", variant: "form", rendererClassName: "" },
    { blockType: "contactSection", variant: "amicareContactForm", rendererClassName: "cms-block--source-amicare-contact-form" },
    { blockType: "faq", variant: "mambaFaq1", rendererClassName: "cms-block--source-mamba-faq-1" },
    { blockType: "faq", variant: "accordion", rendererClassName: "" },
    { blockType: "faq", variant: "amicareWarmAccordion", rendererClassName: "cms-block--source-amicare-warm-accordion" },
    { blockType: "testimonials", variant: "mambaTestimonial1", rendererClassName: "cms-block--source-mamba-testimonial-1" },
    { blockType: "testimonials", variant: "cards", rendererClassName: "" },
    { blockType: "testimonials", variant: "amicareStoryCards", rendererClassName: "cms-block--source-amicare-story-cards" },
    { blockType: "mediaHero", variant: "amblastShapedHero", rendererClassName: "cms-block--source-amblast-shaped-overlay" },
    { blockType: "infoCardList", variant: "amblastImageBoxes", rendererClassName: "cms-block--source-amblast-image-boxes" },
    { blockType: "serviceCarousel", variant: "amblastSwiperServices", rendererClassName: "cms-block--source-amblast-swiper-services" },
    { blockType: "beforeAfterGallery", variant: "amblastPortfolio", rendererClassName: "cms-block--source-amblast-portfolio-comparisons" },
    { blockType: "contactDetails", variant: "amblastContactCards", rendererClassName: "cms-block--source-amblast-contact-cards" },
    { blockType: "pricing", variant: "tailwindPlusSimpleTiers", rendererClassName: "cms-block--source-tailwind-plus-simple-pricing" },
    { blockType: "stats", variant: "tailwindPlusSimple", rendererClassName: "cms-block--source-tailwind-plus-stats-simple" },
    { blockType: "logoCloud", variant: "tailwindPlusSimple", rendererClassName: "cms-block--source-tailwind-plus-logo-cloud-simple" },
    { blockType: "gallery", variant: "prelineSquareGrid", rendererClassName: "cms-block--source-preline-gallery-square-grid" },
    { blockType: "team", variant: "tailwindPlusGrid", rendererClassName: "cms-block--source-tailwind-plus-team-grid" },
    { blockType: "blogCards", variant: "tailwindPlusThreeColumn", rendererClassName: "cms-block--source-tailwind-plus-blog-three-column" },
    { blockType: "processSteps", variant: "mambaSteps", rendererClassName: "cms-block--source-mamba-process-steps" },
    { blockType: "comparison", variant: "matrix", rendererClassName: "" },
  ]

  for (const supportedVariant of supportedVariants) {
    assertEqual(
      resolveBlockVariant(supportedVariant).variant,
      supportedVariant.variant,
      `${supportedVariant.blockType}:${supportedVariant.variant} resolves`,
    )
    assertEqual(
      rendererVariantClassName(supportedVariant),
      supportedVariant.rendererClassName,
      `${supportedVariant.blockType}:${supportedVariant.variant} renderer class`,
    )
    assertEqual(
      runtimeVariantDataAttribute(supportedVariant),
      supportedVariant.variant,
      `${supportedVariant.blockType}:${supportedVariant.variant} data attribute`,
    )
  }

  const shortVariantHero = {
    blockType: "hero",
    variant: "tailwindPlusSimpleCentered",
    analytics: { sectionVariant: "legacy-value-that-must-not-drive-rendering" },
  }

  assertEqual(resolveBlockVariant(shortVariantHero).variant, "tailwindPlusSimpleCentered", "short variant wins")
  assertEqual(
    rendererVariantClassName(shortVariantHero),
    "cms-block--source-tailwind-plus-simple-centered",
    "short variant maps to renderer class",
  )
  assertEqual(runtimeVariantDataAttribute(shortVariantHero), "tailwindPlusSimpleCentered", "data attribute uses short variant")

  const legacyFaq = {
    blockType: "faq",
    analytics: { sectionVariant: "mamba-faq-1" },
  }

  assertEqual(resolveBlockVariant(legacyFaq).variant, "mambaFaq1", "legacy analytics maps to short variant")
  assertEqual(rendererVariantClassName(legacyFaq), "cms-block--source-mamba-faq-1", "legacy analytics maps to renderer class")
  assertEqual(runtimeVariantDataAttribute(legacyFaq), "mambaFaq1", "legacy data attribute uses mapped short variant")

  const unsupportedVariant = {
    blockType: "hero",
    variant: "notApproved",
    analytics: { sectionVariant: "also-not-approved" },
  }

  assertEqual(resolveBlockVariant(unsupportedVariant).variant, undefined, "unsupported short variant is ignored")
  assertEqual(rendererVariantClassName(unsupportedVariant), "", "unsupported short variant has no renderer class")
  assertEqual(runtimeVariantDataAttribute(unsupportedVariant), undefined, "unsupported short variant has no data attribute")
}

function runBlockRenderTests() {
  const heroMarkup = renderToStaticMarkup(
    React.createElement(HeroBlockRenderer, {
      block: {
        blockType: "hero",
        variant: "tailwindPlusSimpleCentered",
        analytics: { sectionVariant: "legacy-value-that-must-not-drive-rendering" },
        headline: inlineText("Catalog-backed hero"),
      },
      options: { index: 0 },
    }),
  )

  assertIncludes(heroMarkup, "cms-block--source-tailwind-plus-simple-centered", "hero short variant class")
  assertIncludes(heroMarkup, "!max-w-2xl", "hero native Tailwind Plus layout class")
  assertIncludes(heroMarkup, "!text-5xl", "hero native Tailwind Plus typography class")
  assertIncludes(heroMarkup, 'data-source-variant="tailwindPlusSimpleCentered"', "hero data source variant")
  assertIncludes(
    heroMarkup,
    'data-siab-section-variant="legacy-value-that-must-not-drive-rendering"',
    "hero analytics attribute preserved",
  )

  const faqMarkup = renderToStaticMarkup(
    React.createElement(FAQBlockRenderer, {
      block: {
        blockType: "faq",
        analytics: { sectionVariant: "mamba-faq-1" },
        items: [{ question: inlineText("Question?"), answer: blockText("Answer.") }],
      },
      options: { index: 1 },
    }),
  )

  assertIncludes(faqMarkup, "cms-block--source-mamba-faq-1", "FAQ legacy fallback class")
  assertIncludes(faqMarkup, 'data-source-variant="mambaFaq1"', "FAQ legacy fallback data source variant")
  assertIncludes(faqMarkup, 'data-siab-section-variant="mamba-faq-1"', "FAQ analytics attribute preserved")

  const pricingMarkup = renderToStaticMarkup(
    React.createElement(PricingBlockRenderer, {
      block: {
        blockType: "pricing",
        analytics: { sectionVariant: "tailwind-plus-simple-pricing" },
        title: inlineText("Plans"),
        plans: [
          {
            title: inlineText("Starter"),
            price: "EUR 499",
            features: [{ label: inlineText("One page"), included: true }],
            cta: { label: "Start", href: "/intake" },
          },
        ],
      },
      options: { index: 2 },
    }),
  )

  assertIncludes(pricingMarkup, "cms-block--source-tailwind-plus-simple-pricing", "pricing legacy fallback class")
  assertIncludes(pricingMarkup, "!rounded-3xl", "pricing native Tailwind Plus card class")
  assertIncludes(pricingMarkup, 'data-source-variant="tailwindPlusSimpleTiers"', "pricing data source variant")
  assertIncludes(pricingMarkup, "EUR 499", "pricing structured content")

  const amicareHeroMarkup = renderToStaticMarkup(
    React.createElement(HeroBlockRenderer, {
      block: {
        blockType: "hero",
        variant: "amicareZenHero",
        analytics: { sectionVariant: "amicare-zen-hero" },
        eyebrow: inlineText("Amicare-Zorg"),
        headline: inlineText("Jeugdzorg met hart"),
        image: { url: "/media/bedroom.jpg", alt: "Rustige kinderkamer" },
      },
      options: { index: 3 },
    }),
  )

  assertIncludes(amicareHeroMarkup, "cms-block--source-amicare-zen-hero", "Amicare hero class")
  assertIncludes(amicareHeroMarkup, 'data-source-variant="amicareZenHero"', "Amicare hero data source variant")
  assertIncludes(amicareHeroMarkup, "Jeugdzorg met hart", "Amicare hero structured content")

  const comparisonMarkup = renderToStaticMarkup(
    React.createElement(ComparisonBlockRenderer, {
      block: {
        blockType: "comparison",
        variant: "matrix",
        title: inlineText("Compare"),
        columns: [{ title: inlineText("Starter") }, { title: inlineText("Growth") }],
        rows: [{ label: "Custom domain", values: [true, false] }],
      },
      options: { index: 4 },
    }),
  )

  assertIncludes(comparisonMarkup, 'data-source-variant="matrix"', "comparison SIAB-owned variant data attribute")
  assertIncludes(comparisonMarkup, "Custom domain", "comparison structured row")
}

function runChromeRenderTests() {
  const headerMarkup = renderToStaticMarkup(
    React.createElement(SiteHeader, {
      settings: v1FixtureSettings,
      currentSlug: "index",
    }),
  )
  assertIncludes(headerMarkup, "site-header--source-hyperui-simple", "header source-backed class")
  assertIncludes(headerMarkup, "!max-w-7xl", "header native HyperUI layout class")
  assertIncludes(headerMarkup, 'data-source-variant="hyperUiSimple"', "header data source variant")
  assertIncludes(headerMarkup, "Example Site", "header structured brand")

  const bannerMarkup = renderToStaticMarkup(
    React.createElement(SiteBanner, {
      settings: v1FixtureSettings,
      currentSlug: "index",
    }),
  )
  assertIncludes(bannerMarkup, "site-banner--source-hyperui-simple", "banner source-backed class")
  assertIncludes(bannerMarkup, 'data-source-variant="hyperUiSimple"', "banner data source variant")
  assertIncludes(bannerMarkup, "Reusable chrome variants", "banner structured message")
  assertIncludes(bannerMarkup, 'data-dismissible="true"', "banner dismissible attribute")

  const footerMarkup = renderToStaticMarkup(
    React.createElement(SiteFooter, {
      settings: v1FixtureSettings,
      currentSlug: "index",
    }),
  )
  assertIncludes(footerMarkup, "site-footer--source-hyperui-simple", "footer source-backed class")
  assertIncludes(footerMarkup, 'data-source-variant="hyperUiSimple"', "footer data source variant")
  assertIncludes(footerMarkup, "Typed fixture data", "footer structured tagline")

  const amicareHeaderMarkup = renderToStaticMarkup(
    React.createElement(SiteHeader, {
      settings: amicareSiteGenerationSpec.settings,
      currentSlug: "index",
    }),
  )
  assertIncludes(amicareHeaderMarkup, "site-header--source-amicare-zen", "Amicare header class")
  assertIncludes(amicareHeaderMarkup, 'data-source-variant="amicareZen"', "Amicare header data source variant")
  assertIncludes(amicareHeaderMarkup, "Werkwijze", "Amicare header structured nav")

  const amicareFooterMarkup = renderToStaticMarkup(
    React.createElement(SiteFooter, {
      settings: amicareSiteGenerationSpec.settings,
      currentSlug: "index",
    }),
  )
  assertIncludes(amicareFooterMarkup, "site-footer--source-amicare-zen", "Amicare footer class")
  assertIncludes(amicareFooterMarkup, "KVK 99968347", "Amicare footer structured business data")

  const amblastHeaderMarkup = renderToStaticMarkup(
    React.createElement(SiteHeader, {
      settings: amblastSiteGenerationSpec.settings,
      currentSlug: "diensten",
    }),
  )
  assertIncludes(amblastHeaderMarkup, "site-header--source-amblast-industrial", "Amblast header class")
  assertIncludes(amblastHeaderMarkup, 'data-source-variant="amblastIndustrial"', "Amblast header data source variant")
  assertIncludes(amblastHeaderMarkup, "Onze diensten", "Amblast header structured nav")
  assertIncludes(amblastHeaderMarkup, 'aria-current="page"', "Amblast header path active state")

  const amblastFooterMarkup = renderToStaticMarkup(
    React.createElement(SiteFooter, {
      settings: amblastSiteGenerationSpec.settings,
      currentSlug: "index",
    }),
  )
  assertIncludes(amblastFooterMarkup, "site-footer--source-amblast-industrial", "Amblast footer class")
  assertIncludes(amblastFooterMarkup, "Manage your facility", "Amblast footer structured tagline")
  assertIncludes(amblastFooterMarkup, "BTW ID: NL002407752B08", "Amblast footer structured business data")

  assertEqual(GeneratedSiteSettingsSchema.safeParse(v1FixtureSettings).success, true, "fixture chrome validates")
  assertEqual(GeneratedSiteSettingsSchema.safeParse(amicareSiteGenerationSpec.settings).success, false, "generic settings reject Amicare tenant-exclusive chrome")
  assertEqual(GeneratedSiteSettingsSchema.safeParse(amblastSiteGenerationSpec.settings).success, false, "generic settings reject Amblast tenant-exclusive chrome")
  assertEqual(OfficialTenantGeneratedSiteSettingsSchema.safeParse(amicareSiteGenerationSpec.settings).success, true, "official tenant settings accept Amicare chrome")
  assertEqual(OfficialTenantGeneratedSiteSettingsSchema.safeParse(amblastSiteGenerationSpec.settings).success, true, "official tenant settings accept Amblast chrome")
  assertEqual(
    GeneratedSiteSettingsSchema.safeParse({
      ...v1FixtureSettings,
      chrome: {
        ...v1FixtureSettings.chrome,
        header: {
          ...v1FixtureSettings.chrome?.header,
          variant: "notApproved",
        },
      },
    }).success,
    false,
    "unsupported chrome variant rejects",
  )
  assertEqual(
    GeneratedSiteSettingsSchema.safeParse({
      ...v1FixtureSettings,
      chrome: {
        ...v1FixtureSettings.chrome,
        banner: {
          ...v1FixtureSettings.chrome?.banner,
          variant: "amblastIndustrial",
        },
      },
    }).success,
    false,
    "tenant-exclusive chrome variants reject on banners",
  )
  assertEqual(
    GeneratedSiteSettingsSchema.safeParse({
      ...v1FixtureSettings,
      chrome: {
        ...v1FixtureSettings.chrome,
        banner: {
          ...v1FixtureSettings.chrome?.banner,
          rawHtml: "<div>not allowed</div>",
        },
      },
    }).success,
    false,
    "raw chrome source rejects",
  )
}

function runAmicareScopeTests() {
  const amicareBlockVariants = [
    ["hero", "hero:amicareZenHero"],
    ["featureList", "featureList:amicareCareCards"],
    ["richText", "richText:amicareEditorial"],
    ["cta", "cta:amicareQuoteContact"],
    ["contactSection", "contactSection:amicareContactForm"],
    ["faq", "faq:amicareWarmAccordion"],
    ["testimonials", "testimonials:amicareStoryCards"],
  ] as const

  for (const [slug, variantId] of amicareBlockVariants) {
    const variant = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[slug].variants.find((entry) => entry.id === variantId)
    assertEqual(Boolean(variant), true, `${variantId} exists`)
    assertEqual(variant?.scope.kind, "tenant-exclusive", `${variantId} is tenant-exclusive`)
    assertEqual(variant?.scope.kind === "tenant-exclusive" && variant.scope.tenantSlugs.includes("amicare"), true, `${variantId} scoped to amicare`)
    assertEqual(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((entry) => entry.variantId === variantId), false, `${variantId} excluded from reusable source-backed variants`)
  }

  for (const variantId of ["header:amicareZen", "footer:amicareZen"]) {
    const variant = SITE_CHROME_CATALOG.find((entry) => entry.id === variantId)
    assertEqual(Boolean(variant), true, `${variantId} exists`)
    assertEqual(variant?.scope.kind, "tenant-exclusive", `${variantId} is tenant-exclusive`)
    assertEqual(SITE_SOURCE_BACKED_CHROME_VARIANTS.some((entry) => entry.variantId === variantId), false, `${variantId} excluded from reusable chrome variants`)
  }
}

function runAmblastScopeTests() {
  const amblastBlockVariants = [
    ["mediaHero", "mediaHero:amblastShapedHero"],
    ["infoCardList", "infoCardList:amblastImageBoxes"],
    ["serviceCarousel", "serviceCarousel:amblastSwiperServices"],
    ["beforeAfterGallery", "beforeAfterGallery:amblastPortfolio"],
    ["contactDetails", "contactDetails:amblastContactCards"],
  ] as const

  for (const [slug, variantId] of amblastBlockVariants) {
    const variant = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[slug].variants.find((entry) => entry.id === variantId)
    assertEqual(Boolean(variant), true, `${variantId} exists`)
    assertEqual(variant?.scope.kind, "tenant-exclusive", `${variantId} is tenant-exclusive`)
    assertEqual(variant?.scope.kind === "tenant-exclusive" && variant.scope.tenantSlugs.includes("amblast"), true, `${variantId} scoped to amblast`)
    assertEqual(SITE_SOURCE_BACKED_BLOCK_VARIANTS.some((entry) => entry.variantId === variantId), false, `${variantId} excluded from reusable source-backed variants`)
  }

  for (const variantId of ["header:amblastIndustrial", "footer:amblastIndustrial"]) {
    const variant = SITE_CHROME_CATALOG.find((entry) => entry.id === variantId)
    assertEqual(Boolean(variant), true, `${variantId} exists`)
    assertEqual(variant?.scope.kind, "tenant-exclusive", `${variantId} is tenant-exclusive`)
    assertEqual(variant?.scope.kind === "tenant-exclusive" && variant.scope.tenantSlugs.includes("amblast"), true, `${variantId} scoped to amblast`)
    assertEqual(SITE_SOURCE_BACKED_CHROME_VARIANTS.some((entry) => entry.variantId === variantId), false, `${variantId} excluded from reusable chrome variants`)
  }

  assertEqual(amblastSiteGenerationSpec.tenant.domain, "amblast.nl", "Amblast fixture tenant domain")
  assertEqual(amblastSiteGenerationSpec.settings.siteUrl, "https://amblast.nl", "Amblast fixture site URL")

  const homeBlocks = amblastSiteGenerationSpec.pages.find((page) => page.slug === "index")?.blocks ?? []
  assertEqual(homeBlocks.some((block) => block.blockType === "serviceCarousel" && block.variant === "amblastSwiperServices"), true, "Amblast home service carousel fixture")
  assertEqual(homeBlocks.some((block) => block.blockType === "infoCardList" && block.variant === "amblastImageBoxes"), true, "Amblast home info boxes fixture")

  const portfolioBlocks = amblastSiteGenerationSpec.pages.find((page) => page.slug === "portfolio")?.blocks ?? []
  assertEqual(portfolioBlocks.some((block) => block.blockType === "beforeAfterGallery" && block.variant === "amblastPortfolio"), true, "Amblast portfolio comparison fixture")
}

function runThemeCssVarTests() {
  const amicareCss = themeToCssVars(amicarePublishedSiteSnapshot.theme, PUBLIC_RENDERER_THEME_SCOPE)

  assertIncludes(amicareCss, `${PUBLIC_RENDERER_THEME_SCOPE}{`, "themeToCssVars supports public renderer scope")
  assertIncludes(amicareCss, "--color-accent:#a04e32", "themeToCssVars emits Amicare accent in public renderer scope")
  assertIncludes(amicareCss, "--color-on-accent:#ffffff", "themeToCssVars emits Amicare foreground-on-accent in public renderer scope")
  assertIncludes(amicareCss, "--color-bg:#fbf7f0", "themeToCssVars emits Amicare background in public renderer scope")
  assertIncludes(amicareCss, "--color-ink:#1f1a14", "themeToCssVars emits Amicare ink in public renderer scope")
  assertIncludes(amicareCss, "--color-ink-muted:#5a4f44", "themeToCssVars emits Amicare muted ink in public renderer scope")
  assertIncludes(amicareCss, "--font-title:Fraunces Variable, Georgia, serif", "themeToCssVars emits Amicare title font in public renderer scope")
  assertIncludes(amicareCss, "--font-heading:Fraunces Variable, Georgia, serif", "themeToCssVars emits Amicare heading font in public renderer scope")
  assertIncludes(amicareCss, "--font-text:Inter Variable, system-ui, sans-serif", "themeToCssVars emits Amicare text font in public renderer scope")
  assertIncludes(amicareCss, "--font-script:Caveat Variable, cursive", "themeToCssVars emits Amicare script font in public renderer scope")
  assertIncludes(amicareCss, "--radius-md:0.5rem", "themeToCssVars emits Amicare radius in public renderer scope")
  assertIncludes(amicareCss, "--site-style-preset:warm-care", "themeToCssVars emits Amicare style preset in public renderer scope")
  assertIncludes(amicareCss, "--site-density:comfortable", "themeToCssVars emits Amicare density in public renderer scope")
  assertIncludes(amicareCss, "--border-style:solid", "themeToCssVars emits Amicare border style in public renderer scope")

  const amblastCss = themeToCssVars(amblastPublishedSiteSnapshot.theme, PUBLIC_RENDERER_THEME_SCOPE)
  assertIncludes(amblastCss, `${PUBLIC_RENDERER_THEME_SCOPE}{`, "themeToCssVars supports Amblast public renderer scope")
  assertIncludes(amblastCss, "--color-accent:#ffd500", "themeToCssVars emits Amblast accent in public renderer scope")
  assertIncludes(amblastCss, "--color-bg:#ffffff", "themeToCssVars emits Amblast background in public renderer scope")
  assertIncludes(amblastCss, "--color-ink:#333333", "themeToCssVars emits Amblast ink in public renderer scope")
  assertIncludes(amblastCss, "--color-ink-muted:#6b6b6b", "themeToCssVars emits Amblast muted ink in public renderer scope")
  assertIncludes(amblastCss, "--font-title:Barlow, Arial, sans-serif", "themeToCssVars emits Amblast title font in public renderer scope")
  assertIncludes(amblastCss, "--font-heading:Barlow, Arial, sans-serif", "themeToCssVars emits Amblast heading font in public renderer scope")
  assertIncludes(amblastCss, "--font-text:Barlow, Arial, sans-serif", "themeToCssVars emits Amblast text font in public renderer scope")
  assertIncludes(amblastCss, "--radius-md:6px", "themeToCssVars emits Amblast radius in public renderer scope")
  assertIncludes(amblastCss, "--site-style-preset:industrial-cleaning", "themeToCssVars emits Amblast style preset in public renderer scope")

  const darkFallbackCss = themeToCssVars(
    {
      ...amicarePublishedSiteSnapshot.theme,
      darkColors: undefined,
      mode: "dark",
    },
    PUBLIC_RENDERER_THEME_SCOPE,
  )
  assertIncludes(
    darkFallbackCss,
    `${PUBLIC_RENDERER_THEME_SCOPE}[data-rt-mode="dark"]{`,
    "dark mode without an explicit dark palette emits fallback dark canvas variables",
  )
  assertIncludes(darkFallbackCss, "--color-on-accent:#ffffff", "dark fallback emits foreground-on-accent")
  assertIncludes(darkFallbackCss, "--color-bg:#09090b", "dark fallback emits dark background")
  assertIncludes(darkFallbackCss, "--color-ink:#fafafa", "dark fallback emits readable ink")
  assertIncludes(darkFallbackCss, "--color-rule:rgba(255, 255, 255, 0.12)", "dark fallback emits rule color")

  const publicSpecificity = selectorSpecificity(PUBLIC_RENDERER_THEME_SCOPE)
  const legacyBaseSpecificity = selectorSpecificity('.site-renderer[data-legacy-tenant="amblast"]')
  const legacyCanvasSpecificity = selectorSpecificity('.site-renderer[data-legacy-tenant="amblast"] .rt-canvas')

  assertEqual(
    compareSpecificity(publicSpecificity, legacyBaseSpecificity) > 0,
    true,
    "public renderer theme scope outranks legacy tenant base selector",
  )
  assertEqual(
    compareSpecificity(publicSpecificity, legacyCanvasSpecificity) >= 0,
    true,
    "public renderer theme scope is not weaker than legacy tenant canvas selector",
  )
}

async function runLegacyRendererDispatchTests() {
  assertEqual(
    resolveLegacyTenant({
      tenantSlug: "amicare",
      domain: "ami-care.nl",
      settings: amicarePublishedSiteSnapshot.settings,
    }),
    "amicare",
    "Amicare tenant resolves to legacy renderer",
  )
  assertEqual(
    resolveLegacyTenant({
      tenantSlug: "fixture-studio",
      domain: "renderer.example.test",
      settings: v1FixtureSettings,
    }),
    null,
    "generic fixture does not resolve to legacy renderer",
  )
  assertEqual(
    resolveLegacyTenant({
      tenantSlug: "generic-amblast-inspired",
      domain: "generic.example.test",
      settings: {
        ...v1FixtureSettings,
        siteName: "Amblast style landing page",
        siteUrl: "https://amblast.nl",
        chrome: {
          ...v1FixtureSettings.chrome,
          header: { ...v1FixtureSettings.chrome?.header, variant: "amblastIndustrial" },
          footer: { ...v1FixtureSettings.chrome?.footer, variant: "amblastIndustrial" },
        },
      },
    }),
    null,
    "generic tenant with Amblast-looking mutable settings does not resolve to legacy renderer",
  )
  assertEqual(
    resolveLegacyTenant({
      tenantSlug: "generic-care-provider",
      domain: "generic-care.example.test",
      settings: {
        ...v1FixtureSettings,
        siteName: "Amicare inspired zorg",
        siteUrl: "https://ami-care.nl",
        chrome: {
          ...v1FixtureSettings.chrome,
          header: { ...v1FixtureSettings.chrome?.header, variant: "amicareZen" },
          footer: { ...v1FixtureSettings.chrome?.footer, variant: "amicareZen" },
        },
      },
    }),
    null,
    "generic tenant with Amicare-looking mutable settings does not resolve to legacy renderer",
  )
  assertEqual(
    resolveLegacyTenant({
      tenantSlug: "amblast",
      domain: "amblast.nl",
      settings: amblastPublishedSiteSnapshot.settings,
    }),
    "amblast",
    "Amblast tenant resolves to legacy renderer",
  )

  const amicareFixturePage = amicarePublishedSiteSnapshot.pages.find((page) => page.slug === "index")
  if (!amicareFixturePage) throw new Error("Amicare published fixture index page exists")
  const amicarePage = {
    ...amicareFixturePage,
    updatedAt: amicareFixturePage.updatedAt ?? amicarePublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
  } satisfies Page

  const amicareMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicarePage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: amicarePublishedSiteSnapshot.theme,
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
    }),
  )
  const publicRendererScope = ".site-renderer[data-siab-site-renderer] .rt-canvas"
  assertIncludes(amicareMarkup, 'data-legacy-tenant="amicare"', "Amicare legacy root attribute")
  assertIncludes(amicareMarkup, "data-siab-site-renderer", "Amicare public renderer root attribute")
  assertIncludes(amicareMarkup, 'data-rt-mode="light"', "Amicare light theme mode marker")
  assertIncludes(amicareMarkup, `${publicRendererScope}{`, "Amicare theme overrides use public renderer scope")
  assertIncludes(amicareMarkup, "--color-accent:#a04e32", "Amicare emits non-default accent token")
  assertIncludes(amicareMarkup, "--color-on-accent:#ffffff", "Amicare emits foreground-on-accent token")
  assertIncludes(amicareMarkup, "--color-bg:#fbf7f0", "Amicare emits non-default background token")
  assertIncludes(amicareMarkup, "--font-title:Fraunces Variable, Georgia, serif", "Amicare emits non-default title font token")
  assertIncludes(amicareMarkup, "--font-text:Inter Variable, system-ui, sans-serif", "Amicare emits non-default text font token")
  assertIncludes(amicareMarkup, "--radius-sm:0.25rem;--radius-md:0.5rem;--radius-lg:1rem", "Amicare emits non-default radius tokens")
  assertIncludes(amicareMarkup, "data-amicare-nav", "Amicare exact nav marker")
  assertIncludes(amicareMarkup, 'class="rt-canvas w-full [container-name:site-frame] [container-type:inline-size]"', "Amicare root container query classes")
  assertIncludes(amicareMarkup, 'class="site-frame-root"', "Amicare site frame root")
  assertIncludes(amicareMarkup, 'class="sticky top-0 z-50 flex w-full items-center justify-between border-b border-rule bg-bg/80 px-6 py-5 backdrop-blur-lg @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20"', "Amicare exact nav classes")
  assertIncludes(amicareMarkup, "cms-block--cta-quote", "Amicare exact quote CTA class")
  assertIncludes(amicareMarkup, "cookie-consent-banner", "Amicare cookie consent markup")
  assertIncludes(amicareMarkup, 'src="/media/toys.jpg"', "Amicare exact hero image")
  assertIncludes(amicareMarkup, 'alt="Speelgoed"', "Amicare exact hero image alt")
  assertIncludes(amicareMarkup, 'loading="eager"', "Amicare eager hero image")
  assertIncludes(amicareMarkup, 'decoding="async"', "Amicare async image decoding")
  assertIncludes(amicareMarkup, 'class="aspect-[4/5] w-full rotate-0 transform rounded-[var(--radius-lg)] object-cover shadow-2xl @min-[48rem]/site-frame:aspect-[4/3] @min-[48rem]/site-frame:rotate-3"', "Amicare exact hero media classes")
  assertIncludes(amicareMarkup, "amicare-button-primary", "Amicare uses explicit foreground-on-accent button class")
  assertIncludes(amicareMarkup, "amicare-hero-glow amicare-hero-glow--start", "Amicare hero uses scoped glow class")
  assertIncludes(amicareMarkup, "amicare-quote-overlay", "Amicare quote CTA uses scoped overlay class")
  assertExcludes(amicareMarkup, "text-bg", "Amicare buttons do not derive contrast from page background")
  assertIncludes(amicareMarkup, 'src="/api/tenant-media/7/bedroom.jpg"', "Amicare exact quote background image")
  assertIncludes(amicareMarkup, 'class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.12]"', "Amicare exact quote media classes")
  assertIncludes(amicareMarkup, "Voor jongeren en gezinnen", "Amicare exact hero eyebrow")
  assertIncludes(amicareMarkup, "Jeugdzorg", "Amicare exact hero pill")
  assertIncludes(amicareMarkup, "Begeleiding", "Amicare exact hero pill")
  assertIncludes(amicareMarkup, "Vertrouwen", "Amicare exact hero pill")
  assertIncludes(amicareMarkup, 'style="max-width:14ch;font-family:var(--font-title)"', "Amicare hero title font token and width")
  assertIncludes(amicareMarkup, "tracking-[-0.01em]", "Amicare legacy heading tracking class")
  assertIncludes(amicareMarkup, '[font-family:var(--font-script)]', "Amicare script font token class")
  assertIncludes(amicareMarkup, '<p class="max-w-md animate-fade-up text-[17px] leading-[1.6] text-ink-muted [animation-delay:150ms] [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[18px]">Al jarenlang werk ik met toewijding', "Amicare subheadline rich text renders inline inside legacy paragraph")
  assertIncludes(amicareMarkup, "Wat voor mij", "Amicare exact feature heading")
  assertIncludes(amicareMarkup, "Aandacht", "Amicare exact first feature")
  assertIncludes(amicareMarkup, "Betrokkenheid", "Amicare exact second feature")
  assertIncludes(amicareMarkup, "Continuïteit", "Amicare exact third feature")
  assertIncludes(amicareMarkup, '<p class="text-[16px] leading-[1.6] text-ink-muted [font-family:var(--font-text)]">Echt luisteren naar wat een jongere', "Amicare feature description rich text renders inline inside legacy paragraph")
  assertIncludes(amicareMarkup, "amicare-richtext-intro mx-auto max-w-3xl text-center", "Amicare rich-text intro is separated from body")
  assertIncludes(amicareMarkup, "amicare-richtext-body prose mx-auto mt-10 max-w-prose space-y-6", "Amicare rich-text body uses separated prose rhythm")
  assertIncludes(amicareMarkup, '<div class="rt-themed rt-themed-eyebrow" data-rt-id="eyebrow">', "Amicare rich-text themed eyebrow marker")
  assertIncludes(amicareMarkup, '<h2 class="rt-h rt-h-2">Het vak waar mijn <em class="rt-i">hart ligt</em>.</h2>', "Amicare exact rich-text heading")
  assertIncludes(amicareMarkup, "Vertrouwen ontstaat in de tijd", "Amicare exact quote CTA")
  assertIncludes(amicareMarkup, '<p class="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[17px]">Daarom werk ik graag in trajecten', "Amicare CTA description rich text renders inline inside legacy paragraph")
  assertIncludes(amicareMarkup, "info@ami-care.nl", "Amicare exact contact email")
  assertOrdered(amicareMarkup, "cms-block--hero", "cms-block--featurelist", "Amicare block order starts with hero then feature list")
  assertOrdered(amicareMarkup, "cms-block--featurelist", "cms-block--richtext", "Amicare block order keeps rich text after feature list")
  assertOrdered(amicareMarkup, "cms-block--richtext", "cms-block--cta-quote", "Amicare quote CTA follows rich text")
  assertOrdered(amicareMarkup, "cms-block--cta-quote", "cms-block--cta-contact", "Amicare contact CTA follows quote CTA")
  assertExcludes(amicareMarkup, '<p class="max-w-md animate-fade-up text-[17px] leading-[1.6] text-ink-muted [animation-delay:150ms] [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[18px]"><p class="rt-p">', "Amicare subheadline does not render nested paragraphs")
  assertExcludes(amicareMarkup, '<p class="text-[16px] leading-[1.6] text-ink-muted [font-family:var(--font-text)]"><p class="rt-p">', "Amicare feature descriptions do not render nested paragraphs")
  assertExcludes(amicareMarkup, '<p class="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[17px]"><p class="rt-p">', "Amicare CTA descriptions do not render nested paragraphs")
  assertExcludes(amicareMarkup, "Het vak  mijn", "Amicare excludes malformed rich-text heading")
  assertExcludes(amicareMarkup, "Ervaringen", "Amicare excludes generated testimonials section")
  assertExcludes(amicareMarkup, "Veelgestelde vragen", "Amicare excludes generated FAQ section")
  assertExcludes(amicareMarkup, "<form", "Amicare excludes generated contact form")
  assertEqual(
    amicareMarkup.includes("site-header--source-amicare-zen"),
    false,
    "Amicare legacy renderer bypasses generic chrome approximation",
  )

  const amicareDefaultExtensionMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicarePage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: amicarePublishedSiteSnapshot.theme,
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      renderBlock: ({ defaultRender }) => defaultRender,
    }),
  )
  assertIncludes(amicareDefaultExtensionMarkup, "cms-block--hero", "Amicare renderBlock defaultRender keeps hero class")
  assertIncludes(amicareDefaultExtensionMarkup, "cms-block--featurelist", "Amicare renderBlock defaultRender keeps feature list class")
  assertIncludes(amicareDefaultExtensionMarkup, "cms-block--cta-quote", "Amicare renderBlock defaultRender keeps quote CTA class")
  assertIncludes(amicareDefaultExtensionMarkup, "cms-block--cta-contact", "Amicare renderBlock defaultRender keeps contact CTA class")

  const interceptedBlocks: Array<{ blockType: string; index: number }> = []
  const interceptAmicareBlock: AmicareRenderBlock = ({ block, index }) => {
    interceptedBlocks.push({ blockType: block.blockType, index })
    return React.createElement(
      "section",
      {
        "data-amicare-editor-block": block.blockType,
        "data-block-index": index,
      },
      `custom ${block.blockType} ${index}`,
    )
  }
  const interceptedAmicareMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicarePage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: amicarePublishedSiteSnapshot.theme,
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      renderBlock: interceptAmicareBlock,
    }),
  )
  assertEqual(interceptedBlocks.length, amicarePage.blocks.length, "Amicare renderBlock is called for every block")
  assertEqual(interceptedBlocks[0]?.blockType, amicarePage.blocks[0]?.blockType, "Amicare renderBlock receives first block")
  assertEqual(interceptedBlocks[0]?.index, 0, "Amicare renderBlock receives first index")
  assertIncludes(interceptedAmicareMarkup, 'data-amicare-editor-block="hero"', "Amicare renderBlock custom output is used")
  assertIncludes(interceptedAmicareMarkup, "custom hero 0", "Amicare renderBlock custom content is rendered")
  assertExcludes(interceptedAmicareMarkup, "cms-block--hero", "Amicare renderBlock can replace default block output")

  const blockListSlotMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicarePage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: amicarePublishedSiteSnapshot.theme,
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      renderBlocks: ({ blocks, defaultRenderBlocks }) => React.createElement(
        React.Fragment,
        null,
        React.createElement("div", { "data-cms-editable-block-list": blocks.length }),
        defaultRenderBlocks,
      ),
    }),
  )
  assertIncludes(blockListSlotMarkup, 'data-legacy-tenant="amicare"', "Amicare renderBlocks keeps shared legacy shell")
  assertIncludes(blockListSlotMarkup, "data-amicare-nav", "Amicare renderBlocks keeps shared nav chrome")
  assertIncludes(blockListSlotMarkup, 'data-cms-editable-block-list="5"', "Amicare renderBlocks inserts CMS-owned block list inside shell")
  assertIncludes(blockListSlotMarkup, "cms-block--hero", "Amicare renderBlocks can keep default block output")
  assertOrdered(blockListSlotMarkup, "data-amicare-nav", "data-cms-editable-block-list", "Amicare renderBlocks slot renders after nav")
  assertOrdered(blockListSlotMarkup, "data-cms-editable-block-list", "cms-block--hero", "Amicare renderBlocks slot wraps block output")

  const darkAmicareMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicarePage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: {
        ...amicarePublishedSiteSnapshot.theme,
        mode: "dark",
        darkColors: undefined,
      },
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(darkAmicareMarkup, 'data-rt-mode="dark"', "Amicare dark theme mode marker")
  assertIncludes(
    darkAmicareMarkup,
    `${publicRendererScope}[data-rt-mode="dark"]{`,
    "Amicare dark mode without darkColors emits CMS canvas fallback tokens",
  )
  assertIncludes(darkAmicareMarkup, "--color-on-accent:#ffffff", "Amicare dark fallback emits foreground-on-accent token")
  assertIncludes(darkAmicareMarkup, "--color-bg:#09090b", "Amicare dark fallback emits background token")
  assertIncludes(darkAmicareMarkup, "--color-ink:#fafafa", "Amicare dark fallback emits ink token")
  assertIncludes(darkAmicareMarkup, "--color-rule:rgba(255, 255, 255, 0.12)", "Amicare dark fallback emits rule token")
  assertIncludes(darkAmicareMarkup, "--color-accent:#a04e32", "Amicare dark fallback keeps base accent token")

  const amicareContactDescriptionPage = {
    ...amicarePage,
    blocks: amicarePage.blocks.map((block) =>
      block.blockType === "cta" && block.anchor === "contact"
        ? { ...block, description: testBlockText("Mail gerust voor een kennismaking.") }
        : block,
    ),
  } satisfies Page
  const amicareContactDescriptionMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amicareContactDescriptionPage,
      settings: amicarePublishedSiteSnapshot.settings,
      theme: amicarePublishedSiteSnapshot.theme,
      tenantSlug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(amicareContactDescriptionMarkup, '<p class="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[17px]">Mail gerust voor een kennismaking.</p>', "Amicare contact CTA description rich text renders inline inside legacy paragraph")
  assertExcludes(amicareContactDescriptionMarkup, '<p class="mx-auto mt-7 max-w-prose text-[16px] leading-[1.7] text-ink-muted [font-family:var(--font-text)] @min-[48rem]/site-frame:text-[17px]"><p class="rt-p">', "Amicare contact CTA description does not render nested paragraphs")

  const amblastHomeFixturePage = amblastPublishedSiteSnapshot.pages.find((page) => page.slug === "index")
  if (!amblastHomeFixturePage) throw new Error("Amblast published fixture index page exists")
  const amblastHomePage = {
    ...amblastHomeFixturePage,
    updatedAt: amblastHomeFixturePage.updatedAt ?? amblastPublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
  } satisfies Page

  const amblastHomeMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amblastHomePage,
      settings: amblastPublishedSiteSnapshot.settings,
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(amblastHomeMarkup, 'data-legacy-tenant="amblast"', "Amblast legacy root attribute")
  assertIncludes(amblastHomeMarkup, 'data-amblast-page-id="845"', "Amblast home exact page ID")
  assertIncludes(amblastHomeMarkup, 'id="amb-page-flag"', "Amblast exact page wrapper")
  assertIncludes(amblastHomeMarkup, "amb-page-home", "Amblast home body class preserved on wrapper")
  assertIncludes(amblastHomeMarkup, "amb-info-carousel", "Amblast service carousel exact class")
  assertIncludes(amblastHomeMarkup, "swiper-wrapper", "Amblast carousel swiper structure")
  assertIncludes(amblastHomeMarkup, 'data-amblast-behavior="site-client"', "Amblast behavior bootstrap")
  assertIncludes(amblastHomeMarkup, 'class="amb-shape amb-shape-top"', "Amblast shape divider top preserved")
  assertIncludes(amblastHomeMarkup, 'data-settings="{&quot;_animation&quot;:&quot;fadeInUp&quot;', "Amblast Elementor animation data preserved")
  assertEqual(
    amblastHomeMarkup.includes("site-header--source-amblast-industrial"),
    false,
    "Amblast legacy renderer bypasses generic chrome approximation",
  )

  const amblastPages = [
    { slug: "index", pageId: "845", activeHref: "/" },
    { slug: "over-ons", pageId: "880", activeHref: "/over-ons/" },
    { slug: "diensten", pageId: "883", activeHref: "/diensten/" },
    { slug: "portfolio", pageId: "886", activeHref: "/portfolio" },
    { slug: "contact", pageId: "901", activeHref: null },
  ] as const

  for (const expected of amblastPages) {
    const fixturePage = amblastPublishedSiteSnapshot.pages.find((candidate) => candidate.slug === expected.slug)
    if (!fixturePage) throw new Error(`Amblast published fixture ${expected.slug} page exists`)
    const markup = renderToStaticMarkup(
      React.createElement(SitePageRenderer, {
        page: {
          ...fixturePage,
          updatedAt: fixturePage.updatedAt ?? amblastPublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
        } satisfies Page,
        settings: amblastPublishedSiteSnapshot.settings,
        theme: amblastPublishedSiteSnapshot.theme,
        tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
        domain: amblastPublishedSiteSnapshot.domain,
      }),
    )
    assertIncludes(markup, `data-amblast-page="${expected.slug}"`, `Amblast ${expected.slug} legacy page slug`)
    assertIncludes(markup, `data-amblast-page-id="${expected.pageId}"`, `Amblast ${expected.slug} exact page ID`)
    assertIncludes(markup, 'data-amb-el-type="section"', `Amblast ${expected.slug} Elementor section data attributes`)
    assertIncludes(markup, 'data-widget_type=', `Amblast ${expected.slug} Elementor widget data attributes`)
    assertIncludes(markup, "amb-section", `Amblast ${expected.slug} amb classes`)
    assertIncludes(markup, "amb-shape", `Amblast ${expected.slug} shape divider markup`)
    if (expected.activeHref) {
      assertIncludes(
        markup,
        `<a href="${expected.activeHref}" class="amb-menu-item" aria-current="amb-page-flag"`,
        `Amblast ${expected.slug} active nav route`,
      )
    }
  }

  const amblastOverFixturePage = amblastPublishedSiteSnapshot.pages.find((page) => page.slug === "over-ons")
  if (!amblastOverFixturePage) throw new Error("Amblast published fixture over-ons page exists")
  const editedAmblastOverPage = {
    ...amblastOverFixturePage,
    updatedAt: amblastOverFixturePage.updatedAt ?? amblastPublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
    blocks: amblastOverFixturePage.blocks.map((block) => {
      if (block.blockType === "mediaHero") {
        return {
          ...block,
          headline: testInlineText("Over Amblast vandaag"),
          foregroundImage: { id: "about-edited", url: "/uploads/portfolio/about-edited.jpg", filename: "about-edited.jpg", alt: "Edited about image" },
        }
      }
      if (block.blockType === "richText") {
        return {
          ...block,
          body: testRichText([
            { heading: "Familiebedrijf met focus", text: "Aangepaste introductietekst voor de over ons pagina." },
            { text: "Tweede alinea met veilige inhoud." },
          ]),
        }
      }
      if (block.blockType === "infoCardList") {
        return {
          ...block,
          items: block.items.map((item, index) =>
            index === 0
              ? {
                  ...item,
                  title: testInlineText("Transparante prijzen"),
                  image: { id: "about-icon-edited", url: "/uploads/icons/about-icon-edited.png", filename: "about-icon-edited.png", alt: "Edited icon" },
                }
              : item,
          ),
        }
      }
      if (block.blockType === "cta") {
        return { ...block, primary: { label: "Bekijk diensten", href: '/diensten" onclick="alert(1)' } }
      }
      return block
    }),
  } satisfies Page
  const editedAmblastOverMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: editedAmblastOverPage,
      settings: amblastPublishedSiteSnapshot.settings,
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(editedAmblastOverMarkup, "Over Amblast vandaag", "Amblast over-ons edited hero title slot")
  assertIncludes(editedAmblastOverMarkup, "Familiebedrijf met focus", "Amblast over-ons edited rich-text heading slot")
  assertIncludes(editedAmblastOverMarkup, "Aangepaste introductietekst voor de over ons pagina.", "Amblast over-ons edited intro text slot")
  assertIncludes(editedAmblastOverMarkup, "/uploads/portfolio/about-edited.jpg", "Amblast over-ons edited foreground media slot")
  assertIncludes(editedAmblastOverMarkup, "/uploads/icons/about-icon-edited.png", "Amblast over-ons edited value icon media slot")
  assertIncludes(editedAmblastOverMarkup, "Transparante prijzen", "Amblast over-ons edited value title slot")
  assertIncludes(editedAmblastOverMarkup, "Bekijk diensten", "Amblast over-ons edited CTA label slot")
  assertIncludes(editedAmblastOverMarkup, 'href="/diensten&quot; onclick=&quot;alert(1)"', "Amblast over-ons escaped CTA href slot")
  assertExcludes(editedAmblastOverMarkup, 'onclick="alert(1)', "Amblast over-ons does not create injected onclick attribute")

  const amblastServicesFixturePage = amblastPublishedSiteSnapshot.pages.find((page) => page.slug === "diensten")
  if (!amblastServicesFixturePage) throw new Error("Amblast published fixture diensten page exists")
  const editedAmblastServicesPage = {
    ...amblastServicesFixturePage,
    updatedAt: amblastServicesFixturePage.updatedAt ?? amblastPublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
    blocks: amblastServicesFixturePage.blocks.map((block) => {
      if (block.blockType === "mediaHero") return { ...block, headline: testInlineText("Services op maat") }
      if (block.blockType === "serviceCarousel") {
        return {
          ...block,
          items: block.items.map((item, index) =>
            index === 0
              ? {
                  ...item,
                  title: testInlineText("Productielijn reiniging"),
                  description: testBlockText("Beschrijving met <script>alert(1)</script> en vaste tags."),
                  image: { id: "service-edited", url: "/uploads/service-cards/service-edited.png", filename: "service-edited.png", alt: "Edited service" },
                }
              : item,
          ),
        }
      }
      return block
    }),
  } satisfies Page
  const editedAmblastServicesMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: editedAmblastServicesPage,
      settings: amblastPublishedSiteSnapshot.settings,
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(editedAmblastServicesMarkup, "Services op maat", "Amblast diensten edited hero title slot")
  assertIncludes(editedAmblastServicesMarkup, "Productielijn reiniging", "Amblast diensten edited service title slot")
  assertIncludes(editedAmblastServicesMarkup, "/uploads/service-cards/service-edited.png", "Amblast diensten edited service media slot")
  assertIncludes(editedAmblastServicesMarkup, "Beschrijving met &lt;script&gt;alert(1)&lt;/script&gt; en vaste tags.", "Amblast diensten escaped service HTML slot text")
  assertExcludes(editedAmblastServicesMarkup, "Beschrijving met <script>alert(1)</script>", "Amblast diensten does not render raw script in HTML slot")

  const amblastPortfolioFixturePage = amblastPublishedSiteSnapshot.pages.find((page) => page.slug === "portfolio")
  if (!amblastPortfolioFixturePage) throw new Error("Amblast published fixture portfolio page exists")
  const amblastPortfolioPage = {
    ...amblastPortfolioFixturePage,
    updatedAt: amblastPortfolioFixturePage.updatedAt ?? amblastPublishedSiteSnapshot.publishedAt ?? "2026-01-01T00:00:00.000Z",
  } satisfies Page
  const editedAmblastPortfolioPage = {
    ...amblastPortfolioPage,
    blocks: amblastPortfolioPage.blocks.map((block) => {
      if (block.blockType === "mediaHero") return { ...block, headline: testInlineText("Werk in beeld") }
      if (block.blockType === "richText") {
        return {
          ...block,
          body: testRichText([{ heading: "Resultaten zonder omwegen", text: "Bekijk veilig aangepaste portfolio tekst." }]),
        }
      }
      if (block.blockType === "beforeAfterGallery") {
        return {
          ...block,
          pairs: block.pairs.map((pair, index) =>
            index === 0
              ? {
                  ...pair,
                  before: { id: "before-edited", url: "/uploads/portfolio/before-edited.jpg", filename: "before-edited.jpg", alt: "Before edited" },
                  after: { id: "after-edited", url: "/uploads/portfolio/after-edited.jpg", filename: "after-edited.jpg", alt: "After edited" },
                  beforeLabel: "Voor <script>alert(1)</script>",
                  afterLabel: 'Na "schoon"',
                }
              : pair,
          ),
        }
      }
      return block
    }),
  } satisfies Page
  const editedAmblastPortfolioMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: editedAmblastPortfolioPage,
      settings: amblastPublishedSiteSnapshot.settings,
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(editedAmblastPortfolioMarkup, "Werk in beeld", "Amblast portfolio edited hero title slot")
  assertIncludes(editedAmblastPortfolioMarkup, "Resultaten zonder omwegen", "Amblast portfolio edited rich-text heading slot")
  assertIncludes(editedAmblastPortfolioMarkup, "Bekijk veilig aangepaste portfolio tekst.", "Amblast portfolio edited body slot")
  assertIncludes(editedAmblastPortfolioMarkup, "/uploads/portfolio/before-edited.jpg", "Amblast portfolio edited before media slot")
  assertIncludes(editedAmblastPortfolioMarkup, "/uploads/portfolio/after-edited.jpg", "Amblast portfolio edited after media slot")
  assertIncludes(editedAmblastPortfolioMarkup, "<span>Voor &lt;script&gt;alert(1)&lt;/script&gt;</span>", "Amblast portfolio escaped before label slot")
  assertIncludes(editedAmblastPortfolioMarkup, "<span>Na &quot;schoon&quot;</span>", "Amblast portfolio escaped quote in label slot")
  assertExcludes(editedAmblastPortfolioMarkup, "<span>Voor <script>alert(1)</script></span>", "Amblast portfolio does not render raw script label")

  const editedAmblastHomePage = {
    ...amblastHomePage,
    blocks: amblastHomePage.blocks.map((block) =>
      block.blockType === "mediaHero"
        ? {
            ...block,
            headline: testInlineText("Precisie reiniging voor productie"),
            subheadline: testBlockText("Aangepaste snapshot tekst voor de legacy hero."),
            cta: { label: "Plan inspectie", href: "/contact?source=hero" },
          }
        : block,
    ),
  } satisfies Page
  const editedAmblastHomeMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: editedAmblastHomePage,
      settings: {
        ...amblastPublishedSiteSnapshot.settings,
        contactEmail: "planning@example.test",
        branding: {
          ...amblastPublishedSiteSnapshot.settings.branding,
          logo: {
            id: "amblast-edited-logo",
            url: "/uploads/logo/amblast-edited.png",
            filename: "amblast-edited.png",
            alt: "Amblast edited logo",
            width: 714,
            height: 179,
          },
        },
        chrome: {
          ...amblastPublishedSiteSnapshot.settings.chrome,
          header: {
            ...amblastPublishedSiteSnapshot.settings.chrome?.header,
            cta: { label: "Bel ons", href: "/contact?source=header" },
            logo: {
              id: "amblast-edited-logo",
              url: "/uploads/logo/amblast-edited.png",
              filename: "amblast-edited.png",
              alt: "Amblast edited logo",
              width: 714,
              height: 179,
            },
          },
          footer: {
            ...amblastPublishedSiteSnapshot.settings.chrome?.footer,
            tagline: "Beheer uw faciliteit",
            logo: {
              id: "amblast-edited-logo",
              url: "/uploads/logo/amblast-edited.png",
              filename: "amblast-edited.png",
              alt: "Amblast edited logo",
              width: 714,
              height: 179,
            },
          },
        },
      },
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(editedAmblastHomeMarkup, "Precisie reiniging voor productie", "Amblast edited hero headline slot")
  assertIncludes(editedAmblastHomeMarkup, "Aangepaste snapshot tekst voor de legacy hero.", "Amblast edited hero text slot")
  assertIncludes(editedAmblastHomeMarkup, 'href="/contact?source=header"', "Amblast edited header CTA link slot")
  assertIncludes(editedAmblastHomeMarkup, "Bel ons", "Amblast edited header CTA label slot")
  assertIncludes(editedAmblastHomeMarkup, 'href="/contact?source=hero"', "Amblast edited hero CTA link slot")
  assertIncludes(editedAmblastHomeMarkup, "Plan inspectie", "Amblast edited hero CTA label slot")
  assertIncludes(editedAmblastHomeMarkup, "/uploads/logo/amblast-edited.png", "Amblast edited logo media slot")
  assertIncludes(editedAmblastHomeMarkup, "Beheer uw faciliteit", "Amblast edited footer tagline slot")
  assertIncludes(editedAmblastHomeMarkup, 'data-id="67196b24"', "Amblast edited slots keep exact widget structure")
  assertExcludes(editedAmblastHomeMarkup, "source=hero?source=header", "Amblast edited CTA href slots do not cascade")
  assertOrdered(editedAmblastHomeMarkup, 'href="/contact?source=header"', 'href="/contact?source=hero"', "Amblast edited header CTA remains before hero CTA")
  assertIncludes(
    editedAmblastHomeMarkup,
    '<a href="/" class="amb-menu-item" aria-current="amb-page-flag"',
    "Amblast edited home active nav remains correct",
  )
  assertIncludes(editedAmblastHomeMarkup, "planning@example.test", "Amblast edited footer contact email slot")
  assertOrdered(editedAmblastHomeMarkup, "<footer", "planning@example.test", "Amblast edited footer contact remains inside footer")
  assertEqual(editedAmblastHomeMarkup.split("planning@example.test").length - 1, 2, "Amblast edited footer email appears only in footer href and text")
  const amblastPortfolioMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: amblastPortfolioPage,
      settings: amblastPublishedSiteSnapshot.settings,
      theme: amblastPublishedSiteSnapshot.theme,
      tenantSlug: amblastPublishedSiteSnapshot.tenantSlug,
      domain: amblastPublishedSiteSnapshot.domain,
    }),
  )
  assertIncludes(amblastPortfolioMarkup, 'data-amblast-page-id="886"', "Amblast portfolio exact page ID")
  assertIncludes(amblastPortfolioMarkup, 'data-widget_type="amb-compare.default"', "Amblast portfolio comparison widget")
  assertIncludes(amblastPortfolioMarkup, "amb-compare-handle", "Amblast before-after handle")
  assertIncludes(amblastPortfolioMarkup, "Voor", "Amblast before label")
  assertIncludes(amblastPortfolioMarkup, "Na", "Amblast after label")

  const genericMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: v1FixturePage,
      settings: v1FixtureSettings,
    }),
  )
  assertEqual(genericMarkup.includes("data-legacy-tenant="), false, "generic fixture has no legacy root")
  assertEqual(genericMarkup.includes("data-amicare-nav"), false, "generic fixture has no Amicare nav")
  assertEqual(genericMarkup.includes("data-amicare-nav-link"), false, "generic fixture has no Amicare nav link markers")
  assertEqual(genericMarkup.includes("site-renderer--legacy-amicare"), false, "generic fixture has no Amicare legacy class")
  assertEqual(genericMarkup.includes("prose-headings:font-serif"), false, "generic fixture has no Amicare rich text classes")
  assertEqual(genericMarkup.includes("animate-float"), false, "generic fixture has no Amicare float animation")
  assertEqual(genericMarkup.includes("cookie-consent-banner"), false, "generic fixture has no Amicare cookie consent")
  assertEqual(genericMarkup.includes("amb-page-flag"), false, "generic fixture has no Amblast wrapper")
  assertEqual(genericMarkup.includes("amb-info-carousel"), false, "generic fixture has no Amblast carousel")

  const css = await readCssFixture()
  assertGenericCssIsScoped(css)
  assertIncludes(
    css,
    ".site-renderer:not([data-legacy-tenant]) .cms-block {",
    "generic cms-block CSS is scoped to non-legacy renderer",
  )
  assertIncludes(
    css,
    ".site-renderer:not([data-legacy-tenant]) .cms-block--hero {",
    "generic hero CSS is scoped to non-legacy renderer",
  )
  assertIncludes(
    css,
    ".site-renderer:not([data-legacy-tenant]) .cms-block--cta {",
    "generic CTA CSS is scoped to non-legacy renderer",
  )
  assertIncludes(
    css,
    ".site-renderer:not([data-legacy-tenant]) .rt-p {",
    "generic rich-text paragraph CSS is scoped to non-legacy renderer",
  )
  assertExcludes(
    css,
    '.site-renderer[data-legacy-tenant="amicare"] .cms-block {',
    "Amicare has no cms-block reset override",
  )
  assertExcludes(
    css,
    '.site-renderer[data-legacy-tenant="amicare"] .cms-block--hero {',
    "Amicare has no hero reset override",
  )

  const genericLegacyNameMarkup = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: v1FixturePage,
      settings: {
        ...v1FixtureSettings,
        siteName: "Amblast style landing page",
        siteUrl: "https://amblast.nl",
      },
      tenantSlug: "generic-amblast-inspired",
      domain: "generic.example.test",
    }),
  )
  assertEqual(genericLegacyNameMarkup.includes("data-legacy-tenant="), false, "legacy-looking generic tenant has no legacy root")
  assertEqual(genericLegacyNameMarkup.includes("amb-page-flag"), false, "legacy-looking generic tenant has no Amblast wrapper")
}

runVariantResolverTests()
runBlockRenderTests()
runChromeRenderTests()
runAmicareScopeTests()
runAmblastScopeTests()
runThemeCssVarTests()
await runLegacyRendererDispatchTests()
