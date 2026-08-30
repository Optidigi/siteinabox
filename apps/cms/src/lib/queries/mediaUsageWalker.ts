import type { Page, SiteSetting } from "@/payload-types"

/**
 * Pure walker for the media-usage map. Lives in its own file (no
 * server-only side effects) so unit tests can import it without
 * pulling in Payload runtime.
 *
 * Adding a new block type that carries a media upload? Extend the
 * switch inside the page loop. Each branch should be a few lines:
 * pull the ids out, normalize, record into the map.
 */

export type MediaPageRef = { id: number | string; title: string; slug: string | null }
export type MediaUsageEntry = { pages: MediaPageRef[]; settings: boolean }
export type MediaUsageMap = Map<number | string, MediaUsageEntry>

// Relationship/upload values arrive as either a primitive id or (when
// depth>=1) a populated object containing .id. Normalize so the walker
// keys the Map consistently.
function normalizeId(v: unknown): number | string | null {
  if (v == null) return null
  if (typeof v === "object") {
    const id = (v as { id?: number | string }).id
    return id == null ? null : id
  }
  if (typeof v === "number" || typeof v === "string") return v
  return null
}

function record(map: MediaUsageMap, mediaId: number | string | null, mutate: (entry: MediaUsageEntry) => void) {
  if (mediaId == null) return
  const entry = map.get(mediaId) ?? { pages: [], settings: false }
  mutate(entry)
  map.set(mediaId, entry)
}

export function buildMediaUsageMap(
  pages: Pick<Page, "id" | "title" | "slug" | "seo" | "blocks">[],
  settings: Pick<SiteSetting, "branding"> | null
): MediaUsageMap {
  const map: MediaUsageMap = new Map()

  for (const page of pages) {
    const ref: MediaPageRef = { id: page.id, title: page.title, slug: page.slug ?? null }

    // SEO Open Graph image (top-level group on Page).
    const og = normalizeId((page.seo as { ogImage?: unknown } | undefined)?.ogImage)
    record(map, og, (e) => {
      if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
    })

    const blocks = (page.blocks as Array<{ blockType?: string } & Record<string, unknown>> | null | undefined) ?? []
    for (const block of blocks) {
      switch (block.blockType) {
        case "hero": {
          const id = normalizeId((block as { image?: unknown }).image)
          record(map, id, (e) => {
            if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
          })
          const highlights = (block as { serviceHighlights?: Array<{ image?: unknown }> }).serviceHighlights ?? []
          for (const highlight of highlights) {
            const highlightId = normalizeId(highlight.image)
            record(map, highlightId, (e) => {
              if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
            })
          }
          break
        }
        case "about": {
          const id = normalizeId((block as { portrait?: unknown }).portrait)
          record(map, id, (e) => {
            if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
          })
          break
        }
        case "work": {
          const projects = (block as { projects?: Array<Record<string, unknown>> }).projects ?? []
          for (const project of projects) {
            const media = (project as { media?: Array<Record<string, unknown>> }).media ?? []
            for (const item of media) {
              const id = normalizeId((item as { image?: unknown }).image)
              record(map, id, (e) => {
                if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
              })
            }
          }
          break
        }
        case "cta": {
          const id = normalizeId((block as { image?: unknown }).image)
          record(map, id, (e) => {
            if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
          })
          break
        }
        case "contact": {
          const id = normalizeId((block as { image?: unknown }).image)
          record(map, id, (e) => {
            if (!e.pages.some((p) => p.id === ref.id)) e.pages.push(ref)
          })
          break
        }
        // Services, process, reviews, pricing, FAQ and rich text
        // currently carry no upload fields. Add cases here as they grow.
        default:
          break
      }
    }
  }

  // Site settings: branding media fields.
  const logo = normalizeId((settings?.branding as { logo?: unknown } | undefined)?.logo)
  record(map, logo, (e) => { e.settings = true })
  const favicon = normalizeId((settings?.branding as { favicon?: unknown } | undefined)?.favicon)
  record(map, favicon, (e) => { e.settings = true })

  return map
}
