import type { NewsletterBlock } from "@siteinabox/contracts"
import { defineProviderBlock, type ProviderBlockValidationIssue } from "../../../../registry"
import { TailwindPlusMarketingNewsletterSideBySideWithDetailsRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_NAMESPACE = "tailwindplus.marketing.newsletter"
export const TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_ID =
  "tailwindplus.marketing.newsletter.side-by-side-with-details"
export const TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_LEGACY_VARIANT =
  "tailwindPlusNewsletterSideBySideWithDetails"

const reservedNewsletterFieldNames = new Set(["formName", "email"])

function validateNewsletterSideBySideWithDetails(block: NewsletterBlock): ProviderBlockValidationIssue[] {
  const issues: ProviderBlockValidationIssue[] = []

  block.provider?.hiddenFields?.forEach((field, index) => {
    if (reservedNewsletterFieldNames.has(field.name)) {
      issues.push({
        code: "invalid_source_slot",
        message: `Hidden field "${field.name}" collides with a Tailwind Plus newsletter source field.`,
        path: ["provider", "hiddenFields", String(index), "name"],
      })
    }
  })
  const honeypot = block.provider?.honeypotField?.trim()
  if (honeypot && reservedNewsletterFieldNames.has(honeypot)) {
    issues.push({
      code: "invalid_source_slot",
      message: `Honeypot field "${honeypot}" collides with a Tailwind Plus newsletter source field.`,
      path: ["provider", "honeypotField"],
    })
  }
  if (block.provider?.requiresConsent) {
    issues.push({
      code: "inactive_slot_value",
      message: "Tailwind Plus side-by-side newsletter does not expose a visible consent slot.",
      path: ["provider", "requiresConsent"],
    })
  }

  return issues
}

export const tailwindPlusMarketingNewsletterSideBySideWithDetailsProviderBlock =
  defineProviderBlock<NewsletterBlock>({
    provider: "tailwindplus",
    namespace: TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_NAMESPACE,
    id: TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_ID,
    blockType: "newsletter",
    legacyDesignVariant: TAILWIND_PLUS_MARKETING_NEWSLETTER_SIDE_BY_SIDE_WITH_DETAILS_LEGACY_VARIANT,
    rendererClassName: "cms-block--source-tailwindplus-newsletter-side-by-side-with-details",
    renderer: TailwindPlusMarketingNewsletterSideBySideWithDetailsRenderer,
    validate: validateNewsletterSideBySideWithDetails,
    slots: {
      title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
      description: { kind: "richtext", status: "required", exposed: true, sourceField: "description" },
      emailLabel: { kind: "text", status: "optional", exposed: true, sourceField: "emailLabel" },
      emailPlaceholder: { kind: "text", status: "optional", exposed: true, sourceField: "emailPlaceholder" },
      submitLabel: { kind: "text", status: "required", exposed: true, sourceField: "submitLabel" },
      benefits: { kind: "repeater", status: "required", exposed: true, sourceField: "benefits", minItems: 2, maxItems: 2 },
      benefitTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "benefits.title" },
      benefitDescription: { kind: "richtext", status: "required", exposed: true, sourceField: "benefits.description" },
      benefitIcon: { kind: "text", status: "inactive", exposed: false, sourceField: "benefits.icon" },
      consentLabel: { kind: "text", status: "inactive", exposed: false, sourceField: "consentLabel" },
      provider: { kind: "text", status: "optional", exposed: true, sourceField: "provider" },
    },
    source: {
      sourceName: "Tailwind Plus",
      sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/newsletter-sections#component-82fc139db99143307df48bb9fe6152c5",
      sourceComponent: "Marketing / Page Sections / Newsletter Sections / Side-by-side with details",
      sourceHash: "sha256:a548f09374f7fdbfd73e320774cf73e48d54b3a61b3b832295654506986ae2f2",
      capturedAt: "2026-07-05",
      license: "Tailwind Plus public downloadable component source; keep local snapshot out of runtime imports.",
      sourceAvailability: "free-public",
      licenseCompatibility: "compatible",
      approvalStatus: "approved",
      implementation: "exact-source",
      visualExactnessStatus: "reviewed-exact-source",
    },
  })
