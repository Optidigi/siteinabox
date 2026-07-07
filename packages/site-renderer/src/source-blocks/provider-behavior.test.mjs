import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import {
  providerBlockDefinitions,
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
  validateProviderBlockInstance,
} from "./index.ts"

const demoBlocksById = new Map([
  ["tailwindplus.marketing.hero.simple-centered", tailwindPlusMarketingHeroSimpleCenteredDemoSlots],
  ["tailwindplus.marketing.hero.with-stats", tailwindPlusMarketingHeroWithStatsDemoSlots],
  ["tailwindplus.marketing.feature.with-product-screenshot", tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots],
  ["tailwindplus.marketing.feature.centered-2x2-grid", tailwindPlusMarketingFeatureCentered2x2GridDemoSlots],
  ["tailwindplus.marketing.cta.dark-panel-with-app-screenshot", tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots],
  ["tailwindplus.marketing.content.sticky-product-screenshot", tailwindPlusMarketingContentStickyProductScreenshotDemoSlots],
  ["tailwindplus.marketing.contact.centered", tailwindPlusMarketingContactCenteredDemoSlots],
  ["tailwindplus.marketing.testimonial.simple-centered", tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots],
  ["tailwindplus.marketing.stats.simple", tailwindPlusMarketingStatsSimpleDemoSlots],
  ["tailwindplus.marketing.logo-cloud.simple-with-heading", tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots],
  ["tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier", tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots],
  ["tailwindplus.marketing.team.with-small-images", tailwindPlusMarketingTeamWithSmallImagesDemoSlots],
  ["tailwindplus.marketing.newsletter.side-by-side-with-details", tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots],
  ["tailwindplus.marketing.blog.three-column", tailwindPlusMarketingBlogThreeColumnDemoSlots],
  ["tailwindplus.marketing.bento.three-column-bento-grid", tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots],
])

function clone(value) {
  return structuredClone(value)
}

function writeSlotValue(block, sourceField, value) {
  const [field, subField] = sourceField.split(".")
  if (!field) return
  if (!subField) {
    block[field] = value
    return
  }
  if (!Array.isArray(block[field])) block[field] = [{}]
  for (const item of block[field]) {
    if (item && typeof item === "object") item[subField] = value
  }
}

function sampleValueFor(slot) {
  if (slot.kind === "repeater") return [{ label: "Inactive" }]
  if (slot.kind === "image") return { url: "https://example.com/image.png", alt: "" }
  if (slot.kind === "cta") return { label: "Go", href: "#" }
  if (slot.kind === "richtext") {
    return { t: "root", variant: "inline", children: [{ t: "text", v: "Inactive" }] }
  }
  return "Inactive"
}

function renderDefinition(definition, block) {
  return renderToStaticMarkup(definition.renderer({ block, options: { index: 0 } }))
}

test("self-serve provider registry stays in lockstep with contract catalog and visual cases", () => {
  const catalogIds = SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS
    .map((variant) => variant.providerVariantId)
    .filter(Boolean)
    .sort()
  const registryIds = selfServeProviderBlockDefinitions.map((definition) => definition.id).sort()
  assert.deepEqual(registryIds, catalogIds)

  const visualHarness = readFileSync(new URL("../visual-parity/tailwindplus-visual-parity.mjs", import.meta.url), "utf8")
  for (const definition of selfServeProviderBlockDefinitions) {
    assert.ok(definition.renderer, `${definition.id} has renderer`)
    assert.ok(definition.rendererClassName, `${definition.id} has renderer class name`)
    assert.match(definition.source.sourceHash, /^sha256:[a-f0-9]{64}$/)
    assert.equal(definition.source.sourceAvailability, "free-public")
    assert.equal(definition.source.licenseCompatibility, "compatible")
    assert.equal(definition.source.approvalStatus, "approved")
    assert.equal(definition.source.implementation, "exact-source")
    assert.equal(definition.source.visualExactnessStatus, "reviewed-exact-source")
    assert.ok(demoBlocksById.has(definition.id), `${definition.id} has demo slots`)
    assert.match(visualHarness, new RegExp(`id: "${definition.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`))
  }
})

test("inactive and non-exposed provider slots fail closed for active definitions", () => {
  for (const definition of providerBlockDefinitions) {
    const demoBlock = demoBlocksById.get(definition.id)
    assert.ok(demoBlock, `${definition.id} has demo block`)
    for (const [slotName, slot] of Object.entries(definition.slots)) {
      if (slot.status !== "inactive" && slot.exposed) continue
      const block = clone(demoBlock)
      writeSlotValue(block, slot.sourceField || slotName, sampleValueFor(slot))
      const issues = validateProviderBlockInstance(block)
      assert.ok(
        issues.some((issue) => issue.code === "inactive_slot_value"),
        `${definition.id} slot ${slotName} should reject ${slot.sourceField}`,
      )
    }
  }
})

test("contact source block separates visible source form from SIAB runtime extras", () => {
  const definition = providerBlockDefinitions.find((candidate) => candidate.id === "tailwindplus.marketing.contact.centered")
  const block = clone(tailwindPlusMarketingContactCenteredDemoSlots)
  block.provider = {
    ...block.provider,
    hiddenFields: [{ name: "tenantId", value: "tenant-1" }],
    honeypotField: "company_website",
  }
  const html = renderDefinition(definition, block)

  assert.match(html, /data-siab-analytics-form="true"/)
  assert.match(html, /name="formName"/)
  assert.match(html, /name="tenantId"/)
  assert.match(html, /name="company_website"/)
  assert.match(html, /cms-block__form-message/)
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 1)
  assert.ok(html.indexOf('name="first-name"') < html.indexOf('name="last-name"'))
  assert.ok(html.indexOf('name="last-name"') < html.indexOf('name="company"'))
  assert.ok(html.indexOf('name="company"') < html.indexOf('name="email"'))
  assert.ok(html.indexOf('name="email"') < html.indexOf('name="phone-number"'))
  assert.ok(html.indexOf('name="phone-number"') < html.indexOf('name="message"'))

  for (const reserved of ["formName", "country", "agree-to-policies", "first-name", "last-name", "company", "email", "phone-number", "message"]) {
    const invalid = clone(tailwindPlusMarketingContactCenteredDemoSlots)
    invalid.provider = { ...invalid.provider, hiddenFields: [{ name: reserved, value: "bad" }] }
    assert.ok(validateProviderBlockInstance(invalid).some((issue) => issue.code === "invalid_source_slot"), reserved)
  }
})

test("newsletter source block keeps runtime form extras hidden and validates collisions", () => {
  const definition = providerBlockDefinitions.find((candidate) => candidate.id === "tailwindplus.marketing.newsletter.side-by-side-with-details")
  const block = clone(tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots)
  block.provider = {
    ...block.provider,
    hiddenFields: [{ name: "tenantId", value: "tenant-1" }],
    honeypotField: "company_website",
    successMessage: "Subscribed.",
  }
  const html = renderDefinition(definition, block)

  assert.match(html, /data-siab-analytics-form="true"/)
  assert.match(html, /data-siab-form-name="newsletter"/)
  assert.match(html, /name="formName"/)
  assert.match(html, /name="tenantId"/)
  assert.match(html, /name="company_website"/)
  assert.match(html, /cms-block__form-message/)

  for (const reserved of ["formName", "email"]) {
    const invalid = clone(tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots)
    invalid.provider = { ...invalid.provider, hiddenFields: [{ name: reserved, value: "bad" }] }
    assert.ok(validateProviderBlockInstance(invalid).some((issue) => issue.code === "invalid_source_slot"), reserved)
  }
  const consent = clone(tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots)
  consent.provider = { ...consent.provider, requiresConsent: true }
  assert.ok(validateProviderBlockInstance(consent).some((issue) => issue.path.join(".") === "provider.requiresConsent"))
})

test("testimonial optional media validates and keeps the dark radial token marker", () => {
  const definition = providerBlockDefinitions.find((candidate) => candidate.id === "tailwindplus.marketing.testimonial.simple-centered")
  const block = clone(tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots)
  block.logo = null
  block.items[0].avatar = null
  block.items[0].role = ""

  assert.deepEqual(validateProviderBlockInstance(block), [])
  const html = renderDefinition(definition, block)
  assert.match(html, /data-siab-tokenized-gradient="testimonial-radial"/)
  assert.doesNotMatch(html, /class="mx-auto h-12"/)
  assert.doesNotMatch(html, /class="mx-auto size-10 rounded-full"/)
  assert.doesNotMatch(html, /class="fill-gray-900"/)
})
