// Owned typed adaptation of upstream shadcnui-blocks team-11 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { team06CmsLike } from "../../typed/fixtures/team-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
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
  ["Liam Martinez", "Chief Technology Officer"],
  ["Ava Thompson", "Chief Executive Officer"],
  ["Sophia Patel", "Head of Design"],
  ["Noah Chen", "Product Manager"],
  ["Emma Garcia", "Software Engineer"],
  ["Ethan Kim", "DevOps Engineer"],
  ["Mia Johnson", "Marketing Lead"],
  ["Oliver Singh", "Customer Success Manager"],
]

export type Team11Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team11({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team11Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

  return (
    <div className="mx-auto max-w-7xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-10 max-sm:justify-center sm:mt-18 sm:grid-cols-2 lg:grid-cols-3">
        {displayMembers.map((member, itemIndex) => (
          <div className="flex items-center gap-x-6 gap-y-10" key={itemIndex}>
            <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-lg">
              {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, {
                alt: member.name,
                className: "h-full w-full object-cover",
              })}
            </div>
            <div>
              <p className="font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</p>
              <p className="text-muted-foreground">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Team11Literal() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
        <RichTextRenderer value={team06CmsLike.title} blockMode="inline" />
      </h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
        <RichTextRenderer value={team06CmsLike.intro} blockMode="inline" />
      </p>
      <div className="mt-12 grid grid-cols-1 gap-10 max-sm:justify-center sm:mt-18 sm:grid-cols-2 lg:grid-cols-3">
        {LITERAL_MEMBERS.map(([name, role], index) => (
          <div className="flex items-center gap-x-6 gap-y-10" key={index}>
            <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-lg">
              <img alt={name} className="h-full w-full object-cover" src={LITERAL_IMAGES[index]} />
            </div>
            <div>
              <p className="font-medium text-lg">{name}</p>
              <p className="text-muted-foreground">{role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
