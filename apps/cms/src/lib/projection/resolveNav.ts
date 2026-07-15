import { isSafeHref } from "@/lib/security/safeHref"

// OBS-20 — resolve stored navigation entries into the flat link list the
// site renderer consumes. The discriminated union (page | section | custom)
// is internal to the CMS; `site.json` only ever sees `{ label, href, external }`.

/** A navigation entry as stored on `SiteSettings.navHeader` / `navFooter`. */
export type NavEntry = {
  type: "page" | "section" | "custom" | "group"
  /** Relationship value — bare id (depth 0) or populated object (depth 1+). */
  page?: { id: number | string } | number | string | null
  anchor?: string | null
  url?: string | null
  label?: string | null
  external?: boolean | null
  description?: string | null
  children?: Array<{
    label?: string | null
    href?: string | null
    description?: string | null
    icon?: "backpack" | "cake-slice" | "coffee" | "grape" | "hotel" | "ice-cream" | "map-pin" | "package" | "pizza" | "plane" | "sandwich" | "smile" | null
    external?: boolean | null
  }> | null
}

/** Minimal page shape `resolveNav` needs to resolve page / section entries. */
export type NavPage = { id: number | string; slug: string; title: string }

/** A nav link as emitted into `site.json` — flat, type-erased. */
export type ResolvedNavLink = {
  label: string
  href?: string
  external: boolean
  description?: string
  icon?: NonNullable<NonNullable<NavEntry["children"]>[number]["icon"]>
  children?: ResolvedNavLink[]
}

const pageIdOf = (ref: NavEntry["page"]): string | null => {
  if (ref == null) return null
  if (typeof ref === "object") return ref.id != null ? String(ref.id) : null
  return String(ref)
}

// "index" and "home" are the conventional root-page slugs — they render at
// "/" rather than "/index". Any other slug renders at "/<slug>".
const pathForPage = (slug: string): string =>
  slug === "index" || slug === "home" ? "/" : `/${slug}`

/**
 * Resolve a nav list against the set of currently-published pages.
 *
 * - `page` entries whose target is draft/deleted are omitted (no published
 *   destination exists). Label defaults to the page title.
 * - `section` entries with no `page` are same-page anchors (`#anchor`) — the
 *   onepager case. With a `page`, they resolve to `/<slug>#anchor`; if that
 *   page is draft/deleted the entry is omitted.
 * - `custom` entries pass through their url + external flag verbatim.
 *
 * Entries missing their required field (anchor / url / label) are skipped
 * rather than emitted broken.
 */
export function resolveNav(
  entries: NavEntry[] | null | undefined,
  publishedPages: NavPage[],
): ResolvedNavLink[] {
  const byId = new Map(publishedPages.map((p) => [String(p.id), p]))
  const out: ResolvedNavLink[] = []

  for (const e of entries ?? []) {
    if (e.type === "page") {
      const page = byId.get(pageIdOf(e.page) ?? "")
      if (!page) continue
      const label = e.label?.trim() || page.title
      out.push({ label, href: pathForPage(page.slug), external: false })
    } else if (e.type === "section") {
      const anchor = e.anchor?.trim()
      const label = e.label?.trim()
      if (!anchor || !label) continue
      const page = e.page != null ? byId.get(pageIdOf(e.page) ?? "") : undefined
      if (e.page != null && !page) continue
      const base = page ? pathForPage(page.slug) : ""
      out.push({ label, href: `${base}#${anchor}`, external: false })
    } else if (e.type === "custom") {
      const url = e.url?.trim()
      const label = e.label?.trim()
      if (!url || !label) continue
      if (!isSafeHref(url)) continue
      out.push({ label, href: url, external: !!e.external })
    } else if (e.type === "group") {
      const label = e.label?.trim()
      const children = (e.children ?? []).flatMap((child) => {
        const childLabel = child.label?.trim()
        const href = child.href?.trim()
        if (!childLabel || !href || !isSafeHref(href)) return []
        return [{
          label: childLabel,
          href,
          external: !!child.external,
          ...(child.description?.trim() ? { description: child.description.trim() } : {}),
          ...(child.icon ? { icon: child.icon } : {}),
        }]
      })
      if (!label || children.length === 0) continue
      out.push({ label, external: false, ...(e.description?.trim() ? { description: e.description.trim() } : {}), children })
    }
  }
  return out
}
