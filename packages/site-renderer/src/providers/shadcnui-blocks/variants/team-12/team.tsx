// Owned typed adaptation of upstream shadcnui-blocks team-12 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { team12CmsLike } from "../../typed/fixtures/team-family"
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

const MAX_MEMBERS = 9
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
const LITERAL_MEMBERS: Array<{ name: string; role: string; isPlaceholder?: boolean }> = [
  { name: "Liam Martinez", role: "Chief Technology Officer" },
  { name: "Ava Thompson", role: "Chief Executive Officer" },
  { name: "Sophia Patel", role: "Head of Design" },
  { name: "Noah Chen", role: "Product Manager" },
  { name: "Emma Garcia", role: "Software Engineer" },
  { name: "Ethan Kim", role: "DevOps Engineer" },
  { name: "Mia Johnson", role: "Marketing Lead" },
  { name: "Oliver Singh", role: "Customer Success Manager" },
  { name: "Your Name", role: "Your Dream Role", isPlaceholder: true },
]

export type Team12Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  members: TeamMemberItem[]
  mediaResolver?: MediaResolver
}

export function Team12({
  title,
  intro,
  members,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Team12Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)

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
      <div className="mt-12 grid grid-cols-1 border border-e-0 border-b-0 max-sm:justify-center sm:mt-18 sm:grid-cols-2 lg:grid-cols-3">
        {displayMembers.map((member, itemIndex) => (
          <div className="flex items-center gap-6 border-e border-b p-4" key={itemIndex}>
            <div className="aspect-square w-20 shrink-0 overflow-hidden rounded bg-foreground/10 dark:bg-muted/75">
              {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, {
                alt: member.name,
                className: "h-full w-full object-cover",
                height: 80,
                width: 80,
              })}
            </div>
            <div>
              <p className="font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</p>
              <p className="mt-0.5 text-muted-foreground">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Team12Literal() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
        <RichTextRenderer value={team12CmsLike.title} blockMode="inline" />
      </h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
        <RichTextRenderer value={team12CmsLike.intro} blockMode="inline" />
      </p>
      <div className="mt-12 grid grid-cols-1 border border-e-0 border-b-0 max-sm:justify-center sm:mt-18 sm:grid-cols-2 lg:grid-cols-3">
        {LITERAL_MEMBERS.map((member, index) => (
          <div
            className={cn("flex items-center gap-6 border-e border-b p-4", {
              "bg-[repeating-linear-gradient(315deg,color-mix(in_srgb,var(--muted),transparent_50%)_0,color-mix(in_srgb,var(--muted),transparent_50%)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed":
                member.isPlaceholder,
            })}
            key={index}
          >
            <div className="aspect-square w-20 shrink-0 overflow-hidden rounded bg-foreground/10 dark:bg-muted/75">
              {member.isPlaceholder ? null : (
                <img alt={member.name} className="h-full w-full object-cover" height={80} src={LITERAL_IMAGES[index]} width={80} />
              )}
            </div>
            <div>
              <p className="font-medium text-lg">{member.name}</p>
              <p className="mt-0.5 text-muted-foreground">{member.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
