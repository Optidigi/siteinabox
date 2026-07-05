import type { ContentSectionBlock } from "@siteinabox/contracts"

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

export const tailwindPlusMarketingContentStickyProductScreenshotDemoSlots: ContentSectionBlock = {
  blockType: "contentSection",
  designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
  anchor: "workflow",
  eyebrow: inlineText("Deploy faster"),
  title: inlineText("A better workflow"),
  intro: blockText("Keep launch work moving with structured content, validated slots, and one shared renderer."),
  body: blockText("Provider source owns the sticky screenshot layout while SiaB stores the editable copy, media, and feature rows as CMS data."),
  image: {
    url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
    alt: "Product workflow screenshot",
    width: 1824,
    height: 1080,
  },
  features: [
    {
      title: inlineText("Push to deploy."),
      description: blockText("Publish validated snapshots without generating tenant-specific source code."),
      icon: "cloud-arrow-up",
    },
    {
      title: inlineText("SSL certificates."),
      description: blockText("Keep platform-owned infrastructure concerns separate from generated page content."),
      icon: "lock-closed",
    },
    {
      title: inlineText("Database backups."),
      description: blockText("Store canonical content in the CMS and project it into public runtime snapshots."),
      icon: "server",
    },
  ],
  secondaryTitle: inlineText("No server? No problem."),
  secondaryBody: blockText("The public renderer serves the generated site from structured snapshot data, not per-client source trees."),
}
