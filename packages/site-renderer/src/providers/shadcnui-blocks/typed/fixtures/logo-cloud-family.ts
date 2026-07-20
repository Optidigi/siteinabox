import type { LinkRef } from "@siteinabox/contracts"
import { previewInlineText } from "../fixtures"
import { logoCloud01Logo } from "./logo-cloud-01"

export const logoCloudFamilyLogo = logoCloud01Logo

export const logoCloudLiteralCopy = {
  trust22M: "More than 2.2 million companies worldwide already trust us",
  trustedTeams: "Trusted by teams and companies around the world",
  trusted1000: "Trusted by 1000+ companies",
  and1000More: "and 1000+ more companies",
  industryLeadersIntro:
    "Trusted by industry leaders and visionaries who are shaping the future, solving global challenges, and driving innovation forward.",
} as const

const literalTitle22M = previewInlineText(logoCloudLiteralCopy.trust22M)
const literalIntroTeams = previewInlineText(logoCloudLiteralCopy.trustedTeams)
const literalTitle1000 = previewInlineText(logoCloudLiteralCopy.trusted1000)
const literalTitleAnd1000More = previewInlineText(logoCloudLiteralCopy.and1000More)
const literalIntroIndustryLeaders = previewInlineText(logoCloudLiteralCopy.industryLeadersIntro)

const literalCtaViewAllCompanies = { label: "View all companies", href: "#" } satisfies LinkRef
const literalCtaViewCompanies = { label: "View companies", href: "#" } satisfies LinkRef

export const logoCloud02Literal = { title: literalTitle22M }

export const logoCloud03Literal = {
  title: literalTitle1000,
  intro: literalIntroIndustryLeaders,
  cta: literalCtaViewAllCompanies,
}

export const logoCloud04Literal = { intro: literalTitle22M }
export const logoCloud05Literal = { intro: literalTitle22M }
export const logoCloud06Literal = { title: literalTitle22M }
export const logoCloud07Literal = { title: literalTitle22M }
export const logoCloud08Literal = { intro: literalIntroTeams }
export const logoCloud09Literal = { title: literalIntroTeams }
export const logoCloud10Literal = { title: literalIntroTeams }
export const logoCloud11Literal = { intro: literalIntroTeams }

export const logoCloud12Literal = {
  intro: literalIntroTeams,
  title: literalTitleAnd1000More,
}

export const logoCloud13Literal = { intro: literalIntroTeams }

export const logoCloud14Literal = {
  title: literalIntroTeams,
  cta: literalCtaViewCompanies,
}

export const logoCloudFamilyCmsLike = {
  title: previewInlineText("Trusted worldwide"),
  intro: previewInlineText(logoCloudLiteralCopy.trustedTeams),
  logos: [logoCloud01Logo("Acme"), logoCloud01Logo("Globex")],
  cta: { label: "View companies", href: "https://example.test/companies" },
}

export const logoCloudFamilySparse = {
  logos: [logoCloud01Logo("Solo")],
}

export const logoCloudFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  logos: [logoCloud01Logo("Acme")],
}

export const logoCloudFamilyMissingImage = {
  title: previewInlineText("No artwork yet"),
  logos: [{ name: "Placeholder" }],
}

export const logoCloudFamilyMaxItems = (count: number) => ({
  logos: Array.from({ length: count }, (_, index) => logoCloud01Logo(`Logo${index + 1}`)),
})
