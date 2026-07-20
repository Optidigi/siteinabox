export function referenceRootClassName(contents) {
  return contents.match(/return\s*\(\s*<(?:section|main|div)[^>]*className=["']([^"']+)["']/s)?.[1]
}

const semanticKind = {
  banner: { role: "chrome", area: "banner" },
  blog: { role: "block", blockType: "blogCards" },
  "carousel-block": { role: "block", blockType: "gallery" },
  contact: { role: "block", blockType: "contactSection" },
  cta: { role: "block", blockType: "cta" },
  faq: { role: "block", blockType: "faq" },
  features: { role: "block", blockType: "featureList" },
  footer: { role: "chrome", area: "footer" },
  hero: { role: "block", blockType: "hero" },
  integrations: { role: "block", blockType: "logoCloud" },
  "logo-cloud": { role: "block", blockType: "logoCloud" },
  navbar: { role: "chrome", area: "header" },
  pricing: { role: "block", blockType: "pricing" },
  stats: { role: "block", blockType: "stats" },
  team: { role: "block", blockType: "team" },
  testimonials: { role: "block", blockType: "testimonials" },
  timeline: { role: "block", blockType: "contentSection" },
  "not-found": { role: "systemTemplate", kind: "notFound" },
}

const fieldSets = {
  hero: {
    eyebrow: ["richtext", "optional"], headline: ["richtext", "required"], subheadline: ["richtext", "optional"],
    pills: ["repeater", "optional", true], links: ["repeater", "optional", true], cta: ["cta", "optional"],
    secondary: ["cta", "optional"], image: ["image", "optional"], stats: ["repeater", "optional", true],
    trustLabel: ["text", "optional"], logos: ["repeater", "optional", true],
  },
  featureList: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    image: ["image", "optional"], features: ["repeater", "required", true],
  },
  testimonials: { title: ["text", "optional"], intro: ["text", "optional"], logo: ["image", "optional"], items: ["repeater", "required", true] },
  faq: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  cta: {
    eyebrow: ["richtext", "optional"], headline: ["richtext", "required"], description: ["richtext", "optional"],
    primary: ["cta", "optional"], secondary: ["cta", "optional"], backgroundImage: ["image", "optional"],
  },
  contactSection: {
    title: ["richtext", "optional"], description: ["richtext", "optional"], formName: ["text", "required"],
    submitLabel: ["text", "optional"], fields: ["repeater", "required", true], provider: ["runtime", "optional"],
  },
  pricing: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    plans: ["repeater", "required", true],
  },
  stats: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  logoCloud: { title: ["richtext", "optional"], intro: ["richtext", "optional"], logos: ["repeater", "required", true], cta: ["cta", "optional"] },
  gallery: { title: ["richtext", "optional"], intro: ["richtext", "optional"], images: ["repeater", "required", true], cta: ["cta", "optional"] },
  team: { title: ["richtext", "optional"], intro: ["richtext", "optional"], members: ["repeater", "required", true] },
  blogCards: { title: ["richtext", "optional"], intro: ["richtext", "optional"], posts: ["repeater", "required", true], cta: ["cta", "optional"], secondary: ["cta", "optional"] },
  contentSection: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    body: ["richtext", "required"], features: ["repeater", "optional", true], bridge: ["richtext", "optional"],
    secondaryTitle: ["richtext", "optional"], secondaryBody: ["richtext", "optional"], image: ["image", "optional"], cta: ["cta", "optional"],
  },
  timeline: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  contactDetails: { title: ["richtext", "optional"], description: ["richtext", "optional"], items: ["repeater", "required", true] },
}
const allStructuredFields = [...new Set(Object.values(fieldSets).flatMap((fields) => Object.keys(fields)))]

const chromeCapabilities = {
  "navbar-01": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-02": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: true, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-03": { navigation: "mixed", primaryItems: { min: 0, max: 4 }, groupItems: { min: 0, max: 3 }, childItems: { min: 1, max: 6 }, cta: true, secondaryAction: false, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 90 },
  "navbar-04": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-05": { navigation: "none", primaryItems: { min: 0, max: 0 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: true, themeToggle: false, mobileMenu: [], labelMaxLength: 32, descriptionMaxLength: 0 },
  "footer-01": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-02": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-03": { columns: { min: 0, max: 5 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: true, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-04": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: true, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-05": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-06": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-07": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
}

function chromeSlots(area, upstreamName) {
  if (area === "header") {
    const capability = chromeCapabilities[upstreamName]
    return {
      logo: { kind: "image", status: "optional", repeated: false },
      links: { kind: "repeater", status: capability.navigation === "none" ? "inactive" : "optional", repeated: true, reason: capability.navigation === "none" ? "The pinned search navbar has no primary-navigation region." : undefined },
      groups: { kind: "repeater", status: capability.navigation === "mixed" ? "optional" : "inactive", repeated: true, reason: capability.navigation === "mixed" ? undefined : "The pinned navbar has no flyout-navigation region." },
      cta: { kind: "cta", status: capability.cta ? "optional" : "inactive", repeated: false },
      secondaryAction: { kind: "cta", status: capability.secondaryAction ? "optional" : "inactive", repeated: false, reason: capability.secondaryAction ? undefined : "The pinned navbar exposes one primary action only." },
      search: { kind: "runtime", status: capability.search ? "optional" : "inactive", repeated: false, reason: capability.search ? undefined : "The pinned navbar has no search control." },
      themeToggle: { kind: "runtime", status: capability.themeToggle ? "optional" : "inactive", repeated: false, reason: capability.themeToggle ? undefined : "The pinned navbar has no theme-toggle control." },
      behavior: { kind: "runtime", status: "optional", repeated: false },
      activeMode: { kind: "runtime", status: capability.navigation === "none" ? "inactive" : "optional", repeated: false, reason: capability.navigation === "none" ? "No primary links can be active in this variant." : undefined },
      mobileMenu: { kind: "runtime", status: capability.mobileMenu.length ? "optional" : "inactive", repeated: false, reason: capability.mobileMenu.length ? undefined : "The pinned search navbar has no mobile navigation menu." },
    }
  }
  if (area === "footer") {
    const capability = chromeCapabilities[upstreamName]
    return {
      logo: { kind: "image", status: "optional", repeated: false },
      tagline: { kind: "text", status: "optional", repeated: false },
      columns: { kind: "repeater", status: "optional", repeated: true },
      legalLinks: { kind: "repeater", status: "optional", repeated: true },
      copyright: { kind: "text", status: "optional", repeated: false },
      newsletter: { kind: "runtime", status: capability.newsletter ? "optional" : "inactive", repeated: false, reason: capability.newsletter ? undefined : "The pinned footer has no newsletter form region." },
      social: { kind: "repeater", status: capability.social ? "optional" : "inactive", repeated: true },
    }
  }
  return { title: { kind: "text", status: "optional", repeated: false }, message: { kind: "text", status: "required", repeated: false }, link: { kind: "cta", status: "optional", repeated: false }, dismissible: { kind: "runtime", status: "optional", repeated: false } }
}

function scopeNotFound03SvgIds(contents) {
  let adapted = contents
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-first" />')
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-second" />')
    .replace(
      "export const Number4 = (props: SVGProps<SVGSVGElement>) => (",
      'export const Number4 = ({ idPrefix = "provider-404", ...props }: SVGProps<SVGSVGElement> & { idPrefix?: string }) => (',
    )
    .replaceAll('clipPath="url(#cs_clip_1_number-4)"', 'clipPath={`url(#${idPrefix}-clip)`}')
    .replaceAll('id="cs_mask_1_number-4"', 'id={`${idPrefix}-mask`}')
    .replaceAll('mask="url(#cs_mask_1_number-4)"', 'mask={`url(#${idPrefix}-mask)`}')
    .replaceAll('filter="url(#filter0_f_880_3334)"', 'filter={`url(#${idPrefix}-blur)`}')
    .replaceAll('filter="url(#cs_noise_1_number-4)"', 'filter={`url(#${idPrefix}-noise)`}')
    .replaceAll('id="filter0_f_880_3334"', 'id={`${idPrefix}-blur`}')
    .replaceAll('id="cs_clip_1_number-4"', 'id={`${idPrefix}-clip`}')
    .replaceAll('id="cs_noise_1_number-4"', 'id={`${idPrefix}-noise`}')
  return adapted
}

function slotsFor(kind, upstreamName, activeFields = []) {
  if (kind.role === "chrome") {
    return chromeSlots(kind.area, upstreamName)
  }
  if (kind.role === "systemTemplate") return {
    title: { kind: "text", status: "required", repeated: false },
    description: { kind: "text", status: "optional", repeated: false },
    actions: { kind: "repeater", status: "optional", repeated: true },
  }
  const fields = fieldSets[kind.blockType]
  const active = new Set(activeFields)
  return Object.fromEntries(allStructuredFields.map((field) => {
    const definition = fields[field]
    if (!definition) return [field, { kind: "inactive", status: "inactive", repeated: false, reason: `The ${kind.blockType} semantic contract does not expose this field.` }]
    if (!active.has(field)) return [field, { kind: definition[0], status: "inactive", repeated: definition[2] ?? false, reason: `The pinned ${upstreamName} view has no region for this field.` }]
    const [slotKind, status, repeated = false] = definition
    return [field, { kind: slotKind, status, repeated, ...(repeated && status === "required" ? { minItems: 1 } : {}) }]
  }))
}

export function semanticForVariant(category, upstreamName) {
  if (category === "contact" && upstreamName !== "contact-02") {
    return { role: "block", blockType: "contactDetails" }
  }
  if (category === "timeline") {
    return { role: "block", blockType: "timeline" }
  }
  return semanticKind[category]
}

export { semanticKind, fieldSets, allStructuredFields, chromeCapabilities, chromeSlots, slotsFor }
