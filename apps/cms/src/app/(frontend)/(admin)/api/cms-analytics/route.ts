import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import type { AnalyticsEventProperties, CmsEventName } from "@/lib/analytics/events"
import { isCmsEventName } from "@/lib/analytics/events"
import { getSiabContext } from "@/lib/context"
import { evaluateGate } from "@/lib/gateDecision"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { applyCmsEventPropertyPolicy } from "@/lib/analytics/cmsEventPolicy"

const MAX_TEXT = 96

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_TEXT)
}

const cleanRoute = (value: unknown): string | null => {
  const text = cleanText(value)
  if (!text) return null
  if (!text.startsWith("/")) return null
  return text.split("?")[0]?.slice(0, MAX_TEXT) ?? null
}

const cleanNumber = (value: unknown, max: number): number | null => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(Math.floor(n), max)
}

const cleanTenantSlug = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const slug = value.trim().toLowerCase()
  return /^[a-z0-9-]{1,96}$/.test(slug) ? slug : null
}

const allowed = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  values.includes(value as T) ? value as T : fallback

const CLIENT_EVENTS = new Set<CmsEventName>([
  "cms_route_viewed",
  "cms_action_clicked",
  "cms_page_saved",
  "cms_page_save_failed",
  "cms_media_uploaded",
  "cms_media_upload_failed",
  "cms_form_status_updated",
  "cms_settings_saved",
  "cms_editor_friction",
])

const propertyPayload = (body: Record<string, unknown>): AnalyticsEventProperties => {
  const props: AnalyticsEventProperties = {}
  const route = cleanRoute(body.cms_route)
  const referrerRoute = cleanRoute(body.cms_referrer_route)
  const action = cleanText(body.cms_action)
  const actionTarget = cleanRoute(body.cms_action_target)
  const objectType = cleanText(body.cms_object_type)
  const errorType = cleanText(body.cms_error_type)
  const blockType = cleanText(body.cms_block_type)
  const fieldType = cleanText(body.cms_field_type)
  const dirtyCount = cleanNumber(body.cms_dirty_count, 500)
  const durationMs = cleanNumber(body.cms_duration_ms, 1000 * 60 * 60)

  if (route) props.cms_route = route
  if (referrerRoute) props.cms_referrer_route = referrerRoute
  if (action) props.cms_action = action
  if (actionTarget) props.cms_action_target = actionTarget
  if (objectType) props.cms_object_type = objectType
  if (errorType) props.cms_error_type = errorType
  if (blockType) props.cms_block_type = blockType
  if (fieldType) props.cms_field_type = fieldType
  if (dirtyCount != null) props.cms_dirty_count = dirtyCount
  if (durationMs != null) props.cms_duration_ms = durationMs
  props.cms_result = allowed(body.cms_result, ["success", "failure", "cancelled", "unknown"] as const, "unknown")
  props.cms_referrer_type = allowed(body.cms_referrer_type, ["direct", "internal", "external", "unknown"] as const, "unknown")
  props.cms_device_type = allowed(body.cms_device_type, ["desktop", "tablet", "mobile", "unknown"] as const, "unknown")
  props.cms_element_role = allowed(body.cms_element_role, ["link", "button", "submit", "menuitem", "unknown"] as const, "unknown")
  return props
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = body.event
  if (typeof event !== "string" || !isCmsEventName(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }
  if (!CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const result = await payload.auth({ headers: req.headers })
  const user = result.user as User | null
  const ctx = await getSiabContext()
  const decision = evaluateGate(user, ctx)
  if (!decision.allow || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const props = applyCmsEventPropertyPolicy(event, propertyPayload(body))
  const managedSlug = ctx.mode === "super-admin" ? cleanTenantSlug(body.cms_tenant_slug) : null
  const managedTenant = managedSlug
    ? (await payload.find({
        collection: "tenants",
        where: { slug: { equals: managedSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })).docs[0] ?? null
    : null
  const surface = event === "cms_route_viewed" ? props.cms_route ?? "route" : props.cms_route ?? "action"
  await captureCmsUsageEvent({
    event: event as CmsEventName,
    user,
    ctx,
    surface,
    action: props.cms_action,
    properties: props,
    managedTenant,
  })

  return new NextResponse(null, { status: 204 })
}
