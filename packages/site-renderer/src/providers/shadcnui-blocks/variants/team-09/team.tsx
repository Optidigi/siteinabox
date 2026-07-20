// Owned typed adaptation of upstream shadcnui-blocks team-09 (MIT, see ../../LICENSE).
"use client"
import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { Dribbble, Github, Twitter } from "../../runtime/social-icons"
import { teamFamilyCmsLike } from "../../typed/fixtures/team-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { renderMemberBio, renderMemberImage, renderMemberLink, renderMemberName, renderMemberRole, renderTeamIntro, renderTeamTitle, sliceTeamMembers, type TeamMemberItem } from "../../typed/team-fields"
const MAX_MEMBERS = 8
export type Team09Props = TypedVariantBaseProps & { title?: RtRoot | null; intro?: RtRoot | null; members: TeamMemberItem[]; mediaResolver?: MediaResolver }
export function Team09({ title, intro, members, blockIndex, editSlots, mediaResolver, rootAttributes }: Team09Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)
  return (
    <div className="mx-auto max-w-7xl px-6 py-20" {...rootAttributes}>
      {titleContent ? <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">{titleContent}</h2> : null}
      {introContent ? <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">{introContent}</p> : null}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayMembers.map((member, itemIndex) => (
          <div className="border bg-muted py-8 border-border" key={itemIndex}>
            <div className="mx-auto aspect-square max-w-48 overflow-hidden rounded-full bg-muted">{renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, { alt: member.name, className: "h-full w-full object-cover" })}</div>
            <p className="mt-6 text-center font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</p>
            <p className="mt-0.5 text-center text-muted-foreground">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
            <div className="mt-6 flex items-center justify-center gap-4">
              {renderMemberLink(member.links?.[0], (<a href="#"><Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>))}
              {renderMemberLink(member.links?.[1], (<a href="#"><Github className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>))}
              {renderMemberLink(member.links?.[2], (<a href="#"><Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary" /></a>))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const I=["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4da3c","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4d5d6","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8"]
const F=[["Liam Martinez","Chief Technology Officer"],["Ava Thompson","Chief Executive Officer"],["Sophia Patel","Head of Design"],["Noah Chen","Product Manager"],["Emma Garcia","Software Engineer"],["Ethan Kim","DevOps Engineer"],["Mia Johnson","Marketing Lead"],["Oliver Singh","Customer Success Manager"]]
export default function Team09Literal(){return(<div className="mx-auto max-w-7xl px-6 py-20"><h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]"><RichTextRenderer value={teamFamilyCmsLike.title} blockMode="inline"/></h2><p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl"><RichTextRenderer value={teamFamilyCmsLike.intro} blockMode="inline"/></p><div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{F.map((m,i)=>(<div className="border bg-muted py-8 border-border" key={i}><div className="mx-auto aspect-square max-w-48 overflow-hidden rounded-full bg-muted"><img alt={m[0]} className="h-full w-full object-cover" src={I[i]}/></div><p className="mt-6 text-center font-medium text-lg">{m[0]}</p><p className="mt-0.5 text-center text-muted-foreground">{m[1]}</p><div className="mt-6 flex items-center justify-center gap-4"><a href="#"><Twitter className="h-5 w-5 text-muted-foreground hover:text-primary"/></a><a href="#"><Github className="h-5 w-5 text-muted-foreground hover:text-primary"/></a><a href="#"><Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary"/></a></div></div>))}</div></div>)}
