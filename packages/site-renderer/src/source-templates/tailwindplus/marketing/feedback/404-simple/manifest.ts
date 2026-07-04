import { defineProviderSystemTemplate } from "../../../../registry"
import { TailwindPlusMarketingFeedback404SimpleRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_FEEDBACK_404_SIMPLE_NAMESPACE = "tailwindplus.marketing.feedback"
export const TAILWIND_PLUS_MARKETING_FEEDBACK_404_SIMPLE_ID = "tailwindplus.marketing.feedback.404-simple"

export const tailwindPlusMarketingFeedback404SimpleProviderTemplate = defineProviderSystemTemplate({
  provider: "tailwindplus",
  role: "systemTemplate",
  kind: "notFound",
  namespace: TAILWIND_PLUS_MARKETING_FEEDBACK_404_SIMPLE_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_FEEDBACK_404_SIMPLE_ID,
  rendererClassName: "renderer-not-found--source-tailwindplus-404-simple",
  renderer: TailwindPlusMarketingFeedback404SimpleRenderer,
  slots: {
    eyebrow: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "status",
    },
    heading: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "heading",
    },
    body: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "body",
    },
    primaryCta: {
      kind: "cta",
      status: "required",
      exposed: true,
      sourceField: "primaryCta",
    },
    secondaryCta: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "secondaryCta",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/feedback/404-pages",
    sourceComponent: "Marketing / Feedback / 404 Pages / Simple",
    sourceHash: "sha256:499969d84a7cd7294939f34295fbbbb1e914f0f6a4b4e4367c750e48ba7bb668",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus source-visible Marketing feedback source; keep local snapshot out of runtime imports.",
  },
})
