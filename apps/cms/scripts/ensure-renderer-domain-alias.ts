import Module from "node:module"
import { pathToFileURL } from "node:url"
import type { Payload } from "payload"
import type { SiteSetting, Tenant } from "@/payload-types"
import { normalizePublicDomainHost } from "@siteinabox/contracts/renderer-routing"

type DocumentId = string | number

export type RendererAliasOptions = {
  domain: string
  alias: string
  execute: boolean
}

export type RendererAliasResult = {
  domain: string
  alias: string
  tenantId: DocumentId
  settingsId: DocumentId
  changed: boolean
  verified: boolean
}

type SnapshotResolver = (
  payload: Payload,
  rawHost: string,
) => Promise<{ tenant: { id: DocumentId } } | null>

const loadSnapshotResolver = async (): Promise<SnapshotResolver> => {
  const loader = Module as unknown as {
    _load?: (request: string, parent: unknown, isMain: boolean) => unknown
    _siabServerOnlyShimInstalled?: boolean
  }
  if (!loader._siabServerOnlyShimInstalled && loader._load) {
    const originalLoad = loader._load
    loader._load = (request, parent, isMain) => {
      if (request === "server-only" || request.includes("/node_modules/server-only/")) return {}
      return originalLoad(request, parent, isMain)
    }
    loader._siabServerOnlyShimInstalled = true
  }
  return (await import("@/lib/publish/siteSnapshots")).resolvePublishedSnapshotByHost
}

const usage = () => `
Usage:
  pnpm ops:renderer-alias -- --domain=example.nl --alias=www.example.nl [--execute]

Dry-run is the default. Pass --execute to add the alias. The command refuses
canonical-domain and alias collisions, preserves existing aliases, and verifies
that both hosts resolve to the same active published snapshot.
`

const requiredHost = (name: string, rawValue: string | undefined): string => {
  const normalized = normalizePublicDomainHost(rawValue)
  if (!normalized) throw new Error(`--${name} must be a valid public hostname.`)
  return normalized
}

export const parseRendererAliasArgs = (argv: string[]): RendererAliasOptions => {
  let domain: string | undefined
  let alias: string | undefined
  let execute = false

  for (const argument of argv) {
    if (argument === "--execute") {
      execute = true
    } else if (argument === "--dry-run" || argument === "dry-run") {
      execute = false
    } else if (argument.startsWith("--domain=")) {
      domain = argument.slice("--domain=".length)
    } else if (argument.startsWith("--alias=")) {
      alias = argument.slice("--alias=".length)
    } else if (argument === "--help" || argument === "-h") {
      throw new Error(usage())
    } else {
      throw new Error(`Unknown argument: ${argument}\n${usage()}`)
    }
  }

  const normalizedDomain = requiredHost("domain", domain)
  const normalizedAlias = requiredHost("alias", alias)
  if (normalizedDomain === normalizedAlias) {
    throw new Error("--alias must differ from --domain.")
  }

  return {
    domain: normalizedDomain,
    alias: normalizedAlias,
    execute,
  }
}

const relationshipId = (
  relationship: DocumentId | Tenant | null | undefined,
): DocumentId | null => {
  if (typeof relationship === "number" || typeof relationship === "string") return relationship
  return relationship?.id ?? null
}

const normalizedAliases = (settings: SiteSetting): string[] =>
  (settings.aliases ?? [])
    .map(({ host }) => normalizePublicDomainHost(host))
    .filter((host): host is string => Boolean(host))

const sameId = (left: DocumentId | null, right: DocumentId | null): boolean =>
  left !== null && right !== null && String(left) === String(right)

const requireSingle = <T>(
  values: T[],
  notFoundMessage: string,
  duplicateMessage: string,
): T => {
  if (values.length === 0) throw new Error(notFoundMessage)
  if (values.length > 1) throw new Error(duplicateMessage)
  return values[0]!
}

const verifyHostResolution = async (
  payload: Payload,
  resolver: SnapshotResolver,
  host: string,
  tenantId: DocumentId,
): Promise<void> => {
  const result = await resolver(payload, host)
  if (!result || !sameId(result.tenant.id, tenantId)) {
    throw new Error(`${host} does not resolve to the expected active tenant snapshot.`)
  }
}

export async function ensureRendererDomainAlias(
  payload: Payload,
  options: RendererAliasOptions,
  resolver?: SnapshotResolver,
): Promise<RendererAliasResult> {
  const activeResolver = resolver ?? await loadSnapshotResolver()
  const tenantResult = await payload.find({
    collection: "tenants",
    where: { domain: { equals: options.domain } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = requireSingle(
    tenantResult.docs as Tenant[],
    `No tenant has canonical domain ${options.domain}.`,
    `Multiple tenants have canonical domain ${options.domain}; refusing to continue.`,
  )
  if (tenant.status !== "active") {
    throw new Error(`Tenant ${String(tenant.id)} is not active.`)
  }

  const settingsResult = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: tenant.id } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const settings = requireSingle(
    settingsResult.docs as SiteSetting[],
    `Tenant ${String(tenant.id)} has no site-settings record.`,
    `Tenant ${String(tenant.id)} has multiple site-settings records; refusing to continue.`,
  )

  const canonicalCollision = await payload.find({
    collection: "tenants",
    where: { domain: { equals: options.alias } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if ((canonicalCollision.docs as Tenant[]).some((candidate) => !sameId(candidate.id, tenant.id))) {
    throw new Error(`${options.alias} is another tenant's canonical domain.`)
  }

  const allSettings = await payload.find({
    collection: "site-settings",
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const aliasOwners = (allSettings.docs as SiteSetting[]).filter((candidate) =>
    normalizedAliases(candidate).includes(options.alias),
  )
  if (
    aliasOwners.some((candidate) =>
      !sameId(relationshipId(candidate.tenant), tenant.id),
    )
  ) {
    throw new Error(`${options.alias} is already assigned to another tenant.`)
  }

  await verifyHostResolution(payload, activeResolver, options.domain, tenant.id)

  const alreadyPresent = normalizedAliases(settings).includes(options.alias)
  if (!alreadyPresent && options.execute) {
    await payload.update({
      collection: "site-settings",
      id: settings.id,
      data: {
        aliases: [
          ...(settings.aliases ?? []).map((entry) => ({ ...entry })),
          { host: options.alias },
        ],
      },
      depth: 0,
      overrideAccess: true,
    })
  }

  const verified = alreadyPresent || options.execute
  if (verified) {
    await verifyHostResolution(payload, activeResolver, options.alias, tenant.id)
  }

  return {
    domain: options.domain,
    alias: options.alias,
    tenantId: tenant.id,
    settingsId: settings.id,
    changed: !alreadyPresent && options.execute,
    verified,
  }
}

const main = async () => {
  const options = parseRendererAliasArgs(process.argv.slice(2))
  await import("dotenv/config")
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  const payload = await getPayload({ config })

  try {
    const result = await ensureRendererDomainAlias(payload, options)
    const mode = options.execute ? "execute" : "dry-run"
    const action = result.changed ? "added" : result.verified ? "already active" : "would add"
    console.log(`[renderer-alias] mode=${mode} domain=${result.domain} alias=${result.alias} action=${action}`)
    console.log(`[renderer-alias] tenant=${String(result.tenantId)} settings=${String(result.settingsId)} verified=${String(result.verified)}`)
  } finally {
    await payload.db.destroy?.()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Renderer alias operation failed.")
      process.exit(1)
    })
}
