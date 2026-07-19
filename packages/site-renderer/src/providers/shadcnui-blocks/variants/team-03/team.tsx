// Owned typed adaptation of upstream shadcnui-blocks team-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { DribbbleIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderMemberBio,
  renderMemberImage,
  renderMemberLink,
  renderMemberName,
  renderMemberRole,
  renderTeamIntro,
  renderTeamTitle,
  sliceTeamMembers,
  type TeamMemberItem,
} from "../../typed/team-fields"
const MAX_MEMBERS = 6

export type Team03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team03({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team03Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-14 px-6 py-20 lg:flex-row lg:px-8" {...rootAttributes}>
      <div className="sm:max-w-sm lg:max-w-xs">
        <b className="font-medium text-muted-foreground text-sm uppercase">Our team</b>
        {titleContent ? <h2 className="mt-3 font-medium text-3xl tracking-[-0.04em] md:text-4xl">{titleContent}</h2> : null}
        {introContent ? <p className="mt-4 text-base text-foreground/80 sm:text-lg">{introContent}</p> : null}
      </div>
      <div className="grid w-full grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
        {displayMembers.map((member, itemIndex) => (
          <div className="flex items-start gap-4 md:flex-col" key={itemIndex}>
            {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, { alt: member.name, className: "h-16 w-16 shrink-0 rounded-full bg-secondary object-cover sm:h-20 sm:w-20", height: 120, width: 120 })}
            <div>
              <h3 className="font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</h3>
              <p className="text-muted-foreground text-sm">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
              <p className="mt-2 text-foreground/90">{renderMemberBio(editSlots, member.bio, blockIndex, itemIndex)}</p>
              <div className="mt-4 flex items-center gap-2.5">
                {renderMemberLink(member.links?.[0], (
                  <Button asChild size="icon" variant="secondary">
                    <a href="#"><TwitterIcon className="stroke-muted-foreground" /></a>
                  </Button>
                ))}
                {renderMemberLink(member.links?.[1], (
                  <Button asChild size="icon" variant="secondary">
                    <a href="#"><DribbbleIcon className="stroke-muted-foreground" /></a>
                  </Button>
                ))}
                {renderMemberLink(member.links?.[2], (
                  <Button asChild size="icon" variant="secondary">
                    <a href="#"><TwitchIcon className="stroke-muted-foreground" /></a>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { DribbbleIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons"
import { team03CmsLike } from "../../typed/fixtures/team-family"
import { team01Literal } from "../../typed/fixtures/team-01"

const IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:af976",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613"
]
const literal = { title: team03CmsLike.title, intro: team03CmsLike.intro, members: team01Literal.members.slice(0, 6) }

export default function Team03Literal() {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-14 px-6 py-20 lg:flex-row lg:px-8">
      <div className="sm:max-w-sm lg:max-w-xs">
        <b className="font-medium text-muted-foreground text-sm uppercase">Our team</b>
        <h2 className="mt-3 font-medium text-3xl tracking-[-0.04em] md:text-4xl"><RichTextRenderer value={literal.title} blockMode="inline" /></h2>
        <p className="mt-4 text-base text-foreground/80 sm:text-lg"><RichTextRenderer value={literal.intro} blockMode="inline" /></p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
          <Button size="lg">Open Positions</Button>
          <Button size="lg" variant="outline">About Us</Button>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
        {literal.members.map((member, index) => (
          <div className="flex items-start gap-4 md:flex-col" key={index}>
            <img alt={member.name} className="h-16 w-16 shrink-0 rounded-full bg-secondary object-cover sm:h-20 sm:w-20" height={120} src={IMAGES[index]} width={120} />
            <div>
              <h3 className="font-medium text-lg">{member.name}</h3>
              <p className="text-muted-foreground text-sm">{member.role}</p>
              {member.bio ? <p className="mt-2 text-foreground/90"><RichTextRenderer value={member.bio} blockMode="normal" /></p> : null}
              <div className="mt-4 flex items-center gap-2.5">
                <Button asChild size="icon" variant="secondary"><a href="#"><TwitterIcon className="stroke-muted-foreground" /></a></Button>
                <Button asChild size="icon" variant="secondary"><a href="#"><DribbbleIcon className="stroke-muted-foreground" /></a></Button>
                <Button asChild size="icon" variant="secondary"><a href="#"><TwitchIcon className="stroke-muted-foreground" /></a></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
