import type { CollectionBeforeValidateHook, CollectionConfig } from "payload"
import { ValidationError } from "payload"
import { SITE_CHROME_CATALOG } from "@siteinabox/contracts/block-catalog"
import { SHADCNUI_CHROME_VARIANTS } from "@siteinabox/contracts"
import { canRead, canUpdateSettings } from "@/access/roleHelpers"
import { projectSettingsToDisk } from "@/hooks/projectToDisk"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { relationshipId } from "@/lib/relationshipId"
import { validateSafeHref } from "@/lib/security/safeHref"
import { adminText, adminValidationText } from "@/lib/payloadAdminI18n"

// HH:MM 24h matcher. Accepts 00:00–23:59.
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const validateHHMM = (val: unknown, { siblingData, req }: any) => {
  // If the row is marked closed, open/close are ignored — empty is fine.
  if (siblingData?.closed) return true
  if (val == null || val === "") return adminValidationText(req?.i18n?.language, "Required when the day is not closed", "Verplicht wanneer de dag niet gesloten is")
  if (typeof val !== "string" || !TIME_HHMM.test(val)) return adminValidationText(req?.i18n?.language, "Use 24-hour HH:MM format (e.g. 09:00)", "Gebruik 24-uursnotatie UU:MM (bijv. 09:00)")
  return true
}

// FN-2026-0004 — primaryColor accepted any free-text string. Validate as a
// 3- or 6-digit hex color (with leading '#'). Empty is allowed (field is
// optional — the renderer falls back to a default when unset).
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const validatePrimaryColor = (val: unknown, { req }: any) => {
  if (val == null || val === "") return true
  if (typeof val !== "string" || !HEX_COLOR_REGEX.test(val)) {
    return adminValidationText(req?.i18n?.language, "Use a hex color (e.g. #2563eb or #25b)", "Gebruik een hexkleur (bijv. #2563eb of #25b)")
  }
  return true
}

const nonEmpty = (val: unknown) => typeof val === "string" && val.trim() !== ""

const chromeVariantOptionsFor = (area: "header" | "footer" | "banner") =>
  SITE_CHROME_CATALOG
    .filter((entry) => entry.area === area)
    .map((entry) => ({ label: entry.label, value: entry.variant }))

const headerChromeVariantOptions = chromeVariantOptionsFor("header")
const footerChromeVariantOptions = chromeVariantOptionsFor("footer")
const bannerChromeVariantOptions = chromeVariantOptionsFor("banner")

const tenantExclusiveChromeVariants = SITE_CHROME_CATALOG
  .filter((entry) => entry.scope.kind === "tenant-exclusive")
  .map((entry) => ({
    area: entry.area,
    variant: entry.variant,
    tenantSlugs: entry.scope.kind === "tenant-exclusive" ? entry.scope.tenantSlugs : [],
  }))

const collectTenantSlugs = (value: unknown, slugs = new Set<string>()): Set<string> => {
  if (typeof value === "string" && value.trim() !== "") {
    slugs.add(value)
    return slugs
  }
  if (!value || typeof value !== "object") return slugs
  if (Array.isArray(value)) {
    for (const item of value) collectTenantSlugs(item, slugs)
    return slugs
  }

  const record = value as Record<string, unknown>
  const slug = record.slug
  if (typeof slug === "string" && slug.trim() !== "") slugs.add(slug)
  collectTenantSlugs(record.tenant, slugs)
  collectTenantSlugs(record.value, slugs)
  return slugs
}

export const filterChromeVariantOptions = (
  area: "header" | "footer",
  options: { label: string; value: string }[],
  data: unknown,
  req?: unknown,
) => {
  const tenantSlugs = collectTenantSlugs(data && typeof data === "object" ? (data as Record<string, unknown>).tenant : null)
  collectTenantSlugs(req && typeof req === "object" ? (req as any).user?.tenants : null, tenantSlugs)
  // Payload can invoke select `filterOptions` during internal create/update
  // validation without the root tenant document in `data`. Option filtering is
  // only an admin UX affordance; canonical enforcement lives in
  // `enforceTenantExclusiveChromeVariants` below. Without concrete tenant
  // context, keep the static options intact so internal official-tenant imports
  // are not rejected before the tenant-aware hook runs.
  if (tenantSlugs.size === 0) return options

  return options.filter((option) => {
    const exclusive = tenantExclusiveChromeVariants.find((entry) =>
      entry.area === area && entry.variant === option.value)
    if (!exclusive) return true
    return exclusive.tenantSlugs.some((tenantSlug) => tenantSlugs.has(tenantSlug))
  })
}

const findTenantSlug = async (
  req: Parameters<CollectionBeforeValidateHook>[0]["req"],
  tenant: unknown,
): Promise<string | null> => {
  const tenantId = relationshipId(tenant as Parameters<typeof relationshipId>[0])
  if (tenantId == null) return null
  const doc = await req.payload.findByID({
    collection: "tenants",
    id: tenantId as any,
    depth: 0,
    overrideAccess: true,
  })
  return typeof (doc as any)?.slug === "string" ? (doc as any).slug : null
}

export const enforceTenantExclusiveChromeVariants: CollectionBeforeValidateHook = async ({
  collection,
  data,
  originalDoc,
  req,
}) => {
  if (!data?.chrome) return data

  const tenant = data.tenant ?? originalDoc?.tenant
  const tenantSlug = await findTenantSlug(req, tenant)
  const errors = tenantExclusiveChromeVariants.flatMap((entry) => {
    const areaSettings = (data.chrome as Record<string, unknown> | undefined)?.[entry.area]
    const variant = areaSettings && typeof areaSettings === "object" && !Array.isArray(areaSettings)
      ? (areaSettings as Record<string, unknown>).variant
      : undefined
    if (variant !== entry.variant) return []
    if (tenantSlug && entry.tenantSlugs.includes(tenantSlug)) return []
    return [{
      path: `chrome.${entry.area}.variant`,
      message: adminValidationText(req.i18n?.language, `${entry.variant} is available only to these tenants: ${entry.tenantSlugs.join(", ")}.`, `${entry.variant} is alleen beschikbaar voor deze klantomgevingen: ${entry.tenantSlugs.join(", ")}.`),
    }]
  })

  if (errors.length > 0) {
    throw new ValidationError({
      collection: collection?.slug ?? "site-settings",
      errors,
    })
  }

  return data
}

export const enforceChromeCapabilities: CollectionBeforeValidateHook = ({ collection, data, originalDoc, req }) => {
  const merged = { ...originalDoc, ...data, chrome: { ...(originalDoc?.chrome ?? {}), ...(data?.chrome ?? {}), header: { ...(originalDoc?.chrome?.header ?? {}), ...(data?.chrome?.header ?? {}) }, footer: { ...(originalDoc?.chrome?.footer ?? {}), ...(data?.chrome?.footer ?? {}) } } } as any
  const errors: Array<{ path: string; message: string }> = []
  const header = merged.chrome?.header
  const headerCapability = (SHADCNUI_CHROME_VARIANTS as readonly any[]).find((entry) => entry.id === header?.variant)?.capabilities
  const navigation = Array.isArray(merged.navHeader) ? merged.navHeader : []
  if (headerCapability) {
    const groups = navigation.filter((entry: any) => entry?.type === "group")
    if (navigation.length > headerCapability.primaryItems.max) errors.push({ path: "navHeader", message: `${header.variant} allows at most ${headerCapability.primaryItems.max} primary items.` })
    if (headerCapability.navigation === "none" && navigation.length) errors.push({ path: "navHeader", message: `${header.variant} has no primary-navigation region.` })
    if (headerCapability.navigation === "flat" && groups.length) errors.push({ path: "navHeader", message: `${header.variant} does not support flyout groups.` })
    if (groups.length > headerCapability.groupItems.max) errors.push({ path: "navHeader", message: `${header.variant} allows at most ${headerCapability.groupItems.max} flyout groups.` })
    groups.forEach((group: any, index: number) => {
      const childCount = Array.isArray(group.children) ? group.children.length : 0
      if (childCount < headerCapability.childItems.min || childCount > headerCapability.childItems.max) errors.push({ path: `navHeader.${index}.children`, message: `Flyouts require ${headerCapability.childItems.min}-${headerCapability.childItems.max} links.` })
    })
    if (!headerCapability.secondaryAction && nonEmpty(header.secondaryAction?.href)) errors.push({ path: "chrome.header.secondaryAction", message: `${header.variant} has no secondary-action region.` })
    if (!headerCapability.search && header.search?.enabled) errors.push({ path: "chrome.header.search", message: `${header.variant} has no search region.` })
    if (header.mobileMenu && !headerCapability.mobileMenu.includes(header.mobileMenu)) errors.push({ path: "chrome.header.mobileMenu", message: `${header.variant} does not support the ${header.mobileMenu} mobile-menu behavior.` })
  }
  const footer = merged.chrome?.footer
  const footerCapability = (SHADCNUI_CHROME_VARIANTS as readonly any[]).find((entry) => entry.id === footer?.variant)?.capabilities
  if (footerCapability) {
    const columns = Array.isArray(footer.columns) ? footer.columns : []
    if (columns.length > footerCapability.columns.max) errors.push({ path: "chrome.footer.columns", message: `${footer.variant} allows at most ${footerCapability.columns.max} columns.` })
    columns.forEach((column: any, index: number) => {
      const links = (Array.isArray(column?.items) ? column.items : []).reduce((count: number, item: any) => count + (Array.isArray(item?.links) ? item.links.length : 0), 0)
      if (links > footerCapability.linksPerColumn.max) errors.push({ path: `chrome.footer.columns.${index}`, message: `${footer.variant} allows at most ${footerCapability.linksPerColumn.max} links per column.` })
    })
    if (!footerCapability.newsletter && nonEmpty(footer.newsletter?.action)) errors.push({ path: "chrome.footer.newsletter", message: `${footer.variant} has no newsletter region.` })
  }
  if (errors.length) throw new ValidationError({ collection: collection?.slug ?? "site-settings", errors: errors.map((error) => ({ ...error, message: adminValidationText(req.i18n?.language, error.message, error.message) })) })
  return data
}

const linkRefFields = () => [
  { name: "label", type: "text" as const, maxLength: 32 },
  { name: "href", type: "text" as const, validate: validateSafeHref },
  { name: "external", type: "checkbox" as const, defaultValue: false },
]

// OBS-20 — a navigation entry is a discriminated union over `type`:
//   page    → links to a CMS page (label defaults to the page title)
//   section → links to a `#anchor` (a block's anchor id) within `page`,
//             or the current page when `page` is unset (onepager case)
//   custom  → an arbitrary URL
// navHeader and navFooter both use this exact shape. Defined as a factory so
// each array field gets its own field-config objects (Payload mutates field
// configs during init — a shared reference would cross-wire the two arrays).
const navEntryFields = () => [
  {
    name: "type",
    type: "select" as const,
    required: true,
    defaultValue: "page",
    options: [
      { label: adminText("Page link", "Paginalink"), value: "page" },
      { label: adminText("Section link", "Sectielink"), value: "section" },
      { label: adminText("Custom link", "Aangepaste link"), value: "custom" },
      { label: adminText("Flyout group", "Uitklapgroep"), value: "group" },
    ],
    admin: {
      description: adminText("Page, section or custom create a link. Flyout group contains its own links and is supported by compatible navbar variants.", "Pagina, sectie of aangepast maakt een link. Een uitklapgroep bevat eigen links en werkt met compatibele navigatievarianten."),
    },
  },
  {
    name: "page",
    type: "relationship" as const,
    relationTo: "pages" as const,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "page" || sib?.type === "section",
      description: adminText("Target page. For a section link, the page containing the section (leave blank for the current page).", "Doelpagina. Voor een sectielink: de pagina met de sectie (laat leeg voor de huidige pagina)."),
    },
    validate: (val: unknown, { siblingData, req }: any) => {
      if (siblingData?.type !== "page") return true
      if (val == null) return adminValidationText(req?.i18n?.language, "Select a target page for a page link", "Selecteer een doelpagina voor een paginalink")
      return true
    },
  },
  {
    name: "anchor",
    type: "text" as const,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "section",
      description: adminText("Section ID without the leading '#' (e.g. 'services').", "Sectie-ID zonder het voorvoegsel '#' (bijv. 'diensten')."),
    },
    validate: (val: unknown, { siblingData, req }: any) => {
      if (siblingData?.type !== "section") return true
      return nonEmpty(val) ? true : adminValidationText(req?.i18n?.language, "Anchor is required for a section link", "Anker is verplicht voor een sectielink")
    },
  },
  {
    name: "url",
    type: "text" as const,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "custom",
      description: adminText("Full URL (https://…) or a site-relative path.", "Volledige URL (https://…) of een site-relatief pad."),
    },
    validate: (val: unknown, { siblingData, req }: any) => {
      if (siblingData?.type !== "custom") return true
      if (!nonEmpty(val)) return adminValidationText(req?.i18n?.language, "URL is required for a custom link", "URL is verplicht voor een aangepaste link")
      const result = validateSafeHref(val)
      return result === true ? true : adminValidationText(req?.i18n?.language, result, "Gebruik een veilige geldige URL of een site-relatief pad")
    },
  },
  {
    name: "label",
    type: "text" as const,
    maxLength: 32,
    admin: {
      description: adminText("Display text. For a page link, leave blank to use the page title.", "Weergavetekst. Laat bij een paginalink leeg om de paginatitel te gebruiken."),
    },
    validate: (val: unknown, { siblingData, req }: any) => {
      // Page links may omit the label — it falls back to the page title at
      // projection time. Section/custom links carry no inherent title.
      if (siblingData?.type === "page") return true
      return nonEmpty(val) ? true : adminValidationText(req?.i18n?.language, "Label is required", "Label is verplicht")
    },
  },
  {
    name: "external",
    type: "checkbox" as const,
    defaultValue: false,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "custom",
      description: adminText("Open in a new tab (external site).", "Openen in een nieuw tabblad (externe site)."),
    },
  },
  {
    name: "description",
    type: "textarea" as const,
    maxLength: 90,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "group",
      description: adminText("Optional flyout introduction.", "Optionele introductie van het uitklapmenu."),
    },
  },
  {
    name: "children",
    type: "array" as const,
    minRows: 1,
    maxRows: 6,
    admin: {
      condition: (_: unknown, sib: any) => sib?.type === "group",
      description: adminText("Flyout links. The selected navbar capability determines whether groups are allowed.", "Links in het uitklapmenu. De gekozen navigatievariant bepaalt of groepen zijn toegestaan."),
    },
    fields: [
      { name: "label", type: "text" as const, required: true, maxLength: 32 },
      { name: "href", type: "text" as const, required: true, validate: validateSafeHref },
      { name: "description", type: "textarea" as const, maxLength: 90 },
      { name: "icon", type: "select" as const, options: ["backpack", "cake-slice", "coffee", "grape", "hotel", "ice-cream", "map-pin", "package", "pizza", "plane", "sandwich", "smile"] },
      { name: "external", type: "checkbox" as const, defaultValue: false },
    ],
  },
]

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  labels: { singular: { en: "Site settings", nl: "Site-instellingen" }, plural: { en: "Site settings", nl: "Site-instellingen" } },
  access: {
    read: canRead,
    create: canUpdateSettings,
    update: canUpdateSettings,
    delete: ({ req }) => req.user?.role === "super-admin"
  },
  admin: { useAsTitle: "siteName", description: adminText("One record per tenant.", "Eén record per klantomgeving.") },
  fields: [
    { name: "siteName", type: "text", required: true },
    { name: "siteUrl", type: "text", required: true,
      admin: { description: adminText("Public URL of the SSR site (e.g. https://clientasite.nl).", "Openbare URL van de SSR-site (bijv. https://clientasite.nl).") } },
    { name: "description", type: "textarea",
      admin: { description: adminText("One-paragraph site description (used in metadata and footers).", "Sitebeschrijving van één alinea (gebruikt in metadata en voetteksten).") } },
    { name: "language", type: "text", defaultValue: "nl",
      admin: { description: adminText("ISO 639-1 language code, used in <html lang>. Default: 'nl'.", "ISO 639-1-taalcode, gebruikt in <html lang>. Standaard: 'nl'.") } },
    { name: "aliases", type: "array",
      admin: { description: adminText("Alternative domains that should serve the same site (e.g. www.foo.com aliased to foo.com).", "Alternatieve domeinen die dezelfde site moeten aanbieden (bijv. www.foo.com als alias van foo.com).") },
      fields: [
        { name: "host", type: "text", required: true }
      ]},
    { name: "contactEmail", type: "email",
      admin: { description: adminText("Public contact address shown on the generated site. Operational form notifications are configured in Email preferences.", "Openbaar contactadres op de gegenereerde site. Operationele formuliermeldingen stel je in bij E-mailvoorkeuren.") } },
    { name: "branding", type: "group", fields: [
      { name: "logo", type: "upload", relationTo: "media" },
      { name: "favicon", type: "upload", relationTo: "media" },
      { name: "primaryColor", type: "text", validate: validatePrimaryColor,
        admin: { description: adminText("Hex (e.g. #2563eb).", "Hex (bijv. #2563eb).") } }
    ]},
    { name: "chrome", type: "group",
      admin: { description: adminText("Non-navigation header/footer content edited from the page editor chrome inspector.", "Niet-navigatie-inhoud van kop- en voettekst, bewerkt via de chrome-inspector van de pagina-editor.") },
      fields: [
        { name: "header", type: "group", fields: [
          { name: "variant", type: "select", options: headerChromeVariantOptions,
            filterOptions: ({ options, data, req }) => filterChromeVariantOptions("header", options as any, data, req),
            admin: { description: adminText("Approved renderer variant for the header.", "Goedgekeurde renderervariant voor de koptekst.") } },
          { name: "logo", type: "upload", relationTo: "media",
            admin: { description: adminText("Optional header-specific logo. Falls back to the branding logo.", "Optioneel logo specifiek voor de koptekst. Valt terug op het merklogo.") } },
          { name: "behavior", type: "select", options: [
            { label: adminText("Static", "Statisch"), value: "static" },
            { label: adminText("Sticky", "Vastgezet"), value: "sticky" },
          ]},
          { name: "activeMode", type: "select", options: [
            { label: adminText("Path", "Pad"), value: "path" },
            { label: adminText("Anchor", "Anker"), value: "anchor" },
            { label: adminText("None", "Geen"), value: "none" },
          ]},
          { name: "mobileMenu", type: "select", options: [
            { label: adminText("Dropdown", "Uitklapmenu"), value: "dropdown" },
            { label: adminText("Drawer", "Schuifpaneel"), value: "drawer" },
          ]},
          { name: "cta", type: "group", fields: linkRefFields() },
          { name: "secondaryAction", type: "group", fields: linkRefFields(),
            admin: { description: adminText("Secondary account/action link for navbar variants that expose one.", "Secundaire account-/actielink voor navigatievarianten die deze tonen.") } },
          { name: "search", type: "group", fields: [
            { name: "enabled", type: "checkbox", defaultValue: false },
            { name: "action", type: "text", defaultValue: "/search", validate: validateSafeHref },
            { name: "placeholder", type: "text", maxLength: 48, defaultValue: "Search" },
          ]},
        ]},
        { name: "footer", type: "group", fields: [
          { name: "variant", type: "select", options: footerChromeVariantOptions,
            filterOptions: ({ options, data, req }) => filterChromeVariantOptions("footer", options as any, data, req),
            admin: { description: adminText("Approved renderer variant for the footer.", "Goedgekeurde renderervariant voor de voettekst.") } },
          { name: "logo", type: "upload", relationTo: "media",
            admin: { description: adminText("Optional footer-specific logo. Falls back to the branding logo.", "Optioneel logo specifiek voor de voettekst. Valt terug op het merklogo.") } },
          { name: "tagline", type: "textarea" },
          { name: "copyright", type: "text" },
          { name: "legalLinks", type: "array", fields: linkRefFields() },
          { name: "columns", type: "json",
            admin: { description: adminText("Manifest-driven footer column composition edited from the page editor.", "Door het manifest bepaalde kolomindeling van de voettekst, bewerkt vanuit de pagina-editor.") } }
          ,{ name: "newsletter", type: "group", fields: [
            { name: "title", type: "text", maxLength: 64 },
            { name: "placeholder", type: "text", maxLength: 64 },
            { name: "submitLabel", type: "text", maxLength: 32 },
            { name: "action", type: "text", validate: validateSafeHref },
            { name: "method", type: "select", options: ["GET", "POST"] },
          ]}
        ]},
        { name: "banner", type: "group", fields: [
          { name: "variant", type: "select", options: bannerChromeVariantOptions,
            admin: { description: adminText("Approved renderer variant for the announcement banner.", "Goedgekeurde renderervariant voor de aankondigingsbanner.") } },
          { name: "visible", type: "checkbox", defaultValue: false },
          { name: "title", type: "text" },
          { name: "message", type: "textarea" },
          { name: "link", type: "group", fields: linkRefFields() },
          { name: "dismissible", type: "checkbox", defaultValue: true },
        ]},
      ]},
    { name: "maintenance", type: "group", fields: [
      { name: "enabled", type: "checkbox", defaultValue: false },
      { name: "message", type: "textarea" }
    ]},
    { name: "contact", type: "group", fields: [
      { name: "phone", type: "text" },
      { name: "address", type: "textarea" },
      { name: "social", type: "array", fields: [
        { name: "platform", type: "text", required: true },
        { name: "url", type: "text", required: true, validate: validateSafeHref }
      ]}
    ]},
    { name: "nap", type: "group",
      admin: { description: adminText("Name / Address / Phone — canonical legal-entity contact information used for SEO and the footer.", "Naam / Adres / Telefoon — canonieke contactgegevens van de juridische entiteit voor SEO en de voettekst.") },
      fields: [
        { name: "legalName", type: "text",
          admin: { description: adminText("Legal entity name (may differ from the site name or brand).", "Naam van de juridische entiteit (kan afwijken van de sitenaam of het merk).") } },
        { name: "kvkNumber", type: "text",
          admin: { description: adminText("Dutch Chamber of Commerce number, shown in compliant site footers when present.", "KvK-nummer, indien aanwezig getoond in conforme sitevoetteksten.") } },
        { name: "establishmentNumber", type: "text",
          admin: { description: adminText("Dutch establishment number, shown in compliant site footers when present.", "Nederlands vestigingsnummer, indien aanwezig getoond in conforme sitevoetteksten.") } },
        { name: "streetAddress", type: "text" },
        { name: "city", type: "text" },
        { name: "region", type: "text", admin: { description: adminText("Province / state.", "Provincie / staat.") } },
        { name: "postalCode", type: "text" },
        { name: "country", type: "text", defaultValue: "NL",
          admin: { description: adminText("ISO 3166-1 alpha-2 (default: 'NL').", "ISO 3166-1 alpha-2 (standaard: 'NL').") } }
      ]},
    { name: "hours", type: "array",
      admin: { description: adminText("Opening hours per weekday. Use 'closed' for days the business is closed.", "Openingstijden per weekdag. Gebruik 'gesloten' voor dagen waarop het bedrijf gesloten is.") },
      fields: [
        { name: "day", type: "select", required: true, options: [
          { label: adminText("Monday", "Maandag"), value: "monday" },
          { label: adminText("Tuesday", "Dinsdag"), value: "tuesday" },
          { label: adminText("Wednesday", "Woensdag"), value: "wednesday" },
          { label: adminText("Thursday", "Donderdag"), value: "thursday" },
          { label: adminText("Friday", "Vrijdag"), value: "friday" },
          { label: adminText("Saturday", "Zaterdag"), value: "saturday" },
          { label: adminText("Sunday", "Zondag"), value: "sunday" }
        ]},
        { name: "open", type: "text", validate: validateHHMM,
          admin: { description: adminText("HH:MM, 24-hour format. Required unless the day is closed.", "UU:MM, 24-uursnotatie. Verplicht tenzij de dag gesloten is.") } },
        { name: "close", type: "text", validate: validateHHMM,
          admin: { description: adminText("HH:MM, 24-hour format. Required unless the day is closed.", "UU:MM, 24-uursnotatie. Verplicht tenzij de dag gesloten is.") } },
        { name: "closed", type: "checkbox", defaultValue: false,
          admin: { description: adminText("When checked, opening and closing times are ignored.", "Wanneer aangevinkt worden openings- en sluitingstijden genegeerd.") } }
      ]},
    { name: "serviceArea", type: "array",
      admin: { description: adminText("Geographic regions (cities, postal codes, etc.) the business serves.", "Geografische regio's (plaatsen, postcodes enz.) waarin het bedrijf actief is.") },
      fields: [
        { name: "name", type: "text", required: true }
      ]},
    { name: "navHeader", type: "array", fields: navEntryFields(),
      admin: { description: adminText("Header navigation. Entries render in order; drag to reorder.", "Kopnavigatie. Items worden op volgorde weergegeven; sleep om te herschikken.") } },
    { name: "navFooter", type: "array", fields: navEntryFields(),
      admin: { description: adminText("Footer navigation. Entries render in order; drag to reorder.", "Voettekstnavigatie. Items worden op volgorde weergegeven; sleep om te herschikken.") } }
  ],
  hooks: {
    beforeValidate: [validateTenantExists, enforceTenantExclusiveChromeVariants, enforceChromeCapabilities],
    afterChange: [projectSettingsToDisk]
  }
}
