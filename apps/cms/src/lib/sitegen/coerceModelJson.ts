import {
  APPOINTMENT_PRESENTATIONS,
  APPOINTMENT_VARIANTS,
  CTA_VARIANTS,
  DEFAULT_APPOINTMENT_PRESENTATION,
  DEFAULT_APPOINTMENT_VARIANT,
  DEFAULT_FOOTER_VARIANT,
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
  FOOTER_VARIANTS,
  HERO_VARIANTS,
  NAVBAR_PLACEMENTS,
  NAVBAR_VARIANTS,
  SERVICES_VARIANTS,
} from "@siteinabox/contracts"
import { isSafeHref } from "@/lib/security/safeHref"

const LIVE_SECTION_TYPES = new Set(["hero", "services", "cta", "appointments"])
const DEFAULT_ACTION_HREF = "#contact"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const stripNoiseKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripNoiseKeys)
  if (!isRecord(value)) return value
  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === "id") continue
    next[key] = stripNoiseKeys(child)
  }
  return next
}

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback

const asText = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return fallback
}

const nullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const coerceAction = (
  value: unknown,
  fallbackLabel: string,
): { label: string; href: string } | null => {
  if (value == null) return null
  if (typeof value === "string" && value.trim()) {
    const href = sanitizeActionHref(value.trim())
    return { label: fallbackLabel, href }
  }
  if (!isRecord(value)) return null
  const label = asText(value.label ?? value.text ?? value.title, fallbackLabel)
  const hrefRaw = value.href ?? value.url ?? value.link
  const href = typeof hrefRaw === "string" && hrefRaw.trim()
    ? sanitizeActionHref(hrefRaw.trim())
    : DEFAULT_ACTION_HREF
  return { label, href }
}

const requiredAction = (value: unknown, fallbackLabel: string): { label: string; href: string } =>
  coerceAction(value, fallbackLabel) ?? { label: fallbackLabel, href: DEFAULT_ACTION_HREF }

const sanitizeActionHref = (href: string): string => (isSafeHref(href) ? href : DEFAULT_ACTION_HREF)

const coerceHighlight = (value: unknown): { title: string; body: string } | null => {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim()
    return { title: text.slice(0, 80), body: text }
  }
  if (!isRecord(value)) return null
  const title = asText(value.title ?? value.heading, "")
  const body = asText(value.body ?? value.description ?? value.text, "")
  if (!title && !body) return null
  return { title: title || body.slice(0, 80), body: body || title }
}

const coerceHighlights = (value: unknown): Array<{ title: string; body: string }> | undefined => {
  if (!Array.isArray(value)) return undefined
  const items = value.map(coerceHighlight).filter((item): item is { title: string; body: string } => item != null)
  if (items.length === 1 || items.length === 0) return undefined
  return items.slice(0, 4)
}

const coerceServiceItem = (value: unknown): { title: string; body: string; action: { label: string; href: string } | null } | null => {
  if (typeof value === "string" && value.trim()) {
    return { title: value.trim().slice(0, 60), body: value.trim(), action: null }
  }
  if (!isRecord(value)) return null
  const title = asText(value.title ?? value.heading ?? value.name, "")
  const body = asText(value.body ?? value.description ?? value.text, "")
  if (!title && !body) return null
  return {
    title: title || body.slice(0, 60),
    body: body || title,
    action: coerceAction(value.action, title || "Meer"),
  }
}

const coerceHero = (section: Record<string, unknown>): Record<string, unknown> => {
  const mediaId = nullableText(section.mediaId)
  const highlights = coerceHighlights(section.highlights)
  return {
    blockType: "hero",
    variant: mediaId ? pickEnum(section.variant, HERO_VARIANTS, "hero-01") : "hero-01",
    heading: asText(section.heading ?? section.title, "Welkom"),
    body: asText(section.body ?? section.text, "Vertel kort wat je doet en voor wie."),
    primaryAction: requiredAction(section.primaryAction ?? (Array.isArray(section.actions) ? section.actions[0] : undefined), "Contact"),
    secondaryAction: coerceAction(section.secondaryAction ?? (Array.isArray(section.actions) ? section.actions[1] : undefined), "Meer info"),
    mediaId,
    ...(highlights ? { highlights } : {}),
  }
}

const coerceServices = (section: Record<string, unknown>): Record<string, unknown> => {
  const rawItems = Array.isArray(section.items) ? section.items : []
  const items = rawItems.map(coerceServiceItem).filter((item): item is NonNullable<typeof item> => item != null)
  const ensured = items.length >= 2
    ? items.slice(0, 6)
    : [...items, { title: "Advies", body: "Persoonlijk advies op locatie.", action: null }].slice(0, 6)
  if (ensured.length < 2) {
    ensured.push({ title: "Contact", body: "Neem gerust contact op voor de mogelijkheden.", action: null })
  }
  return {
    blockType: "services",
    variant: pickEnum(section.variant, SERVICES_VARIANTS, "services-01"),
    heading: asText(section.heading ?? section.title, "Diensten"),
    intro: nullableText(section.intro),
    items: ensured,
  }
}

const coerceCta = (section: Record<string, unknown>): Record<string, unknown> => ({
  blockType: "cta",
  variant: pickEnum(section.variant, CTA_VARIANTS, "cta-01"),
  heading: asText(section.heading ?? section.title, "Aan de slag"),
  body: nullableText(section.body ?? section.text),
  primaryAction: requiredAction(section.primaryAction, "Neem contact op"),
  secondaryAction: coerceAction(section.secondaryAction, "Bel ons"),
  mediaId: nullableText(section.mediaId),
})

const coerceAppointments = (section: Record<string, unknown>): Record<string, unknown> => ({
  blockType: "appointments",
  variant: pickEnum(section.variant, APPOINTMENT_VARIANTS, DEFAULT_APPOINTMENT_VARIANT),
  presentation: pickEnum(section.presentation, APPOINTMENT_PRESENTATIONS, DEFAULT_APPOINTMENT_PRESENTATION),
  heading: asText(section.heading ?? section.title, "Afspraak maken"),
  body: nullableText(section.body),
  mediaId: nullableText(section.mediaId),
  availabilityLabel: asText(section.availabilityLabel, "Beschikbaarheid"),
  bookingLabel: asText(section.bookingLabel, "Afspraak aanvragen"),
  confirmationHeading: asText(section.confirmationHeading, "Afspraak bevestigd"),
  confirmationBody: nullableText(section.confirmationBody),
  privacyNote: nullableText(section.privacyNote),
})

const coerceSection = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null
  const blockType = String(value.blockType ?? "")
  if (!LIVE_SECTION_TYPES.has(blockType)) return null
  if (blockType === "hero") return coerceHero(value)
  if (blockType === "services") return coerceServices(value)
  if (blockType === "cta") return coerceCta(value)
  return coerceAppointments(value)
}

/** Clamp Luna Sitegen JSON so extra keys / missing nullables don't fail the whole homepage. */
export const coerceSitegenModelJson = (value: unknown): unknown => {
  const stripped = stripNoiseKeys(value)
  if (!isRecord(stripped)) return stripped
  const navbar = isRecord(stripped.navbar) ? stripped.navbar : {}
  const footer = isRecord(stripped.footer) ? stripped.footer : {}
  const rawPages = Array.isArray(stripped.pages) ? stripped.pages : []
  const pages = rawPages.map((page) => {
    if (!isRecord(page)) return page
    const sections = Array.isArray(page.sections)
      ? page.sections.map(coerceSection).filter((section): section is Record<string, unknown> => section != null)
      : []
    return {
      slug: asText(page.slug, "index"),
      title: asText(page.title, "Home"),
      sections,
    }
  }).filter((page) => isRecord(page) && Array.isArray(page.sections) && page.sections.length > 0)
  return {
    navbar: {
      variant: pickEnum(navbar.variant, NAVBAR_VARIANTS, DEFAULT_NAVBAR_VARIANT),
      placement: pickEnum(navbar.placement, NAVBAR_PLACEMENTS, DEFAULT_NAVBAR_PLACEMENT),
    },
    footer: {
      variant: pickEnum(footer.variant, FOOTER_VARIANTS, DEFAULT_FOOTER_VARIANT),
    },
    pages: pages.length > 0 ? pages : [{
      slug: "index",
      title: "Home",
      sections: [
        coerceHero({ heading: "Welkom", body: "Een eerste homepage." }),
        coerceServices({ items: [{ title: "Diensten" }, { title: "Advies" }] }),
        coerceCta({}),
      ],
    }],
  }
}
