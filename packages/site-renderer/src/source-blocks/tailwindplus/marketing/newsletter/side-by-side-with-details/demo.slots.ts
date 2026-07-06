import type { NewsletterBlock } from "@siteinabox/contracts"

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

export const tailwindPlusMarketingNewsletterSideBySideWithDetailsDemoSlots: NewsletterBlock = {
  blockType: "newsletter",
  designVariant: "tailwindplus.marketing.newsletter.side-by-side-with-details",
  title: inlineText("Subscribe to our newsletter"),
  description: blockText("Nostrud amet eu ullamco nisi aute in ad minim nostrud adipisicing velit quis. Duis tempor incididunt dolore."),
  emailLabel: "Email address",
  emailPlaceholder: "Enter your email",
  submitLabel: "Subscribe",
  benefits: [
    { title: inlineText("Weekly articles"), description: blockText("Non laboris consequat cupidatat laborum magna. Eiusmod non irure cupidatat duis commodo amet.") },
    { title: inlineText("No spam"), description: blockText("Officia excepteur ullamco ut sint duis proident non adipisicing. Voluptate incididunt anim.") },
  ],
  provider: { provider: "siab", action: "/api/forms/newsletter", method: "POST" },
}
