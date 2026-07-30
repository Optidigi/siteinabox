import "server-only"

import { normalizePublicDomainHost } from "@siteinabox/contracts/renderer-routing"

type FetchLike = typeof fetch

type CloudflareTunnelOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
}

export type CloudflareTunnelKind = "renderer" | "cms"

export type CloudflareTunnelIngressRule =
  | { hostname: string; service: string }
  | { service: "http_status:404" }

export type CloudflareTunnelResult = {
  id: string
  name: string
  status: "healthy" | "degraded" | "down" | "inactive" | "unknown"
  remotelyManaged: boolean
  raw: unknown
}

export type CloudflareTunnelReconciliation = {
  tunnel: CloudflareTunnelResult
  ingress: CloudflareTunnelIngressRule[]
  configurationVersion: number | null
  connected: boolean
  changed: boolean
}

export type CloudflareTunnelInspection = Omit<
  CloudflareTunnelReconciliation,
  "changed"
>

export class CloudflareTunnelConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CloudflareTunnelConfigurationError"
  }
}

export class CloudflareTunnelApiError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
  ) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "CloudflareTunnelApiError"
  }

  get permanent(): boolean {
    return this.status >= 400 &&
      this.status < 500 &&
      this.status !== 408 &&
      this.status !== 429
  }
}

const DEFAULT_API_BASE = "https://api.cloudflare.com/client/v4"
const RENDERER_SERVICE = "http://siteinabox-renderer:4321"
const CMS_SERVICE = "http://siteinabox-cms:3000"

const clean = (value: string | undefined): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const apiBase = (env: NodeJS.ProcessEnv): string =>
  (clean(env.CLOUDFLARE_API_BASE_URL) ?? DEFAULT_API_BASE).replace(/\/+$/, "")

const config = (options?: CloudflareTunnelOptions) => {
  const env = options?.env ?? process.env
  const token = clean(env.CLOUDFLARE_API_TOKEN)
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID)
  if (!token || !accountId) {
    throw new CloudflareTunnelConfigurationError(
      "Cloudflare Tunnel reconciliation requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.",
    )
  }
  return { env, token, accountId }
}

const requestHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
})

const responsePayload = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  return text ? JSON.parse(text) as unknown : null
}

const requireSuccess = (
  operation: string,
  response: Response,
  payload: unknown,
): Record<string, unknown> => {
  if (!response.ok || readObject(payload).success === false) {
    throw new CloudflareTunnelApiError(operation, response.status)
  }
  return readObject(payload)
}

const tunnelIdFor = (
  kind: CloudflareTunnelKind,
  env: NodeJS.ProcessEnv,
): string => {
  const id = clean(
    kind === "renderer"
      ? env.CLOUDFLARE_RENDERER_TUNNEL_ID
      : env.CLOUDFLARE_CMS_TUNNEL_ID,
  )
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new CloudflareTunnelConfigurationError(
      `CLOUDFLARE_${kind.toUpperCase()}_TUNNEL_ID must contain the dedicated Tunnel UUID.`,
    )
  }
  return id.toLowerCase()
}

const tunnelNameFor = (
  kind: CloudflareTunnelKind,
  env: NodeJS.ProcessEnv,
): string =>
  clean(
    kind === "renderer"
      ? env.CLOUDFLARE_RENDERER_TUNNEL_NAME
      : env.CLOUDFLARE_CMS_TUNNEL_NAME,
  ) ?? `siteinabox-${kind}`

export const cloudflareTunnelTarget = (
  kind: CloudflareTunnelKind,
  env: NodeJS.ProcessEnv = process.env,
): string => `${tunnelIdFor(kind, env)}.cfargotunnel.com`

const serviceFor = (kind: CloudflareTunnelKind): string =>
  kind === "renderer" ? RENDERER_SERVICE : CMS_SERVICE

export function buildCloudflareTunnelIngress(
  kind: CloudflareTunnelKind,
  hostnames: string[],
): CloudflareTunnelIngressRule[] {
  const hosts = [...new Set(hostnames.map((hostname) =>
    normalizePublicDomainHost(hostname)).filter(
      (hostname): hostname is string => Boolean(hostname),
    ))].sort()
  if (hosts.length !== hostnames.length) {
    throw new Error(`Cloudflare ${kind} Tunnel ingress contains an invalid or duplicate hostname.`)
  }
  const service = serviceFor(kind)
  return [
    ...hosts.map((hostname) => ({ hostname, service })),
    { service: "http_status:404" as const },
  ]
}

const parseTunnel = (value: unknown): CloudflareTunnelResult => {
  const result = readObject(value)
  const id = typeof result.id === "string" ? result.id : ""
  const name = typeof result.name === "string" ? result.name : ""
  if (!id || !name) {
    throw new CloudflareTunnelConfigurationError(
      "Cloudflare Tunnel response omitted its identity.",
    )
  }
  const rawStatus = typeof result.status === "string" ? result.status : "unknown"
  const status = ["healthy", "degraded", "down", "inactive"].includes(rawStatus)
    ? rawStatus as CloudflareTunnelResult["status"]
    : "unknown"
  if (
    result.deleted_at != null ||
    (typeof result.tun_type === "string" && result.tun_type !== "cfd_tunnel")
  ) {
    throw new CloudflareTunnelConfigurationError(
      "Cloudflare Tunnel is deleted or is not a cloudflared Tunnel.",
    )
  }
  return {
    id,
    name,
    status,
    remotelyManaged: result.config_src === "cloudflare",
    raw: value,
  }
}

export async function getCloudflareTunnel(
  kind: CloudflareTunnelKind,
  options?: CloudflareTunnelOptions,
): Promise<CloudflareTunnelResult> {
  const { env, token, accountId } = config(options)
  const id = tunnelIdFor(kind, env)
  const response = await (options?.fetchImpl ?? globalThis.fetch)(
    `${apiBase(env)}/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(id)}`,
    { method: "GET", headers: requestHeaders(token) },
  )
  const payload = await responsePayload(response)
  const envelope = requireSuccess(`Cloudflare ${kind} Tunnel read`, response, payload)
  const tunnel = parseTunnel(envelope.result)
  const rawTunnel = readObject(tunnel.raw)
  if (
    tunnel.id.toLowerCase() !== id ||
    tunnel.name !== tunnelNameFor(kind, env) ||
    !tunnel.remotelyManaged ||
    (typeof rawTunnel.account_tag === "string" &&
      rawTunnel.account_tag !== accountId)
  ) {
    throw new CloudflareTunnelConfigurationError(
      `Cloudflare ${kind} Tunnel is not the expected dedicated remotely managed Tunnel.`,
    )
  }
  return tunnel
}

const parseIngress = (
  value: unknown,
): { ingress: CloudflareTunnelIngressRule[]; exact: boolean } => {
  if (!Array.isArray(value)) return { ingress: [], exact: false }
  let exact = true
  const ingress = value.flatMap((entry): CloudflareTunnelIngressRule[] => {
    const rule = readObject(entry)
    const keys = Object.keys(rule)
    if (rule.service === "http_status:404" && rule.hostname == null) {
      if (keys.length !== 1) exact = false
      return [{ service: "http_status:404" }]
    }
    if (
      keys.length !== 2 ||
      !keys.includes("hostname") ||
      !keys.includes("service")
    ) {
      exact = false
    }
    const hostname = typeof rule.hostname === "string"
      ? normalizePublicDomainHost(rule.hostname)
      : null
    const service = typeof rule.service === "string" ? rule.service : null
    if (!hostname || !service) {
      exact = false
      return []
    }
    return [{ hostname, service }]
  })
  if (ingress.length !== value.length) exact = false
  return { ingress, exact }
}

const ingressEqual = (
  left: CloudflareTunnelIngressRule[],
  right: CloudflareTunnelIngressRule[],
): boolean => JSON.stringify(left) === JSON.stringify(right)

async function getTunnelConfiguration(
  kind: CloudflareTunnelKind,
  options?: CloudflareTunnelOptions,
): Promise<{ ingress: CloudflareTunnelIngressRule[]; version: number | null }> {
  const { env, token, accountId } = config(options)
  const id = tunnelIdFor(kind, env)
  const response = await (options?.fetchImpl ?? globalThis.fetch)(
    `${apiBase(env)}/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(id)}/configurations`,
    { method: "GET", headers: requestHeaders(token) },
  )
  const payload = await responsePayload(response)
  const envelope = requireSuccess(`Cloudflare ${kind} Tunnel configuration read`, response, payload)
  const result = readObject(envelope.result)
  const remoteConfig = readObject(result.config)
  const parsed = parseIngress(remoteConfig.ingress)
  const warpRouting = readObject(remoteConfig["warp-routing"])
  const topLevelExact = Object.keys(remoteConfig).every((key) =>
    key === "ingress" || key === "warp-routing") &&
    (
      remoteConfig["warp-routing"] == null ||
      (
        Object.keys(warpRouting).length === 1 &&
        warpRouting.enabled === false
      )
    )
  return {
    ingress: parsed.exact && topLevelExact ? parsed.ingress : [],
    version: Number.isSafeInteger(result.version) ? Number(result.version) : null,
  }
}

async function putTunnelConfiguration(
  kind: CloudflareTunnelKind,
  ingress: CloudflareTunnelIngressRule[],
  options?: CloudflareTunnelOptions,
): Promise<void> {
  const { env, token, accountId } = config(options)
  const id = tunnelIdFor(kind, env)
  const response = await (options?.fetchImpl ?? globalThis.fetch)(
    `${apiBase(env)}/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(id)}/configurations`,
    {
      method: "PUT",
      headers: requestHeaders(token),
      body: JSON.stringify({ config: { ingress } }),
    },
  )
  const payload = await responsePayload(response)
  requireSuccess(`Cloudflare ${kind} Tunnel configuration write`, response, payload)
}

async function tunnelHasConnections(
  kind: CloudflareTunnelKind,
  options?: CloudflareTunnelOptions,
): Promise<boolean> {
  const { env, token, accountId } = config(options)
  const id = tunnelIdFor(kind, env)
  const response = await (options?.fetchImpl ?? globalThis.fetch)(
    `${apiBase(env)}/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(id)}/connections`,
    { method: "GET", headers: requestHeaders(token) },
  )
  const payload = await responsePayload(response)
  const envelope = requireSuccess(`Cloudflare ${kind} Tunnel connections read`, response, payload)
  if (!Array.isArray(envelope.result)) return false
  return envelope.result.some((client) => {
    const conns = readObject(client).conns
    return Array.isArray(conns) && conns.some((connection) => {
      const parsed = readObject(connection)
      return typeof parsed.id === "string" &&
        parsed.id.length > 0 &&
        parsed.is_pending_reconnect === false
    })
  })
}

/**
 * Strictly read-only Tunnel evidence used by release preflight. Keep this
 * separate from reconciliation so a capability check can never drift into a
 * configuration PUT.
 */
export async function inspectCloudflareTunnel(
  kind: CloudflareTunnelKind,
  options?: CloudflareTunnelOptions,
): Promise<CloudflareTunnelInspection> {
  const tunnel = await getCloudflareTunnel(kind, options)
  const configuration = await getTunnelConfiguration(kind, options)
  return {
    tunnel,
    ingress: configuration.ingress,
    configurationVersion: configuration.version,
    connected:
      tunnel.status === "healthy" &&
      await tunnelHasConnections(kind, options),
  }
}

export async function reconcileCloudflareTunnel(
  kind: CloudflareTunnelKind,
  hostnames: string[],
  options?: CloudflareTunnelOptions,
): Promise<CloudflareTunnelReconciliation> {
  await getCloudflareTunnel(kind, options)
  const expected = buildCloudflareTunnelIngress(kind, hostnames)
  const before = await getTunnelConfiguration(kind, options)
  let changed = false
  if (!ingressEqual(before.ingress, expected)) {
    try {
      await putTunnelConfiguration(kind, expected, options)
    } catch (error) {
      const reconciled = await getTunnelConfiguration(kind, options)
      if (!ingressEqual(reconciled.ingress, expected)) {
        if (error instanceof CloudflareTunnelApiError && error.permanent) {
          throw error
        }
        throw new Error(
          `Cloudflare ${kind} Tunnel configuration has an indeterminate outcome.`,
        )
      }
    }
    changed = true
  }
  const after = await getTunnelConfiguration(kind, options)
  if (!ingressEqual(after.ingress, expected)) {
    throw new Error(`Cloudflare ${kind} Tunnel configuration did not reconcile exactly.`)
  }
  const tunnel = await getCloudflareTunnel(kind, options)
  return {
    tunnel,
    ingress: after.ingress,
    configurationVersion: after.version,
    connected:
      tunnel.status === "healthy" &&
      await tunnelHasConnections(kind, options),
    changed,
  }
}
