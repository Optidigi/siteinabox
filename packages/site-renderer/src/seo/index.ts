import type { MediaRef, Page, SiteSettings } from "@siteinabox/contracts"
import { defaultMediaResolver, type MediaResolver } from "../media"
import { extractRichText } from "../rich-text"

export type SeoMetadata = {
  title: string
  description?: string
  canonical?: string
  openGraph?: {
    title: string
    description?: string
    url?: string
    images?: Array<{ url: string; alt?: string }>
  }
}

function joinUrl(base: string | undefined, path: string): string | undefined {
  if (!base) return undefined
  try {
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString()
  } catch {
    return undefined
  }
}

function mediaUrl(media: MediaRef, resolver?: MediaResolver): { url: string; alt?: string } | null {
  const resolved = resolver ? resolver(media) : defaultMediaResolver(media)
  if (!resolved) return null
  if (typeof resolved === "string") return { url: resolved }
  return { url: resolved.src, alt: resolved.alt }
}

export function pageDescriptionFromBlocks(page: Page): string | undefined {
  for (const block of page.blocks) {
    if (block.blockType === "hero" && block.subheadline) return extractRichText(block.subheadline)
    if (block.blockType === "richText") return extractRichText(block.body)
  }
  return undefined
}

export function buildPageSeoMetadata({
  page,
  settings,
  mediaResolver,
}: {
  page: Page
  settings: SiteSettings
  mediaResolver?: MediaResolver
}): SeoMetadata {
  const title = page.seo?.title?.trim() || page.title
  const description = page.seo?.description?.trim() || pageDescriptionFromBlocks(page) || settings.description || undefined
  const path = page.slug === "index" || page.slug === "/" ? "/" : `/${page.slug.replace(/^\/+/, "")}`
  const canonical = joinUrl(settings.siteUrl, path)
  const ogImage = mediaUrl(page.seo?.ogImage ?? settings.branding?.logo ?? null, mediaResolver)

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      images: ogImage ? [{ url: ogImage.url, alt: ogImage.alt }] : undefined,
    },
  }
}
