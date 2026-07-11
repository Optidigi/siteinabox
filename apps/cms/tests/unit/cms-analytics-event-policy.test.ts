import { describe, expect, it } from "vitest"
import { applyCmsEventPropertyPolicy, normalizeCmsAnalyticsRoute } from "@/lib/analytics/cmsEventPolicy"

describe("CMS analytics server event policy", () => {
  it("normalizes tenant, record, and legal detail identifiers", () => {
    expect(normalizeCmsAnalyticsRoute("/sites/acme/pages/42?tab=content")).toBe("/sites/[slug]/pages/[id]")
    expect(normalizeCmsAnalyticsRoute("/legal/deliveries/918")).toBe("/legal/deliveries/[id]")
  })

  it("drops raw paths, object identifiers, contact data, and irrelevant properties", () => {
    expect(applyCmsEventPropertyPolicy("cms_action_clicked", {
      cms_route: "/sites/customer-name/pages/42",
      cms_route_path: "/sites/customer-name/pages/42",
      cms_action: "Mail owner@example.com",
      cms_action_target: "/legal/requirements/77?email=owner@example.com",
      cms_object_type: "page",
      cms_object_id: "42",
      cms_error_type: "not relevant to click",
      cms_device_type: "desktop",
    })).toEqual({
      cms_route: "/sites/[slug]/pages/[id]",
      cms_action_target: "/legal/requirements/[id]",
      cms_device_type: "desktop",
    })
  })

  it("keeps only metrics needed for the event purpose", () => {
    expect(applyCmsEventPropertyPolicy("cms_page_save_failed", {
      cms_route: "/pages/edit/home",
      cms_result: "failure",
      cms_error_type: "validation",
      cms_duration_ms: 850,
      cms_dirty_count: 2,
      cms_action: "Save customer John Doe",
      cms_block_type: "hero",
    })).toEqual({
      cms_route: "/pages/edit/[slug]",
      cms_result: "failure",
      cms_error_type: "validation",
      cms_duration_ms: 850,
      cms_dirty_count: 2,
    })
  })
})
