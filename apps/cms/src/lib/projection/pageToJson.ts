import { sha256 } from "@noble/hashes/sha2.js"
import type { Page } from "@/payload-types"
import { EDITOR_ARRAY_ROW_KEYS } from "@/lib/editor/blockArrayFields"
import { asRecord } from "@/lib/record"
import { isSafeHref } from "@/lib/security/safeHref"
import { isPopulatedMediaShape, mediaToJson } from "@/lib/projection/media"
import { canonicalizeCtaFields } from "@/lib/projection/canonicalizeCtaFields"
import { isHeroBlockType } from "@siteinabox/contracts"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type Json = { [key: string]: JsonValue }
type PageSource = Json | Page

export type PageAnalyticsProjectionContext = {
  tenantId?: string | number | null
  tenantSlug?: string | null
  siteDomain?: string | null
  themeId?: string | null
  siteBuildId?: string | null
  manifestVersion?: string | number | null
}

/**
 * Recursive projector. Walks the tree and:
 *   - flattens populated Media relationships to {url, filename, alt, w, h}
 *   - strips `id` on every object that lives inside an `EDITOR_ARRAY_ROW_KEYS`-named
 *     array (Payload's array-row id is a DB artifact, not domain data)
 *   - drops `blockName` when it's null/undefined (Payload sets it to null
 *     when unset in the admin form; that null leaks into JSON noisily)
 */
const projectField = (v: unknown, parentArrayKey?: string, options?: { preserveBlockIds?: boolean }): JsonValue => {
  if (v == null) return null
  if (Array.isArray(v)) return v.map((item) => projectField(item, parentArrayKey, options))
  if (typeof v === "object") {
    if (isPopulatedMediaShape(v)) return mediaToJson(v) as JsonValue

    const insideArrayRow = parentArrayKey && EDITOR_ARRAY_ROW_KEYS.has(parentArrayKey)
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) {
      // Strip the Payload-assigned id on rows inside known array fields unless
      // the editor-frame wire path explicitly preserves top-level block ids.
      if (insideArrayRow && k === "id") {
        if (!(options?.preserveBlockIds && parentArrayKey === "blocks")) continue
        const wireId = typeof val === "string" ? val.trim() : typeof val === "number" ? String(val) : ""
        if (!wireId) continue
        out[k] = wireId
        continue
      }
      // Drop null/undefined/empty blockName. Payload's admin sets it to null
      // when blank; some UI versions emit "" instead. Either way the consumer
      // doesn't want to ship a no-op blockName.
      if (k === "blockName" && (val == null || val === "")) continue
      // Recurse. When the value IS the named array (e.g. blocks: [...]),
      // pass `k` so children know they're inside an array-row.
      out[k] = projectField(val, EDITOR_ARRAY_ROW_KEYS.has(k) ? k : undefined, options)
    }
    return out
  }
  return v as JsonValue
}

type LinkGroup = { href?: string | null; [key: string]: unknown }

const pruneUnsafeLinkGroup = (group: LinkGroup | null | undefined) => {
  if (!group || typeof group !== "object" || group.href == null) return group
  if (isSafeHref(group.href)) return { ...group, href: group.href.trim() }

  const { href: _href, ...rest } = group
  return rest
}

const sourceIdValues = (value: JsonValue): JsonValue => {
  if (!Array.isArray(value)) return value
  return value
    .map((entry) => {
      const row = asRecord(entry)
      return typeof row?.sourceId === "string" ? row.sourceId : entry
    })
    .filter((entry): entry is JsonValue => typeof entry === "string" && entry.trim().length > 0)
}

const mediaValues = (value: JsonValue): JsonValue => {
  if (!Array.isArray(value)) return value
  return value.map((entry) => {
    const row = asRecord(entry)
    return projectField(row?.image ?? entry)
  })
}

const featureValues = (value: JsonValue): JsonValue => {
  if (!Array.isArray(value)) return value
  return value.map((entry) => {
    const row = asRecord(entry)
    return projectField(row?.value ?? entry)
  })
}

const sanitizeBlockHrefs = (block: Json): Json => {
  if (typeof block.blockType === "string" && isHeroBlockType(block.blockType)) {
    const primaryAction = pruneUnsafeLinkGroup(asRecord(block.primaryAction) as LinkGroup | null | undefined)
    const secondaryAction = pruneUnsafeLinkGroup(asRecord(block.secondaryAction) as LinkGroup | null | undefined)
    return {
      ...block,
      ...(primaryAction ? { primaryAction } : {}),
      ...(secondaryAction ? { secondaryAction } : {}),
    } as Json
  }
  if (block.blockType === "cta") {
    const primaryAction = pruneUnsafeLinkGroup(asRecord(block.primaryAction) as LinkGroup | null | undefined)
    const secondaryAction = pruneUnsafeLinkGroup(asRecord(block.secondaryAction) as LinkGroup | null | undefined)
    return {
      ...block,
      ...(primaryAction ? { primaryAction } : {}),
      ...(secondaryAction ? { secondaryAction } : {}),
    } as Json
  }
  if (block.blockType === "contact" && Array.isArray(block.serviceArea)) {
    return {
      ...block,
      serviceArea: block.serviceArea
        .map((entry) => {
          const row = asRecord(entry)
          return typeof row?.value === "string" ? row.value : entry
        })
        .filter((entry): entry is JsonValue => typeof entry === "string" && entry.trim().length > 0),
    }
  }
  if (block.blockType === "work" && Array.isArray(block.projects)) {
    return {
      ...block,
      projects: block.projects.map((project) => {
        const record = asRecord(project)
        return record
          ? { ...record, ...(record.media ? { media: mediaValues(record.media as JsonValue) } : {}) }
          : project
      }),
    } as Json
  }
  if (block.blockType === "reviews" || block.blockType === "pricing") {
    const sourceKey = block.blockType === "reviews" ? "reviewSourceIds" : "pricingSourceIds"
    const next = { ...block, [sourceKey]: sourceIdValues(block[sourceKey] as JsonValue) } as Json
    if (block.blockType === "pricing" && Array.isArray(next.offers)) {
      next.offers = next.offers.map((offer) => {
        const record = asRecord(offer)
        return record
          ? { ...record, ...(record.features ? { features: featureValues(record.features as JsonValue) } : {}) }
          : offer
      })
    }
    return next
  }
  return block
}

const pagePathForSlug = (slug: string | null | undefined) =>
  !slug || slug === "home" || slug === "index" ? "/" : `/${slug}`

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const contentSignature = (block: Json): string =>
  Array.from(sha256(new TextEncoder().encode(stableStringify(block))), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("").slice(0, 24)

const blockAnalytics = (block: Json, index: number, pageSlug: string) => {
  const sectionType = typeof block.blockType === "string" ? block.blockType : "unknown"
  const anchor = typeof block.anchor === "string" && block.anchor.trim() ? block.anchor.trim() : null
  const stored = block.analytics && typeof block.analytics === "object" && !Array.isArray(block.analytics)
    ? block.analytics as Record<string, JsonValue>
    : {}
  return {
    ...stored,
    sectionId: anchor ?? `${pageSlug}:${index}:${sectionType}`,
    sectionType,
    sectionPosition: index,
    sectionAnchor: anchor,
    // Visual variants are intentionally absent while the first approved
    // first-party variant is being designed. Keep legacy stored values out of
    // the public wire/analytics shape instead of reviving them implicitly.
    variant: null,
    contentSignature: contentSignature(block),
  }
}

export type PageToJsonOptions = {
  preserveBlockIds?: boolean
}

export function pageToJson(
  doc: PageSource,
  analyticsContext: PageAnalyticsProjectionContext = {},
  options: PageToJsonOptions = {},
): Json {
  const pageSlug = String(doc.slug ?? "")
  const pagePath = pagePathForSlug(pageSlug)
  const blocks = ((doc.blocks ?? []) as Json[])
    .map((b) => {
      const projected = projectField(b, "blocks", options)
      return sanitizeBlockHrefs(canonicalizeCtaFields(asRecord(projected) ?? {}) as Json)
    })
    .map((block, index) => ({
      ...block,
      analytics: blockAnalytics(block, index, pageSlug),
    }))

  return {
    title: doc.title,
    slug: doc.slug,
    analytics: {
      schemaVersion: 1,
      tenantId: analyticsContext.tenantId != null ? String(analyticsContext.tenantId) : null,
      tenantSlug: analyticsContext.tenantSlug ?? null,
      siteId: analyticsContext.tenantId != null ? String(analyticsContext.tenantId) : null,
      siteDomain: analyticsContext.siteDomain ?? null,
      pageId: doc.id != null ? String(doc.id) : null,
      pageSlug,
      pagePath,
      themeId: analyticsContext.themeId ?? null,
      siteBuildId: analyticsContext.siteBuildId ?? null,
      manifestVersion: analyticsContext.manifestVersion ?? null,
    },
    blocks,
    ...(doc.seo ? { seo: projectField(doc.seo) } : {}),
    updatedAt: doc.updatedAt
  }
}
