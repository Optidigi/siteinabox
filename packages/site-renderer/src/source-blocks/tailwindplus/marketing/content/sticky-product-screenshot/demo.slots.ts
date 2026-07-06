import type { ContentSectionBlock } from "@siteinabox/contracts"

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

export const tailwindPlusMarketingContentStickyProductScreenshotDemoSlots: ContentSectionBlock = {
  blockType: "contentSection",
  designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
  anchor: "workflow",
  eyebrow: inlineText("Deploy faster"),
  title: inlineText("A better workflow"),
  intro: blockText("Aliquet nec orci mattis amet quisque ullamcorper neque, nibh sem. At arcu, sit dui mi, nibh dui, diam eget aliquam. Quisque id at vitae feugiat egestas."),
  body: blockText("Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae sed turpis id. Id dolor praesent donec est. Odio penatibus risus viverra tellus varius sit neque erat velit. Faucibus commodo massa rhoncus, volutpat. Dignissim sed eget risus enim. Mattis mauris semper sed amet vitae sed turpis id."),
  image: {
    url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
    alt: "Product workflow screenshot",
    width: 1824,
    height: 1080,
  },
  features: [
    {
      title: inlineText("Push to deploy."),
      description: blockText("Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione."),
      icon: "cloud-arrow-up",
    },
    {
      title: inlineText("SSL certificates."),
      description: blockText("Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo."),
      icon: "lock-closed",
    },
    {
      title: inlineText("Database backups."),
      description: blockText("Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus. Et magna sit morbi lobortis."),
      icon: "server",
    },
  ],
  secondaryTitle: inlineText("No server? No problem."),
  secondaryBody: blockText("Id orci tellus laoreet id ac. Dolor, aenean leo, ac etiam consequat in. Convallis arcu ipsum urna nibh. Pharetra, euismod vitae interdum mauris enim, consequat vulputate nibh. Maecenas pellentesque id sed tellus mauris, ultrices mauris. Tincidunt enim cursus ridiculus mi. Pellentesque nam sed nullam sed diam turpis ipsum eu a sed convallis diam."),
}
