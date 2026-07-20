import type { LinkRef, MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText, previewInlineTextWithLinebreak } from "../fixtures"

const previewMedia = (alt: string): MediaRef => ({
  url: `/images/${alt.toLowerCase().replace(/\s+/g, "-")}.png`,
  alt,
})

const heroSharedEyebrowCta = {
  eyebrow: previewInlineText("Just released v1.0.0"),
  cta: { label: "Get Started", href: "#" } satisfies LinkRef,
  secondary: { label: "Watch Demo", href: "#demo" } satisfies LinkRef,
}

const heroThoughtfullyDesignedSub = previewBlockText(
  "Instead of starting from scratch every time, use thoughtfully designed blocks that give you a solid foundation for any UI.",
)

const heroExploreCollectionSub = previewBlockText(
  "Explore a collection of Shadcn UI blocks and components, ready to preview and copy. Streamline your development workflow with easy-to-implement examples.",
)

const heroNbspHassleHeadline = previewInlineText("Ship better UI without\u00a0the\u00a0hassle")

const heroToolkitHeadline = previewInlineTextWithLinebreak("Your complete", " UI building toolkit")

export const heroFamilyCmsLike = {
  ...heroSharedEyebrowCta,
  // Match upstream literal line-break control (`without&nbsp;the&nbsp;hassle`).
  headline: heroNbspHassleHeadline,
  subheadline: heroThoughtfullyDesignedSub,
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

export const hero02Literal = {
  ...heroSharedEyebrowCta,
  headline: heroToolkitHeadline,
  subheadline: heroExploreCollectionSub,
}

export const hero03Literal = {
  ...heroSharedEyebrowCta,
  headline: heroNbspHassleHeadline,
  subheadline: heroThoughtfullyDesignedSub,
}

export const hero04Literal = {
  ...heroSharedEyebrowCta,
  headline: previewInlineText("A better way to build clean interfaces"),
  subheadline: heroExploreCollectionSub,
}

export const hero05Literal = {
  ...hero02Literal,
}

export const heroFamilyWithImage = {
  ...heroFamilyCmsLike,
  image: previewMedia("Hero media"),
}

export const hero02LiteralWithImage = {
  ...hero02Literal,
  image: previewMedia("Hero media"),
}

export const hero03LiteralWithImage = {
  ...hero03Literal,
  image: previewMedia("Hero media"),
}

export const hero04LiteralWithImage = {
  ...hero04Literal,
  image: previewMedia("Hero media"),
}

export const hero05LiteralWithImage = {
  ...hero05Literal,
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
