import type { AnalyticsEventProperties } from "./events"

const EMAIL_OR_PHONE_SCHEME = /^(mailto|tel):/i

const SAFE_KEYS = new Set([
  "schema_version",
  "analytics_surface",
  "site_kind",
  "environment",
  "admin_host",
  "tenant_id",
  "tenant_slug",
  "tenant_name",
  "site_id",
  "site_domain",
  "page_id",
  "page_slug",
  "page_path",
  "theme_id",
  "site_build_id",
  "manifest_version",
  "section_id",
  "section_type",
  "section_position",
  "section_anchor",
  "provider_variant",
  "block_preset_id",
  "content_signature",
  "action_id",
  "action_role",
  "action_label",
  "target_type",
  "target_domain",
  "target_path",
  "referrer_domain",
  "referrer_type",
  "device_type",
  "session_id",
  "journey_step_index",
  "journey_step",
  "journey_from",
  "scroll_depth",
  "page_duration_ms",
  "component_type",
  "component_role",
  "interaction_type",
  "conversion_source",
  "cms_surface",
  "cms_action",
  "cms_route",
  "cms_referrer_route",
  "cms_referrer_type",
  "cms_device_type",
  "cms_element_role",
  "cms_action_target",
  "cms_result",
  "cms_object_type",
  "cms_error_type",
  "cms_dirty_count",
  "cms_duration_ms",
  "cms_block_type",
  "cms_field_type",
  "cms_mode",
  "cms_tenant_context",
  "user_role",
  "$groups",
])

const safeScalar = (value: unknown): value is string | number | boolean | null =>
  value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const sanitizeString = (key: string, value: string): string | null => {
  if (EMAIL_OR_PHONE_SCHEME.test(value)) return null
  if (key === "target_path" || key === "cms_action_target") return value.split("?")[0] ?? ""
  return value
}

export const redactAnalyticsProperties = (properties: AnalyticsEventProperties): AnalyticsEventProperties => {
  const out: AnalyticsEventProperties = {}

  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_KEYS.has(key)) continue
    if (key === "$groups") {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue
      const groups = Object.fromEntries(
        Object.entries(value).filter(([groupType, groupId]) =>
          /^[a-z][a-z0-9_-]{0,31}$/.test(groupType)
          && typeof groupId === "string"
          && groupId.length > 0
          && groupId.length <= 128),
      )
      if (Object.keys(groups).length > 0) out.$groups = groups
      continue
    }
    if (!safeScalar(value)) continue
    out[key] = typeof value === "string" ? sanitizeString(key, value) : value
  }

  return out
}
