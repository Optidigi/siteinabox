import type { LinkRef, MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"

const previewMedia = (alt: string): MediaRef => ({
  url: `/images/${alt.toLowerCase().replace(/\s+/g, "-")}.png`,
  alt,
})

const baseCta = {
  headline: previewInlineText("Step Into Something Better"),
  description: previewBlockText("Get seamless access to everything you need, right from your phone."),
  primary: { label: "Download Now", href: "#" } satisfies LinkRef,
}

export const cta02Literal = {
  ...baseCta,
  backgroundImage: previewMedia("CTA background"),
}

export const cta02Sparse = {
  headline: previewInlineText("Headline only"),
}

export const cta02Long = {
  headline: previewInlineText("A".repeat(500)),
  description: previewBlockText("Still fine."),
  primary: { label: "Go", href: "/go" } satisfies LinkRef,
  backgroundImage: previewMedia("Long headline background"),
}

export const cta03Literal = {
  ...baseCta,
  backgroundImage: previewMedia("Mobile app preview"),
}

export const cta03Sparse = cta02Sparse

export const cta04Literal = {
  headline: previewInlineText("Build something you're proud of today"),
  description: previewBlockText("Join thousands of developers using our tools."),
  primary: { label: "Get Started Today", href: "#" } satisfies LinkRef,
  backgroundImage: previewMedia("Product preview"),
}

export const cta04Sparse = {
  headline: previewInlineText("Headline only"),
}

export const cta05Literal = {
  headline: previewInlineText("Turn your vision into reality"),
  description: previewBlockText(
    "Join thousands of developers using our premium component library to ship beautiful UIs in minutes, not hours.",
  ),
  primary: { label: "Get Started", href: "#" } satisfies LinkRef,
  secondary: { label: "View Components", href: "/components" } satisfies LinkRef,
}

export const cta05Sparse = {
  headline: previewInlineText("Headline only"),
}

export const cta05SecondaryOnly = {
  headline: previewInlineText("Choose your path"),
  description: previewBlockText("Compare plans before you commit."),
  secondary: { label: "View Components", href: "/components" } satisfies LinkRef,
}

export const cta06Literal = {
  headline: previewInlineText("Experience the difference"),
  description: previewBlockText(
    "Join thousands of developers using our premium component library to ship beautiful UIs in minutes, not hours.",
  ),
  primary: { label: "Get Started", href: "#" } satisfies LinkRef,
  secondary: { label: "View Components", href: "/components" } satisfies LinkRef,
}

export const cta06Sparse = cta05Sparse

export const cta07Literal = {
  headline: previewInlineText("Ready to Build Faster?"),
  description: previewBlockText(
    "Join thousands of developers using our premium component library to ship beautiful UIs in minutes, not hours.",
  ),
  primary: { label: "Get Started", href: "#" } satisfies LinkRef,
}

export const cta07Sparse = {
  headline: previewInlineText("Headline only"),
}
