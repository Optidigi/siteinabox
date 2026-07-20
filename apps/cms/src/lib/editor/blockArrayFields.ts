/**
 * Single source of truth for Payload array-row field names in the page editor.
 *
 * `ensureItemIds` stamps wire `id`s on rows in these arrays; `pageToJson` strips
 * those ids (and Payload-assigned row ids) before publish contract validation.
 */

/** Top-level block array fields that receive editor wire ids. */
export const BLOCK_TOP_LEVEL_ARRAYS: Readonly<Record<string, readonly string[]>> = {
  hero: ["pills", "logos", "stats", "links"],
  featureList: ["features"],
  testimonials: ["items"],
  faq: ["items"],
  contactSection: ["fields"],
  contactDetails: ["items"],
  newsletter: ["benefits"],
  pricing: ["plans"],
  stats: ["items"],
  logoCloud: ["logos"],
  gallery: ["images"],
  bentoGrid: ["items"],
  contentSection: ["features"],
  timeline: ["items"],
  team: ["members"],
  blogCards: ["posts"],
}

/** Nested array fields inside parent array rows (parent → child field names). */
export const NESTED_ARRAY_FIELDS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  pricing: { plans: ["features"] },
  timeline: { items: ["tags"] },
}

/**
 * Array-row keys stripped during JSON projection but not stamped by `ensureItemIds`.
 * Document each entry when adding.
 */
export const PROJECTION_ONLY_ARRAY_ROW_KEYS = [
  /** ContactSection.provider.hiddenFields — provider config, not editor-drilled */
  "hiddenFields",
  /** SiteSettings.contact.social — embedded on pages only during projection */
  "social",
] as const

const collectMapArrayFieldNames = (): string[] => {
  const names = new Set<string>()
  for (const fields of Object.values(BLOCK_TOP_LEVEL_ARRAYS)) {
    for (const field of fields) names.add(field)
  }
  for (const nested of Object.values(NESTED_ARRAY_FIELDS)) {
    for (const [parentField, childFields] of Object.entries(nested)) {
      names.add(parentField)
      for (const childField of childFields) names.add(childField)
    }
  }
  return [...names]
}

/** Union of every array-row key `pageToJson` must treat as id-strippable. */
export function editorArrayRowKeys(): ReadonlySet<string> {
  return new Set([
    "blocks",
    ...PROJECTION_ONLY_ARRAY_ROW_KEYS,
    ...collectMapArrayFieldNames(),
  ])
}

/** Cached set for hot projection paths (e.g. `pageToJson`). */
export const EDITOR_ARRAY_ROW_KEYS: ReadonlySet<string> = editorArrayRowKeys()
