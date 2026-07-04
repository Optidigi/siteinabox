import type { LogoCloudBlock } from "@siteinabox/contracts"
import type { RtInlineRoot } from "@siteinabox/contracts/rich-text"

const inlineRt = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

export const tailwindPlusMarketingLogoCloudSimpleWithHeadingDemoSlots = {
  blockType: "logoCloud",
  designVariant: "tailwindPlusSimpleWithHeading",
  title: inlineRt("Trusted by the world’s most innovative teams"),
  logos: [
    {
      name: "Transistor",
      image: {
        url: "https://tailwindcss.com/plus-assets/img/logos/158x48/transistor-logo-gray-900.svg",
        alt: "Transistor",
      },
    },
    {
      name: "Reform",
      image: {
        url: "https://tailwindcss.com/plus-assets/img/logos/158x48/reform-logo-gray-900.svg",
        alt: "Reform",
      },
    },
    {
      name: "Tuple",
      image: {
        url: "https://tailwindcss.com/plus-assets/img/logos/158x48/tuple-logo-gray-900.svg",
        alt: "Tuple",
      },
    },
    {
      name: "SavvyCal",
      image: {
        url: "https://tailwindcss.com/plus-assets/img/logos/158x48/savvycal-logo-gray-900.svg",
        alt: "SavvyCal",
      },
    },
    {
      name: "Statamic",
      image: {
        url: "https://tailwindcss.com/plus-assets/img/logos/158x48/statamic-logo-gray-900.svg",
        alt: "Statamic",
      },
    },
  ],
} satisfies LogoCloudBlock
