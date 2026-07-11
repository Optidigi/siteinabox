import type { AnalyticsEventProperties, CmsEventName } from "./events"

const MAX_TEXT = 96
const CONTACT_DATA = /(?:@|\b(?:mailto|tel):|\+?\d[\d\s().-]{6,})/i

const ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/legal\/(releases|requirements|deliveries|acceptances)\/[^/]+$/, "/legal/$1/[id]"],
  [/^\/sites\/[^/]+\/pages\/new$/, "/sites/[slug]/pages/new"],
  [/^\/sites\/[^/]+\/pages\/edit\/[^/]+$/, "/sites/[slug]/pages/edit/[slug]"],
  [/^\/sites\/[^/]+\/pages\/[^/]+$/, "/sites/[slug]/pages/[id]"],
  [/^\/sites\/[^/]+\/(users|media|forms|settings|analytics|navigation|edit|onboarding)$/, "/sites/[slug]/$1"],
  [/^\/sites\/[^/]+$/, "/sites/[slug]"],
  [/^\/pages\/new$/, "/pages/new"],
  [/^\/pages\/edit\/[^/]+$/, "/pages/edit/[slug]"],
  [/^\/pages\/[^/]+$/, "/pages/[id]"],
  [/^\/users\/[^/]+\/edit$/, "/users/[id]/edit"],
]

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  if (!cleaned || CONTACT_DATA.test(cleaned)) return null
  return cleaned.slice(0, MAX_TEXT)
}

export const normalizeCmsAnalyticsRoute = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.startsWith("/")) return null
  const pathname = text(value.split(/[?#]/, 1)[0]) || "/"
  const match = ROUTE_PATTERNS.find(([pattern]) => pattern.test(pathname))
  return match ? pathname.replace(match[0], match[1]) : pathname.slice(0, MAX_TEXT)
}

const COMMON_KEYS = new Set([
  "cms_route", "cms_referrer_route", "cms_device_type", "cms_element_role", "cms_referrer_type",
])

const EVENT_KEYS: Partial<Record<CmsEventName, Set<string>>> = {
  cms_route_viewed: new Set(),
  cms_action_clicked: new Set(["cms_action", "cms_action_target"]),
  cms_page_saved: new Set(["cms_result", "cms_duration_ms", "cms_dirty_count"]),
  cms_page_save_failed: new Set(["cms_result", "cms_error_type", "cms_duration_ms", "cms_dirty_count"]),
  cms_media_uploaded: new Set(["cms_result", "cms_duration_ms"]),
  cms_media_upload_failed: new Set(["cms_result", "cms_error_type", "cms_duration_ms"]),
  cms_form_status_updated: new Set(["cms_action", "cms_result"]),
  cms_settings_saved: new Set(["cms_result", "cms_duration_ms"]),
  cms_editor_friction: new Set(["cms_error_type", "cms_field_type", "cms_block_type", "cms_duration_ms"]),
}

/** Enforces purpose limitation on authenticated browser events before PostHog capture. */
export const applyCmsEventPropertyPolicy = (
  event: CmsEventName,
  properties: AnalyticsEventProperties,
): AnalyticsEventProperties => {
  const allowed = new Set([...COMMON_KEYS, ...(EVENT_KEYS[event] ?? [])])
  const result: AnalyticsEventProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) continue
    if (key === "cms_route" || key === "cms_referrer_route" || key === "cms_action_target") {
      const route = normalizeCmsAnalyticsRoute(value)
      if (route) result[key] = route
      continue
    }
    if (typeof value === "string") {
      const cleaned = text(value)
      if (cleaned) result[key] = cleaned
      continue
    }
    if (typeof value === "number" || typeof value === "boolean") result[key] = value
  }

  return result
}
