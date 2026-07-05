import type { BlogCardsBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingBlogThreeColumnRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_NAMESPACE = "tailwindplus.marketing.blog"
export const TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_ID = "tailwindplus.marketing.blog.three-column"
export const TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_LEGACY_VARIANT = "tailwindPlusThreeColumn"

export const tailwindPlusMarketingBlogThreeColumnProviderBlock = defineProviderBlock<BlogCardsBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_ID,
  blockType: "blogCards",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_BLOG_THREE_COLUMN_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-blog-three-column",
  renderer: TailwindPlusMarketingBlogThreeColumnRenderer,
  slots: {
    title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
    intro: { kind: "richtext", status: "optional", exposed: true, sourceField: "intro" },
    posts: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "posts",
      minItems: 3,
      maxItems: 3,
    },
    postTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "posts.title" },
    postExcerpt: { kind: "richtext", status: "required", exposed: true, sourceField: "posts.excerpt" },
    postHref: { kind: "text", status: "required", exposed: true, sourceField: "posts.href" },
    postDate: { kind: "text", status: "optional", exposed: true, sourceField: "posts.date" },
    postAuthor: { kind: "text", status: "optional", exposed: true, sourceField: "posts.author" },
    postCategory: { kind: "cta", status: "optional", exposed: true, sourceField: "posts.cta" },
    postAuthorImage: { kind: "image", status: "optional", exposed: true, sourceField: "posts.image" },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/blog-sections",
    sourceComponent: "Marketing / Page Sections / Blog Sections / Three-column",
    sourceHash: "sha256:437980b5554ab8a2666d52680ff82c2da5728f76aa79f514bd0c44fdc6a1df01",
    capturedAt: "2026-07-05",
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
  },
})
