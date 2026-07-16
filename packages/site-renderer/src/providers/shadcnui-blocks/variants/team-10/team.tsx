// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { Dribbble, Github, Twitter } from "../../runtime/social-icons";
import Link from "../../runtime/link";
import React from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { cn } from "@siteinabox/ui/lib/utils";

const teamMembers = [
  {
    name: "Liam Martinez",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883",
    role: "Chief Executive Officer",
  },
  {
    name: "Ava Thompson",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9",
    role: "Chief Technology Officer",
  },
  {
    name: "Sophia Patel",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5",
    role: "Head of Design",
  },
  {
    name: "Noah Chen",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4da3c",
    role: "Product Manager",
  },
  {
    name: "Emma Garcia",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4",
    role: "Software Engineer",
  },
  {
    name: "Ethan Kim",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121",
    role: "DevOps Engineer",
  },
  {
    name: "Mia Johnson",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4d5d6",
    role: "Marketing Lead",
  },
  {
    name: "Oliver Singh",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
    role: "Customer Success Manager",
  },
];

const Team = () => {
  const [api, setApi] = React.useState<CarouselApi | null>(null);
  const [count, setCount] = React.useState(0);
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Our core team
      </>} inline /></h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl"><ProviderField field="intro" fallback={<>
        Passionate people building great products
      </>} inline /></p>

      <div className="mt-14">
        <Carousel
          opts={{
            align: "start",
          }}
          setApi={setApi}
        >
          <CarouselContent>
            {<ProviderItems field="members" templates={teamMembers}>{(providerItems) => providerItems.map((member, index) => (
              <CarouselItem
                className="sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                key={index}
              >
                <div className="border bg-muted py-12">
                  <div className="mx-auto aspect-square max-w-40 select-none overflow-hidden rounded-full bg-muted">
                    <Image alt={member.name} src={member.image} />
                  </div>
                  <p className="mt-6 text-center font-medium text-lg">
                    {member.name}
                  </p>
                  <p className="mt-0.5 text-center text-muted-foreground">
                    {member.role}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-4">
                    <ProviderItemLink value={member.links?.[0]} fallback={<><Link href="#" target="_blank">
                      <Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    </Link></>} />
                    <ProviderItemLink value={member.links?.[1]} fallback={<><Link href="#" target="_blank">
                      <Github className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    </Link></>} />
                    <ProviderItemLink value={member.links?.[2]} fallback={<><Link href="#" target="_blank">
                      <Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    </Link></>} />
                  </div>
                </div>
              </CarouselItem>
            ))}</ProviderItems>}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />

          <div className="mt-6 flex items-center justify-center gap-2">
            {Array.from({ length: count }).map((_, index) => (
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  current === index + 1 ? "bg-primary" : "bg-primary/20"
                )}
                key={index}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </div>
  );
};

export default Team;
