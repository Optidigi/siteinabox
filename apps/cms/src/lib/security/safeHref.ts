const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"])
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export const isSafeHref = (value: unknown): value is string => {
  if (typeof value !== "string") return false

  const href = value.trim()
  if (!href) return false
  if (CONTROL_CHARS.test(href)) return false
  if (href.includes("\\")) return false
  if (href.startsWith("//")) return false

  if (href.startsWith("#")) {
    return href.length > 1 && !href.startsWith("#/")
  }

  if (href.startsWith("/")) {
    return href.length === 1 || !href.startsWith("//")
  }

  try {
    const url = new URL(href)
    if (!SAFE_SCHEMES.has(url.protocol)) return false
    if (url.protocol === "tel:") {
      const number = `${url.pathname}${url.username}`.replace(/^\/*/, "")
      return /\d{6,}/.test(number)
    }
    if (url.protocol === "mailto:") {
      const address = url.pathname || `${url.username}${url.hostname ? `@${url.hostname}` : ""}`
      return address.includes("@")
    }
    return true
  } catch {
    return false
  }
}

export const validateSafeHref = (value: unknown): true | string => {
  if (value == null || value === "") return true
  return isSafeHref(value)
    ? true
    : "Use http, https, mailto, tel, an in-page anchor, or a single-slash relative path."
}
