type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0

const isEmptyCtaLink = (value: unknown): boolean =>
  value == null || (isRecord(value) && !hasText(value.label) && !hasText(value.href))

/**
 * Payload rehydrates an unset CTA group as `{ label: null, href: null }`.
 * Keep that storage detail out of editor writes, generated content, and
 * published snapshots. Non-empty values remain untouched so provider slot
 * validation can reject genuinely unsupported content instead of hiding it.
 */
export function canonicalizeCtaFields<T extends JsonRecord>(block: T): T {
  if (block.blockType !== "cta") return block

  const next = { ...block }
  for (const field of ["primary", "secondary"] as const) {
    if (Object.prototype.hasOwnProperty.call(next, field) && isEmptyCtaLink(next[field])) {
      delete next[field]
    }
  }
  return next as T
}
