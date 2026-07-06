import type { HeroBlock } from "@siteinabox/contracts"

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

export const tailwindPlusMarketingHeroWithStatsDemoSlots: HeroBlock = {
  blockType: "hero",
  designVariant: "tailwindplus.marketing.hero.with-stats",
  headline: inlineText("Work with us"),
  subheadline: blockText("Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo. Elit sunt amet fugiat veniam occaecat fugiat."),
  cta: { label: "Open roles", href: "/careers" },
  secondary: { label: "Our values", href: "/values" },
  stats: [
    { value: "12", label: "Offices worldwide" },
    { value: "300+", label: "Full-time colleagues" },
    { value: "40", label: "Hours per week" },
    { value: "Unlimited", label: "Paid time off" },
  ],
}
