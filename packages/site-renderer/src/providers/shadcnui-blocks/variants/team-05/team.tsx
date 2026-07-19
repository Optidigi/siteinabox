// Owned typed adaptation of upstream shadcnui-blocks team-05 (MIT, see ../../LICENSE).
"use client"
import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { RichTextRenderer } from "../../../../rich-text"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { DribbbleIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons"
import { team01Literal } from "../../typed/fixtures/team-01"
import { team03CmsLike } from "../../typed/fixtures/team-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { renderMemberBio, renderMemberImage, renderMemberLink, renderMemberName, renderMemberRole, renderTeamIntro, renderTeamTitle, sliceTeamMembers, type TeamMemberItem } from "../../typed/team-fields"
const MAX_MEMBERS = 8
export type Team05Props = TypedVariantBaseProps & { title?: RtRoot | null; intro?: RtRoot | null; members: TeamMemberItem[]; mediaResolver?: MediaResolver }
export function Team05({ title, intro, members, blockIndex, editSlots, mediaResolver, rootAttributes }: Team05Props) {
  const titleContent = renderTeamTitle(editSlots, title, blockIndex)
  const introContent = renderTeamIntro(editSlots, intro, blockIndex)
  const displayMembers = sliceTeamMembers(members, MAX_MEMBERS)
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-16 px-6 py-20 lg:px-8" {...rootAttributes}>
      <div className="mx-auto max-w-2xl text-center">
        <b className="text-center font-medium text-muted-foreground text-sm uppercase">We&apos;re hiring!</b>
        {titleContent ? <h2 className="mt-3 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2> : null}
        {introContent ? <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-xl">{introContent}</p> : null}
      </div>
      <div className="grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-4">
        {displayMembers.map((member, itemIndex) => (
          <div key={itemIndex}>
            {renderMemberImage(editSlots, mediaResolver, member.image, member.name, blockIndex, itemIndex, { alt: member.name, className: "aspect-square w-full rounded-lg bg-secondary object-cover", height: 600, width: 600 })}
            <h3 className="mt-4 font-medium text-lg">{renderMemberName(editSlots, member.name, blockIndex, itemIndex)}</h3>
            <p className="text-muted-foreground text-sm">{renderMemberRole(editSlots, member.role, blockIndex, itemIndex)}</p>
            <div className="mt-3">{renderMemberBio(editSlots, member.bio, blockIndex, itemIndex)}</div>
              <div className="mt-6 flex items-center gap-2.5">
                {renderMemberLink(member.links?.[0], (<Button asChild size="icon" variant="secondary"><a href="#"><TwitterIcon className="stroke-muted-foreground" /></a></Button>))}
                {renderMemberLink(member.links?.[1], (<Button asChild size="icon" variant="secondary"><a href="#"><DribbbleIcon className="stroke-muted-foreground" /></a></Button>))}
                {renderMemberLink(member.links?.[2], (<Button asChild size="icon" variant="secondary"><a href="#"><TwitchIcon className="stroke-muted-foreground" /></a></Button>))}
              </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const I=["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:af976","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b","data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613"]
const literal={title:team03CmsLike.title,intro:team03CmsLike.intro,members:team01Literal.members}
export default function Team05Literal(){return(<div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-16 px-6 py-20 lg:px-8"><div className="mx-auto max-w-2xl text-center"><b className="text-center font-medium text-muted-foreground text-sm uppercase">We&apos;re hiring!</b><h2 className="mt-3 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><RichTextRenderer value={literal.title} blockMode="inline"/></h2><p className="mt-4 text-pretty text-base text-muted-foreground sm:text-xl"><RichTextRenderer value={literal.intro} blockMode="inline"/></p><div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-center"><Button size="lg">Open Positions</Button><Button size="lg" variant="outline">About Us</Button></div></div><div className="grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-4">{literal.members.map((member,index)=>(<div key={index}><img alt={member.name} className="aspect-square w-full rounded-lg bg-secondary object-cover" height={600} src={I[index]} width={600}/><h3 className="mt-4 font-medium text-lg">{member.name}</h3><p className="text-muted-foreground text-sm">{member.role}</p>{member.bio?<p className="mt-3"><RichTextRenderer value={member.bio} blockMode="normal"/></p>:null}<div className="mt-6 flex items-center gap-2.5"><Button asChild size="icon" variant="secondary"><a href="#"><TwitterIcon className="stroke-muted-foreground"/></a></Button><Button asChild size="icon" variant="secondary"><a href="#"><DribbbleIcon className="stroke-muted-foreground"/></a></Button><Button asChild size="icon" variant="secondary"><a href="#"><TwitchIcon className="stroke-muted-foreground"/></a></Button></div></div>))}</div></div>)}
