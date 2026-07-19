import type { MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"
import type { BlogPostItem } from "../blog-fields"

const previewImage = (alt: string): MediaRef => ({
  url: `https://cdn.example.test/${alt.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  alt,
})

export const blogPost = (
  title: string,
  excerpt: string,
  author: string,
  date: string,
  category?: string,
  readTime?: string,
): BlogPostItem => ({
  title: previewBlockText(title),
  excerpt: previewBlockText(excerpt),
  author,
  authorRole: category ?? null,
  date,
  readTime: readTime ?? null,
  image: previewImage(title),
  href: "https://example.test/blog/post",
})

export const blogFamilyCmsLike = {
  title: previewInlineText("Today's Posts"),
  posts: [
    blogPost(
      "What is the future of web development?",
      "Exploring upcoming trends in modern web stacks.",
      "John Doe",
      "Nov 30, 2024",
      "Technology",
    ),
    blogPost(
      "Understanding React Server Components",
      "A practical guide to RSC patterns.",
      "Jane Smith",
      "Nov 28, 2024",
      "Business",
    ),
    blogPost(
      "10 Useful Shadcn UI Components You Should Know",
      "Components that speed up interface work.",
      "Akash Moradiya",
      "Nov 25, 2024",
      "Finance",
    ),
    blogPost(
      "Building a Personal Blog with Next.js",
      "A practical walkthrough for a personal site.",
      "Chris Moore",
      "Nov 22, 2024",
      "Health",
    ),
    blogPost(
      "The Complete Guide to TypeScript for Beginners",
      "Start with types, inference, and narrowing.",
      "Emily Johnson",
      "Nov 20, 2024",
      "Lifestyle",
    ),
    blogPost(
      "Optimizing Web Performance with Next.js",
      "Measure, trim, and ship faster pages.",
      "John Doe",
      "Nov 18, 2024",
      "Politics",
    ),
    blogPost(
      "Deploying Full-Stack Apps on Vercel",
      "From preview to production with confidence.",
      "Bob Smith",
      "Nov 15, 2024",
      "Science",
    ),
    blogPost(
      "Getting Started with Modern Web Development",
      "Foundations for teams shipping on the web.",
      "Sarah Williams",
      "Nov 12, 2024",
      "Sports",
    ),
  ],
}

export const blogFamilySparse = {
  posts: [blogPost("Solo post", "Only one article in the feed.", "Author", "Nov 1, 2024")],
}

export const blogFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  posts: [blogPost("C".repeat(100), "D".repeat(200), "E".repeat(50), "Nov 1, 2024")],
}

export const blogFamilyEmptyItems = {
  title: previewInlineText("Blog"),
  posts: [] as BlogPostItem[],
}

export const blog04CmsLike = {
  title: previewInlineText("Welcome to our blog!"),
  intro: previewInlineText("Stay updated with the latest news and insights."),
  cta: { label: "Subscribe", href: "https://example.test/subscribe" },
  secondary: { label: "Load more articles", href: "https://example.test/blog" },
  posts: blogFamilyCmsLike.posts,
}

export const blog01CmsLike = blogFamilyCmsLike

export const blog02CmsLike = {
  title: previewInlineText("Recommended Posts"),
  posts: [
    blogPost(
      "A beginner's guide to blockchain for engineers",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "John Doe",
      "Nov 30, 2024",
      "Technology",
      "5 min read",
    ),
    blogPost(
      "Understanding React Server Components",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Jane Smith",
      "Nov 28, 2024",
      "Business",
      "8 min read",
    ),
    blogPost(
      "10 Useful Shadcn UI Components You Should Know",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Akash Moradiya",
      "Nov 25, 2024",
      "Finance",
      "6 min read",
    ),
    blogPost(
      "Building a Personal Blog with Next.js",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Chris Moore",
      "Nov 22, 2024",
      "Health",
      "10 min read",
    ),
    blogPost(
      "The Complete Guide to TypeScript for Beginners",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Emily Johnson",
      "Nov 20, 2024",
      "Lifestyle",
      "12 min read",
    ),
    blogPost(
      "Optimizing Web Performance with Next.js",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "John Doe",
      "Nov 18, 2024",
      "Politics",
      "7 min read",
    ),
    blogPost(
      "Deploying Full-Stack Apps on Vercel",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Bob Smith",
      "Nov 15, 2024",
      "Science",
      "9 min read",
    ),
    blogPost(
      "Getting Started with Modern Web Development",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
      "Sarah Williams",
      "Nov 12, 2024",
      "Sports",
      "11 min read",
    ),
  ],
}

export const blog03CmsLike = {
  title: previewInlineText("Categories"),
  posts: blogFamilyCmsLike.posts,
}
