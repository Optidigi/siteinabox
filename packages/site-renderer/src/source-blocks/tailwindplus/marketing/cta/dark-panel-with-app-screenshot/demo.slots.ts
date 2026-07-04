import type { CTABlock } from "@siteinabox/contracts"
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

export const tailwindPlusMarketingCtaDarkPanelWithAppScreenshotDemoSlots = {
  blockType: "cta",
  designVariant: "tailwindPlusDarkPanelWithAppScreenshot",
  headline: inlineRt("Boost your productivity. Start using our app today."),
  description: blockRt("Ac euismod vel sit maecenas id pellentesque eu sed consectetur. Malesuada adipiscing sagittis vel nulla."),
  primary: {
    label: "Get started",
    href: "#",
  },
  secondary: {
    label: "Learn more",
    href: "#",
  },
  backgroundImage: {
    url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
    alt: "App screenshot",
    width: 1824,
    height: 1080,
  },
} satisfies CTABlock
