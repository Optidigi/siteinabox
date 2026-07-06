import type { BentoGridBlock } from "@siteinabox/contracts"

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

export const tailwindPlusMarketingBentoThreeColumnBentoGridDemoSlots: BentoGridBlock = {
  blockType: "bentoGrid",
  designVariant: "tailwindplus.marketing.bento.three-column-bento-grid",
  anchor: "platform-grid",
  title: inlineText("Deploy faster"),
  intro: blockText("Everything you need to deploy your app"),
  items: [
    {
      title: inlineText("Mobile friendly"),
      description: blockText("Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png",
        alt: "Mobile app preview",
        width: 720,
        height: 1280,
      },
    },
    {
      title: inlineText("Performance"),
      description: blockText("Lorem ipsum, dolor sit amet consectetur adipisicing elit maiores impedit."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-performance.png",
        alt: "Performance chart preview",
        width: 1024,
        height: 768,
      },
    },
    {
      title: inlineText("Security"),
      description: blockText("Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png",
        alt: "Security preview",
        width: 1024,
        height: 512,
      },
    },
    {
      title: inlineText("Powerful APIs"),
      description: blockText("Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget sem sodales gravida."),
    },
  ],
}
