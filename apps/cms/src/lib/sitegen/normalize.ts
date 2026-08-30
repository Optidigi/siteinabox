import {
  BlockSchema,
  DEFAULT_FOOTER_VARIANT,
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
  DEFAULT_THEME_TOKEN_SPEC,
  SITEGEN_BLOCK_TYPES,
  type Action,
  type Block,
  type ContactMethod,
  type FooterVariant,
  type FormConfig,
  type MediaRef,
  type NormalizedIntake,
  type NavbarPlacement,
  type NavbarVariant,
  type SiteGenerationSpec,
} from "@siteinabox/contracts"
import { sitegenVariantFor } from "./catalog"
import {
  sitegenMediaFacts,
  sitegenMediaKey,
  sitegenMediaMeetsRequirement,
  sitegenMediaRequirementFromTags,
} from "./mediaEligibility"
import { SitegenOutputSchema, type SitegenGeneratedSection, type SitegenOutput, type SitegenOutputInput } from "./output-schema"

export type SitegenProjectEvidence = {
  sourceId: string
  title: string
  summary?: string | null
  media: MediaRef[]
  action?: { label: string; href: string; external?: boolean }
}

export type SitegenReviewEvidence = {
  sourceId: string
  quote: string
  name: string
  context?: string | null
}

export type SitegenPricingEvidence = {
  sourceId: string
  title: string
  description?: string | null
  price: string
  period?: string | null
  features: string[]
  action?: { label: string; href: string; external?: boolean }
  badge?: string | null
}

export type SitegenNormalizationContext = {
  mediaById?: Readonly<Record<string, MediaRef>>
  projectsById?: Readonly<Record<string, SitegenProjectEvidence>>
  reviewsById?: Readonly<Record<string, SitegenReviewEvidence>>
  pricingById?: Readonly<Record<string, SitegenPricingEvidence>>
  contactMethods?: readonly ContactMethod[]
  serviceArea?: readonly string[]
  openingHours?: string | null
  bookingAction?: Action | null
  form?: FormConfig | null
}

export type SitegenNormalizationIssue = { path: Array<string | number>; message: string }

const mediaFor = (
  id: string | null,
  context: SitegenNormalizationContext,
  path: Array<string | number>,
  issues: SitegenNormalizationIssue[],
): MediaRef | undefined => {
  if (!id) return undefined
  const media = context.mediaById?.[id]
  if (media === undefined) {
    issues.push({ path, message: `Unknown supplied media ID "${id}".` })
    return undefined
  }
  return media
}

const actionOrNull = <T extends { action?: { label: string; href: string; external?: boolean } | null }>(value: T) => value.action ?? undefined

const withoutMediaId = <T extends { mediaId?: string | null }>(value: T) => {
  const { mediaId: _mediaId, ...rest } = value
  return rest
}

const actionFromUnknown = (value: unknown): Action | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.label !== "string" || !record.label.trim() || typeof record.href !== "string" || !record.href.trim()) return null
  return {
    label: record.label.trim(),
    href: record.href.trim(),
    ...(typeof record.external === "boolean" ? { external: record.external } : {}),
  }
}

const defaultForm = (language: string): FormConfig => ({
  formName: "Contact",
  submitLabel: language.toLowerCase().startsWith("nl") ? "Versturen" : "Send",
  fields: [
    { name: "name", label: language.toLowerCase().startsWith("nl") ? "Naam" : "Name", type: "text", required: true, placeholder: null, options: null },
    { name: "email", label: "E-mail", type: "email", required: true, placeholder: null, options: null },
    { name: "message", label: language.toLowerCase().startsWith("nl") ? "Vraag" : "Message", type: "textarea", required: true, placeholder: null, options: null },
  ],
})

/**
 * Converts intake-owned facts into the only context Sitegen may use to fill
 * factual contact and media fields. The model never gets to author these
 * values as canonical block data.
 */
export const sitegenNormalizationContextFromIntake = (intake: NormalizedIntake): SitegenNormalizationContext => {
  const languageIsDutch = intake.language.toLowerCase().startsWith("nl")
  const preferences = intake.intakeBrief?.contactPreferences
  const contactMethods: ContactMethod[] = [
    ...(intake.contact?.email ? [{ kind: "email" as const, label: "E-mail", value: intake.contact.email, href: `mailto:${intake.contact.email}` }] : []),
    ...(intake.contact?.phone ? [{ kind: "phone" as const, label: languageIsDutch ? "Telefoon" : "Phone", value: intake.contact.phone, href: `tel:${intake.contact.phone}` }] : []),
    ...(preferences?.whatsappNumber ? [{ kind: "whatsapp" as const, label: "WhatsApp", value: preferences.whatsappNumber, href: `https://wa.me/${preferences.whatsappNumber.replace(/\D/g, "")}` }] : []),
    ...(preferences?.publicAddress ? [{ kind: "address" as const, label: languageIsDutch ? "Adres" : "Address", value: preferences.publicAddress }] : []),
  ]

  const raw = intake.raw && typeof intake.raw === "object" ? intake.raw : null
  const rawContact = raw?.contact && typeof raw.contact === "object" && !Array.isArray(raw.contact) ? raw.contact as Record<string, unknown> : null
  const bookingAction = actionFromUnknown(raw?.bookingAction) ?? actionFromUnknown(rawContact?.bookingAction) ?? actionFromUnknown(
    typeof raw?.bookingUrl === "string"
      ? { label: languageIsDutch ? "Afspraak maken" : "Book an appointment", href: raw.bookingUrl }
      : typeof rawContact?.bookingUrl === "string"
        ? { label: languageIsDutch ? "Afspraak maken" : "Book an appointment", href: rawContact.bookingUrl }
        : null,
  )

  const mediaById: Record<string, MediaRef> = {}
  for (const asset of intake.brandSignals?.assets ?? []) {
    if (asset === null) continue
    const id = sitegenMediaKey(asset)
    if (id) mediaById[id] = asset
  }

  return {
    ...(Object.keys(mediaById).length > 0 ? { mediaById } : {}),
    ...(contactMethods.length > 0 ? { contactMethods } : {}),
    serviceArea: intake.serviceArea,
    openingHours: preferences?.openingHours ?? null,
    bookingAction,
    ...(preferences?.formType && preferences.formType !== "none" ? { form: defaultForm(intake.language) } : {}),
  }
}

const mediaRequirementForHero = (variant: string) => sitegenMediaRequirementFromTags(
  sitegenVariantFor("hero", variant)?.requires ?? [],
)

const mediaForHero = (
  section: { variant: string; mediaId: string | null },
  context: SitegenNormalizationContext,
  path: Array<string | number>,
  issues: SitegenNormalizationIssue[],
): MediaRef | undefined => {
  const media = mediaFor(section.mediaId, context, path, issues)
  const requirement = mediaRequirementForHero(section.variant)
  if (media !== undefined && requirement && !sitegenMediaMeetsRequirement(sitegenMediaFacts(media), requirement)) {
    const description = requirement === "portrait" ? "portrait" : requirement === "wideImage" ? "wide" : "image"
    issues.push({ path, message: `The ${section.variant} hero requires a supplied ${description} media ID.` })
  }
  return media
}

const normalizeSection = (
  section: SitegenGeneratedSection,
  sectionPath: Array<string | number>,
  context: SitegenNormalizationContext,
  issues: SitegenNormalizationIssue[],
): Record<string, unknown> => {
  switch (section.blockType) {
    case "hero":
      if (section.variant === "hero-02") {
        if (!section.serviceHighlights || section.serviceHighlights.length < 2) {
          issues.push({ path: [...sectionPath, "serviceHighlights"], message: "hero-02 requires two to four concrete service highlights." })
        }
        return {
          ...withoutMediaId(section),
          image: mediaForHero(section, context, [...sectionPath, "mediaId"], issues),
          serviceHighlights: (section.serviceHighlights ?? []).map((highlight, highlightIndex) => {
            const image = mediaFor(
              highlight.mediaId ?? null,
              context,
              [...sectionPath, "serviceHighlights", highlightIndex, "mediaId"],
              issues,
            )
            const { mediaId: _mediaId, ...content } = highlight
            return image === undefined ? content : { ...content, image }
          }),
        }
      }
      {
        const image = mediaForHero(section, context, [...sectionPath, "mediaId"], issues)
        return image === undefined ? withoutMediaId(section) : { ...withoutMediaId(section), image }
      }
    case "services":
      return { ...section }
    case "about":
      return { ...withoutMediaId(section), portrait: mediaFor(section.mediaId, context, [...sectionPath, "mediaId"], issues) }
    case "process":
      return { ...section }
    case "work": {
      const projects = section.projects.map((project, index) => {
        const evidence = context.projectsById?.[project.sourceId]
        if (!evidence) {
          issues.push({ path: [...sectionPath, "projects", index, "sourceId"], message: `Unknown supplied project ID "${project.sourceId}".` })
          return project
        }
        const media = project.mediaIds.map((id, mediaIndex) => mediaFor(id, context, [...sectionPath, "projects", index, "mediaIds", mediaIndex], issues)).filter((value): value is MediaRef => value !== undefined)
        return { sourceId: evidence.sourceId, title: evidence.title, summary: evidence.summary ?? null, media, action: evidence.action ?? actionOrNull(project) }
      })
      return { ...section, projects }
    }
    case "reviews": {
      const items = section.reviewSourceIds.map((sourceId, index) => {
        const evidence = context.reviewsById?.[sourceId]
        if (!evidence) issues.push({ path: [...sectionPath, "reviewSourceIds", index], message: `Unknown supplied review ID "${sourceId}".` })
        return evidence ?? { sourceId, quote: "", name: "" }
      })
      return { ...section, items }
    }
    case "pricing": {
      const offers = section.pricingSourceIds.map((sourceId, index) => {
        const evidence = context.pricingById?.[sourceId]
        if (!evidence) issues.push({ path: [...sectionPath, "pricingSourceIds", index], message: `Unknown supplied pricing ID "${sourceId}".` })
        return evidence ?? { sourceId, title: "", price: "", features: [] }
      })
      return { ...section, offers }
    }
    case "faq":
      return { ...section }
    case "cta":
      return { ...withoutMediaId(section), image: mediaFor(section.mediaId, context, [...sectionPath, "mediaId"], issues) }
    case "contact":
      if (section.serviceArea.some((value) => !(context.serviceArea ?? []).includes(value))) {
        issues.push({ path: [...sectionPath, "serviceArea"], message: "Sitegen may not invent service-area values." })
      }
      if (section.bookingAction && !context.bookingAction) {
        issues.push({ path: [...sectionPath, "bookingAction"], message: "Sitegen may not invent booking actions." })
      }
      if (section.bookingAction && context.bookingAction && section.bookingAction.href !== context.bookingAction.href) {
        issues.push({ path: [...sectionPath, "bookingAction"], message: "The booking action must match the supplied booking action." })
      }
      return {
        ...section,
        contactMethods: context.contactMethods ?? [],
        serviceArea: context.serviceArea ? [...context.serviceArea] : section.serviceArea,
        openingHours: context.openingHours ?? null,
        bookingAction: context.bookingAction ?? null,
        ...(context.form ? { form: context.form } : {}),
      }
  }
}

export const normalizeSitegenOutput = (
  output: SitegenOutputInput,
  context: SitegenNormalizationContext = {},
): { success: true; navbar: { variant: NavbarVariant; placement: NavbarPlacement }; footer: { variant: FooterVariant }; pages: Array<{ slug: string; title: string; blocks: Block[] }>; issues: [] } | { success: false; issues: SitegenNormalizationIssue[] } => {
  const parsedOutput = SitegenOutputSchema.safeParse(output)
  if (!parsedOutput.success) {
    return {
      success: false,
      issues: parsedOutput.error.issues.map((entry) => ({
        path: entry.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"),
        message: entry.message,
      })),
    }
  }
  const issues: SitegenNormalizationIssue[] = []
  const pages = parsedOutput.data.pages.map((page, pageIndex) => ({
    slug: page.slug,
    title: page.title,
    blocks: page.sections.map((section, sectionIndex) => {
      const candidate = normalizeSection(section, ["pages", pageIndex, "sections", sectionIndex], context, issues)
      const parsed = BlockSchema.safeParse(candidate)
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((entry) => ({ path: ["pages", pageIndex, "sections", sectionIndex, ...entry.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number")], message: entry.message })))
        return candidate as Block
      }
      return parsed.data
    }),
  }))
  const navbar = parsedOutput.data.navbar ?? {
    variant: DEFAULT_NAVBAR_VARIANT,
    placement: DEFAULT_NAVBAR_PLACEMENT,
  }
  const footer = parsedOutput.data.footer ?? { variant: DEFAULT_FOOTER_VARIANT }
  return issues.length > 0 ? { success: false, issues } : { success: true, navbar, footer, pages, issues: [] }
}

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

/** Build the canonical SiteGenerationSpec after the shallow model response is normalized. */
export const sitegenOutputToGenerationSpec = (
  output: SitegenOutput,
  intake: NormalizedIntake,
  context: SitegenNormalizationContext,
  generator: { model?: string } = {},
): SiteGenerationSpec => {
  const normalized = normalizeSitegenOutput(output, context)
  if (!normalized.success) {
    throw new Error(`Sitegen normalization failed: ${normalized.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`)
  }

  const description = intake.intakeBrief?.intro ?? `Informatie over ${intake.businessName}.`
  return {
    schemaVersion: 1,
    intake,
    tenant: { name: intake.businessName, slug: intake.tenantSlug, domain: intake.primaryDomain, status: "provisioning" },
    theme: DEFAULT_THEME_TOKEN_SPEC,
    settings: {
      siteName: intake.businessName,
      siteUrl: intake.siteUrl,
      description,
      language: intake.language,
      chrome: {
        navbar: {
          variant: normalized.navbar.variant,
          placement: normalized.navbar.placement,
          activeMode: "anchor",
          mobileMenu: "dropdown",
        },
        footer: {
          variant: normalized.footer.variant,
        },
      },
      contactEmail: intake.contact?.email ?? null,
      contact: { phone: intake.contact?.phone ?? null, address: intake.intakeBrief?.contactPreferences.publicAddress ?? null, social: [] },
      serviceArea: intake.serviceArea.map((name) => ({ name })),
    },
    pages: normalized.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      status: "draft" as const,
      seo: { title: `${page.title} | ${intake.businessName}`, description, ogImage: null },
      blocks: page.blocks,
    })),
    blocks: SITEGEN_BLOCK_TYPES.map((slug) => ({ slug, label: titleCase(slug) })),
    assets: (intake.brandSignals?.assets ?? []).filter((asset): asset is MediaRef => asset !== null),
    generator: { name: "sitegen-owned-sections", version: "sitegen-owned-v1", ...generator },
  }
}
