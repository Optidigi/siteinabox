export const PUBLIC_SITE_EVENT_NAMES = [
  "$pageview",
  "$pageleave",
  "site_section_viewed",
  "site_section_engaged",
  "site_component_viewed",
  "site_scroll_depth_reached",
  "site_journey_step",
  "site_form_started",
  "site_form_submitted",
  "site_form_accepted",
  "site_conversion_completed",
  "$web_vitals",
  "$autocapture",
  "$rageclick",
  "$dead_click",
] as const

export type PublicSiteEventName = (typeof PUBLIC_SITE_EVENT_NAMES)[number]

export const CMS_EVENT_NAMES = [
  "cms_dashboard_viewed",
  "cms_route_viewed",
  "cms_action_clicked",
  "cms_page_editor_opened",
  "cms_page_saved",
  "cms_page_save_failed",
  "cms_block_added",
  "cms_block_removed",
  "cms_media_uploaded",
  "cms_media_upload_failed",
  "cms_form_submission_received",
  "cms_form_status_updated",
  "cms_settings_saved",
  "cms_editor_friction",
] as const

export type CmsEventName = (typeof CMS_EVENT_NAMES)[number]

export type SiabAnalyticsEventName = PublicSiteEventName | CmsEventName

export type AnalyticsEnvironment = "production" | "staging" | "development"

export type AnalyticsBaseProperties = {
  schema_version: 1
  analytics_surface: "site" | "cms"
  environment: AnalyticsEnvironment
  admin_host?: string | null
  tenant_id: string | null
  tenant_slug: string | null
  site_id: string | null
  site_domain: string | null
  page_id: string | null
  page_slug: string | null
  page_path: string | null
  theme_id: string | null
  site_build_id: string | null
  manifest_version: string | number | null
}

export type AnalyticsSectionProperties = {
  section_id: string
  section_type: string
  section_position: number
  section_anchor: string | null
  provider_variant: string | null
  block_preset_id: string | null
  content_signature: string | null
}

export type AnalyticsActionProperties = {
  action_id: string | null
  action_role: "primary" | "secondary" | "inline" | "nav" | "footer" | "unknown"
  action_label: string | null
  target_type: "internal" | "external" | "phone" | "email" | "whatsapp" | "social" | "form" | "unknown"
  target_domain: string | null
  target_path: string | null
}

export type AnalyticsTrafficProperties = {
  referrer_domain: string | null
  referrer_type: "direct" | "internal" | "external" | "search" | "social" | "unknown"
  device_type: "desktop" | "tablet" | "mobile" | "unknown"
}

export type AnalyticsBehaviorProperties = {
  session_id: string | null
  journey_step_index: number | null
  journey_step: string | null
  journey_from: string | null
  scroll_depth: number | null
  page_duration_ms: number | null
  component_type: string | null
  component_role: string | null
  component_view_count: number | null
  component_viewed_before_interaction: boolean | null
  component_visible_ms_before_interaction: number | null
  component_hover_ms_before_interaction: number | null
  component_time_to_interaction_ms: number | null
  interaction_type: "click" | "focus" | "input" | "submit" | "view" | "leave" | "unknown"
}

export type AnalyticsEventProperties =
  & Partial<AnalyticsBaseProperties>
  & Partial<AnalyticsSectionProperties>
  & Partial<AnalyticsActionProperties>
  & Partial<AnalyticsTrafficProperties>
  & Partial<AnalyticsBehaviorProperties>
  & Partial<{
    cms_surface: string
    cms_action: string
    cms_route: string
    cms_route_path: string
    cms_referrer_route: string
    cms_referrer_type: "direct" | "internal" | "external" | "unknown"
    cms_device_type: "desktop" | "tablet" | "mobile" | "unknown"
    cms_element_role: "link" | "button" | "submit" | "menuitem" | "unknown"
    cms_action_target: string
    cms_result: "success" | "failure" | "cancelled" | "unknown"
    cms_object_type: string
    cms_object_id: string
    cms_error_type: string
    cms_dirty_count: number
    cms_duration_ms: number
    cms_block_type: string
    cms_field_type: string
    cms_mode: "super-admin" | "tenant"
    user_role: "super-admin" | "owner" | "editor" | "viewer"
    action_key: string
    web_vital_name: "CLS" | "FCP" | "INP" | "LCP" | "TTFB"
    web_vital_value: number
    web_vital_rating: "good" | "needs-improvement" | "poor"
    web_vital_id: string
  }>
  & Record<string, unknown>

export const isPublicSiteEventName = (event: string): event is PublicSiteEventName =>
  (PUBLIC_SITE_EVENT_NAMES as readonly string[]).includes(event)

export const isCmsEventName = (event: string): event is CmsEventName =>
  (CMS_EVENT_NAMES as readonly string[]).includes(event)
