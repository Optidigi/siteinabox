// Owned typed adaptation of upstream shadcnui-blocks team-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { team01Literal } from "../../typed/fixtures/team-01"
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
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:af976",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613",
]

export type Team01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team01({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team01Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8" {...rootAttributes}>
      <div className="mx-auto max-w-xl text-center">
        <b className="text-center font-medium text-muted-foreground text-sm uppercase">We&apos;re hiring!</b>
        {titleContent ? (
          <h2 className="mt-4 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? (
          <p className="mt-4 text-base text-muted-foreground -tracking-[0.01em] sm:text-xl">{introContent}</p>
        ) : null}
      </div>

      <div className="mx-auto mt-20 grid w-full max-w-(--breakpoint-lg) grid-cols-2 gap-12 sm:grid-cols-3 md:grid-cols-4">
        {displayMembers.map((member, itemIndex) => (
          <div className="text-center" key={itemIndex}>
            {renderMemberImage(
              editSlots,
              mediaResolver,
              member.image,
              member.name,
              blockIndex,
              itemIndex,
              {
                alt: member.name,
                className: "mx-auto h-20 w-20 rounded-full bg-secondary object-cover",
                height: 120,
                width: 120,
              },
            )}
            <h3 className="mt-5 font-medium text-lg">
              {renderMemberName(editSlots, member.name, blockIndex, itemIndex)}
            </h3>
            <p className="text-muted-foreground">
              {renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Team01Literal() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <b className="text-center font-medium text-muted-foreground text-sm uppercase">We&apos;re hiring!</b>
        <h2 className="mt-4 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
          <RichTextRenderer value={team01Literal.title} blockMode="inline" />
        </h2>
        <p className="mt-4 text-base text-muted-foreground -tracking-[0.01em] sm:text-xl">
          <RichTextRenderer value={team01Literal.intro} blockMode="inline" />
        </p>
      </div>
      <div className="mx-auto mt-20 grid w-full max-w-(--breakpoint-lg) grid-cols-2 gap-12 sm:grid-cols-3 md:grid-cols-4">
        {team01Literal.members.map((member, index) => (
          <div className="text-center" key={index}>
            <img
              alt={member.name}
              className="mx-auto h-20 w-20 rounded-full bg-secondary object-cover"
              height={120}
              src={LITERAL_IMAGES[index] ?? LITERAL_IMAGES[0]}
              width={120}
            />
            <h3 className="mt-5 font-medium text-lg">{member.name}</h3>
            <p className="text-muted-foreground">{member.role}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
