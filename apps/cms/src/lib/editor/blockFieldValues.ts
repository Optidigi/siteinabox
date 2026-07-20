import type { LinkRef, MediaRef } from "@siteinabox/contracts"
import type { RtRoot } from "@/lib/richText/RtNode"

/** CTA / link-group value edited in block inspectors. */
export type EditorCtaValue = LinkRef

/** Media field value in block inspectors (contract media ref or populated object). */
export type EditorMediaValue = MediaRef

/** Icon field value in block inspectors. */
export type EditorIconValue = string | null

/** Repeater row with optional stable wire id from E1. */
export type EditorArrayItem = Record<string, unknown> & {
  id?: string | number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)

const isRtRoot = (value: unknown): value is RtRoot =>
  isRecord(value) && value.type === "root" && typeof value.version === "number"

export const asRtRootValue = (value: unknown): RtRoot | undefined =>
  isRtRoot(value) ? value : undefined

export const emptyCtaValue = (): EditorCtaValue => ({})

export const asCtaValue = (value: unknown): EditorCtaValue => {
  if (!isRecord(value)) return emptyCtaValue()
  return {
    label: typeof value.label === "string" ? value.label : null,
    href: typeof value.href === "string" ? value.href : null,
    external: typeof value.external === "boolean" ? value.external : null,
  }
}

export const updateCtaLabel = (cta: EditorCtaValue, label: string): EditorCtaValue => ({
  ...cta,
  label,
})

export const updateCtaHref = (cta: EditorCtaValue, href: string): EditorCtaValue => ({
  ...cta,
  href,
})

export const asIconValue = (value: unknown): EditorIconValue =>
  typeof value === "string" && value.trim() ? value : null

/** Resolve a display URL for inspector previews (desktop and mobile). */
export const resolveMediaDisplayUrl = (value: EditorMediaValue | unknown): string | null => {
  if (value == null) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return null
  if (!isRecord(value)) return null
  if (typeof value.url === "string" && value.url) return value.url
  if (typeof value.filename === "string" && value.filename) return `/media/${value.filename}`
  return null
}
