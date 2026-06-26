import type { MediaRef } from "@siteinabox/contracts"

export type ResolvedMedia = {
  src: string
  alt?: string
}

export type MediaResolver = (media: MediaRef) => ResolvedMedia | string | null | undefined

export function defaultMediaResolver(media: MediaRef): ResolvedMedia | null {
  if (!media) return null
  if (typeof media === "string") return { src: media }
  if (typeof media === "number") return null
  if (media.url) return { src: media.url, alt: media.alt ?? undefined }
  if (media.filename) return { src: `/media/${media.filename}`, alt: media.alt ?? undefined }
  return null
}

export function resolveMedia(media: MediaRef, resolver?: MediaResolver): ResolvedMedia | null {
  const resolved = resolver ? resolver(media) : defaultMediaResolver(media)
  if (!resolved) return null
  if (typeof resolved === "string") return { src: resolved }
  return resolved
}
