import type { TestimonialsBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingTestimonialSimpleCenteredRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_NAMESPACE = "tailwindplus.marketing.testimonial"
export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_ID = "tailwindplus.marketing.testimonial.simple-centered"
export const TAILWIND_PLUS_MARKETING_TESTIMONIAL_SIMPLE_CENTERED_LEGACY_VARIANT = "tailwindPlusSimpleCentered"

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
