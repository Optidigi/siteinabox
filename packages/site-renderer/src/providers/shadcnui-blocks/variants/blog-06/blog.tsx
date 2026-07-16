// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { ArrowRight, CalendarDays, Dot, Mails, User } from "lucide-react";
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
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3bf03",
    tags: ["React", "Server Components", "Performance"],
  },
  {
    title: "10 Useful Shadcn UI Components You Should Know",
    link: "about:blank#upstream-sha256:1e79f",
    publishedDate: "2025-05-30",
    author: "Akash Moradiya",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2fa0b",
    tags: ["Shadcn UI", "Components", "Design"],
  },
  {
    title: "Building a Personal Blog with Next.js and Contentlayer",
    link: "about:blank#upstream-sha256:72e20",
    publishedDate: "2025-05-15",
    author: "Chris Moore",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5b9d1",
    tags: ["Next.js", "Contentlayer", "Blog"],
  },
  {
    title: "The Complete Guide to TypeScript for Beginners",
    link: "about:blank#upstream-sha256:0affe",
    publishedDate: "2025-04-25",
    author: "Emily Johnson",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5f7e8",
    tags: ["TypeScript", "Guide"],
  },
  {
    title: "Optimizing Web Performance with Next.js",
    link: "about:blank#upstream-sha256:cb0cb",
    publishedDate: "2025-04-10",
    author: "Akash Moradiya",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d11ce",
    tags: ["Next.js", "Performance", "Optimization"],
  },
  {
    title: "Deploying Full-Stack Apps on Vercel with Supabase",
    link: "about:blank#upstream-sha256:28697",
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
          <h2 className="text-balance font-medium text-2xl tracking-tight"><ProviderField field="title" fallback={<>
            Welcome to our blog!
          </>} inline /></h2>
          <p className="mt-0.5 text-pretty text-lg text-muted-foreground tracking-normal"><ProviderField field="intro" fallback={<>
            Stay updated with the latest news and insights.
          </>} inline /></p>
        </div>
        <Button
          className="hidden gap-3 sm:inline-flex"
          size="lg"
          variant="secondary"
         asChild><ProviderAction field="cta" fallback={<><span className="hidden lg:inline">Subscribe to our newsletter</span><span className="hidden md:inline lg:hidden">Subscribe</span></>} decoration="before"><Mails /></ProviderAction></Button>
      </div>

      <Separator className="mt-7 mb-10" />

      <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="posts" templates={blogPosts}>{(providerItems) => providerItems.map((post) => (
          <Link href={post.link} key={post.link}>
            <div className="overflow-hidden rounded-xl bg-muted p-2 pb-4">
              <div className="relative isolate">
                <Image
                  alt={post.title}
                  className="aspect-[14/9] rounded-lg bg-muted"
                  src={post.image}
                />
                <Image
                  alt={post.title}
                  className="absolute inset-0 -z-10 aspect-17/9 scale-y-110 rounded-sm bg-muted blur-2xl"
                  src={post.image}
                />
              </div>
              <div className="px-2 py-1">
                <div className="-ms-0.5 mt-4 flex flex-wrap items-center gap-2">
                  {post.tags.map((tag) => (
                    <Badge
                      className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                      key={tag}
                      variant="secondary"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h3 className="mt-4 font-medium text-xl tracking-[-0.015em]">
                  {post.title}
                </h3>
                <div className="mt-3 flex items-center gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <CalendarDays className="h-4 w-4" />{" "}
                    {formatDate(post.publishedDate)}
                  </div>
                  <Dot className="text-muted-foreground" />
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <User className="h-4 w-4" /> {post.author}
                  </div>
                </div>

                <Button className="mt-6">
                  Read Article <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Link>
        ))}</ProviderItems>}
      </div>

      <Button className="mx-auto mt-16 flex" size="lg" variant="secondary" asChild><ProviderAction field="secondary" fallback={"Load more articles"} decoration="after"></ProviderAction></Button>
    </section>
  );
}
