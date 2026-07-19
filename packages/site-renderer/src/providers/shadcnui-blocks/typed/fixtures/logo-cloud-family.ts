import { previewInlineText } from "../fixtures"
import { logoCloud01Logo } from "./logo-cloud-01"

export const logoCloudFamilyLogo = logoCloud01Logo

export const logoCloudFamilyCmsLike = {
  title: previewInlineText("Trusted worldwide"),
  intro: previewInlineText("Trusted by teams and companies around the world"),
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
