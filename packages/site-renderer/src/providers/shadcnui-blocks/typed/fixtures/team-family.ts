import type { MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"
import { team01Member } from "./team-01"

const previewImage = (alt: string): MediaRef => ({
  url: `https://cdn.example.test/${alt.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  alt,
})

export const teamFamilyMember = (name: string, role: string, bio?: string) => ({
  name,
  role,
  ...(bio ? { bio: previewBlockText(bio) } : {}),
  image: previewImage(name),
})

export const teamFamilyCmsLike = {
  title: previewInlineText("Built by makers"),
  intro: previewInlineText("A team that values simplicity and speed"),
  members: [
    teamFamilyMember("Liam Martinez", "Chief Technology Officer"),
    teamFamilyMember("Ava Thompson", "Chief Executive Officer"),
  ],
}

export const teamFamilySparse = {
  members: [teamFamilyMember("Solo Member", "Founder")],
}

export const teamFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  members: [teamFamilyMember("C".repeat(100), "D".repeat(200))],
}

export const teamFamilyEmptyMembers = {
  title: previewInlineText("Team"),
  members: [] as Array<ReturnType<typeof teamFamilyMember>>,
}

export const team02CmsLike = {
  title: previewInlineText("Meet the people behind the product"),
  intro: previewInlineText("We're a 100% remote team spread all across the world. Join us!"),
  members: [
    team01Member("John Doe", "Founder & CEO", "Former co-founder of Opendoor."),
    team01Member("Jane Doe", "Engineering Manager", "Lead engineering teams at Figma."),
  ],
}

export const team03CmsLike = {
  title: previewInlineText("Leadership Team"),
  intro: previewInlineText("We're a cross-disciplinary team that loves to create great experiences for our customers."),
  members: [
    team01Member("John Doe", "Founder & CEO", "Former co-founder of Opendoor."),
    team01Member("Jane Doe", "Engineering Manager", "Lead engineering teams at Figma."),
  ],
}

export const team06CmsLike = {
  title: previewInlineText("Our core team"),
  intro: previewInlineText("Passionate people building great products"),
  members: teamFamilyCmsLike.members,
}

export const team10CmsLike = team06CmsLike

export const team12CmsLike = team06CmsLike
