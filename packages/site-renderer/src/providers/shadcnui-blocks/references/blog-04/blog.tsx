// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import { ArrowRight, CalendarDays, Mails } from "lucide-react";
import Link from "../../runtime/link";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const blogPosts = [
  {
    title: "Understanding React Server Components",
    link: "#",
    publishedDate: "2025-06-18",
    author: "Jane Doe",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3bf03",
    tags: ["React", "Server Components", "Performance"],
  },
  {
    title: "10 Useful Shadcn UI Components You Should Know",
    link: "#",
    publishedDate: "2025-05-30",
    author: "Akash Moradiya",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2fa0b",
    tags: ["Shadcn UI", "Components", "Design"],
  },
  {
    title: "Building a Personal Blog with Next.js and Contentlayer",
    link: "#",
    publishedDate: "2025-05-15",
    author: "Chris Moore",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5b9d1",
    tags: ["Next.js", "Contentlayer", "Blog"],
  },
  {
    title: "The Complete Guide to TypeScript for Beginners",
    link: "#",
    publishedDate: "2025-04-25",
    author: "Emily Johnson",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5f7e8",
    tags: ["TypeScript", "Guide"],
  },
  {
    title: "Optimizing Web Performance with Next.js",
    link: "#",
    publishedDate: "2025-04-10",
    author: "Akash Moradiya",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d11ce",
    tags: ["Next.js", "Performance", "Optimization"],
  },
  {
    title: "Deploying Full-Stack Apps on Vercel with Supabase",
    link: "#",
    publishedDate: "2025-03-28",
    author: "John Smith",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2dcd5",
    tags: ["Supabase", "Deployment", "Full-Stack"],
  },
];

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Blog() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-balance font-medium text-2xl tracking-tight">
            Welcome to our blog!
          </h2>
          <p className="mt-0.5 text-pretty text-lg text-muted-foreground tracking-normal">
            Stay updated with the latest news and insights.
          </p>
        </div>
        <Button
          className="hidden gap-3 sm:inline-flex"
          size="lg"
          variant="secondary"
        >
          <Mails />
          <span className="hidden lg:inline">Subscribe to our newsletter</span>
          <span className="hidden md:inline lg:hidden">Subscribe</span>
        </Button>
      </div>

      <Separator className="mt-7 mb-10" />

      <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post, index) => (
          <Link href={post.link} key={`${post.link}-${index}`}>
            <div>
              <Image
                alt={post.title}
                className="aspect-[14/9] rounded-lg bg-muted"
                src={post.image}
              />
              <div className="px-1">
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h3 className="mt-3 font-medium text-xl">{post.title}</h3>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <CalendarDays className="size-4" />{" "}
                    {formatDate(post.publishedDate)}
                  </div>
                  <Button className="-me-2" variant="ghost">
                    Read Article <ArrowRight />
                  </Button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Button className="mx-auto mt-16 flex" size="lg" variant="secondary">
        Load more articles
      </Button>
    </section>
  );
}
