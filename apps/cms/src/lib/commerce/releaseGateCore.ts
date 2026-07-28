import {
  commerceReleaseStageSchema,
  evaluateCommerceReleaseGate,
  type CommerceReleaseGateDecision,
} from "@siteinabox/contracts/commerce"
import type { Payload } from "payload"

const clean = (value: string | undefined): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const apiKeyMode = (
  value: string | null,
): "test" | "live" | "unknown" | "missing" => {
  if (!value) return "missing"
  if (value.startsWith("test_")) return "test"
  if (value.startsWith("live_")) return "live"
  return "unknown"
}

const validMigrationEncryptionKey = (value: string | undefined): boolean => {
  try {
    return Boolean(value?.trim()) &&
      Buffer.from(value!.trim(), "base64").byteLength === 32
  } catch {
    return false
  }
}

export function commerceReleaseGate(
  env: NodeJS.ProcessEnv = process.env,
): CommerceReleaseGateDecision {
  const stage = commerceReleaseStageSchema.catch("disabled").parse(
    clean(env.COMMERCE_RELEASE_STAGE),
  )
  return evaluateCommerceReleaseGate({
    stage,
    evidenceVersion: clean(env.COMMERCE_RELEASE_EVIDENCE_VERSION),
    providerWritesAcknowledged:
      clean(env.COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED) === "1",
    nodeEnvironment: clean(env.NODE_ENV),
    mollieApiKeyMode: apiKeyMode(clean(env.MOLLIE_API_KEY)),
    openproviderApiBaseUrl:
      clean(env.OPENPROVIDER_API_BASE_URL) ??
      "https://api.openprovider.eu/v1beta",
    cloudflareApiBaseUrl:
      clean(env.CLOUDFLARE_API_BASE_URL) ??
      "https://api.cloudflare.com/client/v4",
    productionSecretsConfigured: Boolean(
      clean(env.OPENPROVIDER_USERNAME) &&
      clean(env.OPENPROVIDER_PASSWORD) &&
      clean(env.CLOUDFLARE_API_TOKEN) &&
      clean(env.CLOUDFLARE_ACCOUNT_ID) &&
      validMigrationEncryptionKey(env.DOMAIN_MIGRATION_ENCRYPTION_KEY),
    ),
    originIsolationVerified:
      clean(env.COMMERCE_ORIGIN_ISOLATION_VERIFIED) === "1",
  })
}

export async function commerceProductionReadinessBlockers(
  payload: Payload,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  const decision = commerceReleaseGate(env)
  const blockers = [...decision.blockers]
  if (commerceReleaseStageSchema.catch("disabled").parse(
    clean(env.COMMERCE_RELEASE_STAGE),
  ) !== "production") {
    blockers.push("production_preflight_requires_production_stage")
  }
  const criticalAlerts = await payload.find({
    collection: "operational-alerts",
    where: {
      and: [
        { status: { equals: "open" } },
        { severity: { equals: "critical" } },
        { source: { in: ["payments", "domains"] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (criticalAlerts.totalDocs > 0 || criticalAlerts.docs.length > 0) {
    blockers.push("production_has_open_critical_commerce_alerts")
  }
  return [...new Set(blockers)]
}

export function commerceProviderReadsAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return commerceReleaseGate(env).providerReadsAllowed
}

export function commerceProviderWritesAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return commerceReleaseGate(env).providerWritesAllowed
}

export function requireCommerceProviderWritesAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const decision = commerceReleaseGate(env)
  if (decision.providerWritesAllowed) return
  throw new Error(
    `${operation} is blocked by the staged commerce release gate (${decision.blockers.join(", ")}).`,
  )
}
