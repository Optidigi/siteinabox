/** @param {string} value */
export function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** @param {string} pathname */
export function pathnameToSlug(pathname) {
  const cleanPath = pathname.split(/[?#]/, 1)[0] ?? "/"
  const withoutSlashes = cleanPath.replace(/^\/+|\/+$/g, "")
  return withoutSlashes === "" ? "index" : safeDecodeURIComponent(withoutSlashes)
}
