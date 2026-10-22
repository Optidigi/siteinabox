/** Frame links select only a page inside the current authorized preview route. */
export function builderPreviewNavigation(href: string, clientSlug: string, origin: string): { pageSlug: string; hash: string } | null {
  if (href.length > 4096) return null
  let url: URL
  try { url = new URL(href, origin) } catch { return null }
  if (url.origin !== origin || url.username || url.password) return null
  let path = url.pathname
  const prefixes = [`/${clientSlug}/pages/`, `/renderer-frame/preview/${encodeURIComponent(clientSlug)}/`]
  const prefix = prefixes.find(value => path.startsWith(value))
  if (prefix) path = path.slice(prefix.length)
  let pageSlug: string
  try { pageSlug = decodeURIComponent(path.replace(/^\/+|\/+$/g, "")) } catch { return null }
  if (pageSlug !== "" && !/^[a-z0-9-]{1,150}$/.test(pageSlug)) return null
  return { pageSlug, hash: url.hash }
}
