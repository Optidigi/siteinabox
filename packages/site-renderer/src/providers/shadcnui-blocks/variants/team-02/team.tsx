// Owned typed adaptation of upstream shadcnui-blocks team-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { team01Literal } from "../../typed/fixtures/team-01"
import { team02CmsLike } from "../../typed/fixtures/team-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderMemberBio,
  renderMemberImage,
  renderMemberName,
  renderMemberRole,
  renderTeamIntro,
  renderTeamTitle,
  sliceTeamMembers,
  type TeamMemberItem,
} from "../../typed/team-fields"

const MAX_MEMBERS = 8
const LITERAL_IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:af976",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613",
]

export type Team02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team02({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team02Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center px-6 py-8 sm:py-20 lg:px-8" {...rootAttributes}>
      <b className="font-medium text-muted-foreground text-sm uppercase">Our team</b>
      {titleContent ? <h2 className="mt-4 font-medium text-3xl tracking-[-0.04em] md:text-4xl">{titleContent}</h2> : null}
      {introContent ? (
        <p className="mt-3 text-pretty text-lg text-muted-foreground -tracking-[0.01em] sm:text-xl">{introContent}</p>
      ) : null}
      <div className="mt-14 grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:mt-20 sm:grid-cols-2 md:grid-cols-4">
        {displayMembers.map((member, itemIndex) => (
          <div key={itemIndex}>
            {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, {
              alt: member.name,
              className: "h-20 w-20 rounded-full bg-secondary object-cover",
              height: 120,
              width: 120,
            })}
            <h3 className="mt-4 font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</h3>
            <p className="text-muted-foreground text-sm">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
            <p className="mt-3 text-foreground/90">{renderMemberBio(editSlots, member.bio, blockIndex, itemIndex)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const team02Literal = { title: team02CmsLike.title, intro: team02CmsLike.intro, members: team01Literal.members }

export default function Team02Literal() {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center px-6 py-8 sm:py-20 lg:px-8">
      <b className="font-medium text-muted-foreground text-sm uppercase">Our team</b>
      <h2 className="mt-4 font-medium text-3xl tracking-[-0.04em] md:text-4xl">
        <RichTextRenderer value={team02Literal.title} blockMode="inline" />
      </h2>
      <p className="mt-3 text-pretty text-lg text-muted-foreground -tracking-[0.01em] sm:text-xl">
        <RichTextRenderer value={team02Literal.intro} blockMode="inline" />
      </p>
      <div className="mt-14 grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:mt-20 sm:grid-cols-2 md:grid-cols-4">
        {team02Literal.members.map((member, index) => (
          <div key={index}>
            <img alt={member.name} className="h-20 w-20 rounded-full bg-secondary object-cover" height={120} src={LITERAL_IMAGES[index]} width={120} />
            <h3 className="mt-4 font-medium text-lg">{member.name}</h3>
            <p className="text-muted-foreground text-sm">{member.role}</p>
            {member.bio ? <p className="mt-3 text-foreground/90"><RichTextRenderer value={member.bio} blockMode="normal" /></p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
