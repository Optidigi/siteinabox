import type { FeatureListBlock } from "@siteinabox/contracts"
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

export const tailwindPlusMarketingFeatureCentered2x2GridDemoSlots = {
  blockType: "featureList",
  designVariant: "tailwindPlusCentered2x2",
  title: inlineRt("Everything you need to deploy your app"),
  intro: blockRt("Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc."),
  features: [
    {
      title: inlineRt("Push to deploy"),
      description: blockRt("Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa."),
      icon: "upload",
    },
    {
      title: inlineRt("SSL certificates"),
      description: blockRt("Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget. Sem sodales gravida quam turpis enim lacus amet."),
      icon: "lock",
    },
    {
      title: inlineRt("Simple queues"),
      description: blockRt("Quisque est vel vulputate cursus. Risus proin diam nunc commodo. Lobortis auctor congue commodo diam neque."),
      icon: "refresh-cw",
    },
    {
      title: inlineRt("Advanced security"),
      description: blockRt("Arcu egestas dolor vel iaculis in ipsum mauris. Tincidunt mattis aliquet hac quis. Id hac maecenas ac donec pharetra eget."),
      icon: "shield",
    },
  ],
} satisfies FeatureListBlock
