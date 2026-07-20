// Owned typed adaptation of upstream shadcnui-blocks team-10 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { Dribbble, Github, Twitter } from "../../runtime/social-icons"
import { team06CmsLike } from "../../typed/fixtures/team-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderMemberImage,
  renderMemberLink,
  renderMemberName,
  renderMemberRole,
  renderTeamIntro,
  renderTeamTitle,
  sliceTeamMembers,
  type TeamMemberItem,
} from "../../typed/team-fields"

const MAX_MEMBERS = 8
const LITERAL_IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4da3c",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4d5d6",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
]
const LITERAL_MEMBERS = [
  ["Liam Martinez", "Chief Executive Officer"],
  ["Ava Thompson", "Chief Technology Officer"],
  ["Sophia Patel", "Head of Design"],
  ["Noah Chen", "Product Manager"],
  ["Emma Garcia", "Software Engineer"],
  ["Ethan Kim", "DevOps Engineer"],
  ["Mia Johnson", "Marketing Lead"],
  ["Oliver Singh", "Customer Success Manager"],
]

export type Team10Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team10({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team10Props) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [count, setCount] = React.useState(0)
  const [current, setCurrent] = React.useState(0)
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])

  return (
    <div className="mx-auto max-w-7xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-14">
        <Carousel opts={{ align: "start" }} setApi={setApi}>
          <CarouselContent>
            {displayMembers.map((member, itemIndex) => (
              <CarouselItem className="sm:basis-1/2 md:basis-1/3 lg:basis-1/4" key={itemIndex}>
                <div className="border bg-muted py-12 border-border">
                  <div className="mx-auto aspect-square max-w-40 select-none overflow-hidden rounded-full bg-muted">
                    {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, {
                      alt: member.name,
                      className: "h-full w-full object-cover",
                    })}
                  </div>
                  <p className="mt-6 text-center font-medium text-lg">
                    {renderMemberName(editSlots, member.name, blockIndex, itemIndex)}
                  </p>
                  <p className="mt-0.5 text-center text-muted-foreground">
                    {renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-4">
                    {renderMemberLink(member.links?.[0], (
                      <a href="#"><Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
                    ))}
                    {renderMemberLink(member.links?.[1], (
                      <a href="#"><Github className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
                    ))}
                    {renderMemberLink(member.links?.[2], (
                      <a href="#"><Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
                    ))}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
          <div className="mt-6 flex items-center justify-center gap-2">
            {Array.from({ length: count }).map((_, index) => (
              <div
                className={cn("h-2 w-2 rounded-full", current === index + 1 ? "bg-primary" : "bg-primary/20")}
                key={index}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </div>
  )
}

export default function Team10Literal() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
        <RichTextRenderer value={team06CmsLike.title} blockMode="inline" />
      </h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
        <RichTextRenderer value={team06CmsLike.intro} blockMode="inline" />
      </p>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {LITERAL_MEMBERS.map(([name, role], index) => (
          <div className="border bg-muted py-12 border-border" key={index}>
            <div className="mx-auto aspect-square max-w-40 overflow-hidden rounded-full bg-muted">
              <img alt={name} className="h-full w-full object-cover" src={LITERAL_IMAGES[index]} />
            </div>
            <p className="mt-6 text-center font-medium text-lg">{name}</p>
            <p className="mt-0.5 text-center text-muted-foreground">{role}</p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <a href="#"><Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
              <a href="#"><Github className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
              <a href="#"><Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
