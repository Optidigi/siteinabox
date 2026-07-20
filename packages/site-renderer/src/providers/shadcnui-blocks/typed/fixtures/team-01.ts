import type { MediaRef } from "@siteinabox/contracts"
import { previewBlockText, previewInlineText } from "../fixtures"

const previewImage = (alt: string): MediaRef => ({
  url: `https://cdn.example.test/${alt.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  alt,
})

export const team01Member = (name: string, role: string, bio?: string) => ({
  name,
  role,
  ...(bio ? { bio: previewBlockText(bio) } : {}),
  image: previewImage(name),
})

export const team01Literal = {
  title: previewInlineText("Meet Our Team"),
  intro: previewInlineText(
    "Our philosophy is simple — hire a team of passionate people and foster a culture that empowers you to do you best work.",
  ),
  members: [
    team01Member("John Doe", "Founder & CEO"),
    team01Member("Jane Doe", "Engineering Manager"),
    team01Member("Bob Smith", "Product Manager"),
    team01Member("Peter Johnson", "Frontend Developer"),
    team01Member("David Lee", "Backend Developer"),
    team01Member("Sarah Williams", "Product Designer"),
    team01Member("Michael Brown", "UX Researcher"),
    team01Member("Elizabeth Johnson", "Customer Success"),
  ],
}

export const team01CmsLike = {
  title: previewInlineText("Meet Our Team"),
  intro: previewInlineText("Passionate people building great products together."),
  members: [
    team01Member("Liam Martinez", "Chief Technology Officer"),
    team01Member("Ava Thompson", "Chief Executive Officer"),
  ],
}

export const team01Sparse = {
  members: [team01Member("Solo Member", "Founder")],
}

export const team01Long = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  members: [team01Member("C".repeat(100), "D".repeat(200))],
}

export const team01EmptyMembers = {
  title: previewInlineText("Team"),
  members: [] as Array<ReturnType<typeof team01Member>>,
}
