type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0

const isEmptyCtaLink = (value: unknown): boolean =>
  value == null || (isRecord(value) && !hasText(value.label) && !hasText(value.href))

const withoutEmptyAction = (value: unknown, field: string): unknown => {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, field) || !isEmptyCtaLink(value[field])) return value
  const next = { ...value }
  delete next[field]
  return next
}

const withoutEmptyActions = (value: unknown, field: string): unknown =>
  Array.isArray(value) ? value.map((entry) => withoutEmptyAction(entry, field)) : value

/**
 * Payload rehydrates unset optional action groups as `{ label: null, href: null }`
 * and optional block arrays as `[]`. Keep those storage details out of editor
 * writes and published snapshots. Non-empty values remain untouched so
 * canonical block validation can reject genuinely unsupported content instead
 * of hiding it.
 */
export function canonicalizeCtaFields<T extends JsonRecord>(block: T): T {
  const next: JsonRecord = { ...block }

  if (block.blockType === "cta" || block.blockType === "hero") {
    for (const field of ["primaryAction", "secondaryAction"] as const) {
      if (Object.prototype.hasOwnProperty.call(next, field) && isEmptyCtaLink(next[field])) delete next[field]
    }
  }

  if (block.blockType === "hero") {
    if (block.variant !== "hero-01") delete next.highlights
    if (block.variant !== "hero-02") delete next.serviceHighlights
    if (Array.isArray(next["serviceHighlights"])) {
      next["serviceHighlights"] = next["serviceHighlights"].map((entry) => {
        let normalized = withoutEmptyAction(entry, "primaryAction")
        normalized = withoutEmptyAction(normalized, "secondaryAction")
        return normalized
      })
    }
  }

  if (block.blockType === "services") next["items"] = withoutEmptyActions(next["items"], "action")
  if (block.blockType === "work") next["projects"] = withoutEmptyActions(next["projects"], "action")
  if (block.blockType === "pricing") next["offers"] = withoutEmptyActions(next["offers"], "action")
  if (block.blockType === "contact" && Object.prototype.hasOwnProperty.call(next, "bookingAction") && isEmptyCtaLink(next.bookingAction)) {
    delete next.bookingAction
  }

  return next as T
}
