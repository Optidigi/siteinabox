// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
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
    title: "What is the future of web development?",
    author: "John Doe",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9678b",
    date: "Nov 30, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3bf03",
  },
  {
    category: "Business",
    title: "Understanding React Server Components",
    author: "Jane Smith",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1348f",
    date: "Nov 28, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2fa0b",
  },
  {
    category: "Finance",
    title: "10 Useful Shadcn UI Components You Should Know",
    author: "Akash Moradiya",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:be0bf",
    date: "Nov 25, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5b9d1",
  },
  {
    category: "Health",
    title: "Building a Personal Blog with Next.js",
    author: "Chris Moore",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:f4142",
    date: "Nov 22, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:5f7e8",
  },
  {
    category: "Lifestyle",
    title: "The Complete Guide to TypeScript for Beginners",
    author: "Emily Johnson",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b28c0",
    date: "Nov 20, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d11ce",
  },
  {
    category: "Politics",
    title: "Optimizing Web Performance with Next.js",
    author: "John Doe",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9678b",
    date: "Nov 18, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2dcd5",
  },
  {
    category: "Science",
    title: "Deploying Full-Stack Apps on Vercel",
    author: "Bob Smith",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:28344",
    date: "Nov 15, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:0ac53",
  },
  {
    category: "Sports",
    title: "Getting Started with Modern Web Development",
    author: "Sarah Williams",
    authorImage:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:67b8f",
    date: "Nov 12, 2024",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:dfcf6",
  },
];

const Blog = () => {
  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-16 xl:px-0">
      <div className="flex items-end justify-between">
        <h2 className="font-medium text-[1.5rem] tracking-tight">
          Today&apos;s Posts
        </h2>
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

      <div className="mt-6 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <Card className="gap-3 bg-muted/30 py-0 shadow-none" key={post.title}>
            <CardHeader className="p-1.5 pb-0">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  alt={post.title}
                  className="object-cover"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={post.image}
                />
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-5">
              <Badge variant="secondary">{post.category}</Badge>

              <h3 className="mt-4 font-medium text-[1.4rem] text-xl tracking-[-0.02em]">
                {post.title}
              </h3>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    alt={post.author}
                    className="size-8 rounded-full object-cover"
                    height={32}
                    src={post.authorImage}
                    width={32}
                  />
                  <span className="font-medium text-muted-foreground">
                    {post.author}
                  </span>
                </div>

                <span className="text-muted-foreground text-sm">
                  {post.date}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Blog;
