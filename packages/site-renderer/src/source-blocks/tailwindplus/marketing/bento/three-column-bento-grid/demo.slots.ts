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
  intro: blockText("Everything you need to publish and operate a generated site."),
  items: [
    {
      title: inlineText("Mobile friendly"),
      description: blockText("Responsive provider layout remains fixed while the card copy stays editable."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png",
        alt: "Mobile app preview",
        width: 720,
        height: 1280,
      },
    },
    {
      title: inlineText("Performance"),
      description: blockText("Public snapshots are rendered by the shared runtime without tenant source builds."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-performance.png",
        alt: "Performance chart preview",
        width: 1024,
        height: 768,
      },
    },
    {
      title: inlineText("Security"),
      description: blockText("Provider blocks fail closed and generated data cannot inject code or classes."),
      image: {
        url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png",
        alt: "Security preview",
        width: 1024,
        height: 512,
      },
    },
    {
      title: inlineText("Powerful APIs"),
      description: blockText("CMS, preview, and renderer orchestration stay platform-owned."),
    },
  ],
}
