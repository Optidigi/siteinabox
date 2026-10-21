export type AccountLinkLocale = "nl" | "en"

export function accountLinkLocale(headers?: Headers): AccountLinkLocale {
  const cookie = headers?.get("cookie")?.match(/(?:^|;\s*)siab-locale=(nl|en)(?:;|$)/)?.[1]
  return cookie === "en" || !cookie && headers?.get("accept-language")?.toLowerCase().startsWith("en") ? "en" : "nl"
}
