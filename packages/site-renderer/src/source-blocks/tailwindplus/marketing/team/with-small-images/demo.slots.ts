import type { TeamBlock } from "@siteinabox/contracts"
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

export const tailwindPlusMarketingTeamWithSmallImagesDemoSlots = {
  blockType: "team",
  designVariant: "tailwindplus.marketing.team.with-small-images",
  title: inlineRt("Meet our leadership"),
  intro: blockRt("We are a dynamic group of individuals who are passionate about what we do."),
  members: [
    {
      name: "Leslie Alexander",
      role: "Co-Founder / CEO",
      image: { url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Leslie Alexander" },
    },
    {
      name: "Michael Foster",
      role: "Co-Founder / CTO",
      image: { url: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Michael Foster" },
    },
    {
      name: "Dries Vincent",
      role: "Business Relations",
      image: { url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Dries Vincent" },
    },
    {
      name: "Lindsay Walton",
      role: "Front-end Developer",
      image: { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Lindsay Walton" },
    },
  ],
} satisfies TeamBlock
