import type { FieldAdminConditionContext, FieldValidateContext } from "@/lib/payloadFieldContext"
import type { CollectionBeforeValidateHook, CollectionConfig, PayloadRequest } from "payload"
import { ValidationError } from "payload"
import { CONSENT_VARIANTS, DEFAULT_CONSENT_VARIANT, normalizePublicDomainHost } from "@siteinabox/contracts"
import { canRead, canUpdateSettings } from "@/access/roleHelpers"
import { projectSettingsToDisk } from "@/hooks/projectToDisk"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { validateSafeHref } from "@/lib/security/safeHref"
import { adminText, adminValidationText } from "@/lib/payloadAdminI18n"
import { richBlockField } from "@/lib/richText/payloadFields"

// HH:MM 24h matcher. Accepts 00:00–23:59.
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const validateHHMM = (val: unknown, { siblingData, req }: FieldValidateContext) => {
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
const validatePrimaryColor = (val: unknown, { req }: { req?: PayloadRequest }) => {
  if (val == null || val === "") return true
  if (typeof val !== "string" || !HEX_COLOR_REGEX.test(val)) {
    return adminValidationText(req?.i18n?.language, "Use a hex color (e.g. #2563eb or #25b)", "Gebruik een hexkleur (bijv. #2563eb of #25b)")
  }
  return true
}

const nonEmpty = (val: unknown) => typeof val === "string" && val.trim() !== ""
const isRecord = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === "object" && !Array.isArray(val)
const validEmail = (val: unknown) =>
  typeof val === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())

export const enforceSiteSettingsCapabilities: CollectionBeforeValidateHook = ({ collection, data, req }) => {
  const record = data as Record<string, unknown> | undefined
  const maintenance = isRecord(record?.maintenance) ? record.maintenance : null
  const disclosure = isRecord(record?.privacyDisclosure) ? record.privacyDisclosure : null
  const controller = isRecord(disclosure?.controller) ? disclosure.controller : null
  const errors: Array<{ path: string; message: string }> = []
  if (maintenance?.enabled && !nonEmpty(maintenance.message)) {
    errors.push({ path: "maintenance.message", message: adminValidationText(req.i18n?.language, "Enabled maintenance mode requires a message.", "Ingeschakelde onderhoudsmodus vereist een bericht.") })
  }
  if (disclosure?.enabled === true) {
    if (!nonEmpty(disclosure.version)) {
      errors.push({ path: "privacyDisclosure.version", message: adminValidationText(req.i18n?.language, "An enabled privacy document requires a version.", "Een ingeschakelde privacyverklaring vereist een versie.") })
    }
    if (!nonEmpty(disclosure.effectiveAt) || Number.isNaN(Date.parse(String(disclosure.effectiveAt)))) {
      errors.push({ path: "privacyDisclosure.effectiveAt", message: adminValidationText(req.i18n?.language, "Use a valid effective date.", "Gebruik een geldige ingangsdatum.") })
    }
    if (!nonEmpty(controller?.legalName)) {
      errors.push({ path: "privacyDisclosure.controller.legalName", message: adminValidationText(req.i18n?.language, "The responsible legal name is required.", "De juridische naam van de verantwoordelijke is verplicht.") })
    }
    if (!validEmail(controller?.email)) {
      errors.push({ path: "privacyDisclosure.controller.email", message: adminValidationText(req.i18n?.language, "Use a valid responsible-business email.", "Gebruik een geldig e-mailadres van de verantwoordelijke.") })
    }
    if (disclosure.mode === "custom" && !isRecord(disclosure.body)) {
      errors.push({ path: "privacyDisclosure.body", message: adminValidationText(req.i18n?.language, "Custom mode requires structured document content.", "De aangepaste modus vereist gestructureerde documentinhoud.") })
    }
  }
  if (errors.length) throw new ValidationError({ collection: collection?.slug ?? "site-settings", errors })
  return data
}

export const normalizeSiteSettingsAliases: CollectionBeforeValidateHook = ({
  collection,
  data,
  req,
}) => {
  if (!Array.isArray(data?.aliases)) return data

  const seen = new Set<string>()
  const errors: Array<{ path: string; message: string }> = []
  const aliases = data.aliases.map((value, index) => {
    const entry = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const host = normalizePublicDomainHost(
      typeof entry.host === "string" ? entry.host : null,
    )
    if (!host) {
      errors.push({
        path: `aliases.${index}.host`,
        message: adminValidationText(
          req.i18n?.language,
          "Use a valid public hostname.",
          "Gebruik een geldige publieke hostnaam.",
        ),
      })
      return entry
    }
    if (seen.has(host)) {
      errors.push({
        path: `aliases.${index}.host`,
        message: adminValidationText(
          req.i18n?.language,
          "Each alias hostname may occur only once.",
          "Elke aliashostnaam mag maar één keer voorkomen.",
        ),
      })
    }
    seen.add(host)
    return { ...entry, host }
  })

  if (errors.length > 0) {
    throw new ValidationError({
      collection: collection?.slug ?? "site-settings",
      errors,
    })
  }
  return { ...data, aliases }
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
// navigation.primary and navigation.footer both use this exact shape. Defined as a factory so
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
      description: adminText("Page, section or custom creates a link. Flyout groups are supported by the numbered navbar designs.", "Pagina, sectie of eigen link. Uitklapgroepen worden ondersteund door de genummerde navbarontwerpen."),
    },
  },
  {
    name: "page",
    type: "relationship" as const,
    relationTo: "pages" as const,
    admin: {
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "page" || sib?.type === "section",
      description: adminText("Target page. For a section link, the page containing the section (leave blank for the current page).", "Doelpagina. Voor een sectielink: de pagina met de sectie (laat leeg voor de huidige pagina)."),
    },
    validate: (val: unknown, { siblingData, req }: FieldValidateContext) => {
      if (siblingData?.type !== "page") return true
      if (val == null) return adminValidationText(req?.i18n?.language, "Select a target page for a page link", "Selecteer een doelpagina voor een paginalink")
      return true
    },
  },
  {
    name: "anchor",
    type: "text" as const,
    admin: {
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "section",
      description: adminText("Section ID without the leading '#' (e.g. 'services').", "Sectie-ID zonder het voorvoegsel '#' (bijv. 'diensten')."),
    },
    validate: (val: unknown, { siblingData, req }: FieldValidateContext) => {
      if (siblingData?.type !== "section") return true
      return nonEmpty(val) ? true : adminValidationText(req?.i18n?.language, "Anchor is required for a section link", "Anker is verplicht voor een sectielink")
    },
  },
  {
    name: "url",
    type: "text" as const,
    admin: {
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "custom",
      description: adminText("Full URL (https://…) or a site-relative path.", "Volledige URL (https://…) of een site-relatief pad."),
    },
    validate: (val: unknown, { siblingData, req }: FieldValidateContext) => {
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
    validate: (val: unknown, { siblingData, req }: FieldValidateContext) => {
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
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "custom",
      description: adminText("Open in a new tab (external site).", "Openen in een nieuw tabblad (externe site)."),
    },
  },
  {
    name: "description",
    type: "textarea" as const,
    maxLength: 90,
    admin: {
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "group",
      description: adminText("Optional flyout introduction.", "Optionele introductie van het uitklapmenu."),
    },
  },
  {
    name: "children",
    type: "array" as const,
    minRows: 1,
    maxRows: 6,
    admin: {
      condition: (_: unknown, sib: FieldAdminConditionContext) => sib?.type === "group",
      description: adminText("Flyout links shown in the desktop dropdown and mobile disclosure.", "Links in het uitklapmenu voor desktop en mobiele uitklapweergave."),
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
      access: {
        create: ({ req }) => req.user?.role === "super-admin",
        update: ({ req }) => req.user?.role === "super-admin",
      },
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
      admin: { description: adminText("First-party navbar, footer and announcement settings. Other chrome families will be added separately.", "First-party instellingen voor navbar, footer en aankondigingen. Andere chromefamilies worden afzonderlijk toegevoegd.") },
      fields: [
        { name: "navbar", type: "group", fields: [
          { name: "logo", type: "upload", relationTo: "media",
            admin: { description: adminText("Optional navbar-specific logo. Falls back to the branding logo.", "Optioneel logo specifiek voor de navbar. Valt terug op het merklogo.") } },
          { name: "variant", type: "select", required: true, defaultValue: "navbar-01", options: [
            { label: "Navbar 01 — theme toggle", value: "navbar-01" },
            { label: "Navbar 02 — responsive mobile menu", value: "navbar-02" },
            { label: "Navbar 03 — contained floating", value: "navbar-03" },
          ], admin: { description: adminText("Choose the numbered first-party navbar design.", "Kies het genummerde first-party navbarontwerp.") } },
          { name: "placement", type: "select", required: true, defaultValue: "sticky", options: [
            { label: adminText("Sticky while scrolling", "Vastgezet tijdens scrollen"), value: "sticky" },
            { label: adminText("Overlay on first hero", "Over de eerste hero"), value: "hero-overlay" },
          ], admin: { description: adminText("Sticky remains pinned during scrolling. Hero overlay is attached to the first hero and scrolls away with it.", "Sticky blijft zichtbaar tijdens het scrollen. Hero-overlay is gekoppeld aan de eerste hero en scrollt ermee weg.") } },
          { name: "showThemeToggle", type: "checkbox", defaultValue: false,
            admin: { description: adminText("Show a light/dark mode toggle in the navbar.", "Toon een licht/donker-schakelaar in de navbar.") } },
          { name: "activeMode", type: "select", defaultValue: "path", options: [
            { label: adminText("Path", "Pad"), value: "path" },
            { label: adminText("Anchor", "Anker"), value: "anchor" },
            { label: adminText("None", "Geen"), value: "none" },
          ]},
          { name: "mobileMenu", type: "select", defaultValue: "dropdown", options: [
            { label: adminText("Dropdown", "Uitklapmenu"), value: "dropdown" },
            { label: adminText("Drawer", "Schuifpaneel"), value: "drawer" },
          ]},
          { name: "cta", type: "group", fields: linkRefFields() },
        ]},
        { name: "footer", type: "group", fields: [
          { name: "variant", type: "select", required: true, defaultValue: "footer-01", options: [
            { label: "Footer 01 — small navigation", value: "footer-01" },
          ], admin: { description: adminText("Choose the numbered first-party footer design.", "Kies het genummerde first-party footerontwerp.") } },
          { name: "logo", type: "upload", relationTo: "media",
            admin: { description: adminText("Optional footer-specific logo. Falls back to the branding logo.", "Optioneel logo specifiek voor de voettekst. Valt terug op het merklogo.") } },
          { name: "tagline", type: "textarea" },
          { name: "copyright", type: "text" },
          { name: "legalLinks", type: "array", fields: linkRefFields() },
          { name: "columns", type: "json",
            admin: { description: adminText("Reserved structured footer composition for a future numbered footer design.", "Gereserveerde gestructureerde footerindeling voor een toekomstige genummerde footer.") } }
          ,{ name: "newsletter", type: "group", fields: [
            { name: "title", type: "text", maxLength: 64 },
            { name: "placeholder", type: "text", maxLength: 64 },
            { name: "submitLabel", type: "text", maxLength: 32 },
            { name: "action", type: "text", validate: validateSafeHref },
            { name: "method", type: "select", options: ["GET", "POST"] },
          ]}
        ]},
        { name: "announcement", type: "group", fields: [
          { name: "visible", type: "checkbox", defaultValue: false },
          { name: "title", type: "text",
            admin: { description: adminText("Announcement title.", "Titel van de aankondiging.") } },
          { name: "message", type: "textarea",
            admin: { description: adminText("Announcement message.", "Bericht van de aankondiging.") } },
          { name: "link", type: "group", fields: linkRefFields() },
          { name: "dismissible", type: "checkbox", defaultValue: true },
        ]},
      ]},
    { name: "consent", type: "group",
      admin: { description: adminText("Public cookie consent presentation. It is shown only when approved optional analytics is configured.", "Openbare cookietoestemming. Deze wordt alleen getoond wanneer goedgekeurde optionele analytics is geconfigureerd.") },
      fields: [
        { name: "variant", type: "select", required: true, defaultValue: DEFAULT_CONSENT_VARIANT, options: CONSENT_VARIANTS.map((value) => ({ label: "Consent 01 — full-width preferences", value })) },
        { name: "visible", type: "checkbox", defaultValue: true },
        { name: "title", type: "text", maxLength: 80 },
        { name: "message", type: "textarea", maxLength: 320 },
        { name: "acceptLabel", type: "text", maxLength: 32,
          admin: { description: adminText("Allow all optional categories.", "Alle optionele categorieën toestaan.") } },
        { name: "allowSelectionLabel", type: "text", maxLength: 32,
          admin: { description: adminText("Save the selected optional categories.", "De gekozen optionele categorieën opslaan.") } },
        { name: "rejectLabel", type: "text", maxLength: 32,
          admin: { description: adminText("Reject all optional categories.", "Alle optionele categorieën weigeren.") } },
        { name: "necessaryLabel", type: "text", maxLength: 32 },
        { name: "preferencesLabel", type: "text", maxLength: 32 },
        { name: "statisticsLabel", type: "text", maxLength: 32 },
        { name: "marketingLabel", type: "text", maxLength: 32 },
        { name: "privacyLink", type: "group", fields: linkRefFields() },
      ]},
    { name: "systemTemplates", type: "group", fields: [
      { name: "notFound", type: "group", fields: [
        { name: "heading", type: "text", maxLength: 120,
          admin: { description: adminText("Optional 404 heading.", "Optionele 404-kop.") } },
        { name: "body", type: "textarea", maxLength: 320,
          admin: { description: adminText("Optional 404 explanation.", "Optionele 404-uitleg.") } },
        { name: "primaryAction", type: "group", fields: linkRefFields(),
          admin: { description: adminText("Optional recovery link.", "Optionele herstel-link.") } },
      ]},
    ]},
    { name: "maintenance", type: "group", fields: [
      { name: "enabled", type: "checkbox", defaultValue: false },
      { name: "message", type: "textarea" }
    ]},
    { name: "privacyDisclosure", type: "group",
      admin: { description: adminText("Optional privacy and cookie document. Enable it to publish the owned template or edit the document below.", "Optioneel privacy- en cookiedocument. Schakel het in om het eigen sjabloon te publiceren of het document hieronder te bewerken.") },
      fields: [
        { name: "enabled", type: "checkbox", defaultValue: false },
        { name: "mode", type: "select", options: [
          { label: adminText("Owned template", "Eigen sjabloon"), value: "template" },
          { label: adminText("Custom document", "Eigen document"), value: "custom" },
        ], defaultValue: "template" },
        { name: "title", type: "text", maxLength: 160, defaultValue: "Privacy- en cookieverklaring" },
        richBlockField("body", "Structured document body. Used when mode is custom; template mode regenerates it from the factual fields below."),
        { name: "version", type: "text", defaultValue: "tenant-privacy-owned-2026-08-13.1" },
        { name: "effectiveAt", type: "text", defaultValue: "2026-07-10T00:00:00.000Z" },
        { name: "controller", type: "group", fields: [
          { name: "legalName", type: "text" },
          { name: "tradeName", type: "text" },
          { name: "email", type: "email" },
          { name: "privacyEmail", type: "email" },
          { name: "kvkNumber", type: "text" },
          { name: "address", type: "textarea" },
        ]},
        { name: "contactMethods", type: "json" },
        { name: "marketingTechnologies", type: "json" },
        { name: "additionalProcessors", type: "json" },
      ],
    },
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
    { name: "navigation", type: "group",
      admin: { description: adminText("Editable primary navbar and footer navigation.", "Bewerkbare primaire navbar- en footernavigatie.") },
      fields: [
        { name: "primary", type: "array", fields: navEntryFields(),
          admin: { description: adminText("Primary navbar navigation. Entries render in order; drag to reorder.", "Primaire navbarnavigatie. Items worden op volgorde weergegeven; sleep om te herschikken.") } },
        { name: "footer", type: "array", fields: navEntryFields(),
          admin: { description: adminText("Footer navigation. Entries render in order; drag to reorder.", "Footernavigatie. Items worden op volgorde weergegeven; sleep om te herschikken.") } },
      ] }
  ],
  hooks: {
    beforeValidate: [
      validateTenantExists,
      normalizeSiteSettingsAliases,
      enforceSiteSettingsCapabilities,
    ],
    afterChange: [projectSettingsToDisk]
  }
}
