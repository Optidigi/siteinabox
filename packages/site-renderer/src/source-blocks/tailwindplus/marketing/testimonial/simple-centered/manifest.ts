import type { TestimonialsBlock } from "@siteinabox/contracts"
import { defineProviderBlock, type ProviderBlockValidationIssue } from "../../../../registry"
import { TailwindPlusMarketingTestimonialSimpleCenteredRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_NAMESPACE = "tailwindplus.marketing.testimonial"
export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_ID = "tailwindplus.marketing.testimonial.simple-centered"
export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_LEGACY_VARIANT = "tailwindPlusSimpleCentered"

function hasMedia(value: TestimonialsBlock["logo"]): boolean {
  if (!value) return false
  if (typeof value === "string" || typeof value === "number") return true
  return Boolean(value.id ?? value.url ?? value.filename)
}

function validateTestimonialSimpleCentered(block: TestimonialsBlock): ProviderBlockValidationIssue[] {
  const issues: ProviderBlockValidationIssue[] = []
  const item = block.items[0]
  if (!hasMedia(block.logo)) {
    issues.push({
      code: "missing_required_slot",
      message: "Tailwind Plus simple centered testimonial exact variant requires a logo image.",
      path: ["logo"],
    })
  }
  if (!hasMedia(item?.avatar)) {
    issues.push({
      code: "missing_required_slot",
      message: "Tailwind Plus simple centered testimonial exact variant requires an avatar image.",
      path: ["items", "0", "avatar"],
    })
  }
  return issues
}

export const tailwindPlusMarketingTestimonialSimpleCenteredProviderBlock = defineProviderBlock<TestimonialsBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_ID,
  blockType: "testimonials",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-testimonial-simple-centered",
  renderer: TailwindPlusMarketingTestimonialSimpleCenteredRenderer,
  slots: {
    logo: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "logo",
    },
    items: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "items",
      minItems: 1,
      maxItems: 1,
    },
    quote: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "items.quote",
    },
    author: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "items.author",
    },
    role: {
      kind: "text",
      status: "optional",
      exposed: true,
      sourceField: "items.role",
    },
    avatar: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "items.avatar",
    },
    title: {
      kind: "text",
      status: "inactive",
      exposed: false,
      sourceField: "title",
    },
  },
  validate: validateTestimonialSimpleCentered,
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/testimonials",
    sourceComponent: "Marketing / Page Sections / Testimonials / Simple centered",
    sourceHash: "sha256:409952590df6ccf21b79639a920853168a21c5ed82237483d2341ff824dc86a7",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus local source-backed component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
