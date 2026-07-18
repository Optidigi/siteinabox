import { afterEach, describe, expect, it, vi } from "vitest"
import { getPostHogAnalyticsConfig, resolvePublicAnalyticsConfig } from "@/lib/analytics/config"
import { redactAnalyticsProperties } from "@/lib/analytics/redaction"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("analytics config", () => {
  it("keeps capture/query disabled when PostHog config is absent", () => {
    delete process.env.POSTHOG_PROJECT_TOKEN
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    delete process.env.POSTHOG_PROJECT_ID
    delete process.env.POSTHOG_PERSONAL_API_KEY
    delete process.env.POSTHOG_API_KEY

    const config = getPostHogAnalyticsConfig()

    expect(config.enabled).toBe(false)
    expect(config.captureEnabled).toBe(false)
    expect(config.queryEnabled).toBe(false)
  })

  it("projects public analytics as disabled unless capture config exists", () => {
    delete process.env.POSTHOG_PROJECT_TOKEN
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

    expect(resolvePublicAnalyticsConfig({ enabled: true })).toMatchObject({
      enabled: false,
      provider: "posthog",
      consentMode: "required",
      conversionGoals: { acceptedForms: true, contactClicks: [] },
      dashboardVisible: true,
    })
  })

  it("enables public analytics when a project token exists", () => {
    process.env.POSTHOG_PROJECT_TOKEN = "phc_test"
    process.env.POSTHOG_HOST = "https://eu.posthog.com/"
    process.env.POSTHOG_PUBLIC_HOST = "https://r.siteinabox.nl/"

    expect(resolvePublicAnalyticsConfig({
      conversionGoals: { contactClicks: ["phone", "whatsapp"] },
    })).toMatchObject({
      enabled: true,
      posthogHost: "https://r.siteinabox.nl",
      posthogUiHost: "https://eu.posthog.com",
      posthogProjectToken: "phc_test",
      conversionGoals: { acceptedForms: true, contactClicks: ["phone", "whatsapp"] },
    })
  })
})

describe("analytics redaction", () => {
  it("allowlists safe scalar properties and strips raw phone/email hrefs", () => {
    const redacted = redactAnalyticsProperties({
      tenant_id: "7",
      tenant_name: "Amicare",
      site_kind: "tenant",
      analytics_surface: "cms",
      admin_host: "admin.ami-care.nl",
      action_label: "Bel ons",
      target_path: "/contact?email=person@example.com",
      raw_href: "mailto:person@example.com",
      target_domain: "example.com",
      referrer_domain: "google.com",
      referrer_type: "search",
      device_type: "mobile",
      session_id: "session-1",
      journey_step_index: 2,
      journey_step: "form-started",
      journey_from: "/contact?x=1",
      scroll_depth: 75,
      page_duration_ms: 1234,
      component_type: "cta",
      component_role: "primary",
      interaction_type: "click",
      unsafe_object: { email: "person@example.com" },
      target_type: "email",
      action_id: "cta-1",
      cms_surface: "dashboard",
      cms_action: "view",
      cms_route: "/pages/[id]",
      cms_route_path: "/pages/123?tab=content",
      cms_referrer_route: "/",
      cms_referrer_type: "internal",
      cms_device_type: "mobile",
      cms_element_role: "button",
      cms_action_target: "/analytics",
      cms_result: "success",
      cms_object_type: "page",
      cms_object_id: "123",
      cms_error_type: "validation",
      cms_dirty_count: 3,
      cms_duration_ms: 456,
      cms_block_type: "hero",
      cms_field_type: "richText",
      cms_mode: "tenant",
      user_role: "owner",
      cms_tenant_context: "host",
      $groups: { tenant: "7", "INVALID!": "ignored", oversized: "x".repeat(129) },
      target_url: "tel:+31612345678",
    })

    expect(redacted).toEqual({
      tenant_id: "7",
      tenant_name: "Amicare",
      site_kind: "tenant",
      analytics_surface: "cms",
      admin_host: "admin.ami-care.nl",
      action_label: "Bel ons",
      target_path: "/contact",
      target_domain: "example.com",
      referrer_domain: "google.com",
      referrer_type: "search",
      device_type: "mobile",
      session_id: "session-1",
      journey_step_index: 2,
      journey_step: "form-started",
      journey_from: "/contact?x=1",
      scroll_depth: 75,
      page_duration_ms: 1234,
      component_type: "cta",
      component_role: "primary",
      interaction_type: "click",
      target_type: "email",
      action_id: "cta-1",
      cms_surface: "dashboard",
      cms_action: "view",
      cms_route: "/pages/[id]",
      cms_referrer_route: "/",
      cms_referrer_type: "internal",
      cms_device_type: "mobile",
      cms_element_role: "button",
      cms_action_target: "/analytics",
      cms_result: "success",
      cms_object_type: "page",
      cms_error_type: "validation",
      cms_dirty_count: 3,
      cms_duration_ms: 456,
      cms_block_type: "hero",
      cms_field_type: "richText",
      cms_mode: "tenant",
      user_role: "owner",
      cms_tenant_context: "host",
      $groups: { tenant: "7" },
    })
  })
})
