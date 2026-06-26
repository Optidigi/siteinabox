import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FAQBlockRenderer } from "./FAQ"
import { HeroBlockRenderer } from "./Hero"
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
    { blockType: "featureList", variant: "tailwindPlusCentered2x2", rendererClassName: "cms-block--source-tailwind-plus-centered-2x2" },
    { blockType: "featureList", variant: "services", rendererClassName: "" },
    { blockType: "richText", variant: "tailblocksContentA", rendererClassName: "cms-block--source-tailblocks-content-a" },
    { blockType: "richText", variant: "prose", rendererClassName: "" },
    { blockType: "cta", variant: "tailblocksCtaA", rendererClassName: "cms-block--source-tailblocks-cta-a" },
    { blockType: "cta", variant: "quote", rendererClassName: "" },
    { blockType: "contactSection", variant: "tailwindPlusNewsletterDetails", rendererClassName: "cms-block--source-tailwind-plus-newsletter-details" },
    { blockType: "contactSection", variant: "hyperUiNewsletterCentered", rendererClassName: "cms-block--source-hyperui-newsletter-centered" },
    { blockType: "contactSection", variant: "prelineCenteredNewsletter", rendererClassName: "cms-block--source-preline-centered-newsletter" },
    { blockType: "contactSection", variant: "form", rendererClassName: "" },
    { blockType: "faq", variant: "mambaFaq1", rendererClassName: "cms-block--source-mamba-faq-1" },
    { blockType: "faq", variant: "accordion", rendererClassName: "" },
    { blockType: "testimonials", variant: "mambaTestimonial1", rendererClassName: "cms-block--source-mamba-testimonial-1" },
    { blockType: "testimonials", variant: "cards", rendererClassName: "" },
    { blockType: "mediaHero", variant: "amblastShapedHero", rendererClassName: "cms-block--source-amblast-shaped-overlay" },
    { blockType: "infoCardList", variant: "amblastImageBoxes", rendererClassName: "cms-block--source-amblast-image-boxes" },
    { blockType: "serviceCarousel", variant: "amblastSwiperServices", rendererClassName: "cms-block--source-amblast-swiper-services" },
    { blockType: "beforeAfterGallery", variant: "amblastPortfolio", rendererClassName: "cms-block--source-amblast-portfolio-comparisons" },
    { blockType: "contactDetails", variant: "amblastContactCards", rendererClassName: "cms-block--source-amblast-contact-cards" },
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
}

runVariantResolverTests()
runBlockRenderTests()
