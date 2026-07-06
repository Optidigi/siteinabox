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
      excerpt: blockRt("Illo sint voluptas. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus unde. Sed exercitationem placeat consectetur nulla deserunt vel. Iusto corrupti dicta."),
      href: "#",
      date: "Mar 16, 2020",
      author: "Michael Foster",
      authorRole: "Co-Founder / CTO",
      cta: { label: "Marketing", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Michael Foster" },
    },
    {
      title: inlineRt("How to use search engine optimization to drive sales"),
      excerpt: blockRt("Optio cum necessitatibus dolor voluptatum provident commodi et. Qui aperiam fugiat nemo cumque."),
      href: "#",
      date: "Mar 10, 2020",
      author: "Lindsay Walton",
      authorRole: "Front-end Developer",
      cta: { label: "Sales", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Lindsay Walton" },
    },
    {
      title: inlineRt("Improve your customer experience"),
      excerpt: blockRt("Cupiditate maiores ullam eveniet adipisci in doloribus nulla minus. Voluptas iusto libero adipisci rem et corporis. Nostrud sint anim sunt aliqua. Nulla eu labore irure incididunt velit cillum quis magna dolore."),
      href: "#",
      date: "Feb 12, 2020",
      author: "Tom Cook",
      authorRole: "Director of Product",
      cta: { label: "Business", href: "#" },
      image: { url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80", alt: "Tom Cook" },
    },
  ],
} satisfies BlogCardsBlock
