#!/usr/bin/env node

const DEFAULT_HOST = "https://app.posthog.com"
const DEFAULT_WEB_VITALS = ["CLS", "FCP", "INP", "LCP"]
const DEFAULT_EVENT_RETENTION_MONTHS = 13

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
const retentionMonths = Number.parseInt(
  process.env.POSTHOG_EVENT_RETENTION_MONTHS || String(DEFAULT_EVENT_RETENTION_MONTHS),
  10,
)

if (!apiKey || !projectId) {
  usage()
  process.exit(2)
}
if (!Number.isInteger(retentionMonths) || retentionMonths < 1 || retentionMonths > 120) {
  throw new Error("POSTHOG_EVENT_RETENTION_MONTHS must be an integer from 1 through 120.")
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

const request = async (method, body) => {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${method} ${endpoint} failed: ${response.status} ${text.slice(0, 500)}`)
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
}

// PostHog exposes these values in project/environment responses, but its
// current API schema marks both as plan-derived read-only fields. Keep them in
// the audit contract without pretending a successful project PATCH changed
// them.
const retentionBaseline = {
  event_retention_months: retentionMonths,
  events_retention_enforced: true,
}

if (checkOnly) {
  const comparable = (key, value) => key === "app_urls" && Array.isArray(value)
    ? [...value].filter(Boolean).sort()
    : value
  const expectedSettings = { ...patch, ...retentionBaseline }
  const drift = Object.entries(expectedSettings).filter(([key, expected]) =>
    JSON.stringify(comparable(key, current[key])) !== JSON.stringify(comparable(key, expected)),
  )
  if (drift.length > 0) {
    for (const [key, expected] of drift) {
      console.error(`PostHog privacy drift: ${key} expected=${JSON.stringify(expected)} actual=${JSON.stringify(current[key])}`)
    }
    process.exit(1)
  }
  console.log(`PostHog privacy baseline verified for project ${projectId}`)
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
  console.log(`  Event retention: ${updated.event_retention_months ?? "unknown"} months`)
  console.log(`  Retention enforcement: ${updated.events_retention_enforced === true ? "enabled" : "disabled"}`)
  console.log(`  App URLs: ${appUrls.length}`)
  for (const url of appUrls) console.log(`    ${url}`)
  const retentionMatches = updated.event_retention_months === retentionMonths
    && updated.events_retention_enforced === true
  if (!retentionMatches) {
    console.error(
      `PostHog retention remains plan-managed: expected ${retentionMonths} months with enforcement; `
      + `actual ${updated.event_retention_months ?? "unknown"} months with enforcement `
      + `${updated.events_retention_enforced === true ? "enabled" : "disabled"}. Contact PostHog support or change the project plan.`,
    )
    process.exitCode = 1
  }
}
