/**
 * @typedef {"public" | "secret" | "internal"} Exposure
 * @typedef {"build" | "runtime" | "test"} Phase
 * @typedef {"startup-required" | "operation-scoped" | "optional" | "test-only"} Requiredness
 * @typedef {{
 *   app: string,
 *   name: string,
 *   exposure: Exposure,
 *   phase: Phase,
 *   requiredness: Requiredness,
 * }} EnvironmentClassification
 */

const PUBLIC_EXACT = new Set([
  "POSTHOG_HOST",
  "POSTHOG_PROJECT_TOKEN",
  "POSTHOG_PUBLIC_HOST",
  "PUBLIC_TURNSTILE_SITE_KEY",
  "SITE_URL",
])

const TEST_ONLY = new Set([
  "CHECKOUT_SCREENSHOT_DIR",
  "CHECKOUT_VISUAL_MATRIX_DIR",
  "CI",
  "DEV",
  "IMAGE_TAG",
  "SIAB_ALLOW_TEST_EMAIL",
  "SIAB_VISUAL_ARTIFACT_DIR",
  "SIAB_VITE_CACHE_DIR",
  "VITEST",
])

const STARTUP_REQUIRED = new Set(["DATABASE_URI", "PAYLOAD_SECRET"])

const OPERATION_SCOPED = new Set([
  "APPLE_CLIENT_ID",
  "APPLE_CLIENT_SECRET",
  "BETTER_AUTH_PREVIEW_SECRET",
  "BETTER_AUTH_SECRET",
  "BOOTSTRAP_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_EMAIL_API_TOKEN",
  "CLOUDFLARE_EMAIL_SMTP_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "KVK_API_KEY",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MOLLIE_API_KEY",
  "OPENAI_API_KEY",
  "OPENPROVIDER_PASSWORD",
  "OPENPROVIDER_USERNAME",
  "POSTHOG_API_KEY",
  "POSTHOG_PERSONAL_API_KEY",
  "SIAB_EMAIL_PREFERENCE_SECRET",
  "SIAB_OPERATIONAL_HASH_KEY",
  "SIAB_RENDERER_API_TOKEN",
  "SIAB_RENDERER_API_TOKEN_FILE",
  "STATUS_MONITOR_INVENTORY_TOKEN",
  "TURNSTILE_SECRET_KEY",
])

const SECRET_NAME = /(?:^|_)(?:API_KEY|PASSWORD|SECRET|TOKEN)(?:_|$)/

function isPublic(name) {
  return name.startsWith("PUBLIC_") || name.startsWith("NEXT_PUBLIC_") || PUBLIC_EXACT.has(name)
}

function isBuildInput(app, name) {
  if (name.startsWith("PUBLIC_") || name.startsWith("NEXT_PUBLIC_")) return true
  if (app === "intake" && name === "SITE_URL") return true
  if (app === "landing" && ["POSTHOG_HOST", "POSTHOG_PROJECT_TOKEN", "POSTHOG_PUBLIC_HOST", "SITE_URL"].includes(name)) {
    return true
  }
  return false
}

/**
 * @param {string} app
 * @param {string} name
 * @returns {EnvironmentClassification}
 */
export function classifyEnvironmentName(app, name) {
  const testOnly = TEST_ONLY.has(name)
  const startupRequired = app === "cms" && STARTUP_REQUIRED.has(name)
  const operationScoped = app === "cms" && OPERATION_SCOPED.has(name)
  const exposure = isPublic(name) ? "public" : name === "DATABASE_URI" || SECRET_NAME.test(name) ? "secret" : "internal"

  return {
    app,
    name,
    exposure,
    phase: testOnly ? "test" : isBuildInput(app, name) ? "build" : "runtime",
    requiredness: testOnly ? "test-only" : startupRequired ? "startup-required" : operationScoped ? "operation-scoped" : "optional",
  }
}

export function classifyInventory(inventory) {
  return Object.entries(inventory.apps).flatMap(([app, config]) =>
    config.names.map((name) => classifyEnvironmentName(app, name)),
  )
}
