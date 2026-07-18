import "server-only"
import { getPostHogAnalyticsConfig } from "./config"
import { redactAnalyticsProperties } from "./redaction"
import type { AnalyticsEventProperties, SiabAnalyticsEventName } from "./events"
import { serverAnalyticsPolicyFor } from "./governance"

type CaptureInput = {
  event: SiabAnalyticsEventName
  distinctId: string
  properties: AnalyticsEventProperties
}

type TenantGroupInput = {
  id: string
  name?: string | null
  slug?: string | null
  domain?: string | null
}

const identifiedTenantGroups = new Set<string>()

export const identifyPostHogTenantGroup = async (tenant: TenantGroupInput): Promise<void> => {
  if (identifiedTenantGroups.has(tenant.id)) return
  const config = getPostHogAnalyticsConfig()
  if (!config.captureEnabled || !config.projectToken) return

  const response = await fetch(`${config.host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.projectToken,
      event: "$groupidentify",
      properties: {
        distinct_id: `$tenant:${tenant.id}`,
        $group_type: "tenant",
        $group_key: tenant.id,
        $group_set: {
          name: tenant.name || tenant.slug || tenant.id,
          slug: tenant.slug || null,
          domain: tenant.domain || null,
          site_kind: "tenant",
        },
      },
    }),
  })
  if (!response.ok) throw new Error(`PostHog tenant group identify failed: ${response.status}`)
  identifiedTenantGroups.add(tenant.id)
}

export const captureAnalyticsEvent = async ({ event, distinctId, properties }: CaptureInput): Promise<void> => {
  if (!serverAnalyticsPolicyFor(event)) {
    throw new Error(`Analytics event is not approved for server capture: ${event}`)
  }
  const config = getPostHogAnalyticsConfig()
  if (!config.captureEnabled || !config.projectToken) return

  const response = await fetch(`${config.host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.projectToken,
      event,
      properties: {
        distinct_id: distinctId,
        ...redactAnalyticsProperties(properties),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`PostHog capture failed: ${response.status}`)
  }
}

export const queryPostHog = async <T = unknown>(query: string, name: string): Promise<T | null> => {
  const config = getPostHogAnalyticsConfig()
  if (!config.queryEnabled || !config.projectId || !config.personalApiKey) return null

  const response = await fetch(`${config.host}/api/projects/${config.projectId}/query/`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.personalApiKey}`,
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
      name,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.warn(`[analytics] PostHog query failed (${name}): ${response.status} ${body.slice(0, 500)}`)
    return null
  }

  return response.json() as Promise<T>
}
