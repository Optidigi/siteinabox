import "server-only"

import {
  getCloudflareDnsRecordUsage,
  getCloudflareDnssec,
  getCloudflareHostnameCertificate,
  listCloudflareZones,
} from "@/lib/domains/cloudflare"
import {
  buildCloudflareTunnelIngress,
  inspectCloudflareTunnel,
  type CloudflareTunnelKind,
} from "@/lib/domains/cloudflareTunnels"
import {
  getOpenProviderResellerBalance,
  loginOpenProvider,
} from "@/lib/domains/openprovider"
import { inspectMollieProfileCapabilities } from "@/lib/payments/mollieAdapter"

type FetchLike = typeof fetch

type ProbeFailureCategory =
  | "configuration_mismatch"
  | "unauthorized_or_capability_missing"
  | "configured_resource_missing_or_out_of_scope"
  | "provider_unreachable"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_contract_rejected"
  | "provider_response_invalid"

type ProviderCapabilityDependencies = {
  inspectMollie: (options: {
    env: NodeJS.ProcessEnv
    fetchImpl: FetchLike
  }) => Promise<void>
  loginOpenProvider: (options: {
    env: NodeJS.ProcessEnv
    fetchImpl: FetchLike
  }) => Promise<string>
  getOpenProviderBalance: (options: {
    env: NodeJS.ProcessEnv
    fetchImpl: FetchLike
    token: string
  }) => Promise<{ availableAmount: number; reservedAmount: number; currency: string }>
  inspectTunnel: (
    kind: CloudflareTunnelKind,
    options: {
      env: NodeJS.ProcessEnv
      fetchImpl: FetchLike
    },
  ) => Promise<{
    tunnel: { status: string }
    ingress: Array<{ hostname?: string; service: string }>
    configurationVersion: number | null
    connected: boolean
  }>
  listZones: (
    domain: string,
    options: {
      env: NodeJS.ProcessEnv
      fetchImpl: FetchLike
    },
  ) => Promise<Array<{ id: string; name: string; status: string }>>
  getDnsUsage: (
    zoneId: string,
    options: {
      env: NodeJS.ProcessEnv
      fetchImpl: FetchLike
    },
  ) => Promise<{ recordQuota: number; recordUsage: number }>
  getDnssec: (
    zoneId: string,
    options: {
      env: NodeJS.ProcessEnv
      fetchImpl: FetchLike
    },
  ) => Promise<{ status: string }>
  getCertificate: (
    zoneId: string,
    hostname: string,
    options: {
      env: NodeJS.ProcessEnv
      fetchImpl: FetchLike
    },
  ) => Promise<{ universalSslEnabled: boolean; covered: boolean }>
}

export type CommerceProviderCapabilityPreflightOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
  zoneDomains?: string[]
  tunnelHostnames?: {
    renderer: string[]
    cms: string[]
  }
  timeoutMs?: number
  overallTimeoutMs?: number
  dependencies?: Partial<ProviderCapabilityDependencies>
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000
const DEFAULT_OVERALL_TIMEOUT_MS = 15_000
const MAX_OVERALL_TIMEOUT_MS = 5 * 60_000
const ZONE_CONCURRENCY = 4
const MAX_RESPONSE_BYTES = 512 * 1024
const OFFICIAL_CLOUDFLARE_API_BASE =
  "https://api.cloudflare.com/client/v4"
const OFFICIAL_OPENPROVIDER_API_BASE =
  "https://api.openprovider.eu/v1beta"

const clean = (value: string | undefined): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const exactApiBase = (
  configured: string | undefined,
  expected: string,
): boolean => (clean(configured) ?? expected).replace(/\/+$/, "") === expected

const validTunnelId = (value: string | undefined): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(clean(value) ?? "")

const minimumOpenProviderBalance = (
  env: NodeJS.ProcessEnv,
): number | null => {
  const configured = clean(env.OPENPROVIDER_MIN_BALANCE_EUR) ?? "0"
  if (!/^\d+(?:\.\d{1,2})?$/.test(configured)) return null
  const amount = Number(configured)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

const validTimeout = (value: number | undefined, fallback: number): number =>
  Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback

const responseBytes = async (
  response: Response,
  maximumBytes: number,
): Promise<ArrayBuffer> => {
  if (!response.body) return new ArrayBuffer(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    total += result.value.byteLength
    if (total > maximumBytes) {
      await reader.cancel()
      throw new Error("Provider response exceeded its safety bound.")
    }
    chunks.push(result.value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

const boundedFetch = (
  fetchImpl: FetchLike,
  requestTimeoutMs: number,
  overallSignal: AbortSignal,
): FetchLike => async (input, init) => {
  const requestSignal = init?.signal
    ? AbortSignal.any([
        init.signal,
        overallSignal,
        AbortSignal.timeout(requestTimeoutMs),
      ])
    : AbortSignal.any([
        overallSignal,
        AbortSignal.timeout(requestTimeoutMs),
      ])
  const response = await fetchImpl(input, {
    ...init,
    redirect: "error",
    signal: requestSignal,
  })
  const body = await responseBytes(response, MAX_RESPONSE_BYTES)
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

const errorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object" || !("status" in error)) return null
  const status = error.status
  return typeof status === "number" && Number.isSafeInteger(status)
    ? status
    : null
}

const failureCategory = (error: unknown): ProbeFailureCategory => {
  const status = errorStatus(error)
  if (status === 401 || status === 403) {
    return "unauthorized_or_capability_missing"
  }
  if (status === 404) {
    return "configured_resource_missing_or_out_of_scope"
  }
  if (status === 408) return "provider_unreachable"
  if (status === 429) return "provider_rate_limited"
  if (status != null && status >= 500) return "provider_unavailable"
  if (status != null && status >= 400) return "provider_contract_rejected"
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "provider_unreachable"
  }
  if (error instanceof TypeError) return "provider_unreachable"
  return "provider_response_invalid"
}

const code = (
  probe: string,
  category: ProbeFailureCategory,
): string => `provider_capability:${probe}:${category}`

const configurationBlockers = (env: NodeJS.ProcessEnv): string[] => {
  const blockers: string[] = []
  if (clean(env.COMMERCE_RELEASE_STAGE) !== "production") {
    blockers.push(
      code("preflight", "configuration_mismatch"),
    )
  }
  if (env.NODE_ENV !== "production") {
    blockers.push(code("node_environment", "configuration_mismatch"))
  }
  if (!clean(env.MOLLIE_API_KEY)?.startsWith("live_")) {
    blockers.push(code("mollie", "configuration_mismatch"))
  }
  if (
    !clean(env.OPENPROVIDER_USERNAME) ||
    !clean(env.OPENPROVIDER_PASSWORD) ||
    minimumOpenProviderBalance(env) == null ||
    !exactApiBase(
      env.OPENPROVIDER_API_BASE_URL,
      OFFICIAL_OPENPROVIDER_API_BASE,
    )
  ) {
    blockers.push(code("openprovider", "configuration_mismatch"))
  }
  if (
    !clean(env.CLOUDFLARE_API_TOKEN) ||
    !/^[0-9a-f]{32}$/i.test(clean(env.CLOUDFLARE_ACCOUNT_ID) ?? "") ||
    !validTunnelId(env.CLOUDFLARE_RENDERER_TUNNEL_ID) ||
    !validTunnelId(env.CLOUDFLARE_CMS_TUNNEL_ID) ||
    !exactApiBase(
      env.CLOUDFLARE_API_BASE_URL,
      OFFICIAL_CLOUDFLARE_API_BASE,
    )
  ) {
    blockers.push(code("cloudflare", "configuration_mismatch"))
  }
  if (
    clean(env.COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED) === "1" &&
    clean(env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED) === "1" &&
    (
      clean(env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_OAUTH_ENABLED) !== "1" ||
      !clean(env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_ID) ||
      !clean(env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET) ||
      clean(env.CLOUDFLARE_SOURCE_OAUTH_REDIRECT_URI) !==
        "https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback"
    )
  ) {
    blockers.push(code("cloudflare_source_oauth", "configuration_mismatch"))
  }
  return blockers
}

const defaultDependencies: ProviderCapabilityDependencies = {
  inspectMollie: inspectMollieProfileCapabilities,
  loginOpenProvider,
  getOpenProviderBalance: getOpenProviderResellerBalance,
  inspectTunnel: inspectCloudflareTunnel,
  listZones: listCloudflareZones,
  getDnsUsage: getCloudflareDnsRecordUsage,
  getDnssec: getCloudflareDnssec,
  getCertificate: getCloudflareHostnameCertificate,
}

const uniqueDomains = (domains: string[] | undefined): string[] =>
  [...new Set((domains ?? []).map((domain) =>
    domain.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean))].sort()

const mapWithConcurrency = async <Input>(
  inputs: Input[],
  concurrency: number,
  operation: (input: Input) => Promise<void>,
): Promise<void> => {
  let nextIndex = 0
  const workers = Array.from(
    { length: Math.min(concurrency, inputs.length) },
    async () => {
      while (nextIndex < inputs.length) {
        const index = nextIndex
        nextIndex += 1
        const input = inputs[index]
        if (input !== undefined) await operation(input)
      }
    },
  )
  await Promise.all(workers)
}

export async function commerceProviderCapabilityBlockers(
  options: CommerceProviderCapabilityPreflightOptions = {},
): Promise<string[]> {
  const env = options.env ?? process.env
  const configBlockers = configurationBlockers(env)
  if (configBlockers.length > 0) return configBlockers

  const dependencies = {
    ...defaultDependencies,
    ...options.dependencies,
  }
  const zoneDomains = uniqueDomains(options.zoneDomains)
  const tunnelHostnames = options.tunnelHostnames ?? {
    renderer: zoneDomains.flatMap((domain) => [domain, `www.${domain}`]),
    cms: zoneDomains.map((domain) => `admin.${domain}`),
  }
  const derivedOverallTimeoutMs = Math.min(
    MAX_OVERALL_TIMEOUT_MS,
    DEFAULT_OVERALL_TIMEOUT_MS +
      Math.ceil(zoneDomains.length / ZONE_CONCURRENCY) *
        DEFAULT_REQUEST_TIMEOUT_MS * 2,
  )
  const overallSignal = AbortSignal.timeout(
    validTimeout(options.overallTimeoutMs, derivedOverallTimeoutMs),
  )
  const fetchImpl = boundedFetch(
    options.fetchImpl ?? globalThis.fetch,
    validTimeout(options.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
    overallSignal,
  )
  const providerOptions = { env, fetchImpl }
  const blockers: string[] = []
  const recordFailure = (probe: string, error: unknown): void => {
    blockers.push(code(probe, failureCategory(error)))
  }

  await Promise.all([
    (async () => {
      try {
        await dependencies.inspectMollie(providerOptions)
      } catch (error) {
        recordFailure("mollie", error)
      }
    })(),
    (async () => {
      let token: string
      try {
        token = await dependencies.loginOpenProvider(providerOptions)
      } catch (error) {
        recordFailure("openprovider_login", error)
        return
      }
      try {
        const balance = await dependencies.getOpenProviderBalance({
          ...providerOptions,
          token,
        })
        const minimumBalance = minimumOpenProviderBalance(env)
        if (
          minimumBalance == null ||
          balance.currency !== "EUR" ||
          !Number.isFinite(balance.availableAmount) ||
          !Number.isFinite(balance.reservedAmount) ||
          balance.availableAmount < minimumBalance ||
          balance.reservedAmount < 0
        ) {
          throw new Error("OpenProvider balance evidence is invalid.")
        }
      } catch (error) {
        recordFailure("openprovider_balance", error)
      }
    })(),
    ...(["renderer", "cms"] as const).map(async (kind) => {
      try {
        const inspection = await dependencies.inspectTunnel(
          kind,
          providerOptions,
        )
        const hostnames = uniqueDomains(tunnelHostnames[kind])
        const expectedIngress = buildCloudflareTunnelIngress(kind, hostnames)
        if (
          inspection.tunnel.status !== "healthy" ||
          !inspection.connected ||
          inspection.configurationVersion == null ||
          JSON.stringify(inspection.ingress) !== JSON.stringify(expectedIngress)
        ) {
          throw new Error("Cloudflare Tunnel evidence is incomplete.")
        }
      } catch (error) {
        recordFailure(`cloudflare_${kind}_tunnel`, error)
      }
    }),
    mapWithConcurrency(
      zoneDomains,
      ZONE_CONCURRENCY,
      async (domain) => {
        let zone: { id: string; name: string; status: string }
        try {
          const zones = await dependencies.listZones(domain, providerOptions)
          if (
            zones.length !== 1 ||
            zones[0]?.name.toLowerCase() !== domain ||
            zones[0].status !== "active"
          ) {
            throw new Error("Cloudflare zone evidence is incomplete.")
          }
          zone = zones[0]
        } catch (error) {
          recordFailure("cloudflare_zone", error)
          return
        }
        const zoneOptions = { ...providerOptions }
        await Promise.all([
          dependencies.getDnsUsage(zone.id, zoneOptions)
            .then((usage) => {
              if (
                !Number.isSafeInteger(usage.recordQuota) ||
                !Number.isSafeInteger(usage.recordUsage) ||
                usage.recordQuota < 0 ||
                usage.recordUsage < 0 ||
                usage.recordUsage > usage.recordQuota
              ) {
                throw new Error("Cloudflare DNS usage evidence is invalid.")
              }
            })
            .catch((error) => {
              recordFailure("cloudflare_dns", error)
            }),
          dependencies.getDnssec(zone.id, zoneOptions).then((result) => {
            if (result.status === "unknown") {
              throw new Error("Cloudflare DNSSEC evidence is invalid.")
            }
          }).catch((error) => {
            recordFailure("cloudflare_dnssec", error)
          }),
          ...[domain, `www.${domain}`, `admin.${domain}`].map(
            async (hostname) => {
              try {
                const result = await dependencies.getCertificate(
                  zone.id,
                  hostname,
                  zoneOptions,
                )
                if (!result.universalSslEnabled || !result.covered) {
                  throw new Error(
                    "Cloudflare certificate evidence is incomplete.",
                  )
                }
              } catch (error) {
                recordFailure("cloudflare_ssl", error)
              }
            },
          ),
        ])
      },
    ),
  ])

  return [...new Set(blockers)].sort()
}
