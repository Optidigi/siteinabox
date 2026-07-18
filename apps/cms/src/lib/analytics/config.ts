import type { AnalyticsEnvironment } from "./events"

const DEFAULT_POSTHOG_HOST = "https://app.posthog.com"
const DEFAULT_POSTHOG_PUBLIC_HOST = "https://r.siteinabox.nl"

const boolDisabled = (value: string | undefined) =>
  value === "1" || value?.toLowerCase() === "true"

export type PostHogAnalyticsConfig = {
  enabled: boolean
  captureEnabled: boolean
  queryEnabled: boolean
  host: string
  publicHost: string
  projectToken: string | null
  projectId: string | null
  personalApiKey: string | null
  environment: AnalyticsEnvironment
}

export const analyticsEnvironment = (): AnalyticsEnvironment => {
  const raw = process.env.POSTHOG_ENVIRONMENT || process.env.NODE_ENV || "development"
  if (raw === "production" || raw === "staging" || raw === "development") return raw
  return "development"
}

export const getPostHogAnalyticsConfig = (): PostHogAnalyticsConfig => {
  const disabled = boolDisabled(process.env.POSTHOG_ANALYTICS_DISABLED)
  const host = (process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "")
  const publicHost = (process.env.POSTHOG_PUBLIC_HOST || DEFAULT_POSTHOG_PUBLIC_HOST).replace(/\/+$/, "")
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || null
  const projectId = process.env.POSTHOG_PROJECT_ID || null
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY || null
  const captureEnabled = !disabled && !!projectToken
  const queryEnabled = !disabled && !!projectId && !!personalApiKey

  return {
    enabled: !disabled && (!!projectToken || !!projectId || !!personalApiKey),
    captureEnabled,
    queryEnabled,
    host,
    publicHost,
    projectToken,
    projectId,
    personalApiKey,
    environment: analyticsEnvironment(),
  }
}

export type PublicAnalyticsConfigInput = {
  enabled?: boolean
  dashboardVisible?: boolean
  consentMode?: "required"
  conversionGoals?: {
    acceptedForms?: true
    contactClicks?: Array<"phone" | "email" | "whatsapp">
  }
}

export const resolvePublicAnalyticsConfig = (input?: PublicAnalyticsConfigInput | null) => {
  const posthog = getPostHogAnalyticsConfig()
  const enabled = input?.enabled ?? true

  return {
    enabled: enabled && posthog.captureEnabled,
    provider: "posthog" as const,
    consentMode: "required" as const,
    posthogHost: posthog.publicHost,
    posthogUiHost: posthog.host,
    posthogProjectToken: posthog.projectToken,
    conversionGoals: {
      acceptedForms: true as const,
      contactClicks: input?.conversionGoals?.contactClicks ?? [],
    },
    dashboardVisible: input?.dashboardVisible ?? true,
  }
}

export const tenantAnalyticsDashboardVisible = (siteManifest: unknown): boolean => {
  if (!siteManifest || typeof siteManifest !== "object" || Array.isArray(siteManifest)) return true
  const analytics = (siteManifest as { analytics?: unknown }).analytics
  if (!analytics || typeof analytics !== "object" || Array.isArray(analytics)) return true
  return (analytics as { dashboardVisible?: unknown }).dashboardVisible !== false
}
