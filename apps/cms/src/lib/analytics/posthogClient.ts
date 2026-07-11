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
      distinct_id: distinctId,
      properties: redactAnalyticsProperties(properties),
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
