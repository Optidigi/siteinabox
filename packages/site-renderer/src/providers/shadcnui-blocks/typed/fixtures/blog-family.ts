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

const BLOG03_LOREM =
  "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Ipsa consequatur minus dicta accusantium quos, ratione suscipit id adipisci voluptatibus. Nulla sint repudiandae fugiat tenetur dolores."

const blog03Post = (
  title: string,
  category: string,
  readTime: string,
  date: string,
): BlogPostItem => ({
  title: previewInlineText(title),
  excerpt: previewInlineText(BLOG03_LOREM),
  authorRole: category,
  readTime,
  date,
  image: previewImage(title),
  href: "https://example.test/blog/post",
})

const blog040506Post = (
  title: string,
  author: string,
  date: string,
  tags: string[],
): BlogPostItem => ({
  title: previewInlineText(title),
  author,
  date,
  tags,
  image: previewImage(title),
  href: "#",
})

const blog040506Posts = [
  blog040506Post(
    "Understanding React Server Components",
    "Jane Doe",
    "2025-06-18",
    ["React", "Server Components", "Performance"],
  ),
  blog040506Post(
    "10 Useful Shadcn UI Components You Should Know",
    "Akash Moradiya",
    "2025-05-30",
    ["Shadcn UI", "Components", "Design"],
  ),
  blog040506Post(
    "Building a Personal Blog with Next.js and Contentlayer",
    "Chris Moore",
    "2025-05-15",
    ["Next.js", "Contentlayer", "Blog"],
  ),
  blog040506Post(
    "The Complete Guide to TypeScript for Beginners",
    "Emily Johnson",
    "2025-04-25",
    ["TypeScript", "Guide"],
  ),
  blog040506Post(
    "Optimizing Web Performance with Next.js",
    "Akash Moradiya",
    "2025-04-10",
    ["Next.js", "Performance", "Optimization"],
  ),
  blog040506Post(
    "Deploying Full-Stack Apps on Vercel with Supabase",
    "John Smith",
    "2025-03-28",
    ["Supabase", "Deployment", "Full-Stack"],
  ),
]

export const blog03CmsLike = {
  title: previewInlineText("Categories"),
  posts: [
    blog03Post(
      "A beginner's guide to blockchain for engineers",
      "Technology",
      "5 min read",
      "Nov 20, 2024",
    ),
    blog03Post(
      "Understanding React Server Components",
      "Business",
      "8 min read",
      "Nov 18, 2024",
    ),
    blog03Post(
      "10 Useful Shadcn UI Components You Should Know",
      "Finance",
      "6 min read",
      "Nov 15, 2024",
    ),
    blog03Post(
      "Building a Personal Blog with Next.js",
      "Health",
      "10 min read",
      "Nov 12, 2024",
    ),
    blog03Post(
      "The Complete Guide to TypeScript for Beginners",
      "Lifestyle",
      "12 min read",
      "Nov 10, 2024",
    ),
    blog03Post(
      "Optimizing Web Performance with Next.js",
      "Politics",
      "7 min read",
      "Nov 8, 2024",
    ),
    blog03Post(
      "Deploying Full-Stack Apps on Vercel",
      "Science",
      "9 min read",
      "Nov 5, 2024",
    ),
    blog03Post(
      "Getting Started with Modern Web Development",
      "Sports",
      "11 min read",
      "Nov 2, 2024",
    ),
  ],
}

export const blog04CmsLike = {
  title: previewInlineText("Welcome to our blog!"),
  intro: previewInlineText("Stay updated with the latest news and insights."),
  cta: { label: "Subscribe to our newsletter", href: "#" },
  secondary: { label: "Load more articles", href: "#" },
  posts: blog040506Posts,
}

export const blog05CmsLike = blog04CmsLike

export const blog06CmsLike = blog04CmsLike

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
