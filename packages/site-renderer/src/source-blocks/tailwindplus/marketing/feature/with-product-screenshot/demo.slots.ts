import type { FeatureListBlock, RtRoot } from "@siteinabox/contracts"
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

export const tailwindPlusMarketingFeatureWithProductScreenshotDemoSlots = {
  blockType: "featureList",
  designVariant: "tailwindPlusWithProductScreenshot",
  eyebrow: inlineRt("Deploy faster"),
  title: inlineRt("A better workflow"),
  intro: blockRt("Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione."),
  image: {
    url: "https://tailwindcss.com/plus-assets/img/component-images/project-app-screenshot.png",
    alt: "Product screenshot",
    width: 2432,
    height: 1442,
  },
  features: [
    {
      title: inlineRt("Push to deploy."),
      description: inlineRt("Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione."),
      icon: "upload",
    },
    {
      title: inlineRt("SSL certificates."),
      description: inlineRt("Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo."),
      icon: "lock",
    },
    {
      title: inlineRt("Database backups."),
      description: inlineRt("Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus. Et magna sit morbi lobortis."),
      icon: "database",
    },
  ],
} satisfies FeatureListBlock & { eyebrow?: RtRoot | null }
