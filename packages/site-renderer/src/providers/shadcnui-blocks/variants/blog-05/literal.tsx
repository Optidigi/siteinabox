// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import { CalendarDays, Dot, Mails, User } from "lucide-react";
import Link from "../../runtime/link";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const blogPosts = [
  {
    title: "Understanding React Server Components",
    link: "about:blank#upstream-sha256:af445",
    publishedDate: "2025-06-18",
    author: "Jane Doe",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:3bf03",
    tags: ["React", "Server Components", "Performance"],
  },
  {
    title: "10 Useful Shadcn UI Components You Should Know",
    link: "about:blank#upstream-sha256:1e79f",
    publishedDate: "2025-05-30",
    author: "Akash Moradiya",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:2fa0b",
    tags: ["Shadcn UI", "Components", "Design"],
  },
  {
    title: "Building a Personal Blog with Next.js and Contentlayer",
    link: "about:blank#upstream-sha256:72e20",
    publishedDate: "2025-05-15",
    author: "Chris Moore",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:5b9d1",
    tags: ["Next.js", "Contentlayer", "Blog"],
  },
  {
    title: "The Complete Guide to TypeScript for Beginners",
    link: "about:blank#upstream-sha256:0affe",
    publishedDate: "2025-04-25",
    author: "Emily Johnson",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:5f7e8",
    tags: ["TypeScript", "Guide"],
  },
  {
    title: "Optimizing Web Performance with Next.js",
    link: "about:blank#upstream-sha256:cb0cb",
    publishedDate: "2025-04-10",
    author: "Akash Moradiya",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:d11ce",
    tags: ["Next.js", "Performance", "Optimization"],
  },
  {
    title: "Deploying Full-Stack Apps on Vercel with Supabase",
    link: "about:blank#upstream-sha256:28697",
    publishedDate: "2025-03-28",
    author: "John Smith",
    image:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:2dcd5",
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {blogPosts.map((post) => (
          <Link href={post.link} key={post.link}>
            <div className="flex flex-col gap-x-6 gap-y-4 rounded-xl bg-muted p-2.5 pb-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:pe-4 sm:pb-3">
              <Image
                alt={post.title}
                className="aspect-video w-full rounded-lg bg-muted object-cover sm:aspect-square sm:max-w-40"
                src={post.image}
              />
              <div className="px-1 sm:px-0">
                <h3 className="font-medium text-xl tracking-[-0.015em]">
                  {post.title}
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {post.tags.map((tag) => (
                    <Badge
                      className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400"
                      key={tag}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <CalendarDays className="h-4 w-4" />{" "}
                    {formatDate(post.publishedDate)}
                  </div>
                  <Dot className="text-muted-foreground" />
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <User className="h-4 w-4" /> {post.author}
                  </div>
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
