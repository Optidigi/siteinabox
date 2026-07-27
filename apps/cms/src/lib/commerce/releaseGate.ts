import "server-only"

import {
  commerceReleaseStageSchema,
  evaluateCommerceReleaseGate,
  type CommerceReleaseGateDecision,
} from "@siteinabox/contracts/commerce"

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
  })
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
