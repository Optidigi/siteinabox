import type { BlogCardsBlock } from "@siteinabox/contracts"
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

export const tailwindPlusMarketingBlogThreeColumnDemoSlots = {
  blockType: "blogCards",
  designVariant: "tailwindplus.marketing.blog.three-column",
  title: inlineRt("From the blog"),
  intro: blockRt("Learn how to grow your business with our expert advice."),
  posts: [
    {
      title: inlineRt("Boost your conversion rate"),
      excerpt: blockRt("Illo sint voluptas. Error voluptates culpa eligendi. Hic vel totam vitae illo."),
      href: "#",
      date: "Mar 16, 2020",
      author: "Michael Foster",
      cta: { label: "Marketing", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Michael Foster" },
    },
    {
      title: inlineRt("How to use search engine optimization to drive sales"),
      excerpt: blockRt("Optio cum necessitatibus dolor voluptatum provident commodi et."),
      href: "#",
      date: "Mar 10, 2020",
      author: "Lindsay Walton",
      cta: { label: "Sales", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Lindsay Walton" },
    },
    {
      title: inlineRt("Improve your customer experience"),
      excerpt: blockRt("Cupiditate maiores ullam eveniet adipisci in doloribus nulla minus."),
      href: "#",
      date: "Feb 12, 2020",
      author: "Tom Cook",
      cta: { label: "Business", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Tom Cook" },
    },
  ],
} satisfies BlogCardsBlock
