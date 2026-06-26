import { createHash } from "node:crypto"
import {
  IntakeSubmissionSchema,
  NormalizedIntakeSchema,
  type IntakeSubmission,
  type NormalizedIntake,
} from "@siteinabox/contracts/generation"
import { slugify } from "@/lib/slugify"

const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortValue(entry)]),
  )
}

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  return cleaned || null
}

const cleanStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter((entry): entry is string => Boolean(entry))
}

const normalizeDomain = (domain: unknown, fallbackSlug: string): string => {
  const cleaned = cleanText(domain)?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? ""
  if (cleaned && DOMAIN_REGEX.test(cleaned) && /[a-z]/.test(cleaned.split(".").pop() ?? "")) {
    return cleaned
  }
  return `${fallbackSlug}.siteinabox.test`
}

const normalizePages = (pages: IntakeSubmission["pages"]): NormalizedIntake["requestedPages"] => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [{ slug: "index", title: "Home", purpose: "Homepage" }]
  }

  const seen = new Set<string>()
  return pages.flatMap((page, index) => {
    const title = cleanText(page?.title) ?? (index === 0 ? "Home" : `Page ${index + 1}`)
    const requestedSlug = cleanText(page?.slug) ?? title
    const normalizedSlug = slugify(requestedSlug)
    const slug = index === 0 && (normalizedSlug === "" || normalizedSlug === "home")
      ? "index"
      : normalizedSlug || `page-${index + 1}`
    if (seen.has(slug)) return []
    seen.add(slug)
    return [{
      slug,
      title,
      ...(cleanText(page?.purpose) ? { purpose: cleanText(page?.purpose) } : {}),
    }]
  })
}

export const hashStableValue = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(sortValue(value))).digest("hex")

export const normalizeIntakeSubmission = (raw: IntakeSubmission): NormalizedIntake => {
  const parsedRaw = IntakeSubmissionSchema.parse(raw)
  const businessName = cleanText(parsedRaw.businessName)
  if (!businessName) {
    throw new Error("businessName is required")
  }

  const tenantSlug = slugify(businessName)
  if (!tenantSlug) {
    throw new Error("businessName must contain at least one letter or digit")
  }

  const primaryDomain = normalizeDomain(parsedRaw.domain, tenantSlug)
  const contact = {
    ...(cleanText(parsedRaw.contactName) ? { name: cleanText(parsedRaw.contactName) } : {}),
    ...(cleanText(parsedRaw.contactEmail) ? { email: cleanText(parsedRaw.contactEmail) } : {}),
    ...(cleanText(parsedRaw.contactPhone) ? { phone: cleanText(parsedRaw.contactPhone) } : {}),
  }

  return NormalizedIntakeSchema.parse({
    businessName,
    tenantSlug,
    primaryDomain,
    siteUrl: `https://${primaryDomain}`,
    language: cleanText(parsedRaw.language) ?? "nl",
    ...(Object.keys(contact).length > 0 ? { contact } : {}),
    ...(cleanText(parsedRaw.industry) ? { industry: cleanText(parsedRaw.industry) } : {}),
    serviceArea: cleanStringArray(parsedRaw.serviceArea),
    goals: cleanStringArray(parsedRaw.goals),
    requestedPages: normalizePages(parsedRaw.pages),
    ...(parsedRaw.brand
      ? {
          brandSignals: {
            colors: cleanStringArray(parsedRaw.brand.colors),
            fonts: cleanStringArray(parsedRaw.brand.fonts),
            tone: cleanStringArray(parsedRaw.brand.tone),
            ...(Array.isArray(parsedRaw.brand.assets) ? { assets: parsedRaw.brand.assets } : {}),
          },
        }
      : {}),
    raw: parsedRaw.content && typeof parsedRaw.content === "object" ? parsedRaw.content : null,
  })
}
