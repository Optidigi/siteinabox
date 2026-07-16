// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { ChevronRight } from "lucide-react";
import Image from "../../runtime/image";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Card, CardContent, CardHeader } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const blogPosts = [
  {
    category: "Technology",
    title: "A beginner's guide to blockchain for engineers",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "5 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3bf03",
  },
  {
    category: "Business",
    title: "Understanding React Server Components",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "8 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2fa0b",
  },
  {
    category: "Finance",
    title: "10 Useful Shadcn UI Components You Should Know",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "6 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5b9d1",
  },
  {
    category: "Health",
    title: "Building a Personal Blog with Next.js",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "10 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5f7e8",
  },
  {
    category: "Lifestyle",
    title: "The Complete Guide to TypeScript for Beginners",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "12 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d11ce",
  },
  {
    category: "Politics",
    title: "Optimizing Web Performance with Next.js",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "7 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2dcd5",
  },
  {
    category: "Science",
    title: "Deploying Full-Stack Apps on Vercel",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "9 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:0ac53",
  },
  {
    category: "Sports",
    title: "Getting Started with Modern Web Development",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.",
    readTime: "11 min read",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:dfcf6",
  },
];

const Blog = () => {
  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-16 xl:px-0">
      <div className="flex items-end justify-between">
        <h2 className="font-medium text-[1.5rem] tracking-tight"><ProviderField field="title" fallback={<>
          Recommended Posts
        </>} inline /></h2>
        <Select defaultValue="recommended">
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="posts" templates={blogPosts}>{(providerItems) => providerItems.map((post) => (
          <Card
            className="gap-0 overflow-hidden rounded-lg py-0 shadow-none"
            key={post.title}
          >
            <CardHeader className="relative p-0">
              <div className="relative aspect-video w-full border-b">
                <Image
                  alt={post.title}
                  className="object-cover"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={post.image}
                />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/5 text-primary shadow-none hover:bg-primary/5">
                  {post.category}
                </Badge>
                <span className="font-medium text-muted-foreground text-xs">
                  {post.readTime}
                </span>
              </div>

              <h3 className="mt-4 font-medium text-[1.4rem] text-xl tracking-[-0.02em]">
                {post.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{post.description}</p>

              <Button className="mt-6 shadow-none">
                Read more <ChevronRight />
              </Button>
            </CardContent>
          </Card>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Blog;
