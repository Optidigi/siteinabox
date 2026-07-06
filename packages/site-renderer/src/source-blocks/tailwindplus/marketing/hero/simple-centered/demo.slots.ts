import type { HeroBlock } from "@siteinabox/contracts"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

const inlineRt = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockRt = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

export const tailwindPlusMarketingHeroSimpleCenteredDemoSlots = {
  blockType: "hero",
  designVariant: "tailwindplus.marketing.hero.simple-centered",
  eyebrow: inlineRt("Announcing our next round of funding."),
  headline: inlineRt("Data to enrich your online business"),
  subheadline: blockRt("Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo. Elit sunt amet fugiat veniam occaecat."),
  cta: {
    label: "Get started",
    href: "#",
  },
  secondary: {
    label: "Learn more",
    href: "#",
  },
} satisfies HeroBlock
