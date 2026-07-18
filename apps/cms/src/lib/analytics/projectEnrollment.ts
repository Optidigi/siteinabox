import type { Tenant } from "@/payload-types"

type EnrollmentTenant = Pick<Tenant, "id" | "domain" | "domainVerification">
type FetchLike = typeof fetch
type AnalyticsEnvironment = Record<string, string | undefined>

const productionDomain = (domain: string) =>
  !domain.endsWith(".localhost") && !domain.endsWith(".test") && domain !== "localhost"

export const tenantAnalyticsAppUrls = (tenant: EnrollmentTenant): string[] => {
  const domain = String(tenant.domain || "").trim().toLowerCase()
  if (!domain || tenant.domainVerification?.status !== "verified" || !productionDomain(domain)) return []
  return [`https://${domain}`, `https://admin.${domain}`]
}

export const ensureTenantPostHogEnrollment = async (
  tenant: EnrollmentTenant,
  options: { env?: AnalyticsEnvironment; fetchImpl?: FetchLike } = {},
): Promise<"skipped" | "unchanged" | "updated"> => {
  const urls = tenantAnalyticsAppUrls(tenant)
  if (urls.length === 0) return "skipped"

  const env = options.env ?? process.env
  const apiKey = env.POSTHOG_PERSONAL_API_KEY || env.POSTHOG_API_KEY
  const projectId = env.POSTHOG_PROJECT_ID
  if (!apiKey || !projectId) return "skipped"

  const host = (env.POSTHOG_HOST || "https://app.posthog.com").replace(/\/+$/, "")
  const endpoint = env.POSTHOG_ORGANIZATION_ID
    ? `${host}/api/organizations/${encodeURIComponent(env.POSTHOG_ORGANIZATION_ID)}/projects/${encodeURIComponent(projectId)}/`
    : `${host}/api/projects/${encodeURIComponent(projectId)}/`
  const fetchImpl = options.fetchImpl ?? fetch
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
  const currentResponse = await fetchImpl(endpoint, { method: "GET", headers })
  if (!currentResponse.ok) throw new Error(`PostHog enrollment read failed: ${currentResponse.status}`)
  const current = await currentResponse.json() as { app_urls?: unknown }
  const currentUrls = Array.isArray(current.app_urls)
    ? current.app_urls.filter((value): value is string => typeof value === "string")
    : []
  const nextUrls = Array.from(new Set([...currentUrls, ...urls])).sort()
  if (JSON.stringify([...currentUrls].sort()) === JSON.stringify(nextUrls)) return "unchanged"

  const updateResponse = await fetchImpl(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ app_urls: nextUrls }),
  })
  if (!updateResponse.ok) throw new Error(`PostHog enrollment update failed: ${updateResponse.status}`)
  return "updated"
}
