#!/usr/bin/env node

const DEFAULT_HOST = "https://app.posthog.com"
const DEFAULT_WEB_VITALS = ["CLS", "FCP", "INP", "LCP"]
const DEFAULT_EVENT_RETENTION_MONTHS = 13
// Owner-approved operational assurance: explicit cleanup policy plus observable
// event age, without independent physical-deletion or query-window proof.
const MAX_CLEANUP_MONTHS = 11 // Leaves headroom for monthly cleanup under 396 days.
const MAX_EVENT_AGE_DAYS = 396

const usage = () => {
  console.error(`usage: node scripts/sync-posthog-project-settings.mjs [--app-url <url> ...] [--dry-run | --check]

Required environment:
  POSTHOG_PERSONAL_API_KEY   Personal API key with project settings access.
  POSTHOG_PROJECT_ID         PostHog project/environment id.

Optional environment:
  POSTHOG_HOST               Defaults to ${DEFAULT_HOST}.
  POSTHOG_ORGANIZATION_ID    Enables the organization-scoped project endpoint.
  POSTHOG_APP_URLS           Comma-separated URLs to merge with --app-url.
  POSTHOG_EVENT_RETENTION_MONTHS
                             Defaults to ${DEFAULT_EVENT_RETENTION_MONTHS}.

The script applies the SIAB privacy baseline, enables approved Web Vitals
settings, and merges authorized URLs for generated sites. It never stores API
keys in the repo.`)
}

const args = process.argv.slice(2)
const cliUrls = []
let dryRun = false
let checkOnly = false

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (arg === "--dry-run") {
    dryRun = true
  } else if (arg === "--check") {
    checkOnly = true
  } else if (arg === "--app-url") {
    const value = args[i + 1]
    if (!value) {
      usage()
      process.exit(2)
    }
    cliUrls.push(value)
    i += 1
  } else if (arg === "-h" || arg === "--help") {
    usage()
    process.exit(0)
  } else {
    console.error(`unknown argument: ${arg}`)
    usage()
    process.exit(2)
  }
}

if (dryRun && checkOnly) throw new Error("Use either --dry-run or --check, not both.")

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY
const projectId = process.env.POSTHOG_PROJECT_ID
const organizationId = process.env.POSTHOG_ORGANIZATION_ID
const host = (process.env.POSTHOG_HOST || DEFAULT_HOST).replace(/\/+$/, "")
const envUrls = (process.env.POSTHOG_APP_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
const retentionMonths = Number(process.env.POSTHOG_EVENT_RETENTION_MONTHS || String(DEFAULT_EVENT_RETENTION_MONTHS))

if (!apiKey || !projectId) {
  usage()
  process.exit(2)
}
if (!Number.isInteger(retentionMonths) || retentionMonths < 1 || retentionMonths > DEFAULT_EVENT_RETENTION_MONTHS) {
  throw new Error("POSTHOG_EVENT_RETENTION_MONTHS must be an integer from 1 through 13.")
}

const normalizeUrl = (value) => {
  const url = new URL(value)
  url.hash = ""
  url.search = ""
  url.pathname = url.pathname.replace(/\/+$/, "") || "/"
  return url.toString().replace(/\/$/, "")
}

const requestedUrls = [...envUrls, ...cliUrls].map(normalizeUrl)
const endpoint = organizationId
  ? `${host}/api/organizations/${encodeURIComponent(organizationId)}/projects/${encodeURIComponent(projectId)}/`
  : `${host}/api/projects/${encodeURIComponent(projectId)}/`

const request = async (method, body, url = endpoint) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`${method} ${url} failed: HTTP ${response.status}`)
  }

  return response.json()
}

const current = await request("GET")
const currentUrls = Array.isArray(current.app_urls) ? current.app_urls.filter(Boolean) : []
const appUrls = Array.from(new Set([...currentUrls, ...requestedUrls])).sort()

const patch = {
  app_urls: appUrls,
  anonymize_ips: true,
  autocapture_opt_out: true,
  autocapture_web_vitals_opt_in: true,
  autocapture_web_vitals_allowed_metrics: DEFAULT_WEB_VITALS,
  capture_console_log_opt_in: false,
  capture_performance_opt_in: true,
  session_recording_opt_in: false,
  heatmaps_opt_in: false,
  capture_dead_clicks: false,
  cookieless_server_hash_mode: 1,
}

const retentionBaseline = { maximumCleanupMonths: Math.min(retentionMonths, MAX_CLEANUP_MONTHS), maximumEventAgeDays: MAX_EVENT_AGE_DAYS }

const auditRetention = async () => {
  const retention = await request("GET", undefined,
    `${host}/api/projects/${encodeURIComponent(projectId)}/events_retention/`)
  const configured = retention?.project_retention_months
  const minimum = retention?.min_retention_months, maximum = retention?.max_retention_months
  if (!Number.isInteger(configured) || configured < 1 || configured > retentionBaseline.maximumCleanupMonths ||
      !Number.isInteger(minimum) || minimum < 1 || !Number.isInteger(maximum) || maximum < minimum ||
      configured < minimum || configured > maximum) {
    throw new Error("PostHog explicit project cleanup policy is missing, invalid or exceeds the approved bound (including monthly cleanup headroom).")
  }
  console.log(`PostHog configured cleanup policy: ${configured} months`)
  console.log(`PostHog query window: ${Number.isInteger(retention.retention_months) ? `${retention.retention_months} months` : "unknown; not required for this control"}`)

  // POST executes a SELECT aggregate only; it neither captures nor deletes data.
  const result = await request("POST", {
    query: { kind: "HogQLQuery", query: `SELECT count() AS over_age_events FROM events WHERE timestamp < now() - INTERVAL ${MAX_EVENT_AGE_DAYS} DAY` },
    refresh: "force_blocking",
    name: "Siteinabox retention assurance: over-age event count",
  }, `${host}/api/projects/${encodeURIComponent(projectId)}/query/`)
  if (!result || result.error || result.query_status?.error ||
      result.query_status != null && result.query_status.complete !== true ||
      result.is_cached != null && result.is_cached !== false ||
      !Array.isArray(result.results) || result.results.length !== 1 ||
      !Array.isArray(result.results[0]) || result.results[0].length !== 1 ||
      !Number.isSafeInteger(result.results[0][0]) || result.results[0][0] < 0) {
    throw new Error("PostHog age check is incomplete, cached or malformed.")
  }
  const count = result.results[0][0]
  if (count !== 0) throw new Error(`PostHog retention drift: ${count} queryable events exceed ${MAX_EVENT_AGE_DAYS} days.`)
  console.log(`PostHog queryable events older than ${MAX_EVENT_AGE_DAYS} days: 0 (fresh aggregate)`)
  console.log("PostHog physical deletion: not independently verified; provider-managed cleanup is relied upon.")
}

if (checkOnly) {
  const comparable = (key, value) => key === "app_urls" && Array.isArray(value)
    ? [...value].filter(Boolean).sort()
    : value
  const drifted = (expectedSettings) => Object.entries(expectedSettings).filter(([key, expected]) =>
    JSON.stringify(comparable(key, current[key])) !== JSON.stringify(comparable(key, expected)),
  )
  const mutableDrift = drifted(patch)
  if (mutableDrift.length > 0) {
    for (const [key, expected] of mutableDrift) {
      console.error(`PostHog privacy drift: ${key} expected=${JSON.stringify(expected)} actual=${JSON.stringify(current[key])}`)
    }
    process.exit(1)
  }
  await auditRetention()
  console.log(`PostHog mutable privacy baseline, explicit cleanup policy and observable event age verified for project ${projectId}`)
} else if (dryRun) {
  console.log(JSON.stringify({ endpoint, patch, readOnlyAudit: retentionBaseline }, null, 2))
} else {
  const updated = await request("PATCH", patch)
  console.log(`Synced PostHog project settings for project ${projectId}`)
  console.log(`  Autocapture: ${updated.autocapture_opt_out === true ? "disabled" : "unknown"}`)
  console.log(`  Web Vitals: ${updated.autocapture_web_vitals_opt_in ? "enabled" : "unknown"}`)
  console.log(`  Performance capture: ${updated.capture_performance_opt_in ? "enabled" : "unknown"}`)
  console.log(`  IP anonymization: ${updated.anonymize_ips === true ? "enabled" : "unknown"}`)
  console.log(`  Session recording: ${updated.session_recording_opt_in === false ? "disabled" : "unknown"}`)
  console.log(`  Console capture: ${updated.capture_console_log_opt_in === false ? "disabled" : "unknown"}`)
  console.log(`  Heatmaps: ${updated.heatmaps_opt_in === false ? "disabled" : "unknown"}`)
  console.log(`  Dead clicks: ${updated.capture_dead_clicks === false ? "disabled" : "unknown"}`)
  console.log(`  Cookieless hashing: ${updated.cookieless_server_hash_mode === 1 ? "stateless" : "unknown"}`)
  console.log(`  App URLs: ${appUrls.length}`)
  for (const url of appUrls) console.log(`    ${url}`)
  await auditRetention()
}
