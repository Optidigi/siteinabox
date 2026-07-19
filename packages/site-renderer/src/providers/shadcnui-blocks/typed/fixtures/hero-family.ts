import type { LinkRef, MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"

const previewMedia = (alt: string): MediaRef => ({
  url: `/images/${alt.toLowerCase().replace(/\s+/g, "-")}.png`,
  alt,
})

export const heroFamilyCmsLike = {
  eyebrow: previewInlineText("Just released v1.0.0"),
  headline: previewInlineText("Ship better UI without the hassle"),
  subheadline: previewBlockText(
    "Instead of starting from scratch every time, use thoughtfully designed blocks that give you a solid foundation for any UI.",
  ),
  cta: { label: "Get Started", href: "#" } satisfies LinkRef,
  secondary: { label: "Watch Demo", href: "#demo" } satisfies LinkRef,
}

export const heroFamilySparse = {
  headline: previewInlineText("Headline only"),
}

export const heroFamilyLong = {
  eyebrow: previewInlineText("A".repeat(120)),
  headline: previewInlineText("B".repeat(500)),
  subheadline: previewBlockText("Still fine."),
  cta: { label: "Go", href: "/go" } satisfies LinkRef,
  secondary: { label: "Learn", href: "/learn" } satisfies LinkRef,
}

export const heroFamilySecondaryOnly = {
  headline: previewInlineText("Choose your path"),
  subheadline: previewBlockText("Compare plans before you commit."),
  secondary: { label: "Watch Demo", href: "#demo" } satisfies LinkRef,
}

export const heroFamilyWithImage = {
  ...heroFamilyCmsLike,
  image: previewMedia("Hero media"),
}

export const hero08FamilyCmsLike = {
  headline: previewInlineText("Beautifully Designed Premium Shadcn Blocks"),
  subheadline: previewBlockText(
    "A collection of beautifully designed components that you can use to build your next project.",
  ),
  cta: { label: "Get Started", href: "#" } satisfies LinkRef,
  secondary: { label: "Learn More", href: "#learn" } satisfies LinkRef,
  trustLabel: "Trusted by engineers at",
  logos: [
    { name: "Logo 1" },
    { name: "Logo 2" },
    { name: "Logo 3" },
    { name: "Logo 4" },
  ],
}

export const hero08FamilySparse = {
  headline: previewInlineText("Headline only"),
}
