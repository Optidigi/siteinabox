import type { LinkRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"

export const cta01Literal = {
  headline: previewInlineText("Ready to Build Faster?"),
  description: previewBlockText(
    "Join thousands of developers using our premium component library to ship beautiful UIs in minutes, not hours.",
  ),
  primary: { label: "Get Started", href: "#" } satisfies LinkRef,
}

export const cta01Sparse = {
  headline: previewInlineText("Headline only"),
}

export const cta01Long = {
  headline: previewInlineText("A".repeat(500)),
  description: previewBlockText("Still fine."),
  primary: { label: "Go", href: "/go" } satisfies LinkRef,
}

export const cta01CmsLike = {
  headline: previewInlineText("Start now"),
  description: previewBlockText("We respond quickly."),
  primary: { label: "Email us", href: "mailto:hello@example.test" } satisfies LinkRef,
}
